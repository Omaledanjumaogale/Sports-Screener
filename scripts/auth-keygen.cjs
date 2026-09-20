var fs = require('fs');
var cp = require('child_process');
var crypto = require('crypto');

var DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY || '';
if (!DEPLOY_KEY) { console.log('ABORT: CONVEX_DEPLOY_KEY not set'); process.exit(1); }

// 1. Generate the key pair
var { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
var privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
var pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

var privFp = crypto.createHash('sha256').update(pubPem).digest('hex').slice(0, 16);
console.log('Generated RSA-2048 key pair. Public key fingerprint: sha256:' + privFp);

// 2. Persist to .env.local (gitignored) so the key survives locally too
var lines = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
function upsert(key, value) {
  var escaped = value.split('\n').join('\\n');
  var found = false;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(key + '=') === 0) { lines[i] = key + '=' + escaped; found = true; }
  }
  if (!found) lines.push(key + '=' + escaped);
}
upsert('JWT_PRIVATE_KEY', privPem);
upsert('JWT_PUBLIC_KEY', pubPem);
fs.writeFileSync('.env.local', lines.join('\n') + '\n');
console.log('.env.local: JWT_PRIVATE_KEY + JWT_PUBLIC_KEY stored (values never printed)');

// 3. Set on the deployment via the Convex CLI (spawnSync arg array - no shell quoting)
var pkgPath = require.resolve('convex/package.json');
var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
var bin = require('path').join(require('path').dirname(pkgPath), pkg.bin.convex || pkg.bin);
var env = Object.assign({}, process.env, { CONVEX_DEPLOY_KEY: DEPLOY_KEY });

var r = cp.spawnSync(process.execPath, [bin, 'env', 'set', 'JWT_PRIVATE_KEY', '--', privPem], {
  env: env, encoding: 'utf8', timeout: 120000, windowsHide: true
});
var out = ((r.stdout || '') + '\n' + (r.stderr || '')).split(privPem).join('***');
console.log('convex env set JWT_PRIVATE_KEY ->', out.trim().split(/\r?\n/).slice(-3).join(' | '));
if (r.status !== 0) { console.log('ENV SET FAILED'); process.exit(1); }
console.log('JWT_KEY_SET');
