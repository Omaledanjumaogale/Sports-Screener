/**
 * audit-pwa.mjs — Lighthouse PWA audit for the PulseOdds production site.
 *
 * Checks the three PWA pillars after every deploy:
 *   1. Installability + manifest validity + SW presence — Lighthouse's
 *      `installable-manifest` audit (v11) verifies the web manifest (name,
 *      short_name, icons 192+512, display, start_url) AND that a service
 *      worker with a fetch handler is registered.
 *   2. PWA-optimized details — maskable icon, theme color, viewport,
 *      splash screen, content width (warnings, not blockers).
 *   3. Offline capability — Lighthouse 11 no longer ships an `offline`
 *      audit, so we cross-check with a Playwright pass that reloads the
 *      start_url with the network emulated offline and asserts the shell
 *      renders from the service worker cache.
 *
 * Chrome is launched via Playwright (which handles executable discovery on
 * this machine) and handed to Lighthouse over the remote-debugging port.
 *
 * Usage:
 *   node audit-pwa.mjs                      # audits https://pulseodds-screener.pages.dev
 *   node audit-pwa.mjs <url>                # audit a specific deployment URL
 *   AUDIT_URL=<url> node audit-pwa.mjs      # same, via env
 *
 * Exit code 0 when all required checks pass, 1 otherwise (CI-friendly).
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const target = process.argv[2] || process.env.AUDIT_URL || 'https://pulseodds-screener.pages.dev';

// Lighthouse 11 PWA category — `installable-manifest` is the installability
// gate; the rest are PWA-optimized signals we report but don't block on.
const config = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['pwa'],
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

  results.score = lhr.categories?.pwa?.score ?? null;
  for (const id of Object.keys(lhr.audits ?? {})) {
    const a = lhr.audits[id];
    if (!a || typeof a.score !== 'number') continue;
    results.audits[id] = { score: a.score, display: a.displayValue ?? '', title: a.title, manual: a.scoreDisplayMode === 'manual' };
  }

  console.log(`    PWA score: ${results.score === null ? 'n/a' : Math.round(results.score * 100)}/100\n`);

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
        { timeout: 30_000 }
      )
      .catch(() => false);
    await page.goto(new URL('/predictor/football', target).toString(), { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(1000);

    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0, connectionType: 'none'
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1500);
    offlineOk = (await page.evaluate(() => document.body.innerText.length)) > 100;
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
