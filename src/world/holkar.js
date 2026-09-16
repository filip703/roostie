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
import { createLabel, KOKSMATT } from './plots.js'
import { VIKT } from './etiketter.js'
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
 * Kvistfärgerna, blandade ur paletten i stället för skrivna som nya bruna värden.
 *
 * Designs rad 301: "kvistarna är color-mix av honung, sand och espresso, inte nya bruna
 * värden. Boet följer med när paletten ändras." Samma regel här — `bland()` gör i three vad
 * `color-mix()` gör i CSS, så en ändrad palett flyttar boet med sig.
 */
const bland = (a, b, del) => new THREE.Color(a).lerp(new THREE.Color(b), del).getHex()
const KVIST = [
  bland(TAL.honey, TAL.sand, 0.35),
  bland(TAL.honey, TAL.charcoal, 0.42),
  bland(TAL.charcoal, TAL.honey, 0.22),
  bland(TAL.charcoal, TAL.natt, 0.35),
]
/** Fjädrarnas accenter — palettens, aldrig barnets färg. Se `_bo()`. */
const FJADERFARG = [TAL.clay, TAL.camel, TAL.honey, TAL.forest]
/** Designs fasta fjäderplatser, så samma nivå ger samma bo på varje skärm. */
const FJADERPLATS = [0.22, 0.7, 0.44, 0.86]
/** Skräp utan slump, ordagrant ur boritningen: samma nivå ger alltid samma bo. */
const skak = (i, m) => ((i * 37) % m) - m / 2

/**
 * Holkens mått. Fasta — och det är en ändring, inte en förenkling.
 *
 * Holken bar först Designs fem steg själv: den blev bredare och högre med bonivån. Nu bär
 * BOET PÅ PINNEN de fem stegen (`boform()`), och då får holken inte bära dem också. Två
 * ställen som ritar samma nivå är samma fel som två ställen som bar barnets färg — den ena
 * vinner tyst över den andra den dagen de går isär, och ingen ser vilken. En källa, inte två.
 *
 * Det finns ett eget skäl också: ribban, märkesringen och taklisten är alla måttsatta mot
 * holkens höjd. En holk som växer flyttar sin egen mätare mitt under avläsningen, och en
 * mätare som byter storlek när värdet ändras är svår att lita på.
 */
export function holkform() {
  return { bredd: BREDD, hojd: HOJD, djup: DJUP }
}

/**
 * NIVÅTRAPPAN — samma som Boet 2.0, inte en egen.
 *
 * Trösklarna står i Designs regelbok §1 (`src/lib/boritning.ts`, Loggboken rad 301) och
 * kopieras hit MED SINA SIFFROR, inte med en egen tolkning. Om de två någonsin går isär ser
 * ett barn ett bo i appen och ett annat bo på köksskärmen samma kväll, och då är köksskärmen
 * inte längre samma värld som telefonen. Ändras regelboken ändras den här raden också.
 *
 * Namnen och texterna är Designs, ordagrant. De är designtext och inte data.
 */
export const NIVAER = [
  { niva: 0, troskel: 0, namn: 'En kvist', text: 'Allt börjar med en kvist.' },
  { niva: 1, troskel: 10, namn: 'Några strån', text: 'Det börjar likna något.' },
  { niva: 2, troskel: 30, namn: 'Boet tar form', text: 'Nu syns det att någon bor här.' },
  { niva: 3, troskel: 65, namn: 'Väggar och varv', text: 'Det håller för vind nu.' },
  { niva: 4, troskel: 120, namn: 'Mjukt och djupt', text: 'Fjädrarna ligger invävda.' },
  { niva: 5, troskel: 200, namn: 'Ett färdigt bo', text: 'Härifrån blir fjädrarna ägg.' },
]

/** Vilken nivå ett antal fjädrar räcker till. Samma trappa som NIVAER. */
export function nivaAv(fjadrar) {
  if (!Number.isFinite(fjadrar) || fjadrar < 0) return 0
  let n = 0
  for (const s of NIVAER) if (fjadrar >= s.troskel) n = s.niva
  return n
}

/**
 * Fjädrarna ur EN budgetrad — eller `null` när fältet inte finns.
 *
 * Skillnaden mellan noll och null är hela poängen. Noll fjädrar är ett mätvärde: barnet har
 * inte tjänat något än, och boet ska visa tre kvistar på marken därför att det är sant. Null
 * är frånvaron av en läsväg: `/api/roostie` bär inget fält alls ännu, och då får holken inte
 * låtsas veta. Båda ritar samma tre kvistar i dag — men bara den ena kommer att växa, och
 * `kand` är det som skiljer dem åt i diagnosen när Sajt har lagt till fältet.
 *
 * `boniva` läses också, för det fall Sajt hellre skickar den färdiga nivån än råtalet. Den
 * vinner aldrig över `fjadrar`: råtalet är källan, nivån är en avledning av den.
 */
export function fjaderlasning(budget) {
  const f = budget?.fjadrar
  if (Number.isFinite(f) && f >= 0) return { fjadrar: f, niva: nivaAv(f), kand: true }
  const b = budget?.boniva
  if (Number.isFinite(b) && b >= 0) return { fjadrar: null, niva: Math.max(0, Math.min(5, Math.round(b))), kand: true }
  return { fjadrar: null, niva: 0, kand: false }
}

/**
 * Boets form ur nivån — Designs fem steg, översatta från yta till rymd.
 *
 * Boritningen ritar framsidan av varje varv som en båge som dippar på mitten, för den ser
 * boet rakt framifrån. Holken står på en stam och ses snett underifrån, så här är ett varv
 * en hel ring. Det är samma bo: samma trappa, samma antal invävda fjädrar (n − 1), samma
 * regel att NIVÅ 0 INTE ÄR ETT LITET BO utan tre kvistar som ligger på pinnen.
 *
 * Varvantalet är inte Designs (7 + n·4). Ett bo som är fem centimeter på skärmen behöver
 * inte tjugosju ringar för att läsas som ett bo — det behöver att ringarna GÅR ATT SKILJA
 * ÅT. Fyra till nio varv är vad som får plats innan de smälter ihop till en klump, och en
 * klump var precis det fel Design själv rättade i rad 301.
 */
export function boform(niva) {
  const n = Number.isFinite(niva) ? Math.max(0, Math.min(5, Math.round(niva))) : 0
  if (n === 0) return { niva: 0, varv: 0, kvistar: 3, fjadrar: 0, radie: 1.9, hojd: 0, hal: false }
  if (n === 1) return { niva: 1, varv: 0, kvistar: 9, fjadrar: 0, radie: 2.1, hojd: 0.5, hal: false }
  return {
    niva: n,
    varv: 2 + n,
    kvistar: 2 + n,
    // Fjädrarna är n − 1, precis som i boritningen: en ensam fjäder på nivå 2 säger att
    // något har vävts in, och full skål på nivå 5 säger att det gjorts fyra gånger.
    fjadrar: n - 1,
    // Stegen ska gå att SKILJA ÅT i en bild, inte bara i en siffra. Designs yta växer
    // nästan femtio procent från nivå två till fem; en radie som växte trettio gjorde alla
    // fyra stegen till samma bo på köksskärmen. Nu växer den lika mycket som hennes.
    radie: 1.78 + n * 0.43,
    hojd: 0.36 + n * 0.5,
    hal: true,
  }
}

/** Boets namn på nivån, Designs ord. Tomt när läsvägen inte bär fjädrar. */
export function bonamn(niva, kand) {
  if (!kand) return ''
  return NIVAER[Math.max(0, Math.min(5, Math.round(niva)))]?.namn || ''
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

      // Fjädrarna. Boet byggs om bara när nivån faktiskt ändras — en holk som river och
      // reser sitt bo varje hämtning flimrar på en skärm som står på hela dagen.
      const las = fjaderlasning(b)
      if (las.niva !== post.niva || las.kand !== post.bokand || !post.bo) {
        post.niva = las.niva
        post.bokand = las.kand
        this._bo(post, las.niva, las.kand)
      }
      post.fjadrar = las.fjadrar

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

  /** Skyltarna, för den gemensamma krockrensningen i `etiketter.js`. */
  etikettposter() {
    const ut = []
    for (const post of this.barn.values()) {
      if (post.skylt?.visible) ut.push({ namn: 'holk:' + post.namn, etikett: post.skylt, vikt: VIKT.holk })
    }
    return ut
  }

  _skylt(text, farg) {
    const s = createLabel(text, farg, 4, KOKSMATT)
    s.material.opacity = 0.92
    s.position.set(0, -HOJD * 0.62, 4)
    s.visible = true
    return s
  }

  /**
   * BOET PÅ PINNEN — fjäderdatan, i samma språk som appen.
   *
   * Holken är instrumentet: den mäter skärmtid, bär barnets färg som märke och blossar när
   * en minut går. Boet på pinnen är något annat — det är vad barnet har BYGGT, och det ska
   * inte kunna förväxlas med mätningen. Därför sitter de bredvid varandra och inte i
   * varandra: ribban kan falla till noll samma kväll som boet når nivå fyra, och båda är
   * sanna samtidigt.
   *
   * Kvistfärgerna blandas ur paletten (honung, sand, kol) i stället för att skrivas som nya
   * bruna värden. Samma skäl som Designs: boet ska följa med när paletten ändras, inte ligga
   * bredvid den. Fjädrarna bär palettens accenter — aldrig barnets färg, för färgen är ett
   * märke (rad 286) och en fjäder som bytte färg med barnet vore märket en gång till.
   */
  _bo(post, niva, kand) {
    if (post.bo) {
      post.grupp.remove(post.bo)
      post.bo.traverse((o) => {
        o.geometry?.dispose?.()
        o.material?.dispose?.()
      })
    }

    const form = boform(kand ? niva : 0)
    const g = new THREE.Group()
    // På pinnen under hålet, mitt på, och en aning fram så att varven syns mot barken.
    g.position.set(0, post.form.hojd * 0.16 - 4.35, DJUP / 2 + 1.2)
    post.grupp.add(g)
    post.bo = g
    post.boform = form

    const kvistMat = KVIST.map(
      (f) => new THREE.MeshStandardMaterial({ color: f, roughness: 0.95, flatShading: true })
    )
    const pinnar = (n, langd, radie, plats) => {
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(radie, radie * 0.8, langd(i), 4), kvistMat[i % 4])
        plats(m, i)
        m.castShadow = true
        g.add(m)
      }
    }

    if (form.varv === 0) {
      /**
       * NIVÅ 0 OCH 1 ÄR INTE SMÅ BON. Noll är tre kvistar som ligger; ett är strån i en
       * grop, utan hål. Designs skäl står i rad 301 och gäller ordagrant här: ett bo som
       * ser färdigt ut på dag ett tar bort hela poängen med att bygga det.
       */
      pinnar(
        form.kvistar,
        (i) => form.radie * (1.5 + (i % 3) * 0.35),
        0.13,
        (m, i) => {
          m.rotation.z = Math.PI / 2
          m.rotation.y = (i / form.kvistar) * Math.PI + skak(i, 7) * 0.1
          m.position.set(skak(i, 9) * 0.16, form.hojd * 0.5 + (i % 2) * 0.14, skak(i + 3, 9) * 0.12)
        }
      )
      return
    }

    // Varven. Ett varv är en hel ring — holken ses snett underifrån, inte rakt framifrån.
    // Vid som en skål: smal i botten, bred vid kanten, precis som boritningens sqrt-kurva.
    for (let v = 0; v < form.varv; v++) {
      const t = v / (form.varv - 1)
      const r = form.radie * (0.52 + 0.48 * Math.sqrt(t))
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.15 + (v % 3) * 0.035, 4, 12),
        kvistMat[v % 4]
      )
      ring.rotation.x = Math.PI / 2
      ring.rotation.z = skak(v, 11) * 0.06
      ring.position.set(skak(v, 7) * 0.05, form.hojd * t, skak(v + 2, 7) * 0.05)
      ring.castShadow = true
      g.add(ring)
    }

    // Hålet. Varmt, aldrig grått — ett grått hål ser ut som ett fel, inte som ett bo.
    const hal = new THREE.Mesh(
      new THREE.CircleGeometry(form.radie * 0.56, 12),
      new THREE.MeshStandardMaterial({ color: KVIST[3], roughness: 1 })
    )
    hal.rotation.x = -Math.PI / 2
    hal.position.y = form.hojd * 0.72
    g.add(hal)

    // Lösa kviständar vid kanten. De är skillnaden mellan en skål och ett bo.
    pinnar(
      form.kvistar,
      (i) => 1.5 + ((i * 23) % 12) * 0.14,
      0.1,
      (m, i) => {
        const a = (i / form.kvistar) * Math.PI * 2 + 0.4
        m.rotation.z = Math.PI / 2 - 0.25 - (i % 3) * 0.12
        m.rotation.y = -a
        m.position.set(
          Math.cos(a) * form.radie * 1.02,
          form.hojd * (0.5 + (i % 3) * 0.16),
          Math.sin(a) * form.radie * 1.02
        )
      }
    )

    /**
     * De invävda fjädrarna, n − 1 stycken på Designs egna platser. De ligger i kanten och
     * lutar utåt — aldrig en ensam rakt upp i mitten, för den läses som ett misstag och
     * inte som en fjäder.
     */
    for (let i = 0; i < form.fjadrar; i++) {
      const s = FJADERPLATS[i % FJADERPLATS.length]
      const a = s * Math.PI * 2
      const f = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 1.7, 3),
        new THREE.MeshStandardMaterial({ color: FJADERFARG[i % 4], roughness: 0.6, flatShading: true })
      )
      f.scale.z = 0.3
      f.position.set(
        Math.cos(a) * form.radie * 0.82,
        form.hojd * 0.92 + 0.5,
        Math.sin(a) * form.radie * 0.82
      )
      f.rotation.z = Math.cos(a) * -0.55
      f.rotation.x = Math.sin(a) * 0.55
      g.add(f)
    }
  }

  _bygg(namn, i, antal) {
    const plats = this.platser(i, antal)
    const g = new THREE.Group()
    g.position.copy(plats.punkt)
    // Holken hänger på barken och tittar utåt, samma väg som stammens yta pekar.
    g.rotation.y = plats.vinkel
    this.grupp.add(g)

    const form = holkform()
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

    /**
     * Pinnen sitter LÄGRE än den gjorde, och det är boet som flyttade den.
     *
     * Första bilden satte boet på den gamla pinnen, en bit under hålets mitt — och eftersom
     * hålet är brett låg boet mitt i det. Det såg fint ut och var fel: hålet är instrumentets
     * ansikte. Det blossar när en minut lämnar budgeten och fågelhuvudet tittar ut genom det.
     * Ett bo framför hålet döljer händelsen bakom bygget. Nu står de under varandra, och båda
     * går att läsa samtidigt.
     */
    const pinne = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.2, 6), tra)
    pinne.rotation.x = Math.PI / 2
    pinne.position.set(0, form.hojd * 0.16 - 4.6, DJUP / 2 + 1.2)
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

    const post = {
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
      bo: null,
      boform: null,
      bokand: false,
      fjadrar: null,
      slagKo: 0,
      slagTill: 0,
      satt: false,
      anvantForut: null,
    }

    // Tre kvistar på pinnen från första bilden. Det är vad kolonin vet i dag, och det är
    // sant: ingen läsväg bär fjädrar ännu. Se `fjaderlasning()`.
    this._bo(post, 0, false)
    return post
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
      bo: p.bokand ? bonamn(p.niva, true) : 'ingen läsväg',
      fjadrar: p.fjadrar,
      varv: p.boform?.varv ?? 0,
      slut: p.slut,
    }))
  }

  dispose() {
    this.scene.remove(this.grupp)
    this.barn.clear()
  }
}

const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt))
