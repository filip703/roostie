/**
 * Plättens namn: harnessen framför allt som inte är Roosts Loggbok.
 *
 * Regeln finns för att Filip kör Roost-pass i Claude Code sedan 16 september. En session i
 * `~/Developer/nexus` heter `nexus`; Roosts Loggbokstråd heter `Nexus`. Utan prefix är de
 * samma rad i panelen, samma plätt, samma fågel — och ingen kan se vilken som är vilken.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { plattnamn, disambiguateProjects } from '../server/scan.mjs'

test('Loggbokens trådar behåller sitt namn', () => {
  assert.equal(plattnamn({ harness: 'roost-loggbok', harnessName: 'Roost', project: 'Nexus' }), 'Nexus')
})

test('en lokal session bär sin harness framför sig', () => {
  assert.equal(
    plattnamn({ harness: 'claude-code', harnessName: 'Claude Code', project: 'nexus' }),
    'Claude Code · nexus'
  )
})

test('harness-id duger när harnessen saknar namn', () => {
  assert.equal(plattnamn({ harness: 'codex', project: 'foo' }), 'codex · foo')
})

test('en tråd utan namn får inget prefix att hänga på', () => {
  assert.equal(plattnamn({ harness: 'claude-code', harnessName: 'Claude Code', project: '' }), '')
  assert.equal(plattnamn({ harness: 'claude-code', harnessName: 'Claude Code' }), '')
})

/**
 * Ordningen är hela buggen. `disambiguateProjects` skriver om HELA namnet när två mappar
 * heter lika, så ett prefix som redan sitter på plats försvinner i omskrivningen — sju
 * Codex-plättar tappade sitt och såg ut som Roost-trådar i panelen. Prefixet läggs på efter.
 */
test('prefixet överlever särskiljningen bara om det läggs på efteråt', () => {
  const radar = [
    { harness: 'codex', harnessName: 'Codex', project: 'ti', projectPath: '/x/2026-09-09/ti' },
    { harness: 'codex', harnessName: 'Codex', project: 'ti', projectPath: '/x/2026-08-04/ti' },
  ]

  const ratt = disambiguateProjects(radar).map((t) => ({ ...t, project: plattnamn(t) }))
  assert.deepEqual(
    ratt.map((t) => t.project),
    ['Codex · 2026-09-09/ti', 'Codex · 2026-08-04/ti']
  )

  const fel = disambiguateProjects(radar.map((t) => ({ ...t, project: plattnamn(t) })))
  assert.deepEqual(
    fel.map((t) => t.project),
    ['2026-09-09/ti', '2026-08-04/ti'],
    'lagt först äts prefixet upp av särskiljningen — det är precis det som hände'
  )
})
