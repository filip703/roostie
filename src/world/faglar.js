/**
 * Fåglarna — Roosts trådar i trädet.
 *
 * En astronaut i 1.0 var ett samtal som byggde något. En fågel är samma sak, men den hör
 * hemma i ett träd: den har ett bo på sin egen gren, den flyger ut när tråden börjar arbeta
 * och kommer hem med en kvist, och boet växer av det den bär hem.
 *
 * Reglerna är oförändrade — de kommer ur Loggboken, precis som astronauternas gjorde:
 *   borjar   → fågeln är ute och flyger, kvist i näbben, boet växer
 *   klart    → fågeln sitter på kanten (fjädern i boet är steg 2)
 *   notis    → fågeln sjunger (skylten på grenen är steg 2)
 *   stoppat  → boet mörknar och fågeln sitter med huvudet ner
 *   sover    → fågeln sitter stilla i boet
 *
 * Fåglarna byggs av samma sorts fasetterade block som kolonins byggnader: en lågpolyfågel
 * ritad här, eftersom varken rymdkitet eller naturkitet innehåller en enda fågel. Det var den
 * största okända posten inför 2.0, och det här är svaret på den.
 *
 * ATT SE ATT DE JOBBAR — problemet, och hur det löstes.
 *
 * Filip: "omöjligt att se fåglarna som jobbar". Han har rätt, och det är ett SKALPROBLEM,
 * inte ett detaljproblem: trädet är sextiotvå enheter högt och en fågel är drygt en. Från
 * överblicken är den några pixlar; går man nära ser man en fågel och tappar de sex andra.
 * Att bara göra dem större löser det inte — då blir det kråkor stora som bilar.
 *
 * Tre saker gör det läsbart i stället, och alla tre hör hemma i ett levande träd:
 *
 *   1. VARJE FÅGEL BÄR ETT LJUS i trådens färg. Halon har en minsta storlek PÅ SKÄRMEN, inte
 *      i världen — den växer med avståndet, så den är en läsbar prick från överblicken och en
 *      mjuk glorja på nära håll. Sju lysande prickar går att räkna tvärs över ett kök.
 *   2. DEN SOM ARBETAR FLYGER ETT VARV RUNT KRONAN och drar ett lysande spår efter sig. Inte
 *      en kort tur ut från grenen — ett långt svep genom himlen, där det syns. Man ser inte
 *      en fågel, man ser en komet i Produkts färg, och då vet man att Produkt jobbar.
 *   3. BOET ÄR EN LYKTA. Glöder svagt när tråden vilar, starkt när den nyss gjort något,
 *      pulsar när den väntar på Filip. Boet är fem gånger större än fågeln och sitter still,
 *      så det är den signal som håller när fågeln är hemma.
 */
import * as THREE from 'three'
import { TAL } from './palett.js'
import { createLabel } from './plots.js'

const UPP = new THREE.Vector3(0, 1, 0)
/** Hur länge ett varv runt kronan tar, tur och retur. */
const FLYKT_S = 16
/** Hur långt ut från boet svepet går, som andel av boets avstånd från stammen. */
const SVEP = 0.42
/** Hur högt över boet svepet stiger. */
const SVEPHOJD = 11
/** Antal punkter i ljusspåret. Fler = längre komet, dyrare. */
const SPAR = 26
/**
 * Fågelns storlek.
 *
 * Tvåkommafyra gånger den första versionen. En fågel i naturlig skala mot ett träd som är
 * sextiotvå enheter högt är en insekt; det här är karaktärsskala, som i vilket spel som helst
 * där figuren ska läsas mot ett landskap.
 */
const FAGELSKALA = 2.4
/** Hur mycket boet växer per hemkomst, och hur stort det får bli. */
const BOVAXT = 0.04
const BOMAX = 1.5

const fro = (seed) => {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296)
}

/**
 * Vilket läge en tråd är i, översatt till fågelspråk.
 *
 * Utbruten och ren, som kolonins andra regler: det är den här tabellen som avgör om en fågel
 * ljuger, och den ska gå att prova utan en webbläsare.
 */
export function fagellage(trad) {
  if (!trad) return 'sover'
  if (trad.hasError) return 'stoppat'
  if (trad.notis || trad.unread) return 'sjunger'
  if (trad.running) return 'flyger'
  if (trad.archived) return 'sover'
  return 'sitter'
}

/** Hur stort ett bo ska vara av det tråden skrivit. Aldrig mindre än ett bo, aldrig ett berg. */
export function bostorlek(rader) {
  const n = Number.isFinite(rader) ? Math.max(0, rader) : 0
  return Math.min(BOMAX, 0.82 + n * BOVAXT)
}

/** En mjuk rund glöd att lysa med. Ritas en gång och delas av alla fåglar och bon. */
let glodTextur = null
function glod() {
  if (glodTextur) return glodTextur
  const d = document.createElement('canvas')
  d.width = 128
  d.height = 128
  const c = d.getContext('2d')
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.6, 'rgba(255,255,255,0.14)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = g
  c.fillRect(0, 0, 128, 128)
  glodTextur = new THREE.CanvasTexture(d)
  return glodTextur
}

function byggFagel(farg) {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: farg, roughness: 0.74, metalness: 0.02, flatShading: true })
  const ljus = new THREE.MeshStandardMaterial({ color: TAL.cream, roughness: 0.7, flatShading: true })

  const kropp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), mat)
  kropp.scale.set(1.2, 0.95, 0.88)
  kropp.castShadow = true
  g.add(kropp)

  const brost = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), ljus)
  brost.position.set(0.3, -0.18, 0)
  brost.scale.set(1, 0.85, 0.9)
  g.add(brost)

  const huvud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), mat)
  huvud.position.set(0.58, 0.44, 0)
  huvud.castShadow = true
  g.add(huvud)

  const nabb = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.44, 4),
    new THREE.MeshStandardMaterial({ color: TAL.honey, roughness: 0.6, flatShading: true })
  )
  nabb.position.set(0.98, 0.4, 0)
  nabb.rotation.z = -Math.PI / 2
  g.add(nabb)

  const stjart = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.95, 4), mat)
  stjart.position.set(-0.92, 0.06, 0)
  stjart.rotation.z = Math.PI / 2 + 0.28
  g.add(stjart)

  const vingar = []
  for (const sida of [-1, 1]) {
    const v = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.15, 4), mat)
    v.position.set(-0.05, 0.16, sida * 0.5)
    v.rotation.x = sida * Math.PI * 0.5
    v.rotation.z = 0.2
    v.castShadow = true
    g.add(v)
    vingar.push({ mesh: v, sida })
  }

  for (const sida of [-1, 1]) {
    const oga = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), new THREE.MeshBasicMaterial({ color: 0x131b17 }))
    oga.position.set(0.76, 0.52, sida * 0.24)
    g.add(oga)
  }

  // Ljuset fågeln bär. Sprite: den vänder sig alltid mot kameran, och storleken sätts i
  // update() efter AVSTÅNDET — en prick som alltid är läsbar, aldrig en boll som växer.
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glod(),
      color: farg,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    })
  )
  halo.renderOrder = 10
  halo.position.y = 0.3
  g.add(halo)

  g.userData.vingar = vingar
  g.userData.huvud = huvud
  g.userData.halo = halo
  return g
}

function byggBo() {
  const g = new THREE.Group()
  const kvist = new THREE.MeshStandardMaterial({ color: 0x5a452f, roughness: 1, flatShading: true })
  const skal = new THREE.Mesh(new THREE.TorusGeometry(1, 0.42, 5, 9), kvist)
  skal.rotation.x = Math.PI / 2
  skal.scale.y = 0.78
  skal.castShadow = true
  g.add(skal)
  const botten = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.62, 0.45, 9), kvist)
  botten.position.y = -0.32
  botten.receiveShadow = true
  g.add(botten)

  // Lyktan. Boet står still och är fem gånger större än fågeln — det är den signal som
  // håller när fågeln sitter hemma och är för liten för att synas.
  const lykta = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glod(),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  )
  lykta.position.y = 0.1
  g.add(lykta)

  g.userData.kvist = kvist
  g.userData.lykta = lykta
  return g
}

export class Faglar {
  constructor(scene) {
    this.scene = scene
    this.grupp = new THREE.Group()
    this.grupp.name = 'faglar'
    this.grupp.visible = false
    scene.add(this.grupp)
    this.faglar = new Map()
    this.nyckel = ''
  }

  /**
   * @param {{id,namn,farg,rader,running,unread,notis,hasError,archived,openUrl}[]} tradar
   * @param {{punkt:THREE.Vector3, riktning:THREE.Vector3}[]} platser  ur trädets boplatser()
   * @param {THREE.Vector3} stamhal  Lednings plats
   */
  set(tradar, platser, stamhal) {
    const lista = Array.isArray(tradar) ? tradar : []
    const nyckel = lista.map((t) => `${t.id}:${fagellage(t)}:${t.rader}`).join('|')
    if (nyckel === this.nyckel) return
    this.nyckel = nyckel
    this.grupp.visible = lista.length > 0

    const kvar = new Set(this.faglar.keys())
    // Ledning bor i stamhålet, som beställt. Resten får var sin gren.
    const ledning = lista.find((t) => String(t.id).toLowerCase().includes('ledning'))
    const andra = lista.filter((t) => t !== ledning)

    andra.forEach((t, i) => {
      const plats = platser[i % Math.max(1, platser.length)]
      if (!plats) return
      this._stall(t, plats.punkt, plats.riktning, false)
      kvar.delete(t.id)
    })
    if (ledning && stamhal) {
      this._stall(ledning, stamhal, new THREE.Vector3(1, 0.2, 0.5).normalize(), true)
      kvar.delete(ledning.id)
    }

    for (const id of kvar) {
      const f = this.faglar.get(id)
      // Spåret är syskon till fågeln i gruppen, inte barn — det måste rivas för sig, annars
      // hänger en komet kvar i luften efter en tråd som försvunnit.
      if (f.spar) {
        this.grupp.remove(f.spar)
        f.spar.geometry.dispose()
        f.spar.material.dispose()
      }
      this.grupp.remove(f.grupp)
      f.grupp.traverse((o) => {
        o.geometry?.dispose()
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
        else o.material?.dispose()
      })
      f.etikett.userData.dispose?.()
      this.faglar.delete(id)
    }
  }

  _stall(trad, punkt, riktning, iHal) {
    let post = this.faglar.get(trad.id)
    if (!post) {
      const grupp = new THREE.Group()
      const bo = iHal ? null : byggBo()
      if (bo) grupp.add(bo)
      const fagel = byggFagel(trad.farg ?? TAL.camel)
      fagel.scale.setScalar(FAGELSKALA)
      grupp.add(fagel)

      /**
       * Ljusspåret. En rullande buffert av de senaste positionerna, ritad som en linje som
       * tunnas ut bakåt. Det är det som gör arbetet synligt från överblicken: man ser inte
       * en fågel på tio pixlar, man ser en komet i trådens färg svepa genom kronan.
       */
      const sparGeo = new THREE.BufferGeometry()
      const sparPos = new Float32Array(SPAR * 3)
      const sparFarg = new Float32Array(SPAR * 3)
      sparGeo.setAttribute('position', new THREE.BufferAttribute(sparPos, 3))
      sparGeo.setAttribute('color', new THREE.BufferAttribute(sparFarg, 3))
      const spar = new THREE.Line(
        sparGeo,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        })
      )
      spar.frustumCulled = false
      spar.visible = false
      this.grupp.add(spar)
      const etikett = createLabel(trad.namn || String(trad.id), trad.farg ?? TAL.camel)
      etikett.visible = false
      etikett.material.opacity = 0
      grupp.add(etikett)
      this.grupp.add(grupp)
      // Varje fågel har sin egen takt: sju fåglar som flaxar i synk är en fjäderfägård,
      // inte ett träd.
      const r = fro((trad.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 7))
      post = {
        trad,
        grupp,
        bo,
        fagel,
        spar,
        sparPos,
        sparFarg,
        sparN: 0,
        etikett,
        hem: punkt.clone(),
        ut: punkt.clone().addScaledVector(riktning, 16).add(new THREE.Vector3(0, 6 + r() * 8, 0)),
        fas: r(),
        takt: 0.85 + r() * 0.4,
        flykt: r(),
        lage: 'sitter',
        iHal,
      }
      this.faglar.set(trad.id, post)
    }

    post.trad = trad
    post.hem.copy(punkt)
    post.lage = fagellage(trad)
    post.grupp.position.copy(punkt)
    post.etikett.position.set(0, 3.6, 0)

    if (post.bo) {
      // Boet är fågelns hem och måste matcha hennes skala, annars sitter en kråka i en kopp.
      const s = bostorlek(trad.rader) * FAGELSKALA * 0.8
      post.bo.scale.setScalar(s)
      post.bo.userData.kvist.color.set(post.lage === 'stoppat' ? 0x2a2018 : 0x5a452f)
    }
    post.fagel.traverse((o) => {
      o.userData.trad = trad
    })
  }

  /** Det som klicket i 1.0 letade efter på astronauterna: vilken tråd som träffades. */
  traffa(raycaster) {
    const traff = raycaster.intersectObjects(
      [...this.faglar.values()].map((f) => f.fagel),
      true
    )
    return traff.length ? traff[0].object.userData.trad || null : null
  }

  /** Skjuter in en ny punkt i kometen och tonar de gamla bakåt. */
  _drarSpar(f, punkt) {
    const farg = new THREE.Color(f.trad.farg ?? TAL.camel)
    // Skjut bakåt ett steg och lägg den nya punkten först.
    for (let i = SPAR - 1; i > 0; i--) {
      f.sparPos[i * 3] = f.sparPos[(i - 1) * 3]
      f.sparPos[i * 3 + 1] = f.sparPos[(i - 1) * 3 + 1]
      f.sparPos[i * 3 + 2] = f.sparPos[(i - 1) * 3 + 2]
    }
    f.sparPos[0] = punkt.x
    f.sparPos[1] = punkt.y
    f.sparPos[2] = punkt.z
    if (f.sparN < SPAR) {
      // Innan bufferten är full pekar de tomma punkterna på den nyaste, annars drar linjen
      // ett streck till origo — en komet med svans ner i marken.
      for (let i = f.sparN; i < SPAR; i++) {
        f.sparPos[i * 3] = punkt.x
        f.sparPos[i * 3 + 1] = punkt.y
        f.sparPos[i * 3 + 2] = punkt.z
      }
      f.sparN++
    }
    for (let i = 0; i < SPAR; i++) {
      const tona = 1 - i / SPAR
      f.sparFarg[i * 3] = farg.r * tona
      f.sparFarg[i * 3 + 1] = farg.g * tona
      f.sparFarg[i * 3 + 2] = farg.b * tona
    }
    f.spar.geometry.attributes.position.needsUpdate = true
    f.spar.geometry.attributes.color.needsUpdate = true
    f.spar.visible = true
    f.spar.material.opacity = 0.9
  }

  /** Spåret försvinner när fågeln landat — ett streck som hänger kvar läser som en bugg. */
  _tonaSpar(f, dt) {
    if (!f.spar.visible) return
    f.spar.material.opacity = Math.max(0, f.spar.material.opacity - dt * 1.4)
    if (f.spar.material.opacity <= 0.01) {
      f.spar.visible = false
      f.sparN = 0
    }
  }

  update(dt, camera, natt = 0) {
    if (!this.grupp.visible) return
    const t = performance.now() / 1000
    const p = new THREE.Vector3()
    const varldsPunkt = new THREE.Vector3()
    const riktning = new THREE.Vector3()

    for (const f of this.faglar.values()) {
      const flyger = f.lage === 'flyger'

      /**
       * Utflykten. Tråden arbetar → fågeln är ute, och den kommer hem med jämna mellanrum.
       * Vändpunkten är det som gör att man ser ATT den arbetar från andra sidan köket: en
       * fågel som bara sitter och lyser säger ingenting.
       */
      if (flyger) {
        /**
         * Varvet runt kronan.
         *
         * Första versionen flög sexton meter ut från grenen och tillbaka — osynligt mot ett
         * träd som är sextiotvå högt. Nu sveper fågeln ut i en vid båge kring hela stammen
         * och stiger över kronan: en bana som korsar himlen, där den syns mot ljuset.
         */
        f.flykt = (f.flykt + dt / FLYKT_S) % 1
        const v = f.flykt
        const b = Math.sin(v * Math.PI) // 0 hemma, 1 längst ut
        const rHem = Math.hypot(f.hem.x, f.hem.z) || 1
        const vinkel = Math.atan2(f.hem.z, f.hem.x) + Math.sin(v * Math.PI * 2) * 1.5
        const radie = rHem * (1 + SVEP * b)
        varldsPunkt.set(Math.cos(vinkel) * radie, f.hem.y + b * SVEPHOJD, Math.sin(vinkel) * radie)
        f.fagel.position.copy(varldsPunkt).sub(f.hem)

        // Näbben pekar dit hon är på väg — riktningen tas ur förflyttningen, inte ur banan.
        if (f.forra) {
          riktning.copy(varldsPunkt).sub(f.forra)
          if (riktning.lengthSq() > 1e-6) {
            f.fagel.rotation.y = Math.atan2(riktning.x, riktning.z) - Math.PI / 2
            f.fagel.rotation.z = THREE.MathUtils.clamp(-riktning.y * 1.4, -0.5, 0.5)
          }
        }
        ;(f.forra || (f.forra = new THREE.Vector3())).copy(varldsPunkt)

        const fart = 0.6 + b * 0.5
        for (const v2 of f.fagel.userData.vingar) {
          v2.mesh.rotation.z = 0.2 + Math.sin(t * 13 * f.takt) * (0.45 + fart * 0.55)
        }
        this._drarSpar(f, varldsPunkt)
      } else {
        f.fagel.position.set(0, 0.55 * FAGELSKALA, 0)
        f.fagel.rotation.set(0, f.fas * 6.28, 0)
        for (const v2 of f.fagel.userData.vingar) v2.mesh.rotation.z = 0.2
        f.forra = null
        // Spåret tunnas ut och försvinner i stället för att hänga kvar som en streck i luften.
        this._tonaSpar(f, dt)
      }

      // Sjunger: fågeln studsar i takt och sträcker på halsen. Sitter: andas bara.
      const huvud = f.fagel.userData.huvud
      if (f.lage === 'sjunger') {
        const s = Math.sin(t * 3.1 * f.takt)
        f.fagel.position.y += 0.18 + s * 0.16
        huvud.position.y = 0.44 + Math.max(0, s) * 0.2
        huvud.rotation.z = Math.max(0, s) * 0.35
      } else if (f.lage === 'stoppat') {
        // Huvudet ner. Det är hela signalen, och den behöver ingen färg.
        huvud.position.y = 0.2
        huvud.rotation.z = -0.9
      } else {
        huvud.position.y = 0.44 + Math.sin(t * 1.3 * f.takt + f.fas * 6) * 0.04
        huvud.rotation.z = 0
      }

      /**
       * Halon: minsta storlek PÅ SKÄRMEN, inte i världen.
       *
       * En sprite i fast världsstorlek blir en prick på tio pixlar från överblicken och en
       * vägg på nära håll. Genom att skala den med avståndet till kameran håller den ungefär
       * samma storlek i bild — den är alltid läsbar, aldrig i vägen. Det är det enda knepet
       * som gör sju fåglar räknebara tvärs över ett kök.
       */
      const halo = f.fagel.userData.halo
      f.fagel.getWorldPosition(p)
      const avst = p.distanceTo(camera.position)
      const styrka = f.lage === 'flyger' ? 1 : f.lage === 'sjunger' ? 0.75 + Math.sin(t * 3.1) * 0.25 : f.lage === 'stoppat' ? 0.12 : 0.4
      const skal = Math.max(1.6, avst * 0.052) / FAGELSKALA
      halo.scale.setScalar(skal * (0.75 + styrka * 0.6))
      halo.material.opacity = 0.35 + styrka * 0.6

      // Boets lykta: samma besked, men den står still och syns när fågeln är ute.
      if (f.bo) {
        const l = f.bo.userData.lykta
        l.material.color.set(f.trad.farg ?? TAL.camel)
        const boStyrka = f.lage === 'stoppat' ? 0.06 : f.lage === 'sjunger' ? 0.55 + Math.sin(t * 3.1) * 0.35 : f.lage === 'flyger' ? 0.5 : 0.3
        f.bo.getWorldPosition(p)
        l.scale.setScalar((Math.max(2.2, p.distanceTo(camera.position) * 0.06) / f.bo.scale.x) * 1.1)
        l.material.opacity = boStyrka * (0.5 + natt * 0.7)
      }

      // Namnet syns på nära håll, som kolonins övriga etiketter.
      f.etikett.getWorldPosition(p)
      const mal = p.distanceTo(camera.position) < 46 ? 1 : 0
      const m = f.etikett.material
      m.opacity += (mal - m.opacity) * Math.min(1, dt * 5)
      f.etikett.visible = m.opacity > 0.02
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
    this.faglar.clear()
  }
}
