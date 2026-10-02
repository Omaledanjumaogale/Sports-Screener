/**
 * audit-pwa.mjs — Lighthouse PWA audit for the PulseOdds production site.
 *
 * Measures mobile performance, accessibility and best practices with
 * Lighthouse 13. Playwright separately checks manifest fields, loadable
 * 192/512 icons, a controlling service worker and offline shell reload.
 * These prerequisites do not guarantee install prompts on every platform.
 *
 * Chrome is launched via Playwright (which handles executable discovery on
 * this machine) and handed to Lighthouse over the remote-debugging port.
 *
 * Usage:
 *   node audit-pwa.mjs                      # audits https://pulseodds.ewinproject.org
 *   node audit-pwa.mjs <url>                # audit a specific deployment URL
 *   AUDIT_URL=<url> node audit-pwa.mjs      # same, via env
 *
 * Exit code 0 when all required checks pass, 1 otherwise (CI-friendly).
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const target = process.argv[2] || process.env.AUDIT_URL || 'https://pulseodds.ewinproject.org';

// Lighthouse 13 has no PWA category; browser checks below cover prerequisites.
const config = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance', 'accessibility', 'best-practices'],
    formFactor: 'mobile',
    screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2 },
    throttlingMethod: 'simulate',
    maxWaitForFcp: 45_000,
    maxWaitForLoad: 45_000,
  },
};

const results = { url: target, audits: {}, score: null };
let failed = false;
let chrome = null;
let chromePort = 0;

try {
  // ── Launch Chrome via chrome-launcher (picks a free debugging port). The
  //    executable comes from Playwright so the same code path works locally
  //    and in CI (where chrome-launcher's own discovery would find nothing). ─
  chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    logLevel: 'silent',
  });
  chromePort = chrome.port;
  console.log(`\n── Lighthouse PWA audit: ${target} (Chrome on port ${chromePort})`);

  const { lhr } = await lighthouse(
    target,
    { port: chromePort, output: 'json', logLevel: 'error' },
    config
  );
  if (!lhr) throw new Error('Lighthouse returned no result');

  // Save the raw report for CI artifact upload.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportFile = `lighthouse-pwa-${stamp}.json`;
  writeFileSync(reportFile, JSON.stringify(lhr, null, 2));
  console.log(`    Report saved to ${reportFile}`);

  results.score = lhr.categories?.performance?.score ?? null;
  for (const id of Object.keys(lhr.audits ?? {})) {
    const a = lhr.audits[id];
    if (!a || typeof a.score !== 'number') continue;
    results.audits[id] = { score: a.score, display: a.displayValue ?? '', title: a.title, manual: a.scoreDisplayMode === 'manual' };
  }

  console.log(`    Performance score: ${results.score === null ? 'n/a' : Math.round(results.score * 100)}/100\n`);

  // A failed bootstrap can produce an artificially high performance score.
  // Do not accept a run with console errors as a release-quality measurement.
  if (lhr.audits?.['errors-in-console']?.score === 0) {
    failed = true;
    console.log('  [FAIL] Browser console errors observed; investigate the raw report before accepting performance results.');
  }

  // Lighthouse 13 removed its PWA category. Check the manifest and controlling
  // service worker explicitly rather than treating a missing audit as a failure.
  const manifestBrowser = await chromium.launch({ headless: true });
  try {
    const manifestPage = await manifestBrowser.newPage();
    await manifestPage.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const manifestHref = await manifestPage.locator('link[rel="manifest"]').getAttribute('href');
    if (!manifestHref) throw new Error('Manifest link is missing');
    const manifestUrl = new URL(manifestHref, target);
    const manifestResponse = await manifestPage.request.get(manifestUrl.href);
    if (!manifestResponse.ok()) throw new Error('Manifest could not be loaded');
    const manifest = await manifestResponse.json();
    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    const iconsValid = ['192x192', '512x512'].every((size) => icons.some((icon) => String(icon.sizes || '').split(/\s+/).includes(size)));
    let iconsLoad = true;
    for (const icon of icons) {
      const response = await manifestPage.request.get(new URL(icon.src, manifestUrl).href);
      iconsLoad = iconsLoad && response.ok() && (response.headers()['content-type'] || '').startsWith('image/');
    }
    await manifestPage.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 30000 });
    const valid = !!(manifest.name || manifest.short_name) && !!manifest.start_url && ['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display) && iconsValid && iconsLoad;
    results.audits['installable-manifest'] = { score: valid ? 1 : 0, title: 'Manifest and service-worker prerequisites (Playwright)', display: '', manual: false };
  } finally { await manifestBrowser.close(); }

  // Pillar 1 — installability + manifest + SW (the hard gate).
  const inst = results.audits['installable-manifest'];
  if (inst) {
    const pass = inst.score === 1;
    if (!pass) failed = true;
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${inst.title}${inst.display ? ` — ${inst.display}` : ''}`);
  } else {
    failed = true;
    console.log('  [FAIL] installable-manifest audit did not run');
  }

  // Pillar 2 — PWA-optimized (informational).
  for (const id of ['maskable-icon', 'themed-omnibox', 'splash-screen', 'content-width', 'viewport']) {
    const a = results.audits[id];
    if (!a || a.manual) continue;
    const status = a.score === 1 ? 'PASS' : 'WARN';
    console.log(`  [${status}] ${a.title}${a.display ? ` — ${a.display}` : ''}`);
  }

  console.log('\n── Summary ────────────────────────────────────────────────');
  console.log(`  Installable (manifest + SW fetch handler): ${inst?.score === 1 ? 'PASS' : 'FAIL'}`);
  console.log(`  Manifest validity (name/icons/display/start_url): ${inst?.score === 1 ? 'PASS' : 'FAIL'}`);
  console.log(`  Service worker registered & controlling:   ${inst?.score === 1 ? 'PASS (via installable-manifest)' : 'FAIL'}`);
} catch (err) {
  failed = true;
  console.log(`\nERROR running Lighthouse: ${String(err?.message ?? err).slice(0, 300)}`);
} finally {
  if (chrome) {
    try {
      await chrome.kill();
    } catch (_) {}
  }
}

// Pillar 3 — offline capability (Playwright cross-check with network disabled).
if (!failed) {
  console.log('\n── Offline capability (Playwright, network emulated offline) ──');
  let offlineOk = false;
  try {
    const b2 = await chromium.launch({ headless: true });
    const context = await b2.newContext();
    const page = await context.newPage();
    // Warm pass: first load registers the SW; second controlled load fills the
    // runtime cache (matches how Lighthouse runs the classic offline audit).
    await page.goto(target, { waitUntil: 'networkidle', timeout: 60_000 });
    await page
      .waitForFunction(
        async () => {
          const regs = await navigator.serviceWorker.getRegistrations();
          return regs.length > 0 && navigator.serviceWorker.controller !== null;
        },
        undefined, { timeout: 30_000 }
      )
      .catch(() => false);
    await page.goto(new URL('/predictor/football', target).toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    // Deterministic wait: the SW caches navigation responses, so poll Cache
    // Storage until this path (or the shell) is actually cached instead of
    // sleeping a fixed time — cold CI runners can be slow to settle.
    await page
      .waitForFunction(
        async () => {
          try {
            const names = await caches.keys();
            for (const n of names) {
              const c = await caches.open(n);
              if ((await c.match(location.pathname)) != null || (await c.match('/')) != null) return true;
            }
            return false;
          } catch (_) {
            return false;
          }
        },
        undefined, { timeout: 15_000 }
      )
      .catch(() => {});

    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0, connectionType: 'none'
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1500);
    offlineOk = (await page.evaluate(() => document.body.innerText.length)) > 100;
    if (!offlineOk) {
      // One retry — absorbs a rare SW/cache race on cold runners.
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(1500);
      offlineOk = (await page.evaluate(() => document.body.innerText.length)) > 100;
    }
    console.log(`  Offline reload renders the app shell: ${offlineOk ? 'PASS' : 'FAIL'}`);
    if (!offlineOk) failed = true;
    await b2.close().catch(() => {});
  } catch (err) {
    failed = true;
    console.log(`  Offline check ERROR: ${String(err?.message ?? err).slice(0, 200)}`);
  }
}

console.log(`\nRESULT: ${failed ? 'PWA AUDIT FAILED' : 'PWA AUDIT PASSED'}`);
process.exit(failed ? 1 : 0);
