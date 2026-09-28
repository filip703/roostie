# Kolonin som kommunikationsyta — undersökning

*Kolonin-tråden, 28 september 2026. Underlag till Filip och Ledning. Alla siffror är mätta på Loggbokens rader 1162–1379 (200 rader, 26–28 sep), inte uppskattade.*

## Kort svar

Kolonin kan bli din kanal, och den saknar bara en sak för att bli det: **en väg in**. Trådarna har redan en väg ut (tavlan, din skylt, kortet med Sedd och Arkivera). Du har ingen. Dina ord finns inte i systemet.

## Vad mätningen visar

**Du har skrivit noll rader på tavlan.** Av 200 rader är antalet med `trad = filip` exakt 0. Dina ord kommer in i systemet på ett enda sätt: genom att Ledning citerar dig. Det sker i 23 av 200 rader, och alla 23 är skrivna av Ledning. Ingen annan tråd citerar dig någonsin.

Det betyder att Ledning är din enda översättare. Säger du något i en Kolonin-chatt hör Produkt det aldrig, om inte Ledning råkar skriva ner det. Det är en flaskhals med en enda punkt som kan gå sönder, och den syns inte förrän något blivit fel.

**Din inkorg är liten men seg.** 11 av 200 rader är ställda till dig, och 7 av dem är automatiska påminnelser. Femton påminnelser totalt under tre dygn — varje påminnelse är en gång då något väntat på dig tillräckligt länge för att en robot skulle knuffa. Rad 1259 har påmints fyra gånger.

**Trådarna pratar mest med varandra.** TILL PRODUKT 9 gånger, TILL NEXUS 9, TILL LEDNING 4, TILL BOX & MOLN 4, TILL DESIGN 4, TILL KOLONIN 3, TILL SAJT 3. Tavlan fungerar alltså redan som kanal — mellan trådar. Det är bara du som står utanför.

**Fördröjningen är en dag, inte minuter.** Mellan två rader från samma tråd är mediantiden 0,04–1 timme på dagen, men varje tråd har en lucka på 16–26 timmar: natten. Så en lapp du lämnar läses inom minuter mellan sju och nitton, och ligger till morgonen om du skriver den på kvällen.

**Tavlan lever 06–19 UTC**, med toppar 07, 12 och 17. Den är tom efter 19.

## Vad som saknas, i tur och ordning

### 1. Svara från kolonin (litet, en kväll)

Ett textfält på trådkortet. Du skriver, kolonin skickar till sin egen server på NUC:en, servern skriver raden till Loggboken med `trad` = tråden du klickat och rubrik "TILL <TRÅD>: …". ADMIN_TOKEN stannar på NUC:en och går aldrig ut i en flik.

Det löser de femton påminnelserna: de flesta är ja- eller nej-frågor, och i dag kräver varje svar att du öppnar rätt chatt.

### 2. Filip som egen avsändare (viktigast, och det är ett regelbeslut)

Dina rader ska skrivas som `trad: 'filip'`, inte som en Ledning-parafras. Då läser varje tråd dina ord i förstahand, och beslutet går att hitta ett halvår senare utan att någon gissar vad du menade.

Det kräver att Ledning tar in ett nytt värde i `trad`, och att kolonin får en åttonde plätt — din egen, på landningsplattan.

**En sak måste följa med:** dina rader ska undantas från klarspråks-omskrivningen i `api/loggbok.js`. Vi vet redan att den skriver om rader efteråt — två av Kolonins Klart-rader står nu som "stoppat" på tavlan, med varningstriangel i kolonin, och båda innehöll självkritik. En kanal som parafraserar dig är inte en kanal, det är fortfarande en översättare.

### 3. Ja/nej på kortet (roligast, och den du märker mest)

Kortet har redan Open, Sedd och Arkivera. Lägg till Svara med tre lägen: Ja, Nej, Skriv. De flesta rader som väntar på dig är beslut — "godkänn Display 2.0 mockups", "besluta om Serwist", "ska boet visa fler än nio fjädrar". Ett tryck i köket i stället för en chattsession.

## Vad det inte blir

Det blir inte chatt. Trådarna läser tavlan när de kör ett pass, inte när du trycker skicka. Dagtid betyder det minuter; på kvällen betyder det i morgon bitti. Om du vill ha svar direkt är chatten fortfarande rätt väg, och det är inget fel med att ha två.

Och kolonin får en skrivväg. I dag kan vem som helst på hemnätet läsa den; med det här kan vem som helst på hemnätet skriva till trådarna. Skärmen står i köket och barnen går förbi den. Det behöver inte bli avancerat, men det behöver bestämmas.
