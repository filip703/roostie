/**
 * TRÄDETS LIV — agenterna och kommandokön, översatta till ett träd.
 *
 * Steg 3 av tavlans rad 224. I kolonin är agenterna fyrtioen maskiner på fyra gårdar; i
 * trädet finns ingen gård och ingen maskin. Bilden rad 224 gav är den rätta: agenterna ÄR
 * trädets liv. Saven, löven, bären och ekorren.
 *
 * Reglerna ligger här, utan three, av samma skäl som sysslorna och rundturen: det är de som
 * avgör om trädet säger sanning, och de ska gå att prova utan en webbläsare.
 *
 * DEN GENOMGÅENDE REGELN ÄR LAXOR 23: en vakt som inte kan mäta får inte rapportera grönt.
 * `maskiner.json` äldre än tio minuter gör varje agent `okand`, och en okänd agent får inte
 * fälla ett löv, tända ett bär eller lugna en vind. Tystnad ritas som tystnad, aldrig som
 * hälsa och aldrig som larm.
 */

/** Hur många löv som mest faller på en gång. Fler än så läses som väder, inte som händelser. */
const LOV_MAX = 6
/** Hur många bär kronan rymmer innan de bara blir en röd fläck. */
const BAR_MAX = 8

/**
 * Lägena maskinläsaren faktiskt skriver är `ok | nere | fel | okand` (server/maskiner.mjs).
 * `arbetar` finns inte där — det är maskinparkens egen slutsats ur pulsen. Att skriva regler
 * mot ett läge som aldrig förekommer är ett tyst fel: allt hade sett lugnt ut för alltid, och
 * ingenting hade avslöjat varför.
 */
const LEVER = new Set(['ok'])
/** Hur färskt ett loggavtryck ska vara för att räknas som "agenten gjorde nyss något". */
const AKTIV_MS = 2 * 60 * 1000

/**
 * Löv som faller.
 *
 * Ett löv per agent som GICK NER sedan förra hämtningen — inte per agent som ÄR nere. En
 * skillnad, inte ett tillstånd: annars regnar det löv i evighet så länge en container ligger,
 * och ett trasigt träd säger inte längre vilken minut något gick sönder.
 *
 * Första hämtningen ger noll. Vi vet inte vad som hänt före den och ska inte låtsas.
 */
export function fallandeLov(forra, nu) {
  if (!Array.isArray(forra) || !Array.isArray(nu) || !forra.length) return 0
  const fore = new Map(forra.map((m) => [String(m?.namn || ''), String(m?.status || '')]))
  let antal = 0
  for (const m of nu) {
    const namn = String(m?.namn || '')
    const nyStatus = String(m?.status || '')
    const gammal = fore.get(namn)
    // Okänd i endera änden räknas inte: att inte veta är inte att ha gått ner.
    if (!gammal || gammal === 'okand' || nyStatus === 'okand') continue
    if (LEVER.has(gammal) && !LEVER.has(nyStatus)) antal += 1
  }
  return Math.min(LOV_MAX, antal)
}

/**
 * Röda bär i kronan — en per agent som står i fel just nu.
 *
 * Det här ÄR ett tillstånd och ska vara det: ett fel som ingen åtgärdat ska synas hela tiden,
 * inte bara i den minut det uppstod. Okända räknas inte — kolonin larmar inte (ROOSTIE.md),
 * containervakten är sanningen om larm.
 */
export function bar(maskiner) {
  if (!Array.isArray(maskiner)) return 0
  return Math.min(BAR_MAX, maskiner.filter((m) => String(m?.status || '') === 'fel').length)
}

/**
 * Vindens styrka ur hur många agenter som nyss gjorde något.
 *
 * Kronan andas alltid — en stilla krona ser ut som en trasig sida. Det som varierar är hur
 * mycket. Utan färsk data ligger den på sitt lugnaste läge och rör sig ändå, för tystnad från
 * maskinläsaren säger ingenting om vinden.
 */
export function vind(maskiner, nu = Date.now()) {
  if (!Array.isArray(maskiner) || !maskiner.length) return 0.35
  const kanda = maskiner.filter((m) => String(m?.status || '') !== 'okand')
  if (!kanda.length) return 0.35
  // Aktivitet är ett FÄRSKT loggavtryck, samma mått som maskinparkens blixt. En agent som
  // bara loggar vid fel ser tyst ut — det är trubbigt med flit, och tystnad blir lugn vind
  // i stället för stiltje.
  const aktiva = kanda.filter((m) => {
    const logg = Number(m?.sistaLogg) || 0
    return logg > 0 && nu - logg < AKTIV_MS
  }).length
  return 0.35 + Math.min(1, aktiva / Math.max(4, kanda.length * 0.4)) * 0.5
}

/**
 * Ekorrens fart ur kommandokön.
 *
 * Samma regel som rovern i kolonin, och samma ärlighet: att ekorren springer betyder att
 * KÖN har något i sig, inte att något är fel. Tom kö = den sitter still på en gren och äter.
 * Utan läsväg (`fardig` falskt) sitter den också still — en ekorre som springer utan att
 * veta varför är en lögn i rörelse.
 */
export function ekorrfart(ko, fardig = true) {
  if (!fardig || !ko) return 0
  const i = Math.max(0, Number(ko.pending) || 0) + Math.max(0, Number(ko.running) || 0)
  if (!i) return 0
  return Math.min(1, 0.4 + i * 0.2)
}

/** Ekorrens läge i ord, för diagnosen. Tre lägen, tre ord. */
export function ekorrord(ko, fardig = true) {
  if (!fardig) return 'okänd'
  return ekorrfart(ko, fardig) > 0 ? 'springer' : 'sitter'
}
