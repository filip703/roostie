// skarmklipp-rive.mjs — skärmdump av boet-rive-pixi.html
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath  = path.join(__dirname, 'boet-rive-pixi.html');
const outPath   = path.join(__dirname, 'boet-rive-skarmdump.png');

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl', '--use-gl=swiftshader'],
});
const ctx = await browser.newContext({
  viewport: { width: 1024, height: 768 },
});
const page = await ctx.newPage();
page.on('console', m => { if (m.type() !== 'debug') console.log('[page]', m.text()); });
page.on('pageerror', e => console.error('[ERR]', e.message));
await page.goto(`file://${htmlPath}`);
await page.waitForTimeout(6000);
await page.screenshot({ path: outPath, fullPage: false });
await ctx.close();
await browser.close();
console.log('Skärmdump:', outPath);
