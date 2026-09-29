/** GET /api/tavlan — senaste raderna från Roosts loggbok. */
export default async function handler(req, res) {
  const token = process.env.ROOST_ADMIN_TOKEN
  if (!token) return res.status(500).json({ error: 'ROOST_ADMIN_TOKEN saknas' })

  const antal = Number(req.query?.antal) || 40
  const url = `${process.env.ROOST_LOGGBOK_URL || 'https://roost.love/api/loggbok'}?token=${encodeURIComponent(token)}`
  try {
    const svar = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!svar.ok) return res.status(502).json({ error: `Loggboken svarade ${svar.status}` })
    const data = await svar.json()
    const rader = Array.isArray(data?.rader) ? data.rader.slice(0, antal) : []
    return res.status(200).json({ rader })
  } catch (err) {
    return res.status(502).json({ error: String(err?.message || err) })
  }
}
