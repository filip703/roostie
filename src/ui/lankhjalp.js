/**
 * Länkhjälp (rad 2457): det som inte är ren text.
 *  - klick på en bild ur bildbanken öppnar den i en overlay (klick stänger),
 *  - på touch: lång-tryck på ett kort ger "Kopiera text / Kopiera länk".
 * Lyssnarna sitter på dokumentet och installeras en gång, så omritade kort behöver inget.
 */
const KORT = '.replik, .gs-kort, .tf-rad, .thread-pop .rad'
const LANGT_MS = 550

let klar = false

function overlay(src) {
  const o = document.createElement('div')
  o.className = 'bild-overlay'
  o.innerHTML = `<img alt="" src="${src.replace(/"/g, '&quot;')}">`
  o.addEventListener('click', () => o.remove())
  document.body.appendChild(o)
}

async function kopiera(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const t = document.createElement('textarea')
    t.value = text
    t.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(t)
    t.select()
    document.execCommand?.('copy')
    t.remove()
  }
}

function meny(x, y, kort, lank) {
  document.querySelector('.kopiera-meny')?.remove()
  const m = document.createElement('div')
  m.className = 'kopiera-meny'
  m.style.cssText = `left:${Math.max(8, Math.min(x, innerWidth - 180))}px;top:${Math.max(8, y - 56)}px`
  const knapp = (etikett, text) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = etikett
    b.onclick = async () => {
      await kopiera(text)
      m.remove()
    }
    m.appendChild(b)
  }
  knapp('Kopiera text', kort.innerText.trim())
  const href = lank?.href || kort.querySelector('a.lank')?.href
  if (href) knapp('Kopiera länk', href)
  document.body.appendChild(m)
  setTimeout(() => document.addEventListener('pointerdown', () => m.remove(), { once: true }), 0)
}

export function installeraLankhjalp() {
  if (klar) return
  klar = true

  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[data-bild]')
    if (!a) return
    e.preventDefault()
    overlay(a.href)
  })

  let timer = 0
  let start = null
  const avbryt = () => clearTimeout(timer)
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return
    const kort = e.target.closest?.(KORT)
    if (!kort) return
    start = { x: e.clientX, y: e.clientY }
    const lank = e.target.closest('a.lank')
    avbryt()
    timer = setTimeout(() => meny(start.x, start.y, kort, lank), LANGT_MS)
  })
  document.addEventListener('pointermove', (e) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) avbryt()
  })
  document.addEventListener('pointerup', avbryt)
  document.addEventListener('pointercancel', avbryt)
  // Långtrycket ska inte också öppna systemets egen meny ovanpå vår.
  document.addEventListener('contextmenu', (e) => {
    if (document.querySelector('.kopiera-meny') && e.target.closest?.(KORT)) e.preventDefault()
  })
}
