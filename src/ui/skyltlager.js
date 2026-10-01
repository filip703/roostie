/**
 * SKYLTLAGRET — skylten över varje Roost-astronaut och gruppmarkeringarna i marken (rad 1814).
 *
 * Ett DOM-lager ovanpå canvasen, flyttat varje bildruta ur astronauternas skärmposition. Det
 * ligger utanför HUD:en med flit: HUD:en kan döljas med H, men skylten är det som gör att en
 * blick på kolonin räcker, så den följer med i köksläget.
 *
 * Texterna kommer ur skylt.js. Grupperna ritas som ljusa streckade ellipser runt medlemmarnas
 * ytor — ingen ruta, ingen fyllning som läses som en knapp.
 */
import * as THREE from 'three'
import { GRUPPER, gruppFor, skyltFor } from './skylt.js'

const v = new THREE.Vector3()

export class Skyltlager {
  /**
   * @param app      elementet canvasen bor i
   * @param hamta    () => { agenter, tradar, kamera, vy, pausade }
   */
  constructor(app, hamta) {
    this.hamta = hamta
    this.el = document.createElement('div')
    this.el.className = 'skyltlager'
    this.el.setAttribute('aria-hidden', 'true')
    app.appendChild(this.el)
    this.skyltar = new Map()
    this.marken = new Map()
  }

  _skylt(id) {
    let s = this.skyltar.get(id)
    if (!s) {
      s = document.createElement('div')
      s.className = 'skylt'
      this.el.appendChild(s)
      this.skyltar.set(id, s)
    }
    return s
  }

  _marke(namn) {
    let m = this.marken.get(namn)
    if (!m) {
      const ring = document.createElement('div')
      ring.className = 'gruppmarke'
      const t = document.createElement('div')
      t.className = 'gruppnamn'
      t.textContent = namn
      ring.appendChild(t)
      this.el.prepend(ring)
      m = ring
      this.marken.set(namn, m)
    }
    return m
  }

  update(status, nu = Date.now()) {
    const { agenter, tradar, kamera, vy, pausade } = this.hamta()
    const sedda = new Set()
    const grupper = new Map()
    for (const a of agenter) {
      const tr = tradar.get(a.id)
      if (!tr || tr.source !== 'loggbok' || !a.pos) continue
      v.set(a.pos.x, a.pos.y + 1.1, a.pos.z).project(kamera)
      const skylt = this._skylt(a.id)
      sedda.add(a.id)
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) {
        skylt.style.display = 'none'
        continue
      }
      const x = (v.x * 0.5 + 0.5) * vy.w
      const y = (-v.y * 0.5 + 0.5) * vy.h
      const { text, vantar } = skyltFor(tr, status(tr, nu), nu, {
        pausad: pausade?.has(String(a.id).replace(/^roost-loggbok:/, '')),
      })
      if (skylt.textContent !== text) skylt.textContent = text
      skylt.classList.toggle('vantar', vantar)
      skylt.style.display = ''
      skylt.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`

      const g = gruppFor(tr.title)
      if (g) {
        v.set(a.pos.x, a.pos.y, a.pos.z).project(kamera)
        const p = { x: (v.x * 0.5 + 0.5) * vy.w, y: (-v.y * 0.5 + 0.5) * vy.h }
        const l = grupper.get(g) || []
        l.push(p)
        grupper.set(g, l)
      }
    }
    for (const [id, s] of this.skyltar) {
      if (!sedda.has(id)) {
        s.remove()
        this.skyltar.delete(id)
      }
    }
    for (const g of GRUPPER) {
      const l = grupper.get(g.namn)
      const m = this._marke(g.namn)
      if (!l || l.length < 2) {
        m.style.display = 'none'
        continue
      }
      const x0 = Math.min(...l.map((p) => p.x))
      const x1 = Math.max(...l.map((p) => p.x))
      const y0 = Math.min(...l.map((p) => p.y))
      const y1 = Math.max(...l.map((p) => p.y))
      const lufB = Math.max(70, (x1 - x0) * 0.25)
      const lufH = Math.max(40, (y1 - y0) * 0.35)
      m.style.display = ''
      m.style.transform = `translate(${(x0 - lufB).toFixed(1)}px, ${(y0 - lufH).toFixed(1)}px)`
      m.style.width = `${(x1 - x0 + lufB * 2).toFixed(1)}px`
      m.style.height = `${(y1 - y0 + lufH * 2).toFixed(1)}px`
    }
  }
}
