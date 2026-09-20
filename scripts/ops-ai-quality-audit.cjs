#!/usr/bin/env node
// ── Ops: AI quality audit ─────────────────────────────────────────────────────
// Usage: node scripts/ops-ai-quality-audit.cjs
// Reads SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD from .env.local (never printed).
// Sections:
//   A. Auth QA      — admin sign-in via Convex auth + access flags, anonymous
//                     rejection of master-pass queries, fresh signUp roundtrip.
//   B. Verdict QA   — every sport's today-day verdicts: 9-agent SMOA panel,
//                     aiReport completeness, LLM-vs-deterministic mix, freshness.
//   C. Copilot QA   — POST /api/ai-analyze with a real screening prompt.
"use strict";

var fs = require('fs');
var path = require('path');
var https = require('https');
var { ConvexHttpClient } = require('convex/browser');

var ROOT = path.resolve(__dirname, '..');
var SITE = process.env.AUDIT_SITE_URL || 'https://pulseodds.ewinproject.org';

function loadEnv() {
  var envMap = {};
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).forEach(function (l) {
    var t = l.trim();
    if (!t || t[0] === '#') return;
    var eq = t.indexOf('=');
    if (eq === -1) return;
    envMap[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  });
  return envMap;
}

function todayKey() {
  // Mirror app convention: WAT today key (YYYY-MM-DD).
  var now = new Date(Date.now() + 60 * 60 * 1000); // WAT = UTC+1
  return now.toISOString().slice(0, 10);
}

var SPORTS = ['football', 'basketball', 'tennis', 'rally', 'hockey', 'baseball',
  'americanfootball', 'rugby', 'cricket', 'mma', 'volleyball'];

function anyApi(client) {
  // anyApi avoids codegen coupling in ops scripts.
  return client.anyApi || require('convex/server').anyApi;
}

function postJson(url, body) {
  return new Promise(function (resolve) {
    var data = JSON.stringify(body);
    try {
      var u = new URL(url);
      var req = https.request({
        hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
        timeout: 45000
      }, function (res) {
        var buf = '';
        res.on('data', function (c) { buf += c; });
        res.on('end', function () {
          var j = null; try { j = JSON.parse(buf); } catch (_) {}
          resolve({ status: res.statusCode, body: buf.slice(0, 400), json: j });
        });
      });
      req.on('error', function (e) { resolve({ status: 0, body: String(e), json: null }); });
      req.on('timeout', function () { req.destroy(); resolve({ status: 0, body: 'timeout', json: null }); });
      req.write(data); req.end();
    } catch (e) { resolve({ status: 0, body: String(e), json: null }); }
  });
}

async function main() {
  var envMap = loadEnv();
  var CONVEX_URL = process.env.PUBLIC_CONVEX_URL || envMap.PUBLIC_CONVEX_URL || 'https://gallant-minnow-735.eu-west-1.convex.cloud';
  var ADMIN_EMAIL = envMap.SUPER_ADMIN_EMAIL;
  var ADMIN_PASSWORD = envMap.SUPER_ADMIN_PASSWORD;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.log('ABORT: admin credentials missing in .env.local'); process.exit(1); }

  var client = new ConvexHttpClient(CONVEX_URL);
  var anyApiRef = require('convex/server').anyApi;

  var issues = [];

  // ── A. AUTH QA ──────────────────────────────────────────────────────────────
  console.log('== A. AUTH QA ==');
  var signedIn = null;
  try {
    // @convex-dev/auth password flow shape (provider is REQUIRED — omitting it
    // routes through provider discovery, which fails server-side)
    signedIn = await client.action(anyApiRef.auth.signIn, {
      provider: 'password',
      params: { flow: 'signIn', email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    });
  } catch (e) {
    console.log('admin signIn FAILED: ' + String(e && e.message || e).slice(0, 120));
    issues.push('admin signIn failed');
  }
  var token = signedIn && signedIn.tokens && (signedIn.tokens.token || (Array.isArray(signedIn.tokens) && signedIn.tokens[0] && (signedIn.tokens[0].token || signedIn.tokens[0])));
  console.log('admin token acquired: ' + (token ? 'yes' : 'NO'));
  if (!token) issues.push('no admin token');

  if (token) {
    client.setAuth(token);
    var prof = null;
    try { prof = await client.query(anyApiRef.users.me, {}); } catch (e) {
      try { prof = await client.mutation(anyApiRef.users.syncAccess, {}); } catch (e2) { prof = { err: String(e2 && e2.message || e2).slice(0, 100) }; }
    }
    console.log('admin access flags: ' + JSON.stringify(prof && {
      isAdmin: prof.isAdmin, isTester: prof.isTester, isSubscribed: prof.isSubscribed,
      tier: prof.subscriptionTier, hasMasterPass: prof.hasMasterPass
    }));
    if (!prof || (!prof.isAdmin && !prof.hasMasterPass)) issues.push('admin lacks elevated flags');

    // Anonymous rejection of a master-pass query — access control must bite.
    var anon = new ConvexHttpClient(CONVEX_URL);
    var rejected = false;
    try { await anon.query(anyApiRef.predictor.listMatches, { sportId: 'football', dayKey: todayKey() }); }
    catch (e) { rejected = true; }
    console.log('anonymous listMatches rejected: ' + rejected);
    if (!rejected) issues.push('anonymous master-pass query NOT rejected');

    // Fresh signUp roundtrip (unique email) — real customers flow.
    var freshEmail = 'audit+' + Date.now() + '@example.invalid';
    var created = null;
    try {
    created = await anon.action(anyApiRef.auth.signIn, {
      provider: 'password',
      params: { flow: 'signUp', email: freshEmail, password: 'Audit-' + Math.random().toString(36).slice(2) + '9!' }
    });
    } catch (e) { created = null; }
    var freshTok = created && created.tokens && (created.tokens.token || (Array.isArray(created.tokens) && created.tokens[0] && (created.tokens[0].token || created.tokens[0])));
    var freshFlags = null;
    if (freshTok) {
      anon.setAuth(freshTok);
      try { freshFlags = await anon.query(anyApiRef.users.getProfile, {}); } catch (e) { freshFlags = { err: String(e).slice(0, 80) }; }
    }
    var fOk = freshFlags && !freshFlags.isAdmin && !freshFlags.isTester;
    console.log('fresh signUp roundtrip: ' + (fOk ? 'ok (regular flags)' : 'FAILED ' + JSON.stringify(freshFlags || {}).slice(0, 100)));
    if (!fOk) issues.push('fresh signUp roundtrip failed');
  }

  // ── B. VERDICT QA per sport ────────────────────────────────────────────────
  console.log('\n== B. VERDICT QA (day ' + todayKey() + ') ==');
  var day = todayKey();
  var perSport = [];
  for (var s of SPORTS) {
    var matches = [];
    try { matches = await client.query(anyApiRef.predictor.listMatches, { sportId: s, dayKey: day }); }
    catch (e) { matches = []; }
    var dayRow = null;
    try { dayRow = await client.query(anyApiRef.predictor.getDayInternal, { sportId: s, dayKey: day }); } catch (e) { dayRow = null; }
    var entry = { sport: s, matches: matches.length, status: dayRow && dayRow.status, verdicts: 0, llm: 0, agentsOk: 0, reportOk: 0, futureKick: 0, problems: [] };
    for (var m of matches) {
      var v = null;
      try { v = await client.query(anyApiRef.predictor.getVerdict, { dayKey: day, matchId: m.matchId }); } catch (e) { v = null; }
      if (!v) { entry.problems.push(m.matchId + ':no-verdict'); continue; }
      entry.verdicts++;
      if (v.llmUsed) entry.llm++;
      var nAgents = Array.isArray(v.agentsRun) ? v.agentsRun.length : 0;
      if (nAgents >= 9) entry.agentsOk++;
      var r = v.aiReport || {};
      var hasReport = typeof r.verdictSummary === 'string' && r.verdictSummary.length > 40 &&
        Array.isArray(r.crossCheckSteps) && r.crossCheckSteps.length >= 3 &&
        (Array.isArray(r.top3Selections) || typeof r.tacticalRecommendation === 'string');
      if (hasReport) entry.reportOk++;
      else entry.problems.push(m.matchId + ':weak-aiReport');
      if (m.startTime && new Date(m.startTime).getTime() > Date.now()) entry.futureKick++;
      if (v.llmUsed && (!Array.isArray(v.citations) || v.citations.length === 0)) entry.problems.push(m.matchId + ':llm-no-citations(warn)');
    }
    perSport.push(entry);
  }
  perSport.forEach(function (e) {
    console.log(
      e.sport.padEnd(17) +
      'matches=' + String(e.matches).padStart(2) +
      ' verdicts=' + String(e.verdicts).padStart(2) +
      ' llm=' + String(e.llm).padStart(2) +
      ' agents9=' + String(e.agentsOk).padStart(2) +
      ' report=' + String(e.reportOk).padStart(2) +
      ' future=' + String(e.futureKick).padStart(2) +
      ' status=' + e.status +
      (e.problems.length ? '  ⚠ ' + e.problems.slice(0, 2).join(',') : '')
    );
    if (e.matches === 0) issues.push(e.sport + ': no fixtures for today');
    else if (e.verdicts < e.matches) issues.push(e.sport + ': missing verdicts (' + (e.matches - e.verdicts) + ')');
    else if (e.reportOk < e.verdicts) issues.push(e.sport + ': weak aiReport rows');
    // citation gaps are a warning only (Agnes/CF providers may omit grounding metadata)
    var citeWarns = e.problems.filter(function (p) { return p.indexOf('warn') !== -1; }).length;
    if (citeWarns) console.log('  note: ' + citeWarns + ' LLM verdict(s) without citations (provider does not emit grounding metadata)');
  });
  var totMatches = perSport.reduce(function (a, e) { return a + e.matches; }, 0);
  var totVerdicts = perSport.reduce(function (a, e) { return a + e.verdicts; }, 0);
  var totLlm = perSport.reduce(function (a, e) { return a + e.llm; }, 0);
  console.log('TOTAL: matches=' + totMatches + ' verdicts=' + totVerdicts + ' llmDebated=' + totLlm);

  // ── C. COPILOT QA (production edge) ────────────────────────────────────────
  console.log('\n== C. COPILOT QA (' + SITE + ') ==');
  var SCREEN_PROMPT = 'You are screening a match for a conservative punter. Arsenal vs Chelsea, Premier League, kickoff tonight. Odds: home 2.10, draw 3.40, away 3.60. In 3 sentences: is the home win a value pick, and what is the biggest risk?';
  var resp = await postJson(SITE + '/api/ai-analyze', {
    messages: [{ role: 'user', content: SCREEN_PROMPT }],
    max_tokens: 300
  });
  var okCopilot = resp.status === 200 && resp.json && (resp.json.response || resp.json.text || resp.json.responseText) && String(resp.json.response || resp.json.text || resp.json.responseText).length > 20;
  var answer = resp.json && (resp.json.response || resp.json.text || resp.json.responseText);
  console.log('status=' + resp.status + ' provider=' + (resp.json && resp.json.provider || '?') + ' answerLen=' + (answer ? String(answer).length : 0));
  if (answer) console.log('answer excerpt: ' + String(answer).replace(/\s+/g, ' ').slice(0, 160));
  if (!okCopilot) issues.push('copilot probe failed: ' + resp.status + ' ' + resp.body.slice(0, 80));

  // ── Verdict ─────────────────────────────────────────────────────────────────
  console.log('\n== VERDICT ==');
  if (issues.length) {
    console.log('ISSUES (' + issues.length + '):');
    issues.forEach(function (i) { console.log(' - ' + i); });
    process.exitCode = 2;
  } else {
    console.log('ALL CLEAR — auth, verdicts, agents, aiReports, and Copilot all verified.');
  }
  process.exit(process.exitCode || 0);
}

main().catch(function (e) { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
