# FCK – Football Club Kids

Ein eigenes Fußballspiel für den Browser (3D mit schräger TV-Kamera oder Top-down 2D, Stadion-Optik).
Stufe 1: spielbares Freundschaftsspiel. Stufe 2: Welt & Karriere (Ligen, Pokale, Europapokal). Stufe 3: Managermodus (Transfers, Finanzen, Jugend, Vorstand). Stufe 4: Karten-Modus (Packs, Chemie, Markt, Liga-Serie). Stufe 5: Editor, WM & EM, Duell per Code. Stufe 6: 3D, Wettbewerbe, eigene Vereine in der Karriere, Profikarriere, Controller-Menüs.

## Starten
- `FCK-single.html` doppelklicken (eine einzige Datei, funktioniert offline), **oder**
- `index.html` öffnen (lädt `css/` und `js/` als Einzeldateien).
- Beim Ändern der Quelldateien: `node build.js` erzeugt `dist/FCK.html` neu.

## Steuerung
| | Tastatur 1 | Tastatur 2 | Controller | Touch |
|---|---|---|---|---|
| Laufen | W A S D | Pfeile | Linker Stick / Steuerkreuz | linke Bildschirmhälfte ziehen |
| Sprint | Shift links | Shift rechts | R1 / R2 | » |
| Pass / Spieler wechseln | Q | , | A | A |
| Schuss (halten) / Tackling | E | . | B | B |
| Steilpass / Pressing | R | - (Taste „/“) | Y | C |
| Flanke (halten) / Torwart raus | F | Ö (Taste „;“) | X | D |
| Pause | Esc / P | | Start | ❚❚ |

Spielt nur eine Person mit der Tastatur, gelten beide Belegungen zusammen (WASD oder Pfeile, Q/Leertaste, E/X, R/C, F/V).

## Inhalt Stufe 1
Spielfeld mit Stadion, 7 Formationen und 5 Spielstile, Abseits, Vorteil, Karten, Verletzungen, Auswechslungen,
Verlängerung und Elfmeterschießen, einstellbare CPU (Reaktion, Passgenauigkeit, Aggressivität, Tempo),
1–4 Spieler lokal (Tastatur, Controller, Touch), Wetter und Tageszeit, Kommentator (Text + optional Sprache),
Torwiederholung und Highlight-Archiv, Statistik, Noten, Heatmaps, Spielstände (Export/Import als Text),
Deutsch/Englisch, Profile Kids/Normal.

Vereinsnamen sind reiner Text; Wappen, Trikots und Spieler (Namen, Aussehen) werden generiert.

## Inhalt Stufe 2 – Welt & Karriere
- **Welt**: 53 Länder, rund 2.100 Vereine. Alle Ligen bis zur dritten Stufe (Deutschland zusätzlich die fünf Regionalligen, Österreich die Regionalligen), dazu die MLS. Vereinsnamen sind echt (reiner Text), Wappen/Trikots/Spieler sind generiert. Daten: `data/world_*.json` (Saison 2026/27, recherchiert; Stärken sind eigene Schätzungen).
- **Wettbewerbe**: Ligen mit Hin-/Rückrunde, Landespokal je Land (Einzelspiele mit Verlängerung/Elfmeterschießen, Finale auf neutralem Platz), Champions League, Europa League und Conference League (36er Ligaphase mit 8 Spielen, Playoffs, Achtelfinale bis Finale mit Hin-/Rückspielen).
- **Saisonwechsel**: Auf- und Abstieg in jedem Land (auch mit mehreren Staffeln), Europa-Qualifikation nach Länderwertung, Stärken verändern sich leicht von Jahr zu Jahr.
- **Karriere**: Verein aus der ganzen Welt wählen, jedes Spiel selbst spielen oder simulieren, Tabellen/Torschützen/Spielplan/Pokalbaum/Europapokal/Weltansicht/Historie, Autosave und 5 Speicherplätze (+ Export als Text).
- **Echte Spielerdaten**: Im Karriere-Menü lassen sich Kader per CSV importieren (`Verein;Name;Position;Stärke;Alter;Nation`). Ohne Import sind die Spieler erfundene Namen.
- Tests: `node test/world_sim.js 5` (Mehrjahressimulation mit Prüfungen), `node test/validate_world.js data/world_1.json`.
- Daten zusammenführen: `node tools/merge_world.js` (schreibt `js/worlddata.js`), danach `node build.js`.

Vereinfachungen: Alle Ligen laufen im gleichen Zeitraum (Aug–Juli); keine Qualifikationsrunden für kleine Verbände (Länder ab Rang ~29 schicken keine Teams in den Europapokal); Pokale sind Einzelspiele.

## Inhalt Stufe 3 – Managermodus (in der Karriere)
- **Kader**: eigene, dauerhafte Spieler mit Alter, Stärke, Potenzial, Vertrag, Gehalt, Marktwert, Moral und Verletzungen. Eigene Startelf per Aufstellungs-Editor oder automatisch; Trainingsintensität; Spieler altern, entwickeln sich, beenden die Karriere.
- **Transfers**: Fenster im Sommer (Wochen 1–8) und Winter (23–27). Suche in der ganzen Welt, Gebote mit Ablöse, Gehalt und Laufzeit (Verein und Spieler verhandeln getrennt), Vereinslose, Transferliste, Angebote für eigene Spieler, Leihe, Vertragsverlängerung und -auflösung.
- **Scouting**: Fremde Spieler sind nur geschätzt (~), bis du sie beobachtest oder Scouts Aufträge ausführen (Land, Position, Höchstalter). Erst dann siehst du Stärke und Potenzial genau.
- **Jugend U6–U19**: 14 Jahrgänge, jedes Jahr neuer Nachwuchs, Entwicklung nach Potenzial (Schätzung wird mit besserer Akademie genauer), Jugendliga-Platz, Profivertrag ab 16, Abschlussjahrgang U19 am Saisonende.
- **Finanzen**: Einnahmen (Tickets, TV, Sponsor, Prämien, Verkäufe), Ausgaben (Gehälter, Unterhalt, Transfers, Jugend), Sponsorenwahl, Ausbau von Trainingsgelände, Akademie, Medizin, Scouting, Stadion und Trainerstab.
- **Vorstand**: Saisonziele (Liga, Pokal, Europa, Finanzen, Jugend), Vertrauen, Fans, Teamstimmung; im vollen Modus Entlassung und Jobangebote anderer Vereine. Pressekonferenzen vor/nach Spielen.
- **Modi**: „Locker“ (großzügige Budgets, keine Entlassung; Standard im Kinder-Profil) und „Voll“.
- Test: `node test/mgr_sim.js 3` (Mehrjahressimulation mit Käufen/Verkäufen), `node test/mgr_edge.js`.

Vereinfachungen: Die Vereine der Welt tauschen untereinander keine Spieler; ihre Kader werden jede Saison neu erzeugt. Transfers des Nutzers wirken nur auf die beteiligten Clubs. Sperren (Gelb/Rot) werden im Karrieremodus nicht über Spiele hinweg gezählt.

## Inhalt Stufe 4 – Karten-Modus (Hauptmenü → Karten-Modus)
- **Karten**: Generierte Spieler (Vereinsnamen echt, Spieler erfunden) in fünf Seltenheiten: Bronze (45–64), Silber (65–74), Gold (75–82), Elite (83–89), Legende (90+). Jede Karte hat Position, Land, Verein, Liga, Alter und Spielwerte; „Rare“-Karten glänzen.
- **Start**: Starter-Team (21 Bronze-Karten), 3.000 Münzen, 2 Bronze-Packs und ein kostenloses Bronze-Pack pro Tag.
- **Packs**: Bronze, Silber, Gold, Premium und Legenden-Pack mit angezeigten Chancen und garantierter Mindest-Seltenheit; Aufdeck-Animation. Münzen gibt es nur im Spiel, echtes Geld wird nie gebraucht.
- **Aufstellung & Chemie**: 7 Formationen auf einem Spielfeld, Karte antippen zum Tauschen (mit Vorschau). Chemie 0–3 pro Spieler aus gleichem Verein, Land und Liga (bis +3 Wertung), falsche Position gibt Abzüge. „Auto-Aufstellung“ sucht die beste Mischung.
- **Liga-Serie**: Division 10 bis 1, je 5 Spiele (Sieg 3, Unentschieden 1). 10+ Punkte = Aufstieg mit Pack, 3 oder weniger = Abstieg. Gegner sind echte Vereine passender Stärke, gespielt wird mit der normalen Match-Engine. Dazu Freundschaftsspiele gegen jeden Verein.
- **Markt**: 30 Angebote, die sich nach jedem Spiel ändern; eigene Karten mit eigenem Preis anbieten (Verkaufschance hängt vom Preis ab, 5 % Gebühr) oder sofort verkaufen.
- **Aufgaben & Tausch**: 3 Tagesaufgaben, 15 Erfolge, 10 Tausch-Aufgaben (Karten abgeben, Belohnung bekommen) und ein Tages-Tausch.
- **Eigener Verein**: Name, Farben, Trikot und Wappen. Sammlung als Text exportieren/importieren; sie ist auch in den Speicherplätzen des Hauptmenüs enthalten.
- Test: `node test/cards_sim.js` (Pack-Wirtschaft, Chemie, Markt, Liga-Runden, Export, echtes Match mit Kartenkader).

Vereinfachungen: Die Karten-Spieler sind generiert; Preise, Chancen und Wertungen sind eigene Schätzungen. Es gibt keinen Mehrspieler-Markt, der Markt wird deterministisch aus deinem Spielstand erzeugt. Karten haben keine Verletzungen oder Sperren.

## Inhalt Stufe 5 – Editor, WM & EM, Duell per Code
- **Editor** (Hauptmenü → Editor): eigene Vereine (bis 40) mit Name, Kürzel, Farben, Trikot, Wappen und Stadion (Name, Kapazität, Rasenmuster, Bandenwerbung, Tribüne) samt Vorschau. Kader mit 24 Spielern frei bearbeitbar (Position, Name, Nation, Stärke). Echte Vereine lassen sich anpassen (Stadion, Look, Kader) und wieder zurücksetzen. Eigene Vereine erscheinen überall in der Vereinsauswahl. Sicherung: Textexport `FCKE1:`.
- **WM & EM** (Hauptmenü → WM & EM): 77 Nationalteams, drei Formate – WM mit 48 Teams (104 Spiele), WM mit 32 Teams (64) und EM mit 24 Teams (51). Gruppen, Auslosung mit Töpfen und Kontinentalregel, K.o.-Runden mit Verlängerung und Elfmeterschießen. Eigene Spiele spielst du in der Engine, alle anderen lassen sich runden- oder komplett simulieren. Gruppentabellen, K.o.-Baum, Torjägerliste, Verlauf, Export `FCKT1:`.
- **Duell per Code** (Hauptmenü → Duell per Code): Du erzeugst einen Herausforderungs-Code (`FCKD1:`) mit deinem ganzen Team, schickst ihn deinem Freund (Chat, Mail), er spielt gegen dein Team und schickt dir einen Ergebnis-Code zurück. Dazu Bilanz und Verlauf.
- **Grenzen (ehrlich)**: Das Duell ist nicht live – die Seite kann keine Verbindung zu anderen Rechnern aufbauen, dein Team wird vom Computer gesteuert. Ergebnis-Codes sind nicht fälschungssicher. Die WM/EM hat keine echte Qualifikation (Teilnehmerfeld nach Stärke und Kontinent-Plätzen mit Zufall), Nationalstärken sind eigene Schätzungen, die Spieler generiert. Tie-Breaker sind vereinfacht, simulierte Spiele nutzen ein Poisson-Modell, Sperren/Verletzungen werden zwischen Turnierspielen nicht übernommen. Editor-Daten liegen im Browser (Export ist die Sicherung). Zu zweit an einem Gerät geht es weiterhin im Freundschaftsspiel.

## Inhalt Stufe 6 – 3D, Wettbewerbe, Profikarriere, Controller
- **Übersichtlicheres Hauptmenü**: Einträge in Gruppen (Spielen / Erstellen / Mehr), zweispaltig am Computer, einspaltig am Handy.
- **Anstoß, Abstoß, Einwurf, Freistoß, Ecke**: überarbeitete Abläufe mit Zielanzeige und Hinweiszeile; Positionen heißen jetzt deutsch (TW, IV, LV, RV, LAV, RAV, ZDM, ZM, ZOM, LM, RM, LF, RF, ST). Aufstellung wie bei FIFA mit Feld-Ansicht.
- **3D** (Einstellungen → Ansicht): echtes 3D mit three.js (liegt in `lib/`, in `FCK-single.html` eingebettet). Kameras: TV (Standard, schräg), Hoch, Hinter dem Tor, Draufsicht – im Spiel mit B/Tab, Select am Controller oder dem Kamera-Knopf umschalten. Qualität niedrig/mittel/hoch. Ohne WebGL oder three.js fällt das Spiel automatisch auf 2D zurück; 2D bleibt jederzeit wählbar.
- **Wettbewerbe** (Hauptmenü → Wettbewerbe): jede Liga, jeder Landespokal sowie Champions League, Europa League und Conference League einzeln – selbst spielen (mit eigenem Verein) oder nur zuschauen, runden- oder komplett simulieren, Historie.
- **Eigene Vereine in der Karriere**: Im Karriere-Start „Eigener Verein“ wählen; der eigene Verein ersetzt einen echten Verein der Welt (Vorschlag: gleiches Land). Ein Abbild des Vereins steckt im Spielstand.
- **Profikarriere** (Hauptmenü → Profikarriere): eigener Spieler (Name, Position, Typ, Verein), Werte (TEMPO, SCHUSS, PASS, DRIBBLING, DEFENSIVE, PHYSIS; Torwart eigene Werte), Training, Fähigkeitspunkte, Form/Fitness/Vertrauen, Rolle im Kader (Stammspieler … Bank), Ziele, Verletzungen, Vertrag und Wechselangebote, Auszeichnungen, Länderspiele und WM/EM, Karriereende mit Vermächtnis-Wertung. Spielen kannst du **nur deinen Spieler** (Bank: das Spiel läuft schneller bis zur Einwechslung) oder **das ganze Team**.
- **30 Fähigkeiten** (Profi-Hub → Spieler → Fähigkeiten): Spezialfähigkeiten wie bei den PlayStyles in EA FC, freigeschaltet mit Punkten zum Verteilen und Mindestwerten – Schuss (Gewaltschuss, Präzisionsschütze, Eiskalt, Distanzschütze, Heber-Spezialist, Elfmeter-Nerven, Freistoß-Künstler), Pass (Passgenie, Steilpass-Meister, Flankengott, Kurzpass-Kombinierer, Spielübersicht), Dribbling (Dribbelkönig, Ballannahme, Tempodribbler, Übersteiger, Ballabschirmer, Direktspiel), Abwehr (Zweikampfmonster, Grätschen-Profi, Abfangjäger, Sauberer Verteidiger, Pressing-Maschine), Körper (Dauerläufer, Turbo, Unverwüstlich, Coolness) und Torwart (Elfmetertöter, Reflexe, Riesen-Reichweite). Jeder Spieler startet mit einer Fähigkeit passend zum Typ. Sie wirken im selbst gespielten Spiel (Test: `node test/ab_test.js`).
- **Pässe**: Der Mitspieler läuft jetzt zum berechneten Treffpunkt (mit echter Ballreibung), auch wenn du ihn nach dem Pass übernimmst; Passfehler von Spielern sind halbiert. Messung (`node test/pass_stat.js`, `pass_human.js`): Ankunftsquote Computer 73 % → 84 %, scriptgesteuerter Spieler 53 % → 73 %.
- **Handy & Touch**: Läuft im Handy-Browser (Quer- und Hochformat). Links irgendwo ziehen = Stick, rechts Tasten Pass / Schuss / Steil / Lupf und Sprint (») – Schuss und Lupf halten zum Aufladen. In allen Modi (Freundschaftsspiel, Karriere, Profikarriere, Turnier, Wettbewerbe, Karten) ist auf einem Touch-Gerät Spieler 1 automatisch „Touch“; Standardsituationen zeigen eigene Touch-Hinweise. Auf Handys startet 3D in der Qualität „niedrig“ (Einstellungen → Ansicht änderbar, oder 2D wählen). Tipp: Seite zum Home-Bildschirm hinzufügen (Vollbild ohne Browserleiste). Test: `python3 test/touch1.py`, `touch2.py` (emulierte Touch-Eingaben; echtes Handy nicht getestet).
- **Spielernamen**: Große Namenslisten (27 Namensgruppen, zusammen mehrere tausend Vor-/Nachnamen, alles frei kombiniert – keine echten Spieler). Jeder Verein nutzt vor allem Namen seines Landes (polnische Klubs polnische Namen, skandinavische skandinavische, griechische griechische usw.), dazu Spieler mit Namen anderer europäischer Herkunft und ein paar „exotische“ (Japan, Korea, Arabische Welt, Afrika, Iran/Zentralasien, Kaukasus, China, Südasien, Südostasien, Ozeanien …). Im Kader gibt es nie zwei gleiche Nachnamen; einige brasilianische/spanische Spieler haben nur einen Rufnamen. Gilt auch für Karten, Transfermarkt und Jugend. Hinweis: Weil die Namen neu gewürfelt werden, sehen Kader in einem alten Spielstand anders aus als zuvor. Test: `node test/names_test.js`.
- **Saudi-Arabien**: Saudi Pro League (18 Klubs der Saison 2026/27, u. a. Al-Hilal, Al-Nassr, Al-Ahli, Al-Ittihad) plus eine 2. Liga (First Division League) und der König-Pokal; überall wählbar (Freundschaftsspiel, Karriere, Manager, Profikarriere, Wettbewerbe). Stärken, Stadien und Farben sind Schätzungen; die 2. Liga ist nur grob zusammengestellt. Keine asiatische Champions League.
- **Vereinsauswahl wie in EA FC**: Oben das Land, in der Mitte der Verein (großes Wappen mit Wertung), unten die Liga – immer nur eins zu sehen, mit Pfeilen ◀ ▶ zum Durchschalten (Wischen über das Wappen geht auch). Beim Freundschaftsspiel stehen Heim und Auswärts nebeneinander (auch auf dem Handy), beim Wechseln eines Landes springt die Auswahl auf dessen erste Liga und besten Verein. „🔍 Verein wechseln“ öffnet dieselbe Auswahl mit Suche, Zufall und Teamwerten (Angriff/Mittelfeld/Abwehr/Tor, Stadion) – so wird auch in Karriere, Profikarriere, Editor, Duell usw. gewählt. Mit Controller: Pfeile mit dem Steuerkreuz anwählen, A drücken. Test: `python3 test/cps_shots.py`.
- **Wechselwunsch in der Profikarriere**: Laufbahn-Tab → „Verein wechseln“. Du wählst einen beliebigen Verein, dein Berater prüft Platz im Kader und Niveau (Leistung und Form helfen) und meldet ein Angebot (Rolle, Gehalt, Laufzeit) oder eine Absage. Zwei Wünsche pro Saison, auch mitten in der Saison. Tests: `node test/pro_req.js`, `python3 test/pro_req_ui.py [m]`.
- **Design-Stile (FIFA 22 / FIFA 24 / FC 27 gemischt)**: Das ganze Spiel hat einen eigenen Look: Hauptmenü als Hub mit Top-Leiste, Reitern (Spielen / Turniere / Mehr) und Kacheln, Neon-Akzente, schräg geschnittene Ecken, kursive Großbuchstaben-Titel, TV-Anzeigetafel mit Vereinsfarben und Spieluhr, Tor-Banner mit Wappen, neu gestaltete Tabellen, Karten, Dialoge und Ergebnisseite. Einstellungen → Design: „Gemischt“ (Standard), „FIFA 22“ (Blau/Cyan, runde Pillen), „FIFA 24“ (Grün/dunkel, Pillen) oder „FC 27“ (Neon-Limette, Schnittecken). Das ist eine eigene Interpretation, keine Kopie der Originale (kein Logo, keine Lizenz). Screenshots: `python3 test/style_shots.py <tag> [mix|f22|f24|f27]`.
- **Controller überall**: alle Menüs, Dialoge, Karriere, Profikarriere, Wettbewerbe, Karten, Turniere und Editor sind mit Steuerkreuz/Stick (A = auswählen, B = zurück, LB/RB = Reiter, Start = Hauptaktion) bedienbar; Bildschirmtastatur für Texte; ein angeschlossener Controller ist in Einzelspieler-Modi automatisch Spieler 1 (Einstellungen → Steuerung). Start/Zurück pausiert, Abziehen pausiert mit Hinweis.
- Tests: `node test/comp_sim.js`, `own_sim.js`, `pro_sim.js`, `lock_test.js`; Browser: `test/browser16.py` (Wettbewerbe), `browser18.py` (Profi), `browser19.py` (eigener Verein), `tpad_*.py` (Controller), `t3d_*.py` (3D, WebGL-Software-Rendering).
- **Grenzen (ehrlich)**: Wettbewerbe nutzen eigene Stärkeschätzungen und generierte Kader, keine Aufstiegs-Playoffs. Der eigene Verein ersetzt in einer Karriere einen echten Verein; spätere Änderungen im Editor wirken nicht auf eine laufende Karriere. Profikarriere: Werte sind Spielschätzungen, Mit-/Gegenspieler sind generiert, Länderspiel-Nominierungen und Turnierteilnahme werden simuliert (der Profi steht bei einem separaten WM/EM-Turnier im Menü nicht im Kader), Rollen-/Bewertungsmodell vereinfacht, Angebote sind heuristisch. 3D und Controller wurden nur mit Software-WebGL und einem simulierten Gamepad getestet – echte Grafikkarte, echtes Handy und echte Controller (z. B. PlayStation-Tastenbeschriftung) sind ungeprüft; die Bildrate auf deinem Gerät kann ich nicht garantieren (bei Rucklern Qualität „niedrig“ oder 2D wählen). Ton startet per Controller-Druck nicht (der Browser verlangt Klick/Taste), Vollbild ebenfalls nicht. In der Artefakt-Version kommt three.js von cdnjs – wird es blockiert, läuft 2D.
