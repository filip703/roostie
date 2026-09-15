/**
 * Skärmtidsfyren — kolonins puls.
 *
 * Roost handlar om en enda sak: barnens skärmtid. Allt annat i kolonin är maskineriet runt
 * omkring. Så mitt i kolonin står ljuset som säger hur det står till.
 *
 * FÖRSTA VERSIONEN SLOG BARA. Ett slag per minut som lämnat någons budget — ärligt, men
 * oläsbart: ett blink på två sekunder en gång i minuten, och en fyr som såg exakt likadan ut
 * när Bill hade nittio minuter kvar som när han hade elva. Filip stod i köket medan Bills tid
 * tickade ner och såg ingen skillnad, och han hade rätt.
 *
 * NU ÄR DEN EN MÄTARE. Varje barn har en egen stråle:
 *   HÖJDEN är hur mycket som är kvar — strålen sjunker under kvällen, av sig själv
 *   FÄRGEN är hur illa det är (grön över hälften, bärnsten under, lera på slutet)
 *   BÅGEN i marken är samma sak som en urtavla, läsbar också när höjden är tvetydig
 *   SLAGET är kvar, men det tillhör nu ETT barn: man ser vems minut som gick
 *
 * Andelen räknas mot `tak + intjanat` — ett barn som tjänat minuter på uppdrag har mer än
 * taket att ta av, och en mätare mot taket hade sett ut som en bugg (Skatas mätning, tavlans
 * rad 136).
 *
 * Utan färska siffror lyser fyren varken grönt eller rött: den går ner i grått och står still.
 */
import * as THREE from 'three'
import { TAL } from './palett.js'
import { createLabel } from './plots.js'

/** Hur länge en puls syns. */
const SLAG_MS = 2200
/** Max antal slag som spelas upp i rad, så en lucka i pollen inte blir ett stroboskop. */
const MAX_KO = 3
/** En stråle som är slut ska ändå synas — annars vet man inte om den är slut eller borta. */
const MIN_HOJD = 1.3
const MAX_HOJD = 9.5
/** Avstånd mellan barnens strålar. */
const LUFT = 3.4

/**
 * Hur många slag en ny hämtning ska ge.
 *
 * Bruten ut ur klassen för att den går att prova utan en webbläsare: det är den här räkningen
 * som avgör om fyren säger sanning. Första hämtningen ger noll — vi vet inte vad som hänt före
 * den och ska inte låtsas. En hämtning som inte är färsk ger noll. Fler än MAX_KO i rad
 * kortas, så en lucka i pollen inte blir ett stroboskop.
 */
export function raknaSlag(anvantForut, anvant, fardig, ko = 0) {
  if (!fardig || anvantForut === null || anvant <= anvantForut) return ko
  return Math.min(MAX_KO, ko + (anvant - anvantForut))
}

/**
 * Strålens höjd ur andelen kvar.
 *
 * Också utbruten, och av samma skäl: det är den här kurvan som är hela mätaren. Full budget
 * ger full höjd, slut ger stubben — aldrig noll, för en osynlig stråle betyder "ingen data"
 * och det är något annat än "slut".
 */
export function stapelHojd(andel) {
  const a = Number.isFinite(andel) ? Math.min(1, Math.max(0, andel)) : 0
  return MIN_HOJD + a * (MAX_HOJD - MIN_HOJD)
}

/** Färgen ur andelen kvar. Samma trösklar överallt i kolonin. */
export function stapelFarg(andel, fardig = true) {
  if (!fardig) return TAL.sage
  if (andel > 0.5) return TAL.gron
  if (andel > 0.2) return TAL.honey
  return TAL.clay
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

export class Skarmtidsfyr {
  constructor(scene, plats) {
    this.scene = scene
    this.grupp = new THREE.Group()
    this.grupp.position.set(plats.x, plats.y, plats.z)
    this.grupp.visible = false
    scene.add(this.grupp)

    this.barn = new Map()
    this.ordning = []
    this.fardig = false

    // Ett gemensamt fundament. Barnen står på samma platta: det är en budget, delad kväll.
    this.platta = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.6, 0.45, 20),
      new THREE.MeshStandardMaterial({ color: TAL.panel, roughness: 0.85, metalness: 0.12 })
    )
    this.platta.position.y = 0.22
    this.platta.receiveShadow = true
    this.platta.castShadow = true
    this.grupp.add(this.platta)
  }

  /**
   * @param {{budgetar:{namn,tak,intjanat,anvant,kvar,andel}[], fardig:boolean}} data
   */
  set(data) {
    const budgetar = Array.isArray(data?.budgetar) ? data.budgetar : []
    this.fardig = Boolean(data?.fardig)
    this.grupp.visible = budgetar.length > 0
    if (!budgetar.length) return

    const kvar = new Set(this.barn.keys())
    this.ordning = budgetar.map((b) => b.namn)

    budgetar.forEach((b) => {
      kvar.delete(b.namn)
      let post = this.barn.get(b.namn)
      if (!post) {
        post = this._bygg(b.namn)
        this.barn.set(b.namn, post)
      }

      // Ett slag per minut som faktiskt lämnat DET HÄR barnets budget sedan förra hämtningen.
      // Första hämtningen ger inga slag — vi vet inte vad som hänt före den.
      post.slagKo = raknaSlag(post.anvantForut, b.anvant, this.fardig, post.slagKo)
      if (this.fardig) post.anvantForut = b.anvant

      post.andel = Number.isFinite(b.andel) ? b.andel : 0
      post.malHojd = this.fardig ? stapelHojd(post.andel) : MIN_HOJD
      post.farg = stapelFarg(post.andel, this.fardig)
      post.slut = this.fardig && b.kvar <= 0

      const text = this.fardig ? (b.kvar > 0 ? `${b.namn} ${b.kvar} min` : `${b.namn} slut`) : `${b.namn} okänd`
      if (text !== post.text) {
        post.text = text
        this._etikett(post)
      }
      // Bågen i marken är en urtavla: den ritas om bara när andelen faktiskt flyttat sig.
      const steg = Math.round(post.andel * 120)
      if (steg !== post.bageSteg) {
        post.bageSteg = steg
        this._bage(post)
      }
    })

    for (const namn of kvar) {
      this._riv(this.barn.get(namn))
      this.barn.delete(namn)
    }

    this._placera()
  }

  _bygg(namn) {
    const grupp = new THREE.Group()
    this.grupp.add(grupp)

    // Strålen: enhetshög, skalas i y. Smalare upptill så den tunnas ut mot rymden i stället
    // för att sluta tvärt. Additiv — ljus LÄGGS TILL bilden; ett vanligt material i samma
    // färg blir en målad pelare.
    const pelarMat = additiv(TAL.sage, 0.3)
    const pelare = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.4, 1, 16, 1, true), pelarMat)
    grupp.add(pelare)

    const glodMat = additiv(TAL.sage, 0.35)
    const glod = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24), glodMat)
    glod.rotation.x = -Math.PI / 2
    glod.position.y = 0.48
    grupp.add(glod)

    // Kronan sitter i strålens topp och följer med ner när tiden går.
    const kronaMat = additiv(TAL.sage, 0.9)
    const krona = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), kronaMat)
    grupp.add(krona)

    // Urtavlan: en båge i marken som visar andelen kvar. Höjd är tvetydig på avstånd; en båge
    // som krymper runt sin egen cirkel är det inte.
    const bageMat = new THREE.MeshBasicMaterial({
      color: TAL.sage,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      toneMapped: false,
      depthWrite: false,
    })
    const bage = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.22, 44, 1, Math.PI / 2, Math.PI * 2), bageMat)
    bage.rotation.x = -Math.PI / 2
    bage.position.y = 0.47
    grupp.add(bage)

    // Spåret bakom bågen, så en nästan tom urtavla fortfarande läses som en urtavla.
    const spar = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.22, 44),
      new THREE.MeshBasicMaterial({
        color: TAL.stomme,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        toneMapped: false,
        depthWrite: false,
      })
    )
    spar.rotation.x = -Math.PI / 2
    spar.position.y = 0.46
    grupp.add(spar)

    // Ringarna vid slag: en halv takt isär, så en minut som gick läser som en våg.
    const ringMat = new THREE.MeshBasicMaterial({
      color: TAL.sage,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      toneMapped: false,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.85, 44), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.5
    grupp.add(ring)

    const ringMat2 = ringMat.clone()
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.55, 44), ringMat2)
    ring2.rotation.x = -Math.PI / 2
    ring2.position.y = 0.49
    grupp.add(ring2)

    const blixtMat = additiv(TAL.cream, 0)
    const blixt = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, 11, 18, 1, true), blixtMat)
    blixt.position.y = 5.6
    grupp.add(blixt)

    const etikett = createLabel(namn, TAL.sage)
    etikett.position.set(0, 2.15, 0)
    etikett.visible = false
    etikett.material.opacity = 0
    grupp.add(etikett)

    return {
      namn,
      grupp,
      pelare,
      pelarMat,
      glod,
      glodMat,
      krona,
      kronaMat,
      bage,
      bageMat,
      spar,
      ring,
      ringMat,
      ring2,
      ringMat2,
      blixt,
      blixtMat,
      etikett,
      text: '',
      bageSteg: -1,
      andel: 0,
      farg: TAL.sage,
      slut: false,
      // Höjden går mjukt ner till målet: ett hopp ser ut som ett fel, en sjunkande stråle
      // ser ut som tid som går.
      hojd: MIN_HOJD,
      malHojd: MIN_HOJD,
      anvantForut: null,
      slagKo: 0,
      slag: 0,
    }
  }

  /** Bågen ritas om när andelen flyttat sig — geometrin bär vinkeln, inte en uniform. */
  _bage(post) {
    const andel = Math.min(1, Math.max(0, post.andel))
    post.bage.geometry.dispose()
    // Börjar rakt upp och går medsols, som en klocka.
    post.bage.geometry = new THREE.RingGeometry(
      0.95,
      1.22,
      44,
      1,
      Math.PI / 2,
      -Math.max(0.001, andel) * Math.PI * 2
    )
  }

  _etikett(post) {
    const synlig = post.etikett.material.opacity
    post.grupp.remove(post.etikett)
    post.etikett.userData.dispose?.()
    post.etikett = createLabel(post.text, post.farg)
    post.etikett.position.set(0, 2.15, 0)
    post.etikett.material.opacity = synlig
    post.etikett.visible = synlig > 0.02
    post.grupp.add(post.etikett)
  }

  /** Barnen står i rad på plattan, i den ordning läsvägen ger dem. */
  _placera() {
    const n = this.ordning.length
    this.ordning.forEach((namn, i) => {
      const post = this.barn.get(namn)
      if (post) post.grupp.position.x = (i - (n - 1) / 2) * LUFT
    })
    const bredd = Math.max(2.2, ((n - 1) * LUFT) / 2 + 1.9)
    this.platta.scale.set(bredd / 2.2, 1, 1)
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

    for (const post of this.barn.values()) {
      // Slagen spelas upp ett i taget, med luft emellan.
      if (post.slag <= 0 && post.slagKo > 0) {
        post.slagKo -= 1
        post.slag = 1
      }
      if (post.slag > 0) post.slag = Math.max(0, post.slag - dt * (1000 / SLAG_MS))

      const blossa = post.slag * post.slag
      // Höjden glider ner mot målet. Vid ett slag studsar den till först — det är minuten
      // som lämnar kontot, och den ska kännas.
      post.hojd += (post.malHojd - post.hojd) * Math.min(1, dt * 1.6)
      const hojd = post.hojd * (1 + blossa * 0.1)

      post.pelare.scale.set(1 + blossa * 0.45, hojd, 1 + blossa * 0.45)
      post.pelare.position.y = 0.45 + hojd / 2
      post.krona.position.y = 0.45 + hojd
      post.krona.scale.setScalar(1 + blossa * 2)

      // En budget som är slut andas fortare: det är den enda gången fyren får vara enträgen.
      const takt = post.slut ? 3.2 : 1.1
      const andning = this.fardig ? 0.45 + Math.sin(t * takt) * (post.slut ? 0.3 : 0.08) : 0.18

      post.pelarMat.color.set(post.farg)
      post.pelarMat.opacity = Math.min(0.95, andning * 0.6 + blossa * 0.8)
      post.glodMat.color.set(post.farg)
      post.glodMat.opacity = Math.min(0.85, andning * 0.7 + blossa * 0.5)
      post.kronaMat.color.set(post.farg)
      post.kronaMat.opacity = Math.min(1, 0.5 + blossa * 0.5)
      post.bageMat.color.set(post.farg)
      post.bageMat.opacity = this.fardig ? 0.75 + blossa * 0.25 : 0.3

      post.ringMat.color.set(post.farg)
      post.ringMat.opacity = post.slag * 0.85
      post.ring.scale.setScalar(1 + (1 - post.slag) * 9)

      const efter = Math.max(0, post.slag - 0.25) / 0.75
      post.ringMat2.color.set(post.farg)
      post.ringMat2.opacity = efter * 0.5
      post.ring2.scale.setScalar(1 + (1 - efter) * 6)

      post.blixtMat.opacity = Math.min(0.85, blossa * 0.9)
      post.blixt.scale.set(1 + blossa * 0.6, 1, 1 + blossa * 0.6)

      post.etikett.getWorldPosition(p)
      const mal = p.distanceTo(camera.position) < 90 ? 1 : 0
      const m = post.etikett.material
      m.opacity += (mal - m.opacity) * Math.min(1, dt * 5)
      post.etikett.visible = m.opacity > 0.02
    }
  }

  dispose() {
    for (const post of this.barn.values()) this._riv(post)
    this.barn.clear()
    this.scene.remove(this.grupp)
    this.grupp.traverse((o) => {
      o.geometry?.dispose()
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
      else o.material?.dispose()
    })
  }
}
