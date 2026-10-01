// Trigger seedTomorrowInternal via an admin-authenticated client by scheduling
// through the internal API is not reachable from outside; instead call the
// orchestrator directly per sport with seedOnly for tomorrow (same path the
// cron takes). Uses startRefresh when it supports dayKey/seedOnly, else falls
// back to scheduling each sport through the public startRefresh with the
// explicit tomorrow dayKey.
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

var SPORTS = ['football', 'basketball', 'tennis', 'hockey', 'baseball'];
var tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString().slice(0, 10);

async function main() {
  var client = new ConvexHttpClient(envMap.PUBLIC_CONVEX_URL);
  var si = await client.action(anyApi.auth.signIn, {
    provider: 'password',
    params: { flow: 'signIn', email: envMap.SUPER_ADMIN_EMAIL, password: envMap.SUPER_ADMIN_PASSWORD }
  });
  var tok = si && si.tokens && (si.tokens.token || (Array.isArray(si.tokens) && si.tokens[0] && si.tokens[0].value));
  client.setAuth(tok);
  for (var s of SPORTS) {
    try {
      var res = await client.mutation(anyApi.predictorOrchestrator.seedTomorrow, {});
      console.log('seedTomorrow: ' + JSON.stringify(res));
      break;
    } catch (e1) {
      // seedTomorrow (public wrapper) missing — schedule via startRefresh with dayKey.
      try {
        var r = await client.mutation(anyApi.predictor.startRefresh, { sportId: s, dayKey: tomorrow, seedOnly: true, incremental: false });
        console.log(s + ' ' + tomorrow + ': ' + (r && r.alreadyRunning ? 'already-running' : 'scheduled'));
      } catch (e2) {
        console.log(s + ': FAILED ' + String(e2 && e2.message || e2).slice(0, 140));
      }
    }
  }
  process.exit(0);
}
main().catch(function (e) { console.log('FATAL: ' + (e && e.message || e)); process.exit(1); });
