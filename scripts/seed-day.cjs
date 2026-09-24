// Seed a specific dayKey's fixture cache for all 11 predictor sports.
// Usage: node scripts/seed-day.cjs [tomorrow|today|YYYY-MM-DD]
//
// startRefresh returns SILENTLY (alreadyRunning / rate-limited) without
// scheduling when a previous run for the sport is still 'running' or the
// 4/min per-sport bucket is exhausted — so this script inspects every
// response and retries with backoff until each sport actually schedules.
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

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function main() {
  var arg = process.argv[2] || 'tomorrow';
  var dayKey;
  if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
    dayKey = arg;
  } else {
    // today = WAT day (+1h shift); tomorrow = WAT day +1
    var shift = arg === 'today' ? 60 * 60 * 1000 : 25 * 60 * 60 * 1000;
    dayKey = new Date(Date.now() + shift).toISOString().slice(0, 10);
  }
  console.log('Seeding day ' + dayKey + ' for ' + SPORTS.length + ' sports...');
  var client = new ConvexHttpClient(envMap.PUBLIC_CONVEX_URL);
  var si = await client.action(anyApi.auth.signIn, {
    provider: 'password',
    params: { flow: 'signIn', email: envMap.SUPER_ADMIN_EMAIL, password: envMap.SUPER_ADMIN_PASSWORD }
  });
  var tok = si && si.tokens && (si.tokens.token || (Array.isArray(si.tokens) && si.tokens[0] && (si.tokens[0].token || si.tokens[0])));
  client.setAuth(tok);

  var pending = SPORTS.slice();
  var attempt = 0;
  while (pending.length > 0 && attempt < 6) {
    attempt += 1;
    if (attempt > 1) {
      console.log('-- retry round ' + attempt + ' for: ' + pending.join(', '));
      await sleep(65_000); // clear the 4/min per-sport refresh bucket
    }
    var stillPending = [];
    for (var s of pending) {
      try {
        var r = await client.mutation(anyApi.predictor.startRefresh, { sportId: s, dayKey: dayKey, incremental: false });
        // A real schedule returns { runId: 'run_..._<ts>', alreadyRunning: false }.
        // alreadyRunning=true means a stale 'running' row or a rate-limit bounce
        // — either way nothing new was scheduled, so keep the sport pending.
        if (r && r.runId && r.alreadyRunning === false) {
          console.log('  scheduled: ' + s + ' (' + r.runId + ')');
        } else {
          console.log('  deferred: ' + s + ' (' + JSON.stringify(r) + ')');
          stillPending.push(s);
        }
      } catch (e) {
        console.log('  FAILED: ' + s + ' — ' + ((e && e.message) || e));
        stillPending.push(s);
      }
      await sleep(300); // gentle spacing between sport kicks
    }
    pending = stillPending;
  }

  if (pending.length > 0) {
    console.log('WARNING: could not schedule: ' + pending.join(', '));
    process.exitCode = 2;
  } else {
    console.log('All refresh cycles scheduled. Cached rows appear over the next few minutes.');
  }
  process.exit(process.exitCode || 0);
}
main().catch(function (e) { console.log('FATAL: ' + ((e && e.message) || e)); process.exit(1); });
