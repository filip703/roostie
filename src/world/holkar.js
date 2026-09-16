/**
 * HOLKARNA — barnens skärmtid i Trädet.
 *
 * Kolonin har en mätare för barnen sedan tidigare (`skarmtidsfyr.js`), men den står i
 * kolonins mitt och släcks när Trädet tänds. I Trädet ska barnen ha något eget, och rad 224
 * sa vad det är: två fågelholkar på stammen, i var sin färg.
 *
 * Designs rad 281 gav språket: Boet 2.0 bygger barnens bo av enkla former i palettens
 * färger, och bonivåns fem steg ska fungera som holkstorlek här. Den kopplingen är
 * förberedd i `holkform()` — men den STÅR PÅ NOLL, för fjädrar och bonivå finns inte i
 * kolonins läsväg. En holk som växer av en påhittad nivå vore en lögn på köksskärmen, och
 * en snygg sådan är värre än ingen alls.
 *
 * DET SOM FAKTISKT MÄTS är skärmtiden, med exakt samma regler som fyren (Skatas två regler
 * från tavlans rad 136):
 *   · andelen räknas mot `tak + intjanat`, aldrig mot `tak` — ett barn kan ha använt mer än
 *     taket utan att något är fel, för det har tjänat tid på uppdrag
 *   · utan färsk data är holken grå och stilla, aldrig grön (LAXOR 23)
 *
 * FÄRGEN ÄR ETT MÄRKE, INTE EN FYLLNAD (tavlans rad 286, Lednings beslut).
 *
 * Holken bar först barnets färg som fyllnad i mätaren, och det var fel av två skäl. Lednings:
 * en fri färgväljare och en fylld yta blir förr eller senare en kontrastfälla. Och ett eget,
 * som bilden visade: FYLLNADEN KRYMPER. När Bill har två minuter kvar är hans blå nästan
 * borta — identiteten försvinner precis i det ögonblick man tittar efter den.
 *
 * Nu bär en RING kring hålet och en LIST på taket barnets färg. De är lika stora hela dygnet.
 * Mätaren får lägesfärgen, som en mätare ska ha: grön, honung, lera. Och hålets blossning vid
 * en förbrukad minut behåller barnets färg — den är en händelse, inte en yta, och den matchar
 * saven som stiger i barken i samma sekund.
 *
 * AVLÄSNINGEN STÅR KVAR. Läxan från fyren gäller här också: ett tillstånd ska gå att läsa
 * när som helst, inte bara under de två sekunder en händelse spelas upp. Ljusribban på
 * holkens sida visar hur mycket som är kvar hela tiden; hålet blossar och fågelhuvudet
 * tittar ut när en minut faktiskt lämnat budgeten.
 */
import * as THREE from 'three'
import { TAL } from './palett.js'
import { createLabel } from './plots.js'
import { identitetsFarg, raknaSlag, stapelFarg } from './skarmtidsfyr.js'

/** Holkens grundmått. Satt av läsbarheten i överblicken, inte av en riktig fågelholk. */
const BREDD = 10.5
const HOJD = 15
const DJUP = 8
/** Ljusribban: en tom ribba betyder "ingen data", en stubbe betyder "slut". Aldrig noll. */
const RIBBA_MIN = 0.06
/** Farofältet i botten — samma femtedel som fyrens. */
const FARA = 0.2
/** Hur länge ett slag syns. Samma som fyren, så de två aldrig säger olika saker. */
const SLAG_MS = 2200

/**
 * Holkens form ur bonivån i Boet 2.0.
 *
 * Designs fem steg (regelboken §1): nivån styr bredd, höjd, antal varv och antal invävda
 * fjädrar. Här styr den holkens storlek och hur många kvistvarv som syns.
 *
 * NIVÅ NOLL ÄR INTE EN NIVÅ — det är "vi vet inte". Kolonin kan inte läsa fjädrar, så det
 * är det enda ärliga svaret tills läsvägen bär dem. Funktionen finns och är testad så att
 * dagen siffran kommer är det en rad som ändras, inte en holk som ska byggas om.
 */
export function holkform(niva) {
  const n = Number.isFinite(niva) ? Math.max(0, Math.min(5, Math.round(niva))) : 0
  return {
    niva: n,
    bredd: BREDD * (1 + n * 0.06),
    hojd: HOJD * (1 + n * 0.04),
    varv: n === 0 ? 0 : 1 + n,
    fjadrar: n === 0 ? 0 : n,
    kand: n > 0,
  }
}

/**
 * Hur högt ljusribban står, som andel av sin egen längd.
 *
 * Samma kurva som fyrens stapel, men uttryckt i andel i stället för enheter, eftersom
 * ribban sitter på en holk vars höjd kan ändras av bonivån. Full budget fyller ribban, slut
 * lämnar en stubbe, ingen data lämnar ribban tom — och de tre går att skilja åt.
 */
export function ribbaAndel(andel, fardig = true) {
  if (!fardig) return 0
  const a = Number.isFinite(andel) ? Math.min(1, Math.max(0, andel)) : 0
  return RIBBA_MIN + a * (1 - RIBBA_MIN)
}

/** Texten under holken. Tre lägen, tre olika ord — aldrig ett tomt fält. */
export function holktext(namn, kvar, fardig) {
  const n = String(namn || '')
  if (!fardig) return `${n} okänd`
  return Number(kvar) > 0 ? `${n} ${Math.round(kvar)} min` : `${n} slut`
}

export class Holkar {
  /**
   * @param scene         three-scenen
   * @param platser  funktion (i, antal) → { punkt, vinkel } på barken
   */
  constructor(scene, platser) {
    this.scene = scene
    this.platser = platser
    this.grupp = new THREE.Group()
    this.grupp.name = 'holkar'
    this.grupp.visible = false
    scene.add(this.grupp)
    this.barn = new Map()
    this.tid = 0
    this.fardig = false
  }

  setVisible(v) {
    this.grupp.visible = Boolean(v)
  }

  /** Samma data som fyren får: `/api/puls` med budgetar och `fardig`. */
  set(data) {
    const budgetar = Array.isArray(data?.budgetar) ? data.budgetar : []
    this.fardig = Boolean(data?.fardig)
    if (!budgetar.length) {
      this.grupp.visible = false
      return
    }

    const kvar = new Set(this.barn.keys())
    budgetar.forEach((b, i) => {
      kvar.delete(b.namn)
      let post = this.barn.get(b.namn)
      if (!post) {
        post = this._bygg(b.namn, i, budgetar.length)
        this.barn.set(b.namn, post)
      }

      // Ett slag per minut som lämnat DET HÄR barnets budget sedan förra hämtningen.
      post.slagKo = raknaSlag(post.anvantForut, b.anvant, this.fardig, post.slagKo)
      if (this.fardig) post.anvantForut = b.anvant

      post.andel = Number.isFinite(b.andel) ? b.andel : 0
      post.mal = ribbaAndel(post.andel, this.fardig)
      post.lagesFarg = stapelFarg(post.andel, this.fardig)
      post.farg = this.fardig ? identitetsFarg(b.farg, post.andel, true) : TAL.sage
      post.slut = this.fardig && Number(b.kvar) <= 0

      const text = holktext(b.namn, b.kvar, this.fardig)
      if (text !== post.text) {
        post.text = text
        post.skylt.material.map?.dispose?.()
        post.grupp.remove(post.skylt)
        post.skylt = this._skylt(text, post.farg)
        post.grupp.add(post.skylt)
      }
    })

    for (const namn of kvar) {
      const post = this.barn.get(namn)
      this.grupp.remove(post.grupp)
      this.barn.delete(namn)
    }
  }

  _skylt(text, farg) {
    const s = createLabel(text, farg)
    s.material.opacity = 0.92
    s.position.set(0, -HOJD * 0.62, 4)
    s.visible = true
    return s
  }

  _bygg(namn, i, antal) {
    const plats = this.platser(i, antal)
    const g = new THREE.Group()
    g.position.copy(plats.punkt)
    // Holken hänger på barken och tittar utåt, samma väg som stammens yta pekar.
    g.rotation.y = plats.vinkel
    this.grupp.add(g)

    const form = holkform(0)
    const tra = new THREE.MeshStandardMaterial({ color: 0x6b5947, roughness: 0.92, flatShading: true })
    const morkt = new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 1, flatShading: true })

    // Kroppen, taket och den lilla plattan som håller den mot stammen.
    const kropp = new THREE.Mesh(new THREE.BoxGeometry(form.bredd, form.hojd, DJUP), tra)
    kropp.castShadow = true
    kropp.receiveShadow = true
    g.add(kropp)

    const tak = new THREE.Mesh(new THREE.BoxGeometry(form.bredd * 1.32, 0.8, DJUP * 1.5), tra)
    tak.position.set(0, form.hojd / 2 + 0.6, 0.9)
    tak.rotation.x = -0.26
    tak.castShadow = true
    g.add(tak)

    const rygg = new THREE.Mesh(new THREE.BoxGeometry(form.bredd * 1.1, form.hojd * 1.2, 0.7), morkt)
    rygg.position.z = -DJUP / 2 - 0.3
    g.add(rygg)

    // Hålet. Mörkt i botten, och en lysande skiva strax innanför som bär barnets färg.
    const hal = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1.6, 14), morkt)
    hal.rotation.x = Math.PI / 2
    hal.position.set(0, form.hojd * 0.16, DJUP / 2 - 0.2)
    g.add(hal)

    const skenMat = new THREE.MeshBasicMaterial({
      color: TAL.sage,
      transparent: true,
      opacity: 0.55,
      toneMapped: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const sken = new THREE.Mesh(new THREE.CircleGeometry(2, 16), skenMat)
    sken.position.set(0, form.hojd * 0.16, DJUP / 2 + 0.06)
    g.add(sken)

    // Pinnen under hålet, och fågelhuvudet som tittar ut när en minut går.
    /**
     * MÄRKET: ringen kring hålet och listen på taket, i barnets färg.
     *
     * De ändrar aldrig storlek. Det är hela skillnaden mot fyllnaden de ersätter — ett märke
     * som krymper med mätvärdet är inte ett märke, det är mätvärdet en gång till.
     */
    const markMat = new THREE.MeshStandardMaterial({
      color: TAL.sage,
      roughness: 0.4,
      metalness: 0.05,
      flatShading: true,
      emissive: 0x000000,
      emissiveIntensity: 0.35,
    })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.42, 4, 18), markMat)
    ring.position.set(0, form.hojd * 0.16, DJUP / 2 + 0.1)
    g.add(ring)

    const list = new THREE.Mesh(new THREE.BoxGeometry(form.bredd * 1.3, 0.5, 0.6), markMat)
    list.position.set(0, form.hojd / 2 + 0.3, DJUP / 2 + 0.75)
    g.add(list)

    const pinne = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.2, 6), tra)
    pinne.rotation.x = Math.PI / 2
    pinne.position.set(0, form.hojd * 0.16 - 2.2, DJUP / 2 + 1.2)
    g.add(pinne)

    const huvud = new THREE.Group()
    huvud.position.set(0, form.hojd * 0.16, DJUP / 2 - 0.9)
    huvud.visible = false
    g.add(huvud)
    const skalle = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), new THREE.MeshStandardMaterial({ color: TAL.sage, roughness: 0.7, flatShading: true }))
    huvud.add(skalle)
    const nabb = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.1, 4), new THREE.MeshStandardMaterial({ color: TAL.honey, roughness: 0.5, flatShading: true }))
    nabb.rotation.x = Math.PI / 2
    nabb.position.set(0, -0.1, 0.9)
    huvud.add(nabb)

    /**
     * LJUSRIBBAN på holkens sida — avläsningen som står kvar.
     *
     * Spöket är hela budgeten med streck vid fjärdedelarna: en ensam lysande stapel säger
     * inte "en fjärdedel av vad". Den fyllda delen är det som är kvar, i barnets egen färg,
     * och farofältet i botten lyser när sista femtedelen är inne.
     */
    const ribbaH = form.hojd * 0.86
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, ribbaH, 0.2),
      new THREE.MeshBasicMaterial({ color: TAL.stomme, transparent: true, opacity: 0.85, toneMapped: false })
    )
    spoke.position.set(-form.bredd / 2 + 2.1, 0, DJUP / 2 + 0.06)
    g.add(spoke)

    for (let k = 1; k < 4; k++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.24, 0.2),
        new THREE.MeshBasicMaterial({ color: TAL.dampad, transparent: true, opacity: 0.55, toneMapped: false })
      )
      m.position.set(-form.bredd / 2 + 2.1, -ribbaH / 2 + (ribbaH * k) / 4, DJUP / 2 + 0.14)
      g.add(m)
    }

    const fyllnad = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1, 0.24),
      new THREE.MeshBasicMaterial({ color: TAL.sage, toneMapped: false, transparent: true, opacity: 0.95 })
    )
    fyllnad.position.set(-form.bredd / 2 + 2.1, -ribbaH / 2, DJUP / 2 + 0.22)
    g.add(fyllnad)

    const farofalt = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, ribbaH * FARA, 0.24),
      new THREE.MeshBasicMaterial({ color: TAL.crit, transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending })
    )
    farofalt.position.set(-form.bredd / 2 + 2.1, -ribbaH / 2 + (ribbaH * FARA) / 2, DJUP / 2 + 0.3)
    g.add(farofalt)

    const skylt = this._skylt(`${namn} okänd`, TAL.sage)
    g.add(skylt)

    return {
      namn,
      grupp: g,
      form,
      ribbaH,
      markMat,
      sken,
      huvud,
      skalle,
      fyllnad,
      farofalt,
      skylt,
      text: `${namn} okänd`,
      andel: 0,
      mal: 0,
      niva: 0,
      farg: TAL.sage,
      lagesFarg: TAL.sage,
      slut: false,
      slagKo: 0,
      slagTill: 0,
      satt: false,
      anvantForut: null,
    }
  }

  update(dt, camera, natt = 0) {
    if (!this.grupp.visible) return
    this.tid += dt
    const nu = performance.now()

    for (const post of this.barn.values()) {
      if (post.slagKo > 0 && nu > post.slagTill) {
        post.slagKo -= 1
        post.slagTill = nu + SLAG_MS
      }
      const slag = nu < post.slagTill ? 1 - (post.slagTill - nu) / SLAG_MS : 0

      /**
       * Ribban rör sig mjukt mot sitt mål — men bara mjukt, inte långsamt.
       *
       * Första försöket dämpade med lambda 3, och på en långsam maskin (mjukvarurendering,
       * några bilder i sekunden) tog mätaren tjugofem sekunder på sig att nå sin avläsning.
       * En mätare som visar fel siffra i en halv minut efter att sidan öppnats är en mätare
       * som ljuger — och köksskärmen ritas av en NUC, inte av ett grafikkort. Första
       * avläsningen sätts därför RAKT PÅ, och först därefter dämpas rörelsen.
       */
      const mal = Math.max(0.001, post.mal) * post.ribbaH
      post.fyllnad.scale.y = post.satt ? damp(post.fyllnad.scale.y, mal, 8, dt) : mal
      post.satt = true
      post.fyllnad.position.y = -post.ribbaH / 2 + post.fyllnad.scale.y / 2
      // Mätaren bär läget — grön, honung, lera — och aldrig identiteten. Se filhuvudet.
      post.fyllnad.material.color.setHex(post.lagesFarg)
      post.fyllnad.material.opacity = this.fardig ? 0.95 : 0.25

      // Märket bär identiteten och står stilla. Utan färsk data är det dämpat, inte borta:
      // vems holk det är slutar inte vara sant för att mätningen tystnat.
      post.markMat.color.setHex(post.farg)
      post.markMat.emissive.setHex(this.fardig ? post.farg : 0x000000)
      post.markMat.emissiveIntensity = this.fardig ? 0.22 + natt * 0.3 : 0

      // Farofältet lyser bara när det faktiskt är farligt, och andas i stället för att blinka.
      const farligt = this.fardig && post.andel <= FARA
      post.farofalt.material.opacity = farligt ? 0.18 + Math.sin(this.tid * 2.2) * 0.1 : 0

      // Hålet bär barnets färg och blossar när en minut går.
      post.sken.material.color.setHex(post.farg)
      post.sken.material.opacity = (this.fardig ? 0.34 : 0.12) + slag * 0.55
      post.sken.scale.setScalar(1 + slag * 0.35)

      // Fågelhuvudet tittar ut under slaget — händelsen, ovanpå avläsningen.
      post.huvud.visible = slag > 0.02
      if (post.huvud.visible) {
        post.skalle.material.color.setHex(post.farg)
        post.huvud.position.z = post.form.hojd * 0 + (DJUP / 2 - 0.9) + Math.sin(slag * Math.PI) * 1.9
        post.huvud.rotation.z = Math.sin(this.tid * 9) * 0.18
      }

      if (camera) post.skylt.material.opacity = 0.92
    }
  }

  diagnos() {
    return [...this.barn.values()].map((p) => ({
      namn: p.namn,
      text: p.text,
      andel: Math.round(p.andel * 100) / 100,
      ribba: Math.round(p.mal * 100) / 100,
      niva: p.niva,
      slut: p.slut,
    }))
  }

  dispose() {
    this.scene.remove(this.grupp)
    this.barn.clear()
  }
}

const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt))
