/**
 * Skärmtidsfyren — kolonins puls.
 *
 * Roost handlar om en enda sak: barnens skärmtid. Allt annat i kolonin är maskineriet runt
 * omkring. Så mitt i kolonin står ett ljus som slår **en gång per aktiv minut** — inte per
 * agentvarv, inte per poll, utan när en minut faktiskt har dragits från någons budget.
 * Skillnaden är hela poängen: ett ljus som pulsar när ingen tittar på något vore en lögn på
 * köksväggen, och ett hem lär sig snabbt att sluta tro på en sådan skärm.
 *
 * Ljusets färg är hur mycket som är kvar, räknat mot `tak + intjanat` — ett barn som tjänat
 * minuter på uppdrag har mer än taket att ta av, och en mätare mot taket hade sett ut som en
 * bugg (Skatas mätning, tavlans rad 136).
 *
 * Utan färska siffror lyser fyren varken grönt eller rött: den går ner i grått och står still.
 */
import * as THREE from 'three'
import { CSS, TAL, rgba } from './palett.js'
import { createLabel } from './plots.js'

/** Hur länge en puls syns. */
const SLAG_MS = 1400
/** Max antal slag som spelas upp i rad, så en lucka i pollen inte blir ett stroboskop. */
const MAX_KO = 3

export class Skarmtidsfyr {
  constructor(scene, plats) {
    this.scene = scene
    this.grupp = new THREE.Group()
    this.grupp.position.set(plats.x, plats.y, plats.z)
    this.grupp.visible = false
    scene.add(this.grupp)

    this.budgetar = []
    this.fardig = false
    this.anvantForut = null
    this.slagKo = 0
    this.slag = 0
    this.nyckel = ''

    const sockel = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.6, 0.5, 16),
      new THREE.MeshStandardMaterial({ color: TAL.panel, roughness: 0.85, metalness: 0.1 })
    )
    sockel.position.y = 0.25
    sockel.receiveShadow = true
    sockel.castShadow = true
    this.grupp.add(sockel)

    // Själva ljuset: en pelare som inte tar emot ljus utan ger det. Den byter färg efter hur
    // mycket skärmtid som är kvar och blossar upp vid varje slag.
    // Additivt: ljus LÄGGS TILL det som redan finns i bilden i stället för att täcka det.
    // Ett vanligt material i samma färg blir en målad pelare — det här blir en stråle.
    this.pelarMat = new THREE.MeshBasicMaterial({
      color: TAL.gron,
      transparent: true,
      opacity: 0.22,
      toneMapped: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    // Smalare upptill: strålen tunnas ut mot rymden i stället för att sluta tvärt.
    this.pelare = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.62, 8.5, 18, 1, true), this.pelarMat)
    this.pelare.position.y = 4.7
    this.grupp.add(this.pelare)

    // En glödfläck i marken, så strålen ser ut att komma någonstans ifrån.
    this.glodMat = new THREE.MeshBasicMaterial({
      color: TAL.gron,
      transparent: true,
      opacity: 0.35,
      toneMapped: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    this.glod = new THREE.Mesh(new THREE.CircleGeometry(2.4, 28), this.glodMat)
    this.glod.rotation.x = -Math.PI / 2
    this.glod.position.y = 0.55
    this.grupp.add(this.glod)

    this.kronaMat = new THREE.MeshBasicMaterial({
      color: TAL.gron,
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.krona = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), this.kronaMat)
    this.krona.position.y = 1.4
    this.grupp.add(this.krona)

    // Ringen som far ut vid varje slag — en minut som lämnat någons konto.
    this.ringMat = new THREE.MeshBasicMaterial({
      color: TAL.gron,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      toneMapped: false,
      depthWrite: false,
    })
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.75, 40), this.ringMat)
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.y = 0.35
    this.grupp.add(this.ring)

    this.etikett = createLabel('skärmtid', TAL.gron)
    this.etikett.position.set(0, 2.4, 0)
    this.etikett.visible = false
    this.etikett.material.opacity = 0
    this.grupp.add(this.etikett)
  }

  /**
   * @param {{budgetar:{namn,tak,intjanat,anvant,kvar,andel}[], fardig:boolean}} data
   */
  set(data) {
    const budgetar = Array.isArray(data?.budgetar) ? data.budgetar : []
    this.fardig = Boolean(data?.fardig)
    this.budgetar = budgetar
    this.grupp.visible = budgetar.length > 0

    // Ett slag per minut som faktiskt lämnat en budget sedan förra hämtningen. Första
    // hämtningen ger inga slag — vi vet inte vad som hänt före den, och ska inte låtsas.
    const anvant = budgetar.reduce((n, b) => n + b.anvant, 0)
    if (this.anvantForut !== null && this.fardig && anvant > this.anvantForut) {
      this.slagKo = Math.min(MAX_KO, this.slagKo + (anvant - this.anvantForut))
    }
    if (this.fardig) this.anvantForut = anvant

    const nyckel = budgetar.map((b) => `${b.namn}${b.kvar}${b.andel.toFixed(2)}`).join('|') + this.fardig
    if (nyckel !== this.nyckel) {
      this.nyckel = nyckel
      this._etikett()
    }
  }

  _etikett() {
    const text = this.fardig
      ? this.budgetar.map((b) => `${b.namn} ${b.kvar} min`).join('   ·   ') || 'skärmtid'
      : 'skärmtiden okänd'
    const gammal = this.etikett
    const synlig = gammal.material.opacity
    this.grupp.remove(gammal)
    gammal.userData.dispose?.()
    this.etikett = createLabel(text, this._farg())
    this.etikett.position.set(0, 2.4, 0)
    this.etikett.material.opacity = synlig
    this.etikett.visible = synlig > 0.02
    this.grupp.add(this.etikett)
  }

  /** Färgen är det barn som har minst kvar — det är den som avgör om kvällen blir lugn. */
  _farg() {
    if (!this.fardig) return TAL.sage
    const minsta = this.budgetar.reduce((m, b) => Math.min(m, b.andel), 1)
    if (minsta > 0.5) return TAL.gron
    if (minsta > 0.2) return TAL.honey
    return TAL.clay
  }

  update(dt, camera) {
    if (!this.grupp.visible) return
    const farg = this._farg()
    const t = performance.now() / 1000

    // Slagen spelas upp ett i taget, med luft emellan.
    if (this.slag <= 0 && this.slagKo > 0) {
      this.slagKo -= 1
      this.slag = 1
    }
    if (this.slag > 0) this.slag = Math.max(0, this.slag - dt * (1000 / SLAG_MS))

    const blossa = this.slag * this.slag
    const andning = this.fardig ? 0.45 + Math.sin(t * 1.1) * 0.08 : 0.2

    this.pelarMat.color.set(farg)
    this.pelarMat.opacity = Math.min(0.75, andning * 0.5 + blossa * 0.45)
    this.glodMat.color.set(farg)
    this.glodMat.opacity = Math.min(0.8, andning * 0.6 + blossa * 0.5)
    this.kronaMat.color.set(farg)
    this.kronaMat.opacity = Math.min(1, 0.55 + blossa * 0.45)
    this.krona.scale.setScalar(1 + blossa * 0.7)

    this.ringMat.color.set(farg)
    this.ringMat.opacity = this.slag * 0.55
    const r = 1 + (1 - this.slag) * 5
    this.ring.scale.setScalar(r)

    const p = new THREE.Vector3()
    this.etikett.getWorldPosition(p)
    const mal = p.distanceTo(camera.position) < 80 ? 1 : 0
    const m = this.etikett.material
    m.opacity += (mal - m.opacity) * Math.min(1, dt * 5)
    this.etikett.visible = m.opacity > 0.02
  }

  dispose() {
    this.scene.remove(this.grupp)
    this.grupp.traverse((o) => {
      o.geometry?.dispose()
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
      else o.material?.dispose()
    })
  }
}
