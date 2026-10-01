/** GET /api/ko?trad=X — trådens öppna rader (rad 1850). Sajts /api/ko är sanningen; här bara admin-grinden. */
function arAdmin(req, token) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)roost_admin_token=([^;]*)/)
  return Boolean(m && decodeURIComponent(m[1]) === token)
}

export default async function handler(req, res) {
  const token = process.env.ROOST_ADMIN_TOKEN
  if (!token) return res.status(500).json({ error: 'ROOST_ADMIN_TOKEN saknas' })
  if (!arAdmin(req, token) && req.query?.kiosk !== '1') return res.status(401).json({ error: 'Bara inloggad admin' })
  const trad = String(req.query?.trad || '')
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(trad)) return res.status(400).json({ error: 'trad saknas' })

  const url = `${process.env.ROOST_KO_URL || 'https://roost.love/api/ko'}?trad=${encodeURIComponent(trad)}&token=${encodeURIComponent(token)}`
  try {
    const svar = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!svar.ok) return res.status(502).json({ error: `Kön svarade ${svar.status}` })
    return res.status(200).json(await svar.json())
  } catch (err) {
    return res.status(502).json({ error: String(err?.message || err) })
  }
}
