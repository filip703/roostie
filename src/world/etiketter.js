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
 * Och hur lite som räcker för att ett gömt namn ska få komma tillbaka.
 *
 * Två gränser, inte en. Kameran svajar med flit i köksläget, och med EN gräns hamnar två
 * namn som ligger nära varandra precis på den: de korsar den fram och tillbaka med svajet,
 * och namnet blinkar några gånger i minuten. Det såg ut som ett fel i datan och var ett fel
 * i tröskeln. Ett namn göms när det täcks till tolv procent och kommer tillbaka först vid
 * sex — mellan dem händer ingenting, vilket är hela poängen.
 */
export const KROCK_ATER = 0.06

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
 * Vad som väger tyngre än avståndet.
 *
 * Barnens holkar bär minuter som någon faktiskt ska agera på; trådarnas bon bär namn man kan
 * flyga dit och läsa. När de två krockar ska barnet vinna, och i överblicken skulle det
 * annars alltid förlora: holkarna sitter på barken, längre bort från kameran än bona som
 * hänger ut mot den. Avstånd är rätt regel mellan likar, inte mellan olika viktiga saker.
 */
export const VIKT = { holk: 2, trad: 1 }

/**
 * Vilka etiketter som ska gömmas.
 *
 * @param rutor  [{ namn, ruta, avstand, iBild, vikt }] i valfri ordning
 * @returns Set med namnen som ska gömmas
 *
 * Den tyngsta och närmaste behåller sin plats, och varje ruta prövas mot dem som redan står
 * kvar — inte mot alla andra. Skillnaden syns när tre namn ligger på hög: prövar man mot alla
 * göms två av tre fastän den tredje bara krockade med en som ändå försvann.
 */
export function gomKrockar(rutor, tak = KROCK, forra = null, taKater = KROCK_ATER) {
  const gom = new Set()
  const kvar = []
  const ordnade = [...rutor].sort(
    (a, b) => (b.vikt ?? VIKT.trad) - (a.vikt ?? VIKT.trad) || a.avstand - b.avstand
  )
  for (const r of ordnade) {
    if (r.iBild === false) {
      gom.add(r.namn)
      continue
    }
    // Ett namn som redan är gömt har den lägre gränsen att ta sig tillbaka över.
    const granS = forra?.has(r.namn) ? taKater : tak
    if (kvar.some((k) => tacke(k.ruta, r.ruta) > granS)) gom.add(r.namn)
    else kvar.push(r)
  }
  return gom
}

/**
 * Krockrensningen för en hel bild.
 *
 * Den satt först inne i fåglarna, och då såg den bara trådarnas namn. Barnens holkskyltar är
 * etiketter av exakt samma slag och kunde krocka med dem utan att någon regel sa något — i
 * första mätningen mot iPaden skrev "Box & moln" över "Bill 70 min". En regel som bara gäller
 * hälften av det den handlar om är inte en regel.
 *
 * Den ligger därför här, där både fåglarna och holkarna når den, och kallas en gång per
 * bildruta med allas etiketter.
 *
 * @param poster     [{ namn, etikett, vikt }] — etiketten är plattan i scenen
 * @param tillstand  { gomda } — bärs mellan bildrutor så gränsen får hysteres. Se KROCK_ATER.
 */
export function rensaKrockar(poster, camera, bildhojd, THREE, tillstand = null) {
  if (!camera || !poster.length) return
  const h = Number.isFinite(bildhojd) && bildhojd > 0 ? bildhojd : 1080
  const bredd = h * (camera.aspect || 16 / 9)
  const fov = (camera.fov * Math.PI) / 180
  const v = new THREE.Vector3()
  const rutor = []
  for (const post of poster) {
    const e = post.etikett
    if (!e?.visible) continue
    /**
     * Avståndet mäts till ETIKETTEN, inte till det den hör till.
     *
     * Första versionen mätte till fågeln, och fåglarna flyger: två namn som krockade bytte då
     * plats i turordningen varje gång banorna korsades, så det ena blinkade fram och det andra
     * bort flera gånger i minuten. Etiketten står stilla, och beslutet ändras bara när KAMERAN
     * flyttar sig — vilket är precis när det ska ändras.
     */
    /**
     * VÄRLDSPOSITIONEN, inte `e.position`.
     *
     * Trådarnas etiketter hänger direkt i fågelgruppen, som står i origo — där är de två
     * samma sak, och det dolde felet. Barnens holkskyltar hänger i sin egen holkgrupp, som
     * både är flyttad och vriden, så `e.position` är skyltens plats INNE i holken: några
     * enheter under hålet. Räknat som världskoordinat hamnade Bills skylt hundra enheter fel
     * och bedömdes mot fel grannar — Tods skylt göms för en krock som inte fanns, och Bills
     * krock med "Box & moln" upptäcktes aldrig.
     */
    e.getWorldPosition(v)
    const avstand = camera.position.distanceTo(v)
    const p = v.project(camera)
    const bakom = p.z > 1
    const plan = e.geometry?.parameters || { width: 2, height: 0.56 }
    rutor.push({
      namn: post.namn,
      etikett: e,
      avstand,
      vikt: post.vikt,
      iBild: !bakom && Math.abs(p.x) < 1.35 && Math.abs(p.y) < 1.35,
      ruta: ruta(
        { x: (p.x * 0.5 + 0.5) * bredd, y: (-p.y * 0.5 + 0.5) * h },
        { bredd: plan.width, hojd: plan.height },
        avstand,
        e.userData?.skala ?? 1,
        fov,
        h
      ),
    })
  }
  const gom = gomKrockar(rutor, KROCK, tillstand?.gomda)
  if (tillstand) tillstand.gomda = gom
  // Bara opaciteten rörs, aldrig `visible`: den styrs av ägaren, och två ställen som sätter
  // samma flagga slutar alltid med att det ena vinner tyst.
  for (const r of rutor) if (gom.has(r.namn)) r.etikett.material.opacity = 0
}
