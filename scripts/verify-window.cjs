// Check TODAY + TOMORROW day rows per sport (authed as super admin).
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
  var tM = 0, tmM = 0;
  for (var s of SPORTS) {
    var d1 = null, d2 = null;
    try { d1 = await client.query(anyApi.predictor.getDay, { sportId: s, dayKey: today }); } catch (_) {}
    try { d2 = await client.query(anyApi.predictor.getDay, { sportId: s, dayKey: tomorrow }); } catch (_) {}
    var m1 = 0, m2 = 0;
    try { m1 = (await client.query(anyApi.predictor.listMatches, { sportId: s, dayKey: today }) || []).length; } catch (_) {}
    try { m2 = (await client.query(anyApi.predictor.listMatches, { sportId: s, dayKey: tomorrow }) || []).length; } catch (_) {}
    tM += m1; tmM += m2;
    console.log(s.padEnd(17) + ' today: ' + String(m1).padStart(2) + 'm (' + (d1 ? d1.status : 'no-row') + ')' +
      ' | tomorrow: ' + String(m2).padStart(2) + 'm (' + (d2 ? d2.status : 'no-row') + ')');
  }
  console.log('TOTAL today=' + tM + ' tomorrow=' + tmM);
  process.exit(0);
}
main().catch(function (e) { console.log('FATAL: ' + (e && e.message || e)); process.exit(1); });
