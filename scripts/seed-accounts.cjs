var fs = require('fs');

var envMap = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach(function (l) {
  var t = l.trim();
  if (!t || t.indexOf('=') === -1 || t.indexOf('#') === 0) return;
  var eq = t.indexOf('=');
  envMap[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
});

function mask(v) { return v ? String(v).slice(0, 3) + '…' : 'MISSING'; }
var accounts = [
  { label: 'ADMIN', email: envMap.SUPER_ADMIN_EMAIL, password: envMap.SUPER_ADMIN_PASSWORD },
  { label: 'TESTER', email: envMap.TESTER_EMAIL, password: envMap.TESTER_PASSWORD }
];

(async function main() {
  var { ConvexHttpClient } = await import('convex/browser');
  var { anyApi } = await import('convex/server');

  var client = new ConvexHttpClient(envMap.PUBLIC_CONVEX_URL);

  for (var a of accounts) {
    if (!a.email || !a.password) { console.log(a.label + ': missing credentials, skipped'); continue; }

    // 1. Does signIn already work?
    var signedIn = null;
    try {
      signedIn = await client.action(anyApi.auth.signIn, {
        provider: 'password',
        params: { flow: 'signIn', email: a.email, password: a.password }
      });
      console.log(a.label + ': signIn already OK');
    } catch (_) {
      // 2. Seed via signUp (creates the account with these credentials)
      try {
        var created = await client.action(anyApi.auth.signIn, {
          provider: 'password',
          params: { flow: 'signUp', email: a.email, password: a.password }
        });
        console.log(a.label + ': account CREATED via signUp (' + Object.keys(created || {}).join(',') + ')');
        try {
          signedIn = await client.action(anyApi.auth.signIn, {
            provider: 'password',
            params: { flow: 'signIn', email: a.email, password: a.password }
          });
        } catch (e2) { console.log(a.label + ': post-seed signIn FAILED: ' + String(e2.message || e2).slice(0, 80)); }
      } catch (e) {
        console.log(a.label + ': signUp seed FAILED: ' + String(e.message || e).slice(0, 120));
        continue;
      }
    }

    var tok = signedIn && signedIn.tokens && (signedIn.tokens.token || (Array.isArray(signedIn.tokens) && signedIn.tokens[0] && signedIn.tokens[0].value));
    if (!tok) { console.log(a.label + ': no token after seed, skipping access check'); continue; }

    // 3. Attach token and read authoritative access flags
    try {
      client.setAuth(tok);
      var access = await client.mutation(anyApi.users.syncAccess, {});
      console.log(a.label + ' access: isAdmin=' + !!access.isAdmin + ' isTester=' + !!access.isTester +
        ' isSubscribed=' + !!access.isSubscribed + ' tier=' + (access.subscriptionTier || '-') +
        ' hasMasterPass=' + !!access.hasMasterPass);
    } catch (e) {
      console.log(a.label + ': syncAccess FAILED: ' + String(e.message || e).slice(0, 120));
    }
  }

  // 4. Also verify a regular-user signUp + signIn roundtrip works for real customers
  try {
    var testEmail = 'auth-roundtrip-' + Date.now() + '@pulseodds-test.invalid';
    var created = await client.action(anyApi.auth.signIn, {
      provider: 'password',
      params: { flow: 'signUp', email: testEmail, password: 'TestRoundtrip!9' }
    });
    var tk = created && created.tokens && (created.tokens.token || (Array.isArray(created.tokens) && created.tokens[0] && created.tokens[0].value));
    client.setAuth(tk);
    var me = await client.query(anyApi.users.me, {});
    console.log('REGULAR-USER signUp+me: OK (email=' + me.email.slice(0, 3) + '… isSubscribed=' + me.isSubscribed + ')');
    // clean up the test profile is unnecessary (invalid domain, gated out)
  } catch (e) {
    console.log('REGULAR-USER roundtrip FAILED: ' + String(e.message || e).slice(0, 140));
  }

  process.exit(0);
})();
