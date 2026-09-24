// Brand asset builder — renders the PulseOdds mark (static/favicon.svg style)
// into PWA icons + OG image using sharp. Run: node scripts/build-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = path.join(root, 'static');

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0f1a"/>
      <stop offset="100%" stop-color="#101a30"/>
    </linearGradient>
    <linearGradient id="bolt" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#bef264"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="18" fill="url(#bg)"/>
  <circle cx="50" cy="50" r="41" fill="none" stroke="rgba(34,211,238,0.28)" stroke-width="1.5" stroke-dasharray="4 7"/>
  <polygon points="62,20 48,50 58,50 44,82 72,44 60,44 72,20" fill="url(#bolt)"/>
</svg>`;

// Maskable icon: bolt sits inside the 80% safe zone (extra padding).
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0f1a"/>
      <stop offset="100%" stop-color="#101a30"/>
    </linearGradient>
    <linearGradient id="bolt2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#bef264"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#bg2)"/>
  <g transform="translate(50 50) scale(0.62) translate(-50 -50)">
    <polygon points="62,20 48,50 58,50 44,82 72,44 60,44 72,20" fill="url(#bolt2)"/>
  </g>
</svg>`;

const OG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="ogbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#05070d"/>
      <stop offset="55%" stop-color="#0a0f1a"/>
      <stop offset="100%" stop-color="#0c1526"/>
    </linearGradient>
    <linearGradient id="ogword" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f2f6ff"/>
      <stop offset="100%" stop-color="#bef264"/>
    </linearGradient>
    <linearGradient id="ogbolt" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#bef264"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
    <radialGradient id="ogglow1" cx="85%" cy="0%" r="60%">
      <stop offset="0%" stop-color="rgba(163,230,53,0.16)"/>
      <stop offset="100%" stop-color="rgba(163,230,53,0)"/>
    </radialGradient>
    <radialGradient id="ogglow2" cx="0%" cy="100%" r="55%">
      <stop offset="0%" stop-color="rgba(34,211,238,0.13)"/>
      <stop offset="100%" stop-color="rgba(34,211,238,0)"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#ogbg)"/>
  <rect width="1200" height="630" fill="url(#ogglow1)"/>
  <rect width="1200" height="630" fill="url(#ogglow2)"/>
  <circle cx="600" cy="330" r="240" fill="none" stroke="rgba(34,211,238,0.10)" stroke-width="2" stroke-dasharray="6 12"/>
  <g transform="translate(548 210) scale(1.05)">
    <polygon points="62,20 48,50 58,50 44,82 72,44 60,44 72,20" fill="url(#ogbolt)"/>
  </g>
  <text x="600" y="430" text-anchor="middle" font-family="Outfit, 'Segoe UI', sans-serif" font-weight="800" font-size="88" fill="url(#ogword)" letter-spacing="-2">PulseOdds</text>
  <text x="600" y="492" text-anchor="middle" font-family="Outfit, 'Segoe UI', sans-serif" font-weight="600" font-size="30" fill="rgba(198,209,232,0.85)" letter-spacing="6">READ THE ODDS · OWN THE EDGE</text>
  <text x="600" y="556" text-anchor="middle" font-family="Outfit, 'Segoe UI', sans-serif" font-weight="500" font-size="22" fill="rgba(133,148,180,0.8)" letter-spacing="2">Sports Odds Intelligence · 9 Agents · 11 Sports · E-WIN Project</text>
</svg>`;

async function render(svg, size, out, square = true) {
  const img = sharp(Buffer.from(svg), { density: 300 });
  if (square) img.resize(size, size);
  await img.png().toFile(out);
  console.log(`✓ ${path.relative(root, out)}`);
}

await mkdir(path.join(staticDir, 'icons'), { recursive: true });

await render(ICON_SVG, 192, path.join(staticDir, 'icons', 'icon-192.png'));
await render(ICON_SVG, 512, path.join(staticDir, 'icons', 'icon-512.png'));
await render(MASKABLE_SVG, 512, path.join(staticDir, 'icons', 'icon-maskable-512.png'));
await render(OG_SVG, 0, path.join(staticDir, 'og-image.png'), false);

console.log('Brand assets rebuilt in the Court & Volt palette.');
