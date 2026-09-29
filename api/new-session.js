/**
 * POST /api/new-session — starta ny IDE-session.
 * Vercel kan inte starta lokala processer; returnerar ett förklarande fel.
 */
export default function handler(req, res) {
  res.status(400).json({ ok: false, error: 'Kolonin körs utanför hemmet — kan inte starta lokala sessioner.' })
}
