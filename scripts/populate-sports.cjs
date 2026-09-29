// Populate the AI Predictor for every sport by scheduling the orchestrator
// through the fast startRefresh mutation (authenticated super-admin client).
// Never invokes the long-running action directly — the CLI retry-while-waiting
// on a slow action was multiplying full pipeline runs (10-16x per sport).
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

var SPORTS = ['football', 'basketball', 'tennis', 'hockey', 'baseball', 'americanfootball'];
var sports = process.argv.slice(2);
if (sports.length) SPORTS = sports;

async function main() {
  var client = new ConvexHttpClient(envMap.PUBLIC_CONVEX_URL);
  var si = await client.action(anyApi.auth.signIn, {
    provider: 'password',
    params: { flow: 'signIn', email: envMap.SUPER_ADMIN_EMAIL, password: envMap.SUPER_ADMIN_PASSWORD }
  });
  var tok = si && si.tokens && (si.tokens.token || (Array.isArray(si.tokens) && si.tokens[0] && (si.tokens[0].token || si.tokens[0])));
  client.setAuth(tok);

  var scheduled = 0;
  for (var s of SPORTS) {
    try {
      var res = await client.mutation(anyApi.predictor.startRefresh, { sportId: s, dayKey: '', incremental: false });
      var state = res && res.alreadyRunning ? 'already-running' : 'scheduled';
      console.log(s + ': ' + state + (res && res.runId ? ' runId=' + String(res.runId).slice(0, 34) : ''));
      scheduled++;
    } catch (err) {
      console.log(s + ': FAILED ' + String(err && err.message || err).slice(0, 120));
    }
  }
  console.log('SCHEDULED ' + scheduled + '/' + SPORTS.length + ' sports — the orchestrator + cron stagger complete the pipelines.');
  process.exit(0);
}
main().catch(function (e) { console.log('FATAL: ' + (e && e.message || e)); process.exit(1); });
