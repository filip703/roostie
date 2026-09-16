import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bar, ekorrfart, ekorrord, fallandeLov, vind } from '../src/world/tradliv.js'

const M = (namn, status) => ({ namn, status })

/**
 * Den genomgående regeln i hela filen är LAXOR 23: en vakt som inte kan mäta får inte
 * rapportera. Testerna nedan är mest till för att hålla just den.
 */

test('ett löv per agent som GICK ner — inte per agent som ÄR nere', () => {
  const fore = [M('a', 'ok'), M('b', 'nere'), M('c', 'ok')]
  const nu = [M('a', 'nere'), M('b', 'nere'), M('c', 'ok')]
  assert.equal(fallandeLov(fore, nu), 1, 'b låg redan nere och ska inte fälla ett löv igen')
})

test('första hämtningen fäller inga löv', () => {
  assert.equal(fallandeLov([], [M('a', 'nere')]), 0)
  assert.equal(fallandeLov(null, [M('a', 'nere')]), 0)
})

test('okänd i endera änden räknas inte — att inte veta är inte att ha gått ner', () => {
  assert.equal(fallandeLov([M('a', 'okand')], [M('a', 'nere')]), 0)
  assert.equal(fallandeLov([M('a', 'ok')], [M('a', 'okand')]), 0)
})

test('lövregnet har ett tak', () => {
  const fore = Array.from({ length: 20 }, (_, i) => M('a' + i, 'ok'))
  const nu = fore.map((m) => M(m.namn, 'nere'))
  assert.ok(fallandeLov(fore, nu) <= 6)
})

test('bären är ett tillstånd: en per agent i fel just nu', () => {
  assert.equal(bar([M('a', 'fel'), M('b', 'ok'), M('c', 'fel')]), 2)
  assert.equal(bar([M('a', 'okand')]), 0, 'okänd är inte fel — kolonin larmar inte')
  assert.equal(bar([]), 0)
  assert.equal(bar(null), 0)
})

test('kronan andas även när ingen vet något', () => {
  assert.ok(vind([]) > 0, 'en stilla krona ser ut som en trasig sida')
  assert.ok(vind([M('a', 'okand')]) > 0)
  assert.equal(vind([M('a', 'okand')]), vind([]), 'okänd data ska ge samma lugna läge som ingen data')
})

/**
 * Regressionen värd ett eget test: reglerna skrevs först mot lägena `arbetar`/`tomgang`, som
 * maskinläsaren ALDRIG skriver — den skriver ok/nere/fel/okand. Allt hade sett lugnt ut för
 * alltid utan att något avslöjade varför.
 */
test('vinden mäts på färska loggavtryck, inte på ett läge som inte finns', () => {
  const NU = 1_700_000_000_000
  const tysta = [1, 2, 3, 4].map((i) => ({ namn: 'a' + i, status: 'ok', sistaLogg: NU - 3600_000 }))
  const aktiva = [1, 2, 3, 4].map((i) => ({ namn: 'a' + i, status: 'ok', sistaLogg: NU - 5_000 }))
  assert.ok(vind(aktiva, NU) > vind(tysta, NU))
  assert.ok(vind(aktiva, NU) <= 0.86)
  assert.equal(vind(tysta, NU), 0.35, 'tystnad ska ge lugn vind, inte stiltje')
})

test('ett löv faller när en agent lämnar ok', () => {
  assert.equal(fallandeLov([M('a', 'ok')], [M('a', 'fel')]), 1)
  assert.equal(fallandeLov([M('a', 'ok')], [M('a', 'nere')]), 1)
  assert.equal(fallandeLov([M('a', 'nere')], [M('a', 'ok')]), 0, 'att komma tillbaka fäller inget löv')
})

test('ekorren springer på kön och sitter still utan läsväg', () => {
  assert.ok(ekorrfart({ pending: 1, running: 0 }, true) > 0)
  assert.ok(ekorrfart({ pending: 0, running: 2 }, true) > 0)
  assert.equal(ekorrfart({ pending: 0, running: 0 }, true), 0)
  assert.equal(ekorrfart({ pending: 9, running: 9 }, false), 0, 'utan läsväg är fart en lögn')
  assert.equal(ekorrfart(null, true), 0)
  assert.ok(ekorrfart({ pending: 99, running: 99 }, true) <= 1)
})

test('ekorrens tre ord', () => {
  assert.equal(ekorrord({ pending: 2 }, true), 'springer')
  assert.equal(ekorrord({ pending: 0, running: 0 }, true), 'sitter')
  assert.equal(ekorrord({ pending: 2 }, false), 'okänd')
})
