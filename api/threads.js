/**
 * GET /api/threads — kolonin.roost.love kör på Vercel, inte på NUC:en.
 * Lokala trådar (Claude Code-sessioner) finns inte i en serverless-miljö.
 * Returnerar en tom lista så kolonikartan ritas men förblir tom utanför hemmet.
 */
export default function handler(req, res) {
  res.status(200).json({ threads: [], scannedAt: Date.now(), warnings: ['Kolonin körs utanför hemmet — lokala trådar visas inte.'] })
}
