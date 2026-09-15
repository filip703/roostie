import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BYGGER_MS,
  HAMTAR,
  MATAR_MS,
  PYSSLAR_MS,
  SYSSLA_ORD,
  SYSSLA_TAKT,
  bostorlek,
  skatter,
  syssla,
  ungar,
} from '../src/world/sysslor.js'

const NU = 1_700_000_000_000
const sedan = (ms) => NU - ms

test('ett stopp slår allt annat', () => {
  assert.equal(syssla({ hasError: true, sist: NU, rader: 40, vantar: [1] }, NU), 'larmar')
})

test('en notis slår arbetet — tråden vill dig något', () => {
  assert.equal(syssla({ notis: 'nåt', sist: NU, rader: 40 }, NU), 'sjunger')
  assert.equal(syssla({ unread: true, sist: NU, rader: 40 }, NU), 'sjunger')
})

/**
 * Regressionen från den 15 september, och anledningen till att den här filen finns.
 *
 * Först stod `ruvar` över arbetet. Mot riktig data — där varje tråd på Loggboken hade något
 * ställt till Filip — satt sex av sju fåglar still, och trädet blev lika dött som det Filip
 * pausade. En tråd som arbetar ska SES arbeta; det som väntar bär boet, inte fågeln.
 */
test('en tråd som nyss jobbat ruvar inte, hur mycket som än väntar på Filip', () => {
  const t = { sist: sedan(10 * 60 * 1000), rader: 30, vantar: [1, 2, 3, 4, 5] }
  assert.equal(syssla(t, NU), 'matar')
})

test('ruvar först när det inte finns något annat att göra', () => {
  assert.equal(syssla({ sist: sedan(BYGGER_MS + 1000), rader: 30, vantar: [1] }, NU), 'ruvar')
  assert.equal(syssla({ sist: sedan(BYGGER_MS + 1000), rader: 30, vantar: [] }, NU), 'pysslar')
})

test('tidsbanden i ordning', () => {
  assert.equal(syssla({ sist: sedan(MATAR_MS - 1000), rader: 30 }, NU), 'matar')
  assert.equal(syssla({ sist: sedan(MATAR_MS + 1000), rader: 30 }, NU), 'bygger')
  assert.equal(syssla({ sist: sedan(BYGGER_MS + 1000), rader: 30 }, NU), 'pysslar')
  assert.equal(syssla({ sist: sedan(PYSSLAR_MS + 1000), rader: 30 }, NU), 'sover')
})

test('nyss aktiv utan dagsverke bygger i stället för att mata', () => {
  assert.equal(syssla({ sist: sedan(60 * 1000), rader: 0 }, NU), 'bygger')
})

test('utan tidsstämpel gissas ingenting', () => {
  assert.equal(syssla({ running: true }, NU), 'matar')
  assert.equal(syssla({ running: false }, NU), 'sover')
  assert.equal(syssla({ running: false, vantar: [1] }, NU), 'ruvar')
  assert.equal(syssla(null, NU), 'sover')
})

test('arkiverat sover', () => {
  assert.equal(syssla({ archived: true, sist: NU, rader: 40 }, NU), 'sover')
})

test('ungar är dagsverket, tak på tre', () => {
  assert.equal(ungar(0), 0)
  assert.equal(ungar(12), 1)
  assert.equal(ungar(29), 2)
  assert.equal(ungar(400), 3)
  assert.equal(ungar(undefined), 0)
  assert.equal(ungar(-5), 0)
})

test('skatterna är raderna som väntar på Filip', () => {
  assert.equal(skatter({ vantar: [1, 2, 3] }), 3)
  assert.equal(skatter({ vantar: [] }), 0)
  assert.equal(skatter({}), 0)
  assert.equal(skatter(null), 0)
})

test('boet växer med raderna men aldrig till ett berg', () => {
  assert.equal(bostorlek(0), 0.82)
  assert.ok(bostorlek(10) > bostorlek(0))
  assert.equal(bostorlek(10_000), 1.5)
})

test('varje syssla har ord och takt, och ingen runda är stillastående', () => {
  for (const namn of ['larmar', 'ruvar', 'sjunger', 'matar', 'bygger', 'pysslar', 'sover']) {
    assert.ok(SYSSLA_ORD[namn], `${namn} saknar ord`)
    assert.ok(SYSSLA_TAKT[namn] > 0, `${namn} saknar takt`)
  }
})

test('bara hämtrundorna bär något i näbben', () => {
  assert.ok(HAMTAR.has('matar'))
  assert.ok(HAMTAR.has('bygger'))
  assert.ok(!HAMTAR.has('ruvar'))
  assert.ok(!HAMTAR.has('sover'))
})
