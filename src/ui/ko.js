/**
 * Kön per agent (rad 1850). Sajts /api/ko räknar öppna rader — här bara hur svaret blir text.
 * Ingen egen räkning: finns inget svar visar kortet ingenting hellre än en gissad siffra.
 */
const PRIO = /^P([0-3])\b/i

export const prioAv = (r) => {
  const p = r?.prio ?? r?.prioritet
  if (Number.isInteger(p)) return Math.min(3, Math.max(0, p))
  const m = PRIO.exec(String(p ?? r?.rubrik ?? '').trim())
  return m ? Number(m[1]) : 2
}

export const klarsprak = (rubrik) =>
  String(rubrik || '')
    .replace(/^\s*P[0-3]\s+/i, '')
    .replace(/^\s*(\[auto\]\s*)?(TILL [A-ZÅÄÖ& +]+:\s*)/, '')
    .replace(/^\s*Rad \d+( \w+)?:\s*/i, '')
    .trim()

export const alderText = (r, nu = Date.now()) => {
  const t = Date.parse(r?.created_at || r?.skapad || r?.nar || '')
  const min = Number.isFinite(t) ? Math.max(0, Math.round((nu - t) / 60000)) : Number(r?.alder_min)
  if (!Number.isFinite(min)) return ''
  if (min < 60) return `${min} min`
  if (min < 2880) return `${Math.round(min / 60)} tim`
  return `${Math.round(min / 1440)} dygn`
}

/** Sorterad kö: P0 först, äldst först inom samma prioritet. */
const tidAv = (r) => {
  const t = Date.parse(r?.created_at || r?.skapad || '')
  return Number.isFinite(t) ? t : Date.now() - (Number(r?.alder_min) || 0) * 60000
}

export const sortera = (rader) =>
  [...(Array.isArray(rader) ? rader : [])].sort((a, b) => prioAv(a) - prioAv(b) || tidAv(a) - tidAv(b))

export const koRad = (r, nu = Date.now(), langd = 60) => {
  const text = klarsprak(r.rubrik)
  const kort = text.length > langd ? `${text.slice(0, langd - 1).trimEnd()}…` : text
  return { prio: `P${prioAv(r)}`, text: kort, alder: alderText(r, nu) }
}

/** null = inget svar (ingen siffra visas); annars {antal, topp, alla}. */
export const koSammanfattning = (svar, nu = Date.now()) => {
  if (!svar || !Array.isArray(svar.rader)) return null
  const alla = sortera(svar.rader).map((r) => koRad(r, nu))
  const antal = Number.isInteger(svar.antal) ? svar.antal : alla.length
  return { antal, topp: alla.slice(0, 3), alla }
}
