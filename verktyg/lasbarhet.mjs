/**
 * LÄSBARHET PÅ TRE METER — Lednings rad 240, krav 1.
 *
 * Kör: node verktyg/lasbarhet.mjs [bild.png]   (servern på 5274; ROOSTIE_URL och CHROMIUM
 * finns om adressen eller webbläsaren ligger någon annanstans.)
 *
 * Kravet är inte "det ser bra ut" utan "det går att LÄSA på tre meters håll mitt på dagen".
 * Det går att räkna på. En 43-tumsskärm är 0,535 m hög; på tre meters avstånd upptar den 6,1
 * grader, alltså 368 bågminuter. Ett tecken behöver omkring 16 bågminuter för att läsas i en
 * blick — synskärpans gräns är 5, men en gräns är inte en läsning — och en form omkring 30
 * för att gå att känna igen på avstånd.
 *
 * Riggen mäter därför i ANDEL AV SKÄRMHÖJDEN och räknar om till bågminuter: måttet blir
 * oberoende av upplösningen, och det är formatet kravet faktiskt är skrivet i. Den skriver en
 * rad per sak, och listar separat det den INTE kunde mäta — se `synlig()` om varför.
 */
import pw from 'playwright'
const { chromium } = pw

const SKARM_M = 0.535 // 43 tum, 16:9
const AVSTAND_M = 3.0
const bagmin = (andel) => (andel * SKARM_M) / AVSTAND_M * (180 / Math.PI) * 60

const ut = process.argv[2] || 'lasbarhet.png'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => {
  try {
    localStorage.setItem('botcrossing.seen-help', '1')
    // Mitt på dagen, inte klockan: kravet gäller dagsljus.
    localStorage.setItem('botcrossing.settings.v1', JSON.stringify({ autoTime: false, clockTime: false, timeOfDay: 0.5 }))
  } catch {}
})
const fel = []
page.on('pageerror', (e) => fel.push(String(e.stack || e).slice(0, 300)))
await page.goto(`${process.env.ROOSTIE_URL || 'http://127.0.0.1:5274'}/?debug=1&varld=trad&kiosk=1`, { waitUntil: 'load', timeout: 60000 })
await page.waitForFunction(() => (window.__roostie?.colony?.faglar?.faglar?.size || 0) > 0, null, { timeout: 60000 })
// Dagsljuset sätts i sidan, inte i localStorage: kolonifilen på servern skriver över
// webbläsarens egna inställningar vid start, och riggen mätte därför natt i två försök.
await page.evaluate(() => {
  const s = window.__roostie.settings
  s.set('autoTime', false)
  s.set('clockTime', false)
  s.set('timeOfDay', 0.5)
})
await page.waitForTimeout(6000)

const matt = await page.evaluate(() => {
  const r = window.__roostie
  const cam = r.engine.camera
  const h = window.innerHeight, w = window.innerWidth
  const V = r.colony.camera.position.constructor
  /**
   * Etiketterna mäts INTE med sin geometri.
   *
   * De håller nästan konstant skärmstorlek genom en egen vertexshader, så geometrins hörn
   * ligger inte där bilden visar dem — riggen rapporterade nio bildpunkter för en text som
   * på skärmen är närmare fjorton. Formeln nedan är shaderns egen, räknad baklänges: höjden
   * i vyn är planhöjden gånger (0.55 + avstånd · 0.03), och den höjden mot bildhöjden ger
   * bildpunkterna. Texten är dessutom bara en del av plattan — resten är luft runt om.
   */
  const TEXTANDEL = 34 / (34 + 28)
  const etikettPx = (o) => {
    o.updateWorldMatrix(true, true)
    const p = new V().setFromMatrixPosition(o.matrixWorld)
    const d = p.distanceTo(cam.position)
    const planh = o.geometry?.parameters?.height || 0.56
    // Skalan läses ur plattan själv (`userData.skala`), inte ur en siffra i riggen: en rigg
    // som bär sin egen kopia av koden mäter det den TROR, inte det som ritas.
    const vyh = planh * (0.55 + d * 0.03) * (o.userData?.skala ?? 1)
    const px = (vyh / (2 * d * Math.tan((cam.fov * Math.PI) / 360))) * h
    return { b: px * 3, h: px, x: 0, y: 0, i: true, text: px * (o.userData?.textandel ?? TEXTANDEL) }
  }
  /**
   * En dold eller nollskalad sak MÄTS INTE — den rapporteras som omätt.
   *
   * Riggen påstod först att sångringarna höll elva bågminuter och alltså var oläsliga. De är
   * dolda och står på skala 1 när ingen sjunger; i rörelse växer de till sju gånger så stora.
   * Måttet var alltså inte ett fel i scenen utan i mätningen — och en rigg som inte kan mäta
   * får inte svara grönt eller rött, den ska säga att den inte vet (LAXA 23, om sig själv).
   */
  const synlig = (o) => {
    let f = o
    while (f) { if (!f.visible) return false; f = f.parent }
    return true
  }
  const skarm = (o) => {
    if (!synlig(o)) return { b: 0, h: 0, x: 0, y: 0, i: true, omatt: true }
    o.updateWorldMatrix(true, true)
    let min = null, max = null
    o.traverse((n) => {
      if (!n.geometry) return
      n.geometry.computeBoundingBox()
      const bb = n.geometry.boundingBox
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
        const v = new V(x, y, z).applyMatrix4(n.matrixWorld).project(cam)
        const px = (v.x * 0.5 + 0.5) * w, py = (-v.y * 0.5 + 0.5) * h
        if (!min) { min = { x: px, y: py }; max = { x: px, y: py } }
        min.x = Math.min(min.x, px); min.y = Math.min(min.y, py)
        max.x = Math.max(max.x, px); max.y = Math.max(max.y, py)
      }
    })
    if (!min) return null
    return { b: max.x - min.x, h: max.y - min.y, x: Math.round(min.x), y: Math.round(min.y), i: min.x > -40 && max.x < w + 40 && min.y > -40 && max.y < h + 40 }
  }
  const rad = []
  for (const [namn, f] of r.colony.faglar.faglar) {
    const t = f.trad?.namn || namn
    if (f.fagel?.grupp) rad.push({ sak: 'fågel ' + t, ...skarm(f.fagel.grupp) })
    if (f.bo?.grupp) rad.push({ sak: 'bo ' + t, ...skarm(f.bo.grupp) })
    if (f.bo?.skatt) rad.push({ sak: 'skatt ' + t, ...skarm(f.bo.skatt) })
    if (f.etikett) rad.push({ sak: 'etikett ' + t, ...etikettPx(f.etikett) })
    if (f.sang?.grupp) rad.push({ sak: 'sång ' + t, ...skarm(f.sang.grupp) })
  }
  for (const p of r.colony.holkar.barn.values()) {
    rad.push({ sak: 'holk ' + p.namn, ...skarm(p.grupp) })
    if (p.bo) { const m = skarm(p.bo); rad.push({ sak: 'holkbo ' + p.namn, ...m, text: m.b }) }
    if (p.skylt) rad.push({ sak: 'holkskylt ' + p.namn, ...etikettPx(p.skylt) })
  }
  if (r.colony.stamtavlan?.grupp) rad.push({ sak: 'loggbokstavlan', ...skarm(r.colony.stamtavlan.grupp) })
  return { h, w, rad: rad.filter(Boolean) }
})

// Tom bild tas om: kompositören lämnar ibland inte WebGL-ytan. Kontrollen görs på FILEN,
// för canvasen har alltid en bild — det är bilden ut som kan vara svart.
const { stat } = await import('node:fs/promises')
for (let i = 0; i < 6; i++) {
  await page.screenshot({ path: ut })
  if ((await stat(ut)).size > 150000) break
  await page.waitForTimeout(1200)
}
const rader = matt.rad.filter((d) => !d.omatt).map((d) => ({
  sak: d.sak,
  px: Math.round(d.text ?? d.h),
  andel: +(((d.text ?? d.h) / matt.h) * 100).toFixed(2),
  bagmin: Math.round(bagmin((d.text ?? d.h) / matt.h)),
  ibild: d.i,
}))
rader.sort((a, b) => a.bagmin - b.bagmin)
const omatta = matt.rad.filter((d) => d.omatt).map((d) => d.sak)
console.log(JSON.stringify({ fel, omatta, rader }, null, 1))
await browser.close()
