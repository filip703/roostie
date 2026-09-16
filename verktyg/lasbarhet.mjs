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
await page.goto(// Mätningen låses till ÖVERBLICKEN. Utan `vy` tar rundturen kameran dit den råkat komma
// efter åtta sekunder, och då mäter riggen en slumpvis hållplats — två körningar i rad ger
// olika svar, och ett mått som inte går att upprepa är inget mått. Överblicken är dessutom
// den värsta bilden: alla namn är med och alla ligger långt bort.
`${process.env.ROOSTIE_URL || 'http://127.0.0.1:5274'}/?debug=1&varld=trad&kiosk=1&vy=${encodeURIComponent(process.env.VY || 'överblick')}`, { waitUntil: 'load', timeout: 60000 })
await page.waitForFunction(() => (window.__roostie?.colony?.faglar?.faglar?.size || 0) > 0, null, { timeout: 60000 })
// Dagsljuset sätts i sidan, inte i localStorage: kolonifilen på servern skriver över
// webbläsarens egna inställningar vid start, och riggen mätte därför natt i två försök.
await page.evaluate(() => {
  const s = window.__roostie.settings
  s.set('autoTime', false)
  s.set('clockTime', false)
  s.set('timeOfDay', 0.5)
})
/**
 * Vänta tills KAMERAN STÅR STILL innan något mäts.
 *
 * Med en fast väntan mätte riggen mitt i inflygningen och rapporterade två krockar som inte
 * fanns när bilden väl stod stilla — samma körning gav olika svar två gånger i rad. Ett mått
 * som inte går att upprepa är inget mått, och ett falskt fel kostar lika mycket att jaga som
 * ett äkta.
 */
await page.waitForFunction(() => {
  const r = window.__roostie
  const kam = r.engine.camera.position
  const nu = [kam.x, kam.y, kam.z].map((v) => Math.round(v)).join(',')
  const stilla = window.__stilla || { nu: '', varv: 0 }
  stilla.varv = nu === stilla.nu ? stilla.varv + 1 : 0
  stilla.nu = nu
  window.__stilla = stilla
  return stilla.varv > 12
}, null, { timeout: 60000, polling: 250 })
await page.waitForTimeout(1500)

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
    const bredd = (o.geometry?.parameters?.width || planh * 3) / planh * px
    const q = p.clone().project(cam)
    const mx = (q.x * 0.5 + 0.5) * w, my = (-q.y * 0.5 + 0.5) * h
    const synligRuta = o.material?.opacity > 0.02 && q.z <= 1
    return {
      b: bredd, h: px, x: mx - bredd / 2, y: my - px / 2,
      i: q.z <= 1 && Math.abs(q.x) < 1.2 && Math.abs(q.y) < 1.2,
      text: px * (o.userData?.textandel ?? TEXTANDEL),
      etikett: true, ritad: synligRuta, op: +(o.material?.opacity ?? -1).toFixed(2),
    }
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

/**
 * TÄCKNINGEN — hur stor del av bilden som faktiskt ÄR träd.
 *
 * "Ser det stort ut?" är en smakfråga; "hur många procent av bilden är trädet?" är det inte.
 * Måttet togs fram när överblicken beskrevs som en modell i en låda: en tredjedel av ytan var
 * tom bakgrund, och övre tredjedelen halvtom.
 *
 * Det mäts genom att byta scenens bakgrund mot en färg som inte finns i paletten och räkna
 * hur många bildpunkter som blir kvar av den. Att i stället räkna "mörka punkter" vore fel:
 * dimman och barken är mörka de också, och ett mått som blandar ihop skugga med tomhet blir
 * sämre ju varmare bakgrunden görs.
 */
const tackning = await page.evaluate(async () => {
  const r = window.__roostie
  const scen = r.engine.scene
  const forut = scen.background

  /**
   * Bara TRÄDETS egna grupper får rita. Första versionen bytte bara bakgrundsfärg och räknade
   * allt som inte blev kvar — men i ett läge där stjärnkupolen fortfarande fanns är kupolen
   * geometri, och måttet svarade hundra procent på en bild som var till en tredjedel rymd.
   * Ett mått som inte kan mäta det gamla läget kan inte visa att det nya är bättre.
   */
  const tradGrupper = new Set(
    [r.colony.tradet?.grupp, r.colony.faglar?.grupp, r.colony.holkar?.grupp, r.colony.stamtavlan?.grupp].filter(Boolean)
  )
  const slackta = []
  for (const barn of scen.children) {
    if (tradGrupper.has(barn) || barn.isLight || barn.children?.some?.((x) => x.isLight)) continue
    if (barn.visible) {
      barn.visible = false
      slackta.push(barn)
    }
  }
  // Ljusgruppen får vara kvar, men dess egen geometri (kupol, stjärnor) ska inte räknas.
  const sky = [r.colony.sky?.dome, r.colony.sky?.stars, r.colony.sky?.companion].filter((o) => o && o.visible)
  for (const o of sky) o.visible = false
  const THREEColor = forut?.isColor ? forut.constructor : r.colony.camera.position.constructor && null
  scen.background = null
  r.engine.renderer.setClearColor(0xff00ff, 1)
  r.engine.renderer.render(scen, r.engine.camera)
  const duk = r.engine.renderer.domElement
  const liten = document.createElement('canvas')
  liten.width = 320
  liten.height = Math.round((320 * duk.height) / duk.width)
  const c = liten.getContext('2d')
  c.drawImage(duk, 0, 0, liten.width, liten.height)
  const d = c.getImageData(0, 0, liten.width, liten.height).data
  scen.background = forut
  r.engine.renderer.setClearColor(0x000000, 0)
  for (const o of slackta) o.visible = true
  for (const o of sky) o.visible = true
  const del = (y0, y1) => {
    let tom = 0, n = 0
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < liten.width; x++) {
        const i = (y * liten.width + x) * 4
        n++
        if (d[i] > 180 && d[i + 1] < 80 && d[i + 2] > 180) tom++
      }
    }
    return n ? Math.round((1000 * (n - tom)) / n) / 10 : 0
  }
  const h = liten.height
  return { hela: del(0, h), ovre: del(0, h / 3 | 0), mitt: del(h / 3 | 0, (2 * h) / 3 | 0), nedre: del((2 * h) / 3 | 0, h) }
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
/**
 * KROCKARNA. Storleken är ett av två villkor för att ett namn ska gå att läsa; det andra är
 * att inget annat namn ligger ovanpå det. Första versionen av riggen mätte bara det ena och
 * godkände en bild där två namnpar skrev över varandra.
 *
 * Bara etiketter som FAKTISKT RITAS räknas: en som redan gömts av krockregeln har opacitet
 * noll, och att rapportera den som en krock vore att rapportera lösningen som problemet.
 */
const tacke = (a, b) => {
  const bx = Math.min(a.x + a.b, b.x + b.b) - Math.max(a.x, b.x)
  const by = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (bx <= 0 || by <= 0) return 0
  return (bx * by) / Math.min(a.b * a.h, b.b * b.h)
}
const synliga = matt.rad.filter((d) => d.etikett && d.ritad && d.i)
const krockar = []
for (let i = 0; i < synliga.length; i++) {
  for (let j = i + 1; j < synliga.length; j++) {
    const t = tacke(synliga[i], synliga[j])
    // Opaciteten följer med i rapporten: en krock mellan två RITADE namn är ett fel i
    // scenen, en krock där någon står på noll är ett fel i mätningen. De ska gå att skilja åt
    // utan att någon behöver köra om riggen och gissa.
    if (t > 0.12) krockar.push({ par: [synliga[i].sak, synliga[j].sak], tacke: +t.toFixed(2), op: [synliga[i].op, synliga[j].op] })
  }
}
const omatta = matt.rad.filter((d) => d.omatt).map((d) => d.sak)
console.log(JSON.stringify({ fel, tackning, omatta, krockar, rader }, null, 1))
await browser.close()
