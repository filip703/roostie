/**
 * KOLONIN FÖRKLARAR SIG SJÄLV — rundtur första gången och teckenförklaring (rad 1813).
 *
 * Texterna kommer ur docs/design/kolonin-copy.md (Design). Stegen och minnet av om man sett
 * rundturen ligger här utan DOM, för att gå att prova; `Forklaring` längst ner är bara skalet.
 * Ord som tråd, pass, commit och deploy används inte — den som läser är inte utvecklare.
 */

export const RUNDTUR_STEG = [
  {
    rubrik: 'Det här är Roosts arbetslag',
    text: 'Varje astronaut är en del av Roost som jobbar för sig själv, dygnet runt. Du ser vem som gör vad.',
  },
  {
    rubrik: 'Färgen visar läget',
    text: 'Grön jobbar. Gul väntar på dig. Röd har stannat. Grå vilar.',
  },
  {
    rubrik: 'Tryck på en astronaut',
    text: 'Då får du veta vad den bygger just nu, vad den senast blev klar med — och kan starta eller pausa den.',
  },
  {
    rubrik: 'Skylten ovanför är det viktigaste',
    text: 'Står det ”Väntar på dig” är det något Filip behöver svara på. Börja där.',
  },
]

/** Färgprick + ord, aldrig bara färg (WCAG 1.4.1). */
export const TECKEN = [
  { farg: 'var(--green)', ord: 'Jobbar' },
  { farg: 'var(--amber)', ord: 'Väntar på dig' },
  { farg: 'var(--red)', ord: 'Har stannat' },
  { farg: 'var(--dim)', ord: 'Vilar' },
]

const NYCKEL_SETT = 'kolonin.rundtur.sedd'
const NYCKEL_FORKLARING = 'kolonin.forklaring.dold'

/** Storage som kastar (privat läge, blockerat) ska aldrig fälla kolonin. */
function las(lager, nyckel) {
  try {
    return lager?.getItem(nyckel)
  } catch {
    return null
  }
}
function skriv(lager, nyckel, varde) {
  try {
    lager?.setItem(nyckel, varde)
  } catch {
    /* minnet är en bonus */
  }
}

export const harSettRundtur = (lager) => las(lager, NYCKEL_SETT) === '1'
export const markeraSedd = (lager) => skriv(lager, NYCKEL_SETT, '1')
export const forklaringDold = (lager) => las(lager, NYCKEL_FORKLARING) === '1'
export const minnsForklaring = (lager, dold) => skriv(lager, NYCKEL_FORKLARING, dold ? '1' : '0')

/** Knapptexten för steg i av n: sista heter ”Klart”. */
export const knappText = (i, n = RUNDTUR_STEG.length) => (i >= n - 1 ? 'Klart' : 'Nästa')

export class Forklaring {
  /**
   * @param root   elementet som rundtur och förklaring läggs i
   * @param lager  localStorage (injicerbart)
   * @param opts   { kiosk } — köksskärmen startar ingen rundtur av sig själv
   */
  constructor(root, lager = globalThis.localStorage, { kiosk = false } = {}) {
    this.root = root
    this.lager = lager
    this.steg = 0
    this.tur = document.createElement('div')
    this.tur.className = 'rundtur-ruta'
    this.tur.setAttribute('role', 'dialog')
    this.tur.setAttribute('aria-label', 'Rundtur i kolonin')
    this.tur.hidden = true
    root.appendChild(this.tur)

    this.ruta = document.createElement('div')
    this.ruta.className = 'teckenforklaring panel'
    this.ruta.innerHTML = `
      <button class="tf-vippa" type="button" aria-expanded="true"></button>
      <div class="tf-kropp">
        <strong>Så läser du kolonin</strong>
        <ul>${TECKEN.map((t) => `<li><i style="background:${t.farg}"></i>${t.ord}</li>`).join('')}</ul>
        <p>Skylten ovanför säger vad den gör. Tryck på en astronaut för mer.</p>
      </div>`
    root.appendChild(this.ruta)
    this.vippa = this.ruta.querySelector('.tf-vippa')
    this.vippa.addEventListener('click', () => this.vikForklaring(!this.ruta.classList.contains('dold')))
    this.vikForklaring(forklaringDold(lager), false)

    if (!kiosk && !harSettRundtur(lager)) this.starta()
  }

  vikForklaring(dold, minns = true) {
    this.ruta.classList.toggle('dold', dold)
    this.vippa.textContent = dold ? 'Visa förklaring' : 'Dölj förklaring'
    this.vippa.setAttribute('aria-expanded', String(!dold))
    if (minns) minnsForklaring(this.lager, dold)
  }

  starta() {
    this.steg = 0
    this.rita()
    this.tur.hidden = false
  }

  avsluta() {
    this.tur.hidden = true
    markeraSedd(this.lager)
  }

  rita() {
    const n = RUNDTUR_STEG.length
    const s = RUNDTUR_STEG[this.steg]
    this.tur.innerHTML = `
      <div class="rt-steg">Steg ${this.steg + 1} av ${n}</div>
      <h3>${s.rubrik}</h3>
      <p>${s.text}</p>
      <div class="rt-knappar">
        <button type="button" class="btn ghost" data-rt="hoppa">Hoppa över</button>
        <button type="button" class="btn primary" data-rt="nasta">${knappText(this.steg, n)}</button>
      </div>`
    this.tur.querySelector('[data-rt="hoppa"]').addEventListener('click', () => this.avsluta())
    this.tur.querySelector('[data-rt="nasta"]').addEventListener('click', () => {
      if (this.steg >= n - 1) this.avsluta()
      else {
        this.steg += 1
        this.rita()
      }
    })
  }
}
