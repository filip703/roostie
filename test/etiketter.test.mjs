import test from 'node:test'
import assert from 'node:assert/strict'
import { gomKrockar, ruta, tacke, KROCK } from '../src/world/etiketter.js'

const R = (x, y, b = 100, h = 20) => ({ x, y, b, h })

test('rutor som inte rör varandra täcker ingenting', () => {
  assert.equal(tacke(R(0, 0), R(200, 0)), 0)
  assert.equal(tacke(R(0, 0), R(0, 40)), 0)
})

test('täcket räknas mot den MINDRE rutan', () => {
  // Liten ruta helt inuti en stor: hela den lilla är täckt, alltså 1.
  assert.equal(tacke(R(0, 0, 200, 40), R(50, 10, 20, 10)), 1)
})

test('etikettens ruta växer med skalan och krymper med avståndet', () => {
  const plan = { bredd: 2, hojd: 0.56 }
  const fov = (38 * Math.PI) / 180
  const nara = ruta({ x: 0, y: 0 }, plan, 40, 1, fov, 1080)
  const langt = ruta({ x: 0, y: 0 }, plan, 120, 1, fov, 1080)
  const stor = ruta({ x: 0, y: 0 }, plan, 120, 1.7, fov, 1080)
  assert.ok(nara.h > langt.h, 'nära ska vara större än långt bort')
  assert.ok(stor.h > langt.h * 1.6, 'skalan ska slå igenom nästan rakt av')
  assert.ok(langt.h > 0)
})

test('rutan ligger centrerad på den projicerade mittpunkten', () => {
  const r = ruta({ x: 500, y: 300 }, { bredd: 2, hojd: 0.56 }, 60, 1, (38 * Math.PI) / 180, 1080)
  assert.equal(Math.round(r.x + r.b / 2), 500)
  assert.equal(Math.round(r.y + r.h / 2), 300)
})

test('den närmaste behåller sin plats, den bakom göms', () => {
  const gom = gomKrockar([
    { namn: 'bakom', ruta: R(100, 100), avstand: 120 },
    { namn: 'framför', ruta: R(110, 104), avstand: 40 },
  ])
  assert.deepEqual([...gom], ['bakom'])
})

test('namn som bara nuddar varandra får båda stå kvar', () => {
  const gom = gomKrockar([
    { namn: 'a', ruta: R(0, 0, 100, 20), avstand: 40 },
    { namn: 'b', ruta: R(95, 0, 100, 20), avstand: 60 },
  ])
  assert.equal(gom.size, 0, '5 % täcke är inte en krock')
})

/**
 * Tre namn på hög. Prövas varje ruta mot ALLA andra göms två av tre — fastän den tredje
 * bara krockade med en som ändå försvann. Den här ordningen är hela poängen med `kvar`.
 */
test('tre på hög gömmer två, inte fler — och aldrig den närmaste', () => {
  const gom = gomKrockar([
    { namn: 'mitten', ruta: R(100, 100), avstand: 80 },
    { namn: 'nära', ruta: R(104, 102), avstand: 30 },
    { namn: 'långt', ruta: R(108, 104), avstand: 150 },
  ])
  assert.deepEqual([...gom].sort(), ['långt', 'mitten'])
})

test('en etikett utanför bilden göms utan att stjäla plats från någon', () => {
  const gom = gomKrockar([
    { namn: 'ute', ruta: R(100, 100), avstand: 10, iBild: false },
    { namn: 'inne', ruta: R(100, 100), avstand: 90 },
  ])
  assert.deepEqual([...gom], ['ute'], 'den utanför bilden får inte vinna kampen om platsen')
})

test('taket går att ändra utan att regeln ändras', () => {
  const rutor = [
    { namn: 'a', ruta: R(0, 0, 100, 20), avstand: 10 },
    { namn: 'b', ruta: R(90, 0, 100, 20), avstand: 20 },
  ]
  assert.equal(gomKrockar(rutor, KROCK).size, 0)
  assert.equal(gomKrockar(rutor, 0.05).size, 1)
})
