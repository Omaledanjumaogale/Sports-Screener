// Seed a specific dayKey's fixture cache for all 11 predictor sports.
// Usage: node scripts/seed-day.cjs [tomorrow|YYYY-MM-DD]
// Signs in as the super-admin, then calls the authenticated startRefresh
// mutation per sport; the server schedules the full scrape+verdict pipeline
// for that day (same structural feeds + quality gates as today).
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
  var arg = process.argv[2] || 'tomorrow';
  var dayKey;
  if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
    dayKey = arg;
  } else {
    // tomorrow = WAT day +1 (WAT is UTC+1)
    dayKey = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  console.log('Seeding day ' + dayKey + ' for ' + SPORTS.length + ' sports...');
  var client = new ConvexHttpClient(envMap.PUBLIC_CONVEX_URL);
  var si = await client.action(anyApi.auth.signIn, {
    provider: 'password',
    params: { flow: 'signIn', email: envMap.SUPER_ADMIN_EMAIL, password: envMap.SUPER_ADMIN_PASSWORD }
  });
  var tok = si && si.tokens && (si.tokens.token || (Array.isArray(si.tokens) && si.tokens[0] && (si.tokens[0].token || si.tokens[0])));
  client.setAuth(tok);
  for (var s of SPORTS) {
    try {
      await client.mutation(anyApi.predictor.startRefresh, { sportId: s, dayKey: dayKey, incremental: false });
      console.log('  scheduled: ' + s);
    } catch (e) {
      console.log('  FAILED: ' + s + ' — ' + ((e && e.message) || e));
    }
  }
  console.log('All refresh cycles scheduled. Cached rows appear over the next few minutes.');
  process.exit(0);
}
main().catch(function (e) { console.log('FATAL: ' + ((e && e.message) || e)); process.exit(1); });
