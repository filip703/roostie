/**
 * RUNDTUREN I TRÄDET — köksskärmens kamerabana.
 *
 * Steg 5 av tavlans rad 224. Kolonins egen rundtur går mellan fem platser i en värld där
 * allt står på marken; trädet är en scen med en kamerabur, och där duger inte samma bana:
 *
 *   · Kolonins rundtur skickar bara `distance`. I buren avgör lutning och vinkel lika mycket
 *     som avståndet — utan dem hamnar kameran rätt långt bort och fel riktad.
 *   · Kolonins bansvep är avstängt i scenen (det svepte runt stammen och ut i tomheten), så
 *     utan något annat står bilden STILL mellan hållplatserna. En köksskärm som står still
 *     ser trasig ut.
 *   · Sju bon är fler hållplatser än kolonin har platser, och en bana som bara betar av dem
 *     tappar helheten. Därför kommer överblicken tillbaka varannan gång.
 *
 * Reglerna ligger här, utan three, för att de ska gå att prova: det är ordningen som avgör om
 * köksskärmen visar något man kan följa eller en slumpvandring.
 */

/** Hur ofta helheten kommer tillbaka. Varannan hållplats — man ska aldrig tappa trädet. */
const OVERSIKT_VAR = 2

/**
 * Ett varv runt trädet.
 *
 * @param utsikter    trädets fasta platser (`överblick` först, sedan barken/underifrån/kronan)
 * @param bon         ett per tråd, i tavlans ordning
 * @param senasteTrad trådnamnet eller id:t som sist skrev en rad på Loggboken, om något
 *
 * Den som senast skrev går FÖRST. Det är hela poängen med en skärm i ett kök: man tittar upp
 * och ser vem som just gjorde något, utan att behöva vänta ut ett helt varv. Resten av varvet
 * är sig likt, så banan går fortfarande att känna igen.
 */
export function rundtur(utsikter = [], bon = [], senasteTrad = null) {
  const lista = Array.isArray(utsikter) ? utsikter : []
  const oversikt = lista.find((u) => u && u.namn === 'överblick') || lista[0] || null
  const vinklar = lista.filter((u) => u && u !== oversikt)

  const kvar = [...(Array.isArray(bon) ? bon : [])]
  const nyckel = senasteTrad == null ? '' : String(senasteTrad).toLowerCase()
  // Den senaste tråden plockas ur ordningen och läggs först — den ska inte besökas två gånger.
  let forst = null
  if (nyckel) {
    const i = kvar.findIndex((b) => matchar(b, nyckel))
    if (i >= 0) forst = kvar.splice(i, 1)[0]
  }

  // Den senaste tråden ligger FÖRST i boordningen, inte bredvid den: annars blev det tre bon
  // i rad direkt efter starten, och regeln om att helheten kommer tillbaka varannan gång gick
  // sönder på precis den plats där den behövs mest.
  const ordning = forst ? [forst, ...kvar] : kvar
  const ut = []
  ordning.forEach((b, i) => {
    if (oversikt && i % OVERSIKT_VAR === 0) ut.push(oversikt)
    ut.push(b)
  })
  if (!ordning.length && oversikt) ut.push(oversikt)
  // Vinklarna en gång per varv, och helheten sist så varvet börjar och slutar på samma bild.
  ut.push(...vinklar)
  if (oversikt) ut.push(oversikt)

  // Ett tomt träd ger en tom bana, inte en bana till ingenting.
  return ut.filter(Boolean)
}

/**
 * Om ett bo hör till den tråden.
 *
 * Tavlan skriver trådens NYCKEL (`box-moln`), boet bär harnessens id
 * (`roost-loggbok:box-moln`) och trådens visningsnamn (`Box & moln`). Tre stavningar av samma
 * sak, och en exakt jämförelse mot en av dem missar de andra två — `box-moln` matchade varken
 * id:t eller namnet, så just den tråden hade hoppats över varje varv.
 */
export function matchar(bo, nyckel) {
  if (!bo || !nyckel) return false
  const n = String(nyckel).toLowerCase()
  const id = String(bo.id || '').toLowerCase()
  const namn = String(bo.namn || '').toLowerCase()
  return id === n || namn === n || id.endsWith(':' + n)
}

/**
 * Hur länge en hållplats står kvar, i sekunder.
 *
 * Överblicken får kortare tid än ett bo: helheten är läst på ett ögonkast, ett bo vill man se
 * arbeta en runda klart (sysslorna tar 2–11 sekunder).
 */
export function halltid(stopp) {
  return stopp && stopp.namn === 'överblick' ? 18 : 30
}
