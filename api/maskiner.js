/**
 * GET /api/maskiner — NUC-containerdata.
 * Vercel når inte NUC:en; returnerar tom lista.
 */
export default function handler(req, res) {
  res.status(200).json({ containrar: [], at: 0 })
}
