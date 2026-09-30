// Dump predictor cache rows grouped by sport + dayKey with counts.
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

async function main() {
  var client = new ConvexHttpClient(envMap.PUBLIC_CONVEX_URL);
  var si = await client.action(anyApi.auth.signIn, {
    provider: 'password',
    params: { flow: 'signIn', email: envMap.SUPER_ADMIN_EMAIL, password: envMap.SUPER_ADMIN_PASSWORD }
  });
  var tok = si && si.tokens && (si.tokens.token || (Array.isArray(si.tokens) && si.tokens[0] && (si.tokens[0].token || si.tokens[0])));
  client.setAuth(tok);
  var rows = await client.query(anyApi.predictor.dumpCacheSummary, {});
  for (var r of rows) {
    console.log(
      (r.sport + '                 ').slice(0, 17) + r.dayKey +
      '  matches=' + String(r.matches).padStart(3) +
      '  verdicts=' + String(r.verdicts).padStart(3) +
      '  status=' + String(r.status).padEnd(8) +
      '  ' + String(r.message || '').slice(0, 90)
    );
  }
  if (!rows.length) console.log('(no rows)');
  process.exit(0);
}
main().catch(function (e) { console.error('FATAL: ' + (e && e.message || e)); process.exit(1); });
