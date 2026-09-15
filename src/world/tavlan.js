/**
 * Tavlan — Loggboken som en billboard i kolonin.
 *
 * Roosts trådar skriver Börjar och Klart på en gemensam tavla. Astronauterna visar *att*
 * något händer; det här visar *vad*, och *vem som väntar på vem*.
 *
 * Skärmen har två spalter. Till vänster flödet: klockslag, tråd, fas och rubrik, som bläddrar
 * genom hela tavlan några rader i taget så att inget blir osynligt bara för att det är en
 * timme gammalt. Till höger allt som väntar på någon — varje notis som är ställd till en
 * mottagare, med vem den kom ifrån och vem den ligger hos.
 *
 * Stommen och typografin kommer ur skyltverket, som alla skyltar i kolonin: samma ram, samma
 * rubrikrad, samma tunna linjer. Skillnaden mellan tavlorna ska vara vad de säger, inte hur
 * de är byggda.
 */
import * as THREE from 'three'
import { CSS, FAS, TAL, rgba } from './palett.js'
import { MONO, SANS, SERIF, byggDuk, byggPlank, bakgrund, bryt, huvud, regel, spartext, vridMot } from './skyltverk.js'

const BREDD = 18
const HOJD = 10
const BENHOJD = 4.6
const PIXLAR = 128 // texlar per världsenhet → 2304 x 1280
const PER_SIDA = 6
const SIDTID = 9 // sekunder per sida

const FASFARG = FAS
const FASNAMN = {
  borjar: 'BÖRJAR',
  klart: 'KLART',
  stoppat: 'STOPPAT',
  notis: 'NOTIS',
}

const klocka = (ms) => {
  const d = new Date(ms)
  return Number.isNaN(d.getTime())
    ? '--:--'
    : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export class Tavlan {
  constructor(scene, plats) {
    this.scene = scene
    this.grupp = new THREE.Group()
    this.grupp.position.set(plats.x, plats.y, plats.z)
    this.grupp.visible = false
    this.riktning = 0
    this.sida = 0
    this.sidklocka = 0
    this.rader = []
    this.vantar = []

    const { mittY, stal } = byggPlank(this.grupp, {
      bredd: BREDD,
      hojd: HOJD,
      benhojd: BENHOJD,
      accent: TAL.clay,
    })
    const duk = byggDuk(this.grupp, { bredd: BREDD, hojd: HOJD, pixlar: PIXLAR, mittY })
    this.duk = duk.duk
    this.textur = duk.textur

    // Två strålkastare på överkanten, ren rekvisita — de lyser inte, de ser ut att göra det.
    const lampMat = new THREE.MeshStandardMaterial({
      color: TAL.cream,
      emissive: TAL.honey,
      emissiveIntensity: 0.55,
      roughness: 0.5,
    })
    for (const dx of [-BREDD / 4, BREDD / 4]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.1), stal)
      arm.position.set(dx, mittY + HOJD / 2 + 0.5, 0.45)
      arm.rotation.x = -0.35
      this.grupp.add(arm)
      const lampa = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.9, 8), lampMat)
      lampa.position.set(dx, mittY + HOJD / 2 + 0.62, 0.92)
      lampa.rotation.x = Math.PI / 2 - 0.55
      this.grupp.add(lampa)
    }

    scene.add(this.grupp)
    this.nyckel = ''
  }

  /**
   * @param {{rader:{trad,fas,rubrik,text,nar}[], vantar:{fran,till,rubrik,text,nar,svarat}[]}} data
   */
  set(data) {
    const rader = Array.isArray(data?.rader) ? data.rader : []
    const vantar = Array.isArray(data?.vantar) ? data.vantar : []
    const nyckel = `${rader.length}:${rader[0]?.nar || 0}:${vantar.length}:${vantar[0]?.nar || 0}`
    if (nyckel === this.nyckel) return
    this.nyckel = nyckel
    this.rader = rader
    this.vantar = vantar
    this.grupp.visible = rader.length > 0 || vantar.length > 0
    this.sida = 0
    this.sidklocka = 0
    if (this.grupp.visible) this.rita()
  }

  get sidor() {
    return Math.max(1, Math.ceil(this.rader.length / PER_SIDA))
  }

  rita() {
    const c = this.duk.getContext('2d')
    const W = this.duk.width
    const H = this.duk.height
    const pad = 58
    const spalt = Math.round(W * 0.6)

    c.clearRect(0, 0, W, H)
    bakgrund(c, W, H)

    const y0 = huvud(c, {
      W,
      pad,
      nummer: 'No. 01 · LOGGBOKEN',
      titel: 'Loggboken',
      under: 'tavlan trådarna delar',
      accent: CSS.clay,
      hoger: 'LIVE',
      hogerFarg: CSS.sage,
    })

    // Live-pricken ligger vid ordet, inte på egen plats — en detalj, inte en komponent.
    c.fillStyle = CSS.gron
    c.beginPath()
    c.arc(W - pad - 96, pad + 20, 9, 0, Math.PI * 2)
    c.fill()

    // Spaltlinjen mellan flödet och väntelistan.
    c.fillStyle = rgba('cream', 0.1)
    c.fillRect(spalt - 34, y0 - 10, 2, H - y0 - pad + 10)

    this._flode(c, pad, y0, spalt - 76 - pad)
    this._vantar(c, spalt, y0, W - spalt - pad)

    // Sidfot i editoriell stil: var raderna kommer ifrån, och var vi är i bläddringen.
    c.font = `500 22px ${SANS}`
    c.fillStyle = rgba('cream', 0.32)
    spartext(c, 'ROOST · NX_LOGGBOK', pad, H - pad + 6, 4)

    this.textur.needsUpdate = true
  }

  _flode(c, x, y0, bredd) {
    const sidor = this.sidor
    const start = (this.sida % sidor) * PER_SIDA
    const sida = this.rader.slice(start, start + PER_SIDA)

    c.textAlign = 'left'
    c.font = `600 24px ${SANS}`
    c.fillStyle = CSS.dampad
    spartext(c, 'SENASTE', x, y0, 5)
    if (this.rader.length > PER_SIDA) {
      c.textAlign = 'right'
      c.font = `500 24px ${MONO}`
      c.fillText(`${(this.sida % sidor) + 1} / ${sidor}`, x + bredd, y0)
      c.textAlign = 'left'
    }

    let y = y0 + 52
    const radhojd = 126
    for (const r of sida) {
      const farg = FASFARG[r.fas] || CSS.dampad

      c.font = `500 30px ${MONO}`
      c.fillStyle = rgba('cream', 0.45)
      c.fillText(klocka(r.nar), x, y + 6)

      // Fasen är ett streck i marginalen, inte en bricka. Linjer, inte boxar.
      c.fillStyle = farg
      c.fillRect(x + 122, y + 2, 5, radhojd - 42)

      c.font = `600 30px ${SANS}`
      c.fillStyle = farg
      spartext(c, String(r.trad || '').toUpperCase(), x + 150, y, 3)

      c.font = `500 21px ${SANS}`
      c.fillStyle = rgba('cream', 0.38)
      spartext(c, FASNAMN[r.fas] || r.fas || '', x + 150, y + 40, 4)

      const x0 = x + 150 + 248
      c.font = `400 33px ${SERIF}`
      c.fillStyle = CSS.cream
      bryt(c, r.rubrik, bredd - (x0 - x), 2).forEach((rad, i) => c.fillText(rad, x0, y + i * 42))

      y += radhojd
      regel(c, x, y - 24, bredd, 0.07)
    }
  }

  _vantar(c, x, y0, bredd) {
    c.textAlign = 'left'
    c.font = `600 24px ${SANS}`
    c.fillStyle = CSS.clay
    spartext(c, 'VÄNTAR PÅ NÅGON', x, y0, 5)

    if (!this.vantar.length) {
      c.font = `italic 400 30px ${SERIF}`
      c.fillStyle = CSS.dampad
      c.fillText('Ingenting ligger och väntar.', x, y0 + 56)
      return
    }

    let y = y0 + 56
    for (const v of this.vantar) {
      if (y > this.duk.height - 130) break
      // Grön prick = mottagaren har skrivit något efteråt. Lera = orörd.
      c.fillStyle = v.svarat ? CSS.gron : CSS.clay
      c.beginPath()
      c.arc(x + 8, y + 15, 8, 0, Math.PI * 2)
      c.fill()

      c.font = `600 24px ${SANS}`
      c.fillStyle = v.svarat ? CSS.sage : CSS.clay
      spartext(c, `${String(v.fran || '').toUpperCase()} → ${String(v.till || '').toUpperCase()}`, x + 30, y, 3)

      c.font = `400 29px ${SERIF}`
      c.fillStyle = v.svarat ? CSS.dampad : CSS.cream
      const utan = String(v.rubrik || '').replace(/^\s*TILL\s+[^:–—-]{1,28}\s*[:–—-]\s*/i, '')
      const rader = bryt(c, utan, bredd - 30, 2)
      rader.forEach((rad, i) => c.fillText(rad, x + 30, y + 36 + i * 36))

      y += 36 + rader.length * 36 + 28
      regel(c, x, y - 16, bredd, 0.06)
    }
  }

  /** Vrider sig mot kameran, och bläddrar flödet så att hela tavlan syns över tid. */
  update(dt, camera) {
    if (!this.grupp.visible) return
    this.riktning = vridMot(this.grupp, camera, this.riktning, dt)

    if (this.rader.length > PER_SIDA) {
      this.sidklocka += dt
      if (this.sidklocka >= SIDTID) {
        this.sidklocka = 0
        this.sida = (this.sida + 1) % this.sidor
        this.rita()
      }
    }
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
