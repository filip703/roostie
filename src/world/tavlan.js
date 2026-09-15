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
 * Skärmen vrider sig långsamt mot kameran i stället för att snäppa: en byggnad i den här
 * storleken som hoppar runt sin axel ser ut som ett fel, och det är en skärm man ska kunna
 * gå fram till och läsa.
 */
import * as THREE from 'three'
import { bryt } from './anslagstavla.js'

const BREDD = 18
const HOJD = 10
const BENHOJD = 4.6
const PIXLAR = 128 // texlar per världsenhet → 2304 x 1280
const PER_SIDA = 6
const SIDTID = 9 // sekunder per sida

const FASFARG = {
  borjar: '#e08a4a',
  klart: '#7fb069',
  stoppat: '#c9564f',
  notis: '#5b9dc9',
}
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

    const stalMat = new THREE.MeshStandardMaterial({ color: 0x3b332b, roughness: 0.72, metalness: 0.35 })

    for (const dx of [-BREDD / 2 + 1.8, BREDD / 2 - 1.8]) {
      const ben = new THREE.Mesh(new THREE.BoxGeometry(0.55, BENHOJD + 1.2, 0.55), stalMat)
      ben.position.set(dx, (BENHOJD + 1.2) / 2, 0)
      ben.castShadow = true
      this.grupp.add(ben)
      const fot = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.6), stalMat)
      fot.position.set(dx, 0.15, 0)
      fot.receiveShadow = true
      this.grupp.add(fot)
      // Snedsträva bakåt — en skylt i den här storleken behöver se ut att stå emot vind.
      const strava = new THREE.Mesh(new THREE.BoxGeometry(0.28, BENHOJD * 1.2, 0.28), stalMat)
      strava.position.set(dx, BENHOJD * 0.5, -1.6)
      strava.rotation.x = 0.5
      this.grupp.add(strava)
    }

    const mittY = BENHOJD + HOJD / 2
    const ram = new THREE.Mesh(new THREE.BoxGeometry(BREDD + 0.5, HOJD + 0.5, 0.3), stalMat)
    ram.position.set(0, mittY, 0)
    ram.castShadow = true
    this.grupp.add(ram)

    this.duk = document.createElement('canvas')
    this.duk.width = Math.round(BREDD * PIXLAR)
    this.duk.height = Math.round(HOJD * PIXLAR)
    this.textur = new THREE.CanvasTexture(this.duk)
    this.textur.colorSpace = THREE.SRGBColorSpace
    this.textur.anisotropy = 8

    // MeshBasic: skärmen lyser av sig själv och ska gå att läsa också mitt i natten.
    this.skarm = new THREE.Mesh(
      new THREE.PlaneGeometry(BREDD, HOJD),
      new THREE.MeshBasicMaterial({ map: this.textur, toneMapped: false })
    )
    this.skarm.position.set(0, mittY, 0.17)
    this.grupp.add(this.skarm)

    // Två strålkastare på överkanten, ren rekvisita — de lyser inte, de ser ut att göra det.
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xf4ecdf,
      emissive: 0xe08a4a,
      emissiveIntensity: 0.5,
      roughness: 0.5,
    })
    for (const dx of [-BREDD / 4, BREDD / 4]) {
      const lampa = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.5), lampMat)
      lampa.position.set(dx, mittY + HOJD / 2 + 0.45, 0.5)
      lampa.rotation.x = 0.5
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
    const pad = 46
    const spalt = Math.round(W * 0.6)

    c.clearRect(0, 0, W, H)
    const bak = c.createLinearGradient(0, 0, 0, H)
    bak.addColorStop(0, '#171411')
    bak.addColorStop(1, '#221d18')
    c.fillStyle = bak
    c.fillRect(0, 0, W, H)
    c.textBaseline = 'top'
    c.textAlign = 'left'

    // ── rubrikrad ──────────────────────────────────────────────────────────────────
    c.font = '700 58px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = '#f4ecdf'
    c.fillText('LOGGBOKEN', pad, pad - 4)
    c.font = '500 28px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = '#8d8073'
    c.fillText('tavlan trådarna delar', pad + 330, pad + 20)

    c.fillStyle = '#7fb069'
    c.beginPath()
    c.arc(W - pad - 10, pad + 20, 10, 0, Math.PI * 2)
    c.fill()
    c.textAlign = 'right'
    c.font = '500 26px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = '#8d8073'
    c.fillText('LIVE', W - pad - 32, pad + 6)
    c.textAlign = 'left'

    c.fillStyle = 'rgba(244,236,223,0.16)'
    c.fillRect(pad, pad + 76, W - pad * 2, 3)
    // Spaltlinjen mellan flödet och väntelistan.
    c.fillStyle = 'rgba(244,236,223,0.1)'
    c.fillRect(spalt - 30, pad + 96, 2, H - pad * 2 - 96)

    this._flode(c, pad, pad + 100, spalt - 70)
    this._vantar(c, spalt, pad + 100, W - spalt - pad)

    this.textur.needsUpdate = true
  }

  _flode(c, x, y0, bredd) {
    const sidor = this.sidor
    const start = (this.sida % sidor) * PER_SIDA
    const sida = this.rader.slice(start, start + PER_SIDA)

    c.font = '600 26px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = '#8d8073'
    c.fillText('SENASTE', x, y0)
    if (this.rader.length > PER_SIDA) {
      c.textAlign = 'right'
      c.fillText(`${(this.sida % sidor) + 1} / ${sidor}`, x + bredd, y0)
      c.textAlign = 'left'
    }

    let y = y0 + 48
    const radhojd = 128
    for (const r of sida) {
      const farg = FASFARG[r.fas] || '#8d8073'

      c.font = '500 32px ui-monospace, SFMono-Regular, Menlo, monospace'
      c.fillStyle = '#8d8073'
      c.fillText(klocka(r.nar), x, y + 4)

      c.fillStyle = farg
      c.fillRect(x + 128, y - 2, 7, radhojd - 34)

      c.font = '700 32px ui-sans-serif, system-ui, sans-serif'
      c.fillStyle = farg
      c.fillText(String(r.trad || '').toUpperCase(), x + 156, y)

      c.font = '500 22px ui-sans-serif, system-ui, sans-serif'
      c.fillStyle = '#8d8073'
      c.fillText(FASNAMN[r.fas] || r.fas || '', x + 156, y + 40)

      const x0 = x + 156 + 260
      c.font = '400 32px ui-sans-serif, system-ui, sans-serif'
      c.fillStyle = '#f4ecdf'
      bryt(c, r.rubrik, bredd - (x0 - x), 2).forEach((rad, i) => c.fillText(rad, x0, y + i * 40))

      y += radhojd
      c.fillStyle = 'rgba(244,236,223,0.07)'
      c.fillRect(x, y - 22, bredd, 2)
    }
  }

  _vantar(c, x, y0, bredd) {
    c.font = '600 26px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = '#e08a4a'
    c.fillText('VÄNTAR PÅ NÅGON', x, y0)

    if (!this.vantar.length) {
      c.font = '400 30px ui-sans-serif, system-ui, sans-serif'
      c.fillStyle = '#6f6257'
      c.fillText('Ingenting ligger och väntar.', x, y0 + 54)
      return
    }

    let y = y0 + 54
    for (const v of this.vantar) {
      if (y > this.duk.height - 120) break
      // Grön prick = mottagaren har skrivit något efteråt. Bärnsten = orörd.
      c.fillStyle = v.svarat ? '#7fb069' : '#e08a4a'
      c.beginPath()
      c.arc(x + 9, y + 16, 9, 0, Math.PI * 2)
      c.fill()

      c.font = '700 26px ui-sans-serif, system-ui, sans-serif'
      c.fillStyle = v.svarat ? '#7c8f6e' : '#e08a4a'
      const huvud = `${String(v.fran || '').toUpperCase()} → ${v.till}`
      c.fillText(huvud, x + 32, y)

      c.font = '400 28px ui-sans-serif, system-ui, sans-serif'
      c.fillStyle = v.svarat ? '#8d8073' : '#f4ecdf'
      const utan = String(v.rubrik || '').replace(/^\s*TILL\s+[^:–—-]{1,28}\s*[:–—-]\s*/i, '')
      const rader = bryt(c, utan, bredd - 32, 2)
      rader.forEach((rad, i) => c.fillText(rad, x + 32, y + 36 + i * 34))

      y += 36 + rader.length * 34 + 26
      c.fillStyle = 'rgba(244,236,223,0.06)'
      c.fillRect(x, y - 14, bredd, 2)
    }
  }

  /** Vrider sig mot kameran, och bläddrar flödet så att hela tavlan syns över tid. */
  update(dt, camera) {
    if (!this.grupp.visible) return

    const mal = Math.atan2(camera.position.x - this.grupp.position.x, camera.position.z - this.grupp.position.z)
    let diff = mal - this.riktning
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    this.riktning += diff * Math.min(1, dt * 1.2)
    this.grupp.rotation.y = this.riktning

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
