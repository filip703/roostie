# Konceptscen: Boet

Filmen som ska visas för Bill innan Boet-scenen byggs. Lednings rad 536 och Bills
tillägg 537 säger ordningen uttryckligen: **konceptfilm → Bill säger ja → bygg.**
Ingenting här är produktionskod, och ingenting i nexus har rörts.

## Köra

```
cd <repot>            # inte i koncept/
python3 -m http.server 5300
# öppna http://127.0.0.1:5300/koncept/boet.html
```

`three` hämtas ur repots egna `node_modules`. Ingen kopia av biblioteket checkas in.

## Rendera om filmen

Allt i scenen läses ur EN tidsvariabel — `window.__boet.stall(t)` — och ingenting sparas
mellan bildrutor. Därför blir varje bildruta exakt likadan varje gång, och filmen går att
ta om efter en ändring i stället för att spelas in på nytt mot väggklockan.

```
node verktyg/film.mjs /tmp/rutor 20 900
ffmpeg -y -framerate 20 -i /tmp/rutor/%04d.png \
  -vf "fps=14,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" \
  -loop 0 boet-koncept.gif
```

## Vad filmen visar, och i vilken ordning

| sekund | beat |
|-------|------|
| 0–1,4 | boet halvbyggt på grenen, nio fjädrar står på kanten, knappen tänds |
| 1,4–6,2 | HÅLL IN: fjädrarna flyger in en och en, kvistarna landar, boet växer |
| 6,25–7,5 | nivå-upp: fjäderkonfetti, "Nivå 3!", +30 XP |
| 6,9–8,5 | ägget kommer, vickar, nedräkningen syns, sprickorna växer |
| 8,35–9,05 | kläckningen: ljus |
| 8,75–10,2 | fågeln reser sig, går runt i boet, får sitt namn |
| 9,9–11 | gåvan |

Syskonets bo står mindre bredvid hela tiden, och den tunna raden nederst är förslaget på
hur Bill når skärmtid, uppdrag och butik utan att lämna scenen (rad 537).

## Vad som INTE är avgjort

Filmen visar förslag, inte beslut, på tre punkter: den nedre raden, var skärmtiden tar
vägen när Boet är första sidan, och att det är dagsläge. Kvällsläget med bioluminescens är
ett eget klipp om Bill vill se det.
