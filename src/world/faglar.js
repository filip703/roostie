/**
 * Fåglarna — Roosts trådar i trädet.
 *
 * En astronaut i 1.0 var ett samtal som byggde något. En fågel är samma sak, men den hör
 * hemma i ett träd: den har ett bo på sin egen gren, den flyger ut när tråden börjar arbeta
 * och kommer hem med en kvist, och boet växer av det den bär hem.
 *
 * Reglerna är oförändrade — de kommer ur Loggboken, precis som astronauternas gjorde:
 *   borjar   → fågeln är ute och flyger, kvist i näbben, boet växer
 *   klart    → fågeln sitter på kanten (fjädern i boet är steg 2)
 *   notis    → fågeln sjunger (skylten på grenen är steg 2)
 *   stoppat  → boet mörknar och fågeln sitter med huvudet ner
 *   sover    → fågeln sitter stilla i boet
 *
 * Fåglarna byggs av samma sorts fasetterade block som kolonins byggnader: en lågpolyfågel
 * ritad här, eftersom varken rymdkitet eller naturkitet innehåller en enda fågel. Det var den
 * största okända posten inför 2.0, och det här är svaret på den.
 */
import * as THREE from 'three'
import { TAL } from './palett.js'
import { createLabel } from './plots.js'

const UPP = new THREE.Vector3(0, 1, 0)
/** Hur länge en utflykt tar, tur och retur. */
const FLYKT_S = 9
/** Hur mycket boet växer per hemkomst, och hur stort det får bli. */
const BOVAXT = 0.04
const BOMAX = 1.5

const fro = (seed) => {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296)
}

/**
 * Vilket läge en tråd är i, översatt till fågelspråk.
 *
 * Utbruten och ren, som kolonins andra regler: det är den här tabellen som avgör om en fågel
 * ljuger, och den ska gå att prova utan en webbläsare.
 */
export function fagellage(trad) {
  if (!trad) return 'sover'
  if (trad.hasError) return 'stoppat'
  if (trad.notis || trad.unread) return 'sjunger'
  if (trad.running) return 'flyger'
  if (trad.archived) return 'sover'
  return 'sitter'
}

/** Hur stort ett bo ska vara av det tråden skrivit. Aldrig mindre än ett bo, aldrig ett berg. */
export function bostorlek(rader) {
  const n = Number.isFinite(rader) ? Math.max(0, rader) : 0
  return Math.min(BOMAX, 0.82 + n * BOVAXT)
}

function byggFagel(farg) {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: farg, roughness: 0.74, metalness: 0.02, flatShading: true })
  const ljus = new THREE.MeshStandardMaterial({ color: TAL.cream, roughness: 0.7, flatShading: true })

  const kropp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), mat)
  kropp.scale.set(1.2, 0.95, 0.88)
  kropp.castShadow = true
  g.add(kropp)

  const brost = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), ljus)
  brost.position.set(0.3, -0.18, 0)
  brost.scale.set(1, 0.85, 0.9)
  g.add(brost)

  const huvud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), mat)
  huvud.position.set(0.58, 0.44, 0)
  huvud.castShadow = true
  g.add(huvud)

  const nabb = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.44, 4),
    new THREE.MeshStandardMaterial({ color: TAL.honey, roughness: 0.6, flatShading: true })
  )
  nabb.position.set(0.98, 0.4, 0)
  nabb.rotation.z = -Math.PI / 2
  g.add(nabb)

  const stjart = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.95, 4), mat)
  stjart.position.set(-0.92, 0.06, 0)
  stjart.rotation.z = Math.PI / 2 + 0.28
  g.add(stjart)

  const vingar = []
  for (const sida of [-1, 1]) {
    const v = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.15, 4), mat)
    v.position.set(-0.05, 0.16, sida * 0.5)
    v.rotation.x = sida * Math.PI * 0.5
    v.rotation.z = 0.2
    v.castShadow = true
    g.add(v)
    vingar.push({ mesh: v, sida })
  }

  for (const sida of [-1, 1]) {
    const oga = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), new THREE.MeshBasicMaterial({ color: 0x131b17 }))
    oga.position.set(0.76, 0.52, sida * 0.24)
    g.add(oga)
  }

  g.userData.vingar = vingar
  g.userData.huvud = huvud
  return g
}

function byggBo() {
  const g = new THREE.Group()
  const kvist = new THREE.MeshStandardMaterial({ color: 0x5a452f, roughness: 1, flatShading: true })
  const skal = new THREE.Mesh(new THREE.TorusGeometry(1, 0.42, 5, 9), kvist)
  skal.rotation.x = Math.PI / 2
  skal.scale.y = 0.78
  skal.castShadow = true
  g.add(skal)
  const botten = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.62, 0.45, 9), kvist)
  botten.position.y = -0.32
  botten.receiveShadow = true
  g.add(botten)
  g.userData.kvist = kvist
  return g
}

export class Faglar {
  constructor(scene) {
    this.scene = scene
    this.grupp = new THREE.Group()
    this.grupp.name = 'faglar'
    this.grupp.visible = false
    scene.add(this.grupp)
    this.faglar = new Map()
    this.nyckel = ''
  }

  /**
   * @param {{id,namn,farg,rader,running,unread,notis,hasError,archived,openUrl}[]} tradar
   * @param {{punkt:THREE.Vector3, riktning:THREE.Vector3}[]} platser  ur trädets boplatser()
   * @param {THREE.Vector3} stamhal  Lednings plats
   */
  set(tradar, platser, stamhal) {
    const lista = Array.isArray(tradar) ? tradar : []
    const nyckel = lista.map((t) => `${t.id}:${fagellage(t)}:${t.rader}`).join('|')
    if (nyckel === this.nyckel) return
    this.nyckel = nyckel
    this.grupp.visible = lista.length > 0

    const kvar = new Set(this.faglar.keys())
    // Ledning bor i stamhålet, som beställt. Resten får var sin gren.
    const ledning = lista.find((t) => String(t.id).toLowerCase().includes('ledning'))
    const andra = lista.filter((t) => t !== ledning)

    andra.forEach((t, i) => {
      const plats = platser[i % Math.max(1, platser.length)]
      if (!plats) return
      this._stall(t, plats.punkt, plats.riktning, false)
      kvar.delete(t.id)
    })
    if (ledning && stamhal) {
      this._stall(ledning, stamhal, new THREE.Vector3(1, 0.2, 0.5).normalize(), true)
      kvar.delete(ledning.id)
    }

    for (const id of kvar) {
      const f = this.faglar.get(id)
      this.grupp.remove(f.grupp)
      f.grupp.traverse((o) => {
        o.geometry?.dispose()
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
        else o.material?.dispose()
      })
      f.etikett.userData.dispose?.()
      this.faglar.delete(id)
    }
  }

  _stall(trad, punkt, riktning, iHal) {
    let post = this.faglar.get(trad.id)
    if (!post) {
      const grupp = new THREE.Group()
      const bo = iHal ? null : byggBo()
      if (bo) grupp.add(bo)
      const fagel = byggFagel(trad.farg ?? TAL.camel)
      grupp.add(fagel)
      const etikett = createLabel(trad.namn || String(trad.id), trad.farg ?? TAL.camel)
      etikett.visible = false
      etikett.material.opacity = 0
      grupp.add(etikett)
      this.grupp.add(grupp)
      // Varje fågel har sin egen takt: sju fåglar som flaxar i synk är en fjäderfägård,
      // inte ett träd.
      const r = fro((trad.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 7))
      post = {
        trad,
        grupp,
        bo,
        fagel,
        etikett,
        hem: punkt.clone(),
        ut: punkt.clone().addScaledVector(riktning, 16).add(new THREE.Vector3(0, 6 + r() * 8, 0)),
        fas: r(),
        takt: 0.85 + r() * 0.4,
        flykt: r(),
        lage: 'sitter',
        iHal,
      }
      this.faglar.set(trad.id, post)
    }

    post.trad = trad
    post.hem.copy(punkt)
    post.lage = fagellage(trad)
    post.grupp.position.copy(punkt)
    post.etikett.position.set(0, 2.6, 0)

    if (post.bo) {
      const s = bostorlek(trad.rader)
      post.bo.scale.setScalar(s)
      post.bo.userData.kvist.color.set(post.lage === 'stoppat' ? 0x2a2018 : 0x5a452f)
    }
    post.fagel.traverse((o) => {
      o.userData.trad = trad
    })
  }

  /** Det som klicket i 1.0 letade efter på astronauterna: vilken tråd som träffades. */
  traffa(raycaster) {
    const traff = raycaster.intersectObjects(
      [...this.faglar.values()].map((f) => f.fagel),
      true
    )
    return traff.length ? traff[0].object.userData.trad || null : null
  }

  update(dt, camera, natt = 0) {
    if (!this.grupp.visible) return
    const t = performance.now() / 1000
    const p = new THREE.Vector3()

    for (const f of this.faglar.values()) {
      const flyger = f.lage === 'flyger'

      /**
       * Utflykten. Tråden arbetar → fågeln är ute, och den kommer hem med jämna mellanrum.
       * Vändpunkten är det som gör att man ser ATT den arbetar från andra sidan köket: en
       * fågel som bara sitter och lyser säger ingenting.
       */
      if (flyger) {
        f.flykt = (f.flykt + dt / FLYKT_S) % 1
        const v = f.flykt
        // Ut och hem i en båge, med en paus i boet i slutet av varje varv.
        const k = v < 0.45 ? v / 0.45 : v < 0.9 ? 1 - (v - 0.45) / 0.45 : 0
        const bage = Math.sin(k * Math.PI) * 5
        f.fagel.position.lerpVectors(new THREE.Vector3(), f.ut.clone().sub(f.hem), k)
        f.fagel.position.y += bage
        const fart = Math.abs(Math.cos(k * Math.PI))
        for (const v2 of f.fagel.userData.vingar) {
          v2.mesh.rotation.z = 0.2 + Math.sin(t * 15 * f.takt) * (0.5 + fart * 0.6)
        }
        f.fagel.rotation.y = Math.atan2(f.fagel.position.x, f.fagel.position.z) + (v < 0.45 ? Math.PI : 0)
      } else {
        f.fagel.position.set(0, 0.55, 0)
        for (const v2 of f.fagel.userData.vingar) v2.mesh.rotation.z = 0.2
        f.fagel.rotation.y = f.fas * 6.28
      }

      // Sjunger: fågeln studsar i takt och sträcker på halsen. Sitter: andas bara.
      const huvud = f.fagel.userData.huvud
      if (f.lage === 'sjunger') {
        const s = Math.sin(t * 3.1 * f.takt)
        f.fagel.position.y += 0.18 + s * 0.16
        huvud.position.y = 0.44 + Math.max(0, s) * 0.2
        huvud.rotation.z = Math.max(0, s) * 0.35
      } else if (f.lage === 'stoppat') {
        // Huvudet ner. Det är hela signalen, och den behöver ingen färg.
        huvud.position.y = 0.2
        huvud.rotation.z = -0.9
      } else {
        huvud.position.y = 0.44 + Math.sin(t * 1.3 * f.takt + f.fas * 6) * 0.04
        huvud.rotation.z = 0
      }

      // Namnet syns på nära håll, som kolonins övriga etiketter.
      f.etikett.getWorldPosition(p)
      const mal = p.distanceTo(camera.position) < 46 ? 1 : 0
      const m = f.etikett.material
      m.opacity += (mal - m.opacity) * Math.min(1, dt * 5)
      f.etikett.visible = m.opacity > 0.02
    }
  }

  setVisible(pa) {
    this.grupp.visible = pa
  }

  dispose() {
    this.scene.remove(this.grupp)
    this.grupp.traverse((o) => {
      o.geometry?.dispose()
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
      else o.material?.dispose()
    })
    this.faglar.clear()
  }
}
