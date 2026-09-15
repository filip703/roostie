/**
 * Slagräkningen i skärmtidsfyren. Ett slag ska betyda en minut som lämnat en budget —
 * varken mer eller mindre. Det är den regeln som gör att ljuset går att lita på.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { raknaSlag } from '../src/world/skarmtidsfyr.js'

test('första hämtningen ger inga slag', () => {
  assert.equal(raknaSlag(null, 161, true, 0), 0)
})

test('en minut som lämnat en budget ger ett slag', () => {
  assert.equal(raknaSlag(161, 162, true, 0), 1)
})

test('inget slag när ingen minut dragits', () => {
  assert.equal(raknaSlag(161, 161, true, 0), 0)
})

test('en gammal hämtning ger inga slag — vi vet inte, alltså slår vi inte', () => {
  assert.equal(raknaSlag(161, 170, false, 0), 0)
})

test('en lucka i pollen blir inte ett stroboskop', () => {
  assert.equal(raknaSlag(100, 140, true, 0), 3)
})

test('kön byggs på, men bara till taket', () => {
  assert.equal(raknaSlag(100, 102, true, 2), 3)
})

/**
 * Mätaren. Det Filip ska kunna se tvärs över köket utan att vänta in ett slag är HÖJDEN och
 * FÄRGEN — så de två reglerna är utbrutna och provas här, precis som slagräkningen.
 */
import { stapelHojd, stapelFarg } from '../src/world/skarmtidsfyr.js'
import { TAL } from '../src/world/palett.js'

test('full budget ger full stråle, slut budget ger stubben — aldrig noll', () => {
  assert.equal(stapelHojd(1), 9.5)
  assert.equal(stapelHojd(0), 1.3)
  // En osynlig stråle betyder "ingen data", och det är något annat än "slut".
  assert.ok(stapelHojd(0) > 0)
})

test('stapeln växer med andelen kvar, och ingenting utanför noll till ett', () => {
  assert.ok(stapelHojd(0.5) > stapelHojd(0.2))
  assert.equal(stapelHojd(2), stapelHojd(1))
  assert.equal(stapelHojd(-3), stapelHojd(0))
  assert.equal(stapelHojd(NaN), stapelHojd(0))
})

test('färgen följer samma trösklar som resten av kolonin', () => {
  assert.equal(stapelFarg(0.8), TAL.gron)
  assert.equal(stapelFarg(0.3), TAL.honey)
  assert.equal(stapelFarg(0.09), TAL.clay)
})

test('utan färska siffror lyser fyren varken grönt eller rött', () => {
  assert.equal(stapelFarg(0.9, false), TAL.sage)
  assert.equal(stapelFarg(0.01, false), TAL.sage)
})

/**
 * Identitet och läge är två olika saker. Bill är blå och Tod är grön i Roost — en pelare som
 * byter färg när tiden tar slut byter barn mitt framför en, och det är fel sorts information.
 */
import { identitetsFarg } from '../src/world/skarmtidsfyr.js'

test('barnets egen färg vinner över statusfärgen, hur lite som än är kvar', () => {
  assert.equal(identitetsFarg('#4e7f8a', 0.02), 0x4e7f8a)
  assert.equal(identitetsFarg('#4E7F8A', 0.9), 0x4e7f8a)
})

test('utan känd färg får statusfärgen duga — kolonin hittar inte på en', () => {
  assert.equal(identitetsFarg(null, 0.8), TAL.gron)
  assert.equal(identitetsFarg('', 0.09), TAL.clay)
  assert.equal(identitetsFarg('blå', 0.09), TAL.clay)
  assert.equal(identitetsFarg('#xyzxyz', 0.3), TAL.honey)
})
