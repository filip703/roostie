import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boform, bonamn, fjaderlasning, holkform, holktext, nivaAv, ribbaAndel } from '../src/world/holkar.js'

/**
 * Holkarnas regler, provade utan webbläsare — samma mönster som fyren och sysslorna.
 * Det är de här tre funktionerna som avgör om holken säger sanning.
 */

test('holken har fasta mått — de fem stegen bär boet, inte lådan', () => {
  const h = holkform()
  assert.equal(h.bredd > 0 && h.hojd > 0, true)
  assert.deepEqual(holkform(), holkform(5), 'holken får inte växa med nivån: en källa, inte två')
})

test('nivå noll är tre kvistar på pinnen, inte ett litet bo', () => {
  const b = boform(0)
  assert.equal(b.varv, 0)
  assert.equal(b.fjadrar, 0)
  assert.equal(b.hal, false)
  assert.equal(b.kvistar, 3, 'Designs nivå 0: tre kvistar')
})

test('nivå ett är strån i en grop — ännu inget hål', () => {
  assert.equal(boform(1).varv, 0)
  assert.equal(boform(1).hal, false)
})

test('Designs fem steg växer, och stannar vid fem', () => {
  const steg = [2, 3, 4, 5].map(boform)
  for (let i = 1; i < steg.length; i++) {
    assert.ok(steg[i].radie > steg[i - 1].radie, `steg ${i + 2} är inte bredare`)
    assert.ok(steg[i].varv > steg[i - 1].varv, `steg ${i + 2} har inte fler varv`)
    assert.ok(steg[i].fjadrar > steg[i - 1].fjadrar, `steg ${i + 2} har inte fler fjädrar`)
  }
  assert.equal(boform(9).niva, 5)
  assert.equal(boform(5).fjadrar, 4, 'n − 1 invävda fjädrar, precis som boritningen')
})

test('trappan är regelbokens, siffra för siffra', () => {
  assert.equal(nivaAv(0), 0)
  assert.equal(nivaAv(9), 0)
  assert.equal(nivaAv(10), 1)
  assert.equal(nivaAv(29), 1)
  assert.equal(nivaAv(30), 2)
  assert.equal(nivaAv(65), 3)
  assert.equal(nivaAv(120), 4)
  assert.equal(nivaAv(199), 4)
  assert.equal(nivaAv(200), 5)
  assert.equal(nivaAv(100000), 5)
})

test('trasiga tal ger noll, aldrig en gissad nivå', () => {
  for (const v of [undefined, null, NaN, -1, 'tolv']) assert.equal(nivaAv(v), 0, String(v))
})

/**
 * Skillnaden mellan "noll fjädrar" och "inget fält" är hela poängen: båda ritar tre kvistar
 * i dag, men bara den ena är ett mätvärde. `kand` är det som skiljer dem i diagnosen.
 */
test('noll fjädrar är ett mätvärde — inget fält är det inte', () => {
  const matt = fjaderlasning({ namn: 'Bill', fjadrar: 0 })
  assert.equal(matt.niva, 0)
  assert.equal(matt.kand, true)

  const tomt = fjaderlasning({ namn: 'Bill' })
  assert.equal(tomt.niva, 0)
  assert.equal(tomt.kand, false)
  assert.equal(tomt.fjadrar, null)
})

test('fjädrar vinner över en färdig nivå — råtalet är källan', () => {
  assert.equal(fjaderlasning({ fjadrar: 200, boniva: 1 }).niva, 5)
  assert.equal(fjaderlasning({ boniva: 3 }).niva, 3)
  assert.equal(fjaderlasning({ boniva: 9 }).niva, 5)
})

test('boets namn är Designs ord, och tomt utan läsväg', () => {
  assert.equal(bonamn(5, true), 'Ett färdigt bo')
  assert.equal(bonamn(0, true), 'En kvist')
  assert.equal(bonamn(3, false), '')
})

test('tre lägen går att skilja åt: full, slut och ingen data', () => {
  const full = ribbaAndel(1, true)
  const slut = ribbaAndel(0, true)
  const okand = ribbaAndel(0.5, false)
  assert.equal(full, 1)
  assert.ok(slut > 0, 'slut får inte vara osynlig — det betyder "ingen data"')
  assert.equal(okand, 0)
  assert.ok(full > slut && slut > okand)
})

test('andelen klipps, aldrig utanför ribban', () => {
  assert.equal(ribbaAndel(4, true), 1)
  assert.equal(ribbaAndel(-2, true), ribbaAndel(0, true))
  assert.equal(ribbaAndel(NaN, true), ribbaAndel(0, true))
})

test('texten har tre lägen och aldrig ett tomt fält', () => {
  assert.equal(holktext('Bill', 78, true), 'Bill 78 min')
  assert.equal(holktext('Bill', 0, true), 'Bill slut')
  assert.equal(holktext('Bill', -3, true), 'Bill slut')
  assert.equal(holktext('Bill', 78, false), 'Bill okänd')
})
