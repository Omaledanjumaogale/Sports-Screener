import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  hasTouch: true
});
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(err.message));

await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'sports-screener-landing.png' });

// Landing: count sport cards
const cardCount = await page.locator('button.sport-card').count();
console.log(`Landing cards: ${cardCount}`);
if (cardCount < 4) errors.push(`Expected 4 cards on landing, got ${cardCount}`);

// Navigate to football via first card
const navPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
await page.locator('button.sport-card').first().click();
await Promise.all([navPromise, page.waitForTimeout(2500)]);

// Try to switch scope to Full Time (ignore if only 1 scope)
try {
  await page.getByRole('button', { name: /full time/i }).first().click({ timeout: 4000 });
  await page.waitForTimeout(500);
} catch {}

// Open FIRST market accordion (details > summary click)
const firstMarket = page.locator('details.market').first();
const firstMarketTitle = await firstMarket.locator('.market-title').first().innerText().catch(() => 'Market');
console.log(`First market accordion: ${firstMarketTitle}`);
try {
  const openAttr = await firstMarket.getAttribute('open');
  if (!openAttr) {
    await firstMarket.locator('summary').first().click({ timeout: 5000 });
    await page.waitForTimeout(400);
  }
} catch {}

// Fill first O/U row (3 selects = line | over | under) by indices instead of values
const firstOURow = firstMarket.locator('.line-row-ou').first();
const ouSelects = firstOURow.locator('select');
const ouCount = await ouSelects.count();
console.log(`First O/U row select count: ${ouCount}`);
if (ouCount >= 3) {
  // Line: pick index 6 (~ mid-range)
  try { await ouSelects.nth(0).selectOption({ index: 6 }, { timeout: 8000 }); console.log('  set line'); await page.waitForTimeout(80); } catch (e) { console.log('  line fail:', e.message?.slice(0,60)); }
  // Over: pick index 20 (~1.80 area)
  try { await ouSelects.nth(1).selectOption({ index: 20 }, { timeout: 8000 }); console.log('  set over odds'); await page.waitForTimeout(80); } catch (e) { console.log('  over fail:', e.message?.slice(0,60)); }
  // Under: pick index 20 (~1.80 area)
  try { await ouSelects.nth(2).selectOption({ index: 20 }, { timeout: 8000 }); console.log('  set under odds'); await page.waitForTimeout(80); } catch (e) { console.log('  under fail:', e.message?.slice(0,60)); }
}

// Fill a single-winner grid if any (1X2 / HDA etc.)
const singleWin = page.locator('details.market').filter({ hasText: /1X2|HDA|Moneyline|Match Winner/i }).first();
let singleWinCount = 0;
try { singleWinCount = await singleWin.count(); } catch {}
if (singleWinCount > 0) {
  try {
    await singleWin.locator('summary').first().click({ timeout: 5000 });
    await page.waitForTimeout(400);
    const gwSelects = singleWin.locator('.odds-grid-wrap select');
    const gwN = await gwSelects.count();
    console.log(`Match-winner grid selects: ${gwN}`);
    if (gwN >= 3) {
      for (let i = 0; i < 3; i++) {
        try { await gwSelects.nth(i).selectOption({ index: 30 + i }, { timeout: 8000 }); await page.waitForTimeout(60); }
        catch (e) { console.log(`  winner grid select ${i} fail:`, e.message?.slice(0,50)); }
      }
    }
  } catch (e) { console.log('  match winner open fail:', e.message?.slice(0,60)); }
}

await page.waitForTimeout(1500);

// Read metrics after analysis
const headline = (await page.locator('.verdict .headline').first().innerText().catch(() => '')) || '(empty)';
const profileCount = await page.locator('.profile-card').count();
const rankCount = await page.locator('.rank-row').count();
const marketCount = await page.locator('details.market').count();
console.log(`Headline: ${headline.length > 140 ? headline.slice(0,140)+'…' : headline}`);
console.log(`Markets: ${marketCount}, Profile cards: ${profileCount}, Rank rows: ${rankCount}`);

await page.screenshot({ path: 'sports-screener-mobile.png', fullPage: true });
await browser.close();

console.log('Errors:', errors.length);
for (const e of errors) console.log('  -', e.slice(0, 140));

if (errors.length) process.exit(1);
if (cardCount < 4) process.exit(1);
if (marketCount < 3) { console.error('Not enough markets rendered'); process.exit(1); }
