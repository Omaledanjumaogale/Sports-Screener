// verify-offline.mjs — prove the PWA service worker serves the shell + predictor
// page from cache when the network is disabled.
// Usage: node verify-offline.mjs
import { chromium } from 'playwright';

const BASE = 'https://pulseodds-screener.pages.dev';
const report = { ok: true, steps: [] };
const consoleErrors = [];

function step(name, pass, detail) {
  report.steps.push({ name, pass: !!pass, detail: detail ?? '' });
  if (!pass) report.ok = false;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

try {
  // ── 1. First load — fully online ──────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
  const title1 = await page.title();
  step('Initial online load renders', title1.length > 0, `title="${title1}"`);

  // ── 2. Service worker registers and claims the page ──────────────────────
  const swReady = await page
    .waitForFunction(
      async () => {
        const regs = await navigator.serviceWorker.getRegistrations();
        return regs.length > 0 && navigator.serviceWorker.controller !== null;
      },
      { timeout: 30_000 }
    )
    .then(() => true)
    .catch(() => false);

  if (!swReady) {
    // skipWaiting/clients.claim may need a second pass — reload once online.
    await page.reload({ waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const swState = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    return {
      count: regs.length,
      controlling: navigator.serviceWorker.controller !== null,
      scope: regs[0]?.scope ?? null,
      state: regs[0]?.active?.state ?? null
    };
  });
  step(
    'Service worker installed & controlling',
    swState.count > 0 && swState.controlling,
    JSON.stringify(swState)
  );

  // Warm-up pass: the first load ran before the SW claimed the page, so its
  // /_app/ fetches bypassed the SW. One controlled online load routes those
  // through the SW's stale-while-revalidate handler and fills the runtime
  // cache. This mirrors how Lighthouse runs the offline audit.
  await page.goto(`${BASE}/predictor/football`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(1500);

  // ── 3. Inspect what the SW cached during the online pass ─────────────────
  const cacheInfo = await page.evaluate(async () => {
    const names = await caches.keys();
    const out = {};
    for (const n of names) {
      const c = await caches.open(n);
      const keys = await c.keys();
      out[n] = keys.map((r) => new URL(r.url).pathname);
    }
    return out;
  });
  const shellCache = cacheInfo['pulseodds-v1'] ?? [];
  const hasRoot = shellCache.includes('/');
  const appAssets = shellCache.filter((p) => p.startsWith('/_app/'));
  const hasManifest = shellCache.includes('/manifest.webmanifest');
  const hasIcons = shellCache.some((p) => p.startsWith('/icons/'));
  step('Shell cached (/, manifest, icons)', hasRoot && hasManifest && hasIcons,
    `${shellCache.length} urls in pulseodds-v1: ${shellCache.join(', ')}`);
  step('App JS/CSS assets cached', appAssets.length > 0, `${appAssets.length} _app assets`);

  // ── 4. Kill the network via CDP ───────────────────────────────────────────
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
    connectionType: 'none'
  });

  // ── 5. Offline reload of the homepage ─────────────────────────────────────
  let offlineHome = { loaded: false, title: '', textLen: 0 };
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    offlineHome.loaded = true;
    offlineHome.title = await page.title();
    offlineHome.textLen = await page.evaluate(() => document.body.innerText.length);
  } catch (e) {
    offlineHome.loaded = false;
    offlineHome.title = String(e?.message ?? '');
  }
  step(
    'Offline: homepage shell renders from cache',
    offlineHome.loaded && offlineHome.textLen > 100,
    `title="${offlineHome.title}" bodyChars=${offlineHome.textLen}`
  );

  // ── 6. Offline navigation to the AI Predictor route ──────────────────────
  let offlinePred = { loaded: false, textLen: 0, hasHeader: false };
  try {
    await page.goto(`${BASE}/predictor/football`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(2500); // allow the SPA router + gated shell to mount
    offlinePred.loaded = true;
    offlinePred.textLen = await page.evaluate(() => document.body.innerText.length);
    offlinePred.hasHeader = await page.evaluate(
      () => !!document.querySelector('header, nav, [class*="header"], [class*="Header"], h1, h2')
    );
  } catch (e) {
    offlinePred.loaded = false;
    offlinePred.textLen = 0;
    offlinePred.error = String(e?.message ?? '');
  }
  step(
    'Offline: predictor route renders SPA shell (auth-gated)',
    offlinePred.loaded && offlinePred.textLen > 50 && offlinePred.hasHeader,
    `bodyChars=${offlinePred.textLen} headerFound=${offlinePred.hasHeader}`
  );

  // ── 7. Restore network, confirm recovery ──────────────────────────────────
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: 'wifi'
  });
  let recovered = false;
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    recovered = true;
  } catch (_) {}
  step('Network recovery works', recovered, '');

  console.log('── console errors (first 8) ──');
  for (const e of consoleErrors.slice(0, 8)) console.log('  •', e.slice(0, 200));
} catch (err) {
  report.ok = false;
  console.log('FAIL  script error —', String(err?.message ?? err).slice(0, 300));
} finally {
  await browser.close();
}

console.log('\nRESULT: ' + (report.ok ? 'ALL CHECKS PASSED' : 'CHECKS FAILED'));
process.exit(report.ok ? 0 : 1);
