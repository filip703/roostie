/**
 * Trädet — Roostie 2.0:s värld.
 *
 * Kolonins plättar och maskinpark var en plats där saker STOD. Filips besked 15 sep var att
 * det här ska LEVA: "allt rörligt, super epic", och ett kolossalt träd sett underifrån.
 *
 * Det är en kravlista, inte en stämning:
 *   · trädet rör sig HELA TIDEN, inte bara när data ändras. Ett träd som står still mellan
 *     två polls är ett diagram med bark på.
 *   · kronan fyller himlen. Kameran börjar nere vid roten och tittar upp.
 *   · på natten lyser det inifrån. Bioluminiscens i barken, i lövkanterna, i fröna som
 *     driver uppåt — det är det som gör att ögat läser "levande" och inte "modell".
 *
 * Det är VÅRT träd. Idén om ett jättelikt levande träd är allmän; Avatars faktiska design är
 * någon annans, och kolonin ritar Roosts former i Roosts palett.
 *
 * HUR DET HÅLLER SEXTIO BILDER I SEKUNDEN PÅ EN KÖKSSKÄRM: allt trä är EN sammanslagen
 * geometri och ett anrop, alla löv är EN instansierad mesh, alla frön en till. Vinden ligger
 * i shadern — varje vertex bär hur böjlig den är (`aBoj`), noll vid rotens fäste och ett ute
 * i bladspetsen, så hela trädet vaggar av en enda uniform i stället för av hundra
 * matrisuppdateringar per bild.
 */
import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js'
import { TAL } from './palett.js'

/** Trädets höjd i världsenheter. Kolonins astronauter är ~1,7 — det här är ett berg. */
export const TRADHOJD = 58
const STAMRADIE = 3.4
const MAXDJUP = 5

/** Årstiderna. Lövfärgen är det enda som byts — formen är trädets, året runt. */
export const ARSTIDER = {
  var: { lov: [0x8fb07a, 0xa3bd84, 0x7fa07f], blom: 0xe6c7c0, tathet: 0.92, glod: 0.55 },
  sommar: { lov: [0x6e8f72, 0x7fa07f, 0x5f8069], blom: null, tathet: 1, glod: 0.45 },
  host: { lov: [0xc9785e, 0xd7a85f, 0xb0693e], blom: null, tathet: 0.9, glod: 0.7 },
  vinter: { lov: [0x8ea19a, 0x7d938c], blom: 0xe8ede8, tathet: 0.24, glod: 0.9 },
}

/** Vilken årstid kalendern säger. Trädet följer huset, inte en inställning. */
export function arstidNu(datum = new Date()) {
  const m = datum.getMonth()
  if (m <= 1 || m === 11) return 'vinter'
  if (m <= 4) return 'var'
  if (m <= 7) return 'sommar'
  return 'host'
}

const fro = (seed) => {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296)
}

const UPP = new THREE.Vector3(0, 1, 0)

/**
 * Vindshadern.
 *
 * Läggs på vilket standardmaterial som helst med `onBeforeCompile`, precis som byggnadernas
 * avslöjandeshader i 1.0. Två vågor med olika takt, för att en enda sinus läser som en
 * maskin som svänger — inte som luft.
 */
function vindShader(mat, uniforms, instansierad = false) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTid = uniforms.uTid
    shader.uniforms.uVind = uniforms.uVind
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTid;
         uniform float uVind;
         attribute float aBoj;
         vec3 roostVind(vec3 p, float boj, float fas) {
           float b = boj * uVind;
           p.x += sin(uTid * 0.9 + p.y * 0.055 + fas) * b;
           p.z += cos(uTid * 0.62 + p.y * 0.041 + fas * 1.7) * b * 0.8;
           p.x += sin(uTid * 2.3 + p.y * 0.2 + fas * 3.0) * b * 0.22;
           return p;
         }`
      )
      .replace(
        '#include <begin_vertex>',
        instansierad
          ? `#include <begin_vertex>
             float roostFas = instanceMatrix[3][0] * 0.7 + instanceMatrix[3][2] * 0.4;
             transformed = roostVind(transformed + vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]) * 0.0, aBoj, roostFas);`
          : `#include <begin_vertex>
             transformed = roostVind(transformed, aBoj, position.x * 0.3 + position.z * 0.2);`
      )
  }
  mat.customProgramCacheKey = () => 'roost-vind' + (instansierad ? '-i' : '')
}

/**
 * Bioluminiscensen i barken.
 *
 * Ådror som vandrar uppåt längs stammen och slocknar i dagsljus. Skrivet som ett tillägg i
 * fragmentshadern i stället för en textur: trädet är procedurellt och har ingen UV-karta
 * värd namnet, och en ådra som följer HÖJDEN läser som sav som stiger.
 */
function adershader(mat, uniforms) {
  const gammal = mat.onBeforeCompile
  mat.onBeforeCompile = (shader) => {
    if (gammal) gammal(shader)
    shader.uniforms.uTid = uniforms.uTid
    shader.uniforms.uNatt = uniforms.uNatt
    shader.uniforms.uPuls = uniforms.uPuls
    shader.uniforms.uAdra = uniforms.uAdra
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n varying float vHojd;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vHojd = position.y;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vHojd;
         uniform float uTid;
         uniform float uNatt;
         uniform float uPuls;
         uniform vec3 uAdra;`
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         float v = sin(vHojd * 0.42 - uTid * 1.1) * 0.5 + 0.5;
         v = pow(v, 6.0);
         float stig = smoothstep(0.0, 14.0, vHojd) * (1.0 - smoothstep(34.0, 58.0, vHojd));
         gl_FragColor.rgb += uAdra * v * stig * uNatt * (0.35 + uPuls * 0.85);`
      )
  }
  mat.customProgramCacheKey = () => 'roost-adror'
}

export class Tradet {
  constructor(scene) {
    this.scene = scene
    this.grupp = new THREE.Group()
    this.grupp.name = 'tradet'
    this.grupp.visible = false
    scene.add(this.grupp)

    this.uniforms = {
      uTid: { value: 0 },
      uVind: { value: 1 },
      uNatt: { value: 0.8 },
      uPuls: { value: 0 },
      uAdra: { value: new THREE.Color(TAL.honey) },
    }
    this.arstid = arstidNu()
    this.natt = 0.8
    this.puls = 0

    /** Grenändar som något kan sitta på: bon, holkar, lianor. Fylls av skelettet. */
    this.grenar = []
    this.toppar = []

    this._bygg()
  }

  // ── skelettet ────────────────────────────────────────────────────────────────────────
  /**
   * Grenverket, fröat.
   *
   * Samma frö ger samma träd varje gång containern startar — en koloni som ser annorlunda ut
   * efter varje omstart går inte att känna igen, och att känna igen sitt eget träd är halva
   * poängen med att ha ett.
   */
  _skelett() {
    const r = fro(0x7a11d)
    const bitar = []

    const gren = (start, riktning, langd, radie, djup) => {
      const slut = start.clone().addScaledVector(riktning, langd)
      bitar.push({ start: start.clone(), slut, radie, djup, riktning: riktning.clone() })
      this.grenar.push({ start: start.clone(), slut: slut.clone(), radie, djup, riktning: riktning.clone() })

      if (djup >= MAXDJUP || langd < 2.2) {
        this.toppar.push({ p: slut.clone(), djup, riktning: riktning.clone() })
        return
      }
      // Stammen delar sig i fyra huvudgrenar; längre ut blir det två eller tre.
      const antal = djup === 0 ? 4 : djup === 1 ? 3 : r() < 0.34 ? 3 : 2
      for (let i = 0; i < antal; i++) {
        const varv = (i / antal) * Math.PI * 2 + r() * 1.1 + djup * 1.3
        const lut = (djup === 0 ? 0.58 : 0.46) + r() * 0.36
        const ny = new THREE.Vector3(Math.cos(varv) * Math.sin(lut), Math.cos(lut), Math.sin(varv) * Math.sin(lut))
        // Dra mot förälderns riktning, annars startar varje gren om från noll och trädet
        // blir en buske.
        ny.lerp(riktning, djup === 0 ? 0.3 : 0.44).normalize()
        gren(slut, ny, langd * (0.7 + r() * 0.11), radie * (djup === 0 ? 0.52 : 0.63), djup + 1)
      }
    }

    gren(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.015, 1, 0.01).normalize(), TRADHOJD * 0.42, STAMRADIE, 0)
    return bitar
  }

  /** Hur böjlig en punkt är: noll vid rotfästet, ett i bladspetsen. Det är vinden. */
  _boj(djup, y) {
    const avDjup = djup / MAXDJUP
    const avHojd = Math.min(1, Math.max(0, y / TRADHOJD))
    return Math.pow(avDjup * 0.62 + avHojd * 0.38, 1.6)
  }

  _bygg() {
    const bitar = this._skelett()

    // ── trät: en enda sammanslagen geometri, ett anrop ──────────────────────────────
    const geos = []
    for (const b of bitar) {
      const langd = b.start.distanceTo(b.slut)
      const sidor = b.djup === 0 ? 11 : b.djup === 1 ? 8 : 5
      const g = new THREE.CylinderGeometry(b.radie * 0.68, b.radie, langd, sidor, 1, false)
      const q = new THREE.Quaternion().setFromUnitVectors(UPP, b.riktning.clone().normalize())
      const m = new THREE.Matrix4().compose(
        b.start.clone().addScaledVector(b.riktning, langd / 2),
        q,
        new THREE.Vector3(1, 1, 1)
      )
      g.applyMatrix4(m)
      const n = g.attributes.position.count
      const boj = new Float32Array(n)
      for (let i = 0; i < n; i++) boj[i] = this._boj(b.djup, g.attributes.position.getY(i))
      g.setAttribute('aBoj', new THREE.BufferAttribute(boj, 1))
      geos.push(g)
    }

    // Strävrötterna: de gör trädet kolossalt. Utan dem står stammen på marken som en stolpe.
    const rr = fro(0x110c7)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rr() * 0.3
      const ut = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
      const hojd = 7 + rr() * 5
      const langd = 9 + rr() * 6
      const strava = new THREE.CylinderGeometry(0.5, STAMRADIE * 0.75, hojd * 1.5, 5, 1, false)
      const riktning = new THREE.Vector3().copy(ut).multiplyScalar(0.72).add(new THREE.Vector3(0, 0.7, 0)).normalize()
      const q = new THREE.Quaternion().setFromUnitVectors(UPP, riktning)
      strava.applyMatrix4(
        new THREE.Matrix4().compose(new THREE.Vector3(ut.x * langd * 0.36, hojd * 0.42, ut.z * langd * 0.36), q, new THREE.Vector3(1, 1, 1))
      )
      const n = strava.attributes.position.count
      const boj = new Float32Array(n) // rötter rör sig inte
      strava.setAttribute('aBoj', new THREE.BufferAttribute(boj, 1))
      geos.push(strava)
    }

    const traMat = new THREE.MeshStandardMaterial({ color: 0x4a3726, roughness: 0.94, metalness: 0.02, flatShading: true })
    vindShader(traMat, this.uniforms)
    adershader(traMat, this.uniforms)
    this.traMat = traMat

    const tra = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(geos, false), traMat)
    tra.castShadow = true
    tra.receiveShadow = true
    this.grupp.add(tra)
    this.tra = tra
    geos.forEach((g) => g.dispose())

    this._lov()
    this._lianor()
    this._fron()
    this._markljus()
  }

  // ── lövverket ────────────────────────────────────────────────────────────────────────
  /**
   * Löven, som en enda instansierad mesh.
   *
   * Ett löv per instans hade varit tiotusen anrop. En klump per grenände, instansierad, är
   * ett — och i den här stilen är en klump ändå sanningen: kolonins byggnader är också
   * fasetterade block, inte tegelstenar.
   */
  _lov() {
    const r = fro(0xb1adf)
    const platser = []
    for (const t of this.toppar) {
      const n = t.djup >= MAXDJUP ? 4 : 2
      for (let i = 0; i < n; i++) {
        platser.push({
          p: t.p.clone().add(new THREE.Vector3((r() - 0.5) * 7, (r() - 0.5) * 5.5, (r() - 0.5) * 7)),
          s: 2.6 + r() * 2.8,
          rx: r() * 6.28,
          ry: r() * 6.28,
          slump: r(),
        })
      }
    }
    this.lovPlatser = platser

    const geo = new THREE.IcosahedronGeometry(1, 0)
    const n = geo.attributes.position.count
    const boj = new Float32Array(n)
    // Hela klumpen är lika böjlig: den sitter längst ut, och dess fas kommer ur instansen.
    boj.fill(1)
    geo.setAttribute('aBoj', new THREE.BufferAttribute(boj, 1))

    const mat = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0, flatShading: true, vertexColors: true })
    vindShader(mat, this.uniforms, true)
    this.lovMat = mat

    const mesh = new THREE.InstancedMesh(geo, mat, platser.length)
    mesh.castShadow = true
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    platser.forEach((l, i) => {
      e.set(l.rx, l.ry, l.rx * 0.5)
      q.setFromEuler(e)
      m.compose(l.p, q, new THREE.Vector3(l.s, l.s * 0.8, l.s))
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    this.grupp.add(mesh)
    this.lovMesh = mesh
    this.satArstid(this.arstid)
  }

  /** Lövfärgerna per instans. Årstidsbytet är en färgskrivning, inte ett ombygge. */
  satArstid(namn) {
    const A = ARSTIDER[namn] || ARSTIDER.sommar
    this.arstid = namn
    const farger = A.lov.map((c) => new THREE.Color(c))
    const blom = A.blom ? new THREE.Color(A.blom) : null
    const mesh = this.lovMesh
    if (!mesh) return
    const f = new THREE.Color()
    this.lovPlatser.forEach((l, i) => {
      // Gles vinter: klumpar som "fallit" göms genom att skalas till noll — billigare än att
      // bygga om instansbufferten, och de kommer tillbaka på våren.
      const kvar = l.slump < A.tathet
      f.copy(kvar ? (blom && l.slump > A.tathet - 0.08 ? blom : farger[i % farger.length]) : farger[0])
      mesh.setColorAt(i, f)
      if (!kvar) {
        const m = new THREE.Matrix4()
        mesh.getMatrixAt(i, m)
        m.scale(new THREE.Vector3(0.0001, 0.0001, 0.0001))
        mesh.setMatrixAt(i, m)
      }
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.instanceMatrix.needsUpdate = true
    this.uniforms.uAdra.value.set(namn === 'vinter' ? TAL.petrol : TAL.honey)
  }

  // ── lianor ───────────────────────────────────────────────────────────────────────────
  /** Hängande rankor från de tunga grenarna. De är det som gör att luften under kronan känns. */
  _lianor() {
    const r = fro(0x1a6a)
    const geos = []
    const bar = this.grenar.filter((g) => g.djup === 2)
    for (let i = 0; i < 26; i++) {
      const g = bar[Math.floor(r() * bar.length)]
      if (!g) continue
      const langd = 6 + r() * 16
      const geo = new THREE.CylinderGeometry(0.07, 0.16, langd, 4, 1, false)
      geo.translate(g.slut.x + (r() - 0.5) * 2, g.slut.y - langd / 2, g.slut.z + (r() - 0.5) * 2)
      const n = geo.attributes.position.count
      const boj = new Float32Array(n)
      for (let j = 0; j < n; j++) {
        // En ranka svajar mest längst ned: böjligheten är omvänd mot trädets.
        const y = geo.attributes.position.getY(j)
        boj[j] = 0.35 + Math.max(0, (g.slut.y - y) / langd) * 1.5
      }
      geo.setAttribute('aBoj', new THREE.BufferAttribute(boj, 1))
      geos.push(geo)
    }
    if (!geos.length) return
    const mat = new THREE.MeshStandardMaterial({ color: 0x3f5540, roughness: 0.9, flatShading: true })
    vindShader(mat, this.uniforms)
    const mesh = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(geos, false), mat)
    this.grupp.add(mesh)
    this.lianor = mesh
    geos.forEach((g) => g.dispose())
  }

  // ── frön ─────────────────────────────────────────────────────────────────────────────
  /**
   * Fröna som driver uppåt genom kronan.
   *
   * De bär ingen data — och det är med flit. Kolonins regel är att det som betyder något
   * kommer ur tavlan; fröna är luft och ljus, som löven. De är där för att ett levande träd
   * har något som rör sig även när ingen tråd skriver en rad.
   */
  _fron() {
    const ANTAL = 150
    const r = fro(0xf20e)
    const geo = new THREE.OctahedronGeometry(0.16, 0)
    const boj = new Float32Array(geo.attributes.position.count)
    geo.setAttribute('aBoj', new THREE.BufferAttribute(boj, 1))
    const mat = new THREE.MeshBasicMaterial({
      color: TAL.cream,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    const mesh = new THREE.InstancedMesh(geo, mat, ANTAL)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    this.fron = []
    for (let i = 0; i < ANTAL; i++) {
      const a = r() * Math.PI * 2
      const d = 4 + r() * 30
      this.fron.push({
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        y: r() * TRADHOJD,
        fart: 1.1 + r() * 2.4,
        sving: r() * 6.28,
        s: 0.6 + r() * 1.1,
      })
    }
    this.grupp.add(mesh)
    this.fronMesh = mesh
    this.fronMat = mat
  }

  /** Marken under trädet lyser svagt när rötterna arbetar — kolonins databasskrivningar. */
  _markljus() {
    const mat = new THREE.MeshBasicMaterial({
      color: TAL.honey,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const skiva = new THREE.Mesh(new THREE.CircleGeometry(26, 32), mat)
    skiva.rotation.x = -Math.PI / 2
    skiva.position.y = 0.15
    this.grupp.add(skiva)
    this.markMat = mat
  }

  // ── plats för det som ska sitta i trädet ─────────────────────────────────────────────
  /**
   * Grenändar att sätta bon på: en per tråd, spridda runt stammen så inga två skymmer
   * varandra sett från marken. Sorterade på vinkel, sedan jämnt utplockade.
   */
  boplatser(antal) {
    const kand = this.grenar
      .filter((g) => g.djup === 2 && g.slut.y > TRADHOJD * 0.3)
      .sort((a, b) => Math.atan2(a.slut.z, a.slut.x) - Math.atan2(b.slut.z, b.slut.x))
    if (!kand.length) return []
    const ut = []
    const steg = kand.length / Math.max(1, antal)
    for (let i = 0; i < antal; i++) {
      const g = kand[Math.min(kand.length - 1, Math.floor(i * steg + steg / 2))]
      ut.push({ punkt: g.slut.clone(), riktning: g.riktning.clone() })
    }
    return ut
  }

  /** Stamhålet högst upp i stammen — Lednings plats, som beställt. */
  stamhal() {
    const stam = this.grenar.find((g) => g.djup === 0)
    const p = stam ? stam.slut.clone() : new THREE.Vector3(0, TRADHOJD * 0.4, 0)
    p.y -= 4
    return p
  }

  /** Kraftiga grenar att hänga något tungt i: holkarna, skyltarna. */
  hangplatser(antal) {
    const kand = this.grenar.filter((g) => g.djup === 1).sort((a, b) => b.slut.y - a.slut.y)
    return kand.slice(0, antal).map((g) => g.slut.clone())
  }

  /** Utsiktspunkter för köksläget: roten, kronan, stamhålet. */
  utsikter() {
    return [
      { namn: 'trädet', punkt: new THREE.Vector3(0, TRADHOJD * 0.42, 0), avstand: TRADHOJD * 1.25 },
      { namn: 'roten', punkt: new THREE.Vector3(0, 5, 0), avstand: 30 },
      { namn: 'kronan', punkt: new THREE.Vector3(0, TRADHOJD * 0.74, 0), avstand: 44 },
      { namn: 'stamhålet', punkt: this.stamhal(), avstand: 22 },
    ]
  }

  // ── liv ──────────────────────────────────────────────────────────────────────────────
  /**
   * Natten och pulsen utifrån.
   *
   * `natt` kommer ur himlen (samma `nightFactor` som resten av kolonin lyser efter), `puls`
   * ur skärmtiden: ett slag när en minut lämnat någons konto. Trädet blossar då — det är
   * samma regel som fyrens, flyttad in i barken.
   */
  setNatt(natt) {
    this.natt = Math.min(1, Math.max(0, natt))
  }

  slag() {
    this.puls = 1
  }

  update(dt) {
    if (!this.grupp.visible) return
    const u = this.uniforms
    u.uTid.value += dt
    this.puls = Math.max(0, this.puls - dt * 1.1)
    u.uPuls.value = this.puls
    const A = ARSTIDER[this.arstid] || ARSTIDER.sommar
    u.uNatt.value = this.natt * A.glod
    // Vinden andas: byar som kommer och går, annars läser rörelsen som en motor.
    u.uVind.value = 0.85 + Math.sin(u.uTid.value * 0.13) * 0.5 + Math.sin(u.uTid.value * 0.41) * 0.22

    if (this.markMat) this.markMat.opacity = (0.06 + this.puls * 0.2) * (0.35 + this.natt * 0.65)

    // Fröna driver uppåt och börjar om nere. Enda stället kolonin räknar per objekt — hundra
    // femtio matriser i en instansbuffert är billigare än en shader som ingen kan läsa.
    if (this.fronMesh) {
      const m = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      const skala = new THREE.Vector3()
      const p = new THREE.Vector3()
      this.fron.forEach((f, i) => {
        f.y += dt * f.fart
        if (f.y > TRADHOJD * 1.05) f.y = -2
        const sv = Math.sin(u.uTid.value * 0.7 + f.sving) * 2.2
        p.set(f.x + sv, f.y, f.z + Math.cos(u.uTid.value * 0.5 + f.sving) * 2.2)
        q.setFromAxisAngle(UPP, u.uTid.value * 0.8 + f.sving)
        skala.setScalar(f.s)
        m.compose(p, q, skala)
        this.fronMesh.setMatrixAt(i, m)
      })
      this.fronMesh.instanceMatrix.needsUpdate = true
      this.fronMat.opacity = 0.14 + this.natt * 0.72
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
  }
}
