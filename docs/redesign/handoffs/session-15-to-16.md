# Handoff — Mahlzeit-App Rebuild, Session 16

## Kontext in einem Satz

Session 15 hat den offenen **StatusBar-Sync**-Trade-off aus Session 14 aufgeloest (Native `AppCompatDelegate.setDefaultNightMode` via eigenes Capacitor-Plugin + `EdgeToEdge`-Runtime-Farben + Anti-Flash-Inline-Script), dazu Dark-Palette konsolidiert, mehrere Pill-Farben angeglichen, den Onboarding-Wizard poliert (Aktivitaet als Slider, Makro-Donut mit quadrierten Anteilen fuer klarere Preset-Unterschiede) und alle 32 Rezepte in `dishes.json` auf einheitliche Zubereitungs-Schritte (Zielkorridor 5-8) gebracht.

## Pflichtlektüre (in dieser Reihenfolge)

1. **`CLAUDE.md`** — projekt-uebergreifender Kontext + Guardrails
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — Rebuild-Spec + Roadmap-Tabelle
3. **`docs/redesign/backlog.md`** — offene Ideen (Favoriten, Kalender-Integration, Multi-Profile)
4. **`docs/redesign/handoffs/session-14-to-15.md`** — Vor-Vorgaenger (Dark Mode, M3-Filled-Cards)

## Aktueller Repo-Zustand

- **Branch:** `redesign` (auf `origin/redesign` gepusht)
- **Session-15 Commits (neueste zuerst):**
  - `content(dishes): zubereitungs-schritte auf einheitliches format`
  - `style(onboarding): makro-donut mit quadrierten anteilen`
  - `feat(onboarding): aktivitaet als slider statt chips`
  - `feat(android): splash-screen im dark-mode auf dark-surface`
  - `style(settings): aktive theme-chip im light auf primary/on-primary`
  - `style(card): edit- und portion-pille auf frosted-glass angleichen`
  - `style(dashboard): bedarfs-pille auf card-farbton mit alpha fuer blur`
  - `feat(theme): statusbar folgt app-theme, palette konsolidiert`
- **Working Tree:** sauber
- **Dev-Server:** `npm run dev` (Port 5173)

## Was in Session 15 gebaut wurde

### Theme-Sync komplett auf App-Kontrolle

- Neues Capacitor-Plugin `Theme` (`android/.../ThemePlugin.java`) mit `setNightMode({ mode: 'yes'|'no'|'follow_system' })`. Ruft `AppCompatDelegate.setDefaultNightMode(...)` auf dem UI-Thread. Bewirkt: Activity-`Configuration.uiMode` folgt dem App-Theme-Toggle, WebView-`prefers-color-scheme` und `MainActivity.applySystemBarAppearance()` reagieren automatisch korrekt.
- `EdgeToEdge.setStatusBarColor`/`setNavigationBarColor` werden aus `applyTheme()` mit dem aktuellen `--md-sys-color-surface` gesetzt — Bar-Background matched jetzt der App-Surface.
- `styles.xml`: veraltetes starres `windowLightStatusBar=true` entfernt (blockierte den Runtime-Setter).
- `capacitor.config.json`: toter `SystemBars`-Config-Block entfernt (kein Plugin dafuer installiert).

### Dark-Palette konsolidiert

- `applyTheme()` loest bei `'auto'` per `matchMedia` zu `'light'`/`'dark'` auf und setzt `data-theme` immer explizit — dadurch reicht ein **einziger** `[data-theme="dark"]`-Palette-Block in `tokens.css`; der frueher noetige `@media prefers-color-scheme`-Zweig entfaellt.
- `header.css` Logo-Filter analog vereinfacht.
- Palette-Werte: neutrales Anthrazit (`#1B1D1F` bis `#3A3E42`), einheitlich fuer Auto und User-Override (vorher divergierten die Auto- und `data-theme="dark"`-Bloecke).

### Anti-Flash beim App-Start

Synchrones Inline-`<script>` im `<head>` von `index.html` liest `mahlzeit-state-v2` aus `localStorage`, resolvet bei `'auto'` per `matchMedia` und setzt `data-theme` bevor die Stylesheets geladen sind. Content-Flash ist eliminiert.

**Weiterhin offen:** Bar-Bootstrap-Flash (~100 ms) bis JS die Bar-Farben setzt — `capacitor.config.json.EdgeToEdge.backgroundColor` startet statisch mit `#f7f8f7`. Wer das flackerfrei will: `MainActivity.onCreate` muesste `SharedPreferences` lesen und Night-Mode + Bar-Background vor `super.onCreate` setzen. Bewusst nicht drin (Doppel-Wahrheit: localStorage vs. SharedPreferences).

Splash-Screen selbst hat jetzt einen `values-night/styles.xml` mit `windowSplashScreenBackground: #1B1D1F` — Splash folgt System-uiMode (nicht App-Override, weil er vor Activity/AppCompatDelegate laeuft).

### Pill-Farben angeglichen (mehrere kleine Runden)

- `.calorie-bar` (Bedarfs-Pille Dashboard) auf `color-mix(surface-container-low 80%, transparent)` statt `--frosted-glass` — Farbton wie inaktive Day-Card, Alpha fuer sichtbaren `backdrop-blur`. Hover-Stufe: `surface-container 80%`.
- `.edit-pill` und `.day-card__portion-overlay .stepper--pill` von `--frosted-glass-strong` auf `--frosted-glass` — angeglichen an die Makro-Pills auf dem Foto. Betrifft Light und Dark (Tokens). `--frosted-glass-strong` wird jetzt nur noch im Dish-Picker verwendet.
- Aktive Theme-Chip in Settings (Auto/Hell/Dunkel) im **Light-Modus** auf `primary`/`on-primary` (kcal-Pille-Look aus `settings-row__value--pill`) — vorher war die Default-Regel `primary-container` zu blass. Dark bleibt `primary-container`.

### Onboarding-Politur

- **Aktivitaet im Wizard Step 2** ist jetzt ein Slider (`min=1 max=5`) analog zum Settings-Sheet-Slider — die 5-Stufen-Skala aus `ACTIVITY_LEVELS` bleibt unveraendert. Label rechts zeigt die aktuelle Stufe live, Abendessen-Vorschau reagiert auf `input`.
- **Makro-Donut im Ergebnis-Screen** dimensioniert die Segmente mit dem **Quadrat** der kcal-Anteile (Legende + Gramm + aria-label bleiben echt). Wirkt visuell staerker: Bei einem Preset mit KH=50 % steht KH klar dominant im Ring, nicht mehr diffus mit 40 % Aussehen. Presets bleiben ernaehrungsphysiologisch korrekt (30/40/30 etc.).

### Zubereitungs-Schritte in `dishes.json` angeglichen

Alle 32 Rezepte auf Zielkorridor **5-8 Schritte** gebracht, Range vorher 3-11:
- **Gekuerzt:** Rinderfilet Toskana (11 → 7), Haehnchen-Skyr-Curry (10 → 8), Haehnchen-Power-Bowl (9 → 8), Garnelen-Wok chinesisch (9 → 8), Murgh-Chana Curry (9 → 7)
- **Verlaengert:** Kabeljau Kartoffelstampf (3 → 5), Bulgogi-Rind (4 → 5), Rinderfilet Chimichurri (4 → 5), Wildlachs Fenchel Bohnen (4 → 5), Garnelen-Fajitas (4 → 5), Wildlachs-Bohnen-Salat (4 → 5)
- **Feingeschliffen:** Wildlachs-Quinoa-Bowl (Wortumfang gestrafft), Wildlachs Miso Bok Choy (Anrichten-Schritt konkret ausformuliert)

Stil-Konvention neu (fuer kuenftige Rezepte): knapp und imperativ, Timing wo relevant ("3-4 Min. pro Seite braten"), Halbgeviertstrich fuer Zeit-Ranges, "Min." mit Punkt.

Verteilung nach der Runde: **5 Schritte 16x, 6 Schritte 5x, 7 Schritte 8x, 8 Schritte 3x**.

---

## Wo weitermachen — Session 16

### Hauptthema: **Eigene Gerichte anlegen (User-generierte Rezepte)**

Bisher ist die Rezept-Datenbasis statisch — alle 32 Rezepte kommen aus `src/data/dishes.json`. Session 16 soll dem User erlauben, eigene Rezepte anzulegen, damit die App ueber die kuratierte Liste hinaus persoenlich wird.

Zwei zusammenhaengende Bausteine:

#### 1. "Favicon" fuer Gerichte im Dashboard

Aktuell haben alle Rezepte ein hochwertiges Foto (die 17 kuratierten Bilder in `www/assets/dishes/`). Fuer eigene Gerichte hat der User selten ein Foto — braucht also einen visuellen Ersatz. Vorschlag: eine kleine **Icon-Kachel** (Emoji oder aus einem Set), die als Fallback dient und im Card-Header sichtbar ist.

Denkbar auch als sekundaeres Element neben Fotos, um Cuisine oder Type (Fisch/Fleisch/Vegetarisch) zu kennzeichnen. Muss beim Session-Start geklaert werden.

#### 2. Eigenes Gericht anlegen

UI-seitig: Ein Add-Button (wo? Settings > Datenverwaltung, oder direkt im Dish-Picker als "+"?). Beim Klick oeffnet sich ein Sheet mit Feldern:
- Name (Pflicht)
- Cuisine (Auswahl aus vorhandenen Gruppen)
- Kochzeit, kcal, P/KH/F (optional oder Pflicht?)
- Tags (aus vorhandenen? oder frei?)
- Zutaten (mit Wiederverwendungs-Check laut Guardrail #8!)
- Zubereitungs-Schritte
- Foto oder Favicon

Persistenz: eigenes Array im State (`state.userDishes`)? Oder ins bestehende `DATA.dishes` einmergen mit `source: 'user'`-Flag? State-Storage-Key bleibt (`mahlzeit-state-v2`), nur zusaetzliche Property.

#### 3. In globalen Filter integrieren

User-Rezepte muessen im Dish-Picker gemeinsam mit den kuratierten auftauchen und von Cuisine-/Preferences-/Makro-Filtern korrekt gefiltert werden. Der Filter-Layer (aktuell `src/dish-picker/filter.js` o.ae.) muss ueber alle Rezepte gehen, nicht nur `DATA.dishes`.

### Offene Design-Fragen fuer Session-Start

1. **Icon-Quelle** — Emoji-Set (kompakt, universell, aber begrenzt bei Rezept-Typen), Material-Symbols (konsistent mit App, aber restaurantfern), oder eigenes SVG-Set (Aufwand)? Ich wuerde zu **Emoji** neigen — schnelle Umsetzung, kein zusaetzliches Asset-Bundle, User waehlt aus einer kleinen Palette (10-15 gaengige: Fisch, Steak, Salat, Suppe, Bowl, Curry, Pasta, Reis, Wok, Grill, ...).
2. **Foto oder Icon: entweder-oder oder beides?** Einfachster Weg: Wenn Foto vorhanden, Foto anzeigen. Sonst Icon-Kachel mit `--md-sys-color-surface-container` als Grund und Emoji zentriert.
3. **Wo sitzt der Add-Button?** Kandidaten: (a) Settings > Datenverwaltung > "Eigenes Rezept anlegen", (b) Dish-Picker mit "+"-Kachel am Anfang, (c) beides. Session-14-Trade-off (User will Rezepte im Kontext des Auswaehlens hinzufuegen) spricht fuer (b).
4. **Persistenz-Struktur** — separates `state.userDishes`-Array oder in `DATA.dishes` einmergen? Erstes ist sauberer (Kuratierte bleiben unveraendert bei Updates, User-Content ist immer klar erkennbar), zweites ist einfacher fuer alle Consumer (Reroll, Filter, Detail-Sheet).
5. **Pflichtfelder** — was ist minimal noetig, damit ein User-Rezept in der App funktioniert? Vorschlag: Name, Cuisine, Kochzeit, kcal + Makros (fuer Bedarfs-Berechnung), Zutaten (fuer Einkaufsliste). Schritte + Tags + Icon optional.

### Vorschlag zum Einstieg

- Session 16 startet mit einem kurzen Brainstorming zu Punkten 1-5
- Danach Entscheidung: Icon-Set festlegen und Icon-Rendering im Card + Detail-Sheet einbauen (kleinerer Vorbereitungs-Schritt) — dann darauf aufbauend das Anlegen-Sheet
- Filter-Integration kommt am Ende (weil sie das Datenmodell braucht das im Anlegen-Sheet definiert wird)

### Andere Kandidaten (falls Prioritaet wechselt)

**Klein (~½-1 Session):**
- **Persoenliche Copy** (~30 min) — `profile.name` in Dashboard-Gruessung und Shopping-Success
- **Datenverwaltung / Iteration 7** (~1 Session) — Export/Import JSON + "Alle Daten zuruecksetzen" mit Bestaetigung
- **Kalender-Integration** (Backlog) — ICS-Export oder Direkt-Eintrag via Capacitor-Plugin
- **Bar-Bootstrap-Anti-Flash** — `SharedPreferences` in `MainActivity.onCreate` (siehe oben, Doppel-Wahrheit-Trade-off)

**Groesser (mehrere ~1 Session):**
- **Akzentfarbe / Dynamic Color** (Iteration 6) — Follow-up zu Dark, Community-Plugin oder manueller Farbwaehler
- **Favoriten-Gerichte** (Backlog) — Herz-Markierung + Weighted-Reroll
- **Multi-Profile** (Backlog, gross) — braucht eigenes Design-Doc

---

## Guardrails-Recap

- **Kein Framework** ohne Rueckfrage — Vanilla JS + ES Modules
- **Keine Tests** (Solo-Projekt) — Node-Simulation fuer Randfaelle
- **Deutsche UI-Strings, Du-Ansprache**
- **Touch-Targets ≥ 48 px**
- **Storage-Key `mahlzeit-state-v2`** unveraenderlich ohne Migration — beim Hinzufuegen neuer Felder (`userDishes`) einfach ergaenzen
- **Package-ID mit `applicationIdSuffix ".dev"`** auf `redesign` — vor Merge auf main zuruecknehmen
- **App-Name `"Mahlzeit Beta"`** auf `redesign` — vor Merge auf main zurueck auf `"Mahlzeit"`
- **Zutaten-Wiederverwendung (Guardrail #8)** — beim Rezept-Anlegen IMMER pruefen ob `key` in `ingredients.json` schon existiert (auch unter leicht anderem Namen). Fuer User-Rezepte besonders wichtig, weil sonst Einkaufsliste doppelt zeigt

## User-Preferences (Feedback-Memories)

- **APK-Build nur auf Anfrage** — kein automatisches Gradle nach jedem Build
- **Progress-Framing** — Zaehler in "erledigt/gesamt" statt "offen/gesamt"

## Bekannte Environment-Constraints

- **`curl` im Bash-Sandbox** braucht absoluten Pfad (`/usr/bin/curl`)
- **Gradle** braucht JDK 11+ — nutze `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`

## Erster empfohlener Move fuer Session 16

```bash
git status                                        # sauber, on redesign
git log --oneline eb3da14..HEAD                   # Session-15 Commits ansehen
cat docs/redesign/handoffs/session-15-to-16.md    # diesen Handoff
```

Dann Design-Fragen 1-5 durchgehen, danach mit Icon-Rendering im Card starten.
