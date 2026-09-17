/**
 * BOET — KONCEPTSCEN, inte produktionskod.
 *
 * Lednings rad 536 och Bills tillägg 537: Boet ska vara barnets FÖRSTA sida, i 3D, och
 * boet ska VÄXA medan man håller in knappen. Ordningen på tavlan är uttrycklig —
 * konceptfilm först, Bill säger ja, sedan bygger vi. Den här filen är filmen.
 *
 * Den ligger i Kolonins eget repo och rör inte nexus. Allt är styrt av EN tidsvariabel
 * (`stall(t)`), så varje bildruta går att rendera om exakt likadant: en film som inte går
 * att ta om är ingen film att visa för någon.
 */
import * as THREE from 'three'

const P = {
  cream: 0xf4ede1, sand: 0xe0d0bc, clay: 0xc9785e, honey: 0xd7a85f,
  gron: 0x7fa07f, petrol: 0x4e7f8a, forest: 0x35584a, camel: 0xc4a678,
  espresso: 0x2a2520, bark: 0x9c7f5e, barkMork: 0x7a6146,
}
const KVIST = [0xc2a173, 0xa8895f, 0x8a6f4e, 0x6f5a45]
const FJADERFARG = [P.clay, P.camel, P.honey, P.forest, P.petrol]

const duk = document.getElementById('duk')
const renderare = new THREE.WebGLRenderer({ canvas: duk, antialias: true })
renderare.setPixelRatio(1)
renderare.shadowMap.enabled = true
renderare.shadowMap.type = THREE.PCFSoftShadowMap
renderare.toneMapping = THREE.ACESFilmicToneMapping
renderare.toneMappingExposure = 1.5

const scen = new THREE.Scene()
scen.background = new THREE.Color(0x8a9d7a)
scen.fog = new THREE.Fog(0x8a9d7a, 40, 130)

const kamera = new THREE.PerspectiveCamera(38, 4 / 3, 0.1, 400)
kamera.position.set(0, 9.6, 15.5)
kamera.lookAt(0, 3.9, 0.6)

/** Dagsljus. Rad 536 punkt 7: läsbart på iPad i dagsljus — ljuset ska förstärka, inte äta. */
scen.add(new THREE.HemisphereLight(0xfff2d8, 0x6a7a58, 1.5))
const sol = new THREE.DirectionalLight(0xfff0d0, 2.4)
sol.position.set(9, 18, 12)
sol.castShadow = true
sol.shadow.mapSize.set(1024, 1024)
sol.shadow.camera.near = 4
sol.shadow.camera.far = 60
sol.shadow.camera.left = -18
sol.shadow.camera.right = 18
sol.shadow.camera.top = 18
sol.shadow.camera.bottom = -18
scen.add(sol)
const fyll = new THREE.DirectionalLight(0xcfe0c8, 0.85)
fyll.position.set(-10, 6, -8)
scen.add(fyll)

const slump = (frö) => {
  let s = frö
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
}
const r = slump(20260917)

/* ── barken bakom, och grenen boet står på ─────────────────────────────────────────── */

const barkMat = new THREE.MeshStandardMaterial({ color: P.bark, roughness: 0.96, flatShading: true })
const stam = new THREE.Mesh(new THREE.CylinderGeometry(15, 17, 90, 22, 1, true), barkMat)
stam.position.set(1, 6, -19)
stam.receiveShadow = true
scen.add(stam)
for (let i = 0; i < 26; i++) {
  const h = 30 + r() * 60
  const ribb = new THREE.Mesh(
    new THREE.BoxGeometry(0.5 + r() * 0.7, h, 0.5),
    new THREE.MeshStandardMaterial({ color: r() < 0.5 ? P.bark : P.barkMork, roughness: 1, flatShading: true })
  )
  const v = -1.1 + r() * 2.2
  ribb.position.set(1 + Math.sin(v) * 15.6, 6 + (r() - 0.5) * 20, -19 + Math.cos(v) * 15.6)
  ribb.rotation.y = -v
  scen.add(ribb)
}

const gren = new THREE.Group()
gren.position.set(0, 0, 0)
scen.add(gren)
const grenKurva = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-17, 0.9, -6),
  new THREE.Vector3(-7, 2.3, -1),
  new THREE.Vector3(2, 2.6, 1),
  new THREE.Vector3(12, 2.1, -1.5),
  new THREE.Vector3(19, 0.9, -6),
])
const grenMesh = new THREE.Mesh(new THREE.TubeGeometry(grenKurva, 60, 0.95, 8, false), barkMat)
grenMesh.castShadow = true
grenMesh.receiveShadow = true
gren.add(grenMesh)

/* ── lövklasar, bara som ram i kanterna ────────────────────────────────────────────── */
const lovMat = new THREE.MeshStandardMaterial({ color: 0x53703f, roughness: 0.9, flatShading: true })
const lovMat2 = new THREE.MeshStandardMaterial({ color: 0x6b8a4a, roughness: 0.9, flatShading: true })
for (let i = 0; i < 34; i++) {
  const s = 1.4 + r() * 2.6
  const l = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), r() < 0.5 ? lovMat : lovMat2)
  l.geometry.scale(1.2, 0.8, 1.1)
  const sida = r() < 0.5 ? -1 : 1
  l.position.set(sida * (11 + r() * 10), -1 + r() * 16, -4 + r() * 10)
  l.rotation.set(r() * 3, r() * 3, r() * 3)
  l.castShadow = true
  scen.add(l)
}

/* ── BOET ──────────────────────────────────────────────────────────────────────────────
 *
 * Designs fem steg, men LAGDA och inte ritade: varje kvist har sin egen landning. Det är
 * skillnaden rad 536 punkt 2 ber om — ett bo som växer medan man tittar, inte fem bilder
 * som byts ut. Kvistarna ligger i en fast ordning så att samma sekund alltid ger samma bo.
 */
const BO_MITT = new THREE.Vector3(0, 3.4, 0.6)
const boGrupp = new THREE.Group()
boGrupp.position.copy(BO_MITT)
scen.add(boGrupp)

const KVISTAR = []
const VARV = 10
const PER_VARV = 21
for (let v = 0; v < VARV; v++) {
  const t = v / (VARV - 1)
  const rad = 3.3 * (0.44 + 0.56 * Math.sqrt(t))
  for (let i = 0; i < PER_VARV; i++) {
    const a = (i / PER_VARV) * Math.PI * 2 + v * 0.44
    const m = new THREE.Mesh(
      /**
       * Längden är omkretsens egen, inte en gissning.
       *
       * Första försöket gav varje kvist 1,9–3,0 enheter i ett bo med radien 3,25 — längre än
       * halva boet. Då korsar varje kvist mitten, hålet fylls igen och resultatet blir en
       * vedhög, vilket är exakt vad renderingen visade. En kvist ska täcka sin BIT av varvet:
       * omkretsen delad på antalet, med lite överlapp så väven håller ihop.
       */
      new THREE.BoxGeometry(((2 * Math.PI * rad) / PER_VARV) * (1.35 + r() * 0.35), 0.17, 0.2),
      new THREE.MeshStandardMaterial({ color: KVIST[(v + i) % 4], roughness: 0.95, flatShading: true })
    )
    m.castShadow = true
    m.receiveShadow = true
    const mal = new THREE.Vector3(Math.cos(a) * rad, t * 2.05, Math.sin(a) * rad)
    m.userData.mal = mal
    /**
     * Kvisten ligger LÄNGS varvet, inte ut från mitten.
     *
     * `rotation.y = -a` vrider lådans långsida till (cos a, 0, sin a) — det är RADIEN, alltså
     * rakt ut från boets mitt. Renderingen blev därför en ekersol: alla kvistar pekade utåt
     * som ett cykelhjul, och ingen av dem följde varvet. Tangenten ligger ett kvarts varv
     * därifrån, och det är den enda skillnaden mellan en hög pinnar och en väv.
     */
    m.userData.vridMal = -a - Math.PI / 2 + (r() - 0.5) * 0.18
    m.userData.lutMal = 0.12 + (1 - t) * 0.1
    m.userData.ordning = v * PER_VARV + i
    boGrupp.add(m)
    KVISTAR.push(m)
  }
}
const KVIST_ANTAL = KVISTAR.length

// Botten i boet: varm, aldrig grå. Ett grått hål ser ut som ett fel.
const boBotten = new THREE.Mesh(
  new THREE.CylinderGeometry(2.55, 1.1, 1.45, 24, 1, true),
  new THREE.MeshStandardMaterial({ color: 0x5a4736, roughness: 1, side: THREE.BackSide })
)
boBotten.position.y = 0.8
boBotten.receiveShadow = true
boGrupp.add(boBotten)
const boSkal = new THREE.Mesh(
  new THREE.CircleGeometry(1.2, 20),
  new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 })
)
boSkal.rotation.x = -Math.PI / 2
boSkal.position.y = 0.16
boGrupp.add(boSkal)

/** Syskonets bo — mindre, bredvid, och alltid färdigt. Rad 536 punkt 6. */
const syskon = new THREE.Group()
syskon.position.set(7.6, 2.8, -2.6)
syskon.scale.setScalar(0.52)
scen.add(syskon)
for (let v = 0; v < 5; v++) {
  const t = v / 4
  const rad = 3.1 * (0.56 + 0.44 * Math.sqrt(t))
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + v * 0.5
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(((2 * Math.PI * rad) / 10) * 1.4, 0.17, 0.2),
      new THREE.MeshStandardMaterial({ color: KVIST[(v + i) % 4], roughness: 0.95, flatShading: true })
    )
    m.position.set(Math.cos(a) * rad, t * 2.05, Math.sin(a) * rad)
    m.rotation.y = -a - Math.PI / 2
    m.castShadow = true
    syskon.add(m)
  }
}

/* ── FJÄDRARNA ────────────────────────────────────────────────────────────────────────
 * De ligger på grenen och flyger in EN OCH EN. Antalet är läsbart i toppraden, och det är
 * kopplingen mellan handling och siffra som gör det till ett spel i stället för ett formulär.
 */
function byggFjader(farg) {
  const g = new THREE.Group()
  const blad = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 1.7, 5),
    new THREE.MeshStandardMaterial({ color: farg, roughness: 0.55, flatShading: true })
  )
  blad.scale.z = 0.26
  blad.castShadow = true
  g.add(blad)
  const spole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 2.1, 4),
    new THREE.MeshStandardMaterial({ color: P.cream, roughness: 0.6 })
  )
  spole.position.y = -0.2
  g.add(spole)
  return g
}
const FJADRAR = []
for (let i = 0; i < 9; i++) {
  const f = byggFjader(FJADERFARG[i % FJADERFARG.length])
  f.scale.setScalar(1.25)
  const x = -7.4 + i * 0.95
  f.userData.start = new THREE.Vector3(x, 3.4, 1.4)
  f.userData.vila = 0.5 + r() * 0.5
  f.position.copy(f.userData.start)
  // Upprätta, lätt lutande. En fjäder som ligger platt läses som en triangel på en planka.
  f.rotation.set(0.25, r() * 2, -0.35 + r() * 0.7)
  scen.add(f)
  FJADRAR.push(f)
}

/* ── ÄGGET ────────────────────────────────────────────────────────────────────────────*/
const aggGrupp = new THREE.Group()
aggGrupp.position.set(0, 4.55, 0.6)
scen.add(aggGrupp)
const agg = new THREE.Mesh(
  new THREE.SphereGeometry(1.25, 22, 18),
  new THREE.MeshStandardMaterial({ color: P.cream, roughness: 0.42 })
)
agg.geometry.scale(1, 1.28, 1)
agg.castShadow = true
aggGrupp.add(agg)
const sprickor = []
for (let i = 0; i < 7; i++) {
  const s = new THREE.Mesh(
    new THREE.BoxGeometry(0.5 + r() * 0.5, 0.075, 0.075),
    new THREE.MeshStandardMaterial({ color: 0x6b5947, roughness: 1 })
  )
  const a = r() * Math.PI * 2
  const y = 0.1 + r() * 0.9
  s.position.set(Math.cos(a) * 1.05, y, Math.sin(a) * 1.05)
  s.rotation.set(0, -a, -0.6 + r() * 1.2)
  s.visible = false
  aggGrupp.add(s)
  sprickor.push(s)
}
const glod = new THREE.Mesh(
  new THREE.SphereGeometry(1.5, 18, 14),
  new THREE.MeshBasicMaterial({ color: 0xffe0a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
)
aggGrupp.add(glod)

/* ── FÅGELN ──────────────────────────────────────────────────────────────────────────*/
function byggFagel(farg) {
  const g = new THREE.Group()
  const kroppMat = new THREE.MeshStandardMaterial({ color: farg, roughness: 0.62, flatShading: true })
  const kropp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), kroppMat)
  kropp.geometry.scale(1.15, 1, 1.35)
  kropp.castShadow = true
  g.add(kropp)
  const huvud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), kroppMat)
  huvud.position.set(0, 0.78, 0.5)
  huvud.castShadow = true
  g.add(huvud)
  const nabb = new THREE.Mesh(
    new THREE.ConeGeometry(0.19, 0.6, 4),
    new THREE.MeshStandardMaterial({ color: P.honey, roughness: 0.4, flatShading: true })
  )
  nabb.rotation.x = Math.PI / 2
  nabb.position.set(0, 0.7, 1.08)
  g.add(nabb)
  for (const s of [-1, 1]) {
    const oga = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 8),
      new THREE.MeshStandardMaterial({ color: P.espresso, roughness: 0.3 })
    )
    oga.position.set(s * 0.29, 0.88, 0.86)
    g.add(oga)
  }
  const stjart = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 4), kroppMat)
  stjart.rotation.x = -Math.PI / 2.4
  stjart.position.set(0, 0.22, -1.1)
  g.add(stjart)
  const vingar = []
  for (const s of [-1, 1]) {
    const v = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.25, 4), kroppMat)
    v.geometry.scale(1, 1, 0.42)
    v.position.set(s * 0.85, 0.16, 0)
    v.rotation.z = s * 1.15
    v.castShadow = true
    g.add(v)
    vingar.push(v)
  }
  g.userData.vingar = vingar
  g.userData.huvud = huvud
  return g
}
const fagel = byggFagel(P.petrol)
fagel.scale.setScalar(0.001)
fagel.position.set(0, 4.0, 0.6)
scen.add(fagel)

/** Gåvan fågeln ger. Rad 536 punkt 5 — med animation, inte som en rad text. */
const gava = new THREE.Group()
gava.position.set(3.55, 5.3, 1.9)
gava.scale.setScalar(0.001)
scen.add(gava)
const lada = new THREE.Mesh(
  new THREE.BoxGeometry(1.55, 1.4, 1.55),
  new THREE.MeshStandardMaterial({ color: P.gron, roughness: 0.5, flatShading: true })
)
lada.castShadow = true
gava.add(lada)
for (const v of [0, Math.PI / 2]) {
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(1.64, 1.5, 0.26),
    new THREE.MeshStandardMaterial({ color: P.honey, roughness: 0.4 })
  )
  band.rotation.y = v
  gava.add(band)
}

/* ── KONFETTI av fjädrar vid nivå-upp ─────────────────────────────────────────────────*/
const KONFETTI = []
for (let i = 0; i < 40; i++) {
  const k = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.78, 4),
    new THREE.MeshBasicMaterial({ color: FJADERFARG[i % FJADERFARG.length], transparent: true, opacity: 0 })
  )
  k.geometry.scale(1, 1, 0.3)
  k.userData.v = new THREE.Vector3((r() - 0.5) * 13, 5.5 + r() * 6.5, (r() - 0.5) * 7)
  k.userData.snurr = (r() - 0.5) * 9
  scen.add(k)
  KONFETTI.push(k)
}

/* ── UI ───────────────────────────────────────────────────────────────────────────────*/
const ui = {
  niva: document.getElementById('uNiva'),
  fjadrar: document.getElementById('uFjadrar'),
  knapp: document.getElementById('uKnapp'),
  knappText: document.getElementById('uKnappText'),
  upp: document.getElementById('uUpp'),
  uppText: document.getElementById('uUppText'),
  klocka: document.getElementById('uKlocka'),
  tid: document.getElementById('uTid'),
  namn: document.getElementById('uNamn'),
  gava: document.getElementById('uGava'),
  syskon: document.getElementById('uSyskon'),
  lager: document.getElementById('ui'),
}

/* ── TIDSLINJEN ───────────────────────────────────────────────────────────────────────
 *
 * Elva sekunder, och varje beat har en egen sekund så att Bill hinner se vad som händer.
 * Allt läses ur `t`; ingenting sparas mellan bildrutor. Det är därför filmen går att
 * rendera bildruta för bildruta och bli exakt likadan varje gång.
 */
export const LANGD = 11.0
const mjuk = (a, b, t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}
const puls = (a, b, t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return Math.sin(x * Math.PI)
}

function stall(t) {
  // Fjädrarna flyger in mellan 1.4 och 6.2 — en per halv sekund, med sin egen båge.
  const HALL_START = 1.4
  const HALL_SLUT = 6.2
  const perFjader = (HALL_SLUT - HALL_START) / FJADRAR.length
  let inne = 0
  FJADRAR.forEach((f, i) => {
    const b = HALL_START + i * perFjader
    const k = mjuk(b, b + perFjader * 1.5, t)
    if (k >= 1) inne += 1
    const start = f.userData.start
    // Bågen går UPP innan den går in — en fjäder som glider rakt fram ser ut som en fil
    // som flyttas, inte som något som flyger.
    const hojd = Math.sin(k * Math.PI) * (2.6 + f.userData.vila * 2)
    f.position.set(
      start.x + (BO_MITT.x - start.x) * k,
      start.y + (BO_MITT.y + 1.1 - start.y) * k + hojd,
      start.z + (BO_MITT.z - start.z) * k
    )
    f.rotation.z = -0.5 + k * (3.4 + f.userData.vila)
    f.rotation.x = 0.25 + k * 0.5
    const skala = k >= 1 ? Math.max(0, 1 - (t - (b + perFjader * 1.5)) * 2.2) : 1
    f.scale.setScalar(Math.max(0.0001, skala * 1.25))
    f.visible = t > 0.2 && skala > 0.02
  })

  // Boet växer med fjädrarna. Kvistarna landar en i taget, uppifrån, med en liten studs.
  /**
   * Boet borjar INTE fran noll.
   *
   * Filmen oppnar pa niva 2 med fyrtio fjadrar i toppraden. Ett tomt bo bredvid den siffran
   * ar en logn i samma bild, och ett barn ser den direkt. Trettioatta procent av vaven finns
   * alltsa redan nar filmen borjar, och de nio fjadrarna bygger resten.
   */
  const BORJAN = 0.38
  const vaxt = BORJAN + (1 - BORJAN) * Math.min(1, inne / FJADRAR.length)
  const synliga = Math.round(vaxt * KVIST_ANTAL)
  KVISTAR.forEach((k) => {
    const i = k.userData.ordning
    if (i >= synliga) {
      k.visible = false
      return
    }
    k.visible = true
    // Hur nyss den landade: 0 = just nu, 1 = sedan länge.
    const alder = Math.min(1, (synliga - i) / 9)
    const s = 1 - Math.pow(1 - alder, 3)
    const mal = k.userData.mal
    k.position.set(mal.x, mal.y + (1 - s) * 3.4, mal.z)
    k.rotation.set((1 - s) * 1.4, k.userData.vridMal, k.userData.lutMal + (1 - s) * 0.9)
    const studs = alder < 0.35 ? 1 + Math.sin(alder / 0.35 * Math.PI) * 0.16 : 1
    k.scale.setScalar(studs)
  })
  // Mörkret i hålet växer med väven. Står det färdigt bakom en halvbyggd kant ser det ut
  // som en skål någon ställt dit, inte som ett bo som byggs.
  boBotten.visible = synliga > KVIST_ANTAL * 0.2
  boSkal.visible = boBotten.visible
  const bosk = 0.72 + vaxt * 0.28
  boBotten.scale.set(bosk, bosk, bosk)
  boSkal.scale.setScalar(bosk)

  // Ägget: kommer när boet är fullt, vickar, spricker, brister i ljus.
  const aggIn = mjuk(6.3, 6.9, t)
  const vickar = t > 6.9 && t < 8.5
  aggGrupp.visible = aggIn > 0.01 && t < 9.05
  aggGrupp.scale.setScalar(aggIn)
  aggGrupp.position.y = 4.55 - (1 - aggIn) * 0.5
  aggGrupp.rotation.z = vickar ? Math.sin((t - 6.9) * 11) * 0.17 * mjuk(6.9, 7.3, t) : 0
  const spricktal = Math.floor(mjuk(7.6, 8.5, t) * sprickor.length)
  sprickor.forEach((s, i) => (s.visible = i < spricktal))
  glod.material.opacity = puls(8.35, 9.05, t) * 0.55
  glod.scale.setScalar(1 + puls(8.35, 9.05, t) * 0.55)

  // Fågeln: kläcks, reser sig, GÅR RUNT i boet — rad 536 punkt 5.
  const ut = mjuk(8.75, 9.25, t)
  fagel.visible = ut > 0.01
  fagel.scale.setScalar(Math.max(0.0001, ut * 1.15))
  const gang = Math.max(0, t - 9.2)
  const vinkel = gang * 1.5
  fagel.position.set(
    Math.sin(vinkel) * 1.15,
    4.55 + ut * 0.45 + Math.abs(Math.sin(gang * 7)) * 0.18 * Math.min(1, gang * 3),
    0.6 + Math.cos(vinkel) * 0.5
  )
  fagel.rotation.y = vinkel + 0.5
  const vingslag = Math.sin(t * 16) * 0.3 * Math.min(1, Math.max(0, (t - 8.9) * 2))
  fagel.userData.vingar.forEach((v, i) => (v.rotation.z = (i ? 1 : -1) * (1.15 - vingslag)))
  fagel.userData.huvud.rotation.z = Math.sin(t * 5.5) * 0.12

  // Gåvan
  const g = mjuk(9.9, 10.3, t)
  gava.visible = g > 0.01
  gava.scale.setScalar(Math.max(0.0001, g * (1 + puls(9.9, 10.5, t) * 0.22)))
  gava.position.y = 5.3 + Math.sin(Math.max(0, t - 10.3) * 6) * 0.16

  // Konfettin vid nivå-upp
  const kf = Math.max(0, t - 6.25)
  const visaKonf = t > 6.25 && t < 7.6
  KONFETTI.forEach((k) => {
    k.visible = visaKonf
    if (!visaKonf) return
    const v = k.userData.v
    k.position.set(
      BO_MITT.x + v.x * kf * 0.55,
      BO_MITT.y + v.y * kf * 0.55 - 5.2 * kf * kf,
      BO_MITT.z + v.z * kf * 0.55
    )
    k.rotation.z = kf * k.userData.snurr
    k.rotation.x = kf * k.userData.snurr * 0.6
    k.material.opacity = Math.max(0, 1 - kf * 0.85)
  })

  // Syskonets bo tonar in tidigt och står kvar — det ska finnas, inte ta över.
  syskon.visible = t > 0.4

  /* ── gränssnittet ──────────────────────────────────────────────────────────────── */
  const NIVAER = [0, 10, 30, 65, 120, 200]
  const fjaderTal = Math.round(40 + (inne / FJADRAR.length) * 32)
  let niva = 1
  for (let i = 0; i < NIVAER.length; i++) if (fjaderTal >= NIVAER[i]) niva = i
  ui.fjadrar.textContent = String(fjaderTal)
  ui.niva.textContent = `Nivå ${niva}`

  const haller = t > HALL_START - 0.15 && t < HALL_SLUT + 0.2
  ui.knapp.style.opacity = t > 0.65 && t < 6.6 ? '1' : '0'
  ui.knapp.style.transform = `translateX(-50%) scale(${haller ? 0.955 : 1})`
  ui.knapp.style.background = haller ? '#e8bd72' : '#d7a85f'
  ui.knappText.textContent = haller ? 'HÅLL IN …' : 'HÅLL IN FÖR ATT LÄGGA I BOET'
  const ring = ui.knapp.querySelector('.ring')
  ring.style.opacity = haller ? '1' : '0.25'
  ring.style.transform = `scale(${1 + (haller ? puls(HALL_START, HALL_SLUT, t) * 0.06 : 0)})`

  const uppSyns = t > 6.25 && t < 7.5
  ui.upp.style.opacity = uppSyns ? String(Math.min(1, (t - 6.25) * 5, (7.5 - t) * 4)) : '0'
  ui.upp.style.transform = `translate(-50%,-50%) scale(${uppSyns ? 1 + puls(6.25, 7.5, t) * 0.12 : 0.9})`
  ui.uppText.textContent = `Nivå ${niva}!`

  const klockaSyns = t > 7.62 && t < 8.72
  ui.klocka.style.opacity = klockaSyns ? '1' : '0'
  ui.klocka.style.top = '24%'
  ui.tid.textContent = t < 8.05 ? '58 min' : t < 8.45 ? '2 min' : 'nu!'

  const namnSyns = t > 9.45
  ui.namn.style.opacity = namnSyns ? String(Math.min(1, (t - 9.45) * 4)) : '0'
  ui.namn.style.top = '24%'
  ui.namn.style.transform = `translateX(-50%) scale(${namnSyns ? 1 + puls(9.45, 10.0, t) * 0.1 : 0.9})`

  const gavaSyns = t > 10.25
  ui.gava.style.opacity = gavaSyns ? String(Math.min(1, (t - 10.25) * 5)) : '0'
  ui.gava.style.top = '70%'

  ui.syskon.style.right = '9%'
  ui.syskon.style.top = '57%'
  ui.syskon.style.opacity = t > 1.0 ? '0.85' : '0'

  ui.lager.style.opacity = String(Math.min(1, t * 3))
  renderare.domElement.style.opacity = String(Math.min(1, t * 2.4))

  // Kameran andas in mot boet under hela filmen och lyfter lite vid kläckningen.
  const in_ = mjuk(0, LANGD, t)
  kamera.position.set(
    Math.sin(t * 0.09) * 0.55,
    9.6 - in_ * 1.1 + mjuk(8.4, 9.4, t) * 0.4,
    15.5 - in_ * 2.6
  )
  kamera.lookAt(0, 3.9 + mjuk(8.4, 9.6, t) * 0.35, 0.6)
}

function storlek() {
  const b = window.innerWidth
  const h = window.innerHeight
  renderare.setSize(b, h, false)
  kamera.aspect = b / h
  kamera.updateProjectionMatrix()
}
window.addEventListener('resize', storlek)
storlek()

/** Riggen styr tiden härifrån; utan rigg spelar filmen själv, i loop. */
window.__boet = {
  langd: LANGD,
  stall(t) {
    stall(t)
    renderare.render(scen, kamera)
  },
}

let auto = true
window.__boet.auto = (p) => (auto = p)
const start = performance.now()
function snurra() {
  if (auto) {
    const t = ((performance.now() - start) / 1000) % (LANGD + 1.2)
    stall(Math.min(t, LANGD))
    renderare.render(scen, kamera)
  }
  requestAnimationFrame(snurra)
}
snurra()
