import { flodesrader, klockslag, radUrl } from './tavelflode.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/**
 * Monterar flödet längst ned. Kompakt (3 rader) i köksläget. Pausknappen fryser listan;
 * nya rader tas emot men ritas först när man trycker igen.
 */
export function monteraTavelflode(root, { kiosk = false } = {}) {
  const el = document.createElement('div')
  el.className = `tavelflode${kiosk ? ' kompakt' : ''}`
  el.innerHTML = `<button type="button" class="tf-paus" title="Pausa flödet" aria-label="Pausa flödet">❚❚</button><ol class="tf-lista"></ol>`
  root.appendChild(el)
  const lista = el.querySelector('.tf-lista')
  const paus = el.querySelector('.tf-paus')
  let pausad = false
  let senaste = null
  const antal = kiosk ? 3 : 20

  const rita = () => {
    const rader = flodesrader(senaste, antal)
    lista.innerHTML = rader.length
      ? rader.map((r) => `<li class="tf-rad ${r.klass}"><a href="${esc(radUrl(r))}" target="_blank" rel="noopener"><span class="tf-tid">${klockslag(r.nar)}</span> <b class="tf-namn">${esc(r.trad)}</b> <span class="tf-rub">${esc(r.rubrik)}</span></a></li>`).join('')
      : '<li class="tf-rad notis">Inget på tavlan just nu</li>'
  }
  paus.addEventListener('click', () => {
    pausad = !pausad
    el.classList.toggle('pausad', pausad)
    paus.textContent = pausad ? '▶' : '❚❚'
    paus.title = pausad ? 'Fortsätt flödet' : 'Pausa flödet'
    if (!pausad) rita()
  })
  return {
    uppdatera(svar) {
      senaste = svar
      if (!pausad) rita()
    },
  }
}
