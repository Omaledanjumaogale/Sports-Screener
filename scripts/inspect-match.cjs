// Inspect one cached fixture's markets for a sport (verifies derived ladders).
// Usage: node scripts/inspect-match.cjs tennis [n]
"use strict";
var fs = require('fs');
var path = require('path');
var { ConvexHttpClient } = require('convex/browser');
var anyApi = require('convex/server').anyApi;

var sport = process.argv[2] || 'tennis';
var n = Number(process.argv[3] || 3);

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

  var dayKey = process.argv[4] || new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
  var matches = await client.query(anyApi.predictor.listMatches, { sportId: sport, dayKey: dayKey });
  matches = matches || [];
  console.log(sport + ' ' + dayKey + ' -> ' + matches.length + ' matches (read path)');
  var shown = 0;
  for (var m of matches) {
    if (shown >= n) break;
    shown++;
    console.log('\n=== ' + m.homeTeam + ' vs ' + m.awayTeam + ' | ' + m.league);
    var markets = (m.scopes && m.scopes.markets) || {};
    var main = markets.mainTotal;
    if (main && main.pairs) {
      // The games total the bookmaker effectively implies: the line where the
      // de-vigged Over and Under cross.
      var cross = '';
      for (var i = 0; i < main.pairs.length - 1; i++) {
        var a = main.pairs[i], b = main.pairs[i + 1];
        var ao = 1 / a.over, bo = 1 / b.over;
        if (ao >= 0.5 && bo <= 0.5) {
          cross = (a.line + ((ao - 0.5) / (ao - bo || 1)) * (b.line - a.line)).toFixed(1);
          break;
        }
      }
      console.log('   MEG(Games) ~ ' + cross + '   lines=' + main.pairs.map(function (p) { return p.line; }).join(','));
    }
    Object.keys(markets).forEach(function (k) {
      var mk = markets[k];
      if (!mk) return;
      var bits = [];
      if (mk.pairs) bits.push('pairs=' + mk.pairs.length + ' [' + mk.pairs.slice(0, 4).map(function (p) { return p.line + '(' + p.over + '/' + p.under + ')'; }).join(' ') + ']');
      if (mk.handicapPairs) bits.push('hcp=' + mk.handicapPairs.length + ' [' + mk.handicapPairs.slice(0, 3).map(function (p) { return p.line + '(' + p.sideA + '/' + p.sideB + ')'; }).join(' ') + ']');
      if (mk.odds) bits.push('odds=' + JSON.stringify(mk.odds));
      console.log('   ' + k.padEnd(14) + ' ' + (mk.title || '') + ' :: ' + bits.join(' '));
    });
  }
  process.exit(0);
}
main().catch(function (e) { console.log('FATAL: ' + (e && e.message || e)); process.exit(1); });
