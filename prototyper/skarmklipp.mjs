// skarmklipp.mjs — tar en PNG-skärmdump vid t=7000ms av animationen
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath  = path.join(__dirname, 'boet-scen.html');
const outPath   = path.join(__dirname, 'boet-skarmdump.png');

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
await page.goto(`file://${htmlPath}`);
await page.waitForTimeout(7200); // t=7.2s — fågeln rör sig i boet + gåva
await page.screenshot({ path: outPath, fullPage: false });
await ctx.close();
await browser.close();
console.log('Skärmdump:', outPath);
