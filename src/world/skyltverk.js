/**
 * Skyltverket — kolonins gemensamma skyltspråk.
 *
 * Tre skyltar står i kolonin: Loggboken, Agenterna och Filips egen. De byggdes en i taget,
 * och det syntes — tre stommar, tre rubrikstilar, tre sätt att dra en linje. En koloni där
 * varje skylt är sin egen idé ser ut som en mässa, inte som en plats.
 *
 * Här bor därför stommen och typografin, och skyltarna hämtar båda härifrån. Formspråket är
 * Roosts eget: tunna linjer i stället för rutor, en hårfin accentlist längst upp, serif i
 * rubriken och sans i brödtexten, spärrad versal i metadata, och luft.
 *
 * Fraunces och Manrope finns inte i en canvas som ritas offline på en köksskärm, så vi tar
 * de fallbacks Roosts egen standard redan pekar ut: Georgia för display, systemets sans för
 * text. Hierarkin är viktigare än bokstavsformerna.
 */
import * as THREE from 'three'
import { CSS, TAL, rgba } from './palett.js'

export const SERIF = 'Georgia, "Times New Roman", serif'
export const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
export const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

/** Spärrad text. Canvas kan inte letter-spacing överallt, så vi sätter bokstav för bokstav. */
export function spartext(c, text, x, y, sp = 0) {
  const s = String(text ?? '')
  if (!sp) {
    c.fillText(s, x, y)
    return c.measureText(s).width
  }
  let cx = x
  for (const ch of s) {
    c.fillText(ch, cx, y)
    cx += c.measureText(ch).width + sp
  }
  return cx - x - sp
}

export function spartextBredd(c, text, sp = 0) {
  const s = String(text ?? '')
  if (!sp) return c.measureText(s).width
  let w = 0
  for (const ch of s) w += c.measureText(ch).width + sp
  return Math.max(0, w - sp)
}

/** Bryter en rad så den ryms i bredden, och klipper med … om den ändå inte gör det. */
export function bryt(ctx, text, maxBredd, maxRader) {
  const ord = String(text || '')
    .split(/\s+/)
    .filter(Boolean)
  const rader = []
  let rad = ''
  for (const o of ord) {
    const forslag = rad ? `${rad} ${o}` : o
    if (ctx.measureText(forslag).width <= maxBredd) {
      rad = forslag
      continue
    }
    if (rad) rader.push(rad)
    rad = o
    if (rader.length === maxRader) break
  }
  if (rad && rader.length < maxRader) rader.push(rad)
  if (!rader.length) return []
  let sista = rader[rader.length - 1]
  while (sista && ctx.measureText(sista + '…').width > maxBredd) sista = sista.slice(0, -1)
  if (sista !== rader[rader.length - 1]) rader[rader.length - 1] = sista + '…'
  return rader
}

/** Skärmens botten: natt som klarnar mot mitten, med en svag vinjett i hörnen. */
export function bakgrund(c, W, H) {
  const g = c.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, CSS.natt)
  g.addColorStop(0.5, CSS.panel)
  g.addColorStop(1, CSS.natt)
  c.fillStyle = g
  c.fillRect(0, 0, W, H)
  const v = c.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.22, W / 2, H / 2, Math.max(W, H) * 0.7)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.42)')
  c.fillStyle = v
  c.fillRect(0, 0, W, H)
}

/** Tunn linje. Roost har inga rutor — det här är vad som skiljer två saker åt. */
export function regel(c, x, y, bredd, alpha = 0.14, tjocklek = 2) {
  c.fillStyle = rgba('cream', alpha)
  c.fillRect(x, y, bredd, tjocklek)
}

/**
 * Rubrikraden, likadan på alla skyltar: accentlist längst upp, sektionsnummer i accentfärg,
 * titel i serif, en kursiv underrubrik, och statusen längst till höger. Returnerar y-värdet
 * där innehållet får börja, så ingen skylt behöver räkna själv.
 */
export function huvud(c, { W, pad, nummer, titel, under, accent = CSS.clay, hoger, hogerFarg, skala = 1 }) {
  c.fillStyle = accent
  c.fillRect(0, 0, W, Math.round(7 * skala))
  c.textBaseline = 'top'
  c.textAlign = 'left'

  const y = pad
  c.font = `600 ${Math.round(24 * skala)}px ${SANS}`
  c.fillStyle = accent
  spartext(c, nummer, pad, y + Math.round(10 * skala), Math.round(5 * skala))

  const titelY = y + Math.round(44 * skala)
  c.font = `400 ${Math.round(66 * skala)}px ${SERIF}`
  c.fillStyle = CSS.cream
  const titelBredd = spartext(c, titel, pad, titelY, Math.round(-1 * skala))

  if (under) {
    c.font = `italic 400 ${Math.round(30 * skala)}px ${SERIF}`
    c.fillStyle = CSS.dampad
    c.fillText(under, pad + titelBredd + Math.round(28 * skala), titelY + Math.round(26 * skala))
  }

  if (hoger) {
    c.textAlign = 'right'
    c.font = `600 ${Math.round(24 * skala)}px ${SANS}`
    c.fillStyle = hogerFarg || CSS.dampad
    c.fillText(hoger, W - pad, y + Math.round(10 * skala))
    c.textAlign = 'left'
  }

  const linjeY = titelY + Math.round(92 * skala)
  regel(c, pad, linjeY, W - pad * 2, 0.16, Math.round(2 * skala))
  return linjeY + Math.round(34 * skala)
}

/**
 * Stommen.
 *
 * Alla tre skyltarna står på samma sorts ställning: två sexkantiga, svagt koniska ben med
 * fot och snedsträva, en ram i stål med indragen fals, och en tunn lysande list längst upp
 * i skyltens egen färg. Hörnplattor i stället för skruvar — de ger en byggd kant utan att
 * skyltarna behöver en enda skugga.
 *
 * Duken läggs som en egen plan framför falsen, så texten aldrig ligger i samma plan som
 * ramen och z-fightar när kameran drar sig undan.
 */
export function byggPlank(grupp, { bredd, hojd, benhojd, accent, strava = true, hornplattor = true }) {
  const stal = new THREE.MeshStandardMaterial({ color: TAL.stomme, roughness: 0.66, metalness: 0.4 })
  const mork = new THREE.MeshStandardMaterial({ color: TAL.natt, roughness: 0.92, metalness: 0.06 })
  const list = new THREE.MeshStandardMaterial({
    color: TAL.panel,
    emissive: accent,
    emissiveIntensity: 0.85,
    roughness: 0.45,
  })

  const mittY = benhojd + hojd / 2
  const ramt = Math.max(0.24, hojd * 0.035) // ramens bredd runt duken
  const benR = Math.max(0.2, hojd * 0.038)
  const benInset = bredd * 0.16

  for (const dx of [-bredd / 2 + benInset, bredd / 2 - benInset]) {
    const ben = new THREE.Mesh(new THREE.CylinderGeometry(benR * 0.74, benR, benhojd + hojd * 0.2, 6), stal)
    ben.position.set(dx, (benhojd + hojd * 0.2) / 2, 0)
    ben.castShadow = true
    grupp.add(ben)

    const fot = new THREE.Mesh(new THREE.CylinderGeometry(benR * 2.1, benR * 2.5, 0.26, 6), stal)
    fot.position.set(dx, 0.13, 0)
    fot.receiveShadow = true
    grupp.add(fot)

    if (strava) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(benR * 0.55, benhojd * 1.16, benR * 0.55), stal)
      s.position.set(dx, benhojd * 0.5, -benhojd * 0.27)
      s.rotation.x = 0.48
      grupp.add(s)
    }
  }

  // Ramen: en platta i stål och en indragen fals i natt, i stället för en enda tjock box.
  const ram = new THREE.Mesh(new THREE.BoxGeometry(bredd + ramt * 2, hojd + ramt * 2, 0.3), stal)
  ram.position.set(0, mittY, 0)
  ram.castShadow = true
  grupp.add(ram)

  const fals = new THREE.Mesh(new THREE.BoxGeometry(bredd + ramt * 0.5, hojd + ramt * 0.5, 0.32), mork)
  fals.position.set(0, mittY, 0.03)
  grupp.add(fals)

  // Accentlisten längst upp — skyltens färg, synlig långt innan texten går att läsa.
  const listMesh = new THREE.Mesh(new THREE.BoxGeometry(bredd + ramt * 2, ramt * 0.42, 0.34), list)
  listMesh.position.set(0, mittY + hojd / 2 + ramt * 0.72, 0.02)
  grupp.add(listMesh)

  if (hornplattor) {
    const hx = bredd / 2 + ramt * 0.45
    const hy = hojd / 2 + ramt * 0.45
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const platta = new THREE.Mesh(new THREE.BoxGeometry(ramt * 1.5, ramt * 1.5, 0.38), stal)
      platta.position.set(sx * hx, mittY + sy * hy, 0.01)
      platta.rotation.z = Math.PI / 4
      grupp.add(platta)
    }
  }

  return { mittY, ramt, stal, mork, list }
}

/** Duk + textur + skärm, likadant för alla skyltar. */
export function byggDuk(grupp, { bredd, hojd, pixlar, mittY }) {
  const duk = document.createElement('canvas')
  duk.width = Math.round(bredd * pixlar)
  duk.height = Math.round(hojd * pixlar)
  const textur = new THREE.CanvasTexture(duk)
  textur.colorSpace = THREE.SRGBColorSpace
  textur.anisotropy = 8

  const skarm = new THREE.Mesh(
    new THREE.PlaneGeometry(bredd, hojd),
    new THREE.MeshBasicMaterial({ map: textur, toneMapped: false })
  )
  skarm.position.set(0, mittY, 0.2)
  grupp.add(skarm)
  return { duk, textur, skarm }
}

/** Vrider en skylt mjukt mot kameran. Skyltar som snäpper runt sin axel ser ut som fel. */
export function vridMot(grupp, camera, riktning, dt, fart = 1.2) {
  const mal = Math.atan2(camera.position.x - grupp.position.x, camera.position.z - grupp.position.z)
  let diff = mal - riktning
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  const ny = riktning + diff * Math.min(1, dt * fart)
  grupp.rotation.y = ny
  return ny
}
