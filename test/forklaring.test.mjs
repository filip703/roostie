import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RUNDTUR_STEG, TECKEN, forklaringDold, harSettRundtur, knappText, markeraSedd, minnsForklaring } from '../src/ui/forklaring.js'

const lager = () => {
  const m = new Map()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }
}

test('rundturen har fyra steg och sista knappen heter Klart', () => {
  assert.equal(RUNDTUR_STEG.length, 4)
  assert.equal(knappText(0), 'Nästa')
  assert.equal(knappText(3), 'Klart')
})

test('rundturen visas en gång — sedan minns kolonin', () => {
  const l = lager()
  assert.equal(harSettRundtur(l), false)
  markeraSedd(l)
  assert.equal(harSettRundtur(l), true)
})

test('förklaringens val minns, och trasigt minne fäller ingenting', () => {
  const l = lager()
  assert.equal(forklaringDold(l), false)
  minnsForklaring(l, true)
  assert.equal(forklaringDold(l), true)
  const trasig = { getItem: () => { throw new Error('nej') }, setItem: () => { throw new Error('nej') } }
  assert.equal(harSettRundtur(trasig), false)
  assert.doesNotThrow(() => markeraSedd(trasig))
})

test('texterna är klarspråk och varje färg har ett ord', () => {
  const allt = JSON.stringify([RUNDTUR_STEG, TECKEN])
  assert.ok(!/\b(tråd|pass|commit|deploy|harness)\b/i.test(allt))
  assert.ok(TECKEN.every((t) => t.ord))
})
