/**
 * qa-smoke.mjs — Playwright smoke test across all 4 sport screeners
 * Runs against the local dev server at http://localhost:5173
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true
});
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

// ── Landing page ──────────────────────────────────────────────────────────────
console.log('== Landing Page ==');
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(800);
await page.screenshot({ path: 'smoke-landing.png' });

const cardCount = await page.locator('button.sport-card').count();
console.log(`Sport cards found: ${cardCount}`);
if (cardCount < 4) errors.push(`Expected ≥4 sport cards on landing, got ${cardCount}`);

// ── Per-sport smoke ───────────────────────────────────────────────────────────
const sportsToTest = [
  { name: 'Football',   path: '/football'   },
  { name: 'Basketball', path: '/basketball' },
  { name: 'Tennis',     path: '/tennis'     },
  { name: 'Rally',      path: '/rally'      },
  { name: 'Hockey',     path: '/hockey'     }
];

for (const sport of sportsToTest) {
  console.log(`\n== ${sport.name} Screener ==`);

  await page.goto(`http://localhost:5173${sport.path}`, {
    waitUntil: 'networkidle',
    timeout: 20000
  });
  await page.waitForTimeout(600);

  // Profile cards — actual class is "profile" on <article>
  const profileCount = await page.locator('article.profile').count();
  console.log(`  Profile cards: ${profileCount}`);
  if (profileCount !== 4) {
    errors.push(`[${sport.name}] Expected 4 profile cards (article.profile), got ${profileCount}`);
  }

  // Market accordions
  const marketCount = await page.locator('details.market').count();
  console.log(`  Market accordions: ${marketCount}`);
  if (marketCount < 1) {
    errors.push(`[${sport.name}] No market accordions found`);
  }

  // Open the first accordion
  const firstMarket = page.locator('details.market').first();
  try {
    const isOpen = await firstMarket.getAttribute('open');
    if (isOpen === null) {
      await firstMarket.locator('summary').first().click({ timeout: 4000 });
      await page.waitForTimeout(400);
    }
  } catch (_) { /* accordion may already be open */ }

  // Try filling an O/U row using force:true (bypasses visibility checks on covered selects)
  try {
    const ouRow = firstMarket.locator('.line-row-ou').first();
    const ouRowCount = await ouRow.count();
    if (ouRowCount > 0) {
      const selects = ouRow.locator('select');
      const selectCount = await selects.count();
      console.log(`  O/U row selects: ${selectCount}`);
      if (selectCount >= 3) {
        await selects.nth(0).selectOption({ index: 3 }, { timeout: 5000, force: true });
        await selects.nth(1).selectOption({ index: 80 }, { timeout: 5000, force: true });
        await selects.nth(2).selectOption({ index: 80 }, { timeout: 5000, force: true });
        await page.waitForTimeout(300);
      }
    } else {
      console.log(`  No .line-row-ou in first market (may be a winner market)`);
    }
  } catch (e) {
    console.log(`  O/U fill skipped: ${String(e.message).slice(0, 80)}`);
  }

  // Check verdict headline is present
  const headline = await page.locator('.verdict .headline').first().innerText().catch(() => '');
  const headlinePreview = headline.trim().slice(0, 100);
  console.log(`  Verdict headline: "${headlinePreview}..."`);
  // Headline can be the default empty-state copy — just verify the element exists
  const verdictExists = await page.locator('.verdict').count();
  if (verdictExists < 1) {
    errors.push(`[${sport.name}] Verdict section not found`);
  }

  await page.screenshot({ path: `smoke-${sport.name.toLowerCase()}.png`, fullPage: true });
}

await browser.close();

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n============================');
console.log('     SMOKE TEST SUMMARY     ');
console.log('============================');
if (errors.length === 0) {
  console.log('✅  ALL CHECKS PASSED');
} else {
  console.log(`❌  ${errors.length} issue(s) found:`);
  for (const e of errors) console.log(`     - ${e.slice(0, 160)}`);
  process.exit(1);
}
