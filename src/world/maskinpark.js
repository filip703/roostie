/**
 * Maskinparken — NUC:ens containrar som maskiner på kolonins mark.
 *
 * Agenter är inga astronauter. En astronaut är ett samtal som bygger något; en agent är en
 * maskin som går, står eller är trasig. Därför får de fast plats i två fält — Roosts
 * produktagenter på ena, hemmets på andra — och en skylt var som säger vad maskinen gör.
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
 */
import * as THREE from 'three'
import { createBuilding } from './buildings.js'
import { atlasTexture, part } from './kit.js'
import { createLabel, hashString } from './plots.js'
import { TAL } from './palett.js'

/**
 * Gårdarna är inte rutnät.
 *
 * Fyrtio maskiner på rad läser som ett kalkylark, inte som en plats — och en agent som står
 * i kolumn tre rad två blir aldrig "den där borta vid masten". Platserna läggs därför i en
 * gyllene-vinkel-spiral ut från gårdens mast: tät i mitten, glesare utåt, aldrig två i linje,
 * och ändå helt bestämd av ordningen så att samma agent alltid hamnar på samma ställe.
 */
const SPRIDNING = 2.35 // hur glest spiralen växer
const GYLLENE = Math.PI * (3 - Math.sqrt(5))
const GATA = 6 // luft mellan gårdarna
const SKALA = 0.34

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

/** Maskintyper, valda ur namnet så en agent alltid får samma maskin. */
const SORTER = ['antenna', 'solar', 'greenhouse', 'tower', 'reactor']

/** En liten lykta ovanför varje maskin — status som går att läsa tvärs över kolonin. */
const FYR_GEO = new THREE.SphereGeometry(0.22, 10, 8)
/** Paketet som åker längs kabeln när en maskin rapporterar in. */
const PAKET_GEO = new THREE.SphereGeometry(0.13, 8, 6)
/** Varje maskin står på sin egen box. */
const BOX_GEO = new THREE.BoxGeometry(2.3, 0.22, 2.3)
/** Gårdens drönare — liten, lysande, alltid i rörelse. */
const DRONAR_GEO = new THREE.OctahedronGeometry(0.34)
/** Runda gårdar: en platta och en kant, skalade per fält. */
const PLATT_GEO = new THREE.CylinderGeometry(1, 1, 0.3, 40)
const KANT_GEO = new THREE.CylinderGeometry(1, 1, 0.22, 40)

/**
 * Vad maskinen gör, på svenska.
 *
 * Ett containernamn säger ingenting för den som går förbi köksskärmen. Listan är display-text
 * och inget annat — sanningen om vad en agent gör står i agentens egen kod och i
 * containervakten. Saknas ett namn står bara namnet, aldrig en gissning.
 */
const JOBB = {
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
    this.maxRader = 1

    /**
     * Rovern är kommandoprocessorn.
     *
     * `nexus-commands` är den agent som faktiskt åker ut och gör något i hemmet när appen
     * ber om det — den enda i parken vars jobb är en resa. Så länge den skriver i loggen
     * kör rovern ut på gatan och hem igen; tystnar den står den parkerad vid sin box.
     *
     * Att den kör betyder "agenten arbetar", inte "det ligger kommandon i kön" — kön syns
     * inte härifrån. Skillnaden är liten i praktiken (agenten loggar när den kör ett
     * kommando) men den ska inte påstås vara något annat än den är.
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

    // Två plattor, en per fält. Utan dem ser maskinerna ut som skrot någon tappat i
    // terrängen; med dem är det en gård.
    this.plattor = {}
    for (const [grupp, { namn, farg }] of Object.entries(FALT)) {
      const platta = new THREE.Mesh(
        PLATT_GEO,
        new THREE.MeshStandardMaterial({ color: TAL.natt, roughness: 0.92, metalness: 0.05 })
      )
      platta.receiveShadow = true
      platta.visible = false

      // Kant i lagets färg, som zonerna har. Utan den är gårdarna fyra svarta fläckar och
      // färgen finns bara på skylten; med den ser man på håll vems mark man tittar på.
      const kant = new THREE.Mesh(
        KANT_GEO,
        new THREE.MeshStandardMaterial({ color: farg, roughness: 0.75, metalness: 0.1 })
      )
      kant.receiveShadow = true
      kant.visible = false
      const etikett = createLabel(namn, farg)
      etikett.visible = false
      etikett.material.opacity = 0

      // Masten byggs först när fältet får sin första maskin: modellkitet är inte inläst när
      // kolonin skapas, och createBuilding kan inte bygga något ur ett kit som inte finns.
      this.grupp.add(kant, platta, etikett)
      this.plattor[grupp] = {
        platta,
        kant,
        etikett,
        farg,
        mast: null,
        masttid: { value: 0 },
        blink: 0,
        mitt: new THREE.Vector3(),
        nav: new THREE.Vector3(),
      }
    }
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
    return r * 2 + GATA + 4
  }

  /** Gårdens egen radie: så långt ut spiralen når för det största laget, plus lite kant. */
  _faltradie() {
    const flest = Math.max(...Object.values(this.antal), 1)
    return SPRIDNING * Math.sqrt(flest - 0.4) + 2.6
  }

  /** Plats nummer i i spiralen, i gårdens eget koordinatsystem. */
  _spiral(i, fro) {
    const r = SPRIDNING * Math.sqrt(i + 0.55)
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

    // Fälten och masterna först: maskinerna drar sina kablar dit, så gården måste finnas
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
      this.grupp.remove(post.mesh, post.etikett, post.fyr, post.box, post.kabel, post.paket)
      post.mesh.geometry.dispose()
      post.mesh.material.dispose()
      post.fyr.material.dispose()
      post.box.material.dispose()
      post.kabel.geometry.dispose()
      post.kabel.material.dispose()
      post.paket.material.dispose()
      post.etikett.userData.dispose?.()
      this.maskiner.delete(namn)
    }

    this._plattor()
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
    fyr.userData.hojd = (mesh.userData.height || 2) * SKALA + 0.55

    // Egen box att stå på, och en kabel in till fältets mast.
    const box = new THREE.Mesh(
      BOX_GEO,
      new THREE.MeshStandardMaterial({ color: 0x2f2922, roughness: 0.88, metalness: 0.12 })
    )
    box.receiveShadow = true

    const kabel = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: TAL.stomme, transparent: true, opacity: 0.45 })
    )
    const paket = new THREE.Mesh(
      PAKET_GEO,
      new THREE.MeshBasicMaterial({ color: FARG.ok, transparent: true, opacity: 0, toneMapped: false })
    )

    this.grupp.add(mesh, etikett, fyr, box, kabel, paket)
    return {
      mesh,
      etikett,
      fyr,
      box,
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
    const y = this.hojd(this.grupp.position.x + x, this.grupp.position.z + z) - this.grupp.position.y

    // Maskinen vrider sig utåt från masten, med en skvätt slump ur sitt eget namn. Fyrtio
    // maskiner i exakt samma riktning är lika livlöst som fyrtio på rad.
    post.mesh.rotation.y = -plats.vinkel + post.vridning
    post.box.rotation.y = post.mesh.rotation.y

    post.hemY = y
    post.mesh.position.set(x, y + 0.11, z)
    post.etikett.position.set(x, y + 1.9, z)
    post.fyr.position.set(x, y + post.fyr.userData.hojd, z)
    post.box.position.set(x, y, z)

    // Kabeln dras från maskinens lykta in till fältets mast, och paketet åker den vägen.
    const fran = new THREE.Vector3(x, y + post.fyr.userData.hojd * 0.8, z)
    const till = falt.nav.clone()
    post.kabel.geometry.setFromPoints([fran, till])
    post.kabel.geometry.computeBoundingSphere()
    post.fran = fran
    post.till = till
  }

  /**
   * Gårdarna läggs ut i fyra rutor kring parkens mitt, alla lika djupa som det största laget
   * — annars vandrar fälten när en agent tillkommer, och en gård man känner igen är halva
   * poängen med att ge dem fast plats.
   */
  _plattor() {
    const r = this._faltradie()
    let fro = 3

    for (const [grupp, p] of Object.entries(this.plattor)) {
      const antal = this.antal[grupp]
      fro += 4
      p.fro = fro
      p.platta.visible = antal > 0
      p.kant.visible = antal > 0
      if (!antal) {
        p.etikett.visible = false
        if (p.mast) p.mast.visible = false
        if (p.dronare) p.dronare.visible = false
        continue
      }

      // Fyra runda gårdar kring parkens mitt, alla lika stora som det största laget — annars
      // vandrar de när en agent tillkommer, och en gård man känner igen är halva poängen.
      const [sx, sz] = FALT[grupp].ruta
      const mx = sx * (r + GATA / 2)
      const mz = sz * (r + GATA / 2)
      const my = this.hojd(this.grupp.position.x + mx, this.grupp.position.z + mz) - this.grupp.position.y
      p.mitt.set(mx, my, mz)
      p.radie = r

      p.platta.scale.set(r, 1, r)
      p.platta.position.set(mx, my - 0.12, mz)
      p.kant.scale.set(r + 0.5, 1, r + 0.5)
      p.kant.position.set(mx, my - 0.2, mz)
      // Skylten står på gårdens yttersida, bort från gatan där de fyra möts.
      p.etikett.position.set(mx + sx * r * 0.55, my + 1.2, mz + sz * (r + 1.2))

      // Masten står mitt på gården: alla kablar går inåt, som ekrar i ett hjul.
      if (!p.mast) {
        try {
          const mast = createBuilding({ seed: fro, accent: p.farg, kind: 'antenna' })
          mast.scale.setScalar(0.42)
          mast.castShadow = true
          mast.userData.uniforms.uTime = p.masttid
          this.grupp.add(mast)
          p.mast = mast
        } catch {
          // Kitet är inte inne än. Nästa poll bygger masten; fältet fungerar utan den.
        }
      }
      if (p.mast) {
        p.mast.position.set(mx, my, mz)
        p.mast.visible = true
      }
      p.nav.set(mx, my + 2.2, mz)

      /**
       * Drönaren. Varje gård har en som kretsar runt masten och sjunker ner mot den maskin
       * som senast gjorde något — det är den som gör en gård till en plats där det händer
       * saker i stället för en uppställning.
       */
      if (!p.dronare) {
        p.dronare = new THREE.Mesh(
          DRONAR_GEO,
          new THREE.MeshBasicMaterial({ color: p.farg, transparent: true, opacity: 0.95, toneMapped: false })
        )
        this.grupp.add(p.dronare)
      }
      p.dronare.visible = true
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

      post.blixt = Math.max(0, post.blixt - dt * 1.6)

      const accent = post.mesh.userData.uniforms.uAccent.value
      if (post.status === 'fel') {
        const puls = Math.sin(sekunder * 4) > 0 ? 1 : 0.18
        accent.copy(post.farg.set(FARG.fel)).multiplyScalar(0.25 + puls * 0.75)
      } else if (post.status === 'ok') {
        const grund = post.farg.set(FARG.ok)
        // Arbetar: ett lugnt pulserande ljus, plus en blixt när en ny loggrad kom.
        const puls = arbetar ? 0.78 + Math.sin(sekunder * 2.4) * 0.22 : 0.3
        accent.copy(grund).multiplyScalar(Math.min(1.6, puls + post.blixt * 0.9))
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
          if (falt) falt.blink = 1 // paketet kom fram
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
      if (post.hemY !== undefined) {
        const gupp = arbetar ? Math.sin(sekunder * 2.6 + post.fas * 6.28) * 0.09 : 0
        post.mesh.position.y = post.hemY + 0.11 + gupp
        post.fyr.position.y = post.hemY + post.fyr.userData.hojd + gupp
      }

      // Lyktan: den enda statusen som går att se på håll.
      const m = post.fyr.material
      if (post.status === 'fel') {
        m.color.set(FARG.fel)
        m.opacity = Math.sin(sekunder * 4) > 0 ? 1 : 0.15
        post.fyr.scale.setScalar(1.15)
      } else if (post.status === 'ok') {
        m.color.set(FARG.ok)
        m.opacity = arbetar ? 0.75 + Math.sin(sekunder * 2.4) * 0.25 : 0.34
        post.fyr.scale.setScalar(arbetar ? 1 + Math.sin(sekunder * 2.4) * 0.14 + post.blixt * 0.5 : 0.8)
      } else {
        m.color.set(post.status === 'nere' ? FARG.nere : FARG.okand)
        m.opacity = 0.22
        post.fyr.scale.setScalar(0.7)
      }
    }

    // Rovern kör ut på gatan och hem igen så länge kommandoprocessorn arbetar.
    const kommando = this._rover()
    if (this.rover && kommando) {
      const hem = new THREE.Vector3(kommando.mesh.position.x + 1.6, kommando.mesh.position.y, kommando.mesh.position.z)
      const ute = new THREE.Vector3(0, hem.y, 0) // gatan där de fyra gårdarna möts
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

    // Etiketterna är läsbara på nära håll och försvinner när man drar sig undan — annars
    // är fältet en vägg av text.
    const p = new THREE.Vector3()
    for (const post of this.maskiner.values()) {
      post.etikett.getWorldPosition(p)
      const mal = p.distanceTo(camera.position) < 52 ? 1 : 0
      const m = post.etikett.material
      m.opacity += (mal - m.opacity) * Math.min(1, dt * 6)
      post.etikett.visible = m.opacity > 0.02
    }
    for (const falt of Object.values(this.plattor)) {
      if (!falt.platta.visible) continue

      /**
       * Drönaren kretsar runt masten i en åtta och dyker ner mot den maskin som senast
       * gjorde något. Har ingen gjort något på gården håller den sig uppe och patrullerar.
       */
      if (falt.dronare?.visible && falt.radie) {
        const bana = sekunder * 0.42 + (falt.fro || 0)
        const punkt = new THREE.Vector3(
          falt.mitt.x + Math.cos(bana) * falt.radie * 0.55,
          falt.mitt.y + 3.4 + Math.sin(bana * 2.1) * 0.45,
          falt.mitt.z + Math.sin(bana * 1.3) * falt.radie * 0.55
        )
        if (falt.senast) {
          const m = falt.senast.mesh.position
          const dyk = 0.35 + Math.sin(bana * 0.7) * 0.28
          punkt.lerp(new THREE.Vector3(m.x, m.y + 1.9, m.z), Math.max(0, dyk))
        }
        falt.dronare.position.copy(punkt)
        falt.dronare.rotation.y += dt * 1.7
        falt.dronare.rotation.x += dt * 0.9
        falt.dronare.material.opacity = falt.senast ? 0.95 : 0.55
      }

      // Masten snurrar så länge fältet lever, och lyser upp när ett paket kommer fram.
      falt.masttid.value += dt
      falt.blink = Math.max(0, falt.blink - dt * 2.2)
      if (falt.mast) {
        falt.mast.userData.uniforms.uAccent.value.set(falt.farg).multiplyScalar(0.7 + falt.blink * 1.1)
      }

      falt.etikett.getWorldPosition(p)
      const mal = p.distanceTo(camera.position) < 90 ? 1 : 0
      const m = falt.etikett.material
      m.opacity += (mal - m.opacity) * Math.min(1, dt * 4)
      falt.etikett.visible = m.opacity > 0.02
    }
  }

  dispose() {
    for (const post of this.maskiner.values()) {
      post.mesh.geometry.dispose()
      post.mesh.material.dispose()
      post.fyr.material.dispose()
      post.box.material.dispose()
      post.kabel.geometry.dispose()
      post.kabel.material.dispose()
      post.paket.material.dispose()
      post.etikett.userData.dispose?.()
    }
    for (const falt of Object.values(this.plattor)) {
      falt.platta.geometry.dispose()
      falt.platta.material.dispose()
      falt.kant.geometry.dispose()
      falt.kant.material.dispose()
      falt.mast?.geometry.dispose()
      falt.mast?.material.dispose()
      falt.dronare?.material.dispose()
      falt.etikett.userData.dispose?.()
    }
    if (this.rover) {
      this.rover.geometry.dispose()
      this.rover.material.dispose()
      this.rover = null
    }
    this.maskiner.clear()
    this.scene.remove(this.grupp)
  }
}
