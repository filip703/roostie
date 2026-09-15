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
import { createLabel, hashString } from './plots.js'

const RAD = 6 // maskiner per rad
const RUTA = 3.4 // avstånd mellan platser
const FALTAVSTAND = 4.5 // gatan mellan Roost-fältet och hemmets fält
const SKALA = 0.38

const FARG = {
  ok: 0x7fb069,
  nere: 0x6f6257,
  fel: 0xc9564f,
  okand: 0x5c5349,
}
const SLACKT = 0x3a342d
/** Hur länge efter en loggrad en maskin räknas som arbetande. */
const AKTIV_MS = 5 * 60 * 1000

/** Maskintyper, valda ur namnet så en agent alltid får samma maskin. */
const SORTER = ['antenna', 'solar', 'greenhouse', 'tower', 'reactor']

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
    this.antal = { roost: 0, nexus: 0 }

    // Två plattor, en per fält. Utan dem ser maskinerna ut som skrot någon tappat i
    // terrängen; med dem är det en gård.
    this.plattor = {}
    for (const [grupp, namn, farg] of [
      ['roost', 'ROOST-AGENTER', 0x2e5c6e],
      ['nexus', 'HEMMETS AGENTER', 0x6b6b3a],
    ]) {
      const platta = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.3, 1),
        new THREE.MeshStandardMaterial({ color: 0x241f1a, roughness: 0.92, metalness: 0.05 })
      )
      platta.receiveShadow = true
      platta.visible = false
      const etikett = createLabel(namn, farg)
      etikett.visible = false
      etikett.material.opacity = 0
      this.grupp.add(platta, etikett)
      this.plattor[grupp] = { platta, etikett, farg }
    }
  }

  /**
   * Hur mycket mark parken tar. Kolonin håller undan stenar och buskar innanför den —
   * ett klippblock mitt i ett maskinfält läser som ett fel, inte som natur.
   */
  radie() {
    if (!this.maskiner.size) return 0
    const rader = Math.max(Math.ceil(this.antal.roost / RAD), Math.ceil(this.antal.nexus / RAD))
    return Math.max((RAD * RUTA) / 2, rader * RUTA + FALTAVSTAND) + 4
  }

  /** Kolonin lämnar en markhöjdsfunktion hit, så maskinerna står på marken och inte i den. */
  markhojd(fn) {
    this.hojd = fn || (() => 0)
    for (const m of this.maskiner.values()) this._placera(m)
    this._plattor()
  }

  set(lista) {
    const rader = Array.isArray(lista) ? lista : []
    const nyckel = rader.map((m) => `${m.namn}:${m.status}:${m.sistaLogg || 0}`).join('|')
    if (nyckel === this.nyckel) return
    this.nyckel = nyckel
    this.grupp.visible = rader.length > 0

    const kvar = new Set(this.maskiner.keys())
    const grupper = { roost: [], nexus: [] }
    for (const m of rader) (grupper[m.grupp] || grupper.nexus).push(m)
    this.antal = { roost: grupper.roost.length, nexus: grupper.nexus.length }

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
      this.grupp.remove(post.mesh, post.etikett)
      post.mesh.geometry.dispose()
      post.mesh.material.dispose()
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

    this.grupp.add(mesh, etikett)
    return {
      mesh,
      etikett,
      tid,
      status: 'okand',
      farg: new THREE.Color(FARG.okand),
      plats: { grupp: 'nexus', i: 0 },
      sistaLogg: 0,
      blixt: 0,
    }
  }

  _placera(post) {
    const { grupp, i } = post.plats
    const kol = i % RAD
    const rad = Math.floor(i / RAD)
    const x = (kol - (RAD - 1) / 2) * RUTA
    // Roosts fält ligger före noll, hemmets efter — två fält med en gata emellan.
    const z =
      grupp === 'roost'
        ? -FALTAVSTAND / 2 - RUTA / 2 - rad * RUTA
        : FALTAVSTAND / 2 + RUTA / 2 + rad * RUTA
    const y = this.hojd(this.grupp.position.x + x, this.grupp.position.z + z) - this.grupp.position.y
    post.mesh.position.set(x, y, z)
    post.etikett.position.set(x, y + 1.9, z)
  }

  /** Plattorna växer med fälten, så en ny agent inte hamnar utanför gården. */
  _plattor() {
    for (const [grupp, p] of Object.entries(this.plattor)) {
      const antal = this.antal[grupp]
      p.platta.visible = antal > 0
      p.etikett.visible = false
      if (!antal) continue
      const rader = Math.ceil(antal / RAD)
      const bredd = RAD * RUTA + 1.6
      const djup = rader * RUTA + 1.6
      const mitt = FALTAVSTAND / 2 + djup / 2
      const z = grupp === 'roost' ? -mitt : mitt
      const y = this.hojd(this.grupp.position.x, this.grupp.position.z + z) - this.grupp.position.y
      p.platta.scale.set(bredd, 1, djup)
      p.platta.position.set(0, y - 0.12, z)
      p.etikett.position.set(0, y + 0.9, z + (grupp === 'roost' ? -djup / 2 - 0.9 : djup / 2 + 0.9))
    }
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
      post.etikett.userData.dispose?.()
    }
    for (const falt of Object.values(this.plattor)) {
      falt.platta.geometry.dispose()
      falt.platta.material.dispose()
      falt.etikett.userData.dispose?.()
    }
    this.maskiner.clear()
    this.scene.remove(this.grupp)
  }
}
