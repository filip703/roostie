/**
 * Trådmätaren — hur mycket trådarna jobbar, bredvid barnens skärmtid.
 *
 * Skärmtidsfyren säger hur mycket tid barnen har kvar. Den här säger hur mycket trådarna har
 * gjort. De står bredvid varandra med flit: det är kolonins två sorters arbete, och båda hör
 * hemma mitt i bilden.
 *
 * VAD DEN MÄTER, och varför just det: kolonin kan INTE se hur mycket Claude-kvot en tråd
 * bränt. Den läsvägen finns inte — Anthropics Usage & Cost API täcker uttryckligen inte
 * prenumerationen, och trådarna kör som molnsessioner utan lokala transkript. Så mätaren
 * räknar det som faktiskt lämnat spår: rader och tecken skrivna i Loggboken det senaste
 * dygnet. Det är arbete, inte förbrukning, och den skillnaden är hela skälet till att den
 * går att lita på.
 *
 * Skalan är relativ: den flitigaste tråden det senaste dygnet är full höjd, alla andra mot
 * den. En absolut skala hade krävt ett tak som ingen bestämt, och ett påhittat tak är en
 * lögn med decimaler.
 *
 * En stapel blossar när tråden skriver en ny rad. Det är samma slag som fyren, och det är den
 * enda rörelsen här: man ska kunna se i ögonvrån att någon just gjorde något.
 */
import * as THREE from 'three'
import { TAL } from './palett.js'
import { createLabel } from './plots.js'

const MIN_HOJD = 0.35
const MAX_HOJD = 5.6
/** Avstånd mellan stavarna. */
const LUFT = 1.5
const SLAG_MS = 2000

/**
 * Stapelns höjd: trådens tecken mot den flitigaste trådens.
 *
 * Utbruten och testad, som kolonins andra regler. En tråd som inte skrivit något får stubben,
 * aldrig noll — en saknad stapel ser ut som att tråden inte finns, och det är en annan sak än
 * att den varit tyst.
 */
export function stavHojd(tecken, mest) {
  const t = Number.isFinite(tecken) ? Math.max(0, tecken) : 0
  const m = Number.isFinite(mest) ? Math.max(0, mest) : 0
  if (m <= 0 || t <= 0) return MIN_HOJD
  return MIN_HOJD + Math.min(1, t / m) * (MAX_HOJD - MIN_HOJD)
}

const additiv = (farg, opacity) =>
  new THREE.MeshBasicMaterial({
    color: farg,
    transparent: true,
    opacity,
    toneMapped: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })

export class Tradmatare {
  constructor(scene, plats) {
    this.scene = scene
    this.grupp = new THREE.Group()
    this.grupp.position.set(plats.x, plats.y, plats.z)
    this.grupp.visible = false
    scene.add(this.grupp)

    this.stavar = new Map()
    this.ordning = []
    this.nyckel = ''

    this.platta = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.3, 1.5),
      new THREE.MeshStandardMaterial({ color: TAL.panel, roughness: 0.86, metalness: 0.12 })
    )
    this.platta.position.y = 0.15
    this.platta.receiveShadow = true
    this.platta.castShadow = true
    this.grupp.add(this.platta)

    // Skylten som säger vad man tittar på. Utan den är det sju lysande pinnar.
    this.rubrik = createLabel('TRÅDARNAS ARBETE · SENASTE DYGNET', TAL.dampad)
    this.rubrik.position.set(0, MAX_HOJD + 1.1, 0)
    this.rubrik.visible = false
    this.rubrik.material.opacity = 0
    this.grupp.add(this.rubrik)
  }

  /**
   * @param {{trad:string, namn:string, rader:number, tecken:number, senast:number}[]} arbete
   * @param {Map<string, number>} farger  trådnamn i gemener → plättens accentfärg
   */
  set(arbete, farger) {
    const lista = Array.isArray(arbete) ? arbete.slice(0, 10) : []
    this.grupp.visible = lista.length > 0
    if (!lista.length) return

    const mest = Math.max(...lista.map((t) => t.tecken), 0)
    const kvar = new Set(this.stavar.keys())
    this.ordning = lista.map((t) => t.trad)

    lista.forEach((t) => {
      kvar.delete(t.trad)
      let post = this.stavar.get(t.trad)
      if (!post) {
        post = this._bygg(t)
        this.stavar.set(t.trad, post)
      }
      // Tråden får plättens egen färg, så staven och astronauten hör ihop. Utan en känd plätt
      // blir den dämpad — ingen påhittad färg.
      const farg = farger?.get(String(t.namn || '').toLowerCase()) ?? TAL.dampad
      if (farg !== post.farg) {
        post.farg = farg
        post.stavMat.color.set(farg)
        post.toppMat.color.set(farg)
      }

      // Ett slag när tråden skrivit en ny rad sedan sist. Första hämtningen ger inga slag.
      if (post.raderForut !== null && t.rader > post.raderForut) post.slag = 1
      post.raderForut = t.rader

      post.malHojd = stavHojd(t.tecken, mest)
      post.tyst = t.rader === 0

      const text = t.rader === 1 ? `${t.namn} 1 rad` : `${t.namn} ${t.rader} rader`
      if (text !== post.text) {
        post.text = text
        this._etikett(post)
      }
    })

    for (const trad of kvar) {
      this._riv(this.stavar.get(trad))
      this.stavar.delete(trad)
    }

    this._placera()
    const nyckel = lista.map((t) => `${t.trad}${t.rader}${t.tecken}`).join('|')
    this.nyckel = nyckel
  }

  _bygg(t) {
    const grupp = new THREE.Group()
    this.grupp.add(grupp)

    const stavMat = additiv(TAL.dampad, 0.5)
    const stav = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1, 10, 1, true), stavMat)
    grupp.add(stav)

    const toppMat = additiv(TAL.dampad, 0.9)
    const topp = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.07, 12), toppMat)
    grupp.add(topp)

    const ringMat = new THREE.MeshBasicMaterial({
      color: TAL.dampad,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      toneMapped: false,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.46, 24), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.32
    grupp.add(ring)

    const etikett = createLabel(t.namn, TAL.dampad)
    etikett.visible = false
    etikett.material.opacity = 0
    grupp.add(etikett)

    return {
      trad: t.trad,
      grupp,
      stav,
      stavMat,
      topp,
      toppMat,
      ring,
      ringMat,
      etikett,
      text: '',
      farg: TAL.dampad,
      hojd: MIN_HOJD,
      malHojd: MIN_HOJD,
      tyst: true,
      raderForut: null,
      slag: 0,
    }
  }

  _etikett(post) {
    const synlig = post.etikett.material.opacity
    post.grupp.remove(post.etikett)
    post.etikett.userData.dispose?.()
    post.etikett = createLabel(post.text, post.farg)
    post.etikett.material.opacity = synlig
    post.etikett.visible = synlig > 0.02
    post.grupp.add(post.etikett)
  }

  /** Stavarna står på rad, flitigast först. Ordningen är information i sig. */
  _placera() {
    const n = this.ordning.length
    this.ordning.forEach((trad, i) => {
      const post = this.stavar.get(trad)
      if (post) post.grupp.position.x = (i - (n - 1) / 2) * LUFT
    })
    this.platta.scale.set(Math.max(1, (n * LUFT + 0.8) / 2), 1, 1)
  }

  _riv(post) {
    if (!post) return
    this.grupp.remove(post.grupp)
    post.grupp.traverse((o) => {
      o.geometry?.dispose()
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
      else o.material?.dispose()
    })
    post.etikett.userData.dispose?.()
  }

  update(dt, camera) {
    if (!this.grupp.visible) return
    const t = performance.now() / 1000
    const p = new THREE.Vector3()

    for (const post of this.stavar.values()) {
      if (post.slag > 0) post.slag = Math.max(0, post.slag - dt * (1000 / SLAG_MS))
      const blossa = post.slag * post.slag

      post.hojd += (post.malHojd - post.hojd) * Math.min(1, dt * 2)
      const hojd = post.hojd * (1 + blossa * 0.12)
      post.stav.scale.set(1 + blossa * 0.5, hojd, 1 + blossa * 0.5)
      post.stav.position.y = 0.3 + hojd / 2
      post.topp.position.y = 0.3 + hojd
      post.topp.scale.set(1 + blossa * 0.7, 1, 1 + blossa * 0.7)

      // Tysta trådar lyser svagt och andas inte. De har inte gjort något, och det ska synas.
      const andning = post.tyst ? 0.18 : 0.5 + Math.sin(t * 1.3 + hojd) * 0.09
      post.stavMat.opacity = Math.min(0.95, andning + blossa * 0.7)
      post.toppMat.opacity = Math.min(1, (post.tyst ? 0.3 : 0.75) + blossa * 0.25)

      post.ringMat.color.set(post.farg)
      post.ringMat.opacity = post.slag * 0.7
      post.ring.scale.setScalar(1 + (1 - post.slag) * 5)

      post.etikett.position.set(0, 0.42 + hojd + 0.5, 0)
      post.etikett.getWorldPosition(p)
      const mal = p.distanceTo(camera.position) < 34 ? 1 : 0
      const m = post.etikett.material
      m.opacity += (mal - m.opacity) * Math.min(1, dt * 5)
      post.etikett.visible = m.opacity > 0.02
    }

    this.rubrik.getWorldPosition(p)
    const mal = p.distanceTo(camera.position) < 55 ? 1 : 0
    const rm = this.rubrik.material
    rm.opacity += (mal - rm.opacity) * Math.min(1, dt * 4)
    this.rubrik.visible = rm.opacity > 0.02
  }

  /** Vad mätaren faktiskt visar — för `?debug=1`. */
  diagnos() {
    return {
      synlig: this.grupp.visible,
      stavar: [...this.stavar.values()].map((s) => ({
        trad: s.trad,
        text: s.text,
        hojd: Number(s.malHojd.toFixed(2)),
        tyst: s.tyst,
      })),
    }
  }

  dispose() {
    for (const post of this.stavar.values()) this._riv(post)
    this.stavar.clear()
    this.rubrik.userData.dispose?.()
    this.scene.remove(this.grupp)
    this.grupp.traverse((o) => {
      o.geometry?.dispose()
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
      else o.material?.dispose()
    })
  }
}
