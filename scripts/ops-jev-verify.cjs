// Ops: verify the Jev integration end-to-end (verdict rows carry jevEvaluation; Copilot attaches the Jev anchor).
var fs = require('fs');
var path = require('path');
var env = {};
fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/).forEach(function (l) {
  var t = l.trim(); if (!t || t.indexOf('=') === -1 || t.indexOf('#') === 0) return;
  var eq = t.indexOf('='); env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
});

var ConvexHttpClient = require('convex/browser').ConvexHttpClient;
var anyApi = require('convex/server').anyApi;  var client = new ConvexHttpClient(env.PUBLIC_CONVEX_URL);

  // Today's WAT (UTC+1) day key — the convention watTodayKey() uses.
  var dayKey = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
  console.log('dayKey:', dayKey);

(async function () {
  // ── 1. Sign in as admin (proven flow shape) ──
  var signedIn = null;
  try {
    signedIn = await client.action(anyApi.auth.signIn, {
      provider: 'password',
      params: { flow: 'signIn', email: env.SUPER_ADMIN_EMAIL, password: env.SUPER_ADMIN_PASSWORD }
    });
  } catch (e) {
    console.log('ADMIN SIGNIN FAILED:', String(e && e.message || e).slice(0, 150));
    process.exit(1);
  }
  var t = signedIn && signedIn.tokens;
  var token = t && (t.token || (Array.isArray(t) && t[0] && (t[0].token || t[0])));
  if (!token) { console.log('NO TOKEN — shape:', JSON.stringify(t).slice(0, 120)); process.exit(1); }
  client.setAuth(token);
  console.log('admin sign-in: OK');

  // ── 2. Pull verdicts for the populated sports ──
  var sports = ['football', 'basketball', 'tennis', 'hockey', 'baseball', 'americanfootball'];
  var total = 0, withJev = 0;
  var sample = null;
  for (const s of sports) {
    try {
      var rows = await client.query(anyApi.predictor.listMatches, { sportId: s, dayKey: dayKey });
      var matches = (rows && (rows.matches || rows.results)) || (Array.isArray(rows) ? rows : []);
      if (!Array.isArray(matches) || !matches.length) {
        console.log(s + ': 0 matches | raw shape:', typeof rows, rows && typeof rows === 'object' ? Object.keys(rows).join(',') : String(rows).slice(0, 60));
        continue;
      }
      total += matches.length;
      // Pull verdicts per match via getVerdict (authed) for the first 2 per sport
      for (var i = 0; i < Math.min(2, matches.length); i++) {
        try {
          var v = await client.query(anyApi.predictor.getVerdict, { dayKey: dayKey, matchId: matches[i].matchId });
          if (v) {
            total++;
            if (v.jevEvaluation) { withJev++; if (!sample) sample = v.jevEvaluation; }
          }
        } catch (e) { /* getVerdict may not exist under that name */ }
      }
    } catch (e) {
      console.log(s + ': query error ' + String(e && e.message || e).slice(0, 80));
    }
  }
  console.log('verdict rows inspected with jevEvaluation:', withJev);
  if (sample) {
    console.log('sample jevEvaluation: engine=' + sample.engine + ' model=' + String(sample.model).slice(0, 40));
    var answers = sample.answers || {};
    for (var k in answers) {
      var a = answers[k];
      console.log('  ' + k + ' [' + a.type + ']:', a.type === 'noul' ? a.noul : a.type === 'choice' ? a.choice : a.score);
    }
    if (sample.phrases) console.log('phrases: ' + sample.phrases.slice(0, 2).join(' | ').slice(0, 220));
  } else {
    console.log('NO jevEvaluation found on any inspected verdict');
  }

  // ── 3. Copilot: confirm the Jev anchor is live ──
  var site = process.env.AUDIT_SITE_URL || 'https://pulseodds.ewinproject.org';
  var res = await fetch(site + '/api/ai-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are the PulseOdds AI Copilot.' },
        { role: 'user', content: 'Arsenal vs Chelsea: Home 1.85, Draw 3.60, Away 4.20. Which market should I back?' }
      ]
    })
  });
  var j = await res.json().catch(function () { return null; });
  console.log('copilot HTTP', res.status, '| provider:', j && j.provider, '| jev:', j && j.jev ? j.jev.engine + '/' + String(j.jev.model).slice(0, 36) : 'NONE');
  if (j && j.response) console.log('copilot answer (first 160):', String(j.response).replace(/\s+/g, ' ').slice(0, 160));
  process.exit(0);
})();