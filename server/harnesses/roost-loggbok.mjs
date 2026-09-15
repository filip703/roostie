/**
 * Harness-adapter: Roosts Loggbok.
 *
 * Trådarna i Roost är inte processer på den här maskinen — de är samtal i claude.ai som
 * skriver Börjar/Klart på en gemensam tavla (`nx_loggbok`, läst genom `/api/loggbok`).
 * Adaptern gör om tavlan till astronauter: en tråd = en astronaut, ett repo = en zon.
 *
 * Sanningen är tavlan. Skriver en tråd inte Börjar så hamrar ingen — det är avsiktligt,
 * inte en bugg. Kolonin visar arbetet som trådarna själva rapporterar det.
 *
 * Läs-bara. Adaptern skriver aldrig till Loggboken; POST är trådarnas eget jobb.
 *
 * Miljö (inga fallbacks — LAXOR 7: saknas nyckeln ska allt neka, inte gissa):
 *   ROOST_LOGGBOK_URL   t.ex. https://roost.love/api/loggbok
 *   ROOST_ADMIN_TOKEN   samma token som trådarna postar med
 *   ROOST_LOGGBOK_FIL   alternativ källa för utveckling/test: en JSON-fil i API:ts form
 *   ROOST_REPO_DIR      var repona ligger på den här maskinen (default ~/Developer)
 *   ROOSTIE_PROJEKT_URL projektet i claude.ai som Open faller tillbaka på
 *   ROOSTIE_CHATTAR     JSON {"trad":"https://claude.ai/cowork/…"} — en chatt per tråd
 *
 * Chattadresserna står i miljön och aldrig i koden: repot är publikt, och adresserna är
 * Filips egna. Byter en tråd samtal räcker det att ändra raden i miljöfilen.
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const ID = (trad) => `roost-loggbok:${trad}`

/** Hur länge ett obesvarat "börjar" får räknas som pågående arbete. */
const ARBETSFONSTER_MS = 2 * 60 * 60 * 1000
/** Tavlan pollas inte hårdare än så här, oavsett hur ofta kolonin frågar. */
const CACHE_MS = 20 * 1000
const HAMTA_TIMEOUT_MS = 8000

/** Trådar vi känner till: visningsnamn och vilken mark de bygger på. */
const TRADAR = {
  ledning: { namn: 'Ledning', zon: 'landningsplattan', repo: '' },
  produkt: { namn: 'Produkt', zon: 'nexus', repo: 'nexus' },
  'box-moln': { namn: 'Box & moln', zon: 'nexus', repo: 'nexus' },
  nexus: { namn: 'Nexus', zon: 'nexus', repo: 'nexus' },
  design: { namn: 'Design', zon: 'nexus', repo: 'nexus' },
  'sajt-roostadmin': { namn: 'Sajt & Roostadmin', zon: 'roost-site', repo: 'roost-site' },
  kolonin: { namn: 'Kolonin', zon: 'roostie', repo: 'roostie' },
}

/** Trådnamn som får bli en astronaut. Allt annat avvisas innan det når en URL eller en sökväg. */
const TRAD_OK = /^[a-z0-9][a-z0-9-]{0,39}$/

const konfig = () => ({
  url: process.env.ROOST_LOGGBOK_URL || '',
  token: process.env.ROOST_ADMIN_TOKEN || '',
  fil: process.env.ROOST_LOGGBOK_FIL || '',
  repoDir: process.env.ROOST_REPO_DIR || path.join(os.homedir(), 'Developer'),
  projektUrl: process.env.ROOSTIE_PROJEKT_URL || 'https://claude.ai/project/01a094e3-d923-77e2-8ccf-35805cbdceb0',
})

/**
 * PostgREST skickar `2026-09-15T07:01:00.497815+00:00`, men samma kolumn kan komma med
 * mellanslag och kort offset ur andra vägar. Normalisera båda formerna innan Date.parse.
 */
function tid(varde) {
  if (!varde) return 0
  const s = String(varde).replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}

const text = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max)

/**
 * Vem en notis är ställd till.
 *
 * Trådarna skriver sina förfrågningar i tre former: "TILL FILIP: …", "TILL NEXUS: …" och
 * rapportformatets "Säg till Produkt att …" / "Be Box & moln kolla …". Alla tre är samma
 * sak — någon väntar på någon — och kolonin ska kunna visa dem utan att man öppnar chatten.
 *
 * Hittas ingen mottagare är raden ett meddelande till alla, inte en förfrågan.
 */
function mottagare(rubrik) {
  const r = String(rubrik || '')
  const till = /^\s*TILL\s+([^:–—-]{1,28})\s*[:–—-]/i.exec(r)
  if (till) return till[1].trim().toUpperCase()
  const sag = /\b(?:säg till|be)\s+([A-Za-zÅÄÖåäö&\s-]{2,24}?)\s+(?:att|kolla|ta|höra|bygga|svara|besluta)/i.exec(r)
  if (sag) return sag[1].trim().toUpperCase()
  return ''
}

/**
 * Trådens eget samtal i claude.ai, ur ROOSTIE_CHATTAR. Bara https till claude.ai släpps
 * igenom — adressen kommer ur miljön, men den hamnar i en länk som öppnas med ett klick,
 * och en länk man inte läst innan man klickar ska inte kunna peka vart som helst.
 */
function chattUrl(trad) {
  const { projektUrl } = konfig()
  let karta = {}
  try {
    karta = JSON.parse(process.env.ROOSTIE_CHATTAR || '{}')
  } catch {
    karta = {}
  }
  const rak = karta && typeof karta === 'object' ? karta[trad] : ''
  try {
    const u = new URL(String(rak || ''))
    if (u.protocol === 'https:' && (u.hostname === 'claude.ai' || u.hostname.endsWith('.claude.ai'))) return u.href
  } catch {
    /* ingen eller trasig adress — projektet får duga */
  }
  return projektUrl
}

/**
 * Senast kända läge. En tavla som inte svarar ska inte få kolonin att tömmas — men den ska
 * heller inte få den att se pigg ut: `fel` går upp som varning i HUD:en (harnessStatus läser
 * `diagnostic`), och ingen astronaut hamrar på gammal information (LAXOR 2 och 23 — "vet ej"
 * är aldrig "ok").
 */
let cache = { at: 0, rader: null, fel: '' }

async function hamtaRader() {
  const { url, token, fil } = konfig()
  if (fil) {
    const rad = JSON.parse(await fsp.readFile(fil, 'utf8'))
    return Array.isArray(rad) ? rad : rad?.rader || []
  }
  if (!url || !token) throw new Error('ROOST_LOGGBOK_URL och ROOST_ADMIN_TOKEN saknas')
  const svar = await fetch(`${url}?token=${encodeURIComponent(token)}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(HAMTA_TIMEOUT_MS),
  })
  if (!svar.ok) throw new Error(`Loggboken svarade ${svar.status}`)
  const data = await svar.json()
  if (!data || data.ok !== true || !Array.isArray(data.rader)) throw new Error('Loggboken svarade i okänd form')
  return data.rader
}

/** @returns {{rader: any[]|null, fardig: boolean}} fardig=false betyder "det här är gammalt". */
async function tavlan() {
  if (Date.now() - cache.at < CACHE_MS) return { rader: cache.rader, fardig: !cache.fel }
  try {
    const rader = await hamtaRader()
    cache = { at: Date.now(), rader, fel: '' }
    return { rader, fardig: true }
  } catch (err) {
    const nar = new Date().toLocaleTimeString('sv-SE')
    cache = {
      at: Date.now(),
      rader: cache.rader,
      fel: `Loggboken kunde inte läsas ${nar}: ${err?.message || err}${cache.rader ? ' — visar senast kända läge' : ''}`,
    }
    return { rader: cache.rader, fardig: false }
  }
}

/** Sökvägen till repot, om det finns på den här maskinen. Annars tomt — en död sökväg är värre. */
const sokvagCache = new Map()
async function repoSokvag(repo) {
  if (!repo) return ''
  const dir = path.join(konfig().repoDir, repo)
  if (sokvagCache.has(dir)) return sokvagCache.get(dir)
  const finns = await fsp
    .stat(dir)
    .then((s) => s.isDirectory())
    .catch(() => false)
  const ut = finns ? dir : ''
  sokvagCache.set(dir, ut)
  return ut
}

async function scanThreads() {
  const { rader, fardig } = await tavlan()
  if (!rader) return []

  /** En hink per tråd, i tidsordning. */
  const hinkar = new Map()
  for (const rad of rader) {
    const trad = String(rad?.trad || '').trim().toLowerCase()
    if (!TRAD_OK.test(trad)) continue
    if (!hinkar.has(trad)) hinkar.set(trad, [])
    hinkar.get(trad).push({
      fas: String(rad.fas || ''),
      rubrik: String(rad.rubrik || ''),
      text: String(rad.text || ''),
      commit: String(rad.commit || ''),
      nar: tid(rad.created_at),
    })
  }

  const nu = Date.now()
  const tradar = []
  for (const [trad, allt] of hinkar) {
    const r = allt.filter((x) => x.nar > 0).sort((a, b) => a.nar - b.nar)
    if (!r.length) continue
    const senaste = r[r.length - 1]
    const info = TRADAR[trad] || { namn: trad, zon: 'landningsplattan', repo: '' }

    // Hamrar bara på ett färskt "börjar" som ingen "klart" stängt. En tråd som glömt skriva
    // klart ska sluta hamra av sig själv, annars ljuger kolonin i en vecka.
    const pagar = fardig && senaste.fas === 'borjar' && nu - senaste.nar < ARBETSFONSTER_MS

    // "TILL FILIP" i en notisrubrik är tavlans sätt att vinka. Kolonin håller upp ett ? tills
    // du klickat Viewed; skriver tråden något nytt vinkar den igen. Den nyaste rubriken följer
    // med som `notis` — det är den som hamnar på anslagstavlan vid landningsplattan.
    const tillFilip = r.filter((x) => x.fas === 'notis' && /TILL FILIP/i.test(x.rubrik))
    const vinkar = tillFilip.length > 0
    const sista = tillFilip[tillFilip.length - 1]

    // Allt tråden bett någon om, inte bara Filip — det är det som gör tavlan läsbar utifrån.
    const vantar = r
      .filter((x) => x.fas === 'notis' && mottagare(x.rubrik))
      .slice(-5)
      .reverse()
      .map((x) => ({ till: mottagare(x.rubrik), rubrik: text(x.rubrik, 160), text: text(x.text, 300), nar: x.nar }))

    const projectPath = await repoSokvag(info.repo)
    tradar.push({
      id: ID(trad),
      title: info.namn,
      // Håller tråden upp handen är det frågan som ska stå på kortet, inte det senaste den
      // gjorde: ett `?` man måste öppna chatten för att förstå är bara en prick.
      preview: vinkar ? text(`${sista.rubrik} — ${sista.text}`, 240) : text(senaste.rubrik, 240),
      project: info.zon,
      projectPath,
      worktree: '',
      cwd: projectPath,
      gitBranch: projectPath ? 'main' : '',
      model: senaste.commit ? senaste.commit.slice(0, 7) : '',
      effort: `${r.length} rader`,
      createdAt: r[0].nar,
      lastActivityAt: senaste.nar,
      // Tavlan vet inte när du tittade — kolonin gör det själv (Viewed-knappen).
      lastFocusedAt: 0,
      running: pagar,
      unread: vinkar,
      notis: vinkar ? text(sista.rubrik, 160) : '',
      notisText: vinkar ? text(sista.text, 400) : '',
      vantar,
      hasError: senaste.fas === 'stoppat',
      starred: false,
      routine: '',
      prState: '',
      archived: false,
      // Byggnadens storlek = hur mycket tråden skrivit på tavlan. Klart-rader är de långa,
      // så bygget växer mest när något blir färdigt.
      sizeBytes: r.reduce((n, x) => n + x.rubrik.length + x.text.length, 0),
      hasTranscript: true,
      source: 'loggbok',
      canOpen: true,
      // Kolonin öppnar chatten i webbläsaren själv. Servern kan inte göra det åt den:
      // containern på NUC:en har ingen xdg-open, och skärmen står i köket, inte i serverrummet.
      openUrl: chattUrl(trad),
      ref: { trad },
    })
  }
  return tradar
}

/**
 * Kvar för den maskin som kör kolonin lokalt och har en webbläsare på samma dator — då
 * öppnar servern chatten som vanligt. På köksskärmen går vägen genom `openUrl` i stället.
 */
function openThread(ref) {
  const trad = String(ref?.trad || '')
  if (!TRAD_OK.test(trad)) return { ok: false, error: 'Okänd tråd' }
  return { ok: true, url: chattUrl(trad) }
}

function newSession() {
  return { ok: false, error: 'Roost-trådar startas i claude.ai, inte i kolonin' }
}

/** Adaptern finns när den har en källa. Ingen källa = ingen astronaut, ingen gissning. */
async function detect() {
  const { url, token, fil } = konfig()
  return Boolean(fil || (url && token))
}

/** Syns i HUD:en när tavlan går att nå men inte att läsa. */
async function diagnostic() {
  return cache.fel || ''
}

/**
 * De senaste raderna på tavlan, trimmade — kolonins billboard läser dem.
 *
 * Samma cache som skanningen, så billboarden kostar inget extra anrop mot Loggboken.
 */
export async function senasteRader(antal = 40) {
  const { rader, fardig } = await tavlan()
  if (!rader) return { rader: [], vantar: [], fel: cache.fel }
  const alla = rader
    .map((r) => ({
      trad: String(r?.trad || '').trim().toLowerCase(),
      fas: String(r?.fas || ''),
      rubrik: text(r?.rubrik, 180),
      text: text(r?.text, 240),
      nar: tid(r?.created_at),
    }))
    .filter((r) => r.nar > 0 && TRAD_OK.test(r.trad))
    .sort((a, b) => b.nar - a.nar)

  /**
   * Allt som väntar på någon — inte bara på Filip.
   *
   * En notis med en mottagare är en fråga som ligger kvar tills den som fick den skriver
   * något efteråt. Det är trubbigt och det är med flit: tavlan har ingen "besvarad"-kolumn,
   * så kolonin visar frågan tills mottagaren rört sig, och låter människan avgöra resten.
   */
  const rort = new Map()
  for (const r of alla) if (!rort.has(r.trad)) rort.set(r.trad, r.nar)
  const vantar = []
  for (const r of alla) {
    const till = mottagare(r.rubrik)
    if (r.fas !== 'notis' || !till) continue
    const nyckel = till.toLowerCase().replace(/\s+/g, '-').replace('&', '')
    const svarat = [...rort.entries()].some(([t, nar]) => nyckel.startsWith(t.slice(0, 5)) && nar > r.nar)
    vantar.push({ fran: r.trad, till, rubrik: r.rubrik, text: r.text, nar: r.nar, svarat })
  }

  return { rader: alla.slice(0, Math.max(1, Math.min(60, antal))), vantar: vantar.slice(0, 12), fel: fardig ? '' : cache.fel }
}

/** Bara för testerna: tvinga en ny läsning vid nästa skanning, men behåll senast kända läge. */
function _nollstallCache() {
  cache = { ...cache, at: 0 }
}

export default {
  id: 'roost-loggbok',
  name: 'Roost Loggbok',
  detect,
  scanThreads,
  openThread,
  newSession,
  diagnostic,
  TRADAR,
  _nollstallCache,
}
