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
