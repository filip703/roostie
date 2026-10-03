/**
 * TAVELFLÖDET (rad 2362): en live-ticker längst ned i kolonin — senaste raderna från tavlan.
 * Bara ren logik här: vilka rader, vilken färg, vart ett klick leder. Ritandet är tavelflode-dom.js.
 */
import { CHATT } from './gorsjalv.js'
import { klarsprak } from './ko.js'

/** Maskinloggen ([mcp] verktyg · tråd · tid) är brus i ett flöde som ska läsas. */
const BRUS = /^\s*\[mcp\]/i

/** Färgklass per rad: TILL FILIP slår allt (röd), annars fasen. */
export const faerg = (r) => {
  if (/TILL FILIP/i.test(`${r?.rubrik || ''}`)) return 'filip'
  if (r?.fas === 'klart') return 'klart'
  if (r?.fas === 'stoppat') return 'stoppat'
  if (r?.fas === 'borjar') return 'borjar'
  return 'notis'
}

/** Senaste `antal` raderna, nyast först, utan [mcp]-loggen. Tål ett svar utan rader. */
export const flodesrader = (svar, antal = 20) =>
  (Array.isArray(svar?.rader) ? svar.rader : [])
    .filter((r) => r && !BRUS.test(String(r.rubrik || '')))
    .sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))
    .slice(0, antal)
    .map((r) => ({
      id: r.id,
      trad: r.trad || '',
      klass: faerg(r),
      rubrik: klarsprak(String(r.rubrik || '')),
      nar: Date.parse(r.created_at) || 0,
    }))

/** "HH:MM" lokal tid. */
export const klockslag = (nar) => {
  const d = new Date(nar)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Klick → raden i Roost (samma ?rad=N som ntfy-länkarna). */
export const radUrl = (r) => (Number.isInteger(r?.id) ? `${CHATT}?rad=${r.id}` : CHATT)
