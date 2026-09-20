var cp = require('child_process');

var DEPLOY_KEY = process.env.CONVEX_DEPLOY_KEY || '';
if (!DEPLOY_KEY) { console.log('ABORT: no CONVEX_DEPLOY_KEY'); process.exit(1); }

var pkgPath = require.resolve('convex/package.json');
var pkg = JSON.parse(require('fs').readFileSync(pkgPath, 'utf8'));
var bin = require('path').join(require('path').dirname(pkgPath), pkg.bin.convex || pkg.bin);
var env = Object.assign({}, process.env, { CONVEX_DEPLOY_KEY: DEPLOY_KEY });

var sports = process.argv.slice(2);
if (!sports.length) { console.log('usage: node tmp-populate-sports.cjs <sport…>'); process.exit(1); }

(function next(i) {
  if (i >= sports.length) { console.log('BATCH_DONE'); process.exit(0); }
  var s = sports[i];
  var args = [bin, 'run', 'predictorOrchestrator:runRefreshInternal',
    JSON.stringify({ sportId: s, dayKey: '', floor: 52, cap: 1200 })];
  var r = cp.spawnSync(process.execPath, args, { env: env, encoding: 'utf8', timeout: 330000, windowsHide: true });
  var out = ((r.stdout || '') + '\n' + (r.stderr || '')).trim();
  var m = out.match(/\{[\s\S]*\}/);
  var parsed = null;
  try { parsed = JSON.parse(m ? m[0] : '{}'); } catch (_) {}
  if (parsed && parsed.ok) console.log(s + ': ok, kept=' + parsed.kept + ' runId=' + (parsed.runId || '').slice(0, 30));
  else console.log(s + ': ' + (parsed ? 'ok=' + parsed.ok + ' msg=' + (parsed.message || '').slice(0, 60) : 'FAILED: ' + out.split(/\r?\n/).slice(-2).join(' ').slice(0, 150)));
  next(i + 1);
})(0);
