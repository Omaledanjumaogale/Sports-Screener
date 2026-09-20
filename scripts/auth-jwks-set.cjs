var fs = require('fs');
var cp = require('child_process');
var crypto = require('crypto');

var DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY || '';
if (!DEPLOY_KEY) { console.log('ABORT: CONVEX_DEPLOY_KEY not set'); process.exit(1); }

// 1. Read the public key from .env.local
var pubPem = '';
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach(function (l) {
  if (l.indexOf('JWT_PUBLIC_KEY=') === 0) pubPem = l.split('=').slice(1).join('=').replace(/\\n/g, '\n').trim();
});
if (!pubPem || pubPem.indexOf('BEGIN PUBLIC KEY') === -1) { console.log('ABORT: no JWT_PUBLIC_KEY in .env.local'); process.exit(1); }

// 2. Convert to JWK and build the JWKS (single key; token header carries no kid,
//    so the key must be matchable without one — alg/use hints only)
var jwk = crypto.createPublicKey(pubPem).export({ format: 'jwk' });
var jwks = JSON.stringify({ keys: [{ kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' }] });
console.log('JWKS built (kty=' + jwk.kty + ', modulus ' + jwk.n.length + ' chars)');

// 3. Set on the deployment
var pkgPath = require.resolve('convex/package.json');
var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
var bin = require('path').join(require('path').dirname(pkgPath), pkg.bin.convex || pkg.bin);
var env = Object.assign({}, process.env, { CONVEX_DEPLOY_KEY: DEPLOY_KEY });

var r = cp.spawnSync(process.execPath, [bin, 'env', 'set', 'JWKS', '--', jwks], {
  env: env, encoding: 'utf8', timeout: 120000, windowsHide: true
});
var out = ((r.stdout || '') + '\n' + (r.stderr || '')).split(jwks).join('***');
console.log('convex env set JWKS ->', out.trim().split(/\r?\n/).slice(-2).join(' | '));
process.exit(r.status === 0 ? 0 : 1);
