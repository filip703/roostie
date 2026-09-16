/**
 * ETIKETTERNAS PLATS PÅ SKÄRMEN — och vem som får stå kvar när två namn krockar.
 *
 * Läsbarhetspasset mätte namnens STORLEK och rapporterade noll underkända. I samma bild
 * skrev "roadmap" över "Box & moln" och "Sajt & Roostadmin" över "box-och-moln". Två namn
 * ovanpå varandra är oläsliga hur stora de än är, så måttet var rätt och slutsatsen fel:
 * storlek är ett av två villkor, inte båda.
 *
 * Trädet gör krocken mycket mer sannolik än kolonin gjorde. Bona ligger på sju grenar på
 * olika DJUP, och djup syns inte i sidled — två bon som ligger långt från varandra i
 * världen kan hamna på samma ställe i bilden. Att flytta etiketten i världen hjälper därför
 * inte; det som avgör är var den hamnar i BILDEN, och det vet man först när kameran står
 * där den står.
 *
 * REGELN: den närmaste vinner. Kameran är riktad mot det man tittar på, och det man tittar
 * på ska ha sitt namn. Den som göms är inte borta — rundturen flyger till varje bo, och när
 * kameran kommer dit är det den som är närmast.
 */

/** Hur stor del av den mindre rutan som får täckas innan det räknas som en krock. */
export const KROCK = 0.12

/**
 * Etikettens ruta i bildpunkter.
 *
 * Plattan hänger inte i världen som andra saker: en vertexshader håller den nästan
 * konstant stor på skärmen, så dess hörn ligger inte där geometrin säger. Rutan räknas
 * därför ur shaderns egen formel — mitten är plattans projicerade origo, och storleken är
 * planets mått gånger (0.55 + avstånd · 0.03) gånger skärmmåttet.
 *
 * @param mitt  {x, y} projicerad mittpunkt i bildpunkter
 * @param plan  {bredd, hojd} planets mått i världsenheter
 */
export function ruta(mitt, plan, avstand, skala, fovRad, bildhojd) {
  const faktor = (0.55 + avstand * 0.03) * (skala || 1)
  const perEnhet = bildhojd / (2 * avstand * Math.tan(fovRad / 2))
  const b = plan.bredd * faktor * perEnhet
  const h = plan.hojd * faktor * perEnhet
  return { x: mitt.x - b / 2, y: mitt.y - h / 2, b, h }
}

/** Hur stor del av den MINDRE rutan som två rutor delar. 0 = rör inte varandra. */
export function tacke(a, b) {
  const bredd = Math.min(a.x + a.b, b.x + b.b) - Math.max(a.x, b.x)
  const hojd = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (bredd <= 0 || hojd <= 0) return 0
  const minsta = Math.min(a.b * a.h, b.b * b.h)
  return minsta > 0 ? (bredd * hojd) / minsta : 0
}

/**
 * Vilka etiketter som ska gömmas.
 *
 * @param rutor  [{ namn, ruta, avstand, iBild }] i valfri ordning
 * @returns Set med namnen som ska gömmas
 *
 * Den närmaste behåller sin plats och varje ruta prövas mot dem som redan står kvar — inte
 * mot alla andra. Skillnaden syns när tre namn ligger på hög: prövar man mot alla göms två
 * av tre fastän den tredje bara krockade med en som ändå försvann.
 */
export function gomKrockar(rutor, tak = KROCK) {
  const gom = new Set()
  const kvar = []
  const ordnade = [...rutor].sort((a, b) => a.avstand - b.avstand)
  for (const r of ordnade) {
    if (r.iBild === false) {
      gom.add(r.namn)
      continue
    }
    if (kvar.some((k) => tacke(k.ruta, r.ruta) > tak)) gom.add(r.namn)
    else kvar.push(r)
  }
  return gom
}
