// e2e/smoke.spec.mjs — Playwright E2E smoke: the critical enterprise flows.
// Run: npx playwright test e2e/smoke.spec.mjs  (see e2e/README note in qa-smoke.mjs header)
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:4173';
const results = [];
const check = (name, pass, note = '') => {
  results.push({ name, pass, note });
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name}${note ? ` — ${note}` : ''}`);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e)));

try {
  // 1. Public shell renders.
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 });
  check('home renders', (await page.title()).length > 0, await page.title());

  // 2. Auth route renders and sign-in form exists.
  await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
  const hasEmail = await page.locator('input[type="email"]').count();
  const hasPassword = await page.locator('input[type="password"]').count();
  check('auth form present', hasEmail > 0 && hasPassword > 0);

  // 3. Predictor route is server-gated: anonymous visitor must see the paywall,
  //    NOT premium data. This is the P0 acceptance test.
  await page.goto(`${BASE}/predictor/football`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2500);
  const body = (await page.textContent('body')) || '';
  const locked =
    body.toLowerCase().includes('master pass') ||
    body.toLowerCase().includes('sign in');
  const leaked = body.toLowerCase().includes('kickoff') && body.match(/\d{2}:\d{2}/) && body.toLowerCase().includes('vs') && locked === false;
  check('predictor gated for anonymous users', locked && !leaked);

  // 4. Health endpoint (Convex) responds.
  const convexSite = process.env.E2E_CONVEX_SITE_URL || 'https://modest-lark-218.eu-west-1.convex.site';
  let healthOk = false;
  try {
    const res = await page.request.get(`${convexSite}/api/health`, { timeout: 15000 });
    const json = await res.json().catch(() => ({}));
    healthOk = res.status() === 200 && !!json.status;
    check('health endpoint', healthOk, `status=${json.status}`);
  } catch (e) {
    check('health endpoint', false, String(e).slice(0, 80));
  }

  // 5. PWA assets still live (deploy gate sanity inside E2E).
  for (const p of ['/manifest.webmanifest', '/sw.js', '/icons/icon-192.png']) {
    const res = await page.request.get(`${BASE}${p}`);
    check(`asset ${p}`, res.status() === 200);
  }

  check('no page JS errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('smoke run completed', false, String(err).slice(0, 200));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\nRESULT: ${failed.length === 0 ? 'E2E SMOKE PASSED' : `E2E SMOKE FAILED (${failed.length})`}`);
process.exit(failed.length === 0 ? 0 : 1);
