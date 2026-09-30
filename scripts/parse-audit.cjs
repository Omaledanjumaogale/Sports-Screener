// Call fetchSourceSample repeatedly until the reader returns raw HTML, then
// report how many rows parse + pass the gate, with blocked reasons.
"use strict";
var fs = require('fs');
var path = require('path');
var { ConvexHttpClient } = require('convex/browser');
var anyApi = require('convex/server').anyApi;

var sport = process.argv[2] || 'football';
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

  var url = PAGES[sport];
  for (var i = 1; i <= 8; i++) {
    var r = await client.action(anyApi.diagnostics.fetchSourceSample, { url: url, sportId: sport, maxChars: 200 });
    var mark = r.markers || {};
    console.log('try ' + i + ': engine=' + r.engine + ' kind=' + r.kind + ' chars=' + r.chars +
      ' matchInfo=' + (mark['table-main__matchInfo'] || 0) + ' parsed=' + r.parsed + ' passed=' + r.passed);
    if (r.kind === 'html' && (mark['table-main__matchInfo'] || 0) > 0) {
      var reasons = {};
      (r.gateSample || []).forEach(function (m) {
        if (m.verdict !== 'passed') {
          var k = (m.issues || []).join(' | ') || 'unknown';
          reasons[k] = (reasons[k] || 0) + 1;
        }
      });
      console.log('  BLOCKED REASONS:');
      Object.entries(reasons).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8).forEach(function (e) {
        console.log('    ' + e[1] + ' x ' + e[0]);
      });
      break;
    }
  }
  process.exit(0);
}
main().catch(function (e) { console.log('FATAL: ' + (e && e.message || e)); process.exit(1); });
