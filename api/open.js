/**
 * POST /api/open — öppna en tråd i IDE.
 * Vercel kan inte öppna lokala program; returnerar ett förklarande fel.
 */
export default function handler(req, res) {
  res.status(400).json({ ok: false, error: 'Kolonin körs utanför hemmet — kan inte öppna lokala program.' })
}
