# Roostie

En fork av [bot-crossing](https://github.com/Station-Sciences/bot-crossing) (MIT) som visar
**Roosts trådar som astronauter och NUC:ens agenter som en maskinpark** — på köksskärmen
hemma hos Filip.

Originalet ritar kodagenter som bor på den egna datorn. Roostie ritar något annat: samtal i
claude.ai som rapporterar sitt arbete på en gemensam tavla, och fyrtio containrar på en NUC.
Allt det nya ligger vid sidan av originalet — en harness-adapter, tre skyltar och en maskinpark
— så att forken går att följa med uppströms.

## Vad som är vårt

| Fil | Vad den gör |
| --- | --- |
| `server/harnesses/roost-loggbok.mjs` | Läser Loggboken (`/api/loggbok`) och gör en astronaut per tråd |
| `server/maskiner.mjs` | Läser maskinparkens lägesfil |
| `verktyg/maskinlasare.mjs` | Skriver den filen ur docker — körs i NUC:ens crontab, aldrig i webbservern |
| `src/world/palett.js` | Roosts färger, enda stället en färg definieras |
| `src/world/tavlan.js` | Billboarden: hela Loggboken, och allt som väntar på någon |
| `src/world/anslagstavla.js` | Filips skylt i neon: det som väntar på honom |
| `src/world/agenttavla.js` | Agenternas egen tavla: vem arbetar, vem är tyst |
| `src/world/maskinpark.js` | Fyra gårdar med NUC:ens containrar, kablar, paket och en rover |
| `tools/demo-loggbok.mjs` | Demo-tavla, så kolonin går att köra utan token |

Resten är bot-crossings och rörs så lite som möjligt.

## Så läses världen

**Astronauterna** är trådarna. Ett färskt *börjar* som ingen *klart* stängt hamrar; ett *klart*
låter bygget växa; *stoppat* är fel; en notis med "TILL FILIP" får tråden att hålla upp handen
tills Ledning skrivit efter den. Tre dygn tyst och astronauten sover. Varje tråd har en egen
zon, för de har olika uppdrag även när de delar repo.

**Maskinerna** är containrarna. Lyktan över taket är statusen, kabeln in till gårdens mast är
rapporten, och paketet på kabeln åker tätare när agenten arbetar. Rovern är
kommandoprocessorn. Aktivitet mäts som sista loggraden — trubbigt, så tystnad ritas som
tomgång, aldrig som trasig.

**Kolonin larmar inte.** Containervakten på NUC:en är sanningen om larm. Det här är en bild.
Kan filen inte läsas, eller är den gammal, blir varje maskin okänd — aldrig grön.

## Miljö

Inga fallbacks: saknas en nyckel finns adaptern inte alls.

```
ROOST_LOGGBOK_URL=https://roost.love/api/loggbok
ROOST_ADMIN_TOKEN=…                 # samma token som trådarna postar med
ROOSTIE_ONLY=1                      # bara Loggboken, inga lokala agent-harnessar
ROOSTIE_CHATTAR={"produkt":"https://claude.ai/cowork/…"}   # Open öppnar trådens eget samtal
ROOSTIE_PROJEKT_URL=https://claude.ai/project/…
ROOSTIE_MASKINER_FIL=/data/maskiner.json
BOT_CROSSING_HOST=10.10.60.10       # bind till hemnätet, inte till loopback
BOT_CROSSING_DATA=/data
```

Kör utan token mot en demo-tavla:

```bash
node tools/demo-loggbok.mjs ~/loggbok-demo.json
ROOSTIE_ONLY=1 ROOST_LOGGBOK_FIL=~/loggbok-demo.json npm start
```

## Köksskärmen

`?kiosk=1` tar bort HUD:en, sätter kameran i bana och turnerar mellan kolonin, billboarden,
Filips skylt, agenttavlan och maskinparken. `H` och `O` tar tillbaka kontrollen; en omladdning
ger köksläget igen.

## Drift på NUC:en

Containern `nexus-roostie` kör `node server/serve.mjs` rakt av — aldrig `npm install` i
kommandot — med host-nät, `--env-file` och `--user 1000:1000`. Bygget görs separat och en gång.
Maskinläsaren ligger i värdens crontab med docker-socketen; webbservern har den aldrig.

## Tester

`npm test` — 49 stycken, varav kolonins egna kör mot en filkälla och aldrig mot nätet.
