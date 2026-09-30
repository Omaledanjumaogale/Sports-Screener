// Distribution of league labels captured for a sport's cached fixtures.
// Usage: node scripts/league-audit.cjs tennis [dayKey]
"use strict";
var fs = require('fs');
var path = require('path');
var { ConvexHttpClient } = require('convex/browser');
var anyApi = require('convex/server').anyApi;

var sport = process.argv[2] || 'tennis';
var envMap = {};
fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/).forEach(function (l) {
  var t = l.trim(); if (!t || t[0] === '#') return;
  var eq = t.indexOf('='); if (eq > 0) envMap[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
});

async function main() {
  var client = new ConvexHttpClient(envMap.PUBLIC_CONVEX_URL);
  var si = await client.action(anyApi.auth.signIn, {
    provider: 'password',
    params: { flow: 'signIn', email: envMap.SUPER_ADMIN_EMAIL, password: envMap.SUPER_ADMIN_PASSWORD }
  });
  var tok = si && si.tokens && (si.tokens.token || (Array.isArray(si.tokens) && si.tokens[0] && (si.tokens[0].token || si.tokens[0])));
  client.setAuth(tok);

  var dayKey = process.argv[3] || new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
  var matches = (await client.query(anyApi.predictor.listMatches, { sportId: sport, dayKey: dayKey })) || [];
  var byLeague = {};
  for (var m of matches) {
    var k = m.league || '(none)';
    byLeague[k] = (byLeague[k] || 0) + 1;
  }
  console.log(sport + ' ' + dayKey + ' — ' + matches.length + ' matches, ' + Object.keys(byLeague).length + ' league labels');
  Object.entries(byLeague).sort(function (a, b) { return b[1] - a[1]; }).forEach(function (e) {
    console.log('  ' + String(e[1]).padStart(4) + '  ' + e[0]);
  });
  process.exit(0);
}
main().catch(function (e) { console.log('FATAL: ' + (e && e.message || e)); process.exit(1); });
