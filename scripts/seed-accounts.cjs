// Seeds/verifies privileged accounts (super admin + tester) on the target Convex
// deployment through the real auth action.
//
// WHY CASING MATTERS: @convex-dev/auth's password provider resolves accounts by
// exact email string. An account created as "Omale@..." cannot be signed into
// with "omale@...". The UI checks identity flags case-insensitively but the
// auth action uses the typed email, so each privileged identity is ensured
// under BOTH the configured casing and its lowercase form (idempotent).
//
// Usage: node scripts/seed-accounts.cjs   (reads .env.local)
var fs = require('fs');

var envMap = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach(function (l) {
  var t = l.trim();
  if (!t || t.indexOf('=') === -1 || t.indexOf('#') === 0) return;
  var eq = t.indexOf('=');
  envMap[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
});

var accounts = [];
if (envMap.SUPER_ADMIN_EMAIL && envMap.SUPER_ADMIN_PASSWORD) {
  var ae = envMap.SUPER_ADMIN_EMAIL;
  accounts.push({ label: 'ADMIN', email: ae, password: envMap.SUPER_ADMIN_PASSWORD });
  if (ae !== ae.toLowerCase()) accounts.push({ label: 'ADMIN-lower', email: ae.toLowerCase(), password: envMap.SUPER_ADMIN_PASSWORD });
}
if (envMap.TESTER_EMAIL && envMap.TESTER_PASSWORD) {
  var te = envMap.TESTER_EMAIL;
  accounts.push({ label: 'TESTER', email: te, password: envMap.TESTER_PASSWORD });
  if (te !== te.toLowerCase()) accounts.push({ label: 'TESTER-lower', email: te.toLowerCase(), password: envMap.TESTER_PASSWORD });
}

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
        await client.action(anyApi.auth.signIn, {
          provider: 'password',
          params: { flow: 'signUp', email: a.email, password: a.password }
        });
        console.log(a.label + ': account CREATED via signUp');
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
    await client.query(anyApi.users.me, {});
    console.log('REGULAR-USER signUp+me: OK (email=' + testEmail + ')');
  } catch (e) {
    console.log('REGULAR-USER roundtrip FAILED: ' + String(e.message || e).slice(0, 120));
  }
})();
