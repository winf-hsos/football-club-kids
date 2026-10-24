# CLAUDE.md – FCK: Football Club Kids

Privates, verspieltes Fußballspiel im Browser (ähnlich FIFA / EA FC) für Nicolas' Familie und Kinder. Komplett in **Vanilla-JavaScript**, **ohne Frameworks, ohne npm-Abhängigkeiten, ohne Server**. Alles läuft offline aus einer einzigen HTML-Datei.

Der Nutzer spricht Deutsch. **Antworten, UI-Texte und Commit-Nachrichten auf Deutsch**, Code-Bezeichner und Code-Kommentare auf Englisch (wie im bestehenden Code).

## Befehle

```bash
node build.js                 # baut dist/FCK.html (Einzeldatei), dist/artifact.html (Hosting-Fragment) und index.html (Dev-Variante)
npm test                      # alle Node-Tests (ohne Browser), ca. 1 Minute
node test/<name>.js           # einzelner Test, z. B. node test/pro_sim.js
python3 test/<name>.py [m]    # Browser-Tests (Playwright), "m" = Handy-Variante bei manchen
```

- Zum Spielen/Prüfen: `index.html` (lädt `js/` und `css/` einzeln, kein Build nötig) oder `dist/FCK.html` nach `node build.js`.
- **Nach jeder Änderung in `js/` oder `css/` gilt:** `node build.js` ausführen (dist/ ist nicht im Git), danach die passenden Tests.
- Browser-Tests brauchen `pip install playwright` und Chromium. Der Pfad zum Chromium steht in den Tests als `executable_path='/opt/pw-browsers/chromium'` – bei Bedarf anpassen oder das Argument weglassen (nach `playwright install chromium`). Für 3D-Tests in Umgebungen ohne GPU: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. Screenshots landen in `$TMPDIR/fck-shots/` (oder `FCK_SHOTS=<Ordner>`).
- Externe Netzwerkzugriffe (Google Fonts) schlagen in Tests absichtlich fehl (`ERR_FAILED` im Log ist normal und wird ignoriert).

## Architektur

- **Plain-JS-IIFEs auf dem globalen Objekt `FCK`** (`globalThis.FCK`). Kein Modulsystem. **Die Ladereihenfolge steht in `build.js` (`ORDER`)** – neue Dateien dort eintragen (die Dev-`index.html` wird daraus erzeugt, nicht von Hand ändern). CSS-Reihenfolge: Liste `CSS` in `build.js`.
- `js/worlddata.js` ist **generiert** (`node tools/merge_world.js` aus `data/world_*.json`), nicht von Hand ändern.
- three.js r128 liegt in `lib/` (3D-Ansicht). Die Einzeldatei bettet es ein, das Hosting-Fragment lädt es von cdnjs.
- Eigene Grafiken: Wappen, Trikots, Spieler werden **generiert** (`crest.js`, `squad.js`). Vereinsnamen sind Text, es gibt **keine echten Logos/Spielerfotos/Lizenzen**. Spielernamen sind erfundene Kombinationen (`names.js`), keine echten Personen.

### Modulübersicht (`js/`)

| Bereich | Dateien |
|---|---|
| Kern / Hilfen | `util.js` (Mathe, RNG `U.makeRng`, Storage `U.store`, Präfix `fck.`), `data.js` (Teams, Formationen, Taktiken, Presets, Standard-Einstellungen), `main.js` (Start, Einstellungen `FCK.settings`, Spielschleife), `ui.js` (DOM-Helfer `FCK.h`, `FCK.UI`, Start-/Home-/Einstellungs-/Hilfe-Bildschirme) |
| Spiel-Engine | `sim.js` (Physik, Ball, Spieler), `rules.js` (Spielfluss, Fouls, Abseits, Tore, Wechsel, Elfmeter), `ai.js` (CPU-Verhalten, Torwart), `input.js` (Tastatur, Gamepad, Touch), `render.js` (2D-Canvas), `render3d.js` (3D, three.js), `audio.js`, `commentary.js`, `stats.js` (Highlights, Replays, Spielstände) |
| Welt & Karriere | `world.js`, `season.js` (Ligen, Pokale, CL/EL/ECL, Saisonwechsel), `career.js`, `careerui.js`, `importer.js` (CSV-Kader) |
| Modi | `manager.js`/`market.js`/`youth.js`/`mgrseason.js`/`mgrui.js` (Managermodus), `pro.js`/`proui.js`/`abilities.js` (Profikarriere, 30 Fähigkeiten), `cards.js`/`cardsui.js` (Ultimate Team, früher „Karten-Modus“; Spezialstile `Cards.SK`, `card.sk`), `tourney*.js` (WM/EM), `comp*.js` (Einzelwettbewerbe), `duel*.js` (Duell per Code), `editor*.js` (eigene Vereine) |
| Auswahl/Setup | `setup.js` (Freundschaftsspiel), `clubpick.js` (EA-FC-Vereinsauswahl `FCK.ClubSelector` / `FCK.clubPicker`), `lineupui.js`, `matchui.js` (HUD, Banner, Ergebnis), `padnav.js` (Controller-Navigation für alle Menüs) |
| Daten | `natdata.js` (Nationalteams), `names.js` + `i18n_names.js` (Namenspools/-gruppen), `worlddata.js` (generiert) |
| Texte | `i18n*.js` – Deutsch und Englisch |

### Wichtige Konventionen

- **UI bauen:** `FCK.h(tag, props, ...kinder)`; `props.style` darf CSS-Custom-Properties (`'--hue': 200`) enthalten. Bausteine in `FCK.UI`: `btn`, `chips(options, value, cb, cls)`, `section`, `modal`, `toast`, `crestImg`, `show(name, args, replace)` / `back()`. Bildschirme sind `FCK.Screens[name]` (Funktionen `screen_<name>` in `ui.js` bzw. die jeweiligen `*ui.js`).
- **Texte:** Immer `FCK.T('key', {vars})`. **Jeder Schlüssel muss in `de` und `en` existieren**. Neue Texte in einer passenden `i18n_*.js` per `Object.assign(FCK.I18N.de, {...})` / `.en` ergänzen. `node test/i18n_check.js` meldet fehlende Schlüssel (`missing 0` muss stehen; die Liste „unused“ ist unkritisch, dynamisch zusammengesetzte Schlüssel erscheinen dort).
- **Einstellungen:** `FCK.settings` (+ `FCK.saveSettings()`, `FCK.onSettings`, `applyProfile`); Speicher in `localStorage` mit Präfix `fck.`. Alles in try/catch (Storage kann fehlen).
- **Design-Stile:** `body[data-ui="mix|f22|f24|f27"]` (Einstellung `uiStyle`, Standard `mix`). Alle Farben/Formen kommen aus CSS-Variablen in `css/fifa.css` (`--accent`, `--cut`, `--btn-r`, …). Neue UI nutzt diese Tokens, keine festen Farben. Schnittecken per `clip-path` (Fokusring daher per inset-Box-Shadow). Großbuchstaben-Transformation macht aus „ß“ ein „SS“ (bekannt).
- **Zwei Spieler-/Gerätearten überall mitdenken:** Maus/Tastatur, **Touch (Handy, Breite ≤ 560 px)** und **Gamepad** (`padnav.js` navigiert räumlich; neue interaktive Elemente müssen fokussierbar sein, z. B. echte `button`s). Neue Layouts auf Handybreite (390 px) prüfen, kein horizontales Scrollen.
- **Kids-Profil** (`settings.profile === 'kids'`): wirkt über `applyProfile` in `main.js` (kindgerechtere Voreinstellungen); bei neuen Mechaniken prüfen, ob das Profil sie beeinflussen soll.
- **Zufall deterministisch halten:** Welt/Karriere nutzen geseedete RNGs (`U.makeRng(seed)`), damit Spielstände reproduzierbar sind. Kein `Math.random()` in Simulationslogik, die gespeichert wird.
- **Spielstände:** `Career.pack()`/`unpack()` serialisieren in JSON (Autosave + 5 Slots + Textexport). Neue Karrierefelder müssen dort mitlaufen und mit alten Spielständen kompatibel sein (Default setzen, wenn Feld fehlt).

### Welt-Daten erweitern
Neues Land/Liga: `data/world_N.json` (Format wie die vorhandenen, Beispiel `data/EXAMPLE.json`; Felder u. a. `cc`, `names`, `uefa`, `cup`, Ligen mit Vereinen inkl. Rating, Stadion, Farben), prüfen mit `node test/validate_world.js data/world_N.json`, dann `node tools/merge_world.js`, `node build.js`, `node test/world_sim.js 5`. Namensgruppe des Landes in `js/names.js` (`COUNTRY_NAMES`) eintragen. Vereinsnamen/Ligen sind eine **Näherung an die Saison 2026/27**, Stärken sind eigene Schätzungen.

## Tests (was prüft was)

Node (schnell, ohne Browser; alle in `npm test`): `world_sim` (Mehrjahressimulation), `comp_sim`, `mgr_sim`/`mgr_edge` (Manager), `cards_sim`, `own_sim` (eigene Vereine), `pro_sim` + `pro_req` (Profikarriere, Wechselwunsch), `tourney_sim`, `ab_test` (Fähigkeiten), `names_test`, `i18n_check`. Weitere Hilfsskripte: `pass_stat.js`/`pass_human.js` (Passgenauigkeit), `lock_test.js`, `setpieces.js`, `stress.js`.

Browser/Playwright (langsam, jeweils einzeln starten; ganze Reihe dauert > 1 Stunde): `browser0..20.py` (Menüs, Modi, Karriere), `touch1..3.py` (Touch, emuliert), `tpad_*.py` (Gamepad-Navigation), `t3d_*.py` (3D-Ansicht, Software-WebGL), `cps_shots.py` (Vereinsauswahl), `style_shots.py <tag> [mix|f22|f24|f27]` (Screenshots der Design-Stile), `pro_req_ui.py [m]` (Wechselwunsch Profikarriere).
Nach Änderungen an Home/Menüs: `tpad_menus.py` und `browser*.py`, die `.mitem` anklicken; nach Änderungen am Spielfeld/HUD: `style_shots.py` ansehen.

**Vorgehen bei Änderungen:** kleinen, gezielten Test ergänzen (Node-Simulation, wenn es Logik ist; Playwright + Screenshot bei UI), `npm test`, danach die betroffenen Browser-Tests. UI-Änderungen immer auf Desktop **und** Handybreite und in mehreren Design-Stilen ansehen.

## Bekannte Einschränkungen / Hinweise

- Echte Touch-Bedienung und echte Controller wurden nur **emuliert** getestet, nicht auf Geräten.
- „FC 27“-Stil ist eine Schätzung; die Design-Stile sind eigene Interpretationen, keine Kopien (keine Logos/Lizenzen).
- Saudi-Arabien: 2. Liga ist näherungsweise; Namen für `sa` zu 50 % „arabisch“ (Gruppe `ar`).
- Profikarriere: Vereinswechsel über Saisonende-Angebote **und** über „Verein wechseln“ im Laufbahn-Tab (max. 2 Wünsche pro Saison, Annahme abhängig von Niveau, Form, Kaderplatz).
- `README.md` beschreibt alle Funktionen für Spieler (Deutsch); bei neuen Features dort einen Absatz ergänzen.
- Das Spiel soll **kinderfreundlich und offline** bleiben: keine Konten, keine Werbung, keine personenbezogenen Tracker, keine externen Dienste außer den optionalen Google Fonts und dem anonymen Besuchszähler GoatCounter (`fck.goatcounter.com`, nur in `dist/FCK.html`, ohne Cookies, in der Hilfe abschaltbar über `localStorage.skipgc`). Einzige Ausnahme: der „♥ Spenden“-Button auf dem Hauptmenü und ein Erinnerungs-Pop-up alle 15 Minuten, nur im Hauptmenü, nie im Spiel (`js/donateui.js`: PayPal.me, Wunsch per `mailto:`; „Später“ und „Nicht mehr anzeigen“ vorhanden, Eltern-Hinweis steht im Dialog).

## Git / GitHub

- Hauptzweig `main`, kleine Commits mit deutscher Beschreibung (z. B. „Profikarriere: Wechselwunsch im Laufbahn-Tab“).
- `dist/`, ZIPs und Screenshots gehören **nicht** ins Repository.
- CI (`.github/workflows/ci.yml`) baut und führt `node test/run_all.js` aus. `pages.yml` veröffentlicht `dist/FCK.html` bei jedem Push auf `main` über GitHub Pages (Repo `winf-hsos/football-club-kids`, öffentlich; Pages-Quelle „GitHub Actions“). Jeder Push auf `main` ist damit sofort live.
