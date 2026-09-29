/**
 * POST /api/svar — Filip skriver till en tråd från kolonin.
 *
 * Tar emot { trad, text } från webbläsaren, bygger raden och postar till
 * Loggboken med ROOST_ADMIN_TOKEN ur miljön. Token lämnar aldrig klienten.
 */

const TRADAR = {
  ledning: 'Ledning',
  produkt: 'Produkt',
  'box-moln': 'Box & moln',
  nexus: 'Nexus',
  design: 'Design',
  'sajt-roostadmin': 'Sajt & Roostadmin',
  kolonin: 'Kolonin',
  roadmap: 'Roadmap',
}

const RUBRIK_MAX = 160
const SVAR_MAX = 1200

function byggSvar(trad, text) {
  const namn = TRADAR[trad]
  if (!namn) return { ok: false, fel: `Okänd tråd: ${trad}` }
  const kropp = String(text || '').replace(/\s+/g, ' ').trim()
  if (!kropp) return { ok: false, fel: 'Skriv något först' }
  if (kropp.length > SVAR_MAX) return { ok: false, fel: `För långt — max ${SVAR_MAX} tecken` }

  const prefix = `TILL ${namn.toUpperCase()}: `
  const plats = RUBRIK_MAX - prefix.length
  let smak = kropp
  if (smak.length > plats) {
    smak = kropp.slice(0, plats - 1)
    const lucka = smak.lastIndexOf(' ')
    if (lucka > plats * 0.5) smak = smak.slice(0, lucka)
    smak += '…'
  }
  return { ok: true, rad: { trad: 'filip', fas: 'notis', rubrik: prefix + smak, text: kropp } }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const token = process.env.ROOST_ADMIN_TOKEN
  if (!token) return res.status(500).json({ error: 'ROOST_ADMIN_TOKEN saknas' })

  let body
  try {
    body = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}')
  } catch {
    return res.status(400).json({ ok: false, fel: 'Ogiltig JSON' })
  }

  const byggt = byggSvar(String(body?.trad || ''), String(body?.text || ''))
  if (!byggt.ok) return res.status(400).json(byggt)

  const url = `${process.env.ROOST_LOGGBOK_URL || 'https://roost.love/api/loggbok'}?token=${encodeURIComponent(token)}`
  try {
    const svar = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(byggt.rad),
      signal: AbortSignal.timeout(8000),
    })
    if (!svar.ok) return res.status(502).json({ ok: false, fel: `Loggboken svarade ${svar.status}` })
    const data = await svar.json().catch(() => null)
    if (!data?.ok) return res.status(502).json({ ok: false, fel: 'Loggboken tog inte emot raden' })
    return res.status(200).json({ ok: true, id: data.rad?.id || 0 })
  } catch (err) {
    return res.status(502).json({ ok: false, fel: String(err?.message || err) })
  }
}
