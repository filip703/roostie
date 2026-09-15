/**
 * Läsvägen in i Roosts data — `GET /api/roostie` på roost.love (Lednings beslut, rad 129).
 *
 * Kolonin har ingen databasnyckel och ska inte ha någon. Rutten körs server-side hos Roost med
 * servicenyckeln, filtrerad till Hectorsen, och lämnar ifrån sig tre saker och inget mer:
 * agenternas puls, kommandokön och barnens skärmtidsbudgetar. Inga id, inga MAC-adresser,
 * ingen fritext.
 *
 * Svarets form (Skatas exempel, rad 136):
 *   { puls: [{agent, status, sek_sedan, intervall_sek}],
 *     ko:   {pending, running, senaste:{command, at}},
 *     budgetar: [{namn, tak, intjanat, anvant, kvar}] }
 *
 * TVÅ SAKER SOM MÅSTE RESPEKTERAS, båda Skatas mätningar:
 *   · Andelen kvar räknas mot `tak + intjanat`, aldrig mot `tak` — ett barn som tjänat
 *     minuter på uppdrag har använt mer än taket utan att något är fel, och en stapel mot
 *     taket rinner över och ser ut som en bugg i skärmtiden.
 *   · `intervall_sek` avgör vad som är tyst. Doctor med 820 sekunder sedan är frisk
 *     (intervall 900); screentime med 820 hade varit död. Utan den siffran blir "tyst" en
 *     gissning, och en gissning på köksväggen är värre än ingenting.
 *
 * Rutten svarar 502 vid läsfel i stället för ett tomt men välformat svar, så ett fel här är
 * ett fel — inte en frisk tom koloni (LAXOR 2).
 */

const CACHE_MS = 15 * 1000
const TIMEOUT_MS = 8000
/** Hur många intervall en agent får tiga innan kolonin kallar den tyst. */
const TYSTNADSFAKTOR = 3

let cache = { at: 0, data: null, fel: '' }

const konfig = () => ({
  url: process.env.ROOST_ROOSTIE_URL || 'https://roost.love/api/roostie',
  token: process.env.ROOST_ADMIN_TOKEN || '',
  fil: process.env.ROOST_ROOSTIE_FIL || '',
})

/**
 * Barnens egna färger.
 *
 * Bill är blå och Tod är grön i Roost, och kolonin ska inte hitta på egna. Färgen hör hemma i
 * Roosts data — kommer den med i budgeten (`farg`) vinner den. Tills läsvägen bär den läses
 * `ROOSTIE_BARNFARGER` ur miljön: en JSON-karta namn→#rrggbb. Saknas båda får fyren använda
 * statusfärgen som förut, och då ljuger den inte — den säger bara mindre.
 */
const HEX = /^#[0-9a-f]{6}$/i
let barnfargerCache = null
function barnfarger() {
  if (barnfargerCache) return barnfargerCache
  barnfargerCache = new Map()
  try {
    const rad = JSON.parse(process.env.ROOSTIE_BARNFARGER || '{}')
    for (const [namn, hex] of Object.entries(rad)) {
      if (typeof hex === 'string' && HEX.test(hex.trim())) barnfargerCache.set(namn, hex.trim().toLowerCase())
    }
  } catch {
    // En trasig karta är ingen färg, och ingen färg är ett giltigt svar.
  }
  return barnfargerCache
}

const tal = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

async function hamta() {
  const { url, token, fil } = konfig()
  if (fil) {
    const fsp = await import('node:fs/promises')
    return JSON.parse(await fsp.readFile(fil, 'utf8'))
  }
  if (!url || !token) throw new Error('ROOST_ROOSTIE_URL eller ROOST_ADMIN_TOKEN saknas')
  const svar = await fetch(`${url}?token=${encodeURIComponent(token)}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!svar.ok) throw new Error(`/api/roostie svarade ${svar.status}`)
  return svar.json()
}

/**
 * @returns {Promise<{puls:object[], ko:object, budgetar:object[], fardig:boolean, fel:string}>}
 */
export async function laesRoostie() {
  if (Date.now() - cache.at < CACHE_MS) {
    return { ...tolka(cache.data), fardig: !cache.fel, fel: cache.fel }
  }
  try {
    const rad = await hamta()
    cache = { at: Date.now(), data: rad, fel: '' }
    return { ...tolka(rad), fardig: true, fel: '' }
  } catch (err) {
    const nar = new Date().toLocaleTimeString('sv-SE')
    cache = {
      at: Date.now(),
      data: cache.data,
      fel: `Roosts läsväg svarade inte ${nar}: ${err?.message || err}`,
    }
    // Senast kända läge får stå kvar, men inget räknas som färskt — kolonin slutar påstå
    // att agenter arbetar och att kön är tom.
    return { ...tolka(cache.data), fardig: false, fel: cache.fel }
  }
}

function tolka(rad) {
  const puls = (Array.isArray(rad?.puls) ? rad.puls : []).map((p) => {
    const sek = tal(p?.sek_sedan)
    const intervall = tal(p?.intervall_sek) || 60
    return {
      agent: String(p?.agent || '').slice(0, 40),
      status: String(p?.status || 'okand').slice(0, 20),
      sek_sedan: sek,
      intervall_sek: intervall,
      // Tystnad mäts mot agentens egen takt, inte mot en klocka vi hittat på.
      tyst: sek > intervall * TYSTNADSFAKTOR,
    }
  })

  const ko = {
    pending: tal(rad?.ko?.pending),
    running: tal(rad?.ko?.running),
    senaste: {
      command: String(rad?.ko?.senaste?.command || '').slice(0, 40),
      at: String(rad?.ko?.senaste?.at || ''),
    },
  }

  const budgetar = (Array.isArray(rad?.budgetar) ? rad.budgetar : []).map((b) => {
    const tak = tal(b?.tak)
    const intjanat = tal(b?.intjanat)
    const anvant = tal(b?.anvant)
    const kvar = tal(b?.kvar)
    const ram = tak + intjanat
    return {
      namn: String(b?.namn || '').slice(0, 24),
      tak,
      intjanat,
      anvant,
      kvar,
      // Andelen mot ram, aldrig mot tak. Se filhuvudet.
      andel: ram > 0 ? Math.max(0, Math.min(1, kvar / ram)) : 0,
      // Barnets egen färg när någon vet den: läsvägen först, miljön sedan, annars ingen.
      farg:
        typeof b?.farg === 'string' && HEX.test(b.farg.trim())
          ? b.farg.trim().toLowerCase()
          : barnfarger().get(String(b?.namn || '')) || null,
    }
  })

  return { puls, ko, budgetar }
}
