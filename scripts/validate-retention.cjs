var fs = require('fs');
var cp = require('child_process');
var path = require('path');

var DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY || '';
if (!DEPLOY_KEY) { console.log('ABORT: CONVEX_DEPLOY_KEY not set'); process.exit(1); }

var pkgPath = require.resolve('convex/package.json');
var pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
var bin = path.join(path.dirname(pkgPath), pkg.bin.convex || pkg.bin);
var env = Object.assign({}, process.env, { CONVEX_DEPLOY_KEY: DEPLOY_KEY });

function runConvex(args, timeout) {
  var r = cp.spawnSync(process.execPath, [bin].concat(args), { env: env, encoding: 'utf8', timeout: timeout || 180000, windowsHide: true });
  return { ok: r.status === 0, out: ((r.stdout || '') + '\n' + (r.stderr || '')).trim() };
}
function lastLine(out) { return out.split(/\r?\n/).filter(Boolean).pop(); }

console.log('1. Seeding probe rows…');
var s = runConvex(['run', 'internal/retentionProbe:insertProbe', '{}']);
console.log('   ', s.ok ? lastLine(s.out) : 'FAILED: ' + s.out.slice(-200));
if (!s.ok) process.exit(1);

console.log('2. Running the REAL retention purge (internal/retention)…');
var p = runConvex(['run', 'retention:purgeFinishedMatchesAction', '{}'], 300000);
console.log('   ', p.ok ? lastLine(p.out) : 'FAILED: ' + p.out.slice(-200));

console.log('3. Verifying purge outcomes + cleanup…');
var v = runConvex(['run', 'internal/retentionProbe:verifyPurge', '{}']);
console.log('   ', v.ok ? lastLine(v.out) : 'FAILED: ' + v.out.slice(-200));
console.log(v.ok && lastLine(v.out).indexOf('"pass":true') !== -1 ? 'RETENTION_12H_VALIDATED' : 'RETENTION_VALIDATION_FAILED');
process.exit(v.ok && lastLine(v.out).indexOf('"pass":true') !== -1 ? 0 : 1);
