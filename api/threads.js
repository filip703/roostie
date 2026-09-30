import roostLoggbok from '../server/harnesses/roost-loggbok.mjs'

/**
 * GET /api/threads — returnerar Roost Loggbok-trådarna som kolonin ritar på kartan.
 * Lokala Claude Code-sessioner finns inte i Vercel-miljön; loggboken är sanningen.
 */
export default async function handler(req, res) {
  try {
    const threads = await roostLoggbok.scanThreads()
    res.status(200).json({ threads, scannedAt: Date.now() })
  } catch (err) {
    res.status(200).json({ threads: [], scannedAt: Date.now(), warnings: [String(err?.message || err)] })
  }
}
