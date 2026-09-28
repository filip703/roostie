/**
 * Maskinparken — NUC:ens containrar som maskiner på kolonins mark.
 *
 * Servern mäter ingenting själv. En läsare utanför containern (`verktyg/maskinlasare.mjs`,
 * i värdens crontab) skriver en fil, och den här modulen läser den. Det är LAXOR 2: det som
 * rapporterar om maskinerna får inte dö med dem.
 *
 * Kolonin är ingen vakt. Containervakten på NUC:en är sanningen om larm; det här är en bild.
 * Därför gäller också LAXOR 23 åt andra hållet: kan filen inte läsas, eller är den gammal,
 * blir varje maskin `okand` — aldrig `ok`.
 *
 * Filens form: { skriven: <epoch ms>, maskiner: [ { namn, status, grupp, detalj } ] }
 *   status: ok | nere | fel | okand      grupp: roost | nexus
 *   logg: [ { t: <epoch ms>, rad: <maskad text> } ]  — nyast först, max tolv
 */
import fsp from 'node:fs/promises'

/** Äldre mätning än så här är inte en mätning längre. */
const FARSK_MS = 10 * 60 * 1000
const MAX = 80
/** Så många loggrader per maskin släpps vidare till bilden. Resten är dockers arkiv. */
const LOGG_MAX = 12
const NAMN_OK = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/
const STATUS = new Set(['ok', 'nere', 'fel', 'okand'])
const GRUPPER = new Set(['roost', 'nat', 'hem', 'data'])

export async function laesMaskiner() {
  const fil = process.env.ROOSTIE_MASKINER_FIL || ''
  if (!fil) return { maskiner: [], skriven: 0, fel: '' }

  let rad
  try {
    rad = JSON.parse(await fsp.readFile(fil, 'utf8'))
  } catch (err) {
    return { maskiner: [], skriven: 0, fel: `Maskinläsaren har inte skrivit något läsbart: ${err?.message || err}` }
  }

  const skriven = Number(rad?.skriven) || 0
  const gammal = !skriven || Date.now() - skriven > FARSK_MS
  const maskiner = []
  for (const m of Array.isArray(rad?.maskiner) ? rad.maskiner : []) {
    const namn = String(m?.namn || '')
    if (!NAMN_OK.test(namn)) continue
    const status = STATUS.has(m?.status) ? m.status : 'okand'
    maskiner.push({
      namn,
      // Gammal fil = vi vet inte. Att visa gårdagens gröna lampor är värre än att visa mörker.
      status: gammal ? 'okand' : status,
      grupp: GRUPPER.has(m?.grupp) ? m.grupp : 'hem',
      detalj: String(m?.detalj || '').slice(0, 120),
      // Sista loggraden = enda aktivitetssignalen. Gammal fil betyder att vi inte vet något
      // om arbetet heller, inte att maskinen står stilla.
      sistaLogg: gammal ? 0 : Number(m?.sistaLogg) || 0,
      /**
       * Loggraderna släpps igenom, men servern litar inte på filen: gammal fil ger ingen
       * logg alls (samma regel som statusen — att visa gårdagens rader som om de vore nu är
       * precis det LAXOR 23 förbjuder), och varje rad kapas här igen. Läsaren maskar redan
       * hemligheter; den här kapningen handlar om att en enda rad inte ska kunna spränga
       * panelen eller svaret.
       */
      logg: gammal
        ? []
        : (Array.isArray(m?.logg) ? m.logg : [])
            .slice(0, LOGG_MAX)
            .map((r) => ({ t: Number(r?.t) || 0, rad: String(r?.rad || '').slice(0, 200) }))
            .filter((r) => r.t && r.rad),
    })
    if (maskiner.length >= MAX) break
  }
  maskiner.sort((a, b) => (a.grupp === b.grupp ? a.namn.localeCompare(b.namn) : a.grupp < b.grupp ? -1 : 1))

  const fel = gammal && maskiner.length
    ? `Maskinparken har ingen färsk mätning${skriven ? ` sedan ${new Date(skriven).toLocaleString('sv-SE')}` : ''}`
    : ''
  return { maskiner, skriven, fel }
}
