/** GET /api/puls — agenternas puls, kommandokön, barnens budgetar från roost.love/api/roostie. */
export default async function handler(req, res) {
  const token = process.env.ROOST_ADMIN_TOKEN
  if (!token) return res.status(500).json({ error: 'ROOST_ADMIN_TOKEN saknas' })

  const url = `${process.env.ROOST_ROOSTIE_URL || 'https://roost.love/api/roostie'}?token=${encodeURIComponent(token)}`
  try {
    const svar = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!svar.ok) return res.status(502).json({ error: `Roostie-rutten svarade ${svar.status}` })
    const data = await svar.json()
    return res.status(200).json(data)
  } catch (err) {
    return res.status(502).json({ error: String(err?.message || err) })
  }
}
