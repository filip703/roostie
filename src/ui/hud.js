import { PRESETS, PLANETS_ORDER } from './hud-data.js'
import { byggFlode } from './flode.js'
import { koSammanfattning } from './ko.js'
import { lankifiera } from './lanka.js'
import { installeraLankhjalp } from './lankhjalp.js'
import { fragaUrl, fragaText } from './gorsjalv.js'
import { PLANETS } from '../world/planet.js'
import { TIMES, systemTimeOfDay } from '../world/sky.js'
import { STATUS_LABEL } from '../game/colony.js'
import { FACE, FRAME_COLS, FRAME_ROWS } from '../agents/faces.js'
import { PLOT_PALETTE, hashString } from '../world/plots.js'

/**
 * The whole HUD, in plain DOM.
 *
 * Deliberately not a framework: this sits on top of a render loop that must not miss a
 * frame, so the UI only ever touches the DOM when something it shows has actually changed —
 * every setter compares against the last value it wrote and returns early otherwise.
 *
 * The one hard rule is that all of this is optional. Pressing H hides every panel, and the
 * game stays fully readable because status lives above the astronauts' heads in the scene,
 * not in here.
 */

/**
 * The page only ever runs on the machine the server is on — it answers nothing else — so the
 * browser's OS is the server's OS, and the name of the thing that shows a folder can be read
 * here rather than asked for.
 */
const IS_MAC = /Mac/.test(navigator.platform)
const FILE_MANAGER = IS_MAC ? 'Finder' : /Win/.test(navigator.platform) ? 'Explorer' : 'Files'

const ICON = {
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M6.6 6.6C4.06 8.2 2 11 2 11s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-6h5v6"/></svg>`,
  next: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3 8.5h3.2l1.5-2h8.6l1.5 2H21v11H3z"/><circle cx="12" cy="14" r="3.4"/></svg>`,
  help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.6v.4"/><path d="M12 17h.01"/></svg>`,
  open: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
  archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18v3H3z"/><path d="M5 9v10h14V9"/><path d="M10 13h4"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.7a8 8 0 0 1-8.5 8 9.3 9.3 0 0 1-2.7-.4L4.5 21l1.4-4.1a7.9 7.9 0 0 1-2.4-5.7A8 8 0 0 1 12 3.6a8 8 0 0 1 8.5 8.1z"/><path d="M12 8.6v5.4M9.3 11.3h5.4"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.4A1.4 1.4 0 0 1 4.4 6h4.2l2 2.5h7A1.4 1.4 0 0 1 19 9.9v7.7a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 17.6z"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>`,
  locate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.6"/><path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6"/></svg>`,
  orbit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="10.2" ry="4.6" transform="rotate(-24 12 12)"/><circle cx="21" cy="8.2" r="1.5" fill="currentColor" stroke="none"/></svg>`,
}

const STAT_DEFS = [
  { key: 'working', label: 'bygger', cls: 'working' },
  { key: 'waiting', label: 'vill dig', cls: 'waiting' },
  { key: 'blocked', label: 'stoppat', cls: 'blocked' },
  { key: 'celebrating', label: 'levererat', cls: 'done' },
  { key: 'agents', label: 'trådar', cls: 'idle' },
]

export class Hud {
  constructor(root, settings, actions) {
    this.settings = settings
    this.actions = actions
    this.visible = true
    this._last = {}
    /** namn → { knapp, ruta } för maskinernas panelrader; nollas vid varje omritning. */
    this._maskinrutor = new Map()
    /** Vilken maskins ruta som står öppen. Överlever en omritning via _aterstallMaskin(). */
    this._oppenMaskin = ''
    this.hiddenOpen = false

    this.el = document.createElement('div')
    this.el.className = 'hud'
    this.el.innerHTML = TEMPLATE
    root.appendChild(this.el)
    installeraLankhjalp(this.el)

    this.$ = (sel) => this.el.querySelector(sel)

    this._buildStats()
    this._buildSettings()
    this._buildAvatar()
    this._wire()
    this.syncSettings()
  }

  // ── construction ────────────────────────────────────────────────────────────────────

  _buildStats() {
    const wrap = this.$('.stats')
    this.statEls = {}
    for (const def of STAT_DEFS) {
      const b = document.createElement('button')
      b.className = `stat ${def.cls}`
      b.type = 'button'
      b.dataset.key = def.key
      b.title = `Hoppa till nästa som ${def.label}`
      b.innerHTML = `<i class="pip"></i><span class="n">0</span><span class="lbl">${def.label}</span>`
      b.type = 'button'
      b.addEventListener('click', () => this.actions.focusStatus?.(def.key))
      wrap.appendChild(b)
      this.statEls[def.key] = b
    }
  }

  _buildSettings() {
    const body = this.$('.settings .body')
    const s = this.settings
    this.controls = []

    // Quality presets.
    body.appendChild(
      group(
        'Kvalitet',
        chips(
          Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label, title: p.hint })),
          () => s.get('preset'),
          (id) => s.applyPreset(id),
          this.controls
        )
      )
    )

    // Performance.
    const perf = group('Prestanda')
    perf.append(
      this._toggle('HDR och sken', 'bloom', 'Lysande ögon, lyktor och fönster. Det första som stryks.'),
      this._toggle('Tiltskift', 'tiltShift', 'Kort skärpedjup — det är det som får kolonin att läsas som en modell.'),
      this._slider(
        'Tiltskiftets oskärpa',
        'tiltShiftStrength',
        0,
        1,
        0.05,
        (v) => `${Math.round(v * 100)}%`,
        'Bländare: hur kort skärpan är, och hur långt utanför den saker hamnar.'
      ),
      this._slider(
        'Tiltskiftets vinkel',
        'tiltShiftAngle',
        -90,
        90,
        1,
        (v) => `${v}°`,
        'Vrider skärpeplanet, som när man tiltar ett riktigt objektiv.'
      ),
      this._select('Skuggor', 'shadows', [
        ['off', 'Off'],
        ['low', 'Low'],
        ['high', 'High'],
        ['ultra', 'Ultra'],
      ]),
      this._select('Partiklar', 'particles', [
        ['off', 'Off'],
        ['low', 'Low'],
        ['full', 'Full'],
      ]),
      this._select('Texturer', 'textureQuality', [
        ['low', 'Low'],
        ['medium', 'Medium'],
        ['high', 'High'],
        ['ultra', 'Ultra'],
      ]),
      this._select('Markens detalj', 'groundDetail', [
        ['low', 'Low'],
        ['medium', 'Medium'],
        ['high', 'High'],
      ]),
      this._toggle('Kantutjämning', 'antialias', 'SMAA. Billigt, men inte gratis.'),
      this._slider(
        'Upplösning',
        'renderScale',
        0.35,
        2,
        0.05,
        (v) => `${Math.round(v * 100)}%`,
        '100 % är skärmens egen upplösning, retina inräknad.'
      ),
      this._toggle('Anpassad kvalitet', 'autoQuality', 'Sänker upplösningen tyst när bilderna blir dyra.'),
      this._slider('Strössel', 'scatterDensity', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`),
      this._slider('Högst antal trådar', 'maxAgents', 10, 200, 10, (v) => String(v)),
      this._toggle('Stjärnor', 'stars')
    )
    body.appendChild(perf)

    // World.
    const world = group('Planet')
    const planets = document.createElement('div')
    planets.className = 'planets'
    for (const id of PLANETS_ORDER) {
      const planet = PLANETS[id]
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'planet'
      b.title = planet.blurb
      const c1 = hex(planet.ground.high)
      const c2 = hex(planet.ground.low)
      b.innerHTML = `<i class="orb" style="background:radial-gradient(circle at 33% 30%, ${c1}, ${c2})"></i><span>${planet.name}</span>`
      b.addEventListener('click', () => this.settings.set('planet', id))
      planets.appendChild(b)
      this.controls.push({ el: b, sync: () => b.setAttribute('aria-pressed', String(this.settings.get('planet') === id)) })
    }
    world.appendChild(planets)
    body.appendChild(world)

    // Lighting.
    const light = group('Ljus')
    light.append(
      chips(
        // `Live` is a time of day like the others from where you are standing, so it belongs
        // in the same row rather than in a toggle further down.
        [...TIMES.map((t) => ({ id: t.id, label: t.label })), { id: 'live', label: 'Live' }],
        () => (this.settings.get('clockTime') ? 'live' : nearestTime(this.settings.get('timeOfDay'))),
        (id) => {
          this.settings.set('autoTime', false)
          this.settings.set('clockTime', id === 'live')
          if (id === 'live') this.settings.set('timeOfDay', systemTimeOfDay())
          else this.settings.set('timeOfDay', TIMES.find((t) => t.id === id).value)
        },
        this.controls
      ),
      this._slider('Tid på dygnet', 'timeOfDay', 0, 1, 0.005, clockLabel, undefined, () => {
        // Reaching for the slider is a request for a particular light, so stop following the
        // clock — otherwise the next frame would drag the thumb straight back.
        this.settings.set('clockTime', false)
      }),
      this._toggle(
        'Dygnet går',
        'autoTime',
        'Runs the clock forward on its own. Ignored while the sky is following this machine’s clock.'
      ),
      this._slider('Dygnets längd', 'dayLength', 30, 900, 30, (v) => `${Math.round(v / 60)}m`),
      this._toggle(
        'Omgivningsljus',
        'ibl',
        'Ljus hämtat ur planetens egen himmel. Metall får något att spegla.'
      ),
      this._slider('Omgivning', 'iblIntensity', 0, 2, 0.05, (v) => v.toFixed(2)),
      this._slider('Exponering', 'exposure', 0.4, 2, 0.05, (v) => v.toFixed(2)),
      this._slider('Sken', 'bloomStrength', 0, 1.6, 0.02, (v) => v.toFixed(2))
    )
    body.appendChild(light)

    // View.
    const view = group('View')
    view.append(
      this._toggle(
        'Göm sovande plättar',
        'hideDormant',
        'Takes a repo off the map when every thread in it has been quiet for three days. Its threads are untouched, and it comes back to the same ground the moment one wakes up.'
      )
    )
    view.append(
      this._toggle('Tillbaka till isometrin', 'autoFrame', 'Vrider tillbaka vinkeln när du släpper.'),
      this._slider('Synfält', 'fov', 20, 60, 1, (v) => `${v}°`),
      this._toggle('Namn på plättarna', 'showLabels'),
      this._toggle('Dämpad rörelse', 'reducedMotion', 'Lugnar guppandet och kamerans mjukhet.'),
      this._toggle('Visa bilder per sekund', 'showFps')
    )
    body.appendChild(view)
  }

  _row(label, hint) {
    const row = document.createElement('div')
    row.className = 'row'
    const l = document.createElement('div')
    l.className = 'label'
    l.innerHTML = `<span>${label}</span>${hint ? `<span class="hint">${hint}</span>` : ''}`
    row.appendChild(l)
    return row
  }

  _toggle(label, key, hint) {
    const row = this._row(label, hint)
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'toggle'
    b.setAttribute('role', 'switch')
    b.addEventListener('click', () => this.settings.set(key, !this.settings.get(key)))
    row.appendChild(b)
    this.controls.push({
      el: row,
      sync: () => {
        b.setAttribute('aria-checked', String(Boolean(this.settings.get(key))))
        row.classList.toggle('overridden', this.settings.isOverridden(key))
      },
    })
    return row
  }

  _select(label, key, options, hint) {
    const row = this._row(label, hint)
    const sel = document.createElement('select')
    sel.className = 'select'
    for (const [value, text] of options) {
      const o = document.createElement('option')
      o.value = value
      o.textContent = text
      sel.appendChild(o)
    }
    sel.addEventListener('change', () => this.settings.set(key, sel.value))
    row.appendChild(sel)
    this.controls.push({
      el: row,
      sync: () => {
        sel.value = String(this.settings.get(key))
        row.classList.toggle('overridden', this.settings.isOverridden(key))
      },
    })
    return row
  }

  _slider(label, key, min, max, step, format, hint, onInput) {
    const row = this._row(label, hint)
    const wrap = document.createElement('div')
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px'
    const input = document.createElement('input')
    input.type = 'range'
    input.className = 'slider'
    input.min = min
    input.max = max
    input.step = step
    const out = document.createElement('span')
    out.className = 'value'
    input.addEventListener('input', () => {
      onInput?.()
      this.settings.set(key, Number(input.value))
    })
    wrap.append(input, out)
    row.appendChild(wrap)
    this.controls.push({
      el: row,
      sync: () => {
        const v = Number(this.settings.get(key))
        // Never fight the thumb the user is dragging.
        if (document.activeElement !== input) input.value = String(v)
        out.textContent = format(v)
        row.classList.toggle('overridden', this.settings.isOverridden(key))
      },
    })
    return row
  }

  /** The little face on the agent card, drawn from the same atlas the astronauts use. */
  _buildAvatar() {
    const canvas = this.$('.thread-pop .avatar canvas')
    canvas.width = 108
    canvas.height = 108
    this.avatarCtx = canvas.getContext('2d')
    this.avatarTmp = document.createElement('canvas')
    this.avatarTmp.width = 108
    this.avatarTmp.height = 108
    this.avatarTmpCtx = this.avatarTmp.getContext('2d')
    this._avatarState = { frame: -1, color: '' }
  }

  _wire() {
    const on = (sel, ev, fn) => this.$(sel).addEventListener(ev, fn)

    on('#btn-settings', 'click', () => this.toggleSettings())
    on('#btn-close-settings', 'click', () => this.toggleSettings(false))
    on('#btn-hide', 'click', () => this.toggleUi())
    on('#btn-help', 'click', () => (this.actions.visaRundtur ? this.actions.visaRundtur() : this.toggleHelp()))
    on('#btn-shot', 'click', () => this.actions.screenshot?.())
    on('#btn-home', 'click', () => this.actions.resetView?.())
    on('#btn-next', 'click', () => this.actions.focusStatus?.('waiting'))
    on('#btn-orbit', 'click', () => this.setOrbit(this.actions.toggleOrbit?.()))
    on('#btn-planet', 'click', () => this.actions.cyclePlanet?.())
    on('#btn-time', 'click', () => this.actions.cycleTime?.())
    on('#btn-open', 'click', () => this.actions.openThread?.())
    on('#btn-viewed', 'click', () => this.actions.markViewed?.())
    on('#btn-pass-starta', 'click', () => this.actions.styrPass?.('starta'))
    on('#btn-pass-pausa', 'click', () => this.actions.styrPass?.('pausa'))
    on('#btn-pass-budget', 'click', () => this.actions.styrPass?.('budget'))
    on('#btn-pass-natt', 'click', () => this.actions.styrPass?.('nattlage'))
    on('#btn-archive', 'click', () => this.actions.archiveThread?.())
    on('#btn-deselect', 'click', () => this.actions.select?.(null))
    on('#btn-hide-project', 'click', () => this.actions.hideProject?.())
    on('#btn-hidden-toggle', 'click', () => this.toggleHiddenList())
    on('#btn-agents-toggle', 'click', () => this.toggleAgentList())
    on('#btn-locate', 'click', () => this.actions.focusProject?.(this.project?.name))
    on('#btn-close-project', 'click', () => this.actions.closeProject?.())
    on('.help', 'click', (e) => {
      if (e.target === this.$('.help')) this.toggleHelp(false)
    })
    this.$('.help .sheet').addEventListener('click', (e) => e.stopPropagation())
    on('#btn-help-close', 'click', () => this.toggleHelp(false))

    this.settings.onChange(() => this.syncSettings())
  }

  // ── state in ────────────────────────────────────────────────────────────────────────

  syncSettings() {
    for (const c of this.controls) c.sync()
    this.$('.fps').classList.toggle('on', Boolean(this.settings.get('showFps')))
  }

  setStats(stats) {
    for (const def of STAT_DEFS) {
      const n = stats[def.key] ?? 0
      const el = this.statEls[def.key]
      if (this._last['stat:' + def.key] === n) continue
      this._last['stat:' + def.key] = n
      el.querySelector('.n').textContent = String(n)
      el.dataset.empty = String(n === 0)
    }
  }

  /**
   * Every repo, in the sidebar. This was a strip of chips along the bottom of the screen;
   * it is a list now because the sidebar is where all the chrome lives, and because a list
   * can carry a count and an alarm without running out of room at eleven repos.
   */
  setLegend(projects, activeName = null, hidden = [], folded = []) {
    const signature =
      projects.map((p) => `${p.name}:${p.count}:${p.accent}:${p.urgent ? 1 : 0}`).join('|') +
      `~${activeName}~` +
      hidden.map((p) => `${p.name}:${p.count}`).join('|') +
      `~${folded.length}`
    if (this._last.legend === signature) return
    this._last.legend = signature

    const wrap = this.$('.projects')
    wrap.innerHTML = ''
    for (const p of projects) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'repo'
      b.title = `${p.count} ${p.count === 1 ? 'tråd' : 'trådar'} i ${p.name}`
      b.setAttribute('aria-pressed', String(p.name === activeName))
      b.innerHTML =
        `<i class="swatch" style="background:${hex(p.accent)};color:${hex(p.accent)}"></i>` +
        `<span class="n">${escapeHtml(p.name)}</span>` +
        (p.urgent ? '<i class="alarm"></i>' : '') +
        `<span class="count">${p.count}</span>`
      b.addEventListener('click', () => this.actions.pickProject?.(p.name))
      wrap.appendChild(b)
    }
    this.$('.sec-head span').textContent = `${projects.length} ${projects.length === 1 ? 'tråd' : 'trådar'}`

    // The hidden list is its own block at the foot of the sidebar: collapsed by default, because
    // the whole point of hiding a repo is not to look at it.
    const block = this.$('.hidden-block')
    block.hidden = hidden.length === 0 && folded.length === 0
    const hiddenWrap = this.$('.hidden-projects')
    hiddenWrap.innerHTML = ''
    for (const p of hidden) {
      const accent = PLOT_PALETTE[hashString(p.name) % PLOT_PALETTE.length]
      const row = document.createElement('div')
      row.className = 'repo hidden-repo'
      row.innerHTML =
        `<i class="swatch" style="background:${hex(accent)};color:${hex(accent)}"></i>` +
        `<span class="n">${escapeHtml(p.name)}</span>` +
        `<span class="count">${p.count}</span>`
      const show = document.createElement('button')
      show.type = 'button'
      show.className = 'btn ghost show-repo'
      show.title = `Visa ${p.name} på kartan igen`
      show.textContent = 'Visa'
      show.addEventListener('click', () => this.actions.unhideProject?.(p.name))
      row.appendChild(show)
      hiddenWrap.appendChild(row)
    }

    // The dormant fold gets one line rather than a row each: it is a setting, not a list of
    // decisions, and the thing worth offering is the way back rather than per-repo control.
    if (folded.length) {
      const n = folded.reduce((sum, p) => sum + p.count, 0)
      const row = document.createElement('div')
      row.className = 'repo hidden-repo folded-note'
      row.innerHTML =
        `<span class="n">${folded.length} ${folded.length === 1 ? 'tyst tråd' : 'tysta trådar'}` +
        `, ${n} ${n === 1 ? 'samtal' : 'samtal'}</span>`
      const show = document.createElement('button')
      show.type = 'button'
      show.className = 'btn ghost show-repo'
      show.title = 'Lägg tillbaka sovande plättar på kartan'
      show.textContent = 'Visa'
      show.addEventListener('click', () => this.settings.set('hideDormant', false))
      row.appendChild(show)
      hiddenWrap.appendChild(row)
    }

    const total = hidden.length + folded.length
    this.$('#btn-hidden-toggle .label').textContent = `${total} off the map`
    this._syncHiddenList()
  }

  /**
   * Agenterna i panelen.
   *
   * Maskinparken visar hur de MÅR — lykta, ring, paket på kabeln. Men "vilken av de
   * fyrtioen heter vad och vad gör den" är en fråga för en lista, inte för en gård, och
   * fram till nu har svaret bara funnits på agenttavlan ute i kolonin. Här står de som
   * repolistan står: en rad var, grupperade per gård, och ett klick tar kameran dit.
   *
   * Hopfälld som förval. Fyrtioen rader ovanpå sju repon hade gjort sidopanelen till en
   * scroll i stället för en översikt — rubriken bär siffrorna som räcker på håll.
   */
  setMaskiner(lista, falt) {
    const rader = Array.isArray(lista) ? lista : []
    // Signaturen avgör om panelen ritas om. Den bar förut bara minuten för sista loggraden,
    // och då syntes aldrig en ny rad som kom inom samma minut. Nyaste radens tidsstämpel och
    // antalet rader ligger med nu.
    const signatur = rader
      .map((m) => `${m.namn}:${m.status}:${m.sistaLogg || 0}:${(m.logg || []).length}`)
      .join('|')
    if (this._last.maskiner === signatur) return
    this._last.maskiner = signatur

    const block = this.$('.agent-block')
    block.hidden = rader.length === 0
    this._maskinrutor = new Map()
    if (!rader.length) return

    const nu = Date.now()
    const arbetar = rader.filter((m) => m.status === 'ok' && m.sistaLogg && nu - m.sistaLogg < 5 * 60 * 1000).length
    const trasiga = rader.filter((m) => m.status === 'fel').length
    this.$('.agent-sum').textContent = trasiga
      ? `${rader.length} · ${arbetar} arbetar · ${trasiga} fel`
      : `${rader.length} · ${arbetar} arbetar`
    this.$('#btn-agents-toggle').classList.toggle('larm', trasiga > 0)

    const wrap = this.$('.agents')
    wrap.innerHTML = ''
    for (const f of falt || []) {
      const mina = rader.filter((m) => m.grupp === f.nyckel)
      if (!mina.length) continue
      const rubrik = document.createElement('div')
      rubrik.className = 'agent-gard'
      rubrik.innerHTML =
        `<i class="swatch" style="background:${hex(f.farg)};color:${hex(f.farg)}"></i>` +
        `<span>${escapeHtml(f.namn)}</span><span class="count">${mina.length}</span>`
      wrap.appendChild(rubrik)

      for (const m of mina) {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = `agent ${m.status}`
        const aktiv = m.status === 'ok' && m.sistaLogg && nu - m.sistaLogg < 5 * 60 * 1000
        b.title = m.detalj || m.namn
        b.innerHTML =
          `<i class="lampa${aktiv ? ' pa' : ''}"></i>` +
          `<span class="text">` +
          `<span class="n">${escapeHtml(m.namn.replace(/^nexus-/, ''))}</span>` +
          `<span class="jobb">${escapeHtml(m.jobb || statusOrd(m.status))}</span>` +
          `</span>` +
          `<span class="count">${m.status === 'ok' ? agentSedan(m.sistaLogg) : statusOrd(m.status)}</span>`
        wrap.appendChild(b)

        /**
         * MASKINENS EGEN RUTA I PANELEN (Filip 28 sep: "denna infon skulle man vilja se i
         * raden till höger samt kunna se att som boten har skrivit innan").
         *
         * Raden säger vem agenten är; den utfällda rutan säger vad den sagt. Läget (uppe
         * sedan, startar om, avslutade med kod) stod förut bara i webbläsarens tooltip, och
         * en uppgift som kräver att man håller musen still i en sekund är i praktiken osynlig
         * på en skärm i ett kök.
         *
         * TOM ÄR INTE SAMMA SAK SOM TYST. Saknas loggrader kan det bero på att agenten inte
         * skrivit något, att mätningen är gammal (då nollar servern listan med flit) eller
         * att den inte kör. Rutan säger vilket av dem det är i stället för att visa ingenting.
         */
        const ruta = document.createElement('div')
        ruta.className = 'agent-logg'
        ruta.hidden = true
        const rader = Array.isArray(m.logg) ? m.logg : []
        const huvud = `<div class="lage">${escapeHtml(m.detalj || statusOrd(m.status))}</div>`
        ruta.innerHTML =
          huvud +
          (rader.length
            ? rader
                .map(
                  (r) =>
                    `<div class="rad"><span class="t">${klockan(r.t)}</span>` +
                    `<span class="txt">${escapeHtml(r.rad)}</span></div>`
                )
                .join('')
            : `<div class="rad tom">${
                m.status === 'okand'
                  ? 'Ingen färsk mätning — kolonin vet inte vad den skrivit'
                  : m.status === 'ok'
                    ? 'Inget i loggen de senaste raderna'
                    : 'Kör inte, så det finns inget nytt att läsa'
              }</div>`)
        wrap.appendChild(ruta)

        this._maskinrutor.set(m.namn, { knapp: b, ruta })
        // Ett klick gör två saker med flit: flyger dit OCH fäller ut vad den sagt. Att behöva
        // två klick för "visa mig den här agenten" är ett klick för mycket.
        b.addEventListener('click', () => {
          this.actions.pickMaskin?.(m.namn)
          this.valjMaskin(m.namn, { flyg: false })
        })
      }
    }

    // Panelen ritas om var femtonde sekund. Utan det här stängdes den ruta Filip just öppnat
    // så fort en agent skrev en rad — en lista som slår igen av sig själv är obrukbar.
    if (this._oppenMaskin) {
      const igen = this._oppenMaskin
      this._oppenMaskin = ''
      this.valjMaskin(igen, { flyg: false })
    }
  }

  /**
   * Trådens text i panelen, inte bara i rutan över astronauten.
   *
   * Filip 28 sep, med en pil i skärmdumpen: kortet över astronauten säger vad Ledning vill,
   * men högerpanelen sa bara namn och klockslag. Man fick alltså klicka fram en ruta mitt i
   * scenen för att läsa det panelen hade plats för, och rutan ligger över kolonin och skymmer
   * just det man tittar på.
   *
   * Två delar: det som gäller nu (frågan om tråden vinkar, annars senaste rubriken), och vad
   * tråden skrivit förut. Faserna färgas som på tavlan, så att en rad går att läsa som
   * "började", "klart" eller "stoppat" utan att man läser ordet.
   */
  tradInfo(thread) {
    const ruta = this.$('.side .trad-info')
    if (!ruta) return
    if (!thread) {
      ruta.hidden = true
      ruta.innerHTML = ''
      this._skrivTrad = ''
      return
    }
    const trad = String(thread.id || '').split(':').pop()

    /**
     * ETT FLÖDE, INTE TRE LÅDOR (Filip 29 sep: "få in all text i flödet", och högerytan ska
     * vara till för att SE och KOMMUNICERA).
     *
     * Förut stod samma samtal i tre delar: det som gäller nu överst, "Du skrev" i mitten och
     * "Tidigare" under. Tre listor av samma sak i tidsordning är inte tre saker — det är ett
     * samtal som klippts isär. Nu ligger trådens rader och Filips svar i EN kronologisk
     * ström, äldst överst och nyast närmast skrivfältet, som i vilken chatt som helst. Det
     * som gäller nu behöver ingen egen ruta: det är sista repliken.
     *
     * Och rubriken räcker inte. Kortet ute i kolonin visade texten medan panelen bara visade
     * rubriken, så man klickade fram en ruta mitt i scenen för att läsa det panelen hade
     * plats för. Varje replik bär nu sin text.
     */
    if (!ruta.querySelector('.flode')) {
      ruta.innerHTML = '<div class="flode"></div><div class="skriv"></div>'
    }
    const flode = ruta.querySelector('.flode')

    const repliker = byggFlode(thread.historik, thread.franFilip)

    // Nederst i listan står det senaste. Skrivs en ny rad ska strömmen följa med dit, men
    // bara om man redan stod längst ner — annars rycks man ur det man håller på att läsa.
    const vidBotten = flode.scrollHeight - flode.scrollTop - flode.clientHeight < 40
    flode.innerHTML = repliker.length
      ? repliker
          .map((r) => {
            if (r.avdelare) return `<div class="dag">${escapeHtml(r.avdelare)}</div>`
            const kropp = r.text && r.text !== r.rubrik ? `<div class="txt">${lankifiera(r.text)}</div>` : ''
            const rub = r.rubrik ? `<div class="rub">${lankifiera(r.rubrik)}</div>` : ''
            const meta = [r.min ? 'Du' : thread.title || trad, klockan(r.nar), r.langd, LAGE[r.fas] || '']
              .filter(Boolean)
              .map((x) => `<span>${escapeHtml(x)}</span>`)
              .join('')
            const mer = kropp && (r.text || '').length > 150 ? `<div class="mer">Visa mer</div>` : ''
            return `<div class="replik ${r.min ? 'min' : escapeHtml(r.fas)}"><div class="topp">${meta}</div>${rub}${kropp}${mer}</div>`
          })
          .join('')
      : `<div class="replik tom"><div class="txt">Inget skrivet än</div></div>`
    if (vidBotten) flode.scrollTop = flode.scrollHeight
    // Klick fäller ut en replik. Lyssnaren sitter på listan och inte på varje rad, för listan
    // ritas om var femtonde sekund och femtio lyssnare per omritning läcker tills fliken dör.
    if (!flode.dataset.klick) {
      flode.dataset.klick = '1'
      flode.addEventListener('click', (e) => {
        const r = e.target.closest('.replik')
        if (!r) return
        const ut = r.classList.toggle('oppen')
        const mer = r.querySelector('.mer')
        if (mer) mer.textContent = ut ? 'Visa mindre' : 'Visa mer'
      })
    }

    if (this._skrivTrad !== trad) {
      this._skrivTrad = trad
      flode.scrollTop = flode.scrollHeight
      const skriv = ruta.querySelector('.skriv')
      skriv.innerHTML =
        `<textarea class="svar" rows="2" maxlength="1200" ` +
        `placeholder="Skriv till ${escapeHtml(thread.title || trad)} …"></textarea>` +
        `<div class="rad"><span class="hint"></span>` +
        `<button type="button" class="btn skicka">Skicka</button></div>`
      const falt = skriv.querySelector('textarea')
      const knapp = skriv.querySelector('.skicka')
      const hint = skriv.querySelector('.hint')
      const skicka = async () => {
        const txt = falt.value.trim()
        if (!txt) return
        knapp.disabled = true
        hint.textContent = 'Skickar …'
        const svar = await this.actions.skickaSvar?.(trad, txt)
        knapp.disabled = false
        if (svar?.ok) {
          falt.value = ''
          // Raden hinner inte fram till nästa poll, så kvittot får komma från svaret.
          hint.textContent = `Ligger på tavlan som rad ${svar.id || '—'}`
        } else {
          hint.textContent = svar?.fel || 'Kom inte fram'
        }
      }
      knapp.addEventListener('click', skicka)
      // Cmd/Ctrl+Enter skickar. Enter ensamt gör radbrytning — ett meddelande till en tråd är
      // oftare två meningar än en, och en knapp som skickar halva tanken är värre än ett klick.
      falt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          skicka()
        }
        e.stopPropagation()
      })
    }
    ruta.hidden = false
  }

  /**
   * Öppna en maskins ruta i panelen, och stäng den som var öppen.
   *
   * Finns för att scenen ska kunna peka på samma rad som panelen: klickar man en robot ute i
   * parken ska raden till höger fällas ut, inte bara kameran flytta sig. Anropet tål ett namn
   * som inte finns i listan (en container kan ha försvunnit mellan två mätningar) — då händer
   * ingenting, hellre än att panelen scrollar till ett tomrum.
   */
  valjMaskin(namn, { flyg = true } = {}) {
    const post = this._maskinrutor?.get(namn)
    if (!post) return false
    const redanOppen = this._oppenMaskin === namn && !post.ruta.hidden
    for (const [n, p] of this._maskinrutor) {
      p.ruta.hidden = true
      p.knapp.classList.toggle('vald', false)
      void n
    }
    if (redanOppen) {
      this._oppenMaskin = ''
      return true
    }
    // Agentsektionen är hopfälld som förval; en rad som öppnas bakom en fälld rubrik är en
    // rad ingen ser.
    const block = this.$('.agent-block')
    if (block?.classList.contains('fald')) block.classList.remove('fald')
    const detaljer = block?.querySelector('details')
    if (detaljer) detaljer.open = true
    post.ruta.hidden = false
    post.knapp.classList.add('vald')
    this._oppenMaskin = namn
    post.knapp.scrollIntoView({ block: 'nearest' })
    if (flyg) this.actions.pickMaskin?.(namn)
    return true
  }

  /**
   * Trädets karta.
   *
   * Ett träd går inte att skanna av som en koloni — bona sitter på olika grenar, på olika
   * höjd, bakom varandra. Listan ÄR överblicken: utsikterna först, sedan ett bo per tråd med
   * vad tråden gör just nu, och ett klick tar kameran dit.
   */
  setTrad(data) {
    const utsikter = data?.utsikter || []
    const bon = data?.bon || []
    const block = this.$('.trad-block')
    block.hidden = !utsikter.length && !bon.length
    if (block.hidden) return

    const nyckel =
      utsikter.map((u) => u.namn).join('|') +
      '~' +
      bon.map((b) => `${b.id}:${b.lage}:${b.rader}:${b.ungar}:${b.skatter}`).join('|')
    if (this._last.trad === nyckel) return
    this._last.trad = nyckel

    const uWrap = this.$('.trad-utsikter')
    uWrap.innerHTML = ''
    for (const u of utsikter) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'trad-vy'
      b.textContent = u.namn
      b.addEventListener('click', () => this.actions.flygTill?.(u.namn))
      uWrap.appendChild(b)
    }

    const bWrap = this.$('.trad-bon')
    bWrap.innerHTML = ''
    for (const bo of bon) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'repo'
      b.title = `Flyg till ${bo.namn}s bo`
      b.innerHTML =
        `<i class="swatch" style="background:${hex(bo.farg)};color:${hex(bo.farg)}"></i>` +
        `<span class="n">${escapeHtml(bo.namn)}</span>` +
        `<span class="lage ${bo.lage}">${lageOrd(bo.lage)}${bo.skatter > 0 ? ` (${bo.skatter})` : ''}</span>`
      b.addEventListener('click', () => this.actions.flygTill?.(bo.id))
      bWrap.appendChild(b)
    }
  }

  toggleAgentList() {
    const knapp = this.$('#btn-agents-toggle')
    const oppen = knapp.getAttribute('aria-expanded') === 'true'
    knapp.setAttribute('aria-expanded', String(!oppen))
    this.$('.agents').hidden = oppen
  }

  toggleHiddenList() {
    this.hiddenOpen = !this.hiddenOpen
    this._syncHiddenList()
  }

  _syncHiddenList() {
    this.$('#btn-hidden-toggle').setAttribute('aria-expanded', String(this.hiddenOpen))
    this.$('.hidden-projects').hidden = !this.hiddenOpen
  }

  /**
   * The project sidebar: what a zone is, and the things you can do to the *repo* rather
   * than to one thread in it. Opened by clicking a zone, its name plate, its legend chip,
   * or any astronaut standing on it.
   */
  setProject(project) {
    const panel = this.$('.side')
    if (!project) {
      this.project = null
      if (this._last.project === null) return
      this._last.project = null
      panel.classList.remove('drilled')
      return
    }

    this.project = project
    // The minute is part of the signature because `ago()` is: without it a repo where
    // nothing is happening keeps whatever "4m ago" it was first drawn with, for as long as
    // you leave the panel open.
    const signature =
      `${project.name}~${project.path}~${project.accent}~${project.selectedId}~${Math.floor(Date.now() / 60000)}~` +
      project.threads.map((t) => `${t.id}:${t.status}:${t.title}:${t.lastActivityAt}`).join('|')
    panel.classList.add('drilled')
    if (this._last.project === signature) return
    this._last.project = signature

    const swatch = this.$('.side .who .swatch')
    swatch.style.background = hex(project.accent)
    swatch.style.color = hex(project.accent) // the halo is `currentColor`
    this.$('.side .name').textContent = project.name
    const path = this.$('.side .path')
    // "okänd mapp" stod under varje trådnamn och var sant men meningslöst: en Roost-tråd ÄR
    // inget på en disk. Repot säger var den arbetar, och det är det enda som betyder något.
    const repo = project.worktree || project.threads?.[0]?.worktree || ''
    path.textContent = repo
    path.hidden = !repo
    path.title = ''

    const n = project.threads.length
    const waiting = project.threads.filter((t) => t.status === 'waiting' || t.status === 'blocked').length
    /**
     * EN PLÄTT MED EN TRÅD BEHÖVER INGEN LISTA. Roost har en tomt per tråd (beslutet 15 sep),
     * så listan innehöll nästan alltid exakt en rad — med samma namn och samma klockslag som
     * rubriken tre rader ovanför. Den åt en tredjedel av panelen för att upprepa sig själv.
     * Finns det flera trådar på plätten är listan fortfarande det som skiljer dem åt.
     */
    const ensam = n <= 1
    this.$('.side .threads-head').hidden = ensam
    this.$('.side .threads').hidden = ensam
    this.$('.side .threads-head').innerHTML =
      `<span>${n} ${n === 1 ? 'tråd' : 'trådar'}</span>` + (waiting ? `<span class="want">${waiting} vill dig</span>` : '')

    const list = this.$('.side .threads')
    // A poll rewrites these rows every time a live thread's timestamp moves. Losing your
    // place in a forty-thread repo every fifteen seconds would make the list unusable.
    const scroll = list.scrollTop
    list.innerHTML = ''
    for (const t of project.threads) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `thread ${statusClass(t.status)}`
      b.setAttribute('aria-pressed', String(t.id === project.selectedId))
      b.title = STATUS_LABEL[t.status] || t.status
      b.innerHTML =
        '<i class="pip"></i>' +
        `<span class="t">${escapeHtml(t.title || 'Namnlös tråd')}</span>` +
        `<span class="when">${ago(t.lastActivityAt)}</span>` +
        (t.worktree ? `<span class="wt">⑂ ${escapeHtml(t.worktree)}</span>` : '')
      b.addEventListener('click', () => this.actions.focusThread?.(t.id))
      list.appendChild(b)
      // A long repo can hide the astronaut you just clicked in the world. Scrolled by hand
      // rather than with `scrollIntoView`, which walks up the ancestors and will happily
      // scroll the *page* — and a page that can scroll at all is one keystroke away from
      // the whole HUD sitting sideways with nothing to put it back.
      if (t.id === project.selectedId && this._scrolledTo !== t.id) {
        this._scrolledTo = t.id
        const row = b
        requestAnimationFrame(() => {
          const top = row.offsetTop
          const bottom = top + row.offsetHeight
          if (top < list.scrollTop) list.scrollTop = top
          else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
        })
      }
    }
    list.scrollTop = scroll
    if (!project.selectedId) this._scrolledTo = null
  }

  /**
   * The selected thread, shown inside the zone sidebar rather than in a panel of its own —
   * one thread and its repo are the same context, and splitting them across the screen made
   * you look in two places to act on one astronaut.
   */
  setSelection(agent, thread) {
    const card = this.$('.thread-pop')
    if (!agent || !thread) {
      card.classList.remove('on')
      this.tradInfo(null)
      this.selected = null
      return
    }
    this.selected = { agent, thread }
    card.classList.add('on')

    this.tradInfo(thread)
    this.$('.thread-pop .title').textContent = thread.title || 'Namnlös tråd'
    const status = STATUS_LABEL[agent.status] || agent.status
    const meta = this.$('.thread-pop .meta')
    const bits = [
      `<span class="tag"><i class="swatch" style="background:${hex(agent.trim.getHex())}"></i>${escapeHtml(status)}</span>`,
    ]
    // The repo is the panel's own heading now, so the card says what the *thread* is.
    if (thread.worktree) bits.push(`<span class="tag">⑂ ${escapeHtml(thread.worktree)}</span>`)
    if (thread.gitBranch) bits.push(`<span class="tag">${escapeHtml(thread.gitBranch)}</span>`)
    if (thread.model) bits.push(`<span class="tag">${escapeHtml(shortModel(thread.model))}</span>`)
    bits.push(`<span>${ago(thread.lastActivityAt)}</span>`)
    meta.innerHTML = bits.join('')

    // Raden under mätaren: frågan när tråden vinkar, annars det den senast skrev.
    const rad = this.$('.thread-pop .rad')
    const text = thread.notis ? `${thread.notis}${thread.notisText ? ` — ${thread.notisText}` : ''}` : thread.preview || ''
    rad.innerHTML = lankifiera(text)
    rad.classList.toggle('vantar', Boolean(thread.notis))
    rad.hidden = !text

    const pct = Math.round((this.actions.progressFor?.(thread.id) ?? 0) * 100)
    this.$('.thread-pop .progress > i').style.width = `${pct}%`
    this.$('.thread-pop .progress > i').style.background = hex(agent.trim.getHex())
    // Measured once per selection rather than per frame: placing the card beside its
    // astronaut needs its size sixty times a second, and asking the layout for it that
    // often is how a HUD starts costing frames.
    this._cardSize = { w: card.offsetWidth, h: card.offsetHeight }
    this.$('#btn-open').disabled = thread.canOpen === false
    // Only offered when there is something to dismiss. A third button on every card would
    // crowd the two that are always worth having, and "Viewed" on a thread that is not asking
    // for anything is a control with no effect.
    this.$('#btn-viewed').hidden = !thread.unread
    this.$('#btn-pass-pausa').textContent = this.actions.arPausad?.(thread.id) ? 'Återuppta' : 'Pausa'
    // Knapparna hör till Roost-trådar (id roost-loggbok:<tråd>) och syns inte i köksläget.
    this.$('.thread-pop .pass').hidden = !thread.id?.startsWith('roost-loggbok:') || this.actions.kiosk
    this.visaKo(thread)
  }

  /** Kön under raden: hämtas en gång per val, och bara om svaret hör till samma tråd när det kommer. */
  async visaKo(thread) {
    const ko = this.$('.thread-pop .ko')
    const trad = thread.id?.startsWith('roost-loggbok:') ? thread.id.replace(/^roost-loggbok:/, '') : null
    ko.hidden = true
    if (!trad || !this.actions.hamtaKo) return
    const s = koSammanfattning(await this.actions.hamtaKo(trad))
    if (!s || this.selected?.thread?.id !== thread.id) return
    const rad = (r) => `<li><b class="p${r.prio[1]}">${r.prio}</b> ${escapeHtml(r.text)}<i>${escapeHtml(r.alder)}</i></li>`
    const lista = this.$('.thread-pop .ko-lista')
    const knapp = this.$('.thread-pop .ko-rubrik')
    knapp.textContent = s.antal === 0 ? 'Kön är tom' : `Kö: ${s.antal} öppna`
    const rita = (alla) => { lista.innerHTML = (alla ? s.alla : s.topp).map(rad).join('') }
    let alla = false
    rita(alla)
    knapp.onclick = () => { alla = !alla; rita(alla) }
    ko.hidden = false
    this._cardSize = { w: this.$('.thread-pop').offsetWidth, h: this.$('.thread-pop').offsetHeight }
  }

  /**
   * Put the thread card beside its own astronaut, in screen space, every frame.
   *
   * `screen` is where the astronaut is right now, in CSS pixels, or null when it is behind
   * the camera. The card prefers the astronaut's right, flips to its left rather than slide
   * under the sidebar, and never leaves the window — so it stays reachable at any zoom
   * without ever covering the thing it is describing.
   */
  placeCard(screen) {
    const el = this.$('.thread-pop')
    if (!screen || !this.selected) {
      if (this._cardOn) {
        this._cardOn = false
        el.classList.remove('on')
      }
      return
    }
    const size = this._cardSize || { w: 280, h: 150 }
    const margin = 12
    const gap = 26
    const rightWall = window.innerWidth - margin - (this._sideWidth || 0)

    let flip = false
    let left = screen.x + gap
    if (left + size.w > rightWall) {
      left = screen.x - gap - size.w
      flip = true
      // Nowhere to go on either side — sit over the middle rather than off the edge.
      if (left < margin) left = Math.min(Math.max(margin, screen.x - size.w / 2), rightWall - size.w)
    }
    const top = Math.min(Math.max(margin, screen.y - size.h / 2), window.innerHeight - margin - size.h)

    if (!this._cardOn) {
      this._cardOn = true
      el.classList.add('on')
    }
    // Whole pixels, and only when it actually moved: a transform written every frame with a
    // fractional delta is a repaint the compositor cannot skip.
    const x = Math.round(left)
    const y = Math.round(top)
    if (x !== this._cardX || y !== this._cardY) {
      this._cardX = x
      this._cardY = y
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }
    // The nib points back at the astronaut, so it changes sides with the card.
    if (flip !== this._cardFlip) {
      this._cardFlip = flip
      el.classList.toggle('flip', flip)
    }
    // And it tracks the astronaut vertically when the card has been pushed off-centre.
    const nib = Math.min(Math.max(14, screen.y - y), size.h - 14)
    if (nib !== this._cardNib) {
      this._cardNib = nib
      el.style.setProperty('--nib-y', `${Math.round(nib)}px`)
    }
  }

  /** How much of the right-hand edge the sidebar is taking, so the card can avoid it. */
  setSideWidth(px) {
    this._sideWidth = px
  }

  /** Redraw the card's face so it blinks in step with the astronaut it belongs to. */
  updateAvatar(faceAtlasCanvas) {
    if (!this.selected || !faceAtlasCanvas) return
    const agent = this.selected.agent
    const frame = agent.faceFrame ?? FACE.idle
    const color = agent.eye
    const css = cssFromGlow(color)
    if (this._avatarState.frame === frame && this._avatarState.color === css) return
    this._avatarState = { frame, color: css }

    const size = 108
    const cell = faceAtlasCanvas.width / FRAME_COLS
    const sx = (frame % FRAME_COLS) * cell
    const sy = Math.floor(frame / FRAME_COLS) * (faceAtlasCanvas.height / FRAME_ROWS)

    // The atlas is an opaque white-on-black mask, so the tint is a `multiply`, not a
    // `source-in`: black stays black and the white features take the eye colour. Keying on
    // alpha instead would flood the whole cell, because every pixel in it is opaque.
    const t = this.avatarTmpCtx
    t.globalCompositeOperation = 'source-over'
    t.clearRect(0, 0, size, size)
    t.drawImage(faceAtlasCanvas, sx, sy, cell, cell, 0, 0, size, size)
    t.globalCompositeOperation = 'multiply'
    t.fillStyle = css
    t.fillRect(0, 0, size, size)
    t.globalCompositeOperation = 'source-over'

    const c = this.avatarCtx
    c.fillStyle = '#06070c'
    c.fillRect(0, 0, size, size)
    c.drawImage(this.avatarTmp, 0, 0)
    // Scanlines, so the card's face reads as the same little screen as the one in the world.
    c.globalAlpha = 0.2
    c.fillStyle = '#000'
    for (let y = 0; y < size; y += 3) c.fillRect(0, y, size, 1)
    c.globalAlpha = 1
  }

  setFps(perf, viewport, extra) {
    if (!this.settings.get('showFps')) return
    const el = this.$('.fps')
    const fps = Math.round(perf.fps)
    if (this._last.fps === fps && this._last.calls === perf.drawCalls) return
    this._last.fps = fps
    this._last.calls = perf.drawCalls
    el.innerHTML =
      `<b>${fps}</b> fps · ${perf.frameMs.toFixed(1)} ms<br>` +
      `${perf.drawCalls} draws · ${(perf.triangles / 1000).toFixed(0)}k tris<br>` +
      // The setting is a share of the display, so the readout is too — otherwise a retina
      // machine sitting exactly on the 100% slider reads back "200%".
      `${viewport.bw}×${viewport.bh} (${Math.round((viewport.scale / (window.devicePixelRatio || 1)) * 100)}%)` +
      (extra ? `<br>${extra}` : '')
  }

  hint(text, ms = 3200) {
    const el = this.$('.hint-pill')
    el.textContent = text
    el.classList.add('on')
    clearTimeout(this._hintTimer)
    this._hintTimer = setTimeout(() => el.classList.remove('on'), ms)
  }

  /**
   * Gör själv-korten (rad 1847 p.3): det som väntar på Filips händer, med Klart / Fråga / Senare.
   * Ritas om vid varje poll; tom lista släcker panelen. Inte i köksläget — skärmen där är
   * ingens händer.
   */
  visaGorSjalv(kort) {
    const box = this.$('.gorsjalv')
    if (!box) return
    const lista = this.actions.kiosk ? [] : kort || []
    box.hidden = lista.length === 0
    box.innerHTML = lista.length
      ? `<h3>Gör själv · ${lista.length}</h3>` +
        lista
          .map(
            (k, i) => `<div class="gs-kort${k.fokus ? ' fokus' : ''}" data-i="${i}"><div class="gs-titel">${lankifiera(k.titel || k.rubrik)}</div>
      <div class="gs-rad"><button class="btn primary" data-v="klart">Klart</button><button class="btn" data-v="fraga">Fråga</button><button class="btn" data-v="senare">Senare</button></div></div>`
          )
          .join('')
      : ''
    box.onclick = (e) => {
      const knapp = e.target.closest('button[data-v]')
      const k = knapp && lista[Number(knapp.closest('.gs-kort').dataset.i)]
      if (!k) return
      if (knapp.dataset.v === 'fraga') {
        navigator.clipboard?.writeText(fragaText(k)).catch(() => {})
        window.open(fragaUrl(k), '_blank', 'noopener,noreferrer')
        this.toast('Frågan är kopierad — klistra in i chatten')
      } else this.actions.gorSjalv?.(knapp.dataset.v, k)
    }
  }

  toast(message, kind = '') {
    const el = document.createElement('div')
    el.className = `toast panel ${kind}`
    el.textContent = message
    this.$('.toasts').appendChild(el)
    setTimeout(() => {
      el.classList.add('leaving')
      setTimeout(() => el.remove(), 260)
    }, 3600)
  }

  // ── visibility ──────────────────────────────────────────────────────────────────────

  /** Reflect orbit mode on the rail button. */
  setOrbit(on) {
    this.$('#btn-orbit').setAttribute('aria-pressed', String(Boolean(on)))
  }

  toggleSettings(force) {
    const panel = this.$('.settings')
    const open = force ?? panel.classList.contains('closed')
    panel.classList.toggle('closed', !open)
    this.$('#btn-settings').setAttribute('aria-pressed', String(open))
    // Both live in the same slot on the right; the sidebar steps aside rather than hides.
    this.$('.side').classList.toggle('shifted', open)
  }

  toggleHelp(force) {
    const el = this.$('.help')
    const open = force ?? !el.classList.contains('open')
    el.classList.toggle('open', open)
  }

  /**
   * Dismiss everything. This is the mode the game is really meant to be left in — the
   * colony carries its own state above the astronauts' heads, so the panels are for
   * setting things up, not for playing.
   */
  toggleUi(force) {
    this.visible = force ?? !this.visible
    this.el.classList.toggle('hidden', !this.visible)
    this.$('#btn-hide').innerHTML = this.visible ? ICON.eye : ICON.eyeOff
    this.actions.uiVisibility?.(this.visible)
    if (!this.visible) this.toggleHelp(false)
    return this.visible
  }

  removeBoot() {
    const boot = document.querySelector('.boot')
    if (!boot) return
    boot.classList.add('gone')
    setTimeout(() => boot.remove(), 550)
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────────────

function group(title, child) {
  const el = document.createElement('div')
  el.className = 'group'
  el.innerHTML = `<h3>${title}</h3>`
  if (child) el.appendChild(child)
  return el
}

function chips(items, current, onPick, registry) {
  const wrap = document.createElement('div')
  wrap.className = 'chips'
  const buttons = []
  for (const item of items) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip'
    b.textContent = item.label
    if (item.title) b.title = item.title
    b.addEventListener('click', () => onPick(item.id))
    wrap.appendChild(b)
    buttons.push([item.id, b])
  }
  registry.push({
    el: wrap,
    sync: () => {
      const now = current()
      for (const [id, b] of buttons) b.setAttribute('aria-pressed', String(id === now))
    },
  })
  return wrap
}

const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6)
/**
 * Eye colours are authored above 1.0 so the bloom pass catches them in the scene. For the
 * card they are normalised by the brightest channel — which keeps the hue the astronaut
 * actually has rather than clipping a 3.0-red down to the same white as a 3.0-blue.
 */
function cssFromGlow(color) {
  const peak = Math.max(color.r, color.g, color.b, 1)
  const enc = (v) => Math.round(Math.pow(Math.min(1, v / peak), 1 / 2.2) * 255)
  return `rgb(${enc(color.r)},${enc(color.g)},${enc(color.b)})`
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/** Status → the colour family the top-bar counters already use for it. */
function statusClass(status) {
  if (status === 'working') return 'working'
  if (status === 'waiting') return 'waiting'
  if (status === 'blocked') return 'blocked'
  if (status === 'celebrating') return 'done'
  return 'idle'
}

/**
 * A path that fits, trimmed from the *left* so the repo end survives — the deep end is the
 * part that identifies it. CSS can only ellipsise the tail, and `direction: rtl` mangles a
 * leading `~`, so the trim is done here and the whole path lives in the title attribute.
 */
function shortPath(dir, max = 30) {
  const home = dir.replace(/^\/Users\/[^/]+/, '~')
  if (home.length <= max) return home
  const parts = home.split('/')
  let out = parts.pop() || ''
  while (parts.length) {
    const next = parts.pop()
    if (out.length + next.length + 3 > max) break
    out = `${next}/${out}`
  }
  return `…/${out}`
}

function shortModel(model) {
  return String(model).replace(/^claude-/, '').replace(/-\d{8}$/, '')
}

function clockLabel(t) {
  const total = t * 24 * 60
  const h = Math.floor(total / 60) % 24
  const m = Math.floor(total % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function nearestTime(value) {
  let best = TIMES[0]
  let bestD = Infinity
  for (const t of TIMES) {
    // Wrap-aware, so 0.99 is nearest to dawn rather than to noon.
    const d = Math.min(Math.abs(t.value - value), 1 - Math.abs(t.value - value))
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  return bestD < 0.03 ? best.id : null
}

/** Fågelns läge i ett ord, för trädets karta. */
/**
 * Sysslan i ord.
 *
 * Panelen är den överblick Filip bad om — "bra att se alla fåglar samtidigt eller iaf i en
 * överblick". En fågel kan vara skymd av ett löv för stunden; raden här kan inte. Orden är
 * desamma som `sysslor.js` använder, för en tråd ska inte heta en sak i bilden och en annan
 * i listan.
 */
function lageOrd(lage) {
  return (
    {
      larmar: 'larmar',
      ruvar: 'ruvar åt dig',
      sjunger: 'vill dig',
      matar: 'matar ungarna',
      bygger: 'bygger boet',
      pysslar: 'pysslar',
      sover: 'sover',
    }[lage] || lage
  )
}

/** Statusen på svenska — samma ord som resten av kolonin använder. */
/** Klockslag utan datum: loggrader läses i förhållande till nu, inte till en kalender. */
function klockan(ts) {
  if (!ts) return '--:--'
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Vad en fas heter i ett samtal. "borjar" och "klart" är tavlans ord, inte svenska. */
const LAGE = { pagar: 'pågår', klart: 'klart', stoppat: 'stoppat', notis: '' }

function statusOrd(status) {
  if (status === 'fel') return 'fel'
  if (status === 'nere') return 'nere'
  if (status === 'okand') return 'okänd'
  return 'kör'
}

/** Kort tid sedan, för agentraderna. */
function agentSedan(ts) {
  if (!ts) return '—'
  const min = Math.round((Date.now() - ts) / 60000)
  if (min < 1) return 'nu'
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`
}

function ago(ts) {
  if (!ts) return 'never'
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return 'nyss'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const TEMPLATE = `
<aside class="side panel">
  <header class="brandbar">
    <div class="brand"><i class="dot"></i>Roostie</div>
    <button class="btn icon ghost" id="btn-shot" title="Skärmbild (P)">${ICON.camera}</button>
    <button class="btn icon ghost" id="btn-help" title="Visa rundturen igen" aria-label="Visa rundturen igen">${ICON.help}</button>
    <button class="btn icon ghost" id="btn-hide" title="Göm allt (H)">${ICON.eye}</button>
    <button class="btn icon ghost" id="btn-settings" title="Inställningar (S)" aria-pressed="false">${ICON.settings}</button>
  </header>

  <div class="stats"></div>

  <div class="side-body">
    <div class="projects-pane">
      <div class="sec-head"><span>Trådar</span></div>
      <div class="trad-block" hidden>
        <div class="sec-head"><span>Trädet</span><span class="trad-hint">klicka för att flyga dit</span></div>
        <div class="trad-utsikter"></div>
        <div class="sec-head"><span>Bona</span></div>
        <div class="trad-bon"></div>
      </div>
      <div class="projects"></div>
      <div class="agent-block" hidden>
        <button type="button" class="agent-toggle" id="btn-agents-toggle" aria-expanded="false">
          <span class="label">Agenterna</span>
          <span class="agent-sum"></span>
        </button>
        <div class="agents" hidden></div>
      </div>
      <div class="hidden-block" hidden>
        <button type="button" class="hidden-toggle" id="btn-hidden-toggle" aria-expanded="false">
          <span class="label">0 gömda</span>
        </button>
        <div class="hidden-projects" hidden></div>
      </div>
    </div>

    <div class="project-detail">
      <button class="btn ghost back" id="btn-close-project" title="Tillbaka till alla trådar (Esc)">${ICON.back} Alla trådar</button>
      <div class="who">
        <i class="swatch"></i>
        <div class="text">
          <div class="name"></div>
          <div class="path"></div>
        </div>
        <button class="btn icon ghost" id="btn-locate" title="Flyg hit">${ICON.locate}</button>
      </div>
      <!--
        DE FYRA KNAPPARNA ÄR BORTA (Filip 29 sep: "ta bort"), och tre av dem kunde aldrig
        göra något här. Mätt, inte tyckt:
          Nytt samtal   — vår harness svarar alltid { ok:false, "Roost-trådar startas i
                          claude.ai, inte i kolonin" }. Knappen var en garanterad felruta.
          Finder        — projectPath är tom för ALLA åtta trådar. Det finns ingen mapp.
          Kopiera sökväg— samma tomma sträng. Den kopierade ingenting.
          Göm i kolonin — den enda som fungerade, men den är en inställning man rör en gång
                          i halvåret, inte en av fyra knappar högst upp i en kommunikationsyta.

        De kommer från bot-crossing, där en tråd ÄR en CLI-session i en mapp på samma maskin.
        Våra trådar är samtal i molnet. Att låta knapparna stå kvar var att lova något
        gränssnittet inte kan hålla. Att öppna samtalet finns kvar där det hör hemma: på
        kortet ute i kolonin, och som ikonen bredvid namnet här.
      -->
      <div class="project-actions">
        <button class="btn icon ghost" id="btn-hide-project" title="Göm plätten i kolonin — arkiverar inga trådar">${ICON.eyeOff}</button>
      </div>
      <div class="threads-head"></div>
      <div class="threads"></div>
      <div class="trad-info" hidden></div>
    </div>
  </div>
</aside>

<div class="rail panel">
  <button class="btn icon" id="btn-home" title="Nollställ vyn (0)">${ICON.home}</button>
  <button class="btn icon" id="btn-next" title="Nästa som väntar på dig (N)">${ICON.next}</button>
  <div class="sep"></div>
  <button class="btn icon" id="btn-orbit" title="Kamerabana runt kolonin (O)" aria-pressed="false">${ICON.orbit}</button>
  <button class="btn icon" id="btn-planet" title="Byt planet (Tab)">${ICON.globe}</button>
  <button class="btn icon" id="btn-time" title="Byt tid på dygnet (L)">${ICON.sun}</button>
</div>

<div class="settings panel closed">
  <header>Inställningar <button class="btn icon ghost" id="btn-close-settings" title="Stäng">${ICON.close}</button></header>
  <div class="body"></div>
</div>

<div class="thread-pop panel">
  <i class="nib"></i>
  <div class="top">
    <div class="avatar"><canvas></canvas></div>
    <div class="info">
      <div class="title"></div>
      <div class="meta"></div>
    </div>
    <button class="btn icon ghost" id="btn-deselect" title="Avmarkera (Esc)">${ICON.close}</button>
  </div>
  <div class="progress"><i></i></div>
  <!-- Vad tråden senast skrev på tavlan, och framför allt vad den ber om när den håller upp
       handen: ett ? man måste öppna chatten för att förstå är bara en prick. -->
  <div class="rad"></div>
  <!-- Kön (rad 1850): antal öppna rader + topp 3, tryck → hela kön. Tom om Sajts API inte svarar. -->
  <div class="ko" hidden>
    <button class="ko-rubrik" type="button"></button>
    <ol class="ko-lista"></ol>
  </div>
  <!-- Passtyrning (rad 1882): bara i admin-läge, aldrig i köksläget. -->
  <div class="pass" hidden>
    <button class="btn" id="btn-pass-starta" title="Starta ett pass för tråden nu — inom 5 minuter">Starta nu</button>
    <button class="btn" id="btn-pass-pausa" title="Pausa trådens pass">Pausa</button>
    <button class="btn" id="btn-pass-budget" title="Hur många pass tråden får köra per dag">Budget</button>
    <button class="btn" id="btn-pass-natt" title="Nattläge för alla trådar">Nattläge</button>
  </div>
  <div class="pair">
    <button class="btn primary" id="btn-open" title="Open this thread in the harness it came from (Enter)">${ICON.open} Open</button>
    <button class="btn" id="btn-viewed" title="Sluta be om dig tills tråden gjort något nytt (V)">${ICON.eye} Sedd</button>
    <button class="btn" id="btn-archive" title="Arkivera — astronauten går tillbaka till skeppet (A)">${ICON.archive} Arkivera</button>
  </div>
</div>

<div class="gorsjalv panel" hidden></div>
<div class="toasts"></div>
<div class="fps panel"></div>
<div class="hint-pill panel"></div>

<div class="help">
  <div class="sheet panel">
    <h2>Roostie</h2>
    <p class="sub">Varje tråd i Roost är en astronaut i kolonin och en fågel i trädet. Klicka på en för att öppna dess samtal; klicka på en plätt — däcket eller namnet — för repot självt. Göm en plätt du inte vill se, så ligger dess trådar kvar i Loggboken och går att ta fram igen ur listan. Navigeringen fungerar som Google Earth: dra i marken, högerdra för att luta, rulla för att zooma mot det som ligger under pekaren. <code>?varld=trad</code> byter till trädet och <code>?kiosk=1</code> till köksläget.</p>
    <div class="cols">
      <div>
        <div class="k"><span>Dra i marken</span><kbd>dra</kbd></div>
        <div class="k"><span>Luta och vrid</span><kbd>högerdra</kbd></div>
        <div class="k"><span>&nbsp;</span><kbd>⌃ or ⇧ + drag</kbd></div>
        <div class="k"><span>Zooma mot pekaren</span><kbd>rulla</kbd></div>
        <div class="k"><span>Flytta och zooma</span><kbd>piltangenter</kbd> <kbd>+ −</kbd></div>
        <div class="k"><span>Nollställ vyn</span><kbd>0</kbd></div>
        <div class="k"><span>Göm allt</span><kbd>H</kbd> <kbd>${IS_MAC ? '⌘' : 'Ctrl'}\\</kbd></div>
        <div class="k"><span>Inställningar</span><kbd>S</kbd></div>
        <div class="k"><span>Skärmbild</span><kbd>P</kbd></div>
      </div>
      <div>
        <div class="k"><span>Nästa som vill dig</span><kbd>N</kbd></div>
        <div class="k"><span>Öppna tråden</span><kbd>Enter</kbd></div>
        <div class="k"><span>Markera sedd</span><kbd>V</kbd></div>
        <div class="k"><span>Arkivera</span><kbd>A</kbd></div>
        <div class="k"><span>Nytt samtal</span><kbd>C</kbd></div>
        <div class="k"><span>Kamerabana</span><kbd>O</kbd></div>
        <div class="k"><span>Byt planet</span><kbd>Tab</kbd></div>
        <div class="k"><span>Tid på dygnet</span><kbd>L</kbd></div>
        <div class="k"><span>Avmarkera</span><kbd>Esc</kbd></div>
        <div class="k"><span>Det här bladet</span><kbd>?</kbd></div>
      </div>
    </div>
    <div style="margin-top:16px">
      <div class="legend-row"><i class="badge" style="background:#1a2b46;color:#8fb4ee">?</i> väntar på ditt svar — klicka för att öppna tråden</div>
      <div class="legend-row"><i class="badge" style="background:#3d1c1c;color:#e88b8b">!</i> tråden har stannat på ett fel</div>
      <div class="legend-row"><i class="badge" style="background:#16301f;color:#7fd39a">⚒</i> arbetar just nu</div>
      <div class="legend-row"><i class="badge" style="background:#332b12;color:#e6c67f">✓</i> har levererat</div>
      <div class="legend-row"><i class="badge" style="background:#1d1f2e;color:#a9a8c0">z</i> tyst i tre dygn</div>
    </div>
    <div style="margin-top:18px;display:flex;justify-content:flex-end">
      <button class="btn primary" id="btn-help-close">Uppfattat</button>
    </div>
  </div>
</div>
`
