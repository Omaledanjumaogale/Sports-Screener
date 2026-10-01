#!/usr/bin/env node
// Probes the deployed Convex backend via a real call. If the deployment is
// disabled by Convex plan limits, every function call returns a redacted
// "Server Error". The CLI surfaces the real reason ("free plan limits");
// the HTTP transport does not — so this is the only way to tell from a
// client.
//
// Usage: node scripts/check-deploy.cjs   (uses .env.local PUBLIC_CONVEX_URL)
//
// Resolution when disabled:
//   1. Upgrade the Convex project to Pro, OR
//   2. Provision a fresh deployment + replace CONVEX_DEPLOY_KEY + redeploy.

var fs = require('node:fs');

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.indexOf('#') === 0 || t.indexOf('=') === -1) continue;
  env[t.slice(0, t.indexOf('=')).trim()] = t.slice(t.indexOf('=') + 1).trim();
}
var url = env.PUBLIC_CONVEX_URL || 'https://gallant-minnow-735.eu-west-1.convex.cloud';
var client = null;
(async () => {
  // Convex client is an ESM export — load via dynamic import so this CJS file
  // works under the project's `"type": "commonjs"` default.
  const { ConvexHttpClient } = await import('convex/browser');
  client = new ConvexHttpClient(url);
  console.log('Probing ' + url + '\n');
  var httpOk = false;
  try {
    await client.query('diagPing:ping', {});
    httpOk = true;
  } catch (e) {
    var m = String(e && e.message || e);
    console.log('FAIL  query(diagPing:ping): ' + m);
    if (/free plan limits|deployments have been disabled/i.test(m)) {
      console.log('\n>>> The deployment is DISABLED by Convex plan limits.');
      console.log('>>> Login, signup, tester registration and the AI Predictor are all unreachable until this is resolved.');
      console.log('>>> Fix: upgrade to Convex Pro, OR provision a new deployment + rotate CONVEX_DEPLOY_KEY.');
      process.exit(2);
    }
  }
  if (httpOk) console.log('OK    query(diagPing:ping): deployment is responsive.');
})();