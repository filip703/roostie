/**
 * Agenttavlan — maskinparkens egen tavla.
 *
 * Trådarna har Loggboken. Agenterna har inget sådant: de skriver inga rader, de går eller går
 * inte. Den här skärmen står vid gården och säger vad var och en har för uppdrag, om den
 * arbetar just nu, och när den sist gjorde något — så att man kan läsa maskinparken utan att
 * gå fram till varje enskild maskin.
 *
 * Fyra spalter, en per gård, i gårdarnas egna färger. Stommen och rubrikraden kommer ur
 * skyltverket: tavlan ska läsas som Loggbokens syskon, inte som en annan produkt.
 */
import * as THREE from 'three'
import { CSS, TAL, rgba } from './palett.js'
import { MONO, SANS, byggDuk, byggPlank, bakgrund, huvud, regel, spartext, vridMot } from './skyltverk.js'
import { JOBB } from './maskinpark.js'

const BREDD = 18.5
const HOJD = 8
const BENHOJD = 3.8
const PIXLAR = 128

const FARG = {
  ok: CSS.gron,
  nere: CSS.dampad,
  fel: CSS.crit,
  okand: CSS.sage,
}
const AKTIV_MS = 5 * 60 * 1000

const klocka = (ms) => {
  const d = new Date(ms)
  return Number.isNaN(d.getTime())
    ? '--:--'
    : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const sedan = (ms) => {
  if (!ms) return ''
  const min = Math.round((Date.now() - ms) / 60000)
  if (min < 1) return 'nu'
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`
}

export class Agenttavla {
  /**
   * @param {{namn:string,farg:number}[]} falt  gårdarna, i samma ordning som i parken
   */
  constructor(scene, plats, falt) {
    this.scene = scene
    this.falt = falt
    this.grupp = new THREE.Group()
    this.grupp.position.set(plats.x, plats.y, plats.z)
    this.grupp.visible = false
    this.riktning = 0
    this.nyckel = ''

    const { mittY } = byggPlank(this.grupp, {
      bredd: BREDD,
      hojd: HOJD,
      benhojd: BENHOJD,
      accent: TAL.sage,
    })
    const duk = byggDuk(this.grupp, { bredd: BREDD, hojd: HOJD, pixlar: PIXLAR, mittY })
    this.duk = duk.duk
    this.textur = duk.textur

    scene.add(this.grupp)
  }

  set(maskiner) {
    const lista = Array.isArray(maskiner) ? maskiner : []
    const nyckel = lista.map((m) => `${m.namn}${m.status}${Math.round((m.sistaLogg || 0) / 60000)}`).join('|')
    if (nyckel === this.nyckel) return
    this.nyckel = nyckel
    this.grupp.visible = lista.length > 0
    if (lista.length) this.rita(lista)
  }

  rita(maskiner) {
    const c = this.duk.getContext('2d')
    const W = this.duk.width
    const H = this.duk.height
    const pad = 52
    const nu = Date.now()

    c.clearRect(0, 0, W, H)
    bakgrund(c, W, H)

    const arbetar = maskiner.filter((m) => m.status === 'ok' && m.sistaLogg && nu - m.sistaLogg < AKTIV_MS).length
    const tysta = maskiner.filter((m) => m.status === 'ok').length - arbetar
    const trasiga = maskiner.filter((m) => m.status === 'fel').length
    const nere = maskiner.filter((m) => m.status === 'nere').length

    const y0 = huvud(c, {
      W,
      pad,
      nummer: 'No. 02 · MASKINPARKEN',
      titel: 'Agenterna',
      under: `${maskiner.length} maskiner på fyra gårdar`,
      accent: CSS.sage,
      hoger: `${arbetar} ARBETAR`,
      hogerFarg: CSS.gron,
      skala: 0.88,
    })

    // Räkneverket som en rad siffror med etiketter under — editoriellt, inte som brickor.
    const rutor = [
      ['ARBETAR', arbetar, CSS.gron],
      ['TOMGÅNG', tysta, CSS.dampad],
      ['FEL', trasiga, trasiga ? CSS.crit : CSS.dampad],
      ['NERE', nere, nere ? CSS.dampad : CSS.dampad],
    ]
    rutor.forEach(([etikett, tal, farg], i) => {
      const x = pad + i * 150
      c.font = `400 48px ui-sans-serif, system-ui, sans-serif`
      c.fillStyle = farg
      c.fillText(String(tal), x, y0 - 8)
      c.font = `600 18px ${SANS}`
      c.fillStyle = rgba('cream', 0.35)
      spartext(c, etikett, x, y0 + 46, 4)
    })
    regel(c, pad, y0 + 82, W - pad * 2, 0.1)

    /**
     * En spalt per gård, plus en för vad som HÄNT.
     *
     * Maskinparken slutade skriva ut fyrtioen namn i luften — de var en vägg man ser i stället
     * för läser. Texten hör hemma här: en tavla är gjord för att läsas, en gård för att tittas
     * på. Den sista spalten är parkens flöde, senast först, så man kan stå framför tavlan och
     * följa vad agenterna gör utan att leta upp dem en och en.
     */
    const spalter = this.falt.length + 1
    const spaltBredd = (W - pad * 2) / spalter
    const topp = y0 + 108
    this.falt.forEach((f, i) => {
      const x = pad + i * spaltBredd
      const farg = `#${f.farg.toString(16).padStart(6, '0')}`
      const mina = maskiner.filter((m) => m.grupp === f.nyckel)

      // Gårdens färg som ett kort streck över spalten, som ett sektionsmärke.
      c.fillStyle = farg
      c.fillRect(x, topp, 46, 4)
      c.font = `600 20px ${SANS}`
      c.fillStyle = farg
      spartext(c, f.namn, x, topp + 18, 3)

      let y = topp + 58
      for (const m of mina) {
        if (y > H - pad - 24) break
        const aktiv = m.status === 'ok' && m.sistaLogg && nu - m.sistaLogg < AKTIV_MS
        const sfarg = FARG[m.status] || FARG.okand

        c.fillStyle = sfarg
        c.beginPath()
        c.arc(x + 6, y + 13, aktiv ? 6.5 : 4.5, 0, Math.PI * 2)
        c.fill()

        c.font = `500 24px ${SANS}`
        c.fillStyle = m.status === 'ok' ? CSS.cream : rgba('cream', 0.42)
        c.fillText(m.namn.replace(/^nexus-/, ''), x + 24, y)

        c.font = `400 21px ${SANS}`
        c.fillStyle = rgba('cream', 0.34)
        c.textAlign = 'right'
        c.fillText(m.status === 'ok' ? sedan(m.sistaLogg) : m.status === 'nere' ? 'nere' : 'fel', x + spaltBredd - 26, y + 3)
        c.textAlign = 'left'

        y += 37
      }
    })

    this._flode(c, pad + this.falt.length * spaltBredd, topp, spaltBredd, maskiner, H, pad)

    c.font = `500 20px ${SANS}`
    c.fillStyle = rgba('cream', 0.3)
    spartext(c, 'NUC · DOCKER', pad, H - pad + 8, 4)

    this.textur.needsUpdate = true
  }

  /** Parkens flöde: vad agenterna gjort, senast först. Det är här namnen hör hemma. */
  _flode(c, x, topp, bredd, maskiner, H, pad) {
    c.fillStyle = CSS.cream
    c.fillRect(x, topp, 46, 4)
    c.font = `600 20px ${SANS}`
    c.fillStyle = rgba('cream', 0.6)
    spartext(c, 'SENAST I PARKEN', x, topp + 18, 3)

    const senaste = maskiner
      .filter((m) => m.sistaLogg > 0)
      .sort((a, b) => b.sistaLogg - a.sistaLogg)
      .slice(0, 11)

    if (!senaste.length) {
      c.font = `400 22px ${SANS}`
      c.fillStyle = rgba('cream', 0.35)
      c.fillText('Ingen har loggat något.', x, topp + 58)
      return
    }

    let y = topp + 58
    for (const m of senaste) {
      if (y > H - pad - 24) break
      const kort = m.namn.replace(/^nexus-/, '')
      c.font = `500 20px ${MONO}`
      c.fillStyle = rgba('cream', 0.4)
      c.fillText(klocka(m.sistaLogg), x, y + 2)

      c.font = `500 22px ${SANS}`
      c.fillStyle = m.status === 'ok' ? CSS.cream : rgba('cream', 0.4)
      c.fillText(kort, x + 86, y)

      const jobb = JOBB[m.namn]
      if (jobb) {
        c.font = `400 19px ${SANS}`
        c.fillStyle = rgba('cream', 0.34)
        c.fillText(jobb, x + 86, y + 25)
        y += 50
      } else {
        y += 34
      }
    }
  }

  update(dt, camera) {
    if (!this.grupp.visible) return
    this.riktning = vridMot(this.grupp, camera, this.riktning, dt)
  }

  dispose() {
    this.scene.remove(this.grupp)
    this.grupp.traverse((o) => {
      o.geometry?.dispose()
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
      else o.material?.dispose()
    })
    this.textur.dispose()
  }
}
