// Repairs the tester account when its stored password hash no longer matches
// .env.local (e.g. seeded while the file carried the `Share&getbloacked#`
// typo). Signs in as super admin, resets the password server-side via the
// admin action, then verifies the roundtrip.
//
// Usage: node scripts/reset-tester.cjs [email]   (defaults to TESTER_EMAIL)
var fs = require('fs');

var envMap = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach(function (l) {
  var t = l.trim();
  if (!t || t.indexOf('=') === -1 || t.indexOf('#') === 0) return;
  var eq = t.indexOf('=');
  envMap[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
});

var targetEmail = (process.argv[2] || envMap.TESTER_EMAIL || '').trim();
if (!targetEmail) { console.error('No target email (pass one or set TESTER_EMAIL)'); process.exit(1); }

(async function main() {
  var { ConvexHttpClient } = await import('convex/browser');
  var { anyApi } = await import('convex/server');

  var client = new ConvexHttpClient(envMap.PUBLIC_CONVEX_URL);

  // 1. Super-admin token
  var adminTok = null;
  try {
    var res = await client.action(anyApi.auth.signIn, {
      provider: 'password',
      params: { flow: 'signIn', email: envMap.SUPER_ADMIN_EMAIL, password: envMap.SUPER_ADMIN_PASSWORD }
    });
    adminTok = res && res.tokens && (res.tokens.token || (Array.isArray(res.tokens) && res.tokens[0] && res.tokens[0].value));
  } catch (e) {
    console.log('ADMIN signIn FAILED: ' + String(e.message || e).slice(0, 160));
    process.exit(1);
  }
  if (!adminTok) { console.log('ADMIN: no token'); process.exit(1); }
  console.log('ADMIN signIn: OK');
  client.setAuth(adminTok);

  // 2. Reset the target's password server-side
  try {
    var out = await client.action(anyApi.accountAdmin.resetAccountPassword, {
      email: targetEmail,
      newPassword: envMap.TESTER_PASSWORD
    });
    console.log('RESET: ok for ' + (out && out.email));
  } catch (e) {
    console.log('RESET FAILED: ' + String(e.message || e).slice(0, 200));
    process.exit(1);
  }

  // 3. Verify signIn with the corrected password
  try {
    await client.action(anyApi.auth.signIn, {
      provider: 'password',
      params: { flow: 'signIn', email: targetEmail, password: envMap.TESTER_PASSWORD }
    });
    console.log('TESTER signIn after reset: OK');
  } catch (e) {
    console.log('TESTER signIn after reset FAILED: ' + String(e.message || e).slice(0, 200));
    process.exit(1);
  }

  // 4. Repeat for the lowercase twin if different (casing-sensitive provider)
  var lower = targetEmail.toLowerCase();
  if (lower !== targetEmail) {
    try {
      await client.action(anyApi.accountAdmin.resetAccountPassword, {
        email: lower, newPassword: envMap.TESTER_PASSWORD
      });
      console.log('RESET(lower): ok for ' + lower);
    } catch (e) {
      console.log('RESET(lower) skipped: ' + String(e.message || e).slice(0, 120));
    }
  }
})();
