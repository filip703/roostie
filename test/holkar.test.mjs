import assert from 'node:assert/strict'
import { test } from 'node:test'
import { holkform, holktext, ribbaAndel } from '../src/world/holkar.js'

/**
 * Holkarnas regler, provade utan webbläsare — samma mönster som fyren och sysslorna.
 * Det är de här tre funktionerna som avgör om holken säger sanning.
 */

test('nivå noll är inte en nivå — det är "vi vet inte"', () => {
  const h = holkform(0)
  assert.equal(h.niva, 0)
  assert.equal(h.varv, 0)
  assert.equal(h.fjadrar, 0)
  assert.equal(h.kand, false)
})

test('okänd nivå ger samma svar som noll, aldrig en gissning', () => {
  for (const v of [undefined, null, NaN, 'tre', -4]) {
    assert.equal(holkform(v).niva, 0, String(v))
    assert.equal(holkform(v).kand, false)
  }
})

test('Designs fem steg växer, och stannar vid fem', () => {
  const steg = [1, 2, 3, 4, 5].map(holkform)
  for (let i = 1; i < steg.length; i++) {
    assert.ok(steg[i].bredd > steg[i - 1].bredd, `steg ${i + 1} är inte bredare`)
    assert.ok(steg[i].varv > steg[i - 1].varv, `steg ${i + 1} har inte fler varv`)
  }
  assert.equal(holkform(9).niva, 5)
  assert.equal(holkform(5).fjadrar, 5)
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
