import assert from 'node:assert/strict'
import { test } from 'node:test'
import { halltid, matchar, rundtur } from '../src/world/rundtur.js'

const UTSIKTER = [
  { namn: 'överblick' },
  { namn: 'barken' },
  { namn: 'underifrån' },
  { namn: 'kronan' },
]
const BON = [
  { id: 'roost-loggbok:box-moln', namn: 'Box & moln' },
  { id: 'roost-loggbok:design', namn: 'Design' },
  { id: 'roost-loggbok:kolonin', namn: 'Kolonin' },
  { id: 'roost-loggbok:ledning', namn: 'Ledning' },
]
const namn = (b) => b.map((s) => s.namn)

test('varje bo besöks exakt en gång per varv', () => {
  const b = namn(rundtur(UTSIKTER, BON, null))
  for (const bo of BON) {
    assert.equal(b.filter((n) => n === bo.namn).length, 1, `${bo.namn} besöks inte en gång`)
  }
})

test('varvet börjar och slutar på överblicken', () => {
  const b = namn(rundtur(UTSIKTER, BON, null))
  assert.equal(b[0], 'överblick')
  assert.equal(b[b.length - 1], 'överblick')
})

/**
 * Regeln som gör banan möjlig att följa: man ska aldrig hinna tappa bort trädet. Räknas på
 * BONA, inte på alla hållplatser — barken, underifrån och kronan är alla bilder av helheten
 * och får gärna komma efter varandra.
 */
test('helheten kommer tillbaka — aldrig tre bon i rad', () => {
  for (const senast of [null, 'kolonin', 'box-moln']) {
    let irad = 0
    for (const s of rundtur(UTSIKTER, BON, senast)) {
      irad = s.id ? irad + 1 : 0
      assert.ok(irad <= 2, `tre bon i rad utan överblick (senast: ${senast})`)
    }
  }
})

test('vinklarna kommer med, en gång var', () => {
  const b = namn(rundtur(UTSIKTER, BON, null))
  for (const v of ['barken', 'underifrån', 'kronan']) {
    assert.equal(b.filter((n) => n === v).length, 1, v)
  }
})

/**
 * Den regeln som gör en köksskärm värd att titta upp mot: den som just gjorde något går
 * först. Och den måste tåla att tavlan, harnessen och fågeln stavar tråden på tre sätt.
 */
test('den som senast skrev går först, och bara en gång', () => {
  const b = namn(rundtur(UTSIKTER, BON, 'kolonin'))
  assert.equal(b[1], 'Kolonin')
  assert.equal(b.filter((n) => n === 'Kolonin').length, 1)
})

test('tavlans nyckel hittar boet fast id och namn stavas annorlunda', () => {
  const b = namn(rundtur(UTSIKTER, BON, 'box-moln'))
  assert.equal(b[1], 'Box & moln')
  assert.ok(matchar(BON[0], 'box-moln'))
  assert.ok(matchar(BON[0], 'roost-loggbok:box-moln'))
  assert.ok(matchar(BON[0], 'box & moln'))
  assert.ok(!matchar(BON[0], 'moln'))
  assert.ok(!matchar(BON[0], ''))
})

test('en okänd tråd ändrar ingenting', () => {
  const a = namn(rundtur(UTSIKTER, BON, 'finns-inte'))
  const b = namn(rundtur(UTSIKTER, BON, null))
  assert.deepEqual(a, b)
})

test('ett tomt träd ger en tom bana, inte en bana till ingenting', () => {
  assert.deepEqual(rundtur([], [], null), [])
  assert.deepEqual(rundtur(undefined, undefined, undefined), [])
  assert.ok(rundtur(UTSIKTER, [], null).every(Boolean))
})

test('överblicken står kortare än ett bo', () => {
  assert.ok(halltid({ namn: 'överblick' }) < halltid({ namn: 'Kolonin' }))
})
