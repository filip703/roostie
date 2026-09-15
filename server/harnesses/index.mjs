/**
 * The harness registry.
 *
 * Adding support for another agent harness means writing one module next to this file and
 * adding it to the list below. Nothing else in the codebase needs to change — the scanner,
 * the API and the browser all talk to harnesses only through the interface documented in
 * `server/harnesses/README.md`.
 */
import claudeCode from './claude-code.mjs'
import codex from './codex.mjs'
import cursor from './cursor.mjs'
import roostLoggbok from './roost-loggbok.mjs'

/**
 * ROOSTIE_ONLY=1 stänger av de lokala harnessen och lämnar bara Roosts Loggbok kvar.
 * Det är läget på köksskärmen: containern på NUC:en har inga agentsessioner att visa,
 * och en tom harness som ändå skannar är bara brus.
 */
export const HARNESSES =
  process.env.ROOSTIE_ONLY === '1' ? [roostLoggbok] : [claudeCode, codex, cursor, roostLoggbok]

export const harnessById = (id) => HARNESSES.find((h) => h.id === id) || null

/**
 * Which harnesses have data on this machine. Detection is per-scan rather than cached at
 * boot so that installing one while the colony is running is picked up on the next poll.
 */
export async function detectedHarnesses() {
  const flags = await Promise.all(
    HARNESSES.map(async (h) => {
      try {
        return await h.detect()
      } catch {
        return false
      }
    })
  )
  return HARNESSES.filter((_, i) => flags[i])
}
