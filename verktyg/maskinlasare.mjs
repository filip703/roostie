/**
 * Maskinläsaren — skriver NUC:ens containerläge till en fil som kolonin ritar.
 *
 * Körs UTANFÖR kolonins container, ur värdens crontab (LAXOR 2: det som rapporterar om
 * maskinerna får inte dö med dem, och webbservern på köksskärmen ska aldrig ha docker-socketen):
 *
 *   * * * * * docker run --rm --name nexus-maskinlasare \
 *       -v /var/run/docker.sock:/var/run/docker.sock \
 *       -v /home/nexus/roostie-data:/data \
 *       -v /home/nexus/roostie/verktyg:/verktyg:ro \
 *       node:22-alpine node /verktyg/maskinlasare.mjs >> /home/nexus/maskinlasare.log 2>&1
 *
 * DEN HÄR LARMAR INTE. Containervakten på NUC:en är sanningen om larm och har den riktiga
 * bevisningen per agent (tabellrad, puls, logg). Kolonin ritar bara en bild: går containern
 * eller inte. En container som kör men inte gör något syns här som "ok" — det är vaktens
 * jobb att säga annat. Den dagen containervakten skriver den här filen själv kan den här
 * läsaren pensioneras.
 *
 * Pratar med /var/run/docker.sock direkt över HTTP, som containervakt.mjs, i stället för att
 * förutsätta en docker-CLI i imagen.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock'
const UT = process.env.ROOSTIE_MASKINER_FIL || '/data/maskiner.json'

/**
 * Vilket lag en agent hör till.
 *
 * Fyrtio maskiner i en enda hög säger ingenting. Agenterna har olika uppdrag och olika ägare,
 * och det är den gränsen kolonin ska visa: Roosts produktagenter (Box & molns), hemmets nät,
 * hemmets hus, och det som mäter och minns. Okänt namn hamnar i "hemmet" — aldrig i Roost,
 * för en främmande container ska inte se ut som en produktagent.
 */
const LAG = {
  roost: [
    'nexus-screentime',
    'nexus-blockdevices',
    'nexus-commands',
    'nexus-netflow',
    'nexus-dns',
    'nexus-identity',
    'nexus-fingerprint',
    'nexus-wifiwatch',
    'nexus-blocksync',
    'nexus-roost-allow',
    'nexus-skyddsvakt',
  ],
  nat: [
    'nexus-switch',
    'nexus-unleashed',
    'nexus-probes',
    'nexus-dhcp',
    'nexus-cloudflare',
    'nexus-tunnel',
    'nexus-guestnet',
    'gastnat-watcher',
    'adguard',
    'nexus-configbak',
    'nexus-portal',
    'nexus-fast',
  ],
  hem: [
    'homeassistant',
    'nexus-habridge',
    'nexus-camera',
    'eufy-security-ws',
    'music-assistant',
    'nexus-sirisync',
    'nexus-familjestund',
    'nexus-stunder',
    'nexus-skola',
  ],
  data: [
    'nexus-telemetry',
    'nexus-brain',
    'nexus-insights',
    'nexus-rollup',
    'nexus-habits',
    'nexus-ai',
    'nexus-ollama',
    'nexus-doctor',
    'uptime-kuma',
  ],
}
const GRUPP = new Map()
for (const [lag, namn] of Object.entries(LAG)) for (const n of namn) GRUPP.set(n, lag)

/** Ritas inte: kolonins egen container och rena verktyg. */
const HOPPA_OVER = new Set(['nexus-roostie', 'nexus-maskinlasare', 'nexus-containervakt', 'portainer'])

function ra(vag, binart = false) {
  return new Promise((klar, fel) => {
    const req = http.request({ socketPath: SOCKET, path: vag, method: 'GET' }, (res) => {
      const bitar = []
      res.on('data', (d) => bitar.push(d))
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return fel(new Error(`docker ${vag} → ${res.statusCode}`))
        const buf = Buffer.concat(bitar)
        klar(binart ? buf : buf.toString('utf8'))
      })
    })
    req.on('error', fel)
    req.setTimeout(8000, () => req.destroy(new Error('docker svarade inte inom 8 s')))
    req.end()
  })
}

const docker = async (vag) => JSON.parse(await ra(vag))

/**
 * Docker multiplexar loggströmmen med åtta byte ramhuvud per rad (och skickar rå text när
 * containern kör med TTY). Båda formerna måste hanteras, annars blir tidsstämpeln skräp.
 */
function avframa(buf) {
  if (buf.length > 8 && buf[0] <= 2 && buf[1] === 0 && buf[2] === 0 && buf[3] === 0) {
    const ut = []
    let i = 0
    while (i + 8 <= buf.length) {
      const langd = buf.readUInt32BE(i + 4)
      ut.push(buf.subarray(i + 8, i + 8 + langd).toString('utf8'))
      i += 8 + langd
    }
    return ut.join('')
  }
  return buf.toString('utf8')
}

/**
 * Vad har containern skrivit senast? Det är den enda aktivitetssignal som går att få ur
 * docker utan att fråga någon annans databas — och den är trubbig: en agent som loggar bara
 * vid fel ser tyst ut fast den arbetar (containervakten har samma erfarenhet med wifi-watch).
 * Därför betyder tystnad i kolonin "på tomgång", aldrig "trasig".
 *
 * TEXTEN SPARAS NU, INTE BARA KLOCKAN. Filip 28 sep: han vill kunna läsa vad en robot skrivit
 * tidigare, inte bara se att den skrev något. Tolv rader räcker för att förstå vad en agent
 * håller på med; fler gör filen till ett arkiv, och arkivet är dockers, inte kolonins.
 *
 * MASKNINGEN ÄR INTE VALFRI. Containerloggar innehåller ibland nycklar, tokens och adresser,
 * och det här går från dockersocketen ut på en webbsida på hemnätet. Maskningen är
 * best-effort och inget skydd att lita på: den täcker de former vi själva använder
 * (roost-<hex>, Bearer, token=, key=, långa hex/base64-klumpar). En logg som läcker något
 * annat läcker det fortfarande. Läs LAXOR 7 som "hemligheter hör inte hemma i en vy heller".
 */
const HEMLIGT = [
  [/\broost-[0-9a-f]{16,}/gi, 'roost-***'],
  [/\b(bearer)\s+\S+/gi, '$1 ***'],
  [/\b(token|key|secret|password|passwd|pass|apikey|api_key|authorization)\b(\s*[=:]\s*)\S+/gi, '$1$2***'],
  [/\b[0-9a-f]{32,}\b/gi, '***'],
  [/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, '***'],
]

function maska(rad) {
  let ut = rad
  for (const [re, med] of HEMLIGT) ut = ut.replace(re, med)
  return ut
}

const LOGGRADER = 12

async function loggen(namn) {
  try {
    const rat = avframa(
      await ra(`/containers/${encodeURIComponent(namn)}/logs?stdout=1&stderr=1&tail=${LOGGRADER}&timestamps=1`, true)
    )
    const rader = []
    for (const r of rat.split('\n')) {
      const m = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s?([\s\S]*)$/.exec(r.trim())
      if (!m) continue
      const t = Date.parse(m[1])
      if (Number.isNaN(t)) continue
      const text = maska(m[2]).replace(/\s+/g, ' ').trim().slice(0, 200)
      if (text) rader.push({ t, rad: text })
    }
    // Nyast först: en panelrad som fälls ut ska börja med det som gäller nu.
    rader.reverse()
    return { sista: rader.length ? rader[0].t : 0, logg: rader.slice(0, LOGGRADER) }
  } catch {
    return { sista: 0, logg: [] }
  }
}

/**
 * Ett läge per container. Tre utfall, och inget av dem gissar:
 *   ok   — kör och startar inte om
 *   fel  — startar om i loop, eller har dött med en felkod
 *   nere — stoppad
 */
function las(c) {
  const s = c.State || {}
  if (s.Restarting) return { status: 'fel', detalj: `startar om (${c.RestartCount || 0} ganger)` }
  if (s.Running) {
    const halsa = s.Health?.Status
    if (halsa && halsa !== 'healthy') return { status: 'fel', detalj: `healthcheck: ${halsa}` }
    return { status: 'ok', detalj: `uppe sedan ${String(s.StartedAt || '').slice(0, 16).replace('T', ' ')}` }
  }
  const kod = Number(s.ExitCode || 0)
  return kod ? { status: 'fel', detalj: `avslutade med kod ${kod}` } : { status: 'nere', detalj: 'stoppad' }
}

const lista = await docker('/containers/json?all=1')
const maskiner = []
for (const rad of lista) {
  const namn = String(rad.Names?.[0] || '').replace(/^\//, '')
  if (!namn || HOPPA_OVER.has(namn)) continue
  let detaljer
  try {
    detaljer = await docker(`/containers/${encodeURIComponent(namn)}/json`)
  } catch {
    // Forsvann mellan listningen och uppslaget. Att hoppa over den ar ratt: den finns inte.
    continue
  }
  const { status, detalj } = las(detaljer)
  const { sista: sistaLogg, logg } = status === 'ok' ? await loggen(namn) : { sista: 0, logg: [] }
  maskiner.push({ namn, status, detalj, sistaLogg, logg, grupp: GRUPP.get(namn) || 'hem' })
}

maskiner.sort((a, b) => a.namn.localeCompare(b.namn))

// Skriv via tempfil och byt namn: kolonin laser filen ofta och ska aldrig kunna fa halva.
const temp = `${UT}.${process.pid}.tmp`
fs.mkdirSync(path.dirname(UT), { recursive: true })
fs.writeFileSync(temp, JSON.stringify({ skriven: Date.now(), maskiner }, null, 1))
fs.renameSync(temp, UT)

const rakna = maskiner.reduce((o, m) => ((o[m.status] = (o[m.status] || 0) + 1), o), {})
console.log(`${new Date().toISOString()} ${maskiner.length} maskiner ${JSON.stringify(rakna)}`)
