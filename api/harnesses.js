/**
 * GET /api/harnesses — lokala harness-statusar (Claude Code etc.).
 * Vercel har inga lokala harnesses; returnerar tom lista.
 */
export default function handler(req, res) {
  res.status(200).json({ harnesses: [] })
}
