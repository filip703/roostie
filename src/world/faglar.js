/**
 * FÅGLARNA — Roosts trådar, och det de håller på med.
 *
 * Filip, 15 september: "vi pausar detta. är inte nöjd för det går inte att se fåglarna, vi
 * måste tänka om, de ska även jobba och se ut att vara busy."
 *
 * Han hade rätt två gånger om, och det var två olika fel.
 *
 * DET FÖRSTA FELET VAR SKALA, och det är löst i trädet, inte här: scenen visar inte längre
 * ett helt träd utan en barkvägg och sju grenar. En fågel är fyrtio pixlar i överblicken i
 * stället för tre. Ingen mängd animation hade räddat tre pixlar.
 *
 * DET ANDRA FELET VAR ATT VILAN VAR DÖD. Den gamla tabellen hade `sitter` som normalläge, och
 * `sitter` var vad sex av sju fåglar gjorde nästan hela tiden. Nu finns inget viloläge: varje
 * tråd har en syssla (se `sysslor.js`) och varje syssla är en RUNDA med faser — ut, hämta,
 * hem, lämna — som tar mellan två och elva sekunder. Tittar man på trädet i tio sekunder ser
 * man sju fåglar göra sju olika saker, och ingen av dem står still.
 *
 * DET SOM RÖR SIG BEHÖVER INTE BETYDA NÅGOT — VALET AV RUNDA GÖR DET. Det är ett medvetet
 * avsteg från kolonins gamla regel att varje rörelse ska bära data, och det är den regeln som
 * gjorde fåglarna stela. En vingslagstakt betyder ingenting. Att fågeln HÄMTAR MAT i stället
 * för att RUVA betyder allt, och det är den skillnaden man ser tvärs över ett kök.
 *
 * Rundorna ligger utmed grenen, aldrig ut ur bild. En fågel som flyger iväg och försvinner är
 * en fågel man inte kan räkna, och Filip bad uttryckligen om att se alla samtidigt.
 */
import * as THREE from 'three'
import { TAL } from './palett.js'
import { createLabel } from './plots.js'
import { HAMTAR, SYSSLA_ORD, SYSSLA_TAKT, bostorlek, skatter, syssla, ungar } from './sysslor.js'

export { bostorlek, syssla }

/** Fågelns storlek. Satt av hur många pixlar hon ska vara i överblicken, inte av naturen. */
const FAGELSKALA = 2.6
/** Ett bo i grundstorlek. Boet ska vara tydligt större än fågeln — det är husets skala. */
const BOSKALA = 3.4

const fro = (seed) => {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296)
}

/** Bakåtkompatibelt namn. Den gamla tabellen är borta; sysslan är svaret nu. */
export function fagellage(trad) {
  return syssla(trad)
}

let glodTextur = null
function glod() {
  if (glodTextur) return glodTextur
  const d = document.createElement('canvas')
  d.width = 128
  d.height = 128
  const c = d.getContext('2d')
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.28, 'rgba(255,255,255,0.5)')
  g.addColorStop(0.62, 'rgba(255,255,255,0.12)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = g
  c.fillRect(0, 0, 128, 128)
  glodTextur = new THREE.CanvasTexture(d)
  return glodTextur
}

/**
 * Fågeln.
 *
 * Lågpoly av samma sort som kolonins byggnader, och byggd i delar som går att röra var för
 * sig: vingarna slår, huvudet vrids, näbben öppnas, stjärten fjädrar. En fågel i ett stycke
 * kan bara flyttas, och en fågel som bara flyttas ser aldrig ut att arbeta.
 */
function byggFagel(farg) {
  const g = new THREE.Group()
  const fjader = new THREE.MeshStandardMaterial({ color: farg, roughness: 0.7, metalness: 0.02, flatShading: true })
  const ljus = new THREE.MeshStandardMaterial({ color: TAL.cream, roughness: 0.68, flatShading: true })
  const morkt = new THREE.MeshStandardMaterial({ color: TAL.charcoal, roughness: 0.8, flatShading: true })
  const horn = new THREE.MeshStandardMaterial({ color: TAL.honey, roughness: 0.5, flatShading: true })

  const kropp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.66, 0), fjader)
  kropp.scale.set(1.22, 0.98, 0.9)
  kropp.castShadow = true
  g.add(kropp)

  const brost = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), ljus)
  brost.position.set(0.3, -0.18, 0)
  brost.scale.set(0.95, 0.9, 0.88)
  g.add(brost)

  // Huvudet sitter i en egen grupp: allt som handlar om uppmärksamhet — titta upp, titta ner
  // i boet, vrida sig mot en unge — är en rotation på den här och inget annat.
  const huvud = new THREE.Group()
  huvud.position.set(0.66, 0.42, 0)
  g.add(huvud)
  const skalle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), fjader)
  skalle.castShadow = true
  huvud.add(skalle)
  const hjassa = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 5), fjader)
  hjassa.position.set(-0.08, 0.32, 0)
  hjassa.rotation.z = -0.5
  huvud.add(hjassa)

  const nabb = new THREE.Group()
  nabb.position.set(0.34, -0.02, 0)
  huvud.add(nabb)
  const over = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 4), horn)
  over.rotation.z = -Math.PI / 2
  over.position.set(0.19, 0.03, 0)
  nabb.add(over)
  const under = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 4), horn)
  under.rotation.z = -Math.PI / 2
  under.position.set(0.15, -0.05, 0)
  nabb.add(under)

  for (const s of [1, -1]) {
    const oga = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), morkt)
    oga.position.set(0.2, 0.09, 0.24 * s)
    huvud.add(oga)
  }

  // Vingarna roterar kring axeln vid kroppen, inte kring sin egen mitt — annars ser slaget ut
  // som att vingen skakar i stället för att lyfta.
  const vingar = []
  for (const s of [1, -1]) {
    const axel = new THREE.Group()
    axel.position.set(0.02, 0.16, 0.42 * s)
    g.add(axel)
    const v = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), fjader)
    v.scale.set(1.15, 0.2, 1.55)
    v.position.set(-0.1, 0, 0.62 * s)
    v.castShadow = true
    axel.add(v)
    const spets = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 4), fjader)
    spets.rotation.x = s > 0 ? -Math.PI / 2 : Math.PI / 2
    spets.position.set(-0.28, 0, 1.36 * s)
    axel.add(spets)
    vingar.push({ axel, sida: s })
  }

  const stjart = new THREE.Group()
  stjart.position.set(-0.7, 0.06, 0)
  g.add(stjart)
  const st = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 4), fjader)
  st.rotation.z = Math.PI / 2
  st.scale.set(1, 1, 0.42)
  st.position.set(-0.4, 0, 0)
  stjart.add(st)

  const ben = []
  for (const s of [1, -1]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 4), horn)
    b.position.set(0.16, -0.62, 0.17 * s)
    g.add(b)
    ben.push(b)
  }

  // Det fågeln bär i näbben. Osynligt tills hon hämtat något — och det är den enda pryl i
  // hela scenen som säger "hon var ute och gjorde något och kommer hem med det".
  const last = new THREE.Group()
  last.position.set(0.45, 0, 0)
  last.visible = false
  nabb.add(last)
  const kvist = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 4), new THREE.MeshStandardMaterial({ color: 0x6b5947, roughness: 1, flatShading: true }))
  kvist.rotation.x = Math.PI / 2
  kvist.rotation.z = 0.2
  last.add(kvist)
  const bar = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: TAL.clay, roughness: 0.55, flatShading: true }))
  bar.visible = false
  last.add(bar)

  g.scale.setScalar(FAGELSKALA)
  return { grupp: g, huvud, nabb, vingar, stjart, ben, last, kvist, bar, kropp }
}

/**
 * Boet.
 *
 * Fem gånger fågeln, och det som håller när fågeln är ute: en flätad skål, en lykta i trådens
 * färg, ungar som gapar, och — när tråden väntar på Filip — en skatt att ruva på.
 */
function byggBo(farg, r) {
  const g = new THREE.Group()
  const kvistMat = new THREE.MeshStandardMaterial({ color: 0x6b5947, roughness: 1, flatShading: true })
  const inre = new THREE.MeshStandardMaterial({ color: 0x4a3c30, roughness: 1, flatShading: true })

  const skal = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), inre)
  skal.scale.set(1, 0.62, 1)
  skal.position.y = 0.18
  skal.receiveShadow = true
  g.add(skal)

  // Flätan. Tre varv korta pinnar på lite olika höjd och lutning — det är oregelbundenheten
  // som gör att det läses som flätat och inte som en skål.
  const varv = new THREE.Group()
  for (let lag = 0; lag < 3; lag++) {
    const n = 16 + lag * 3
    for (let i = 0; i < n; i++) {
      const v = (i / n) * Math.PI * 2 + lag * 0.4 + r() * 0.2
      const rad = 0.94 + lag * 0.05
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.42 + r() * 0.3, 4), kvistMat)
      p.position.set(Math.cos(v) * rad, -0.1 + lag * 0.16, Math.sin(v) * rad)
      p.rotation.set(r() * 0.5 - 0.25, -v, Math.PI / 2 + (r() - 0.5) * 0.5)
      p.castShadow = true
      varv.add(p)
    }
  }
  g.add(varv)

  const lykta = new THREE.Sprite(new THREE.SpriteMaterial({ map: glod(), color: farg, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3, fog: false }))
  lykta.scale.setScalar(3.2)
  lykta.position.y = 0.3
  g.add(lykta)

  // Ungarna. Tre platser, så många synliga som tråden har dagsverke till.
  const ungarna = []
  for (let i = 0; i < 3; i++) {
    const u = new THREE.Group()
    const v = -0.5 + i * 0.5
    u.position.set(Math.cos(v) * 0.3, 0.1, Math.sin(v) * 0.3)
    u.visible = false
    const kropp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), new THREE.MeshStandardMaterial({ color: 0x8e8073, roughness: 0.9, flatShading: true }))
    u.add(kropp)
    const nabb = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), new THREE.MeshStandardMaterial({ color: TAL.honey, roughness: 0.5, flatShading: true }))
    nabb.rotation.z = -1.1
    nabb.position.set(0.16, 0.16, 0)
    u.add(nabb)
    g.add(u)
    ungarna.push({ grupp: u, nabb, fas: i * 0.37 })
  }

  /**
   * Skatten — Filips diamantklocka.
   *
   * En slipad sten i en ring av metall, och det är precis vad den ska föreställa: något
   * värdefullt som tråden inte kan göra något åt själv. Den syns bara när något på tavlan är
   * ställt till Filip, och den glimtar en gång per väntande rad.
   */
  const skatt = new THREE.Group()
  skatt.position.y = 0.06
  skatt.visible = false
  const sten = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.34, 0),
    new THREE.MeshStandardMaterial({ color: 0xcfe6ee, roughness: 0.08, metalness: 0.65, flatShading: true, emissive: 0x2b4d57, emissiveIntensity: 0.4 })
  )
  sten.scale.set(1, 1.25, 1)
  skatt.add(sten)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.06, 4, 14),
    new THREE.MeshStandardMaterial({ color: TAL.camel, roughness: 0.25, metalness: 0.8, flatShading: true })
  )
  ring.rotation.x = Math.PI / 2
  skatt.add(ring)
  const glimt = new THREE.Sprite(new THREE.SpriteMaterial({ map: glod(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }))
  glimt.scale.setScalar(2.4)
  skatt.add(glimt)
  g.add(skatt)

  g.scale.setScalar(BOSKALA)
  return { grupp: g, lykta, ungarna, skatt, sten, glimt, varv }
}

/** Sångringarna. Tre ringar som växer ut och tonar bort — hörbart, fast man inte hör. */
function byggSang(farg) {
  const g = new THREE.Group()
  const ringar = []
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.05, 4, 20),
      new THREE.MeshBasicMaterial({ color: farg, transparent: true, opacity: 0, depthWrite: false, fog: false })
    )
    m.rotation.y = Math.PI / 2
    g.add(m)
    ringar.push({ mesh: m, fas: i / 3 })
  }
  g.visible = false
  return { grupp: g, ringar }
}

const V = new THREE.Vector3()
const V2 = new THREE.Vector3()

export class Faglar {
  constructor(scene) {
    this.scene = scene
    this.grupp = new THREE.Group()
    this.grupp.name = 'faglar'
    this.grupp.visible = false
    scene.add(this.grupp)
    this.faglar = new Map()
    this.tid = 0
  }

  setVisible(v) {
    this.grupp.visible = Boolean(v)
  }

  /** Trådarna in, boplatserna från trädet, och stamhålet (kvar för kolonins skull). */
  set(lista, boplatser, stamhal) {
    void stamhal
    const kvar = new Set()
    lista.forEach((t, i) => {
      const plats = boplatser[i % boplatser.length]
      if (!plats) return
      kvar.add(t.id)
      let f = this.faglar.get(t.id)
      if (!f) {
        f = this._ny(t, plats, i)
        this.faglar.set(t.id, f)
      }
      f.trad = t
      f.plats = plats
      f.hem = plats.punkt.clone().add(new THREE.Vector3(0, 2.7, 0))
      const ny = syssla(t)
      if (ny !== f.lage) {
        f.lage = ny
        // Ny syssla börjar från början av sin runda, annars hoppar fågeln in mitt i en
        // rörelse och ser ut att teleportera sig.
        f.u = 0
      }
      f.ungar = ungar(t.rader)
      f.skatter = skatter(t)
      f.bo.grupp.scale.setScalar(BOSKALA * bostorlek(t.rader))
      f.bo.lykta.material.color.setHex(t.farg)
      f.etikett.visible = true
      f.etikett.material.opacity = 0.92
      f.etikett.position.copy(plats.punkt).add(new THREE.Vector3(0, -6, 4))
    })
    for (const [id, f] of this.faglar) {
      if (kvar.has(id)) continue
      this.grupp.remove(f.rot)
      this.faglar.delete(id)
    }
  }

  _ny(t, plats, i) {
    const r = fro(0x1000 + i * 977)
    const rot = new THREE.Group()
    rot.position.copy(plats.punkt)
    this.grupp.add(rot)

    const bo = byggBo(t.farg, r)
    rot.add(bo.grupp)

    const fagel = byggFagel(t.farg)
    this.grupp.add(fagel.grupp)

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glod(), color: t.farg, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4, fog: false })
    )
    this.grupp.add(halo)

    const sang = byggSang(t.farg)
    this.grupp.add(sang.grupp)

    /**
     * Namnskylten under boet.
     *
     * Ritas ÖVER grenarna med flit. En skylt som kan hamna bakom en kvist är en skylt man
     * inte kan lita på, och hela poängen med den är att kunna peka på en fågel och veta
     * vilken tråd det är utan att först flyga dit.
     */
    // Skylten sköter sin egen storlek och riktning i shadern (samma som kolonins plättar
    // använder) — den ska varken skalas eller vridas här. Den kommer dold och genomskinlig;
    // det är opaciteten som tänder den, inte `visible`.
    const etikett = createLabel(t.namn, t.farg)
    etikett.position.copy(plats.punkt).add(new THREE.Vector3(0, -6, 4))
    this.grupp.add(etikett)

    return {
      trad: t,
      plats,
      rot,
      bo,
      fagel,
      halo,
      sang,
      etikett,
      // Fötterna på bokanten. Tre enheter för högt och fågeln svävar, vilket är det som
      // fick henne att se inklistrad ut i stället för att sitta.
      hem: plats.punkt.clone().add(new THREE.Vector3(0, 2.7, 0)),
      lage: syssla(t),
      u: r(),
      takt: 1,
      ungar: 0,
      skatter: 0,
      vingfas: r() * 6,
      bovaxt: 0,
      pos: plats.punkt.clone().add(new THREE.Vector3(0, 2.7, 0)),
      forra: plats.punkt.clone(),
      rand: r,
    }
  }

  /**
   * Var fågeln ska vara vid fas `u` i sin runda, och hur hon står.
   *
   * Det här är hela rörelsespråket samlat på ett ställe. Returnerar en punkt, en riktning att
   * titta åt, hur mycket vingarna arbetar (0 = fällda, 1 = fullt slag) och vad hon bär.
   */
  _runda(f, u) {
    const p = f.plats
    const hem = f.hem
    const ut = { mal: V.copy(hem), vinge: 0, last: 0, lutning: 0, huvud: 0 }

    if (f.lage === 'sover') {
      ut.mal = V.copy(hem).setY(hem.y - 1.3 * BOSKALA * 0.5)
      ut.huvud = -0.55
      return ut
    }
    if (f.lage === 'ruvar') {
      // Ligger lågt, lyfter sig en aning i mitten av rundan för att vända skatten.
      const lyft = Math.max(0, Math.sin(u * Math.PI * 2 - 0.6)) * 1.5
      ut.mal = V.copy(hem).setY(hem.y - 1.6 + lyft)
      ut.huvud = -0.3 + lyft * 0.25
      ut.vinge = lyft > 0.9 ? 0.25 : 0
      return ut
    }
    if (f.lage === 'sjunger') {
      const topp = p.stig[p.stig.length - 1]
      ut.mal = V.copy(topp).setY(topp.y + 1.2)
      ut.huvud = 0.5 + Math.sin(u * Math.PI * 6) * 0.18
      ut.vinge = 0.12
      return ut
    }
    if (f.lage === 'larmar') {
      // Hoppar fram och tillbaka på bokanten med vingarna halvöppna. Kort runda, hög takt.
      const hopp = Math.sin(u * Math.PI * 4)
      ut.mal = V.copy(hem)
        .addScaledVector(p.sida, hopp * 2.4)
        .setY(hem.y + Math.abs(Math.sin(u * Math.PI * 8)) * 1.1)
      ut.vinge = 0.55
      ut.huvud = 0.3
      return ut
    }

    // Hämtrundorna: ut till grönskan eller grenen, tillbaka till boet.
    // En tom lista får aldrig nå fram hit: boet självt är den sista utvägen, och en fågel som
    // hämtar hemma är en tråkig fågel — en krasch i bildslingan är värre.
    const plocka = (lista, i) => (lista && lista.length ? lista[i % lista.length] : hem)
    const mal =
      f.lage === 'matar' ? plocka(p.gron, f.rundNr || 0) : plocka(p.stig, f.rundNr || 0)

    if (f.lage === 'pysslar') {
      // Ingen hämtning: småhopp längs grenen, och putsning på plats.
      const a = Math.min(1, u * 2)
      const b = Math.max(0, u * 2 - 1)
      const mitt = u < 0.5 ? a : 1 - b
      ut.mal = V.copy(hem).lerp(V2.copy(mal).setY(mal.y + 1.1), mitt * 0.75)
      ut.vinge = mitt > 0.1 && mitt < 0.9 ? 0.5 : 0.08
      ut.huvud = Math.sin(u * Math.PI * 4) * 0.45
      return ut
    }

    const styr = V2.copy(hem).lerp(mal, 0.5).setY(Math.max(hem.y, mal.y) + 5.5)
    if (u < 0.34) {
      const t = u / 0.34
      bezier(hem, styr, mal, t, ut.mal)
      ut.vinge = 1
      ut.lutning = 0.35
    } else if (u < 0.48) {
      // Svävar och hämtar.
      ut.mal = V.copy(mal).setY(mal.y + Math.sin((u - 0.34) / 0.14 * Math.PI) * 0.8)
      ut.vinge = 0.85
      ut.huvud = -0.5
    } else if (u < 0.82) {
      const t = (u - 0.48) / 0.34
      bezier(mal, styr, hem, t, ut.mal)
      ut.vinge = 1
      ut.last = 1
      ut.lutning = -0.2
    } else {
      // Hemma: lutar sig ner i boet och lämnar det hon bär.
      const t = (u - 0.82) / 0.18
      ut.mal = V.copy(hem).setY(hem.y - Math.sin(t * Math.PI) * 1.5)
      ut.vinge = 0.2
      ut.last = t < 0.5 ? 1 : 0
      ut.huvud = -0.7
    }
    return ut
  }

  update(dt, camera, natt = 0) {
    if (!this.grupp.visible) return
    this.tid += dt

    for (const f of this.faglar.values()) {
      const takt = SYSSLA_TAKT[f.lage] || 6
      const forra = f.u
      f.u += dt / takt
      if (f.u >= 1) {
        f.u -= 1
        f.rundNr = ((f.rundNr || 0) + 1) % 997
        // Boet växer av det hon burit hem. Det är trådens rader som styr slutstorleken;
        // det här är bara vägen dit, så att man SER när något lades till.
        if (f.lage === 'bygger') f.bovaxt = Math.min(0.14, f.bovaxt + 0.012)
      }
      void forra

      const r = this._runda(f, f.u)
      const g = f.fagel.grupp
      // Mjuk följning i stället för hopp: kurvan är redan len, men bytet mellan faser är det
      // inte, och det är i fasbytena en fågel annars ser mekanisk ut.
      f.pos.lerp(r.mal, Math.min(1, dt * 9))
      g.position.copy(f.pos)

      // Fågeln tittar dit hon är på väg när hon flyger, och mot boet när hon är hemma.
      V2.copy(r.mal).sub(f.forra)
      if (V2.lengthSq() > 0.0004) {
        const mot = Math.atan2(V2.x, V2.z)
        g.rotation.y = damp(g.rotation.y, mot - Math.PI / 2, 7, dt)
      }
      f.forra.copy(r.mal)
      g.rotation.z = damp(g.rotation.z, r.lutning, 6, dt)

      // Vingslag. Takten går upp med arbetet; en fälld vinge vilar i kroppens linje.
      f.vingfas += dt * (3 + r.vinge * 16)
      const slag = Math.sin(f.vingfas)
      for (const v of f.fagel.vingar) {
        const mal = r.vinge > 0.05 ? slag * 1.15 * r.vinge : -0.15
        v.axel.rotation.x = damp(v.axel.rotation.x, mal * v.sida, 18, dt)
      }
      f.fagel.stjart.rotation.z = damp(f.fagel.stjart.rotation.z, r.lutning * 0.8 + slag * 0.06, 8, dt)
      f.fagel.huvud.rotation.z = damp(f.fagel.huvud.rotation.z, r.huvud, 7, dt)
      // Näbben öppnas när hon sjunger och när hon matar.
      const gap = f.lage === 'sjunger' ? 0.3 + Math.sin(this.tid * 9) * 0.22 : r.last > 0.5 ? 0.2 : 0.02
      f.fagel.nabb.children[1].rotation.z = damp(f.fagel.nabb.children[1].rotation.z, -Math.PI / 2 - gap, 12, dt)

      const barLast = r.last > 0.5 && HAMTAR.has(f.lage)
      f.fagel.last.visible = barLast
      f.fagel.kvist.visible = barLast && f.lage !== 'matar'
      f.fagel.bar.visible = barLast && f.lage === 'matar'

      // ── boet ──────────────────────────────────────────────────────────────────────────
      const bo = f.bo
      const grund = BOSKALA * bostorlek(f.trad.rader) * (1 + f.bovaxt)
      bo.grupp.scale.setScalar(damp(bo.grupp.scale.x, grund, 3, dt))

      bo.ungarna.forEach((u, i) => {
        const synlig = i < f.ungar && f.lage !== 'sover'
        u.grupp.visible = synlig
        if (!synlig) return
        // Ungarna gapar när mamman är på väg hem med mat, och pillar omkring annars.
        const vantar = f.lage === 'matar' && f.u > 0.6
        const h = vantar ? 0.45 + Math.sin(this.tid * 7 + u.fas * 9) * 0.12 : 0.05 + Math.sin(this.tid * 1.6 + u.fas * 6) * 0.05
        u.grupp.position.y = damp(u.grupp.position.y, 0.1 + h, 9, dt)
        u.nabb.rotation.z = damp(u.nabb.rotation.z, vantar ? -0.5 : -1.1, 9, dt)
      })

      // Skatten ligger i boet så länge något på tavlan väntar på Filip — vad fågeln än
      // gör. Det är den signal som ska hålla när hon är ute och flyger.
      const harSkatt = f.skatter > 0
      bo.skatt.visible = harSkatt
      if (harSkatt) {
        bo.sten.rotation.y += dt * 0.9
        bo.sten.rotation.x = Math.sin(this.tid * 0.6) * 0.25
        // En glimt per väntande rad, jämnt fördelade över rundan. Fem rader = fem blinkningar.
        const n = Math.max(1, Math.min(6, f.skatter))
        const fas = (f.u * n) % 1
        bo.glimt.material.opacity = Math.pow(Math.max(0, 1 - Math.abs(fas - 0.12) * 9), 2)
      }

      // Lyktan: lugn puls normalt, snabb och röd när tråden står still.
      const larm = f.lage === 'larmar'
      bo.lykta.material.color.setHex(larm ? TAL.crit : f.trad.farg)
      // Additivt ljus blåser ut i vitt på nära håll. Lyktan tonas därför ner när kameran är
      // nära och upp när den är långt borta — den ska vara en prick på håll, inte en sol.
      const bas = (larm ? 0.42 : f.lage === 'sover' ? 0.1 : 0.2) * THREE.MathUtils.clamp(camera ? camera.position.distanceTo(f.pos) / 70 : 1, 0.25, 1)
      bo.lykta.material.opacity = bas + Math.sin(this.tid * (larm ? 7 : 1.5) + f.u * 4) * 0.1 + natt * 0.16

      // ── sången ────────────────────────────────────────────────────────────────────────
      const sjunger = f.lage === 'sjunger'
      f.sang.grupp.visible = sjunger
      if (sjunger) {
        f.sang.grupp.position.copy(f.pos).add(V2.set(0, 0.6, 0))
        f.sang.ringar.forEach((ring) => {
          const t = (f.u * 2 + ring.fas) % 1
          ring.mesh.scale.setScalar(0.6 + t * 7)
          ring.mesh.material.opacity = (1 - t) * 0.5
        })
      }

      // ── halo och etikett ──────────────────────────────────────────────────────────────
      const avst = camera ? camera.position.distanceTo(f.pos) : 40
      f.halo.position.copy(f.pos)
      // Minsta storlek PÅ SKÄRMEN, inte i världen: en läsbar prick på håll, en mjuk glorja nära.
      f.halo.scale.setScalar(Math.max(3.5, avst * 0.075))
      f.halo.material.opacity = 0.12 + natt * 0.24 + (f.lage === 'larmar' ? 0.18 : 0)
      f.halo.material.color.setHex(larm ? TAL.crit : f.trad.farg)

      // Skylten tonas ner när man är långt ifrån, så överblicken inte blir sju textremsor.
      f.etikett.material.opacity = THREE.MathUtils.clamp(1.25 - avst / 150, 0.45, 0.95)
    }
  }

  /** Vilken tråd pekaren träffar. Boet räknas, fågeln räknas — allt annat är bakgrund. */
  traffa(raycaster) {
    let bast = null
    let narmast = Infinity
    for (const f of this.faglar.values()) {
      const trafffar = raycaster.intersectObjects([f.bo.grupp, f.fagel.grupp], true)
      if (trafffar.length && trafffar[0].distance < narmast) {
        narmast = trafffar[0].distance
        bast = f.trad
      }
    }
    return bast
  }

  /** Vad varje fågel gör just nu, i ord — panelens överblick. */
  oversikt() {
    return [...this.faglar.values()].map((f) => ({
      id: f.trad.id,
      namn: f.trad.namn,
      farg: f.trad.farg,
      lage: f.lage,
      ord: SYSSLA_ORD[f.lage] || f.lage,
      ungar: f.ungar,
      skatter: f.skatter,
      rader: f.trad.rader,
      punkt: f.hem.clone(),
    }))
  }

  dispose() {
    this.scene.remove(this.grupp)
    this.faglar.clear()
  }
}

function bezier(a, b, c, t, ut) {
  const s = 1 - t
  ut.set(
    s * s * a.x + 2 * s * t * b.x + t * t * c.x,
    s * s * a.y + 2 * s * t * b.y + t * t * c.y,
    s * s * a.z + 2 * s * t * b.z + t * t * c.z
  )
  return ut
}

const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt))
