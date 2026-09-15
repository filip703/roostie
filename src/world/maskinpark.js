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

const RAD = 4 // maskiner per rad i ett fält
const RUTA = 2.9 // avstånd mellan platser
const GATA = 5 // gatan mellan fälten
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
const FALTBREDD = RAD * RUTA + 1.8

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

    // Två plattor, en per fält. Utan dem ser maskinerna ut som skrot någon tappat i
    // terrängen; med dem är det en gård.
    this.plattor = {}
    for (const [grupp, { namn, farg }] of Object.entries(FALT)) {
      const platta = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.3, 1),
        new THREE.MeshStandardMaterial({ color: TAL.natt, roughness: 0.92, metalness: 0.05 })
      )
      platta.receiveShadow = true
      platta.visible = false

      // Kant i lagets färg, som zonerna har. Utan den är gårdarna fyra svarta fläckar och
      // färgen finns bara på skylten; med den ser man på håll vems mark man tittar på.
      const kant = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.22, 1),
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

  /**
   * Hur mycket mark parken tar. Kolonin håller undan stenar och buskar innanför den —
   * ett klippblock mitt i ett maskinfält läser som ett fel, inte som natur.
   */
  radie() {
    if (!this.maskiner.size) return 0
    const rader = Math.max(...Object.values(this.antal).map((n) => Math.ceil(n / RAD)), 1)
    const djup = rader * RUTA + 1.8
    return Math.hypot(FALTBREDD + GATA / 2, djup + GATA / 2) + 2
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
    const kol = i % RAD
    const rad = Math.floor(i / RAD)
    const x = falt.mitt.x + (kol - (RAD - 1) / 2) * RUTA
    // Raderna centreras i gårdens djup, som är lika för alla fält.
    const z = falt.mitt.z + (rad - (this.maxRader - 1) / 2) * RUTA
    const y = this.hojd(this.grupp.position.x + x, this.grupp.position.z + z) - this.grupp.position.y
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
    this.maxRader = Math.max(...Object.values(this.antal).map((n) => Math.ceil(n / RAD)), 1)
    const djup = this.maxRader * RUTA + 1.8
    let fro = 3

    for (const [grupp, p] of Object.entries(this.plattor)) {
      const antal = this.antal[grupp]
      fro += 4
      p.platta.visible = antal > 0
      p.kant.visible = antal > 0
      if (!antal) {
        p.etikett.visible = false
        if (p.mast) p.mast.visible = false
        continue
      }

      const [sx, sz] = FALT[grupp].ruta
      const mx = sx * (FALTBREDD / 2 + GATA / 2)
      const mz = sz * (djup / 2 + GATA / 2)
      const my = this.hojd(this.grupp.position.x + mx, this.grupp.position.z + mz) - this.grupp.position.y
      p.mitt.set(mx, my, mz)

      p.platta.scale.set(FALTBREDD, 1, djup)
      p.platta.position.set(mx, my - 0.12, mz)
      p.kant.scale.set(FALTBREDD + 0.7, 1, djup + 0.7)
      p.kant.position.set(mx, my - 0.2, mz)
      // Skylten står på gårdens yttersida, bort från gatan.
      p.etikett.position.set(mx, my + 1.1, mz + sz * (djup / 2 + 1))

      // Masten står på gårdens innerhörn, mot gatan där alla fyra möts.
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
      const mastX = mx - sx * (FALTBREDD / 2 + 1.1)
      const mastZ = mz - sz * (djup / 2 + 1.1)
      const mastY = this.hojd(this.grupp.position.x + mastX, this.grupp.position.z + mastZ) - this.grupp.position.y
      if (p.mast) {
        p.mast.position.set(mastX, mastY, mastZ)
        p.mast.visible = true
      }
      p.nav.set(mastX, mastY + 1.8, mastZ)
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

    for (const post of this.maskiner.values()) {
      const arbetar = post.status === 'ok' && post.sistaLogg > 0 && nu - post.sistaLogg < AKTIV_MS
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
      const kor = kommando.status === 'ok' && kommando.sistaLogg > 0 && nu - kommando.sistaLogg < AKTIV_MS

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
