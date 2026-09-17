/**
 * Vad en fågel HÅLLER PÅ MED — reglerna, utan en enda rad three.
 *
 * Det här är svaret på Filips invändning den 15 september: "de ska även jobba och se ut att
 * vara busy". Den gamla tabellen (`fagellage`) hade ett vilotillstånd som hette `sitter`, och
 * `sitter` var den vanligaste av dem alla. En fågel som sitter still är inte en fågel, det är
 * en dekoration — och sju dekorationer i ett träd säger ingenting om Roost.
 *
 * Så vilan är borta. Varje tråd har en SYSSLA, och varje syssla är en rörelse med en början
 * och ett slut som går att se på håll. Det som avgör vilken syssla det blir är data, inte
 * humör:
 *
 *   larmar   fas stoppat            vingarna ut på bokanten, lyktan röd
 *   ruvar    väntar på Filip        ligger lågt på boet och vänder något som glimmar
 *   sjunger  notis eller oläst      på grentoppen, sångringar ut i luften
 *   matar    rörde sig senaste 45m  hämtar mat i grönskan, ungarna gapar
 *   bygger   rörde sig i dag        hämtar pinnar, boet växer av dem
 *   pysslar  rörde sig i dygnet     hoppar längs grenen, putsar, vänder på kvistar
 *   sover    tystare än så          hopkurad i boet, långsam andning
 *
 * RUVAR är den som bär Roost-tänket. En tråd med något på tavlan riktat till Filip kan inte
 * kläcka det själv — den ligger kvar på det tills han kommer. Filips egen bild var skatan som
 * ruvar på en diamantklocka, och det är precis vad det är: en skatt tråden vaktar åt någon
 * annan. Antalet glimtar är antalet rader som väntar, så man ser skillnad på en tråd som
 * väntar på ett svar och en som väntar på fem.
 */

/** Gränserna mellan sysslorna, i millisekunder. Ett dygn är den yttersta. */
export const MATAR_MS = 90 * 60 * 1000
export const BYGGER_MS = 6 * 60 * 60 * 1000
export const PYSSLAR_MS = 24 * 60 * 60 * 1000

/** Hur många rader i dygnet som går på en unge, och hur många ungar ett bo rymmer. */
const RADER_PER_UNGE = 12
const UNGAR_MAX = 3

/**
 * Hur många ungar tråden har att mata.
 *
 * Trådens dagsverke, inget annat: rader på Loggboken det senaste dygnet delat på tolv. Det är
 * en översättning, inte en mätning av något som finns — och den står här, öppet, i stället för
 * att gömmas i en animation där ingen kan granska den.
 */
export function ungar(rader) {
  const n = Number.isFinite(rader) ? Math.max(0, rader) : 0
  return Math.max(0, Math.min(UNGAR_MAX, Math.round(n / RADER_PER_UNGE)))
}

/** Hur många rader som väntar på Filip. Det är glimtarna i boet när fågeln ruvar. */
export function skatter(trad) {
  const v = trad?.vantar
  return Array.isArray(v) ? v.length : Number(v) > 0 ? Number(v) : 0
}

/**
 * Trådens syssla just nu.
 *
 * ORDNINGEN ÄR RÄTTAD, och rättelsen är värd att skriva ner: först stod `ruvar` över allt
 * arbete, och när scenen kördes mot riktig data satt sex av sju fåglar still — varenda tråd
 * på Loggboken hade något ställt till Filip. Trädet blev lika dött som det Filip pausade,
 * fast av en regel i stället för av en animation.
 *
 * Felet var att lägga TVÅ saker på fågeln. Nu bär BOET det som väntar på Filip — skatten
 * ligger där och glimtar oavsett vad fågeln gör — och FÅGELN bär bara arbetet. `ruvar` är
 * kvar, men bara för en tråd som inte har något annat för sig: då lägger hon sig på skatten,
 * och det betyder "jag har inget kvar att göra förrän du svarar".
 */
export function syssla(trad, nu = Date.now()) {
  if (!trad) return 'sover'
  if (trad.hasError) return 'larmar'
  if (trad.notis || trad.unread) return 'sjunger'
  if (trad.archived) return 'sover'
  // Pågående pass syns direkt — fågeln hamrar innan BÖRJAR-raden hinner postas.
  if (trad.running) return 'hamrar'

  const sist = Number(trad.sist) || 0
  if (!sist) return skatter(trad) > 0 ? 'ruvar' : 'sover'

  const sedan = Math.max(0, nu - sist)
  if (sedan < MATAR_MS) return ungar(trad.rader) > 0 ? 'matar' : 'bygger'
  if (sedan < BYGGER_MS) return 'bygger'
  if (skatter(trad) > 0) return 'ruvar'
  if (sedan < PYSSLAR_MS) return 'pysslar'
  return 'sover'
}

/** Sysslan i ord, för panelen. Samma ord som kommentaren ovan — en sanning, två ställen. */
export const SYSSLA_ORD = {
  larmar: 'larmar',
  hamrar: 'kör ett pass',
  ruvar: 'ruvar på ditt svar',
  sjunger: 'sjunger',
  matar: 'matar ungarna',
  bygger: 'bygger på boet',
  pysslar: 'pysslar på grenen',
  sover: 'sover',
}

/** Hur ofta en syssla gör om sin rörelse, i sekunder. Kort loop = tråden ser jäktad ut. */
export const SYSSLA_TAKT = {
  larmar: 2.2,
  hamrar: 2.4,
  ruvar: 7.5,
  sjunger: 5.5,
  matar: 6.5,
  bygger: 9,
  pysslar: 5,
  sover: 11,
}

/** Sysslor där fågeln lämnar boet och hämtar något. De andra utspelar sig på boet. */
export const HAMTAR = new Set(['matar', 'bygger', 'pysslar'])

/** Hur stort ett bo ska vara av det tråden skrivit. Aldrig mindre än ett bo, aldrig ett berg. */
export function bostorlek(rader) {
  const n = Number.isFinite(rader) ? Math.max(0, rader) : 0
  return Math.min(1.5, 0.82 + n * 0.04)
}
