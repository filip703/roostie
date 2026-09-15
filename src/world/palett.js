/**
 * Roosts färger, på ett ställe.
 *
 * Kolonin ärvde bot-crossings egen palett — orange, lila, rosa — och den hör inte hemma i
 * Roost. Filips beslut 14 september är entydigt: inget ska se ut som Nexus, allt bär Roost.
 * Så skyltarna, gårdarna och zonerna hämtar sina färger härifrån i stället för att var och en
 * hitta på en egen.
 *
 * Värdena är Roosts egna tokens (clay, honey, forest, sage, petrol, camel, cream, charcoal)
 * översatta till det kolonin behöver: `TAL` för three (0xRRGGBB), `CSS` för canvas-texterna.
 * En färg definieras EN gång och läses i två former — annars driver de isär.
 */

const H = {
  natt: 0x1c2620, // djup kvällsgrön — skyltarnas botten
  panel: 0x243029, // en nyans upp, för ytor ovanpå natten
  stomme: 0x3a4740, // stål och stolpar
  cream: 0xf4ede1, // text mot mörkt
  sand: 0xe0d0bc,
  dampad: 0x9aa79c, // sekundär text
  charcoal: 0x3e3632,
  clay: 0xc9785e, // primär accent
  honey: 0xd7a85f, // arbete pågår
  sage: 0x92a68e,
  gron: 0x7fa07f, // klart, och maskiner som mår bra
  petrol: 0x4e7f8a, // notiser, kyla
  forest: 0x35584a,
  camel: 0xc4a678,
  rose: 0xc99a9a,
  crit: 0xb65c57, // fel — den enda röda
}

/** three-färger. */
export const TAL = H

/** Samma färger som CSS-strängar, för canvas. */
export const CSS = Object.fromEntries(
  Object.entries(H).map(([namn, v]) => [namn, `#${v.toString(16).padStart(6, '0')}`])
)

/** Genomskinlig variant av en palettfärg, för linjer och skuggor på duk. */
export const rgba = (namn, a) => {
  const v = H[namn] ?? 0
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${a})`
}

/**
 * Faserna på tavlan har fasta färger, och de gäller överallt: på billboarden, i maskinparken
 * och på Filips skylt. En "klart" ska ha samma gröna var man än ser den.
 */
export const FAS = {
  borjar: CSS.honey,
  klart: CSS.gron,
  stoppat: CSS.crit,
  notis: CSS.petrol,
}
