/**
 * Agenttavlan — maskinparkens egen tavla.
 *
 * Trådarna har Loggboken. Agenterna har inget sådant: de skriver inga rader, de går eller går
 * inte. Den här skärmen står vid gården och säger vad var och en har för uppdrag, om den
 * arbetar just nu, och när den sist gjorde något — så att man kan läsa maskinparken utan att
 * gå fram till varje enskild maskin.
 *
 * Fyra spalter, en per gård, i gårdarnas egna färger.
 */
import * as THREE from 'three'

const BREDD = 15
const HOJD = 8
const BENHOJD = 3.8
const PIXLAR = 128

const FARG = {
  ok: '#7fb069',
  nere: '#8d8073',
  fel: '#c9564f',
  okand: '#6f6257',
}
const AKTIV_MS = 5 * 60 * 1000

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

    const stal = new THREE.MeshStandardMaterial({ color: 0x3b332b, roughness: 0.75, metalness: 0.3 })
    for (const dx of [-BREDD / 2 + 1.4, BREDD / 2 - 1.4]) {
      const ben = new THREE.Mesh(new THREE.BoxGeometry(0.45, BENHOJD + 1, 0.45), stal)
      ben.position.set(dx, (BENHOJD + 1) / 2, 0)
      ben.castShadow = true
      this.grupp.add(ben)
    }
    const mittY = BENHOJD + HOJD / 2
    const ram = new THREE.Mesh(new THREE.BoxGeometry(BREDD + 0.4, HOJD + 0.4, 0.26), stal)
    ram.position.set(0, mittY, 0)
    ram.castShadow = true
    this.grupp.add(ram)

    this.duk = document.createElement('canvas')
    this.duk.width = Math.round(BREDD * PIXLAR)
    this.duk.height = Math.round(HOJD * PIXLAR)
    this.textur = new THREE.CanvasTexture(this.duk)
    this.textur.colorSpace = THREE.SRGBColorSpace
    this.textur.anisotropy = 8

    const skarm = new THREE.Mesh(
      new THREE.PlaneGeometry(BREDD, HOJD),
      new THREE.MeshBasicMaterial({ map: this.textur, toneMapped: false })
    )
    skarm.position.set(0, mittY, 0.15)
    this.grupp.add(skarm)
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
    const pad = 40
    const nu = Date.now()

    c.clearRect(0, 0, W, H)
    const bak = c.createLinearGradient(0, 0, 0, H)
    bak.addColorStop(0, '#141210')
    bak.addColorStop(1, '#201b17')
    c.fillStyle = bak
    c.fillRect(0, 0, W, H)
    c.textBaseline = 'top'
    c.textAlign = 'left'

    const arbetar = maskiner.filter((m) => m.status === 'ok' && m.sistaLogg && nu - m.sistaLogg < AKTIV_MS).length
    const tysta = maskiner.filter((m) => m.status === 'ok').length - arbetar
    const trasiga = maskiner.filter((m) => m.status === 'fel').length
    const nere = maskiner.filter((m) => m.status === 'nere').length

    c.font = '700 52px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = '#f4ecdf'
    c.fillText('AGENTERNA', pad, pad - 4)
    c.font = '500 26px ui-sans-serif, system-ui, sans-serif'
    c.fillStyle = '#8d8073'
    const rad = [
      `${maskiner.length} maskiner`,
      `${arbetar} arbetar`,
      `${tysta} på tomgång`,
      trasiga ? `${trasiga} fel` : '',
      nere ? `${nere} nere` : '',
    ]
      .filter(Boolean)
      .join('   ·   ')
    c.fillText(rad, pad, pad + 62)
    c.fillStyle = 'rgba(244,236,223,0.16)'
    c.fillRect(pad, pad + 104, W - pad * 2, 3)

    // En spalt per gård.
    const spalter = this.falt.length
    const spaltBredd = (W - pad * 2) / spalter
    this.falt.forEach((f, i) => {
      const x = pad + i * spaltBredd
      const mina = maskiner.filter((m) => m.grupp === f.nyckel)
      c.font = '700 24px ui-sans-serif, system-ui, sans-serif'
      c.fillStyle = `#${f.farg.toString(16).padStart(6, '0')}`
      c.fillText(f.namn, x, pad + 122)

      let y = pad + 164
      for (const m of mina) {
        if (y > H - pad - 30) break
        const aktiv = m.status === 'ok' && m.sistaLogg && nu - m.sistaLogg < AKTIV_MS
        const farg = FARG[m.status] || FARG.okand

        c.fillStyle = farg
        c.beginPath()
        c.arc(x + 7, y + 13, aktiv ? 7 : 5, 0, Math.PI * 2)
        c.fill()

        c.font = '600 25px ui-sans-serif, system-ui, sans-serif'
        c.fillStyle = m.status === 'ok' ? '#f4ecdf' : '#8d8073'
        const namn = m.namn.replace(/^nexus-/, '')
        c.fillText(namn, x + 24, y)

        c.font = '400 22px ui-sans-serif, system-ui, sans-serif'
        c.fillStyle = '#8d8073'
        const tid = m.status === 'ok' ? sedan(m.sistaLogg) : m.status === 'nere' ? 'nere' : 'fel'
        c.textAlign = 'right'
        c.fillText(tid, x + spaltBredd - 24, y + 3)
        c.textAlign = 'left'

        y += 38
      }
    })

    this.textur.needsUpdate = true
  }

  update(dt, camera) {
    if (!this.grupp.visible) return
    const mal = Math.atan2(camera.position.x - this.grupp.position.x, camera.position.z - this.grupp.position.z)
    let diff = mal - this.riktning
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    this.riktning += diff * Math.min(1, dt * 1.2)
    this.grupp.rotation.y = this.riktning
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
