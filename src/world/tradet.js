/**
 * MEGA-TRÄDET — Roosts krona, sedd inifrån.
 *
 * DET SOM VAR FEL. Första trädet var ett helt träd: sextiotvå enheter från rot till topp,
 * hela silhuetten i bild. Det gav tre fel på en gång, och alla tre var samma fel i olika
 * förklädnad. Fåglarna blev några pixlar (de skulle rymmas i samma bild som ett helt träd).
 * Navigeringen blev omöjlig (det fanns inget att titta PÅ, bara något att titta på UTIFRÅN).
 * Överblicken fanns inte (sju bon på var sitt håll runt en stam går inte att se samtidigt).
 *
 * DET SOM ÄR NYTT, och det är Filips idé: trädet är så stort att det inte får plats. Vi ser
 * en barkvägg som går ur bild uppåt och nedåt, och sju grenar som sticker ut ur den mot oss.
 * Det är allt. Resten av trädet finns — det anas i diset ovanför och under — men det ska
 * aldrig in i bilden, för i samma sekund som hela trädet får plats är fågeln en pixel igen.
 *
 * Vinsten är hela problemet löst på en gång:
 *   · Bona kommer till kameran i stället för tvärtom. Sju bon, en bild, inget sökande.
 *   · Måttet är satt av fågeln, inte av trädet. En fågel är fyrtio pixlar hög i överblicken
 *     och två hundra när man flyger dit — och det är den siffran bygget är kontrollerat mot.
 *   · "Mega" blir en upplevelse i stället för ett tal. En stam som går ur bild är större än
 *     en stam man ser hela, hur hög man än gör den.
 *
 * SCENEN (allt i enheter, kameran står i +Z och tittar mot -Z):
 *   stammen    en cylinder med radie 55 kring origo, från -190 till +190 i höjd
 *   grenarna   sju, ut ur barken mellan z=+40 och z=+55, med boet 90–110 enheter fram
 *   kameran    överblicken står i (0, 18, 158) och tittar på (0, 16, 88)
 *
 * TRÄDET LEVER. Avatar-tråden Filip drog är inte lövverk, den är ÅDROR: ljus som vandrar
 * uppåt i barken, starkare på natten, och som flammar till när något händer i Roost. Vinden
 * går genom varje löv och varje hängande liana i samma shader, så hela kronan andas i takt
 * utan att kosta ett enda extra ritanrop.
 */
import * as THREE from 'three'
import { TAL } from './palett.js'

/** Stammens radie. Den enda siffra som avgör om trädet känns som en vägg eller som ett träd. */
export const STAM_R = 55
/** Hur långt upp och ner stammen går. Den ska aldrig ta slut inom bild. */
const STAM_H = 380
/** Kronans mått, för kamerans spärrar. */
export const TRADHOJD = 62

/**
 * Var de sju bona hänger — scenens komposition, i klartext.
 *
 * Hand­satta, inte utslumpade. Avstånden till kameran ligger mellan 62 och 78 enheter för
 * alla sju, vilket är vad som gör att ingen fågel är stor och ingen är en prick. Höjderna
 * växlar (hög, låg, hög, låg …) så att grenarna inte skymmer varandra, och de yttre står
 * längre fram än de inre så att fläkten böjer sig kring kameran i stället för bort från den.
 */
export const SLOTTAR = [
  { x: -27, y: 22, z: 101, vrid: -0.5 },
  { x: -18, y: 7, z: 95, vrid: -0.3 },
  { x: -9, y: 24, z: 91, vrid: -0.14 },
  { x: 1, y: 9, z: 87, vrid: 0.02 },
  { x: 10, y: 25, z: 92, vrid: 0.16 },
  { x: 19, y: 8, z: 96, vrid: 0.32 },
  { x: 28, y: 21, z: 102, vrid: 0.5 },
]

export const ARSTIDER = {
  var: { lov: 0x7fa07f, under: 0x92a68e, ton: 0.22 },
  sommar: { lov: 0x5f8a63, under: 0x7fa07f, ton: 0.16 },
  host: { lov: 0xa85f40, under: 0x8a6634, ton: 0.3 },
  vinter: { lov: 0x6f7f78, under: 0x92a68e, ton: 0.1 },
}

export function arstidNu(datum = new Date()) {
  const m = datum.getMonth()
  if (m <= 1 || m === 11) return 'vinter'
  if (m <= 4) return 'var'
  if (m <= 7) return 'sommar'
  return 'host'
}

const BARK = 0x6b5748
const BARK_DJUP = 0x3a2e25
const GREN = 0x6d5744

const fro = (seed) => {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296)
}

/**
 * Vinden, injicerad i vilket standardmaterial som helst.
 *
 * Varje vertex bär `aBoj` — noll vid fästet, ett längst ut — och böjs av två vågor med olika
 * period. Två vågor och inte en, för en enda våg får hela kronan att vifta i takt som en
 * publik, medan två som inte går jämnt ut aldrig upprepar sig synligt.
 */
function vindShader(mat, u, instansierad = false) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTid = u.tid
    s.uniforms.uVind = u.vind
    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aBoj;
         uniform float uTid;
         uniform float uVind;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float b = aBoj;
         ${instansierad ? 'vec3 wp = (instanceMatrix * vec4(transformed, 1.0)).xyz;' : 'vec3 wp = transformed;'}
         float f1 = sin(uTid * 0.9 + wp.x * 0.035 + wp.y * 0.02);
         float f2 = sin(uTid * 1.63 + wp.z * 0.041);
         transformed.x += b * uVind * (f1 * 1.0 + f2 * 0.55);
         transformed.z += b * uVind * (f2 * 0.8 - f1 * 0.35);
         transformed.y -= b * uVind * abs(f1) * 0.25;`
      )
  }
  mat.customProgramCacheKey = () => (instansierad ? 'vind-i' : 'vind')
  return mat
}

/**
 * Ådrorna i barken — det som gör att trädet lever och inte bara står.
 *
 * Ljus som vandrar uppför stammen i smala band. Dagtid är de nätt och jämnt synliga, som
 * fukt i veden; på natten lyser de. `uPuls` flammar när Roost gör något — det är samma slag
 * som fyren och tavlan får, så hela scenen reagerar på samma händelse.
 */
function adershader(mat, u) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTid = u.tid
    s.uniforms.uNatt = u.natt
    s.uniforms.uPuls = u.puls
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\n varying vec3 vAder;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vAder = position;')
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vAder;
         uniform float uTid;
         uniform float uNatt;
         uniform float uPuls;`
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         float vink = atan(vAder.z, vAder.x);
         // Tre band med olika varv, så mönstret aldrig går jämnt upp och upprepar sig.
         float band = sin(vink * 7.0 + vAder.y * 0.07) * 0.5
                    + sin(vink * 13.0 - vAder.y * 0.045) * 0.3
                    + sin(vink * 3.0 + vAder.y * 0.02) * 0.2;
         float ader = smoothstep(0.62, 0.97, band);
         // Vandringen uppåt: ljuset går mot kronan, aldrig ner.
         float vag = 0.45 + 0.55 * sin(vAder.y * 0.11 - uTid * 0.75);
         float styrka = ader * vag * (0.1 + uNatt * 0.5 + uPuls * 0.7);
         gl_FragColor.rgb += vec3(0.42, 0.78, 0.66) * styrka;`
      )
  }
  mat.customProgramCacheKey = () => 'ader'
  return mat
}

/** En avsmalnande gren längs en kurva. Tube ger jämntjockt; ringarna skalas om efteråt. */
function grenGeometri(kurva, r0, r1, langd = 26, radiella = 7) {
  const g = new THREE.TubeGeometry(kurva, langd, 1, radiella, false)
  const pos = g.attributes.position
  const boj = new Float32Array(pos.count)
  const mitt = new THREE.Vector3()
  for (let i = 0; i <= langd; i++) {
    const t = i / langd
    kurva.getPointAt(t, mitt)
    const r = THREE.MathUtils.lerp(r0, r1, t * t * 0.7 + t * 0.3)
    for (let j = 0; j <= radiella; j++) {
      const k = i * (radiella + 1) + j
      pos.setXYZ(
        k,
        mitt.x + (pos.getX(k) - mitt.x) * r,
        mitt.y + (pos.getY(k) - mitt.y) * r,
        mitt.z + (pos.getZ(k) - mitt.z) * r
      )
      // Böjningen växer med kuben av avståndet ut: stammen står stilla, spetsen svajar.
      boj[k] = t * t * t
    }
  }
  g.setAttribute('aBoj', new THREE.BufferAttribute(boj, 1))
  g.computeVertexNormals()
  return g
}

export class Tradet {
  constructor(scene) {
    this.scene = scene
    this.grupp = new THREE.Group()
    this.grupp.name = 'megatrad'
    this.grupp.visible = false
    scene.add(this.grupp)

    this.u = {
      tid: { value: 0 },
      vind: { value: 0.5 },
      natt: { value: 0 },
      puls: { value: 0 },
    }
    this.arstid = ARSTIDER.sommar
    this.tid = 0
    this._pulsKo = 0
    this._grenar = []
    this._material = []
    this._geometrier = []

    this._stam()
    this._grenfläkt()
    this._hang()
    this._dis()
  }

  _mat(m) {
    this._material.push(m)
    return m
  }

  _geo(g) {
    this._geometrier.push(g)
    return g
  }

  // ── stammen ───────────────────────────────────────────────────────────────────────────

  _stam() {
    const r = fro(0x5eed)
    const g = new THREE.Group()

    const barkMat = this._mat(
      adershader(
        new THREE.MeshStandardMaterial({ color: BARK, roughness: 0.95, metalness: 0, flatShading: true }),
        this.u
      )
    )

    // Själva pelaren. Lågt antal segment med flatShading ger fasetterna som resten av
    // kolonin är byggd av — den här scenen ska se ut som samma värld, inte som ett annat spel.
    const stam = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(STAM_R * 1.04, STAM_R * 1.22, STAM_H, 26, 6, true)), this._mat(adershader(new THREE.MeshStandardMaterial({ color: BARK_DJUP, roughness: 0.98, metalness: 0, flatShading: true }), this.u)))
    stam.receiveShadow = true
    g.add(stam)

    // Barkribborna. Det är de, inte cylindern, som gör att ytan läses som bark när man står
    // sju enheter ifrån den — en slät cylinder är en pelare, en räfflad är ett träd.
    const ribbMat = this._mat(
      adershader(
        new THREE.MeshStandardMaterial({ color: BARK, roughness: 1, metalness: 0, flatShading: true }),
        this.u
      )
    )
    const ribbor = []
    for (let i = 0; i < 60; i++) {
      const v = (i / 60) * Math.PI * 2 + r() * 0.05
      const bred = 4.5 + r() * 7
      const djup = 4.5 + r() * 6
      const h = STAM_H * (0.7 + r() * 0.5)
      const geo = new THREE.BoxGeometry(bred, h, djup)
      geo.translate(0, (r() - 0.5) * 40, 0)
      geo.rotateY(-v)
      geo.translate(Math.cos(v) * STAM_R * 1.06, 0, Math.sin(v) * STAM_R * 1.06)
      ribbor.push(geo)
    }
    const ribb = new THREE.Mesh(this._geo(sammanfoga(ribbor)), ribbMat)
    ribb.castShadow = true
    ribb.receiveShadow = true
    g.add(ribb)

    // Mossa och lav i fläckar, bara på den sida som vetter mot kameran — det är den enda
    // som syns, och en fläck på baksidan är en ritkostnad utan en enda betraktare.
    const mossMat = this._mat(new THREE.MeshStandardMaterial({ color: 0x4f6b53, roughness: 1, flatShading: true }))
    const moss = []
    for (let i = 0; i < 26; i++) {
      const v = Math.PI * 0.18 + r() * Math.PI * 0.64
      const y = (r() - 0.5) * 210
      const s = 4 + r() * 11
      const geo = new THREE.IcosahedronGeometry(s, 0)
      geo.scale(1, 0.55 + r() * 0.5, 0.26)
      geo.rotateY(-v)
      geo.translate(Math.cos(v) * STAM_R * 1.1, y, Math.sin(v) * STAM_R * 1.1)
      moss.push(geo)
    }
    g.add(new THREE.Mesh(this._geo(sammanfoga(moss)), mossMat))

    this.stam = g
    this.grupp.add(g)
  }

  // ── grenarna ──────────────────────────────────────────────────────────────────────────

  _grenfläkt() {
    const r = fro(0x9a17)
    const barkMat = this._mat(
      vindShader(
        new THREE.MeshStandardMaterial({ color: GREN, roughness: 0.92, metalness: 0, flatShading: true }),
        this.u
      )
    )
    const lovMat = this._mat(
      vindShader(
        new THREE.MeshStandardMaterial({
          color: this.arstid.lov,
          roughness: 0.82,
          metalness: 0,
          flatShading: true,
        }),
        this.u
      )
    )
    this.lovMat = lovMat

    const grenDelar = []
    const lovDelar = []
    const lovDelar2 = []

    SLOTTAR.forEach((s, i) => {
      const bo = new THREE.Vector3(s.x, s.y, s.z)
      const vinkel = Math.atan2(bo.z, bo.x)
      // Fästet sitter på barken, en bit under boet: grenar går uppåt när de går utåt.
      const fot = new THREE.Vector3(
        Math.cos(vinkel) * STAM_R * 0.94,
        s.y - 13 - r() * 7,
        Math.sin(vinkel) * STAM_R * 0.94
      )
      const ut = bo.clone().sub(fot)
      const langd = ut.length()
      const riktning = ut.clone().normalize()
      const sida = new THREE.Vector3(-riktning.z, 0, riktning.x).normalize()

      // Grenen slutar vid boet, och `t` betyder därför alltid samma sak: noll är barken, ett
      // är boet. Det är inte kosmetik — lövklasar, fågelns stig och kvistarna placeras alla
      // på `t`, och när fortsättningen låg i samma kurva hamnade allt det EFTER boet, ute
      // framför kameran. Första bilden på mega-trädet blev ett lövverk i närbild.
      const kurva = new THREE.CatmullRomCurve3([
        fot.clone(),
        fot.clone().addScaledVector(riktning, langd * 0.32).add(new THREE.Vector3(0, 3, 0)).addScaledVector(sida, (r() - 0.5) * 6),
        fot.clone().addScaledVector(riktning, langd * 0.7).add(new THREE.Vector3(0, 4.5, 0)).addScaledVector(sida, (r() - 0.5) * 8),
        bo.clone().add(new THREE.Vector3(0, -1.9, 0)),
      ])
      grenDelar.push(grenGeometri(kurva, 5.2, 1.35, 30, 7))

      // Fortsättningen bortom boet. Ingen gren i naturen slutar där någon satt ett bo — men
      // den får inte gå rakt mot kameran heller, så den viker av kraftigt åt sidan och uppåt
      // och lämnar bilden i kanten i stället för att lägga sig framför scenen.
      const bortRikt = riktning
        .clone()
        .multiplyScalar(-0.3)
        .addScaledVector(sida, s.x < 0 ? -1.15 : 1.15)
        .add(new THREE.Vector3(0, -0.3, 0))
        .normalize()
      const forts = new THREE.CatmullRomCurve3([
        bo.clone().add(new THREE.Vector3(0, -1.9, 0)),
        bo.clone().addScaledVector(bortRikt, 8).add(new THREE.Vector3(0, -1, 0)),
        bo.clone().addScaledVector(bortRikt, 17).add(new THREE.Vector3(0, -2.5, 0)),
      ])
      grenDelar.push(grenGeometri(forts, 0.95, 0.25, 12, 5))

      // Kvistar ut från grenen: två åt sidorna, en uppåt. De bär lövklasarna och ger fågeln
      // något att hoppa till som inte är boet.
      const kvistar = []
      for (let k = 0; k < 3; k++) {
        const t = 0.46 + k * 0.16 + r() * 0.05
        const p = kurva.getPointAt(Math.min(0.9, t))
        const rikt = sida
          .clone()
          .multiplyScalar(k === 2 ? (r() - 0.5) * 0.8 : k === 0 ? 1 : -1)
          .add(new THREE.Vector3(0, k === 2 ? -0.5 : -0.25, 0))
          .addScaledVector(riktning, -0.35)
          .normalize()
        const l = 9 + r() * 8
        const kv = new THREE.CatmullRomCurve3([
          p.clone(),
          p.clone().addScaledVector(rikt, l * 0.5).add(new THREE.Vector3(0, -0.8, 0)),
          p.clone().addScaledVector(rikt, l).add(new THREE.Vector3(0, -1.8, 0)),
        ])
        grenDelar.push(grenGeometri(kv, 1.7, 0.6, 10, 5))
        kvistar.push(kv.getPointAt(1))
      }

      // Lövklasarna. De sitter UNDER boet och bakom det, aldrig framför och aldrig ovanför —
      // grönska mellan kameran och ett bo är exakt det som gjorde fåglarna osynliga. Därför
      // ligger varje klase minst fyra enheter under grenen och närmare stammen än boet är.
      /**
       * LUFTREGELN, och den är hela skillnaden mellan den här versionen och den förra.
       *
       * Inget lövverk får hamna mellan kameran och ett bo. Bona ligger på z 88–105 och
       * kameran på z 156, så allt grönt hålls på z under boets — och därtill minst åtta
       * enheter under grenen. Utan regeln blir kronan tät och vacker och fåglarna borta,
       * vilket var precis vad skärmbilden visade.
       */
      /**
       * LUFTREGELN, och den är hela skillnaden mellan den här versionen och de tre förra.
       *
       * Lövet sitter bara där en kvist tar slut, och bara på kvistar som pekar bakåt eller
       * nedåt. Ingenting grönt får hamna mellan kameran och ett bo. Varje gång den regeln
       * varit lösare har kronan blivit tät och vacker och fåglarna borta — det är exakt det
       * skärmbilderna den 15 september visade, tre gånger i rad.
       */
      const klasPunkter = kvistar.filter((k) => k.z < bo.z - 3)
      for (const p of klasPunkter) {
        for (let k = 0; k < 2; k++) {
          const s2 = 2.6 + r() * 2.2
          const geo = new THREE.IcosahedronGeometry(s2, 0)
          geo.scale(1.15, 0.78, 1.05)
          geo.rotateY(r() * 3)
          geo.translate(p.x + (r() - 0.5) * 3.5, p.y + (r() - 0.5) * 2.2 - 0.8, p.z + (r() - 0.5) * 3)
          const b = new Float32Array(geo.attributes.position.count).fill(0.85 + r() * 0.3)
          geo.setAttribute('aBoj', new THREE.BufferAttribute(b, 1))
          ;(r() < 0.55 ? lovDelar : lovDelar2).push(geo)
        }
      }

      const bofot = kurva.getPointAt(0.86)
      this._grenar.push({
        i,
        bo,
        fot,
        kurva,
        forts,
        riktning,
        sida,
        kvistar,
        // Ut längs grenen och tillbaka — fågelns arbetsrunda. Alltid i bild, aldrig ur den.
        gron: klasPunkter.map((p) => p.clone()),
        // Fågelns arbetsväg: fyra fästen längs grenen in mot stammen, plus en bit ut på
        // fortsättningen. Allt inom bild — en fågel som flyger ur bild går inte att räkna.
        stig: [
          kurva.getPointAt(0.5).add(new THREE.Vector3(0, 2.2, 0)),
          kurva.getPointAt(0.68).add(new THREE.Vector3(0, 2.2, 0)),
          kurva.getPointAt(0.86).add(new THREE.Vector3(0, 2, 0)),
          forts.getPointAt(0.35).add(new THREE.Vector3(0, 1.8, 0)),
        ],
        bofot,
      })
    })

    /**
     * Kronmassan. Ett bälte av lövverk runt stammen, bakom och under grenfläkten.
     *
     * Den bär hela intrycket av "mega": bilden slutar inte i en tom himmel bakom bona, den
     * slutar i mer träd. Och den kostar ingenting i läsbarhet, för den står bakom bonas plan.
     */
    const massa = []
    for (let k = 0; k < 110; k++) {
      const v = -Math.PI * 0.08 + r() * Math.PI * 1.16
      const rad = STAM_R * (1.05 + r() * 1.5)
      // UNDER bonas plan, aldrig ovanför. Ovanför bona ska det vara bark och luft — det är
      // den luften som gör att ett bo syns, och den fanns inte i de tre första försöken.
      const y = -96 + r() * 96
      const p = new THREE.Vector3(Math.cos(v) * rad, y, Math.sin(v) * rad)
      if (p.z > 76) continue
      const s2 = 6 + r() * 12
      const geo = new THREE.IcosahedronGeometry(s2, 0)
      geo.scale(1.2, 0.8, 1.15)
      geo.rotateY(r() * 3)
      geo.translate(p.x, p.y, p.z)
      const b = new Float32Array(geo.attributes.position.count).fill(0.4 + r() * 0.35)
      geo.setAttribute('aBoj', new THREE.BufferAttribute(b, 1))
      massa.push(geo)
    }
    const massaMat = this._mat(
      vindShader(
        new THREE.MeshStandardMaterial({ color: 0x3a3f2e, roughness: 0.95, metalness: 0, flatShading: true }),
        this.u
      )
    )
    this.massaMat = massaMat
    this.grupp.add(new THREE.Mesh(this._geo(sammanfoga(massa)), massaMat))

    const grenar = new THREE.Mesh(this._geo(sammanfoga(grenDelar)), barkMat)
    grenar.castShadow = true
    grenar.receiveShadow = true
    this.grupp.add(grenar)

    const lov = new THREE.Mesh(this._geo(sammanfoga(lovDelar)), lovMat)
    lov.castShadow = true
    this.lov = lov
    this.grupp.add(lov)

    const lovMat2 = this._mat(
      vindShader(
        new THREE.MeshStandardMaterial({ color: this.arstid.under, roughness: 0.85, metalness: 0, flatShading: true }),
        this.u
      )
    )
    this.lovMat2 = lovMat2
    const lov2 = new THREE.Mesh(this._geo(sammanfoga(lovDelar2)), lovMat2)
    lov2.castShadow = true
    this.grupp.add(lov2)
  }

  // ── hängande ──────────────────────────────────────────────────────────────────────────

  _hang() {
    const r = fro(0x31c7)
    const mat = this._mat(
      vindShader(
        new THREE.MeshStandardMaterial({ color: 0x3d4a39, roughness: 0.98, flatShading: true }),
        this.u
      )
    )
    const delar = []
    const hang = (x, y, z, langd, tjock) => {
      // Framför bonas plan hänger ingenting. En liana på z=100 är ett grönt streck tvärs
      // över en fågel, och sådana streck var halva bruset i de första bilderna.
      if (z > 76) return
      const geo = new THREE.CylinderGeometry(tjock, tjock * 0.55, langd, 4, 3, false)
      const b = new Float32Array(geo.attributes.position.count)
      const pos = geo.attributes.position
      for (let i = 0; i < pos.count; i++) b[i] = Math.max(0, 0.5 - pos.getY(i) / langd) * 1.6
      geo.setAttribute('aBoj', new THREE.BufferAttribute(b, 1))
      geo.translate(x, y - langd / 2, z)
      delar.push(geo)
    }

    // Lianer från grenarna, och långa rep uppifrån bild. De uppifrån är viktigast: de säger
    // "det finns mer träd ovanför" utan att något av det behöver ritas.
    for (const g of this._grenar) {
      for (let k = 0; k < 2; k++) {
        const p = g.kurva.getPointAt(0.25 + r() * 0.4)
        hang(p.x + (r() - 0.5) * 6, p.y - 1, p.z + (r() - 0.5) * 6, 16 + r() * 40, 0.18 + r() * 0.14)
      }
    }
    for (let k = 0; k < 16; k++) {
      const v = Math.PI * 0.12 + r() * Math.PI * 0.76
      const rad = STAM_R * (1.05 + r() * 0.8)
      hang(Math.cos(v) * rad, 96 + r() * 30, Math.sin(v) * rad, 60 + r() * 100, 0.22 + r() * 0.2)
    }
    const m = new THREE.Mesh(this._geo(sammanfoga(delar)), mat)
    this.grupp.add(m)
  }

  // ── dis, ljus och skräp i luften ──────────────────────────────────────────────────────

  _dis() {
    const r = fro(0x77aa)

    // Grenar i fjärran, bara som siluetter. De ligger utanför fläkten och långt ner/upp, och
    // de är hela beviset för att trädet fortsätter utanför bilden.
    const silMat = this._mat(
      new THREE.MeshStandardMaterial({ color: 0x2a2a28, roughness: 1, flatShading: true, transparent: true, opacity: 0.55 })
    )
    const sil = []
    for (let k = 0; k < 9; k++) {
      const v = -Math.PI * 0.15 + r() * Math.PI * 1.3
      const y = k < 5 ? -70 - r() * 90 : 88 + r() * 90
      const fot = new THREE.Vector3(Math.cos(v) * STAM_R, y, Math.sin(v) * STAM_R)
      const ut = new THREE.Vector3(Math.cos(v), 0, Math.sin(v)).multiplyScalar(90 + r() * 90)
      const kurva = new THREE.CatmullRomCurve3([
        fot.clone(),
        fot.clone().addScaledVector(ut, 0.4).add(new THREE.Vector3(0, 8 - r() * 20, 0)),
        fot.clone().add(ut).add(new THREE.Vector3(0, 14 - r() * 34, 0)),
      ])
      sil.push(grenGeometri(kurva, 6.5, 1.4, 12, 5))
    }
    const s = new THREE.Mesh(this._geo(sammanfoga(sil)), silMat)
    this.grupp.add(s)

    // Frön och damm i luften. De rör sig långsamt uppåt och driver i sidled — det är det som
    // gör att luften mellan kameran och barken känns som luft och inte som tomrum.
    const antal = 420
    const geo = this._geo(new THREE.BufferGeometry())
    const p = new Float32Array(antal * 3)
    this._froFart = new Float32Array(antal)
    for (let i = 0; i < antal; i++) {
      p[i * 3] = (r() - 0.5) * 300
      p[i * 3 + 1] = (r() - 0.5) * 180
      p[i * 3 + 2] = 40 + r() * 150
      this._froFart[i] = 1.4 + r() * 3.6
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3))
    const froMat = this._mat(
      new THREE.PointsMaterial({ color: 0xd8c9a0, size: 0.85, transparent: true, opacity: 0.6, depthWrite: false, fog: false })
    )
    this.fron = new THREE.Points(geo, froMat)
    this.grupp.add(this.fron)

    // Ljuset i scenen. Kronan har sitt eget — solen i himlen står för långt bort för att ge
    // barken form på det här avståndet, och utan det blir väggen en platt brun yta.
    const fram = new THREE.DirectionalLight(0xffe6c4, 2.1)
    fram.position.set(90, 130, 200)
    this.grupp.add(fram)
    const kant = new THREE.DirectionalLight(0x9fd8c8, 0.85)
    kant.position.set(-130, 40, -60)
    this.grupp.add(kant)
    const mjuk = new THREE.HemisphereLight(0xbfe0d0, 0x2a2318, 0.75)
    this.grupp.add(mjuk)
    this._ljus = { fram, kant, mjuk }
  }

  // ── det kolonin frågar om ─────────────────────────────────────────────────────────────

  /** Boplatserna, i ordning. Fler trådar än grenar får dela på grenarna längst ut. */
  boplatser(antal = SLOTTAR.length) {
    const n = Math.max(1, antal)
    const ut = []
    /**
     * Arbetsvägen hålls innanför ramen.
     *
     * "Bra att se alla fåglar samtidigt" går inte ihop med en fågel som flyger ur bild för
     * att hämta en pinne. Hämtpunkterna klipps därför till fläktens bredd — den yttersta
     * fågeln hämtar inåt i stället för utåt, och det syns inte på henne att hon gör det.
     */
    const iRam = (p) => {
      p.x = THREE.MathUtils.clamp(p.x, -32, 34)
      return p
    }
    for (let i = 0; i < n; i++) {
      const g = this._grenar[i % this._grenar.length]
      const extra = Math.floor(i / this._grenar.length)
      const punkt = g.bo.clone().addScaledVector(g.sida, extra * 9)
      ut.push({
        punkt,
        gren: g.i,
        riktning: g.riktning.clone(),
        sida: g.sida.clone(),
        gron: g.gron.map((p) => iRam(p.clone())),
        stig: g.stig.map((p) => iRam(p.clone())),
        spets: iRam(g.forts.getPointAt(0.5).clone()),
      })
    }
    return ut
  }

  /** Hålet i stammen. Kvar för kolonins skull; i mega-trädet är det barkens mitt i bild. */
  stamhal() {
    return new THREE.Vector3(0, 14, STAM_R * 1.02)
  }

  /**
   * Utsikterna — kamerans fasta platser.
   *
   * `överblick` är scenens hemläge och det enda som måste stämma: därifrån ska alla sju bon
   * synas samtidigt, och det är den bilden bygget kontrolleras mot.
   */
  utsikter() {
    return [
      // Målet står en bit till höger om mitten med flit: sidopanelen täcker den högra
      // fjärdedelen av skärmen, så en fläkt som centreras i VÄRLDEN hamnar snett i BILDEN
      // och de två yttersta bona försvinner bakom panelen. Kiosken har ingen panel och
      // tappar inget på förskjutningen.
      { namn: 'överblick', punkt: new THREE.Vector3(7, 14, 84), avstand: 88, lutning: 1.42, azimut: 0 },
      { namn: 'barken', punkt: new THREE.Vector3(0, 20, 62), avstand: 40, lutning: 1.5, azimut: 0.2 },
      { namn: 'underifrån', punkt: new THREE.Vector3(6, 4, 82), avstand: 58, lutning: 1.86, azimut: -0.06 },
      { namn: 'kronan', punkt: new THREE.Vector3(6, 28, 88), avstand: 58, lutning: 1.2, azimut: 0.05 },
    ]
  }

  satArstid(namn) {
    const a = ARSTIDER[namn] || ARSTIDER.sommar
    this.arstid = a
    this.lovMat?.color.setHex(a.lov)
    this.lovMat2?.color.setHex(a.under)
    this.massaMat?.color.setHex(a.lov).lerp(new THREE.Color(0x232a20), 0.68)
  }

  setVisible(v) {
    this.grupp.visible = Boolean(v)
  }

  setNatt(n) {
    this.u.natt.value = THREE.MathUtils.clamp(Number(n) || 0, 0, 1)
    if (this._ljus) {
      this._ljus.fram.intensity = THREE.MathUtils.lerp(2.1, 0.4, this.u.natt.value)
      this._ljus.kant.intensity = THREE.MathUtils.lerp(0.85, 1.05, this.u.natt.value)
      this._ljus.mjuk.intensity = THREE.MathUtils.lerp(0.75, 0.3, this.u.natt.value)
    }
  }

  /** Ett slag genom trädet — ådrorna flammar. Samma händelse som fyren och tavlan får. */
  slag() {
    this._pulsKo = 1
  }

  update(dt) {
    if (!this.grupp.visible) return
    this.tid += dt
    this.u.tid.value = this.tid
    // Vinden är inte konstant. Byar som kommer och går gör att kronan aldrig ser loopad ut.
    this.u.vind.value = 0.42 + Math.sin(this.tid * 0.21) * 0.2 + Math.sin(this.tid * 0.07) * 0.16
    if (this._pulsKo > 0) {
      this.u.puls.value = this._pulsKo
      this._pulsKo = Math.max(0, this._pulsKo - dt * 0.9)
    } else if (this.u.puls.value > 0) {
      this.u.puls.value = Math.max(0, this.u.puls.value - dt * 0.9)
    }

    const p = this.fron.geometry.attributes.position
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + this._froFart[i] * dt
      let x = p.getX(i) + Math.sin(this.tid * 0.4 + i) * dt * 2.2
      if (y > 110) {
        y = -110
        x = (Math.random() - 0.5) * 300
      }
      p.setY(i, y)
      p.setX(i, x)
    }
    p.needsUpdate = true
  }

  diagnos() {
    return {
      grenar: this._grenar.length,
      stamR: STAM_R,
      lov: Boolean(this.lov),
      natt: Number(this.u.natt.value.toFixed(2)),
    }
  }

  dispose() {
    this.scene.remove(this.grupp)
    this._geometrier.forEach((g) => g.dispose())
    this._material.forEach((m) => m.dispose())
  }
}

/** Slår ihop geometrier till en enda. Ett ritanrop i stället för fyrahundra. */
function sammanfoga(delar) {
  if (!delar.length) return new THREE.BufferGeometry()
  const nycklar = ['position', 'normal', 'aBoj']
  let antal = 0
  let index = 0
  for (const d of delar) {
    antal += d.attributes.position.count
    index += d.index ? d.index.count : d.attributes.position.count
  }
  const pos = new Float32Array(antal * 3)
  const nor = new Float32Array(antal * 3)
  const boj = new Float32Array(antal)
  const idx = new Uint32Array(index)
  let vo = 0
  let io = 0
  for (const d of delar) {
    const p = d.attributes.position
    const n = d.attributes.normal
    const b = d.attributes.aBoj
    pos.set(p.array.subarray(0, p.count * 3), vo * 3)
    if (n) nor.set(n.array.subarray(0, n.count * 3), vo * 3)
    if (b) boj.set(b.array.subarray(0, b.count), vo)
    if (d.index) {
      for (let i = 0; i < d.index.count; i++) idx[io++] = d.index.array[i] + vo
    } else {
      for (let i = 0; i < p.count; i++) idx[io++] = i + vo
    }
    vo += p.count
    d.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('aBoj', new THREE.BufferAttribute(boj, 1))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  void nycklar
  return g
}
