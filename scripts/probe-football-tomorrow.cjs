// Probe tomorrow's football cache rows: sourceUrl + league + names.
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
  var tok = si && si.tokens && (si.tokens.token || (Array.isArray(si.tokens) && si.tokens[0] && si.tokens[0].value));
  client.setAuth(tok);
  var tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // Run the malformed sweep first (provenance purge + WNBA relabel), then list.
  var swept = await client.mutation(anyApi.predictor.purgeMalformedMatches, {});
  console.log('SWEEP examined=' + swept.examined + ' deleted=' + swept.deleted + ' repaired=' + (swept.repaired || 0));
  if (swept.samples && swept.samples.length) console.log('swept samples: ' + JSON.stringify(swept.samples));
  var rows = await client.query(anyApi.predictor.listMatches, { sportId: 'football', dayKey: tomorrow });
  rows = rows || [];
  console.log('ROWS ' + rows.length);
  var byUrl = {};
  for (var r of rows) {
    var u = String(r.sourceUrl || 'none');
    byUrl[u] = byUrl[u] || [];
    byUrl[u].push(r);
  }
  for (var url of Object.keys(byUrl)) {
    console.log('\nURL: ' + url + '  ->  ' + byUrl[url].length + ' rows');
    for (var m of byUrl[url].slice(0, 4)) {
      console.log('   ' + m.homeTeam + '  vs  ' + m.awayTeam + '  | ' + m.league + ' | src=' + (m.source || '?') + ' | pinned=' + !!m.sportPinned + ' | odds=' + (m.oddsSnapshot && m.oddsSnapshot.oddsText || 'none'));
    }
  }
  process.exit(0);
}
main().catch(function (e) { console.log('FATAL ' + (e && e.message || e)); process.exit(1); });
