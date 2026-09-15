/**
 * Filips skylt vid landningsplattan.
 *
 * En notis som börjar med "TILL FILIP" är tavlans sätt att be en människa om något.
 * Astronauten håller upp ett `?` där den står, men det syns bara om man råkar titta åt rätt
 * håll — så det som väntar på Filip får en egen skylt vid skeppet, i neon, som tänds så fort
 * något ligger och väntar och släcks helt när listan är tom.
 *
 * Den säger hur många det är och visar rubrikerna i tur och ordning, en i taget, så att en
 * rad går att läsa på håll i stället för att trängas med tre andra.
 *
 * Stommen är skyltverkets, som de andra tavlornas — det som är Filips eget är neonramen och
 * den stora siffran. Blinkandet är avsiktligt lugnt, och `prefers-reduced-motion` gör det
 * ännu lugnare: en skylt som står i ett kök ska dra blicken till sig, inte hamra på den.
 */
import * as THREE from 'three'
import { CSS, TAL, rgba } from './palett.js'
import { SANS, SERIF, byggDuk, byggPlank, bakgrund, bryt, spartext } from './skyltverk.js'

// bryt() bodde här förut. Den bor i skyltverket nu, men exporteras vidare så ingen import
// någon annanstans behöver veta att den flyttade.
export { bryt }

const BREDD = 7.6
const HOJD = 4.2
const BENHOJD = 3.2
const PIXLAR = 180
const BYTESTID = 6 // sekunder per rubrik

const NEON = TAL.clay
const NEON_CSS = CSS.clay

const sedan = (ms) => {
  const min = Math.round((Date.now() - ms) / 60000)
  if (min < 1) return 'nyss'
  if (min < 60) return `${min} min sedan`
  const h = Math.round(min / 60)
  return h < 36 ? `${h} h sedan` : `${Math.round(h / 24)} dagar sedan`
}

export class Anslagstavla {
  /**
   * @param {THREE.Scene} scene
   * @param {{x:number,y:number,z:number}} plats  foten av stolparna
   */
  constructor(scene, plats) {
    this.scene = scene
    this.grupp = new THREE.Group()
    this.grupp.position.set(plats.x, plats.y, plats.z)
    this.grupp.visible = false
    this.poster = []
    this.sida = 0
    this.klocka = 0
    this.nyckel = ''

    // Lugnare blink för den som bett om mindre rörelse. Läses en gång: skylten står på en
    // köksskärm i veckor, och en mediaquery som ändras mitt i är inte värd en lyssnare.
    this.lugnt = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)

    const { mittY, ramt } = byggPlank(this.grupp, {
      bredd: BREDD,
      hojd: HOJD,
      benhojd: BENHOJD,
      accent: TAL.clay,
      strava: false,
    })
    const duk = byggDuk(this.grupp, { bredd: BREDD, hojd: HOJD, pixlar: PIXLAR, mittY })
    this.duk = duk.duk
    this.textur = duk.textur

    /**
     * Neonröret. Fyra rör runt kanten med egen emissive — det är de som blinkar, inte duken:
     * att rita om en canvas sextio gånger i sekunden för ett ljus är slöseri, och ett ljus som
     * ligger runt skylten syns från andra sidan kolonin medan texten bara syns på nära håll.
     *
     * Rören är runda nu, inte lådor. Ett neonrör är ett rör.
     */
    this.neonMat = new THREE.MeshStandardMaterial({
      color: TAL.panel,
      emissive: NEON,
      emissiveIntensity: 1.2,
      roughness: 0.35,
    })
    const r = 0.075
    const halvB = BREDD / 2 + ramt * 0.9
    const halvH = HOJD / 2 + ramt * 0.9
    const ror = [
      [halvB * 2, 0, halvH, 0],
      [halvB * 2, 0, -halvH, 0],
      [halvH * 2, -halvB, 0, Math.PI / 2],
      [halvH * 2, halvB, 0, Math.PI / 2],
    ]
    for (const [langd, dx, dy, vrid] of ror) {
      const bit = new THREE.Mesh(new THREE.CylinderGeometry(r, r, langd, 8), this.neonMat)
      bit.position.set(dx, mittY + dy, 0.24)
      // Cylindern ligger längs Y. Ett liggande rör vrids ett kvarts varv; ett stående inte.
      if (vrid === 0) bit.rotation.z = Math.PI / 2
      this.grupp.add(bit)
    }
    // Hörnknutar, så rören möts i stället för att sluta i luften.
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const knut = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), this.neonMat)
      knut.position.set(sx * halvB, mittY + sy * halvH, 0.24)
      this.grupp.add(knut)
    }

    scene.add(this.grupp)
  }

  /**
   * @param {{trad:string, rubrik:string, nar:number}[]} poster  öppna TILL FILIP-rader, nyast först
   */
  set(poster) {
    const lista = Array.isArray(poster) ? poster : []
    const nyckel = lista.map((p) => `${p.nar}${p.rubrik}`).join('|')
    if (nyckel === this.nyckel) return
    this.nyckel = nyckel
    this.poster = lista
    // Släckt betyder släckt: ingen skylt som står och lyser tomt när allt är avklarat.
    this.grupp.visible = lista.length > 0
    this.sida = 0
    this.klocka = 0
    if (lista.length) this.rita()
  }

  rita() {
    const c = this.duk.getContext('2d')
    const W = this.duk.width
    const H = this.duk.height
    const pad = 62
    const n = this.poster.length
    const post = this.poster[this.sida % n]

    c.clearRect(0, 0, W, H)
    bakgrund(c, W, H)
    c.textBaseline = 'top'
    c.textAlign = 'left'

    c.fillStyle = NEON_CSS
    c.fillRect(0, 0, W, 7)

    // Siffran är skyltens hela poäng: den ska gå att läsa från andra sidan köket.
    c.font = `400 132px ${SERIF}`
    c.fillStyle = NEON_CSS
    c.shadowColor = rgba('clay', 0.55)
    c.shadowBlur = 30
    const talBredd = c.measureText(String(n)).width
    c.fillText(String(n), pad, pad - 18)
    c.shadowBlur = 0

    c.font = `600 26px ${SANS}`
    c.fillStyle = rgba('cream', 0.55)
    spartext(c, n === 1 ? 'SAK VÄNTAR' : 'SAKER VÄNTAR', pad + talBredd + 26, pad + 22, 6)
    spartext(c, 'PÅ DIG', pad + talBredd + 26, pad + 58, 6)

    c.fillStyle = rgba('clay', 0.3)
    c.fillRect(pad, pad + 122, W - pad * 2, 2)

    // Rubriken, en i taget.
    const utan = String(post.rubrik || '').replace(/^\s*TILL FILIP\s*[:–—-]?\s*/i, '')
    c.font = `600 26px ${SANS}`
    c.fillStyle = rgba('cream', 0.42)
    spartext(c, `${String(post.trad || '').toUpperCase()}   ·   ${sedan(post.nar).toUpperCase()}`, pad, pad + 146, 4)

    c.font = `400 52px ${SERIF}`
    c.fillStyle = CSS.cream
    bryt(c, utan, W - pad * 2, 3).forEach((rad, i) => c.fillText(rad, pad, pad + 202 + i * 64))

    // Prickar: var i kön den här raden ligger.
    if (n > 1) {
      const y = H - pad - 8
      for (let i = 0; i < Math.min(n, 8); i++) {
        const har = i === this.sida % n
        c.fillStyle = har ? NEON_CSS : rgba('cream', 0.24)
        c.beginPath()
        c.arc(pad + 10 + i * 32, y, har ? 9 : 6, 0, Math.PI * 2)
        c.fill()
      }
    }

    this.textur.needsUpdate = true
  }

  /** Vrider skylten mot kameran, bläddrar rubrikerna, och blinkar i neon. */
  update(dt, camera) {
    if (!this.grupp.visible) return

    const dx = camera.position.x - this.grupp.position.x
    const dz = camera.position.z - this.grupp.position.z
    this.grupp.rotation.y = Math.atan2(dx, dz)

    if (this.poster.length > 1) {
      this.klocka += dt
      if (this.klocka >= BYTESTID) {
        this.klocka = 0
        this.sida = (this.sida + 1) % this.poster.length
        this.rita()
      }
    }

    // Neonet: ett långsamt andetag, inte ett stroboskop. Med reducerad rörelse blir det ett
    // jämnt sken som knappt rör sig alls.
    const t = performance.now() / 1000
    const puls = this.lugnt ? 1.25 + Math.sin(t * 0.8) * 0.15 : 1.1 + Math.sin(t * 2.1) * 0.75
    this.neonMat.emissiveIntensity = Math.max(0.35, puls)
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
