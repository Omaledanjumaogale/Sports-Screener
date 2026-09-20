// Diagnose day rows per sport via authed public query (predictor.getDay).
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
  for (var s of SPORTS) {
    var d = null;
    try { d = await client.query(anyApi.predictor.getDay, { sportId: s, dayKey: day }); } catch (e) { d = { err: String(e && e.message || e).slice(0, 60) }; }
    if (!d) { console.log(s.padEnd(17) + ': <no day row>'); continue; }
    console.log(s.padEnd(17) + ': status=' + (d.status || '?') + ' | ' + String(d.message || '').slice(0, 110));
  }
  process.exit(0);
}
main().catch(function (e) { console.log('FATAL: ' + (e && e.message || e)); process.exit(1); });
