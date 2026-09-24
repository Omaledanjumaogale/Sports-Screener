// Dump raw cached fixtures per sport — team names, leagues, sources — for QA.
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
  var today = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
  var tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString().slice(0, 10);
  var which = process.argv[2] === 'tomorrow' ? tomorrow : today;
  for (var s of SPORTS) {
    var rows = [];
    try { rows = await client.query(anyApi.predictor.listMatches, { sportId: s, dayKey: which }); } catch (_) {}
    if (!rows.length) { console.log('== ' + s + ': EMPTY'); continue; }
    console.log('== ' + s.toUpperCase() + ' (' + rows.length + ') [' + which + '] ==');
    rows.slice(0, 14).forEach(function (m) {
      console.log('  [' + m.source + '] ' + m.homeTeam + '  vs  ' + m.awayTeam + '  | league: ' + m.league);
    });
  }
  process.exit(0);
}
main().catch(function (e) { console.log('FATAL: ' + (e && e.message || e)); process.exit(1); });
