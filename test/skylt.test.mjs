import test from 'node:test'
import assert from 'node:assert/strict'
import { skyltFor, korta, amne, gruppFor, KLART_MS } from '../src/ui/skylt.js'

const NU = Date.now()
const tr = (historik) => ({ historik })

test('bygger: ämnet ur senaste raden, utan radnummer och svans', () => {
  const t = tr([{ fas: 'borjar', rubrik: 'Rad 1814: Tar rad 1814 — skylt över varje astronaut', nar: NU }])
  assert.equal(skyltFor(t, 'working', NU).text, 'Bygger skylt över varje…')
})

test('väntar på dig är den enda gula', () => {
  const s = skyltFor(tr([]), 'waiting', NU)
  assert.deepEqual(s, { text: 'Väntar på dig', vantar: true })
  assert.equal(skyltFor(tr([]), 'idle', NU).vantar, false)
})

test('stoppad bär orsaken, kortad till 28 tecken', () => {
  const t = tr([{ fas: 'stoppat', rubrik: 'Rad 9: stoppat — Vercel blockerar deployen helt', nar: NU }])
  const s = skyltFor(t, 'blocked', NU).text
  assert.ok(s.startsWith('Har stannat'))
  assert.ok(s.length <= 28)
})

test('klart visas i två timmar, sedan Vilar', () => {
  const rad = (nar) => tr([{ fas: 'klart', rubrik: 'Rad 5: Vaultwarden igång', nar }])
  assert.equal(skyltFor(rad(NU - 1000), 'idle', NU).text, 'Klart: vaultwarden igång')
  assert.equal(skyltFor(rad(NU - KLART_MS - 1000), 'idle', NU).text, 'Vilar')
})

test('pausad går före allt utom ingenting', () => {
  assert.equal(skyltFor(tr([]), 'working', NU, { pausad: true }).text, 'Pausad')
})

test('sover, med klockslag när det finns', () => {
  assert.equal(skyltFor(tr([]), 'sleeping', NU).text, 'Sover')
  assert.equal(skyltFor(tr([]), 'sleeping', NU, { vilarTill: '06' }).text, 'Sover till 06')
})

test('korta bryter på ordgräns och aldrig över 28', () => {
  const k = korta('en alldeles för lång rubrik som aldrig får plats')
  assert.ok(k.length <= 28 && k.endsWith('…'))
  assert.equal(korta('kort'), 'kort')
})

test('amne', () => {
  assert.equal(amne('Rad 1882: knapparna byggda och pushade (b1e3407)'), 'knapparna byggda och pushade')
})

test('grupper', () => {
  assert.equal(gruppFor('Design'), 'Produkten')
  assert.equal(gruppFor('Sajten'), 'Affären')
  assert.equal(gruppFor('Ledning'), null)
})
