# Handoff — Mahlzeit-App Rebuild, Session 11

## Kontext in einem Satz

Session 10 hat Iteration 4 (Profil + Tageskalorien) durchgezogen, dabei automatische Rezept-Skalierung eingeführt, die Zutaten-DB aufgeräumt (13 Duplikate fusioniert), Löffel-Anzeige (TL/EL) für Öle/Sauce/Paste ergänzt, den Dish-Picker um kcal-Filter + Wolken-Layout + dyn Font-Fitting erweitert und die Einkaufslisten-Semantik beim Gericht-Wechsel überarbeitet.

## Pflichtlektüre (in dieser Reihenfolge)

1. **`CLAUDE.md`** — projekt-übergreifender Kontext + Guardrail #8 (Zutaten-Wiederverwendung)
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — Rebuild-Spec + Roadmap-Tabelle
3. **`docs/redesign/2026-07-26-session-10-plan.md`** — Session-10 Design (Iteration 4 Kern)
4. **`docs/redesign/backlog.md`** — offene Ideen: Onboarding + Multi-Profile
5. **`docs/redesign/handoffs/session-9-to-10.md`** — direkter Vorgänger

## Aktueller Repo-Zustand

- **Branch:** `redesign` (lokal, **11 commits ungepusht** — komplette Session 10 + Feinschliff)
- **Commits (neueste zuerst):**
  - `d0951ef docs(backlog): onboarding / ersteinrichtung als idee vermerkt`
  - `f4d594d feat(reroll+picker): einkaufsliste-semantik + edit-pill zurück auf 40 dp`
  - `579abca feat(picker): filter-wolke, dyn font-size, korb-status-hervorhebung`
  - `ca51f91 feat(settings): profil-section polish + m3-switch für bedarfs-anzeige`
  - `5962984 feat(picker): sortierung nach status + kcal-filter zur wochen-steuerung`
  - `a3ef35d feat(dashboard): bedarf-pill sticky mit toggle in settings`
  - `9d857ff feat(dishes): chili + karotten in stück, gewürze + sesam in tl-anzeige`
  - `1f04866 fix(shopping): einheiten-schema aufräumen — ml/displayUnit/vorrat mit menge`
  - `9e22ab8 docs(redesign): session 10 plan + backlog für multi-profile-idee`
  - `7b91c87 feat(iteration-4): profil + tageskalorien + rezept-skalierung + ingredient-cleanup`
  - `1600a74 fix(picker+card): sortier-bug wenig zutaten, edit-pill 32dp icon-button`
- **Working Tree:** sauber (Handoff-Update noch ungestagt)
- **Dev-Server:** wenn benötigt via `npm run dev`

## Was in Session 10 gebaut wurde

### Iteration 4 — Profil + Tageskalorien (fertig)

- **`src/nutrition/target.js`** (neu): reine Berechnungen, keine State-Kopplung. Mifflin-St Jeor BMR × PAL ± Adjustment. Range-Fenster (±125 kcal). Dish-Skalierungs-Faktor (0.25-Stufen, Range [0.5, 2.5]).
- **`src/nutrition/scale.js`** (neu): state-abhängiger Convenience-Wrapper. `getScaleForDish(dish)`, `scaledGramsForDay(ing, portions, dish)`.
- **`src/state.js`**: neuer Slot `settings.profile` mit `gender / age / heightCm / weightKg / activityLevel / goal / dailyTargetOverride / breakfastKcal / lunchKcal / showCalorieBar`. Defaults: 40/180/80/level 3/maintain/null/400/700/true.
- **Formel-Bestätigung:** Mifflin-St Jeor (1990) ist laut aktueller Recherche (2026) der Goldstandard für die allgemeine Bevölkerung — ±10% Genauigkeit vom gemessenen RMR.

### Rezept-Skalierung

- Faktor pro Gericht = `dinnerTarget / dish.kcal`, auf 0.25-Stufen gerundet, geklemmt [0.5, 2.5]. Erhalten der Rezept-Vielfalt (fließend würde alle exakt aufs Ziel bringen → identische Card-Zahlen).
- Diskrete Rundung: `ei` auf ganze Stück, `bund / zehe / stueck` auf 0.25-Stufen (¼/½/¾ Portionen).
- Konsistent angewendet auf Card, Detail-Sheet Zutaten + Sum, Einkaufsliste, Wochen-Bar.

### Zutaten-Anzeige: TL / EL / Stück / Bruchglyphen

- Neue Felder `displayUnit` (`"tl" | "el"`) + `gramsPerUnit` in `ingredients.json`. Aktuell gepflegt für alle **Öle, Sauce, Paste, Süßes, Saft, Gewürze, Samen** (insgesamt 26 Zutaten).
- **Nüsse bleiben in g** (bewusste User-Entscheidung: Mandeln/Pinienkerne/Haselnüsse/Erdnüsse).
- `formatIngredientQuantity` (Detail-Sheet): displayUnit → Löffel (0.5-Stufen: "1½ EL"), sonst diskrete Einheiten → Stück (0.25-Stufen: "¼ Gurke", "½ Bund", "1½ Zehen"), sonst g.
- `formatQuantity` (Einkaufsliste): displayUnit → Löffel (aufgerundet auf ganze), vorrat → "Vorrat prüfen" (bei Öl/Sauce/Honig zusätzlich Menge davor: "4 EL — Vorrat prüfen"), ml → "N ml", ei → "Ei/Eier", zehe → "Zehe/Zehen".

### Ingredient-Cleanup

**13 Duplikate fusioniert** (siehe Commit `7b91c87`): petersilie/ingwer/kimchi/orange/pak_choi/gewuerz_ras/sesamoel/currypaste_thai/tortilla_mais/feta/gurke/spinat/linsen_rot — plus mais_dose_neu und miso_neu als Zombies gelöscht, mais_kolben mit korrektem Label wiederhergestellt.

**Zusätzlich in Session 10 umgestellt:**
- Chili frisch → stueck (size 6)
- Karotten bunt → stueck (size 70, konsistent mit `karotte`)

Neue **Guardrail #8 in CLAUDE.md**: beim Rezept-Anlegen IMMER prüfen ob der ingredient-Key existiert. Verhindert weitere Drift-Duplikate.

### Dashboard-Bar ("Bedarf")

- **`src/dashboard/calorie-bar.js`** (neu): rendert Pille zwischen App-Header und Card-Grid, nur wenn `hasProfile()` UND `showCalorieBar !== false`.
- Layout: `[Bedarf] [1.457 – 1.707 kcal] [Ø 3/7 1.550 kcal]` — Zielkorridor pro Tag, Ist-Durchschnitt der **ausgewählten** Tage (mit userScale skaliert).
- **Sticky-Header** im `.view-dashboard` Scroll-Container: bleibt beim Scrollen der Cards oben sichtbar.
- **Frosted-Glass** wie die Makro-Pillen (rgba(255,255,255,0.78) + backdrop-blur), border-radius pill.
- Farbcodierung: neutral wenn Ø im Korridor, over/under außerhalb.
- **`showCalorieBar`-Toggle** in Settings-Profil-Section als M3-Switch (52×32 dp, gleitender Thumb, aria-checked).

### Dish-Picker Erweiterungen

- **Sortierung im Grid:**
  1. Aktuelles Gericht ganz oben (Ausgangspunkt)
  2. Wählbare Gerichte in der Sort-Reihenfolge (Cooktime / Zutaten / kcal / id)
  3. Blockierte (an anderen Tagen zugewiesen) am Ende, sortiert nach Wochentag Mo→So
- **Neue kcal-Filter-Gruppe:** Kalorienarm (dish.kcal < 950) / Kalorienreich (> 950) — gemessen an Rezept-Basis (Median der 800-1100 Range), NICHT an skaliertem Wert. Sonst wären "arm/reich" nichtssagend weil Skalierung alles nahe ans Ziel bringt.
  - Sortierung: Nur "arm" → aufsteigend nach kcal, nur "reich" → absteigend. Beide inaktiv oder beide aktiv → OR umfasst alles → id-Reihenfolge.
- **Filter-Layout:**
  - Standard-Zeilen (Diät / Attribute / kcal) als **zentrierte Wolke** (flex-wrap + justify-content: center)
  - **Küchen-Zeile (4 Chips):** nowrap (Modifier `.picker-filter-row--nowrap`) — sonst würde die semantische Gruppe zerteilt
  - **Dyn. Chip-Schriftgröße:** JS-Fitter shrinkt font-size von 14 → 10 px in 0.5-Schritten bis die Küchen-Zeile passt. Wert wird per `--picker-chip-font` auf alle Filter-Chips angewendet → konsistente Optik.
- **Shop-Pille (Einkaufskorb-Symbol) auf Tiles** zeigt Aktiv-Look für Gerichte die bereits im Korb liegen (`isDishInCart(id)`: mind. ein `state.selected[day]` Tag mit diesem Gericht).

### Einkaufslisten-Semantik beim Gericht-Wechsel

- **Reroll (Card-Button):** `state.selected[day] = false` → Tag verschwindet aus der Einkaufsliste. `checkedShopping` bleibt komplett unberührt — bereits gekaufte Artikel bleiben abgehakt (Leftover-sichtbar wenn nicht mehr im Plan).
- **Picker (bewusste Wahl):** `state.selected[day] = true` → Tag kommt automatisch in die Liste. `checkedShopping` bleibt ebenfalls unberührt.
- **RerollAll:** unverändert (setzt alle Tage inaktiv, dishBag leert). `checkedShopping` bleibt auch da erhalten.
- `forgetCheckedForOldDish` entfernt (dead code). Die frühere Cleanup-Logik löschte auch gekaufte Artikel — unerwünscht.

### Session-9 Follow-Up-Bugfixes (davor)

- **Picker "Wenig Zutaten"-Filter/Sort:** nutzt jetzt `openIngredientCount(dish)` (offene, nicht abgehakte), identisch zur Pille auf dem Tile. Kein Ranking-Mismatch mehr.
- **Detail-Sheet Zutaten-Sortierung:** Reihenfolge nach Kategorie (`fleisch_fisch → frisch → trocken → kuehlung → gewuerze → oel → sonstig`) — Rezept-Logik, bewusst anders als Einkaufsliste (Einkaufsweg-Logik).

### Diverse Feinschliff-Änderungen (Settings-Profil-Section)

- `.settings-field`-Wrapper um Label+Slider (gap 4px innen, 16px zwischen Feldern). Alle Slider kleben unmittelbar am Label.
- Rows mit sekundärem Label bekommen `align-items: flex-end` per `:has()`-Selektor (Tagesziel).
- Tagesziel: Label-Primary + "Vorschlag: 2.182 kcal" **inline** in einer Zeile (Modifier `.settings-row__label--inline`).
- "Abendessen" (nicht "(Rest)") als aktive Pill (primary bg).
- `--md-sys-color-outline` ergänzt in tokens.css (#8B95A2) — fehlte vorher komplett.

## Aktueller State-Snapshot

```js
state = {
  assignment: { [day]: dishId },
  selected: { [day]: bool },
  portions: { [day]: number },
  checkedShopping: Set<string>,
  dishBag: { [day]: number[] },
  view: 'dashboard' | 'shopping',
  collapsedCategories: Set<string>,
  settings: {
    defaultPortions: 1..6,
    maxCookTime: 20..120,
    preferences: { meat, fish, vegetarian },
    cuisines: { asian, mediterranean, middleEast, americas },
    profile: {
      gender: 'male'|'female'|null,
      age: number | null,        // Default 40
      heightCm: number | null,   // Default 180
      weightKg: number | null,   // Default 80
      activityLevel: 1..5,       // Default 3
      goal: 'maintain'|'lose'|'gain',
      dailyTargetOverride: number | null,  // manuelle Slider-Übersteuerung
      breakfastKcal: number,     // Default 400
      lunchKcal: number,         // Default 700
      showCalorieBar: bool,      // Default true
    },
    theme: 'auto',               // noch nicht funktional
  },
}
```

`STORAGE_KEY = 'mahlzeit-state-v2'` unverändert.

## Code-Struktur (Deltas Session 10)

```
src/
  nutrition/                    ← NEU
    target.js                   ← BMR/Ziel/Range/dishScale/scaledGrams
    scale.js                    ← state-abhängige Wrapper
  dashboard/
    calorie-bar.js              ← NEU: Bedarfs-Pill Renderer
    card.js                     ← getScaleForDish anwenden
    render.js                   ← calorie-bar mounten
    reroll.js                   ← selected=false beim Reroll
  detail-sheet/
    ingredients.js              ← formatIngredientQuantity + Skalierung
  dish-picker/
    render.js                   ← Sortierung + kcal-Filter + Wolke + dyn-font
  data/
    dishes.json                 ← Duplikate fusioniert
    dishes.js                   ← displayUnit/gramsPerUnit durchreichen
    ingredients.json            ← 13 Fusionen + displayUnit für Löffel/TL
    ingredient-registry.js      ← displayUnit/gramsPerUnit durchreichen
  settings/
    render.js                   ← Profil-Section, M3-Switch, Layout-Polish
  shopping-list/
    consolidate.js              ← Skalierung + displayUnit + vorrat-sum
    check.js                    ← forgetCheckedForOldDish entfernt
  state.js                      ← profile-Slot
  main.js                       ← Picker onPick: selected=true

styles/
  components/
    calorie-bar.css             ← NEU: sticky pill
    card.css                    ← edit-pill 40 dp
    settings-sheet.css          ← settings-field, m3-switch, label-inline
    dish-picker.css             ← filter-cloud, nowrap, chip-font
  tokens.css                    ← --md-sys-color-outline ergänzt

util/format.js                  ← formatIngredientQuantity + Fraction-Glyphen
docs/redesign/
  2026-07-26-session-10-plan.md ← Iteration-4 Design
  backlog.md                    ← Multi-Profile + Onboarding
  handoffs/session-10-to-11.md  ← DIESER HANDOFF
```

## Verifikation

- **Vite Build:** alle Module laden sauber, kein Import-Fehler
- **APK-Build:** funktioniert
- **Node-Sanity-Tests:**
  - `dishScale(700, 1582) = 2.25` (skaliert 1575 kcal, im Range 1457-1707)
  - `formatIngredientQuantity({unit:'bund',size:30}, 45)` → "1½ Bund"
  - `formatQuantity({unit:'vorrat', displayUnit:'el', gramsPerUnit:14, sum:45})` → "4 EL — Vorrat prüfen"
- **Manueller Browser-Test durch User** — mehrfach iteriert, jede UI-Feedback-Runde einzeln validiert.

## Wo weitermachen — Iteration-Optionen für Session 11

### Kleine Follow-Ups

- **Onboarding / Ersteinrichtung** (siehe `backlog.md`): First-Run-Wizard oder On-Screen-Anleitung um den User durch die Profil-Eingabe zu führen. Kurz greifbar wenn Profil-Section stabil ist.
- **Multi-Profile** (siehe `backlog.md`): mehrere Nutzer-Profile, per-Tag Diner-Assignment, skalierung pro Person. Größerer Umbau — braucht State-Erweiterung.

### Iteration 5 — Dark Mode

- M3 Dark Palette in `tokens.css` — alle `--md-sys-color-*` bekommen Dark-Varianten
- `@media (prefers-color-scheme: dark)` als Auto-Modus
- Manual-Override im Settings: Auto / Hell / Dunkel, gespeichert in `state.settings.theme`
- `document.body.dataset.theme = state.settings.theme` als Override-Hook
- **Beachten:** MainActivity.java setzt `setAppearanceLightStatusBars(true)` hart — muss dynamisch werden

### Iteration 6 — Akzentfarbe / Dynamic Color

- Prüfen ob `capacitor-android-dynamic-color` (Community Plugin) wartungsstabil ist
- Falls ja: `WallpaperColors.primaryColor` als CSS-Var für alle primary-basierten Tokens
- Fallback: manueller Farbwähler in Settings (5-6 Presets)

### Iteration 7 — Datenverwaltung

- Export: `state` als JSON zum Download / Clipboard
- Import: JSON parsen, in `state` schreiben, `saveState()`, `refresh()`
- "Alle Daten zurücksetzen" mit Bestätigungs-Dialog

### Iteration 4b (Follow-Up zu Session 10) — Makro-Ziele

- P/KH/F-Verteilung ergänzen (30/40/30 Standard, konfigurierbar)
- Ist-vs-Ziel-Vergleich pro Makro in der Wochen-Bar oder eigener Ansicht

### Iteration ∞ — Gerichte-Import

- Neue "Meine Gerichte"-Section im Settings-Sheet: Formular oder JSON-Paste
- Bild-Handling: Upload → `public/dishes/` (via Capacitor Filesystem Plugin)
- Zutaten-Wiederverwendung erzwingen (Guardrail #8): existierende Keys anbieten statt neu anlegen

## Constraints (aus CLAUDE.md, aktuell)

- **Kein Framework** ohne Rückfrage — Vanilla JS + ES Modules
- **Keine Tests** (Solo-Projekt) — Node-Simulation für Randfälle
- **Deutsche UI-Strings**
- **Touch-Targets ≥ 48 px** (Ausnahme: Card-Overlay-Pillen 26 dp, edit-pill 40 dp)
- **Storage-Key `mahlzeit-state-v2`** unveränderlich ohne Migration
- **Package-ID mit `applicationIdSuffix ".dev"`** auf `redesign` — vor Merge auf main zurücknehmen
- **Zutaten-Wiederverwendung (Guardrail #8)** — beim Rezept-Anlegen immer prüfen ob key existiert, keine Drift-Duplikate

## User-Preferences (Feedback-Memories)

- **APK-Build nur auf Anfrage** — kein automatisches Gradle nach jedem Build. `npm run build && npx cap sync` reichen.
- **Progress-Framing** — Zähler in "erledigt/gesamt" statt "offen/gesamt" (positive Framing)

## Bekannte Environment-Constraints

- **Subagent-Worktree-Dispatch schlägt fehl:** Sandbox verweigert `Agent`-Aufrufe. Direktausführung
- **`curl` im Bash-Sandbox** braucht absoluten Pfad (`/usr/bin/curl`)
- **Gradle** braucht JDK 11+ — nutze `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`

## Erster empfohlener Move für Session 11

```bash
git status                                        # sauber, on redesign
git log --oneline origin/redesign..redesign       # 12+ commits ungepusht
git push                                          # nach User-Bestätigung
cat docs/redesign/handoffs/session-10-to-11.md    # diesen Handoff
```

Danach mit User klären: **Iteration 5 (Dark Mode)** angehen als sichtbarer Quick-Win, oder eines der Follow-Ups (Onboarding, Makro-Ziele, Datenverwaltung)? Meine Empfehlung: **Onboarding**, weil das die Iteration 4 komplettiert (User's-Weg vom App-Start bis zur Bedarfs-Anzeige durchgängig). Dark Mode als zweite Option — sichtbar, gut greifbar, aber MainActivity-Statusbar-Komplikation.
