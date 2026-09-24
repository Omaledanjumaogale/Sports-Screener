// Verify per-sport match + verdict counts for today (authed as super admin).
"use strict";
var fs = require('fs');
var path = require('path');
var { ConvexHttpClient } = require('convex/browser');
var anyApi = require('convex/server').anyApi;

var envMap = {};
fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/).forEach(function (l) {
  var t = l.trim(); if (!t || t[0] === '#') return;
  var eq = t.indexOf('='); if (eq > 0) envMap[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
});

var SPORTS = ['football', 'basketball', 'tennis', 'rally', 'hockey', 'baseball',
  'americanfootball', 'rugby', 'cricket', 'mma', 'volleyball'];

async function main() {
  var client = new ConvexHttpClient(envMap.PUBLIC_CONVEX_URL);
  var si = await client.action(anyApi.auth.signIn, {
    provider: 'password',
    params: { flow: 'signIn', email: envMap.SUPER_ADMIN_EMAIL, password: envMap.SUPER_ADMIN_PASSWORD }
  });
  var tok = si && si.tokens && (si.tokens.token || (Array.isArray(si.tokens) && si.tokens[0] && (si.tokens[0].token || si.tokens[0])));
  client.setAuth(tok);
  var day = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
  var totalMatches = 0, totalVerdicts = 0, totalQualifying = 0;
  for (var s of SPORTS) {
    var matches = [];
    try { matches = await client.query(anyApi.predictor.listMatches, { sportId: s, dayKey: day }); } catch (e) { matches = []; }
    var withVerdict = 0, qualifying = 0;
    for (var m of matches) {
      try {
        var v = await client.query(anyApi.predictor.getVerdict, { dayKey: day, matchId: m.matchId });
        if (v && (v.aiReport || v.greatMindsDebate)) withVerdict++;
      } catch (_) {}
      var scopes = m.scopes || {};
      if (scopes && scopes._meta && scopes._meta.oddsIsReal) qualifying++;
    }
    totalMatches += matches.length; totalVerdicts += withVerdict; totalQualifying += qualifying;
    console.log(s.padEnd(17) + ': matches=' + String(matches.length).padStart(2) + '  verdicts=' + String(withVerdict).padStart(2) + '  realOdds=' + qualifying);
  }
  console.log('TOTAL'.padEnd(17) + ': matches=' + totalMatches + '  verdicts=' + totalVerdicts + '  realOdds=' + totalQualifying);
  process.exit(0);
}
main().catch(function (e) { console.log('FATAL: ' + (e && e.message || e)); process.exit(1); });
