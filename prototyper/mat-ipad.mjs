// mat-ipad.mjs — mäter boet-rive-pixi.html med Playwright iPad Air-emulering
// OBS: Playwright emulerar viewport + UA, inte riktig iPad-GPU.
// fps = M1 Max Chrome headless (GPU-accelererat). Laddtid och MB är realistiska.
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { statSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath  = path.join(__dirname, 'boet-rive-pixi.html');
const outPath   = path.join(__dirname, 'mat-ipad-skarmdump.png');

const filSizeKB = Math.round(statSync(htmlPath).size / 1024);

// iPad Air 5th gen viewport (820×1180 CSS-px, DPR 2)
const ipadCtx = {
  viewport: { width: 820, height: 1180 },
  deviceScaleFactor: 2,
  userAgent:
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  isMobile: true,
  hasTouch: true,
};

const browser = await chromium.launch({
  headless: true,
  args: [
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--enable-gpu-rasterization',
  ],
});
const ctx  = await browser.newContext(ipadCtx);
const page = await ctx.newPage();

// Mät total laddtid (till load-event)
const navStart = Date.now();
await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
const loadMs = Date.now() - navStart;

// Vänta 8s — PixiJS-FPS stabiliseras, CDN-resurser hinner laddas
await page.waitForTimeout(8000);

// Läs perf-panelen
const perfTxt = await page.evaluate(() => {
  const el = document.getElementById('perf');
  return el ? el.textContent.trim() : 'ej hittad';
});

// Navigation Timing
const timing = await page.evaluate(() => {
  const nt = performance.getEntriesByType('navigation')[0];
  if (!nt) return null;
  return {
    ttfb:        Math.round(nt.responseStart - nt.startTime),
    domComplete: Math.round(nt.domComplete - nt.startTime),
    loadEvent:   Math.round(nt.loadEventEnd - nt.startTime),
  };
});

// JS heap
const heap = await page.evaluate(() => {
  if (!performance.memory) return null;
  return {
    usedMB:  (performance.memory.usedJSHeapSize  / 1048576).toFixed(1),
    totalMB: (performance.memory.totalJSHeapSize / 1048576).toFixed(1),
  };
});

// Skärmdump
await page.screenshot({ path: outPath });
await ctx.close();
await browser.close();

console.log('=== PixiJS · iPad Air emulering (Playwright / M1 Max Chrome headless) ===');
console.log(`HTML-filstorlek:  ${filSizeKB} KB`);
console.log(`Laddtid (load):   ${loadMs} ms`);
if (timing) {
  console.log(`  TTFB:           ${timing.ttfb} ms`);
  console.log(`  DOM klart:      ${timing.domComplete} ms`);
  console.log(`  Load-event:     ${timing.loadEvent} ms`);
}
console.log(`Perf-panel efter 8s: ${perfTxt}`);
if (heap) {
  console.log(`JS heap:          ${heap.usedMB} MB (allokerat ${heap.totalMB} MB)`);
}
console.log(`Skärmdump:        ${outPath}`);
