// Renderar konceptfilmen bildruta för bildruta. Tiden sätts av riggen, inte av väggklockan —
// en film som renderas mot klockan blir olika lång varje gång och går inte att ta om.
import pw from 'playwright'
import { mkdir } from 'node:fs/promises'

const ut = process.argv[2] || '/tmp/claude-0/rutor'
const fps = Number(process.argv[3] || 20)
const bredd = Number(process.argv[4] || 900)
const hojd = Math.round((bredd * 3) / 4)

await mkdir(ut, { recursive: true })
const b = await pw.chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const p = await b.newPage({ viewport: { width: bredd, height: hojd }, deviceScaleFactor: 1 })
const fel = []
p.on('pageerror', (e) => fel.push(String(e.stack || e).slice(0, 400)))
p.on('console', (m) => {
  if (m.type() === 'error') fel.push('KONSOL ' + m.text().slice(0, 200))
})
await p.goto(process.env.FILM_URL || 'http://127.0.0.1:5300/koncept/boet.html', { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => window.__boet, null, { timeout: 30000 })
await p.evaluate(() => window.__boet.auto(false))
await p.waitForTimeout(1500)
const langd = await p.evaluate(() => window.__boet.langd)
const rutor = Math.round(langd * fps)
for (let i = 0; i <= rutor; i++) {
  await p.evaluate((tt) => window.__boet.stall(tt), i / fps)
  await p.screenshot({ path: `${ut}/${String(i).padStart(4, '0')}.png` })
}
console.log(JSON.stringify({ rutor: rutor + 1, langd, fps, bredd, hojd, fel: fel.slice(0, 5) }))
await b.close()
