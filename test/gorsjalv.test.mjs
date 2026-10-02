import test from 'node:test'
import assert from 'node:assert/strict'
import { arGorSjalv, kortTitel, fragaUrl, synligaKort, markeraKlart, markeraSenare, imorgonAtta, radFranUrl, medFokus } from '../src/ui/gorsjalv.js'

const NU = new Date(2026, 9, 1, 12, 0, 0).getTime()
const p = (id, rubrik, text = '') => ({ id, trad: 'nexus', rubrik, text, nar: NU })

test('bara Gör själv-rader blir kort', () => {
  assert.equal(arGorSjalv(p(1, 'TILL FILIP: Gör själv: lägg in nyckel')), true)
  assert.equal(arGorSjalv(p(2, 'TILL FILIP: besluta om pris')), false)
  assert.equal(arGorSjalv(p(3, 'TILL FILIP: x', 'Vad · Var\nGör själv: steg 1')), true)
})

test('titel i klarspråk', () => {
  assert.equal(kortTitel(p(1, 'P1 TILL FILIP: Gör själv: lägg in nyckel')), 'lägg in nyckel')
})

test('Fråga leder till Ledningschatten med radens id', () => {
  assert.match(fragaUrl(p(1847, 'x')), /^https:\/\/claude\.ai\/chat\/b17542cd-c85e-4f87-8ebd-dae0fc20e457\?rad=1847$/)
  assert.doesNotMatch(fragaUrl({}), /rad=/)
})

test('Klart döljer kortet, Senare döljer till 08:00 nästa morgon', () => {
  const rader = [p(10, 'TILL FILIP: Gör själv: a'), p(11, 'TILL FILIP: Gör själv: b'), p(12, 'TILL FILIP: Gör själv: c')]
  let l = markeraKlart({}, 10, NU)
  l = markeraSenare(l, 11, NU)
  assert.deepEqual(synligaKort(rader, l, NU).map((k) => k.id), [12])
  const atta = imorgonAtta(NU)
  assert.equal(new Date(atta).getHours(), 8)
  assert.ok(atta > NU)
  assert.deepEqual(synligaKort(rader, l, atta + 1).map((k) => k.id), [11, 12])
})

test('före 08:00 räknas samma dags 08:00', () => {
  const tidigt = new Date(2026, 9, 1, 6, 0, 0).getTime()
  assert.equal(new Date(imorgonAtta(tidigt)).getDate(), 1)
})

test('?rad=N: heltal eller null', () => {
  assert.equal(radFranUrl('?rad=2174'), 2174)
  assert.equal(radFranUrl('?rad=abc'), null)
  assert.equal(radFranUrl(''), null)
})

test('radens kort kommer först och överlever Senare', () => {
  const filip = [p(1, 'TILL FILIP: Gör själv: a'), p(2, 'TILL FILIP: Gör själv: b')]
  const lagrat = { senare: { 2: NU + 1e6 } }
  assert.deepEqual(medFokus(filip, lagrat, null, NU).map((k) => k.id), [1])
  const m = medFokus(filip, lagrat, 2, NU)
  assert.deepEqual(m.map((k) => k.id), [2, 1])
  assert.equal(m[0].fokus, true)
  assert.deepEqual(medFokus(filip, { klart: { 2: NU } }, 2, NU).map((k) => k.id), [1])
})
