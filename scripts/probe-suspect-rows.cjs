// Probe today's suspicious football rows: createdAt + sourceUrl.
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

var SUSPECT = ['atl. ottawa', 'lara', 'correcaminos', 'brooklyn'];

async function main() {
  var client = new ConvexHttpClient(envMap.PUBLIC_CONVEX_URL);
  var si = await client.action(anyApi.auth.signIn, {
    provider: 'password',
    params: { flow: 'signIn', email: envMap.SUPER_ADMIN_EMAIL, password: envMap.SUPER_ADMIN_PASSWORD }
  });
  var tok = si && si.tokens && (si.tokens.token || (Array.isArray(si.tokens) && si.tokens[0] && si.tokens[0].value));
  client.setAuth(tok);
  var today = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
  var rows = await client.query(anyApi.predictor.listMatches, { sportId: 'football', dayKey: today });
  rows = rows || [];
  console.log('TODAY ' + today + ' rows=' + rows.length);
  var fresh = rows.filter(function (r) { return r.createdAt > Date.now() - 15 * 60 * 1000; }).length;
  console.log('rows created in last 15min: ' + fresh);
  for (var r of rows) {
    var k = (r.homeTeam + ' ' + r.awayTeam).toLowerCase();
    if (SUSPECT.some(function (s) { return k.indexOf(s) >= 0; })) {
      console.log('  ' + r.homeTeam + ' vs ' + r.awayTeam + ' | ' + r.league + ' | src=' + r.source + ' | url=' + (r.sourceUrl || 'NONE') + ' | created=' + new Date(r.createdAt).toISOString());
    }
  }
  process.exit(0);
}
main().catch(function (e) { console.log('FATAL ' + (e && e.message || e)); process.exit(1); });
