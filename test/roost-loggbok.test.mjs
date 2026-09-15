/**
 * Tavlan → astronauter. Testerna kör mot en fil i API:ts form (ROOST_LOGGBOK_FIL), så de
 * rör varken nätet eller ADMIN_TOKEN.
 *
 * Varje test importerar adaptern på nytt (`?v=`) eftersom modulen cachar tavlan i 20 sekunder.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const MIN = 60 * 1000
const H = 60 * MIN

let n = 0
async function medTavla(rader) {
  const fil = path.join(os.tmpdir(), `roostie-loggbok-${process.pid}-${++n}.json`)
  await fsp.writeFile(fil, JSON.stringify({ ok: true, rader }))
  process.env.ROOST_LOGGBOK_FIL = fil
  delete process.env.ROOST_LOGGBOK_URL
  delete process.env.ROOST_ADMIN_TOKEN
  const mod = await import(`../server/harnesses/roost-loggbok.mjs?v=${n}`)
  const threads = await mod.default.scanThreads()
  await fsp.rm(fil, { force: true })
  return { adapter: mod.default, threads, av: (trad) => threads.find((t) => t.id === `roost-loggbok:${trad}`) }
}

const rad = (trad, fas, minuterSedan, extra = {}) => ({
  trad,
  fas,
  rubrik: extra.rubrik || `${fas} i ${trad}`,
  text: extra.text || 'text',
  commit: extra.commit || null,
  created_at: new Date(Date.now() - minuterSedan * MIN).toISOString(),
})

test('ett färskt börjar hamrar, ett klart gör det inte', async () => {
  const { av } = await medTavla([
    rad('produkt', 'klart', 120),
    rad('produkt', 'borjar', 10),
    rad('nexus', 'borjar', 90),
    rad('nexus', 'klart', 30),
  ])
  assert.equal(av('produkt').running, true)
  assert.equal(av('nexus').running, false)
})

test('ett börjar som ingen stängt slutar hamra när arbetsfönstret gått ut', async () => {
  const { av } = await medTavla([rad('design', 'borjar', (5 * H) / MIN)])
  assert.equal(av('design').running, false, 'en glömd börjar-rad får inte hamra i evighet')
})

test('stoppat är fel, inte tystnad', async () => {
  const { av } = await medTavla([rad('box-moln', 'klart', 60), rad('box-moln', 'stoppat', 5)])
  assert.equal(av('box-moln').hasError, true)
  assert.equal(av('box-moln').running, false)
})

test('en notis till Filip vinkar', async () => {
  const { av } = await medTavla([
    rad('ledning', 'notis', 30, { rubrik: 'TILL FILIP: Stripe-nyckeln behövs' }),
    rad('produkt', 'notis', 30, { rubrik: 'TILL DESIGN: färgerna' }),
  ])
  assert.equal(av('ledning').unread, true)
  assert.equal(av('produkt').unread, false)
  assert.equal(av('ledning').notis, 'TILL FILIP: Stripe-nyckeln behövs', 'texten till anslagstavlan')
  assert.equal(av('produkt').notis, '')
})

test('anslagstavlan får den nyaste raden, inte den första', async () => {
  const { av } = await medTavla([
    rad('ledning', 'notis', 300, { rubrik: 'TILL FILIP: gammal fråga' }),
    rad('ledning', 'notis', 20, { rubrik: 'TILL FILIP: ny fråga' }),
  ])
  assert.equal(av('ledning').notis, 'TILL FILIP: ny fråga')
})

test('varje tråd får en zon och ett stabilt id', async () => {
  const { av } = await medTavla([
    rad('ledning', 'klart', 10),
    rad('produkt', 'klart', 10),
    rad('sajt-roostadmin', 'klart', 10),
    rad('kolonin', 'borjar', 10),
  ])
  assert.equal(av('ledning').project, 'landningsplattan')
  assert.equal(av('produkt').project, 'nexus')
  assert.equal(av('sajt-roostadmin').project, 'roost-site')
  assert.equal(av('kolonin').project, 'roostie')
  assert.equal(av('produkt').id, 'roost-loggbok:produkt')
  assert.equal(av('produkt').title, 'Produkt')
})

test('en okänd tråd blir ändå en astronaut, men skräp i trad-fältet blir ingen', async () => {
  const { threads, av } = await medTavla([
    rad('fjaderlada', 'klart', 10),
    rad('../../etc/passwd', 'klart', 10),
    rad('En Tråd Med Blanksteg', 'klart', 10),
  ])
  assert.ok(av('fjaderlada'), 'okända trådnamn ska synas — annars göms en tråd som arbetar')
  assert.equal(threads.length, 1)
})

test('bygget växer med det tråden skrivit, och tidsstämplarna spänner hela historiken', async () => {
  const { av } = await medTavla([
    rad('nexus', 'klart', 600, { text: 'x'.repeat(1000) }),
    rad('nexus', 'klart', 10, { text: 'y'.repeat(500), commit: 'abc1234def' }),
  ])
  const t = av('nexus')
  assert.ok(t.sizeBytes > 1500)
  assert.ok(t.createdAt < t.lastActivityAt)
  assert.equal(t.model, 'abc1234')
  assert.equal(t.effort, '2 rader')
})

test('inget fält är undefined — kolonin ritar på alla', async () => {
  const { threads } = await medTavla([rad('produkt', 'borjar', 5)])
  for (const [nyckel, varde] of Object.entries(threads[0])) {
    assert.notEqual(varde, undefined, `${nyckel} är undefined`)
  }
})

test('Open pekar på projektchatten, och bara för en giltig tråd', async () => {
  const { adapter } = await medTavla([rad('produkt', 'klart', 5)])
  assert.equal(adapter.openThread({ trad: 'produkt' }).ok, true)
  assert.equal(adapter.openThread({ trad: '../hack' }).ok, false)
  assert.equal(adapter.newSession('/tmp').ok, false)
})

test('varje tråd får sin egen chatt när den står i miljön', async () => {
  process.env.ROOSTIE_PROJEKT_URL = 'https://claude.ai/project/proj'
  process.env.ROOSTIE_CHATTAR = JSON.stringify({
    produkt: 'https://claude.ai/cowork/cse_PRODUKT',
    ledning: 'http://claude.ai/chat/osakert',
    design: 'https://example.com/nagon-annanstans',
  })
  const { av, adapter } = await medTavla([
    rad('produkt', 'klart', 5),
    rad('ledning', 'klart', 5),
    rad('design', 'klart', 5),
    rad('nexus', 'klart', 5),
  ])
  assert.equal(av('produkt').openUrl, 'https://claude.ai/cowork/cse_PRODUKT')
  assert.equal(adapter.openThread({ trad: 'produkt' }).url, 'https://claude.ai/cowork/cse_PRODUKT')
  assert.equal(av('ledning').openUrl, 'https://claude.ai/project/proj', 'http duger inte')
  assert.equal(av('design').openUrl, 'https://claude.ai/project/proj', 'annan värd duger inte')
  assert.equal(av('nexus').openUrl, 'https://claude.ai/project/proj', 'ingen rad = projektet')
  delete process.env.ROOSTIE_CHATTAR
  delete process.env.ROOSTIE_PROJEKT_URL
})

test('trasig JSON i ROOSTIE_CHATTAR fäller inte skanningen', async () => {
  process.env.ROOSTIE_CHATTAR = '{inte json'
  const { av } = await medTavla([rad('produkt', 'klart', 5)])
  assert.match(av('produkt').openUrl, /^https:\/\/claude\.ai\//)
  delete process.env.ROOSTIE_CHATTAR
})

test('utan källa finns adaptern inte alls', async () => {
  const mod = await import(`../server/harnesses/roost-loggbok.mjs?v=detect${++n}`)
  delete process.env.ROOST_LOGGBOK_FIL
  delete process.env.ROOST_LOGGBOK_URL
  delete process.env.ROOST_ADMIN_TOKEN
  assert.equal(await mod.default.detect(), false)
  process.env.ROOST_LOGGBOK_URL = 'https://roost.love/api/loggbok'
  assert.equal(await mod.default.detect(), false, 'URL utan token får inte räcka')
  process.env.ROOST_ADMIN_TOKEN = 'x'
  assert.equal(await mod.default.detect(), true)
  delete process.env.ROOST_LOGGBOK_URL
  delete process.env.ROOST_ADMIN_TOKEN
})

test('en tavla som inte svarar tömmer inte kolonin, men ingen hamrar på gammal information', async () => {
  const fil = path.join(os.tmpdir(), `roostie-loggbok-fel-${process.pid}.json`)
  await fsp.writeFile(fil, JSON.stringify({ ok: true, rader: [rad('produkt', 'borjar', 2)] }))
  process.env.ROOST_LOGGBOK_FIL = fil
  const mod = await import(`../server/harnesses/roost-loggbok.mjs?v=fel${++n}`)

  const forst = await mod.default.scanThreads()
  assert.equal(forst[0].running, true)
  assert.equal(await mod.default.diagnostic(), '')

  // Filen försvinner: tavlan går inte att läsa.
  await fsp.rm(fil, { force: true })
  await new Promise((r) => setTimeout(r, 25))
  mod.default._nollstallCache()
  const sedan = await mod.default.scanThreads()
  assert.equal(sedan.length, 1, 'senast kända läge ska stå kvar')
  assert.equal(sedan[0].running, false, 'ingen får hamra när vi inte vet')
  assert.match(await mod.default.diagnostic(), /Loggboken kunde inte läsas/)
  delete process.env.ROOST_LOGGBOK_FIL
})
