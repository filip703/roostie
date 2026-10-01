/**
 * SKYLTEN ÖVER ASTRONAUTEN (rad 1814, texterna ur docs/design/kolonin-copy.md §4).
 *
 * Tre till fem ord om vad tråden gör just nu, ur tavlans senaste Börjar/Klart. En blick på
 * kolonin ska räcka: "Väntar på dig" är den enda skylten som får dra blicken.
 *
 * Rena funktioner, så texterna går att prova utan webbläsare. Placeringen på skärmen är
 * skyltlager.js sak.
 */
import { utanRadnummer } from './flode.js'

export const MAX_TECKEN = 28
/** Hur länge "Klart: …" står kvar efter att tråden blivit färdig. */
export const KLART_MS = 2 * 60 * 60 * 1000

/** Kortar med … efter MAX_TECKEN tecken, på ordgräns om det går. */
export function korta(text, max = MAX_TECKEN) {
  const t = String(text || '').trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  const klipp = t.slice(0, max - 1)
  const sista = klipp.lastIndexOf(' ')
  return `${(sista > max * 0.5 ? klipp.slice(0, sista) : klipp).replace(/[\s,.:;—–-]+$/, '')}…`
}

/** "Rad 1814: skylt över varje astronaut + …" → "skylt över varje astronaut". Ämnet, inte hela rubriken. */
export function amne(rubrik) {
  // Börjar-rader heter "Rad N: Tar rad N — ämne": numret ska bort två gånger.
  const { text } = utanRadnummer(utanRadnummer(rubrik).text)
  const utanAvslut = text
    .replace(/^(?:klart|stoppat|börjar)\s*[:–—-]\s*/i, '')
    .replace(/\s*[—–:(+].*$/, '')
    .trim()
  const s = utanAvslut || text
  return s.charAt(0).toLowerCase() + s.slice(1)
}

const stor = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/**
 * @param thread  trådposten från skannern (historik nyast först, nar i ms)
 * @param status  statusFor(thread)
 * @returns { text, vantar } — text är skylten, vantar = den gula, understrukna
 */
export function skyltFor(thread, status, nu = Date.now(), { pausad = false, vilarTill = '' } = {}) {
  if (pausad) return { text: 'Pausad', vantar: false }
  if (status === 'waiting') return { text: 'Väntar på dig', vantar: true }
  const hist = Array.isArray(thread?.historik) ? thread.historik : []
  const senaste = hist.find((h) => h.fas !== 'notis') || null
  const rubrik = senaste ? amne(senaste.rubrik) : ''
  if (status === 'blocked') {
    const orsak = rubrik ? ` — ${rubrik}` : ''
    return { text: korta(`Har stannat${orsak}`), vantar: false }
  }
  if (status === 'working') return { text: korta(rubrik ? `Bygger ${rubrik}` : 'Jobbar'), vantar: false }
  if (senaste?.fas === 'klart' && nu - senaste.nar < KLART_MS && rubrik) {
    return { text: korta(`Klart: ${rubrik}`), vantar: false }
  }
  if (status === 'sleeping') return { text: vilarTill ? `Sover till ${vilarTill}` : 'Sover', vantar: false }
  if (status === 'spawning') return { text: 'Startar', vantar: false }
  if (status === 'leaving') return { text: 'Går hem', vantar: false }
  return { text: stor('vilar'), vantar: false }
}

/** Grupperna på plattan (rad 1814 p.2). Ledning står i mitten, utan eget ankare. */
export const GRUPPER = [
  { namn: 'Produkten', medlemmar: ['Appen', 'Produkt', 'Design', 'Kolonin'] },
  { namn: 'Driften', medlemmar: ['Boxen och nätet', 'Box & moln', 'Huset', 'Nexus'] },
  { namn: 'Affären', medlemmar: ['Sajten', 'Sajt & Roostadmin', 'Roadmap'] },
]

export function gruppFor(titel) {
  const g = GRUPPER.find((x) => x.medlemmar.includes(titel))
  return g ? g.namn : null
}
