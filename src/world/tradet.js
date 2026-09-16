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
/** Synfältet kompositionen är avstämd mot. Allt annat räknas om mot det här talet. */
const BASFOV = (50 * Math.PI) / 180

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
         uniform float uPuls;
         uniform vec3 uPulsFarg;`
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
         // Vilofärgen är trädets egen; under ett slag går ådran över i barnets färg.
         vec3 sav = mix(vec3(0.42, 0.78, 0.66), uPulsFarg, clamp(uPuls, 0.0, 1.0));
         gl_FragColor.rgb += sav * styrka;`
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
      // Saven bär FÄRGEN på den minut som gick — barnets egen. Ådrorna i barken är annars
      // samma gröna hela dygnet, och då säger ett slag bara "något hände", inte "vems".
      pulsFarg: { value: new THREE.Color(0x6bc7a8) },
    }
    this.arstid = ARSTIDER.sommar
    this.tid = 0
    this._pulsKo = 0
    this._grenar = []
    this._material = []
    this._geometrier = []

    this._barMal = 0
    this._vindMal = 0.42
    this._ekorrfart = 0
    this._stam()
    this._grenfläkt()
    this._hang()
    this._liv()
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
      /**
       * Luftregeln gäller Loggboken också.
       *
       * Tavlan hänger på barken kring (0, 34, 66), och en lövklase mellan den och kameran
       * täcker en spalt text. Samma regel som skyddar bona, samma skäl: det som ska LÄSAS får
       * inte ha grönska framför sig. Rutan är tavlans egen plus marginal.
       */
      const klasPunkter = kvistar.filter(
        (k) => k.z < bo.z - 3 && !(Math.abs(k.x) < 32 && k.y > 12 && k.z > 46 && k.z < 100)
      )
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
        /**
         * Fågelns hämtpunkter är EGNA, inte lövklasarnas.
         *
         * De delade lista med lövklasarna förut, och när luftregeln tömde klaslistan framför
         * Loggboken tömdes fågelns arbetsväg med den: `_runda` slog i en tom lista och hela
         * bildslingan dog. Det som RITAS och det som BETYDER något får inte hänga i samma
         * tråd — en filtrering som bara skulle flytta ett löv tog ner sidan.
         */
        gron: kvistar.map((k) => k.clone().add(new THREE.Vector3(0, -2.5, 0))),
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
    for (let k = 0; k < 240; k++) {
      const v = -Math.PI * 0.16 + r() * Math.PI * 1.32
      const rad = STAM_R * (1.05 + r() * 2.1)
      /**
       * BÄLTET GÅR NU OCKSÅ UPPÅT, och det är en rättelse av min egen regel.
       *
       * Den gamla raden lade all massa under bona, med motiveringen att luft ovanför ett bo
       * är det som gör att boet syns. Luften behövs — men den fanns bara i mitten. Ute vid
       * kanterna och uppe i hörnen slutade bilden i ingenting, och mätt på överblicken var
       * trettiofyra procent av ytan tom och övre tredjedelen halvtom. Ett träd som är för
       * stort för bilden ska inte ha en himmel runt sig.
       *
       * Luften ovanför bona är därför skyddad av `z > 62`-filtret i stället för av höjden:
       * allt som hamnar framför bonas plan kastas, oavsett var det står. Kvar blir djup vid
       * kanterna och bakom, som är precis det som saknades.
       */
      const y = -96 + r() * 240
      const p = new THREE.Vector3(Math.cos(v) * rad, y, Math.sin(v) * rad)
      if (p.z > 62) continue
      // Massan högst upp hålls utanför mitten: rakt ovanför bona ska det vara bark och luft.
      if (y > 40 && Math.abs(p.x) < 46 && p.z > 10) continue
      /**
       * INSTRUMENTBÄLTET är fredat. Holkarna hänger på barken kring y 34 och tavlan strax
       * intill; en lövklase som lägger sig i det bandet skymmer en mätare, och en mätare som
       * går att skymma av dekor är ingen mätare. Luftregeln för grenarnas klasar skyddade
       * redan tavlan — kronmassan hade ingen sådan regel, och första bilden lade en klase
       * tvärs över Bills holk.
       */
      if (y > 20 && y < 52 && Math.abs(p.x) < 78 && p.z > 26) continue
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

  // ── agenternas liv ────────────────────────────────────────────────────────────────────

  /**
   * Bären, löven och ekorren.
   *
   * Tre olika sorters signal, med flit byggda olika:
   *   BÄREN är ett TILLSTÅND — de hänger kvar tills felet är åtgärdat.
   *   LÖVEN är en HÄNDELSE — ett löv faller en gång, i den stund en agent går ner.
   *   EKORREN är ett FLÖDE — den springer så länge kommandokön har något i sig.
   * Ett tillstånd som ritas som en händelse blinkar förbi; en händelse som ritas som ett
   * tillstånd blir ett regn som aldrig upphör. Det är samma läxa som fyren gav.
   */
  _liv() {
    const r = fro(0x4b21)

    // Bären sitter vid grenarnas lövklasar, där ögat redan är.
    const barMat = this._mat(
      new THREE.MeshStandardMaterial({ color: 0xc0392f, roughness: 0.3, metalness: 0.05, flatShading: true, emissive: 0x7a1a12, emissiveIntensity: 0.9 })
    )
    this.bar = new THREE.InstancedMesh(this._geo(new THREE.IcosahedronGeometry(1.5, 0)), barMat, 8)
    this.bar.count = 0
    this.bar.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this._barPunkter = []
    const m = new THREE.Matrix4()
    for (let i = 0; i < 8; i++) {
      const g = this._grenar[i % this._grenar.length]
      // Vid grenen, strax under den — inte nere i kronmassan där de blir en röd fläck bland
      // tiotusen orange löv.
      const p = g.kurva.getPointAt(0.6 + r() * 0.28).add(new THREE.Vector3((r() - 0.5) * 4, -3 - r() * 1.6, (r() - 0.5) * 3))
      this._barPunkter.push(p)
      m.makeTranslation(p.x, p.y, p.z)
      this.bar.setMatrixAt(i, m)
    }
    this.bar.instanceMatrix.needsUpdate = true
    this.grupp.add(this.bar)

    // Löven: en liten pool som återanvänds. Ett löv som faller ur bild återvänder till poolen
    // i stället för att skapa geometri varje gång en agent hostar till.
    const lovMat = this._mat(
      new THREE.MeshStandardMaterial({ color: this.arstid.lov, roughness: 0.85, flatShading: true, side: THREE.DoubleSide })
    )
    this.fallLovMat = lovMat
    this._lovPool = []
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.IcosahedronGeometry(1.6, 0)
      geo.scale(1.3, 0.22, 1)
      const mesh = new THREE.Mesh(this._geo(geo), lovMat)
      mesh.visible = false
      this.grupp.add(mesh)
      this._lovPool.push({ mesh, y: 0, fart: 0, snurr: 0, fas: 0, x: 0, z: 0 })
    }

    /**
     * EKORREN på stammen — kommandokön.
     *
     * Rad 224 bad om en ekorre, och det var precis vad första bygget INTE blev: sedd rakt
     * framifrån var det en brun potatis med vit mage. En ekorre känns igen på SVANSEN, och
     * svansen låg rakt bakom kroppen där kameran aldrig ser den. Nu böjer den sig upp och ut
     * åt sidan, och hela djuret står i trekvartsprofil så silhuetten får göra jobbet.
     */
    const ek = new THREE.Group()
    const pals = this._mat(new THREE.MeshStandardMaterial({ color: 0x9a5f30, roughness: 0.82, flatShading: true }))
    const mage = this._mat(new THREE.MeshStandardMaterial({ color: 0xe0cdaa, roughness: 0.85, flatShading: true }))
    const morkt = this._mat(new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.9, flatShading: true }))

    const kropp = new THREE.Mesh(this._geo(new THREE.IcosahedronGeometry(1.25, 0)), pals)
    kropp.scale.set(0.85, 1.45, 0.8)
    ek.add(kropp)

    const buk = new THREE.Mesh(this._geo(new THREE.IcosahedronGeometry(0.95, 0)), mage)
    buk.position.set(0.15, -0.15, 0.55)
    buk.scale.set(0.75, 1.25, 0.5)
    ek.add(buk)

    const huvud = new THREE.Group()
    huvud.position.set(0.15, 1.7, 0.25)
    ek.add(huvud)
    const skalle = new THREE.Mesh(this._geo(new THREE.IcosahedronGeometry(0.85, 0)), pals)
    skalle.scale.set(0.9, 0.95, 0.95)
    huvud.add(skalle)
    const nos = new THREE.Mesh(this._geo(new THREE.ConeGeometry(0.34, 0.8, 5)), pals)
    nos.rotation.x = Math.PI / 2
    nos.position.set(0, -0.1, 0.65)
    huvud.add(nos)
    for (const sida of [1, -1]) {
      // Öronen är höga och smala. Runda öron gör en ekorre till en björnunge.
      const ora = new THREE.Mesh(this._geo(new THREE.ConeGeometry(0.26, 0.95, 4)), pals)
      ora.position.set(0.42 * sida, 0.85, -0.05)
      ora.rotation.z = -0.25 * sida
      huvud.add(ora)
      const oga = new THREE.Mesh(this._geo(new THREE.SphereGeometry(0.15, 6, 5)), morkt)
      oga.position.set(0.42 * sida, 0.12, 0.5)
      huvud.add(oga)
    }

    // Framtassarna hålls mot bröstet — det är den hållningen man ritar en ekorre i.
    for (const sida of [1, -1]) {
      const tass = new THREE.Mesh(this._geo(new THREE.IcosahedronGeometry(0.3, 0)), pals)
      tass.position.set(0.3 * sida, 0.55, 0.8)
      ek.add(tass)
    }

    /**
     * SVANSEN, och den är halva ekorren.
     *
     * En båge upp bakom ryggen och ut åt sidan, bredare ju högre den kommer — sedd framifrån
     * blir den en plym bredvid kroppen i stället för att försvinna bakom den.
     */
    const svans = new THREE.Group()
    svans.position.set(-0.5, -0.9, -0.35)
    ek.add(svans)
    for (let i = 0; i < 6; i++) {
      const t = i / 5
      const del = new THREE.Mesh(this._geo(new THREE.IcosahedronGeometry(0.45 + t * 0.55, 0)), pals)
      del.position.set(-0.35 * t, 0.85 * i * (1 - t * 0.25), -0.75 - Math.sin(t * 2.2) * 0.9)
      del.scale.set(0.85, 1, 0.75)
      svans.add(del)
    }

    ek.scale.setScalar(2.6)
    this.ekorre = { grupp: ek, svans, huvud, t: 0.3, riktning: 1, vinkel: 2.05 }
    this.grupp.add(ek)
  }

  /** Släpper lös `antal` löv från kronan. Fler än poolen rymmer blir helt enkelt poolen. */
  _falLov(antal) {
    let kvar = antal
    for (const l of this._lovPool) {
      if (kvar <= 0) break
      if (l.mesh.visible) continue
      const g = this._grenar[Math.floor(Math.random() * this._grenar.length)]
      const p = g.kurva.getPointAt(0.4 + Math.random() * 0.5)
      l.x = p.x + (Math.random() - 0.5) * 8
      l.z = p.z + (Math.random() - 0.5) * 6
      l.y = p.y - 2
      l.fart = 3.4 + Math.random() * 2.2
      l.snurr = 1.2 + Math.random() * 1.8
      l.fas = Math.random() * 6
      l.mesh.visible = true
      kvar -= 1
    }
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

  /**
   * Var barnens holkar hänger på barken.
   *
   * Ovanför grenfläkten (som slutar på y=25) och åt var sitt håll, på den del av stammen som
   * vetter mot kameran. Uppe är den enda ytan i bilden som är tom — grenarna, lövet och
   * kronmassan ligger under bonas plan, och det var med flit. Holkarna får den ytan.
   */
  holkplatser(i, antal) {
    const n = Math.max(1, antal)
    // Symmetriskt kring mitten: ett barn hamnar mitt på, två flankerar, fler fördelas jämnt.
    const spann = Math.PI * 0.42
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1
    const vinkel = Math.PI / 2 - t * spann * 0.5
    // Utanför barkribborna, inte på cylindern. Ribborna sticker ut till drygt 63 enheter,
    // så en holk på stammens egen radie hamnar BAKOM barken och syns inte alls — det var
    // precis vad första bilden visade: två namnskyltar som svävade framför en tom vägg.
    const rad = STAM_R * 1.22
    return {
      punkt: new THREE.Vector3(Math.cos(vinkel) * rad, 36 - Math.abs(t) * 2, Math.sin(vinkel) * rad),
      /**
       * Holken tittar MEST MOT KAMERAN, inte rakt ut från stammen.
       *
       * Rakt ut är det riktiga svaret för en holk på ett träd, och det var det första
       * försöket — men då vände holken längst till vänster sin framsida uppåt vänster, och
       * mätaren på framsidan gick inte att läsa. En mätare som bara går att läsa från ena
       * hållet är ingen mätare. En tredjedel av vinkeln räcker för att den ska sitta på
       * stammen och inte sväva framför den.
       */
      vinkel: (Math.PI / 2 - vinkel) * 0.35,
    }
  }

  /**
   * Var Loggboken hänger på stammen.
   *
   * Mitt i bild ovanför grenfläkten, på samma rena bark som holkarna. Rad 224 kallar den
   * anslagstavlan på stammen, och det är rätt plats av ett skäl som inte är estetiskt:
   * Loggboken ÄR Roost. En trädvärld utan den visar sju fåglar som gör något obestämt.
   */
  tavlaplats() {
    const vinkel = Math.PI / 2
    const rad = STAM_R * 1.2
    return {
      // Höjden är MÄTT, inte vald: lägre och lövklasarna på kvistarna (y upp till ~24) lägger
      // sig framför tavlan, högre och överkanten går ur bild i överblicken.
      punkt: new THREE.Vector3(Math.cos(vinkel) * rad, 34, Math.sin(vinkel) * rad),
      vinkel: 0,
    }
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
  utsikter(kamera) {
    /**
     * SYNFÄLTET, och varför utsikterna räknas om i stället för att stå fast.
     *
     * Kompositionen är avstämd mot standardens femtio graders synfält. Filips egen skärm
     * står på trettioåtta — och med trettioåtta hamnade kameran mitt inne i barken: hela
     * scenen var byggd för en vidare bild än den han faktiskt har. Det syntes först när
     * bilden togs på köksskärmens riktiga URL, inte i utvecklingsmiljön.
     *
     * Så avstånden skalas med det synfält kameran verkligen har, och med bildens bredd om
     * den är smalare än sexton-mot-nio. Då står överblicken rätt på vilken skärm som helst,
     * och den som ändrar synfältet i inställningarna tappar inte bort trädet.
     */
    const fov = ((kamera?.fov || 50) * Math.PI) / 180
    const bredd = kamera?.aspect || 16 / 9
    const skala =
      (Math.tan(BASFOV / 2) / Math.tan(fov / 2)) * Math.max(1, (16 / 9) / Math.max(0.8, bredd))
    const v = (namn, punkt, avstand, lutning, azimut) => ({
      namn,
      punkt,
      avstand: Math.round(avstand * skala * 10) / 10,
      lutning,
      azimut,
    })
    return [
      v('överblick', new THREE.Vector3(7, 14, 84), 88, 1.42, 0),
      v('barken', new THREE.Vector3(0, 20, 62), 40, 1.5, 0.2),
      v('underifrån', new THREE.Vector3(6, 4, 82), 58, 1.86, -0.06),
      v('kronan', new THREE.Vector3(6, 28, 88), 58, 1.2, 0.05),
      // Loggboken på nära håll — den ska gå att LÄSA, inte bara anas.
      v('loggboken', new THREE.Vector3(0, 47, 70), 42, 1.42, 0),
    ]
  }

  satArstid(namn) {
    const a = ARSTIDER[namn] || ARSTIDER.sommar
    this.arstid = a
    this.lovMat?.color.setHex(a.lov)
    this.fallLovMat?.color.setHex(a.lov)
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

  /**
   * Ett slag genom trädet — saven stiger.
   *
   * Samma händelse som fyren och holkarna får, och samma regel: ett slag per minut som
   * faktiskt lämnat en budget (`raknaSlag` i skarmtidsfyr.js). Reglerna FLYTTAS hit, de
   * skrivs inte om — två räkningar av samma minut skulle förr eller senare säga olika saker.
   */
  slag(farg) {
    this._pulsKo = 1
    if (Number.isFinite(farg)) this.u.pulsFarg.value.setHex(farg)
  }

  /**
   * Agenternas liv i trädet: bär, vind och ekorre.
   *
   * `bar` = agenter i fel just nu (ett tillstånd, syns tills någon åtgärdar det).
   * `lov` = agenter som gick ner sedan förra hämtningen (en händelse, faller en gång).
   * `vind` = hur många som arbetar. `ekorre` = kommandokön.
   */
  setLiv({ bar = 0, lov = 0, vind = 0.35, ekorre = 0 } = {}) {
    this._barMal = Math.max(0, Math.round(bar))
    this._vindMal = vind
    this._ekorrfart = ekorre
    if (lov > 0) this._falLov(Math.round(lov))
  }

  update(dt) {
    if (!this.grupp.visible) return
    this.tid += dt
    this.u.tid.value = this.tid
    // Vinden är inte konstant, och grundstyrkan kommer från hur många agenter som arbetar.
    // Byarna ovanpå gör att kronan aldrig ser loopad ut.
    const grund = this._vindMal ?? 0.42
    this.u.vind.value = grund + Math.sin(this.tid * 0.21) * 0.16 + Math.sin(this.tid * 0.07) * 0.12
    if (this._pulsKo > 0) {
      this.u.puls.value = this._pulsKo
      this._pulsKo = Math.max(0, this._pulsKo - dt * 0.9)
    } else if (this.u.puls.value > 0) {
      this.u.puls.value = Math.max(0, this.u.puls.value - dt * 0.9)
    }

    // Bären tänds och släcks genom antalet instanser — ingen geometri skapas eller kastas.
    if (this.bar) this.bar.count = Math.min(8, this._barMal || 0)

    // Löven faller, fladdrar i sidled och försvinner ur bild.
    for (const l of this._lovPool || []) {
      if (!l.mesh.visible) continue
      l.y -= l.fart * dt
      l.fas += dt * l.snurr
      l.mesh.position.set(l.x + Math.sin(l.fas) * 3.2, l.y, l.z + Math.cos(l.fas * 0.7) * 2)
      l.mesh.rotation.set(l.fas * 0.8, l.fas * 0.5, Math.sin(l.fas) * 0.9)
      if (l.y < -70) l.mesh.visible = false
    }

    // Ekorren springer upp och ner på barken så länge kön har något i sig, och sitter still
    // annars — med svansen i rörelse, för en stillasittande ekorre är inte en död ekorre.
    if (this.ekorre) {
      const e = this.ekorre
      const fart = this._ekorrfart || 0
      if (fart > 0) {
        e.t += dt * fart * 0.16 * e.riktning
        if (e.t > 1) {
          e.t = 1
          e.riktning = -1
        } else if (e.t < 0) {
          e.t = 0
          e.riktning = 1
        }
      }
      /**
       * Banan ligger OVANFÖR grenfläkten, på den rena barken mellan holkarna.
       *
       * Andra försöket satt på rätt radie men fel höjd: mitt i fläkten, och grenarna ligger
       * framför barken sett härifrån — ekorren fanns, var rättvänd och rätt stor, och syntes
       * ändå inte i en enda bild. Tredje gången mäts skärmläget i stället för att antas.
       */
      const h = THREE.MathUtils.lerp(24, 56, e.t)
      const rad = STAM_R * 1.22
      e.grupp.position.set(Math.cos(e.vinkel) * rad, h, Math.sin(e.vinkel) * rad)
      // Vänd mestadels mot kameran, av samma skäl som holkarna: en ekorre i profil mot barken
      // är en brun fläck.
      // Trekvartsprofil: rakt framifrån döljer kroppen svansen, och då är det ingen ekorre.
      e.grupp.rotation.y = (Math.PI / 2 - e.vinkel) * 0.4 + 0.65
      e.grupp.rotation.z = fart > 0 ? Math.sin(this.tid * 9) * 0.12 : 0
      e.grupp.rotation.x = fart > 0 ? (e.riktning > 0 ? -0.3 : 0.3) : 0
      e.svans.rotation.x = Math.sin(this.tid * (fart > 0 ? 7 : 1.6)) * 0.35 - 0.2
      e.huvud.rotation.y = fart > 0 ? 0 : Math.sin(this.tid * 0.9) * 0.6
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
      bar: this.bar ? this.bar.count : 0,
      fallandeLov: (this._lovPool || []).filter((l) => l.mesh.visible).length,
      ekorre: Math.round((this._ekorrfart || 0) * 100) / 100,
      vind: Math.round((this._vindMal || 0) * 100) / 100,
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
