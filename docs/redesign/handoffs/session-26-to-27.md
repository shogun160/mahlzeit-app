# Handoff — Session 26 → 27 (Mahlzeit-App)

## Fokus Session 26: Wizzard-Umbau, State-Umbau, Nährstoff-Details-Redesign

Session 26 hat drei größere Redesigns durchgezogen (Wizzard, State-Modell, Nährstoff-Sheet) plus zahlreiche Feinschliff-Punkte aus dem live-Test. Ergebnis liegt als **Version 1.5.0-beta (versionCode 20)** auf `beta`. Alle Screenshot-Roadmap-Punkte aus Session 23 sind damit abgeschlossen.

## Commit-Referenz

Session-Commit: `2b1a06c feat: session 26 abschluss — wizzard/settings/naehrstoff/state umbau`

Enthält 21 modifizierte Dateien (~1600 insertions, ~347 deletions). Vorheriger Stand von `beta` (und `main`) war `abc97cc`.

## Was passierte im Detail

### 1. Wizzard — kompletter Flow-Umbau

- **Header** bekam **Undo + Reset** links neben Schließen-Button. `undoStack` = Snapshot-Array (`{ draft, prefs, cuisines, macroPreset }`) pro Slider-Drag-Start / Chip-Klick / Step-Wechsel. Reset restauriert den `initialDraft`-Snapshot vom Wizzard-Open.
- **Step 1 „Über dich"**: „Standard"-Preset-Chip beim Geschlecht **komplett entfernt** (Handler + Chip + DEFAULT_USER-Import raus). Name-Input auf pill-Rundung (`--radius-pill`).
- **Step 2 „Alltag"** komplett umgebaut:
  - Neuer **Abendessen-Slider** (0..2500 kcal, Range gleich für alle drei Slider) über dem Profi-Ausklappen. Wert-Anzeige als Pill (`onboarding-field__value--pill`).
  - `<details>`-Section **„Profi-Einstellungen"** (immer collapsed-open) mit Fr+Mi-Slidern. Chevron als SVG (statt CSS-Border). Reset-Icon rechts (nur sichtbar bei Abweichung von Sollwerten 25 % / 35 %). Ohne Rahmen (Section-Header-Style).
  - **Dinner-Slider hat Vorrang**: bei Änderung werden Fr+Mi anteilig via `distributeFrLu` neu verteilt (erst Über-/Unter-Sollwert-Deltas ausgleichen, dann Rest gleichmäßig).
  - **Constraints**: Dinner ≥ 500 kcal, Dinner ≤ Daily; Fr+Mi ≤ Daily − 500. Toast + Clamp bei Verletzung.
  - Preview-Text „Dein Abendessenkontingent" entfernt (Wert steht in der Pill oben).
- **Step 3 „Filter"**:
  - Divider zwischen Kategorien (`onboarding-divider`).
  - Ernährungspräferenzen **linksbündig-wrapping**, Küchen- + Makro-Chips **horizontal scrollbar** (`--nowrap`).
  - **Makro-Preset-Auswahl** rendert jetzt den Donut+Legende (`renderMacros(macros, { withLabel: false })`) statt Pills. Legende in fixen Spalten (`onboarding-macro-legend__num` mit `min-width: 3ch`) — 2- vs 3-stellige Werte springen nicht mehr.
- **Step 4 „Zusammenfassung"**:
  - Tagesziel-Slider entfernt.
  - Titel = **Mahlzeit-Schriftzug** (Logo als `<img>` mit Light/Dark-Filter, `height: 2.8em`) + Username-Span kursivrücker via `translateY: 0.3em` (nicht fett, ohne Punkt).
  - „Lass es dir schmecken!" als Desc darunter.
  - Tagesbedarf- und Abendessen-Kacheln jetzt strukturell identisch (`card-header`-Wrapper auch bei Abendessen).
  - Neuer Button **„Weiteres Profil hinzufügen"** (`settings-profile-add`-Style, dashed Border) — persistiert Draft, ruft `startSubProfileWizard`.
- **Dividers** nach Description-Zeile in Step 1, 2, 3 (Step 4 hat keinen).

### 2. Nährstoff-Details-Sheet (`macro-popup.js`) — Redesign

- Titel **„Deine Woche"** (statt „Nährstoff-Details").
- **Header-kcal-Pille** oben rechts: Format `Ø n/7 · 1.032 kcal` (n = markierte Tage). Bei Fresh Install fehlender avg → Pille versteckt (`:empty`).
- **Chart-Intro-Zeile** über dem Balken-Chart:
  - Label **„Sollwert"** + Pill mit kcal-Range in **Inaktiv-Style** (transparente Füllung, primary-Border). Beide Pillen (Header + Sollwert) auf **`width: 200px`** fixiert — exakt gleich breit, mittig ausgerichtet.
  - Rechts-Alignment via `padding-right: 52px` auf der Intro-Row (kompensiert den fehlenden Close-Button).
  - Hinweistext dezent darunter: „Die Ø Ist-Werte berechnen sich auf Basis der markierten Gerichte."
- **Balken-Chart**: Ø-Balken auch bei 0 selected Tagen (Fallback = Durchschnitt aller 7 Tage), ausgegraut via `macro-chart__bar--muted`. Bei Fallback auch Pillen unten dezenter (`macro-avg-row--muted`, opacity 0.55) — im späteren Umbau nicht mehr sichtbar (siehe unten).
- **Ist-Werte-Bereich** (unter dem Chart):
  - Kreisdiagramm links + Farb-Legende rechts (`renderMacros(avg, { withLabel: false })`, geteilte Impl mit Wizzard).
  - Legende nutzt `.onboarding-macro-legend__num` mit `min-width: 3ch` + `.onboarding-macro-legend__sep` — Werte in fixen Spalten, ·-Trenner immer an gleicher X-Position.
  - Format `81 g · 32 %` (normale Leerzeichen, nicht mehr `&thinsp;`).
- **Sollwerte-Bereich** (unter Divider):
  - Section-Titel **„Makro Sollwerte"** (kein Preset-Name mehr im Hint — der aktive Chip spricht für sich).
  - Kreisdiagramm der Sollwerte (`renderSollMacros(dinnerMacroTargets())`).
  - Label **„Makro Profil"** darunter (Style analog Hint-Text, `0.75rem` on-surface-variant).
  - Preset-Chips (Ausgewogen/Proteinreich/Kohlenhydratarm/Fettarm) darunter, `nowrap` scrollbar.
- **3 Slider komplett raus** (früher unter den Preset-Chips) — durch das Kreisdiagramm ersetzt. `renderMacroSlider`-Funktion bleibt im Code, wird aber nicht mehr aufgerufen.
- **Abstände**:
  - `.macro-body` gap 16 → 8 px, `.macro-controls` gap 16 → 8 px.
  - `.macro-controls` `margin-top: 12px` + `padding-top: 20px` (deutlicher Abstand Ist-Diagramm → Divider → Überschrift).
  - `.macro-chart-intro` `margin-bottom: -20px` (Chart rutscht direkt an den Hinweistext).
- **Sheet-Höhe** von `max-height: 92vh` auf **`height: 88vh`** (einheitlich mit Einstellungs-Sheet).
- **Farb-Swap global** in `tokens.css`: **F ist jetzt rot** (`#B91C1C`), **P ist blau** (`#2563EB`). KH bleibt amber. Betrifft Chart, Donut, Legende überall.

### 3. State-Umbau — Fresh Install ohne User

- **Init-Defaults** in `state.js`: `profiles: []`, `activeProfileId: null`, `profile: null`. Kein automatisches Blank-`u1`-Profil mehr.
- **`getActiveProfile()`** hat Fallback: bei leerem `profiles` → `getStandardProfile()`. Alle Consumer (Bedarfs-Pille, Skalierung, Makro-Popup, Card-kcal) rechnen mit DGE-Werten aus Standard-Profil. Bug bei Fresh Install (calorie-bar.js liest `state.settings.profile` direkt → null → crash) gefixt: liest jetzt via `getActiveProfile()`.
- **`removeProfile(id, { force })`** mit optionalem force-Flag — umgeht Guards („nur ein Profil da", „aktives Profil geschützt"). Nutzt der Wizzard beim Rollback.
- **`loadState()`** Migration: Legacy-Path `[normalizeProfile(loadedProfile, 'u1')]` nur wenn `loadedProfile` nicht-leer; sonst `profiles = []`.

### 4. Wizzard + Profil-erst-bei-Fertig

- Neuer Flag **`wasNewlyCreated`** in wizard.js. Wird gesetzt bei:
  - `openOnboardingWizard({addProfile: true})` (Settings „Profil hinzufügen")
  - `openOnboardingWizard()` mit leerer `profiles`-Liste (Erst-Setup)
  - `startSubProfileWizard()` (weiteres Profil aus Wizzard-Ende)
- `persistAndClose()` (X-Klick vor Fertig): wenn Flag gesetzt → `removeProfile(editingProfileId, { force: true })`. Kein halbfertiges Profil in `profiles`.
- `finishAndClose()`: setzt Flag auf false BEVOR persist (kein Rollback mehr möglich). Danach ruft `rerollAll()` + `onExternalChange()` (Auto-Reroll, siehe unten).
- `onWizardImported`: räumt das temporäre Profil weg wenn Import erfolgreich (analog Sub-Wizzard-Ersetzung).
- **Neuer Profil-Init über `addProfileFromStandard()`**: kopiert Gender/Age/Height/Weight/Aktivität/Ziel/Fr/Mi/Overrides/Präferenzen aus dem Standard-Profil (statt Blank).

### 5. Neue `dinnerTarget`-Regel

- Prioritäten: **1) `dinnerKcalOverride`** (Slider im Profil-Sheet, gewinnt immer). **2) Profi-Modus** (`bf > 0 || lu > 0`): `max(500, daily - bf - lu)`. **3) Standard-Modus**: `Math.round(daily * 0.35)` (35 % DGE-Empfehlung).
- Konstanten: `DINNER_STANDARD_SHARE = 0.35`, `DINNER_MIN_KCAL = 500`, `DINNER_KCAL_MIN = 300`, `DINNER_KCAL_MAX = 2500`.
- **Migration** `normalizeProfile`: alte `breakfastKcal === 550` und `lunchKcal === 770` (Legacy-Wizzard-Defaults) werden auf `null` migriert — greift die 35-%-Regel. User-eigene Werte bleiben (dann Profi-Modus).
- **`kcalRangeRounded(value)`** helper — auf 10 kcal gerundet für UI-Anzeigen. Genutzt in `profileKcalLine`, calorie-bar, profile-detail-sheet formatRange. Sorgt für Konsistenz zum Wizzard („800 – 1050" überall gleich, kein „797 – 1047").

### 6. Standard-Profil-Sheet

- Body zeigt nur noch: **InfoRow + Gender-Chips + Age-Stepper + Abendessen-Field (Pill + Slider)**.
- Gender-Wechsel setzt `heightCm`/`weightKg` automatisch auf Bevölkerungs-Median je Geschlecht (`applyDefaultBiometrics`) + clart `dinnerKcalOverride`.
- **Info-Row-Text kontext-abhängig**: mit User-Profilen „Wird für zusätzliche Personen benutzt…"; ohne User-Profile „Für weitere Einstellungen wird ein Nutzerprofil benötigt."
- Bei letzterem Fall neuer Button **„Profil hinzufügen"** (Style: `settings-profile-add`, dashed Border, `+`-Icon). Klick öffnet Wizzard im addProfile-Modus.
- Standard-Profil-Card in Settings zeigt jetzt drag-Handle (visuell, `pointer-events: none`) + Name-/Meta-Struktur wie normale User-Rows. Dashed Border in outline-color (nicht mehr primary).
- Card-Meta: **`profileKcalLine()`** (Abendessen-kcal-Range) statt Alter/Größe/Gewicht/Ziel.

### 7. User-Profil-Sheet (nicht-Default)

- Body-Reihenfolge: **Aktiv-Toggle → Name → Alter → Gewicht → Aktivität → Ziel → Ernährungspräferenzen → Küchenpräferenzen → Abendessen-Field → Details/Ändern-Row → Profil teilen → Löschen**.
- **Aktiv-Toggle** (M3-Switch statt „Als aktiv setzen"-Button): off-Klick bei nur 1 Profil → Toast „Mindestens ein Profil muss aktiv sein"; sonst wechselt Aktiv-Status.
- **Undo + Reset im Header** (analog Wizzard). `initialProfile` = Snapshot beim Sheet-Open. `undoStack` = Snapshots vor jedem Slider-Drag / Chip-Klick / Toggle. Reset restauriert `initialProfile` (alte willkürliche Reset-Logik entfernt).
- **„Ändern"-Button** in einer neuen Row „Details – Weitere Einstellungen im Einrichtungsassistent ändern" — schließt Detail-Sheet, öffnet Wizzard im `editProfileId`-Modus (neu unterstützt).
- **User-Rows in Settings** zeigen jetzt `profileKcalLine` (Abendessen-Bereich) statt Alter/Größe/Gewicht/Ziel. `profileMetaLine` + `GOALS`-Import raus.

### 8. Einkaufsliste + Picker

- **Kategorie-Counter** positives Framing: `openCount/total` → `doneCount/total` (5/5 im Done-State statt 0/5).
- **Leftover-Semantik** im Counter: Soll = nur non-Leftover; Haben Fall 1 (min. ein non-Leftover offen) = abgehakte non-Leftover; Haben Fall 2 (alle non-Leftover abgehakt oder keine) = alle abgehakten inkl. Leftover. Ergibt z. B. `4/0` bei Kategorien mit nur Leftover-Zeilen.
- **Picker-Cart-Badge** auch bei `openCount === 0` sichtbar (wenn `isInCart` — Gericht ist im Warenkorb). Aria-Label „Alle Zutaten gekauft". Reihenfolge Zahl → Icon (statt Icon → Zahl).
- **Aktueller Tag** im Picker jetzt **immer in „Bereits geplant"** einsortiert (statt Highlight im Main-Grid). Sortierung mit `dayForOverflow` inkl. currentDay. Tile ausgegraut (`picker-tile--disabled`, `pointer-events: none`). Alte `.picker-tile--current`-CSS-Regel entfernt.

### 9. Settings-Sheet Sonstiges

- **Sheets alle auf `height: 88vh`**: `profile-detail-sheet.css` (statt 92vh), `profile-share-sheet.css` (share/import/add-choice), `profile-share-sheet.css:update-sheet`.
- **Neuer Toggle in Darstellung**: „Bedarfs-Pille im Dashboard" (globaler `showDashboardCalorieBar`) + „Makros im Dashboard" (`showDashboardMakros` — schaltet die kcal+P/KH/F-Pillen auf Day-Cards). Beide als M3-Switch.
- **Reihenfolge Profile-Section**: `User-Rows → Standard-Profil-Row → Profil hinzufügen`.
- **„Standard-Personenzahl"** umbenannt zu **„Personen"** mit Untertitel „Für wieviele kochst du normalerweise?".
- **Akzentfarbe-Note** entfernt.

### 10. Auto-Reroll bei Präferenz-Änderung

- Nach `finishAndClose` im Wizzard: `rerollAll()` + `onExternalChange()`.
- Im Profile-Detail-Sheet: `hasProfileChanges`-Flag wird bei Präferenz-Slidern/Chips (Gender, Ziel, Gewicht, Aktivität, Fr, Mi, Dinner-Override, Prefs, Cuisines, Show-Bar) gesetzt via `markProfileChanged()`. NICHT bei Toggle-Active oder Name-Input. Bei `closeProfileDetailSheet` triggert `rerollAll()` wenn Flag.
- Settings-Kochzeit-Slider `change`-Event ruft zusätzlich `rerollAll()` (neuer Pool sofort greifbar).

### 11. Sonstige Fixes / Feinschliff

- `calorie-bar.js` liest via `getActiveProfile()` (Fresh-Install-Crash-Fix).
- `syncSliderValues` und `syncSollDonut` im macro-popup nutzen `dinnerMacroTargets` (nicht mehr `effectiveMacroTargets` = Tages-Werte). Bug behoben: Slider zeigten 2200 kcal-Summe statt ~800.
- Reihenfolge Sollwerte-Slider (bevor sie durch Donut ersetzt wurden): Fett → Protein → Kohlenhydrate (matcht Legende).

## Version-History Session 26

| Version | versionCode | Was |
|---|---:|---|
| 1.5.0-beta | 20 | Session-26-Abschluss auf `beta`, APK gebaut |

Vor Session 26: 1.4.6 stable (versionCode 19).

## Branch-State beim Session-Ende

- **`beta`** = **`origin/beta`** = `2b1a06c` (Session-26-Commit)
- **`main`** = **`origin/main`** = `abc97cc` (unverändert seit Session 25)
- **beta ist damit 1 Commit vor main** — sollte bei Session-27-Start beachtet werden.
- Working tree clean auf `beta`, `main` nicht ausgecheckt.

## APK-Zustand

- **Beta-APK 1.5.0-beta** (versionCode 20) auf `beta` gebaut.
- Datei: `android/app/build/outputs/apk/debug/app-debug.apk` (33 MB).
- Nicht auf's Handy übertragen — der User macht das manuell.
- `remote-config.js` zeigt auf `main` (Prod-Content) — Beta zieht denselben Rezept-Bestand wie Stable.

## Bekannter Test-Bedarf für Session 27 (Live-Test der Beta)

Was in Session 26 nur im Dev-Server (Vite/Browser) getestet wurde. Bitte in der Beta-APK auf'm Handy prüfen:

- **Fresh-Install-Flow**: App-Daten löschen → Wizzard startet automatisch → X klicken → keine Profile in Settings, App läuft mit Standard-Profil-Werten (Bedarfs-Pille versteckt weil `standardProfile.showCalorieBar = false`).
- **„Weiteres Profil hinzufügen"-Rollback**: Wizzard von Zusammenfassungs-Button starten → X klicken → das temporäre Profil wieder weg?
- **Auto-Reroll**: an Präferenzen ändern (Ziel wechseln im Profil-Sheet, Kochzeit-Slider) → Wochenplan wirklich neu?
- **Undo im Wizzard/Profil**: nach mehreren Slider-Bewegungen zurückrollen — funktioniert der Snapshot-Stack konsistent?
- **Multi-Person-Flow**: Wizzard „Weiteres Profil hinzufügen" mehrfach durchlaufen, dann in Settings sortieren + löschen.

## Offen für Session 27 — Priorität hoch

### 🟢 Ziel-orientierter Reroll (aus Backlog)

**Neu im Backlog dokumentiert** (siehe `docs/redesign/backlog.md` letzter Eintrag „Ziel-orientierter Reroll — Woche komponiert kcal + Makros zum Sollwert"). Verantwortlich für die Delta-Soll-Ist-Diskrepanz im Nährstoff-Sheet die der User in Session 26 bemängelt hat.

**Kern-Frage:** Wie werden Gerichte gezogen, damit am Ende der Woche der Sollwert-Bereich kcal + Makro-Verteilung erreicht sind?

- Aktuell: `rerollAll` in `src/dashboard/reroll.js` = weighted-shuffle aus dem eligible Pool. kcal-Summe grob (via `dishScale`-Snap ±25 %), Makros zufällig.
- Umsetzungs-Ideen im Backlog: (A) Greedy Swap-Optimierung, (B) Constraint-Search, (C) Balanced Bucketing. Vermutlich A + Tags aus C.
- Fragen zu klären: Cuisine vs. Makro-Priorität, Neu-Rezept-Bias, Performance-Grenze, UI-Feedback.

**Empfohlener Einstieg:** Ansatz A (Greedy Swap) skizzieren → Testfall bauen mit definierten Profil-Sollwerten → messen ob nach N Swaps die Wochen-Delta signifikant sinkt.

### 🟡 Sonstige Backlog-Punkte (mittelfristig)

- **Multi-Person-Skalierung mit Dämpfungsfaktor** — auch neu dokumentiert (Chilis/Petersilie/Öle). Datenmodell-Erweiterung in `ingredients.json`.
- **Kochmodus mit Wake-Lock** + **Timer im Rezept** (Kochmodus-Feature).
- **Rezept-Suche (Text)** im Picker — für 30+ Rezepte relevant.

## Skill-Empfehlungen für Session 27

- Vor Reroll-Algorithmus-Umbau: **`superpowers:brainstorming`** um Ansatz zu wählen (A/B/C-Diskussion).
- Beim Testen der Beta: **`superpowers:systematic-debugging`** wenn Fehler auftauchen.
- Vor Merge beta → main: **`superpowers:verification-before-completion`** — Live-Test durchziehen, Bugs sammeln, dann erst Merge.

## Sonstige Notizen

- **Beta ist vor Main**: nächste Session muss vor jedem beta→main-Merge sicherstellen dass die Live-Tests komplett sind. Aktuell nur Dev-Server getestet.
- **Farb-Swap F↔P** in `tokens.css` betrifft alle Chart/Donut/Legende in der App — falls beim Handy-Test die Farben komisch wirken, hier gucken.
- **`renderMacros` in `onboarding/result.js`** wird jetzt auch vom `macro-popup` genutzt (import). Wenn du dort was änderst, prüfe beide Callsites.
- **Preset-Chip „Fettarm"** taucht in `MACRO_PRESETS` weiter auf, ist aber im Wizzard-Chip-Bereich sichtbar. Konsistent.
- **`renderAverageText` + `fitAvgFontSize`** in `macro-popup.js` sind toter Code (die 4 Pillen-Row wurde durch den Donut ersetzt). Bei Cleanup-Session könnte man's löschen. Aktuell schadet's nicht.
- **Wizzard-Step 4 („Fertig") — Reset-Button** oben links im Header bezieht sich auf den Wizzard-Draft, nicht auf den vergangenen Wochen-Reroll. Falls User confusion: klarer beschriften oder tooltip.
