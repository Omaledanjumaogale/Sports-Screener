import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.E2E_BASE_URL || 'http://localhost:4173';
const browser = await chromium.launch({ headless: true });
const results = [];
const errors = [];
const protectedRoutes = ['admin', 'betslip', 'football', 'basketball', 'tennis', 'rally', 'hockey', 'baseball', 'rugby', 'cricket', 'mma', 'volleyball', 'instant-football', 'instant-basketball', 'vfootball', 'predictor', 'predictor/football', 'predictor/football/audit-match', 'football?scope=ft'];
await fs.mkdir('tmp/production-audit', { recursive: true });
try {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('.hero-art img').waitFor();
    if(width===390) results.push({name:'Hero contains no interactive canvas',pass:await page.locator('canvas').count()===0});
    await page.waitForFunction(() => [...document.querySelectorAll('.hero-art img')].every((image) => image.complete && image.naturalWidth > 0));
    await page.locator('.intelligence-feature img').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('.intelligence-feature img')].every((image) => image.complete && image.naturalWidth > 0));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    results.push({ name: `Landing ${width}px: images load, no horizontal overflow`, pass: !overflow });
    const visible = await page.locator('.sport-grid').evaluateAll((grids) => grids.every((grid) => getComputedStyle(grid).opacity === '1'));
    results.push({ name: `Landing ${width}px: sport sections remain visible with reduced motion`, pass: visible });
    await page.screenshot({ path: `tmp/production-audit/landing-${width}.png`, fullPage: true });
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('.sport-section').first().scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('.sport-grid')].some((grid) => getComputedStyle(grid).opacity === '1'));
  results.push({ name: 'Tall mobile sport section reveals with normal motion', pass: true });
  for (const route of protectedRoutes) {
    await page.goto(`${base}/${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => url.pathname === '/auth', { timeout: 15000 });
    const destination = new URL(page.url()).searchParams.get('redirect');
    results.push({ name: `Anonymous /${route} returns to login with destination`, pass: destination === `/${route}` });
  }
  for (const route of ['/auth', '/auth?mode=signup', '/auth/reset', '/tester']) {
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    await page.locator('form').waitFor();
    results.push({ name: `${route} form renders`, pass: await page.locator('form').count() > 0 });
  }
  results.push({ name: 'No uncaught browser errors', pass: errors.length === 0, errors });
  await context.close();
} finally {
  await browser.close();
  await fs.writeFile('tmp/production-audit/results.json', JSON.stringify(results, null, 2));
}
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => !result.pass)) process.exitCode = 1;
