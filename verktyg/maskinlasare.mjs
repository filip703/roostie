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

/** Box & molns produktagenter. Allt annat är hemmets. */
const PRODUKT = new Set([
  'nexus-screentime',
  'nexus-blockdevices',
  'nexus-commands',
  'nexus-netflow',
  'nexus-dns',
  'nexus-identity',
  'nexus-fingerprint',
  'nexus-wifiwatch',
])

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
 * När skrev containern sist något i loggen? Det är den enda aktivitetssignal som går att få
 * ur docker utan att fråga någon annans databas — och den är trubbig: en agent som loggar
 * bara vid fel ser tyst ut fast den arbetar (containervakten har samma erfarenhet med
 * wifi-watch). Därför betyder tystnad i kolonin "på tomgång", aldrig "trasig".
 */
async function sistaLoggrad(namn) {
  try {
    const rad = avframa(await ra(`/containers/${encodeURIComponent(namn)}/logs?stdout=1&stderr=1&tail=1&timestamps=1`, true))
    const m = /(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/.exec(rad)
    const t = m ? Date.parse(m[1]) : NaN
    return Number.isNaN(t) ? 0 : t
  } catch {
    return 0
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
  const sistaLogg = status === 'ok' ? await sistaLoggrad(namn) : 0
  maskiner.push({ namn, status, detalj, sistaLogg, grupp: PRODUKT.has(namn) ? 'roost' : 'nexus' })
}

maskiner.sort((a, b) => a.namn.localeCompare(b.namn))

// Skriv via tempfil och byt namn: kolonin laser filen ofta och ska aldrig kunna fa halva.
const temp = `${UT}.${process.pid}.tmp`
fs.mkdirSync(path.dirname(UT), { recursive: true })
fs.writeFileSync(temp, JSON.stringify({ skriven: Date.now(), maskiner }, null, 1))
fs.renameSync(temp, UT)

const rakna = maskiner.reduce((o, m) => ((o[m.status] = (o[m.status] || 0) + 1), o), {})
console.log(`${new Date().toISOString()} ${maskiner.length} maskiner ${JSON.stringify(rakna)}`)
