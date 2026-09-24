// Fetch a sports source through the reader chain (as the Convex action sees it)
// and print a markup sample + parsed fixtures. Admin-gated server-side.
"use strict";
var fs = require('fs');
var path = require('path');
var { ConvexHttpClient } = require('convex/browser');
var anyApi = require('convex/server').anyApi;

var args = process.argv.slice(2);
var url = args[0];
var sportId = args[1] || 'football';
var maxChars = Number(args[2] || 3000);
if (!url) { console.log('usage: node scripts/sample-source.cjs <url> [sportId] [maxChars]'); process.exit(1); }

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
  var r = await client.action(anyApi.diagnostics.fetchSourceSample, { url: url, sportId: sportId, maxChars: maxChars });
  console.log('engine=' + r.engine + ' status=' + r.status + ' chars=' + r.chars + ' parsed=' + r.parsed);
  if (r.parsedSample && r.parsedSample.length) {
    console.log('PARSED SAMPLE:');
    r.parsedSample.forEach(function (m) { console.log('  ' + m.homeTeam + ' vs ' + m.awayTeam + ' | ' + m.league); });
  }
  console.log('--- MARKUP SAMPLE ---');
  console.log(r.sample);
  process.exit(0);
}
main().catch(function (e) { console.log('FATAL: ' + (e && e.message || e)); process.exit(1); });
