// Show which parsed fixtures the quality gate blocks, and why.
// Usage: node scripts/gate-audit.cjs <sportId> [url]
"use strict";
var fs = require('fs');
var path = require('path');
var { ConvexHttpClient } = require('convex/browser');
var anyApi = require('convex/server').anyApi;

var sport = process.argv[2] || 'football';
var urlArg = process.argv[3] || '';

var PAGES = {
  football: 'https://www.betexplorer.com/next/soccer/',
  basketball: 'https://www.betexplorer.com/next/basketball/',
  tennis: 'https://www.betexplorer.com/next/tennis/',
  hockey: 'https://www.betexplorer.com/next/hockey/',
  baseball: 'https://www.betexplorer.com/next/baseball/'
};

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
  var url = urlArg || PAGES[sport];
  if (!url) { console.log('no page for ' + sport); process.exit(1); }
  var r = await client.action(anyApi.diagnostics.fetchSourceSample, { url: url, sportId: sport, maxChars: 200 });
  console.log(sport + '  ' + url);
  console.log('engine=' + r.engine + ' kind=' + r.kind + ' chars=' + r.chars);
  console.log('markers=' + JSON.stringify(r.markers));
  console.log('parsed=' + r.parsed + ' passed=' + r.passed);
  (r.gateSample || []).forEach(function (m) {
    if (m.verdict !== 'passed') {
      console.log('  BLOCKED  ' + m.homeTeam + ' vs ' + m.awayTeam + ' | ' + m.league + '  <- ' + (m.issues || []).join(' | '));
    }
  });
  process.exit(0);
}
main().catch(function (e) { console.log('FATAL: ' + (e && e.message || e)); process.exit(1); });
