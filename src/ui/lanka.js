/**
 * LÄNKAR I TEXT (rad 2457). Allt som står på tavlan ska gå att klicka: https://-adresser,
 * roost.love/… och "Rad N" (→ Roostadmins tavla på just den raden). Bilder ur bildbanken
 * får data-bild så huden kan öppna dem i en overlay i stället för en ny flik.
 *
 * Ren funktion, ingen DOM: tar rå text, ger säker HTML (allt utom länkarna är escapat).
 */
export const RAD_URL = 'https://roost.love/admin/loggbok?rad='

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Antingen en adress (med eller utan https://) eller "Rad 123". Skiljetecken i slutet hör inte till adressen.
const MONSTER = /(https?:\/\/[^\s<>"']+|\b(?:www\.)?roost\.love\/[^\s<>"']*)|\b(Rad(?:erna)?\s+(\d{1,6}))\b/g
const SLUT = /[.,;:!?)\]]+$/
const BILD = /roost\.love\/api\/bildbank|\.(?:png|jpe?g|gif|webp)(?:\?|$)/i

export function lankifiera(text) {
  const s = String(text ?? '')
  let ut = ''
  let sist = 0
  for (const m of s.matchAll(MONSTER)) {
    ut += esc(s.slice(sist, m.index))
    if (m[1]) {
      const url = m[1].replace(SLUT, '')
      const href = /^https?:/.test(url) ? url : `https://${url}`
      const bild = BILD.test(url) ? ' data-bild="1"' : ''
      ut += `<a class="lank" href="${esc(href)}" target="_blank" rel="noopener"${bild}>${esc(url)}</a>`
      sist = m.index + url.length
    } else {
      ut += `<a class="lank" href="${RAD_URL}${m[3]}" target="_blank" rel="noopener">${esc(m[2])}</a>`
      sist = m.index + m[0].length
    }
  }
  return ut + esc(s.slice(sist))
}
