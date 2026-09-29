/**
 * FLÖDET: från tavlans rader till något en människa kan läsa.
 *
 * Filip 29 sep: "det är lite svårt att förstå chatten och tidslinjen när jag läser
 * historiken." Han har rätt, och det är fyra fel som ligger ovanpå varandra:
 *
 *   1. RADERNA ÄR INTE REPLIKER. En tråd skriver "Tar rad 1442: …" och sju minuter senare
 *      "Rad 1445: … klart". Det är EN sak som hänt, inte två repliker, och läst som en chatt
 *      ser det ut som att tråden säger samma sak två gånger.
 *   2. KLOCKAN UTAN DAG. Listan gick 07:38, 07:36, 19:22 — den tredje var i går, och
 *      ingenting sa det. En tidslinje som hoppar över ett dygn utan att säga till är ingen
 *      tidslinje.
 *   3. RADNUMRET FÖRST. Varje rad började med "Rad 1445:" — det första ögat träffar är en
 *      siffra som betyder något för oss och ingenting för honom. (Roost-projektets egen
 *      preferens: länkar och klarspråk i stället för radnummer.)
 *   4. INGEN RIKTNING. Nyast först eller sist? Utan svar ser varje lista huggen ut.
 *
 * Reglerna här är rena funktioner just för att de ska gå att prova utan webbläsare. Det som
 * ritas är hud.js sak; det som BETYDER något står här.
 */

/** Rader som bara är städning — de säger ingenting om arbetet och skräpar ner ett samtal. */
const TYST = /^(?:[a-zåäö-]+-passet: (?:inget att ta|kön tom)|\[auto\])/i

/**
 * Tar bort radnumret ur början av en rubrik, men bara där det ÄR ett prefix.
 * "Rad 1445: Display 2.0 steg 1" → "Display 2.0 steg 1"
 * "Tar rad 1442: modulregistret"  → "modulregistret"
 * "Rad 1259 väntar på Filip"      → orört, för där bär numret meningen.
 */
export function utanRadnummer(rubrik) {
  const r = String(rubrik || '').trim()
  const m = /^(?:tar\s+)?rad\s+(\d+)\s*[:–—-]\s*(.+)$/i.exec(r)
  if (!m) return { text: r, rad: 0 }
  return { text: m[2].trim(), rad: Number(m[1]) }
}

/**
 * Slår ihop "börjar" med sitt "klart" till EN händelse.
 *
 * Ett pass är ett arbete, inte två meddelanden. Rubriken tas från avslutet när det finns —
 * den säger vad som blev gjort, medan öppningen bara säger vad tråden tänkte göra.
 * Ett börjar som ingen stängt blir `pagar`; det är sant och det är hela poängen med att
 * kunna se att någon håller på just nu.
 */
export function slaIhopPass(rader) {
  const kvar = []
  const oppna = []
  for (const r of [...rader].sort((a, b) => a.nar - b.nar)) {
    if (r.fas === 'borjar') {
      const h = { start: r.nar, nar: r.nar, fas: 'pagar', rubrik: r.rubrik, text: r.text, slut: 0 }
      oppna.push(h)
      kvar.push(h)
      continue
    }
    if (r.fas === 'klart' || r.fas === 'stoppat') {
      const h = oppna.shift()
      if (h) {
        h.fas = r.fas
        h.slut = r.nar
        h.nar = r.nar
        h.rubrik = r.rubrik || h.rubrik
        h.text = r.text || h.text
        continue
      }
    }
    kvar.push({ start: r.nar, nar: r.nar, slut: 0, fas: r.fas, rubrik: r.rubrik, text: r.text })
  }
  return kvar.sort((a, b) => a.nar - b.nar)
}

/** "7 min", "2 h 10 min", eller tomt när något inte är avslutat. */
export function langd(start, slut) {
  if (!start || !slut || slut <= start) return ''
  const min = Math.round((slut - start) / 60000)
  if (min < 1) return 'under en minut'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rest = min % 60
  return rest ? `${h} h ${rest} min` : `${h} h`
}

/**
 * Dagsetikett över en grupp repliker. "I dag" och "I går" är det enda folk faktiskt räknar i;
 * längre bak vill man ha veckodag och datum, för "för fyra dagar sedan" kräver huvudräkning.
 */
export function dagnamn(nar, nu = Date.now()) {
  const d = new Date(nar)
  const i = new Date(nu)
  const dygn = (a) => Math.floor((a - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 1)
  void dygn
  const datum = (a) => `${a.getFullYear()}-${a.getMonth()}-${a.getDate()}`
  if (datum(d) === datum(i)) return 'I dag'
  const igar = new Date(nu - 86400000)
  if (datum(d) === datum(igar)) return 'I går'
  const veckodag = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'][d.getDay()]
  const manad = ['jan', 'feb', 'mars', 'april', 'maj', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec'][d.getMonth()]
  return `${veckodag} ${d.getDate()} ${manad}`
}

/**
 * Hela flödet: trådens händelser och Filips svar i en ström, med dagsavdelare emellan.
 * Äldst överst — man läser nedåt mot nuet, och skrivfältet ligger under det senaste.
 */
export function byggFlode(historik, franFilip, nu = Date.now()) {
  const trad = slaIhopPass(
    (historik || []).filter((h) => !TYST.test(String(h.rubrik || '')))
  ).map((h) => ({ ...h, min: false }))
  const mina = (franFilip || []).map((m) => ({
    nar: m.nar,
    start: m.nar,
    slut: 0,
    fas: 'svar',
    rubrik: '',
    text: m.text || m.rubrik || '',
    min: true,
  }))
  const allt = [...trad, ...mina].sort((a, b) => a.nar - b.nar)

  const ut = []
  let dag = ''
  for (const h of allt) {
    const namn = dagnamn(h.nar, nu)
    if (namn !== dag) {
      dag = namn
      ut.push({ avdelare: namn })
    }
    const { text, rad } = utanRadnummer(h.rubrik)
    ut.push({ ...h, rubrik: text, radnummer: rad, langd: langd(h.start, h.slut) })
  }
  return ut
}
