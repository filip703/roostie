/**
 * Maskinparken — NUC:ens containrar som maskiner på kolonins mark.
 *
 * Agenter är inga astronauter. En astronaut är ett samtal som bygger något; en agent är en
 * maskin som går, står eller är trasig. Därför får de fast plats på fyra gårdar — en per
 * uppdrag — och en skylt var som säger vad maskinen gör.
 *
 * Det som syns:
 *   kör och arbetar   — rotorn snurrar, maskinen lyser i sin färg, ett ljus pulsar
 *   kör men tyst      — rotorn går på tomgång, allt dämpas (inget har hänt i loggen på en stund)
 *   nere              — stilla och mörkt
 *   fel               — blinkande varningsljus
 *   okänd             — mörkt och stilla, för att ingen mätt (LAXOR 23: "vet ej" är aldrig "ok")
 *
 * Varje maskin har sin egen klocka. Den delade `uTime` i buildingUniforms driver hela
 * koloniens rotorer på en gång, och en maskin som stannat måste kunna stanna ensam.
 *
 * Parken är byggd som en anläggning, inte som fyra högar: fyra sexkantiga gårdar på samma
 * nivå, var och en med sin mast och sin skylt, förbundna med gångbroar in till ett nav i
 * mitten. Att de ligger i våg och hänger ihop är hela poängen — det är så man ser att de är
 * samma maskinpark och inte fyra olika.
 */
import * as THREE from 'three'
import { createBuilding } from './buildings.js'
import { atlasTexture, part } from './kit.js'
import { createLabel, hashString } from './plots.js'
import { deckSurface } from './surfaces.js'
import { TAL, CSS, rgba } from './palett.js'
import { SANS, spartext } from './skyltverk.js'

/**
 * Gårdarna är inte rutnät.
 *
 * Fyrtio maskiner på rad läser som ett kalkylark, inte som en plats — och en agent som står
 * i kolumn tre rad två blir aldrig "den där borta vid masten". Platserna läggs därför i en
 * gyllene-vinkel-spiral ut från gårdens mast: tät i mitten, glesare utåt, aldrig två i linje,
 * och ändå helt bestämd av ordningen så att samma agent alltid hamnar på samma ställe.
 */
const SPRIDNING = 2.55 // hur glest spiralen växer
const GYLLENE = Math.PI * (3 - Math.sqrt(5))
const GATA = 7 // luft mellan gårdarna
/** Hur stort torget kring masten är, uttryckt som spiralens startsteg. */
const TORG = 3.6
/** Hur högt gårdarnas gemensamma däck ligger över markens högsta punkt under dem. */
const PLATAHOJD = 1.2
/** Navets radie, där broarna möts. */
const NAVRADIE = 3.6
const SKALA = 0.34
/** Robothemmets däck: så högt över gårdens yta maskinen står. */
const DACKY = 0.22

/**
 * Fälten, ett per uppdrag.
 *
 * Fyrtio maskiner i en klump säger ingenting om vem som gör vad. Agenterna har olika uppdrag
 * och olika ägare — Roosts produktagenter är Box & molns, resten är hemmets — och gården är
 * ritad så att den gränsen syns: fyra gårdar med var sin mast, var sin skylt och var sitt lag.
 */
const FALT = {
  roost: { namn: 'ROOST · PRODUKTAGENTER', farg: TAL.clay, ruta: [-1, -1] },
  nat: { namn: 'HEMMET · NÄT OCH WIFI', farg: TAL.petrol, ruta: [1, -1] },
  hem: { namn: 'HEMMET · HUSET', farg: TAL.honey, ruta: [-1, 1] },
  data: { namn: 'HEMMET · MÄTNING OCH MINNE', farg: TAL.camel, ruta: [1, 1] },
}
/** Gårdarna som agenttavlan behöver känna till: nyckel, namn och färg. */
export const FALTLISTA = Object.entries(FALT).map(([nyckel, f]) => ({ nyckel, namn: f.namn, farg: f.farg }))

const FARG = {
  ok: TAL.gron,
  nere: TAL.dampad,
  fel: TAL.crit,
  okand: TAL.sage,
}
const SLACKT = 0x2b332e
/** Hur länge efter en loggrad en maskin räknas som arbetande. */
const AKTIV_MS = 5 * 60 * 1000
/** Så nära måste man vara för att en maskin ska säga sitt namn utan att ha gjort något. */
const NARA = 17

/** Maskintyper, valda ur namnet så en agent alltid får samma maskin. */
const SORTER = ['antenna', 'solar', 'greenhouse', 'tower', 'reactor']

/** En liten lykta på en stolpe vid varje hem — status som går att läsa tvärs över kolonin. */
const FYR_GEO = new THREE.SphereGeometry(0.2, 10, 8)
/** Paketet som åker längs kabeln när en maskin rapporterar in. */
const PAKET_GEO = new THREE.SphereGeometry(0.13, 8, 6)

/**
 * Robothemmet.
 *
 * Förut stod varje maskin på en tunn svart bricka, och fyrtio brickor läser som fyrtio
 * tappade lock. Hemmet är i stället byggt som en liten landningsplatta: en sockel som möter
 * marken, ett däck ovanpå, och en lysande ring i kanten som bär maskinens status — så att
 * gården går att läsa på håll även när lyktorna är för små för att synas.
 */
const HEM_SOCKEL = new THREE.CylinderGeometry(1.1, 1.24, 0.2, 6)
const HEM_DACK = new THREE.CylinderGeometry(0.98, 1.1, 0.16, 6)
const HEM_RING = new THREE.TorusGeometry(1.03, 0.042, 5, 6)
const HEM_STOLPE = new THREE.CylinderGeometry(0.045, 0.062, 1.1, 5)

/** Gårdarnas terrass: sockel, däck, färgad rand och en inre platta. Skalas per gård. */
const SOCKEL_GEO = new THREE.CylinderGeometry(1, 1.06, 1, 6)
const DACK_GEO = new THREE.CylinderGeometry(1, 1, 1, 6)
const RAND_GEO = new THREE.CylinderGeometry(1, 1, 1, 6)

/**
 * Vad maskinen gör, på svenska.
 *
 * Ett containernamn säger ingenting för den som går förbi köksskärmen. Listan är display-text
 * och inget annat — sanningen om vad en agent gör står i agentens egen kod och i
 * containervakten. Saknas ett namn står bara namnet, aldrig en gissning.
 */
export const JOBB = {
  'nexus-screentime': 'räknar skärmtid',
  'nexus-blockdevices': 'spärrar enheter',
  'nexus-commands': 'kör kommandon',
  'nexus-netflow': 'ser trafiken',
  'nexus-dns': 'läser DNS',
  'nexus-identity': 'känner igen enheter',
  'nexus-fingerprint': 'namnger nya enheter',
  'nexus-wifiwatch': 'vaktar wifi',
  'nexus-blocksync': 'synkar spärrar',
  'nexus-roost-allow': 'släpper fram appen',
  'nexus-skyddsvakt': 'skyddsvakt',
  'nexus-doctor': 'hälsokoll',
  'nexus-telemetry': 'mäter nätet',
  'nexus-switch': 'läser switchen',
  'nexus-unleashed': 'läser accesspunkter',
  'nexus-probes': 'mäter kvalitet',
  'nexus-habridge': 'speglar Home Assistant',
  'nexus-camera': 'kameror',
  'nexus-brain': 'samlar hemmets data',
  'nexus-ai': 'AI-jobb',
  'nexus-configbak': 'säkerhetskopierar config',
  'nexus-cloudflare': 'vaktar tunneln',
  'nexus-dhcp': 'delar ut adresser',
  'nexus-insights': 'sammanfattar',
  'nexus-rollup': 'summerar dygnet',
  'nexus-habits': 'vanor',
  'nexus-skola': 'skoldata',
  'nexus-familjestund': 'familjestund',
  'nexus-stunder': 'stunder',
  'nexus-sirisync': 'Siri-genvägar',
  'nexus-guestnet': 'gästnätet',
  'nexus-fast': 'snabbkanal',
  'nexus-ollama': 'lokal modell',
  'nexus-tunnel': 'tunneln',
  'nexus-portal': 'familjeportalen',
  adguard: 'DNS-filtret',
  homeassistant: 'Home Assistant',
  'music-assistant': 'musiken',
  'uptime-kuma': 'uppetidsvakt',
  'eufy-security-ws': 'kameralänk',
  'gastnat-watcher': 'gästnätsvakt',
}

/**
 * Drönaren.
 *
 * Den var en oktaeder, och en oktaeder ser ut som en oktaeder. En drönare är en kropp, fyra
 * armar, fyra motorer och fyra rotorer som går — det är rotorerna som gör att ögat läser
 * "flygande maskin" på en tiondels sekund. Bladen är riktiga blad som snurrar, med en svag
 * lysande skiva ovanpå som suddet, och ett blinkande navljus akterut.
 */
function byggDronare(farg) {
  const g = new THREE.Group()
  const skal = new THREE.MeshStandardMaterial({ color: TAL.stomme, roughness: 0.48, metalness: 0.5 })
  const lys = new THREE.MeshBasicMaterial({ color: farg, transparent: true, opacity: 0.95, toneMapped: false })

  const kropp = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.15, 0.34), skal)
  kropp.castShadow = true
  g.add(kropp)

  // Sensorkupan sitter i nosen, så det går att se vart drönaren är riktad.
  const kupa = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), lys)
  kupa.position.set(0, -0.03, 0.2)
  g.add(kupa)

  const rotorer = []
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.045, 0.06), skal)
    arm.position.set(sx * 0.16, 0, sz * 0.16)
    arm.rotation.y = -Math.atan2(sz, sx)
    g.add(arm)

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.11, 6), skal)
    motor.position.set(sx * 0.3, 0.04, sz * 0.3)
    g.add(motor)

    const nav = new THREE.Group()
    nav.position.set(sx * 0.3, 0.11, sz * 0.3)
    const blad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.01, 0.05), skal)
    nav.add(blad)
    const blad2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.01, 0.05), skal)
    blad2.rotation.y = Math.PI / 2
    nav.add(blad2)
    // Suddet: en additiv skiva i lagets färg, så rotorn syns även när bladen står still i bild.
    const skiva = new THREE.Mesh(
      new THREE.CircleGeometry(0.21, 16),
      new THREE.MeshBasicMaterial({
        color: farg,
        transparent: true,
        opacity: 0.13,
        toneMapped: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    skiva.rotation.x = -Math.PI / 2
    skiva.position.y = 0.012
    nav.add(skiva)
    g.add(nav)
    rotorer.push(nav)
  }

  const underljus = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), lys)
  underljus.position.set(0, -0.11, 0)
  g.add(underljus)

  const navljus = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 6, 5),
    new THREE.MeshBasicMaterial({ color: TAL.crit, transparent: true, opacity: 1, toneMapped: false })
  )
  navljus.position.set(0, 0.09, -0.22)
  g.add(navljus)

  g.userData = { rotorer, navljus, lys }
  return g
}

/**
 * Gårdsskylten.
 *
 * Gårdarnas namn hängde i luften som sprites. En anläggning har skyltar som står på marken,
 * och de fyra står vända åt samma håll vid infarten — så man läser parken som en karta i
 * stället för att jaga flytande text.
 */
function byggGardsskylt(namn, farg) {
  const g = new THREE.Group()
  const stal = new THREE.MeshStandardMaterial({ color: TAL.stomme, roughness: 0.66, metalness: 0.4 })

  const B = 4.6
  const H = 1.2
  for (const dx of [-B / 2 + 0.35, B / 2 - 0.35]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 1.35, 6), stal)
    post.position.set(dx, 0.675, 0)
    post.castShadow = true
    g.add(post)
  }

  const duk = document.createElement('canvas')
  duk.width = 1024
  duk.height = 268
  const c = duk.getContext('2d')
  c.fillStyle = CSS.natt
  c.fillRect(0, 0, duk.width, duk.height)
  c.fillStyle = `#${farg.toString(16).padStart(6, '0')}`
  c.fillRect(0, 0, 22, duk.height)
  c.fillStyle = rgba('cream', 0.1)
  c.fillRect(56, duk.height - 62, duk.width - 112, 2)
  c.textBaseline = 'middle'
  c.textAlign = 'left'
  c.font = `600 62px ${SANS}`
  c.fillStyle = CSS.cream
  spartext(c, namn, 60, duk.height / 2 - 12, 7)
  const textur = new THREE.CanvasTexture(duk)
  textur.colorSpace = THREE.SRGBColorSpace
  textur.anisotropy = 8

  const ram = new THREE.Mesh(new THREE.BoxGeometry(B + 0.16, H + 0.16, 0.12), stal)
  ram.position.set(0, 1.35, 0)
  ram.castShadow = true
  g.add(ram)
  const platta = new THREE.Mesh(
    new THREE.PlaneGeometry(B, H),
    new THREE.MeshBasicMaterial({ map: textur, toneMapped: false })
  )
  platta.position.set(0, 1.35, 0.07)
  g.add(platta)

  // Lutar bakåt ett par grader, som en skylt som faktiskt står i marken.
  g.rotation.x = -0.07
  g.userData = { textur }
  return g
}

export class Maskinpark {
  constructor(scene, plats) {
    this.scene = scene
    this.grupp = new THREE.Group()
    this.grupp.position.set(plats.x, plats.y, plats.z)
    this.grupp.visible = false
    scene.add(this.grupp)

    this.maskiner = new Map()
    this.nyckel = ''
    this.hojd = () => 0
    this.antal = Object.fromEntries(Object.keys(FALT).map((k) => [k, 0]))
    this.dackY = 0

    /**
     * Rovern är kommandoprocessorn.
     *
     * `nexus-commands` är den agent som faktiskt åker ut och gör något i hemmet när appen
     * ber om det — den enda i parken vars jobb är en resa. Så länge den skriver i loggen
     * kör rovern ut på gatan och hem igen; tystnar den står den parkerad vid sin box.
     */
    this.rover = null
    this.roverT = 0
    this.roverRiktning = 1

    /**
     * Roosts läsväg (`/api/roostie`) när den svarar: agenternas riktiga puls och kommandokön.
     *
     * Docker kan bara säga att en container kör. Pulsen säger att agenten *arbetar*, mätt mot
     * agentens egen takt — doctor med 820 sekunder sedan är frisk med intervall 900, medan
     * screentime med samma siffra vore död. Finns pulsen vinner den över loggraden; saknas
     * den faller maskinen tillbaka på loggen, som är trubbig men ärlig.
     */
    this.puls = new Map()
    this.ko = null
    this.pulsFardig = false

    /**
     * Navet där broarna möts.
     *
     * Fyra gårdar bredvid varandra är fyra gårdar. Fyra gårdar med broar in till ett nav är
     * en anläggning — och när en gård rapporterar in springer en puls längs bron hit, vilket
     * är det enklaste ärliga sättet att visa att de hänger ihop.
     */
    this.nav = new THREE.Group()
    this.nav.visible = false
    this.grupp.add(this.nav)
    this.navDack = new THREE.Mesh(DACK_GEO, this._golv(TAL.sage, 0.62))
    this.navDack.receiveShadow = true
    this.navSockel = new THREE.Mesh(
      SOCKEL_GEO,
      new THREE.MeshStandardMaterial({ color: TAL.charcoal, roughness: 0.95, metalness: 0.04 })
    )
    this.navPylon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.5, 3.2, 6),
      new THREE.MeshStandardMaterial({ color: TAL.stomme, roughness: 0.6, metalness: 0.45 })
    )
    this.navPylon.castShadow = true
    this.navRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.07, 6, 24),
      new THREE.MeshBasicMaterial({ color: TAL.sage, transparent: true, opacity: 0.5, toneMapped: false })
    )
    this.navRing.rotation.x = -Math.PI / 2
    // Ett ljus i toppen: navet är parkens mittpunkt och ska gå att hitta på håll.
    this.navLykta = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 10),
      new THREE.MeshBasicMaterial({ color: TAL.sage, transparent: true, opacity: 0.85, toneMapped: false })
    )
    this.nav.add(this.navSockel, this.navDack, this.navPylon, this.navRing, this.navLykta)
    this.navBlink = 0

    // Gårdarna. Utan dem ser maskinerna ut som skrot någon tappat i terrängen; med dem är
    // det en anläggning.
    this.plattor = {}
    for (const [grupp, { namn, farg }] of Object.entries(FALT)) {
      const sockel = new THREE.Mesh(
        SOCKEL_GEO,
        new THREE.MeshStandardMaterial({ color: TAL.charcoal, roughness: 0.95, metalness: 0.04 })
      )
      sockel.receiveShadow = true
      sockel.visible = false

      // Färgad rand i lagets färg strax under däcket — den ger gården en synlig sockellinje
      // i stället för en rand som marken äter upp.
      const rand = new THREE.Mesh(
        RAND_GEO,
        new THREE.MeshStandardMaterial({
          color: farg,
          emissive: farg,
          emissiveIntensity: 0.28,
          roughness: 0.7,
          metalness: 0.12,
        })
      )
      rand.visible = false

      const dack = new THREE.Mesh(DACK_GEO, this._golv(farg, 0.78))
      dack.receiveShadow = true
      dack.visible = false

      // En inre platta kring masten: terrassen får ett steg, och masten en tydlig plats.
      const inre = new THREE.Mesh(DACK_GEO, this._golv(farg, 0.52))
      inre.receiveShadow = true
      inre.visible = false

      const skylt = byggGardsskylt(namn, farg)
      skylt.visible = false

      // Bron in till navet, med räcken.
      const bro = new THREE.Group()
      bro.visible = false
      const brodack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.26, 1), this._golv(TAL.sage, 0.6))
      brodack.receiveShadow = true
      bro.add(brodack)
      const rackeMat = new THREE.MeshStandardMaterial({ color: TAL.stomme, roughness: 0.6, metalness: 0.45 })
      const racken = []
      for (const sx of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1), rackeMat)
        r.position.set(sx * 1.28, 0.32, 0)
        bro.add(r)
        racken.push(r)
      }
      // Pulsen som springer in till navet när gården rapporterat.
      const bropuls = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: farg, transparent: true, opacity: 0, toneMapped: false })
      )
      this.grupp.add(bropuls)

      this.grupp.add(sockel, rand, dack, inre, skylt, bro)
      this.plattor[grupp] = {
        sockel,
        rand,
        dack,
        inre,
        skylt,
        bro,
        brodack,
        racken,
        bropuls,
        bropulsT: 1,
        farg,
        mast: null,
        masttid: { value: 0 },
        blink: 0,
        mitt: new THREE.Vector3(),
        navpunkt: new THREE.Vector3(),
      }
    }
  }

  /**
   * Golvet.
   *
   * Gårdarna var svarta skivor: rätt färg på kanten, men ett golv som slukade allt som stod
   * på det. Koloniens plättar är inte svarta — de är en plåtyta i zonens färg, avmättad och
   * nedtonad — och maskinparken är samma värld. Samma plåt, samma logik: lagets färg, långt
   * ner i mättnad, så maskinerna syns mot den i stället för att försvinna i den.
   */
  _golv(farg, styrka) {
    if (!this._plat) this._plat = deckSurface()
    const klona = (t) => {
      if (!t) return null
      const k = t.clone()
      k.wrapS = THREE.RepeatWrapping
      k.wrapT = THREE.RepeatWrapping
      k.repeat.set(3.5, 3.5)
      k.needsUpdate = true
      return k
    }
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(TAL.charcoal).lerp(new THREE.Color(farg), styrka * 0.55),
      map: klona(this._plat.map),
      normalMap: klona(this._plat.normalMap),
      roughnessMap: klona(this._plat.roughnessMap),
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.84,
      metalness: 0.16,
    })
  }

  /** Roosts läsväg in: pulsen per agent och kommandokön. */
  setPuls(data) {
    this.puls = new Map((Array.isArray(data?.puls) ? data.puls : []).map((p) => [`nexus-${p.agent}`, p]))
    this.ko = data?.ko || null
    this.pulsFardig = Boolean(data?.fardig)
  }

  /**
   * Om maskinen arbetar just nu.
   *
   * Pulsen är sanningen när den finns — den mäter mot agentens egen takt. Utan puls får
   * loggraden duga: trubbig, men den är vad docker kan se.
   */
  _arbetar(post, namn, nu) {
    if (post.status !== 'ok') return false
    const p = this.pulsFardig ? this.puls.get(namn) : null
    if (p) return p.status === 'ok' && !p.tyst
    return post.sistaLogg > 0 && nu - post.sistaLogg < AKTIV_MS
  }

  /**
   * Hur mycket mark parken tar. Kolonin håller undan stenar och buskar innanför den —
   * ett klippblock mitt i ett maskinfält läser som ett fel, inte som natur.
   */
  radie() {
    if (!this.maskiner.size) return 0
    const r = this._faltradie()
    return this._avstand(r) + r + 4
  }

  /** Gårdens egen radie: så långt ut spiralen når för det största laget, plus lite kant. */
  _faltradie() {
    const flest = Math.max(...Object.values(this.antal), 1)
    return SPRIDNING * Math.sqrt(flest - 1 + TORG) + 2.2
  }

  /** Avståndet från parkens mitt ut till en gårds mitt. */
  _avstand(r) {
    return Math.SQRT2 * (r + GATA / 2)
  }

  /**
   * Markens högsta och lägsta punkt inom en gård.
   *
   * Terrängen böljar, och en platt skiva lagd rakt på den blir uppäten av marken. Gårdarna
   * ligger därför på terrasser — och alla fyra på SAMMA nivå, så broarna in till navet går
   * i våg. En anläggning där varje gård ligger på sin egen höjd ser ut som en olycka.
   */
  _markSpann(mx, mz, r) {
    let hogst = -Infinity
    let lagst = Infinity
    const prov = [[0, 0]]
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      prov.push([Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6])
      prov.push([Math.cos(a) * r, Math.sin(a) * r])
    }
    for (const [dx, dz] of prov) {
      const h = this.hojd(this.grupp.position.x + mx + dx, this.grupp.position.z + mz + dz) - this.grupp.position.y
      if (h > hogst) hogst = h
      if (h < lagst) lagst = h
    }
    return { hogst, lagst }
  }

  /**
   * Plats nummer i i spiralen, i gårdens eget koordinatsystem.
   *
   * Spiralen börjar utanför masttorget. Förut startade den i gårdens mittpunkt, så den
   * första maskinen ställde sig ovanpå masten och åt upp den: masten fanns, men ingen kunde
   * se den. Ett torg i mitten är också vad som gör kablarna läsbara som ekrar.
   */
  _spiral(i, fro) {
    const r = SPRIDNING * Math.sqrt(i + TORG)
    const a = i * GYLLENE + fro
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, vinkel: a }
  }

  /** Kolonin lämnar en markhöjdsfunktion hit, så maskinerna står på marken och inte i den. */
  markhojd(fn) {
    this.hojd = fn || (() => 0)
    this._plattor()
    for (const m of this.maskiner.values()) this._placera(m)
  }

  set(lista) {
    const rader = Array.isArray(lista) ? lista : []
    const nyckel = rader.map((m) => `${m.namn}:${m.status}:${m.sistaLogg || 0}`).join('|')
    if (nyckel === this.nyckel) return
    this.nyckel = nyckel
    this.grupp.visible = rader.length > 0

    const kvar = new Set(this.maskiner.keys())
    const grupper = Object.fromEntries(Object.keys(FALT).map((k) => [k, []]))
    for (const m of rader) (grupper[m.grupp] || grupper.hem).push(m)
    this.antal = Object.fromEntries(Object.entries(grupper).map(([k, v]) => [k, v.length]))

    // Gårdarna och masterna först: maskinerna drar sina kablar dit, så gården måste finnas
    // innan den möbleras.
    this._plattor()

    for (const [grupp, medlemmar] of Object.entries(grupper)) {
      medlemmar.forEach((m, i) => {
        kvar.delete(m.namn)
        let post = this.maskiner.get(m.namn)
        if (!post) {
          post = this._bygg(m.namn)
          this.maskiner.set(m.namn, post)
        }
        post.plats = { grupp, i }
        post.status = m.status
        post.detalj = m.detalj || ''
        const logg = Number(m.sistaLogg) || 0
        // En ny loggrad sedan sist = maskinen gjorde något just nu. Blixten är kvitto på det.
        if (logg && post.sistaLogg && logg > post.sistaLogg) post.blixt = 1
        post.sistaLogg = logg
        this._placera(post)
      })
    }

    for (const namn of kvar) {
      const post = this.maskiner.get(namn)
      this._riv(post)
      this.maskiner.delete(namn)
    }

    this._plattor()
  }

  _riv(post) {
    for (const o of [post.mesh, post.etikett, post.fyr, post.sockel, post.dack, post.ring, post.stolpe, post.kabel, post.paket]) {
      this.grupp.remove(o)
    }
    post.mesh.geometry.dispose()
    post.mesh.material.dispose()
    post.fyr.material.dispose()
    post.sockel.material.dispose()
    post.dack.material.dispose()
    post.ring.material.dispose()
    post.stolpe.material.dispose()
    post.kabel.geometry.dispose()
    post.kabel.material.dispose()
    post.paket.material.dispose()
    post.etikett.userData.dispose?.()
  }

  _bygg(namn) {
    const fro = hashString(namn)
    const sort = SORTER[fro % SORTER.length]
    const mesh = createBuilding({ seed: fro, accent: FARG.okand, kind: sort })
    mesh.scale.setScalar(SKALA)
    mesh.castShadow = true

    // Egen klocka: den delade uniformen byts ut innan första renderingen, så maskinen kan
    // stanna för sig själv. Görs direkt efter createBuilding — shadern kompileras först när
    // meshen renderas, och det är då uniformobjekten plockas upp.
    const tid = { value: Math.random() * 40 }
    mesh.userData.uniforms.uTime = tid

    const kort = namn.replace(/^nexus-/, '')
    const jobb = JOBB[namn]
    const etikett = createLabel(jobb ? `${kort} · ${jobb}` : kort, FARG.okand)
    etikett.visible = false
    etikett.material.opacity = 0

    const fyr = new THREE.Mesh(
      FYR_GEO,
      new THREE.MeshBasicMaterial({ color: FARG.okand, transparent: true, opacity: 0.9, toneMapped: false })
    )

    // Robothemmet: sockel, däck, lysande ring och en stolpe med lyktan på.
    const sockel = new THREE.Mesh(
      HEM_SOCKEL,
      new THREE.MeshStandardMaterial({ color: TAL.charcoal, roughness: 0.94, metalness: 0.06 })
    )
    sockel.receiveShadow = true
    const dack = new THREE.Mesh(
      HEM_DACK,
      new THREE.MeshStandardMaterial({ color: TAL.stomme, roughness: 0.76, metalness: 0.3 })
    )
    dack.receiveShadow = true
    const ring = new THREE.Mesh(
      HEM_RING,
      new THREE.MeshBasicMaterial({ color: FARG.okand, transparent: true, opacity: 0.25, toneMapped: false })
    )
    ring.rotation.x = -Math.PI / 2
    const stolpe = new THREE.Mesh(
      HEM_STOLPE,
      new THREE.MeshStandardMaterial({ color: TAL.stomme, roughness: 0.6, metalness: 0.45 })
    )

    const kabel = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: TAL.stomme, transparent: true, opacity: 0.45 })
    )
    const paket = new THREE.Mesh(
      PAKET_GEO,
      new THREE.MeshBasicMaterial({ color: FARG.ok, transparent: true, opacity: 0, toneMapped: false })
    )

    this.grupp.add(mesh, etikett, fyr, sockel, dack, ring, stolpe, kabel, paket)
    return {
      mesh,
      etikett,
      fyr,
      sockel,
      dack,
      ring,
      stolpe,
      kabel,
      paket,
      // Fasen är slumpad från start, annars åker fyrtio paket i takt som ett tåg.
      fas: Math.random(),
      // Egen vridning ur namnet: bestämd, men ingen står exakt som grannen.
      vridning: ((fro % 1000) / 1000 - 0.5) * 1.1,
      hemY: 0,
      tid,
      status: 'okand',
      farg: new THREE.Color(FARG.okand),
      plats: { grupp: 'hem', i: 0 },
      sistaLogg: 0,
      blixt: 0,
    }
  }

  _placera(post) {
    const { grupp, i } = post.plats
    const falt = this.plattor[grupp] || this.plattor.hem
    const plats = this._spiral(i, falt.fro)
    const x = falt.mitt.x + plats.x
    const z = falt.mitt.z + plats.z
    // Gårdens yta är plan: maskinerna står på terrassen, inte i backen. Det är också det som
    // gör att fyrtio hem ligger i våg i stället för att luta åt varsitt håll.
    const y = falt.mitt.y

    // Maskinen vrider sig utåt från masten, med en skvätt slump ur sitt eget namn. Fyrtio
    // maskiner i exakt samma riktning är lika livlöst som fyrtio på rad.
    const vridning = -plats.vinkel + post.vridning
    post.mesh.rotation.y = vridning
    post.sockel.rotation.y = vridning
    post.dack.rotation.y = vridning
    post.ring.rotation.z = vridning

    post.hemY = y
    post.sockel.position.set(x, y + 0.1, z)
    post.dack.position.set(x, y + DACKY - 0.08, z)
    post.ring.position.set(x, y + DACKY + 0.02, z)
    post.mesh.position.set(x, y + DACKY, z)
    post.etikett.position.set(x, y + 2.1, z)

    // Lyktan sitter på en stolpe på hemmets insida — mot masten, så kabeln går rakt in.
    const ut = new THREE.Vector3(Math.cos(plats.vinkel), 0, Math.sin(plats.vinkel))
    const sx = x - ut.x * 0.78
    const sz = z - ut.z * 0.78
    post.stolpe.position.set(sx, y + DACKY + 0.5, sz)
    post.fyr.position.set(sx, y + DACKY + 1.12, sz)
    post.fyrY = y + DACKY + 1.12

    // Kabeln dras från stolpens lykta in till fältets mast, och paketet åker den vägen.
    const fran = new THREE.Vector3(sx, y + DACKY + 1.05, sz)
    const till = falt.navpunkt.clone()
    post.kabel.geometry.setFromPoints([fran, till])
    post.kabel.geometry.computeBoundingSphere()
    post.fran = fran
    post.till = till
  }

  /**
   * Gårdarna läggs ut i fyra rutor kring parkens mitt, alla lika djupa som det största laget
   * — annars vandrar fälten när en agent tillkommer, och en gård man känner igen är halva
   * poängen med att ge dem fast plats. Alla fyra får SAMMA däckhöjd, så broarna in till
   * navet ligger i våg.
   */
  _plattor() {
    const r = this._faltradie()
    const d = this._avstand(r)
    const mitter = {}
    let hogst = -Infinity
    let lagst = Infinity

    for (const grupp of Object.keys(this.plattor)) {
      const [sx, sz] = FALT[grupp].ruta
      const mx = (sx * d) / Math.SQRT2
      const mz = (sz * d) / Math.SQRT2
      mitter[grupp] = { mx, mz, sx, sz }
      if (!this.antal[grupp]) continue
      const spann = this._markSpann(mx, mz, r + 0.6)
      if (spann.hogst > hogst) hogst = spann.hogst
      if (spann.lagst < lagst) lagst = spann.lagst
    }
    const navSpann = this._markSpann(0, 0, NAVRADIE + 0.6)
    if (navSpann.hogst > hogst) hogst = navSpann.hogst
    if (navSpann.lagst < lagst) lagst = navSpann.lagst
    if (!Number.isFinite(hogst)) return

    const dackY = hogst + PLATAHOJD
    const tjocklek = dackY - lagst + 1.6
    this.dackY = dackY

    const nagon = Object.values(this.antal).some((n) => n > 0)
    this.nav.visible = nagon
    if (nagon) {
      this.navSockel.scale.set(NAVRADIE, tjocklek, NAVRADIE)
      this.navSockel.position.set(0, dackY - 0.3 - tjocklek / 2, 0)
      this.navDack.scale.set(NAVRADIE * 0.97, 0.34, NAVRADIE * 0.97)
      this.navDack.position.set(0, dackY - 0.17, 0)
      this.navPylon.position.set(0, dackY + 1.6, 0)
      this.navRing.position.set(0, dackY + 3.1, 0)
      this.navLykta.position.set(0, dackY + 3.35, 0)
      this.navSockel.rotation.y = Math.PI / 6
      this.navDack.rotation.y = Math.PI / 6
    }

    let fro = 3
    for (const [grupp, p] of Object.entries(this.plattor)) {
      const antal = this.antal[grupp]
      fro += 4
      p.fro = fro
      const syns = antal > 0
      p.sockel.visible = syns
      p.rand.visible = syns
      p.dack.visible = syns
      p.inre.visible = syns
      p.skylt.visible = syns
      p.bro.visible = syns
      p.bropuls.visible = syns
      if (!syns) {
        if (p.mast) p.mast.visible = false
        if (p.dronare) p.dronare.visible = false
        continue
      }

      const { mx, mz, sx, sz } = mitter[grupp]
      p.mitt.set(mx, dackY, mz)
      p.radie = r
      // Alla gårdar vrids lika mycket: sexkanterna ska läsa som samma rutnät, inte som fyra
      // slumpade former.
      const vrid = Math.PI / 6
      p.sockel.rotation.y = vrid
      p.rand.rotation.y = vrid
      p.dack.rotation.y = vrid
      p.inre.rotation.y = vrid

      p.sockel.scale.set(r, tjocklek, r)
      p.sockel.position.set(mx, dackY - 0.42 - tjocklek / 2, mz)
      // Randen är en färgad list precis under däcket — gårdens färg, synlig från sidan.
      p.rand.scale.set(r * 1.015, 0.34, r * 1.015)
      p.rand.position.set(mx, dackY - 0.34, mz)
      p.dack.scale.set(r * 0.985, 0.36, r * 0.985)
      p.dack.position.set(mx, dackY - 0.18, mz)
      // Inre steg kring masten.
      p.inre.scale.set(r * 0.4, 0.14, r * 0.4)
      p.inre.position.set(mx, dackY + 0.07, mz)

      // Bron in till navet: från gårdens kant till navets, i våg.
      const riktning = new THREE.Vector3(-mx, 0, -mz)
      const avst = riktning.length() || 1
      riktning.divideScalar(avst)

      // Skylten står på gårdens yttersida, vänd utåt — bort från bron, läsbar för den som
      // går runt parken.
      p.skylt.position.set(mx - riktning.x * r * 0.9, dackY, mz - riktning.z * r * 0.9)
      p.skylt.rotation.y = Math.atan2(-riktning.x, -riktning.z)
      const start = avst - r * 0.9
      const slut = NAVRADIE * 0.9
      const langd = Math.max(0.5, start - slut)
      const mittPunkt = (slut + start) / 2
      p.bro.position.set(riktning.x * mittPunkt, dackY - 0.13, riktning.z * mittPunkt)
      p.bro.rotation.y = Math.atan2(riktning.x, riktning.z)
      p.brodack.scale.set(1, 1, langd)
      for (const rack of p.racken) rack.scale.set(1, 1, langd)
      p.broFran = new THREE.Vector3(riktning.x * start, dackY + 0.3, riktning.z * start)
      p.broTill = new THREE.Vector3(riktning.x * slut, dackY + 0.3, riktning.z * slut)

      // Masten står mitt på gården: alla kablar går inåt, som ekrar i ett hjul.
      this._mast(p, fro)
      if (p.mast) {
        p.mast.position.set(mx, dackY + 0.14, mz)
        p.mast.visible = true
      }
      p.navpunkt.set(mx, dackY + 2.4, mz)

      /**
       * Drönaren kretsar runt masten och sjunker ner mot den maskin som senast gjorde något
       * — det är den som gör en gård till en plats där det händer saker i stället för en
       * uppställning.
       */
      if (!p.dronare) {
        p.dronare = byggDronare(p.farg)
        // Gården är över tjugo enheter bred. En drönare byggd i maskinskala blir en prick.
        p.dronare.scale.setScalar(1.8)
        this.grupp.add(p.dronare)
      }
      p.dronare.visible = true
    }
  }

  /**
   * Masten, byggd när modellkitet finns.
   *
   * Kitet läses in efter att kolonin skapats, så det första försöket misslyckas nästan
   * alltid. Förut gjordes försöket bara när maskinlistan ändrades — och den ändras sällan,
   * så masterna kom aldrig upp och kablarna gick in i tomma luften. Nu försöker `update`
   * igen tills kitet är inne, och slutar fråga så fort masten står.
   */
  _mast(p, fro) {
    if (p.mast) return p.mast
    try {
      const mast = createBuilding({ seed: fro, accent: p.farg, kind: 'antenna' })
      mast.scale.setScalar(0.95)
      mast.castShadow = true
      mast.userData.uniforms.uTime = p.masttid
      mast.position.copy(p.mitt)
      mast.position.y += 0.14
      this.grupp.add(mast)
      p.mast = mast
    } catch {
      // Kitet är inte inne än.
    }
    return p.mast
  }

  /**
   * Var en maskin står i världen, så panelen kan flyga dit när man klickar på en agent.
   * Null när maskinen inte finns — en kamera som far till origo är värre än ingen resa.
   */
  plats(namn) {
    const post = this.maskiner.get(namn)
    if (!post) return null
    return new THREE.Vector3(
      this.grupp.position.x + post.mesh.position.x,
      this.grupp.position.y + post.hemY + DACKY,
      this.grupp.position.z + post.mesh.position.z
    )
  }

  /**
   * Vad parken faktiskt innehåller, i klartext.
   *
   * En skärmbild bevisar inte att en mast står där — den kan stå bakom en maskin, eller inte
   * finnas alls. Det här är parkens egen redovisning, och den läses av `?debug=1`.
   */
  diagnos() {
    const falt = {}
    for (const [nyckel, p] of Object.entries(this.plattor)) {
      falt[nyckel] = {
        antal: this.antal[nyckel],
        dack: p.dack.visible,
        mast: Boolean(p.mast && p.mast.visible),
        dronare: Boolean(p.dronare && p.dronare.visible),
        skylt: p.skylt.visible,
        bro: p.bro.visible,
        radie: p.radie ? Number(p.radie.toFixed(1)) : null,
      }
    }
    return {
      maskiner: this.maskiner.size,
      dackY: Number(this.dackY.toFixed(2)),
      nav: this.nav.visible,
      rover: Boolean(this.rover),
      puls: this.puls.size,
      pulsFardig: this.pulsFardig,
      falt,
    }
  }

  /** Bygger rovern när kitet är inne och kommandoprocessorn har fått sin plats. */
  _rover() {
    const post = this.maskiner.get('nexus-commands')
    if (!post || !post.fran) return null
    if (!this.rover) {
      try {
        const geo = part('spacetruck')
        const mesh = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({ map: atlasTexture(), roughness: 0.6, metalness: 0.05 })
        )
        mesh.scale.setScalar(0.5)
        mesh.castShadow = true
        this.grupp.add(mesh)
        this.rover = mesh
      } catch {
        return null // kitet är inte inne än
      }
    }
    return post
  }

  update(dt, camera) {
    if (!this.grupp.visible) return
    const nu = Date.now()
    const sekunder = performance.now() / 1000

    // Vem som senast gjorde något på varje gård — drönaren far dit.
    for (const falt of Object.values(this.plattor)) falt.senast = null

    for (const [namn, post] of this.maskiner) {
      const arbetar = this._arbetar(post, namn, nu)
      const gard = this.plattor[post.plats.grupp]
      if (gard && arbetar && (!gard.senast || post.sistaLogg > gard.senast.sistaLogg)) gard.senast = post
      // Bara det som går får sin klocka framflyttad. Den som arbetar snurrar i full fart,
      // den som bara står och kör går på tomgång, och den som är nere står stilla.
      if (post.status === 'ok') post.tid.value += dt * (arbetar ? 1 : 0.18)

      // Blixten styr både ljuset och namnet, så den måste räcka längre än ett ögonblick:
      // ett namn som blinkar förbi på en halv sekund är samma sak som inget namn.
      post.blixt = Math.max(0, post.blixt - dt * 0.28)

      const accent = post.mesh.userData.uniforms.uAccent.value
      if (post.status === 'fel') {
        const puls = Math.sin(sekunder * 4) > 0 ? 1 : 0.18
        accent.copy(post.farg.set(FARG.fel)).multiplyScalar(0.25 + puls * 0.75)
      } else if (post.status === 'ok') {
        const grund = post.farg.set(FARG.ok)
        // Arbetar: ett lugnt pulserande ljus, plus en blixt när en ny loggrad kom.
        const puls = arbetar ? 0.78 + Math.sin(sekunder * 2.4) * 0.22 : 0.3
        accent.copy(grund).multiplyScalar(Math.min(1.6, puls + post.blixt * 0.45))
      } else {
        accent.set(SLACKT)
      }

      /**
       * Paketet på kabeln. En maskin som arbetar skickar tätt, en som går på tomgång sällan,
       * och en som är nere skickar inget alls — det är den rörelsen som gör att fältet ser
       * ut att jobba ihop i stället för att bara stå och lysa.
       */
      const pm = post.paket.material
      if (post.status === 'ok' && post.fran) {
        const fart = arbetar ? 0.55 : 0.14
        const fore = post.fas
        post.fas = (post.fas + dt * fart) % 1
        if (post.fas < fore) {
          const falt = this.plattor[post.plats.grupp]
          if (falt) {
            falt.blink = 1 // paketet kom fram
            falt.bropulsT = 0 // och skickas vidare in till navet
          }
        }
        // Lite båge på vägen, annars ser kabeln ut som en pinne.
        const t = post.fas
        post.paket.position.lerpVectors(post.fran, post.till, t)
        post.paket.position.y += Math.sin(t * Math.PI) * 0.9
        pm.opacity = arbetar ? 0.95 : 0.4
        post.paket.visible = true
        post.kabel.material.opacity = arbetar ? 0.6 : 0.3
      } else {
        post.paket.visible = false
        post.kabel.material.opacity = 0.16
      }

      // Maskiner som arbetar guppar svagt. Det är litet, men det är skillnaden mellan en
      // uppställning och en gård där något pågår.
      const gupp = arbetar ? Math.sin(sekunder * 2.6 + post.fas * 6.28) * 0.09 : 0
      post.mesh.position.y = post.hemY + DACKY + gupp
      post.fyr.position.y = post.fyrY + gupp * 0.4

      // Lyktan och hemmets ring: den enda statusen som går att se på håll.
      const m = post.fyr.material
      const rm = post.ring.material
      if (post.status === 'fel') {
        const pa = Math.sin(sekunder * 4) > 0
        m.color.set(FARG.fel)
        m.opacity = pa ? 1 : 0.15
        post.fyr.scale.setScalar(1.15)
        rm.color.set(FARG.fel)
        rm.opacity = pa ? 0.85 : 0.2
      } else if (post.status === 'ok') {
        m.color.set(FARG.ok)
        m.opacity = arbetar ? 0.75 + Math.sin(sekunder * 2.4) * 0.25 : 0.34
        post.fyr.scale.setScalar(arbetar ? 1 + Math.sin(sekunder * 2.4) * 0.14 + post.blixt * 0.5 : 0.8)
        rm.color.set(FARG.ok)
        rm.opacity = arbetar ? 0.45 + Math.sin(sekunder * 2.4) * 0.2 + post.blixt * 0.4 : 0.18
      } else {
        m.color.set(post.status === 'nere' ? FARG.nere : FARG.okand)
        m.opacity = 0.22
        post.fyr.scale.setScalar(0.7)
        rm.color.set(post.status === 'nere' ? FARG.nere : FARG.okand)
        rm.opacity = 0.1
      }
    }

    // Rovern kör ut på gatan och hem igen så länge kommandoprocessorn arbetar.
    const kommando = this._rover()
    if (this.rover && kommando) {
      const hem = new THREE.Vector3(kommando.mesh.position.x + 1.7, this.dackY + 0.1, kommando.mesh.position.z)
      const ute = new THREE.Vector3(0, this.dackY + 0.1, 0) // navet, där broarna möts
      /**
       * Rovern kör när det FINNS NÅGOT ATT KÖRA. Med Roosts läsväg uppe är det kön som
       * avgör — pending eller running — precis som Ledning skrev. Svarar läsvägen inte får
       * agentens loggrad duga, och då betyder rörelsen bara att agenten arbetar.
       */
      const kor = this.pulsFardig
        ? kommando.status === 'ok' && (this.ko?.pending > 0 || this.ko?.running > 0)
        : this._arbetar(kommando, 'nexus-commands', nu)

      if (kor) {
        this.roverT += dt * 0.16 * this.roverRiktning
        if (this.roverT >= 1) {
          this.roverT = 1
          this.roverRiktning = -1
        } else if (this.roverT <= 0) {
          this.roverT = 0
          this.roverRiktning = 1
        }
      } else {
        // Tystnar agenten kör rovern hem och stannar där — den ska inte frysa mitt på gatan.
        this.roverT = Math.max(0, this.roverT - dt * 0.3)
        this.roverRiktning = 1
      }

      this.rover.position.lerpVectors(hem, ute, this.roverT)
      const mot = ute.clone().sub(hem).multiplyScalar(this.roverRiktning)
      if (mot.lengthSq() > 0.0001) this.rover.rotation.y = Math.atan2(mot.x, mot.z)
      this.rover.visible = true
    }

    /**
     * Namnen.
     *
     * Fyrtioen etiketter på en gång är ingen information — det är en vägg av text, och Filip
     * läste den inte, han såg den. Parken visar därför namn på TRE sorters maskiner och inga
     * andra:
     *
     *   · den som just gjorde något (blixten lyser), i några sekunder — namnet blir en
     *     berättelse om vad som händer i stället för en skylt som alltid står där
     *   · gårdens senast aktiva, den drönaren dyker mot — en läsbar rad per gård
     *   · den man gått ända fram till (under NARA enheter)
     *
     * Allt annat säger sitt med lykta, ring, kabel och paket. Vill man veta vem en maskin är
     * går man fram till den.
     */
    const p = new THREE.Vector3()
    for (const post of this.maskiner.values()) {
      post.etikett.getWorldPosition(p)
      const nara = p.distanceTo(camera.position) < NARA
      const gard = this.plattor[post.plats.grupp]
      const berattar = post.blixt > 0.05 || gard?.senast === post
      const mal = berattar || nara ? 1 : 0
      const m = post.etikett.material
      // Fram snabbt, bort långsamt: ett namn som just dykt upp ska hinna läsas.
      m.opacity += (mal - m.opacity) * Math.min(1, dt * (mal ? 7 : 1.4))
      post.etikett.visible = m.opacity > 0.02
    }

    this.navBlink = Math.max(0, this.navBlink - dt * 1.4)
    for (const falt of Object.values(this.plattor)) {
      if (!falt.dack.visible) continue

      if (falt.dronare?.visible && falt.radie) this._flygDronare(falt, dt, sekunder)

      // Masten snurrar så länge fältet lever, och lyser upp när ett paket kommer fram.
      if (!falt.mast) this._mast(falt, falt.fro || 7)
      falt.masttid.value += dt
      falt.blink = Math.max(0, falt.blink - dt * 2.2)
      if (falt.mast) {
        falt.mast.userData.uniforms.uAccent.value.set(falt.farg).multiplyScalar(0.7 + falt.blink * 1.1)
      }

      // Pulsen som springer in till navet: gårdarna är förbundna, och det ska synas.
      if (falt.bropulsT < 1 && falt.broFran) {
        falt.bropulsT = Math.min(1, falt.bropulsT + dt * 1.1)
        falt.bropuls.position.lerpVectors(falt.broFran, falt.broTill, falt.bropulsT)
        falt.bropuls.material.opacity = Math.sin(falt.bropulsT * Math.PI) * 0.95
        if (falt.bropulsT >= 1) this.navBlink = 1
      } else {
        falt.bropuls.material.opacity = 0
      }
    }

    if (this.nav.visible) {
      this.navRing.rotation.z += dt * 0.5
      this.navRing.material.opacity = 0.32 + this.navBlink * 0.6
      this.navRing.scale.setScalar(1 + this.navBlink * 0.3)
      this.navLykta.material.opacity = 0.6 + this.navBlink * 0.4
      this.navLykta.scale.setScalar(1 + this.navBlink * 0.35)
    }
  }

  /**
   * Drönarens flykt.
   *
   * Den går en åtta runt masten, dyker mot den maskin som senast gjorde något, och lutar in
   * i svängen — en drönare som glider omkring plan ser ut som en leksak på en pinne.
   */
  _flygDronare(falt, dt, sekunder) {
    const d = falt.dronare
    const bana = sekunder * 0.42 + (falt.fro || 0)
    const punkt = new THREE.Vector3(
      falt.mitt.x + Math.cos(bana) * falt.radie * 0.55,
      falt.mitt.y + 3.6 + Math.sin(bana * 2.1) * 0.5,
      falt.mitt.z + Math.sin(bana * 1.3) * falt.radie * 0.55
    )
    if (falt.senast) {
      const m = falt.senast.mesh.position
      const dyk = 0.35 + Math.sin(bana * 0.7) * 0.28
      punkt.lerp(new THREE.Vector3(m.x, m.y + 2.1, m.z), Math.max(0, dyk))
    }

    const v = punkt.clone().sub(d.position)
    d.position.copy(punkt)

    if (dt > 0 && v.lengthSq() > 1e-8) {
      const kurs = Math.atan2(v.x, v.z)
      let diff = kurs - d.rotation.y
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      d.rotation.y += diff * Math.min(1, dt * 4)
      // Nosen ner i farten, och kroppen in i svängen.
      const fart = Math.min(1, v.length() / dt / 9)
      d.rotation.x += (-fart * 0.3 - d.rotation.x) * Math.min(1, dt * 3)
      d.rotation.z += (THREE.MathUtils.clamp(diff / dt / 6, -0.45, 0.45) - d.rotation.z) * Math.min(1, dt * 3)
    }

    const { rotorer, navljus, lys } = d.userData
    rotorer.forEach((r, i) => {
      r.rotation.y += dt * (i % 2 ? -34 : 34)
    })
    navljus.material.opacity = Math.sin(sekunder * 3.2) > 0.55 ? 1 : 0.05
    lys.opacity = falt.senast ? 0.95 : 0.5
  }

  dispose() {
    for (const post of this.maskiner.values()) this._riv(post)
    for (const falt of Object.values(this.plattor)) {
      // Bara materialen: sockel-, däck- och randgeometrin delas av alla fyra gårdarna och
      // av navet, och ägs av modulen.
      for (const o of [falt.sockel, falt.rand, falt.dack, falt.inre]) o.material.dispose()
      falt.mast?.geometry.dispose()
      falt.mast?.material.dispose()
      falt.bropuls.geometry.dispose()
      falt.bropuls.material.dispose()
      falt.skylt.userData.textur?.dispose()
      falt.skylt.traverse((o) => {
        o.geometry?.dispose()
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
        else o.material?.dispose()
      })
      falt.bro.traverse((o) => {
        o.geometry?.dispose()
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
        else o.material?.dispose()
      })
      falt.dronare?.traverse((o) => {
        o.geometry?.dispose()
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
        else o.material?.dispose()
      })
    }
    this.nav.traverse((o) => {
      if (o !== this.navSockel && o !== this.navDack) o.geometry?.dispose()
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
      else o.material?.dispose()
    })
    if (this.rover) {
      this.rover.geometry.dispose()
      this.rover.material.dispose()
      this.rover = null
    }
    this.maskiner.clear()
    this.scene.remove(this.grupp)
  }
}
