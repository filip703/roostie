import test from 'node:test'
import assert from 'node:assert/strict'
import { faerg, flodesrader, radUrl } from '../src/ui/tavelflode.js'

const r = (id, fas, rubrik, min = id) => ({ id, trad: 'kolonin', fas, rubrik, created_at: new Date(Date.UTC(2026, 9, 3, 10, 0) - min * -60000).toISOString() })

test('färg per fas, TILL FILIP slår fasen', () => {
  assert.equal(faerg({ fas: 'borjar', rubrik: 'x' }), 'borjar')
  assert.equal(faerg({ fas: 'klart', rubrik: 'x' }), 'klart')
  assert.equal(faerg({ fas: 'stoppat', rubrik: 'x' }), 'stoppat')
  assert.equal(faerg({ fas: 'notis', rubrik: 'P1 TILL FILIP: gör själv' }), 'filip')
})

test('nyast först, max 20, [mcp] bort', () => {
  const rader = Array.from({ length: 30 }, (_, i) => r(i + 1, 'klart', `Rad ${i}: a`))
  rader.push(r(99, 'notis', '[mcp] docker_logs · kolonin · 10:00', 999))
  const f = flodesrader({ rader })
  assert.equal(f.length, 20)
  assert.ok(f.every((x) => x.id !== 99))
  assert.equal(f[0].id, 30)
})

test('tomt eller trasigt svar → tom lista', () => {
  assert.deepEqual(flodesrader(null), [])
  assert.deepEqual(flodesrader({ error: 'x' }), [])
})

test('klick leder till raden', () => {
  assert.match(radUrl({ id: 2362 }), /\?rad=2362$/)
})
