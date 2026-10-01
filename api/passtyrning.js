/** POST /api/passtyrning — {trad, typ, varde}: Filips knappar på plättarna (rad 1882). Bara admin. */
const TYPER = ['starta', 'pausa', 'aterupptag', 'budget', 'nattlage']

function arAdmin(req, token) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)roost_admin_token=([^;]*)/)
  return Boolean(m && decodeURIComponent(m[1]) === token)
}

export default async function handler(req, res) {
  const token = process.env.ROOST_ADMIN_TOKEN
  if (!token) return res.status(500).json({ error: 'ROOST_ADMIN_TOKEN saknas' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' })
  if (!arAdmin(req, token)) return res.status(401).json({ error: 'Bara inloggad admin kan styra passen' })

  const { trad, typ, varde } = req.body || {}
  if (!TYPER.includes(typ)) return res.status(400).json({ error: `typ måste vara ${TYPER.join('|')}` })
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(String(trad || ''))) return res.status(400).json({ error: 'trad saknas' })

  const url = `${process.env.ROOST_PASS_URL || 'https://roost.love/api/pass'}?token=${encodeURIComponent(token)}`
  try {
    const svar = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trad, typ, varde: varde == null ? null : String(varde) }),
      signal: AbortSignal.timeout(8000),
    })
    const data = await svar.json().catch(() => ({}))
    return res.status(svar.ok ? 200 : 502).json(svar.ok ? { ok: true } : { error: data.error || `Passrutten svarade ${svar.status}` })
  } catch (err) {
    return res.status(502).json({ error: String(err?.message || err) })
  }
}
