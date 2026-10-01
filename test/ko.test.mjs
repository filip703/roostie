import test from 'node:test'
import assert from 'node:assert/strict'
import { prioAv, klarsprak, alderText, koSammanfattning } from '../src/ui/ko.js'

const NU = Date.parse('2026-10-01T12:00:00Z')
const rad = (rubrik, min, extra = {}) => ({ rubrik, created_at: new Date(NU - min * 60000).toISOString(), ...extra })

test('prioritet ur rubriken, saknas märkning blir det P2', () => {
  assert.equal(prioAv({ rubrik: 'P0 TILL KOLONIN: x' }), 0)
  assert.equal(prioAv({ rubrik: 'Rad 1: x' }), 2)
  assert.equal(prioAv({ prio: 'P1' }), 1)
})

test('klarspråk: tar bort P-märke, TILL-prefix och radnummer', () => {
  assert.equal(klarsprak('P1 TILL KOLONIN + DESIGN: Kolonin ska förklara sig'), 'Kolonin ska förklara sig')
  assert.equal(klarsprak('Rad 1850: kö per agent'), 'kö per agent')
})

test('ålder i min, tim, dygn', () => {
  assert.equal(alderText(rad('x', 12), NU), '12 min')
  assert.equal(alderText(rad('x', 180), NU), '3 tim')
  assert.equal(alderText(rad('x', 60 * 24 * 3), NU), '3 dygn')
})

test('kö: P0 först, äldst först inom prioritet, topp 3', () => {
  const s = koSammanfattning({ rader: [rad('P2 a', 10), rad('P0 b', 5), rad('P2 c', 99), rad('P1 d', 1)] }, NU)
  assert.deepEqual(s.topp.map((r) => r.prio), ['P0', 'P1', 'P2'])
  assert.equal(s.topp[2].text, 'c')
  assert.equal(s.antal, 4)
  assert.equal(s.alla.length, 4)
})

test('inget svar → ingen siffra', () => {
  assert.equal(koSammanfattning(null), null)
  assert.equal(koSammanfattning({ error: 'x' }), null)
})

test('Sajts verkliga svarsform: skapad, alder_min, prio som text', () => {
  const s = koSammanfattning({ antal: 9, rader: [
    { id: 1, prio: 'P2', rubrik: 'a', skapad: '2026-09-28T18:48:05Z', alder_min: 3706 },
    { id: 2, prio: 'P1', rubrik: 'b', skapad: '2026-09-30T18:07:31Z', alder_min: 867 },
    { id: 3, prio: 'P2', rubrik: 'c', alder_min: 100 },
  ] }, Date.parse('2026-10-01T08:34:00Z'))
  assert.deepEqual(s.alla.map((r) => r.text), ['b', 'a', 'c'])
  assert.equal(s.antal, 9)
  assert.equal(s.alla[0].alder, '14 tim')
})
