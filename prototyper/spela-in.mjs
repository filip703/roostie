// spela-in.mjs — spelar in boet-scen.html som webm-video via Playwright
// Kör: node spela-in.mjs
// Kräver: npm install (playwright), npx playwright install chromium

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath  = path.join(__dirname, 'boet-scen.html');
const outPath   = path.join(__dirname, 'boet-konceptfilm.webm');

if (!fs.existsSync(htmlPath)) {
  console.error('Hittar inte boet-scen.html — kör från rätt katalog.');
  process.exit(1);
}

console.log('Startar headless Chromium...');
const browser = await chromium.launch({ headless: true });

const ctx = await browser.newContext({
  viewport: { width: 1024, height: 768 },
  recordVideo: {
    dir: __dirname,
    size: { width: 1024, height: 768 },
  },
});

const page = await ctx.newPage();
await page.goto(`file://${htmlPath}`);

console.log('Spelar in animation (11,5 s)...');
await page.waitForTimeout(11_500);

const videoPath = await page.video()?.path();
await ctx.close();
await browser.close();

if (videoPath && fs.existsSync(videoPath)) {
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  fs.renameSync(videoPath, outPath);
  const size = fs.statSync(outPath).size;
  console.log(`OK: ${outPath} (${Math.round(size / 1024)} KB)`);
} else {
  // Fallback: leta efter nyaste .webm i katalogen
  const files = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.webm') && f !== 'boet-konceptfilm.webm')
    .map(f => ({ f, mt: fs.statSync(path.join(__dirname, f)).mtimeMs }))
    .sort((a, b) => b.mt - a.mt);
  if (files.length > 0) {
    fs.renameSync(path.join(__dirname, files[0].f), outPath);
    console.log(`OK (fallback): ${outPath}`);
  } else {
    console.error('Ingen videofil hittades.');
    process.exit(1);
  }
}
