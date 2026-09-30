// Purge every cached row for one sport across the predictor tables.
// Usage: node scripts/purge-sport.cjs <sportId>   (e.g. basketball)
"use strict";
var fs = require('fs');
var path = require('path');
var { ConvexHttpClient } = require('convex/browser');
var anyApi = require('convex/server').anyApi;

var sport = process.argv[2];
if (!sport) { console.log('usage: node scripts/purge-sport.cjs <sportId>'); process.exit(1); }

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
  var res = await client.mutation(anyApi.predictor.adminPurgeSport, { sportId: sport });
  console.log('purged ' + res.sportId + ': ' + res.deleted + ' rows');
  process.exit(0);
}
main().catch(function (e) { console.error('FATAL: ' + (e && e.message || e)); process.exit(1); });
