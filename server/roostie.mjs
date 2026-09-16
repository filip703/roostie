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
 * Barnens egna färger — numera bara från läsvägen.
 *
 * Bill är blå och Tod är grön i Roost (Filips ord 15 september). Kolonin hittade aldrig på
 * en färg, men den bar en KOPIA i `ROOSTIE_BARNFARGER` så länge `/api/roostie` inte hade
 * fältet. Kopian är borta sedan 16 september: Sajt läser `nx_profiles.color` (rad 320),
 * Produkt har skrivit blått och grönt (rad 324), och jag mätte svaret själv innan jag tog
 * bort miljöraden — `#4e7f8a` och `#7fa07f`, exakt de beslutade värdena.
 *
 * Kopian NEDPRIORITERADES inte, den TOGS BORT. En stale kopia som kan vinna igen är precis
 * det fel som gjorde Bill rostfärgad i några timmar dagen innan: läsvägen började bära ett
 * `farg` som ingen kontrollerat, och rangordningen avgjorde tyst vilken av två sanningar
 * köksskärmen visade. Två källor till samma fakta är en källa för mycket.
 *
 * Saknas fältet får fyren och holken statusfärgen som förut. Då ljuger de inte — de säger
 * bara mindre.
 */
const HEX = /^#[0-9a-f]{6}$/i

const tal = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
/**
 * Samma som `tal()`, men behåller frånvaron. Ett fält som inte finns blir `null` och inte
 * noll — se `fjadrar` längre ned för varför den skillnaden är hela poängen.
 */
const heltal = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

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
      // Barnets egen färg, enbart ur läsvägen. Se filhuvudet.
      farg: typeof b?.farg === 'string' && HEX.test(b.farg.trim()) ? b.farg.trim().toLowerCase() : null,
      /**
       * Fjädrarna — Boet 2.0:s räknare, per barn.
       *
       * FÄLTET FINNS INTE I `/api/roostie` ÄNNU. Begäran till Sajt ligger på tavlan; det här
       * är läsvägen som väntar på den, så att dagen siffran kommer är det data som börjar
       * komma och inte kod som ska skrivas. Tills dess är `fjadrar` null i varje rad, och
       * holken ritar tre kvistar på pinnen.
       *
       * NULL OCH NOLL ÄR INTE SAMMA SAK, och därför går den här inte genom `tal()` som gör
       * allt till ett tal. Noll fjädrar betyder att barnet inte tjänat någon än — ett
       * mätvärde, och sant. Null betyder att ingen har mätt. Ritade vi dem lika skulle
       * köksskärmen påstå något den inte vet, och det är samma fel som en grön vakt utan
       * mätning (LAXA 23).
       */
      fjadrar: heltal(b?.fjadrar),
      // Nivån direkt, om Sajt hellre skickar den färdiga än råtalet. Råtalet vinner.
      boniva: heltal(b?.boniva),
    }
  })

  return { puls, ko, budgetar }
}
