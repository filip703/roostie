// Tar screenshots vid flera tidpunkter för att välja bästa bilden
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath  = path.join(__dirname, 'boet-scen.html');

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
await page.goto(`file://${htmlPath}`);

// t=2.3s — nivå-upp
await page.waitForTimeout(2300);
await page.screenshot({ path: path.join(__dirname, 'klipp-2300.png') });

// t=5.0s — ägget klart
await page.waitForTimeout(2700); // cumulative 5000ms
await page.screenshot({ path: path.join(__dirname, 'klipp-5000.png') });

// t=9.2s — UI + syskonbo
await page.waitForTimeout(4200); // cumulative 9200ms
await page.screenshot({ path: path.join(__dirname, 'klipp-9200.png') });

await ctx.close();
await browser.close();
console.log('Klart');
