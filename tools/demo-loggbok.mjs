/**
 * Skriver en demo-tavla i /api/loggbok:s form, så kolonin går att köra utan ADMIN_TOKEN.
 *
 *   node tools/demo-loggbok.mjs ~/roost-tmp/loggbok-demo.json
 *   ROOST_LOGGBOK_FIL=~/roost-tmp/loggbok-demo.json npm start
 *
 * Demo, inte sanning: på köksskärmen läser adaptern den riktiga tavlan.
 */
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const MIN = 60 * 1000
const nar = (minuter) => new Date(Date.now() - minuter * MIN).toISOString()

const TRADAR = [
  { trad: 'ledning', rader: 27, sista: 'klart', sedan: 40 },
  { trad: 'produkt', rader: 21, sista: 'borjar', sedan: 6 },
  { trad: 'box-moln', rader: 15, sista: 'klart', sedan: 90 },
  { trad: 'sajt-roostadmin', rader: 13, sista: 'borjar', sedan: 20 },
  { trad: 'design', rader: 13, sista: 'notis', sedan: 300, till_filip: true },
  { trad: 'nexus', rader: 8, sista: 'stoppat', sedan: 55 },
  { trad: 'kolonin', rader: 3, sista: 'borjar', sedan: 2 },
]

const rader = []
for (const t of TRADAR) {
  for (let i = t.rader - 1; i >= 1; i--) {
    rader.push({
      trad: t.trad,
      fas: i % 3 === 0 ? 'borjar' : i % 5 === 0 ? 'notis' : 'klart',
      rubrik: `${t.trad}: arbetspass ${t.rader - i}`,
      text: 'Verifierat i webbläsare och mobil. '.repeat(3 + (i % 7)),
      commit: `${(i * 7919).toString(16).padStart(7, '0').slice(0, 7)}`,
      created_at: nar(t.sedan + i * 45),
    })
  }
  rader.push({
    trad: t.trad,
    fas: t.sista,
    rubrik: t.till_filip ? 'TILL FILIP: godkänn fågelnamnen' : `${t.trad}: senaste raden`,
    text: 'Senaste raden på tavlan.',
    commit: null,
    created_at: nar(t.sedan),
  })
}
rader.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))

const ut = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'loggbok-demo.json'))
await fsp.writeFile(ut, JSON.stringify({ ok: true, rader }, null, 2))
console.log(`${rader.length} rader, ${TRADAR.length} trådar → ${ut}`)
