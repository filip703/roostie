/**
 * POST /api/reveal — öppna mapp i Finder/Explorer.
 * Vercel kan inte öppna lokala mappar; returnerar ett förklarande fel.
 */
export default function handler(req, res) {
  res.status(400).json({ ok: false, error: 'Kolonin körs utanför hemmet — kan inte öppna lokala mappar.' })
}
