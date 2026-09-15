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
 * Blinkandet är avsiktligt lugnt, och `prefers-reduced-motion` gör det ännu lugnare: en skylt
 * som står i ett kök ska dra blicken till sig, inte hamra på den.
 */
import * as THREE from 'three'
import { CSS, TAL, rgba } from './palett.js'

const BREDD = 7.6
const HOJD = 4.2
const BENHOJD = 3.2
const PIXLAR = 180
const BYTESTID = 6 // sekunder per rubrik

const NEON = TAL.clay
const NEON_CSS = CSS.clay
const TEXT = CSS.cream
const DAMPAD = CSS.dampad

/** Bryter en rad så den ryms i bredden, och klipper med … om den ändå inte gör det. */
export function bryt(ctx, text, maxBredd, maxRader) {
  const ord = String(text || '').split(/\s+/).filter(Boolean)
  const rader = []
  let rad = ''
  for (const o of ord) {
    const forslag = rad ? `${rad} ${o}` : o
    if (ctx.measureText(forslag).width <= maxBredd) {
      rad = forslag
      continue
    }
    if (rad) rader.push(rad)
    rad = o
    if (rader.length === maxRader) break
  }
  if (rad && rader.length < maxRader) rader.push(rad)
  if (!rader.length) return []
  // Sista raden klipps hellre än att svälla utanför planket.
  let sista = rader[rader.length - 1]
  while (sista && ctx.measureText(sista + '…').width > maxBredd) sista = sista.slice(0, -1)
  if (sista !== rader[rader.length - 1]) rader[rader.length - 1] = sista + '…'
  return rader
}

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

    const stolpMat = new THREE.MeshStandardMaterial({ color: TAL.stomme, roughness: 0.8, metalness: 0.25 })
    for (const dx of [-BREDD / 2 + 0.5, BREDD / 2 - 0.5]) {
      const stolpe = new THREE.Mesh(new THREE.BoxGeometry(0.22, BENHOJD + 0.8, 0.22), stolpMat)
      stolpe.position.set(dx, (BENHOJD + 0.8) / 2, 0)
      stolpe.castShadow = true
      this.grupp.add(stolpe)
    }

    const mittY = BENHOJD + HOJD / 2
    const bak = new THREE.Mesh(
      new THREE.BoxGeometry(BREDD + 0.3, HOJD + 0.3, 0.22),
      new THREE.MeshStandardMaterial({ color: TAL.natt, roughness: 0.9 })
    )
    bak.position.set(0, mittY, 0)
    bak.castShadow = true
    this.grupp.add(bak)

    /**
     * Neonramen. Fyra rör runt kanten med egen emissive — det är de som blinkar, inte duken:
     * att rita om en canvas sextio gånger i sekunden för ett ljus är slöseri, och ett ljus som
     * ligger runt skylten syns från andra sidan kolonin medan texten bara syns på nära håll.
     */
    this.neonMat = new THREE.MeshStandardMaterial({
      color: TAL.panel,
      emissive: NEON,
      emissiveIntensity: 1.2,
      roughness: 0.4,
    })
    const ror = [
      [BREDD + 0.34, 0.16, 0, HOJD / 2 + 0.16],
      [BREDD + 0.34, 0.16, 0, -HOJD / 2 - 0.16],
      [0.16, HOJD + 0.34, -BREDD / 2 - 0.16, 0],
      [0.16, HOJD + 0.34, BREDD / 2 + 0.16, 0],
    ]
    for (const [w, h, dx, dy] of ror) {
      const bit = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), this.neonMat)
      bit.position.set(dx, mittY + dy, 0.06)
      this.grupp.add(bit)
    }

    this.duk = document.createElement('canvas')
    this.duk.width = Math.round(BREDD * PIXLAR)
    this.duk.height = Math.round(HOJD * PIXLAR)
    this.textur = new THREE.CanvasTexture(this.duk)
    this.textur.colorSpace = THREE.SRGBColorSpace
    this.textur.anisotropy = 8

    this.skarm = new THREE.Mesh(
      new THREE.PlaneGeometry(BREDD, HOJD),
      new THREE.MeshBasicMaterial({ map: this.textur, toneMapped: false })
    )
    this.skarm.position.set(0, mittY, 0.13)
    this.grupp.add(this.skarm)

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
    const pad = 54
    const n = this.poster.length
    const post = this.poster[this.sida % n]

    c.clearRect(0, 0, W, H)
    c.fillStyle = CSS.natt
    c.fillRect(0, 0, W, H)
    c.textBaseline = 'top'
    c.textAlign = 'left'

    // Antalet, i klartext. Det är det Filip ska kunna läsa från andra sidan köket.
    c.font = '700 78px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = NEON_CSS
    c.shadowColor = rgba('clay', 0.55)
    c.shadowBlur = 26
    c.fillText(n === 1 ? '1 SAK VÄNTAR PÅ DIG' : `${n} SAKER VÄNTAR PÅ DIG`, pad, pad)
    c.shadowBlur = 0

    c.fillStyle = rgba('clay', 0.35)
    c.fillRect(pad, pad + 100, W - pad * 2, 3)

    // Rubriken, en i taget.
    const utan = String(post.rubrik || '').replace(/^\s*TILL FILIP\s*[:–—-]?\s*/i, '')
    c.font = '600 34px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = DAMPAD
    c.fillText(`${String(post.trad || '').toUpperCase()}   ·   ${sedan(post.nar)}`, pad, pad + 128)

    c.font = '400 52px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = TEXT
    bryt(c, utan, W - pad * 2, 3).forEach((rad, i) => c.fillText(rad, pad, pad + 186 + i * 64))

    // Prickar: var i kön den här raden ligger.
    if (n > 1) {
      const y = H - pad - 10
      for (let i = 0; i < Math.min(n, 8); i++) {
        c.fillStyle = i === this.sida % n ? NEON_CSS : rgba('cream', 0.28)
        c.beginPath()
        c.arc(pad + 12 + i * 34, y, i === this.sida % n ? 10 : 7, 0, Math.PI * 2)
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
