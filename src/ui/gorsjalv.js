/**
 * "Gör själv"-korten (rad 1847 p.3): det som väntar på Filips händer, med Klart / Fråga / Senare.
 * Bara ren logik här — vad som är ett kort, vad som är dolt, vart Fråga leder. Ritandet är hudens.
 */
export const CHATT = 'https://claude.ai/chat/b17542cd-c85e-4f87-8ebd-dae0fc20e457'

const GOR_SJALV = /g[öo]r\s+sj[äa]lv/i

/** Nästa 08:00 lokal tid, strikt efter `nu` — "Senare" betyder i morgon bitti. */
export const imorgonAtta = (nu = Date.now()) => {
  const d = new Date(nu)
  d.setHours(8, 0, 0, 0)
  if (d.getTime() <= nu) d.setDate(d.getDate() + 1)
  return d.getTime()
}

export const arGorSjalv = (p) => GOR_SJALV.test(`${p?.rubrik || ''} ${p?.text || ''}`)

/** Rubriken i klarspråk: utan P-märke, TILL FILIP-prefix och "Gör själv:". */
export const kortTitel = (p) =>
  String(p?.rubrik || '')
    .replace(/^\s*P[0-3]\s+/i, '')
    .replace(/^\s*TILL FILIP\s*[:–—-]?\s*/i, '')
    .replace(/^\s*G[öo]r sj[äa]lv\s*[:–—-]?\s*/i, '')
    .trim()

/** Länken Fråga öppnar: Ledningschatten, med radens id så chatten vet vilken rad det gäller. */
export const fragaUrl = (p) => (Number.isInteger(p?.id) ? `${CHATT}?rad=${p.id}` : CHATT)

/** Texten som förifylls i Fråga (kopieras — claude.ai tar ingen text via länk). */
export const fragaText = (p) => `Om "Gör själv" (rad ${p?.id ?? '?'}): ${kortTitel(p)}`

/**
 * Korten som ska synas nu. `lagrat` = { klart: {id: ts}, senare: {id: tills} }.
 * Poster utan id kan inte kvitteras och visas därför alltid — hellre ett kort för mycket.
 */
export const synligaKort = (filip, lagrat = {}, nu = Date.now()) =>
  (Array.isArray(filip) ? filip : [])
    .filter(arGorSjalv)
    .filter((p) => !(p.id != null && lagrat.klart?.[p.id]))
    .filter((p) => !(p.id != null && (lagrat.senare?.[p.id] || 0) > nu))
    .map((p) => ({ ...p, titel: kortTitel(p) }))

export const markeraKlart = (lagrat, id, nu = Date.now()) => ({
  ...lagrat, klart: { ...(lagrat?.klart || {}), [id]: nu },
})
export const markeraSenare = (lagrat, id, nu = Date.now()) => ({
  ...lagrat, senare: { ...(lagrat?.senare || {}), [id]: imorgonAtta(nu) },
})

/** Radens id ur ?rad=N (länk från ntfy/mejl, rad 2173) — null om det inte är ett heltal. */
export const radFranUrl = (search = '') => {
  const v = new URLSearchParams(search).get('rad')
  return /^\d+$/.test(v || '') ? Number(v) : null
}

/** Kortet länken pekar på kommer först och markeras; en uttryckligen öppnad rad glöms inte bort av "Senare". */
export const medFokus = (filip, lagrat, rad, nu = Date.now()) => {
  const kort = synligaKort(filip, lagrat, nu)
  if (rad == null) return kort
  const direkt = (Array.isArray(filip) ? filip : []).find((p) => p.id === rad && arGorSjalv(p) && !lagrat?.klart?.[rad])
  if (!direkt) return kort
  return [{ ...direkt, titel: kortTitel(direkt), fokus: true }, ...kort.filter((k) => k.id !== rad)]
}
