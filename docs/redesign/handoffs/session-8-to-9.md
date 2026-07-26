# Handoff — Mahlzeit-App Rebuild, Session 9

## Kontext in einem Satz

Session 8 hat die Ernährungspräferenzen (Iteration 2), die Zutaten-Datenbank-Migration und einen umfangreichen Dish-Picker mit Filter/Sortierung/Collapse gebaut. 32 Gerichte insgesamt (17 alt + 15 neu), 32 Bilder in `public/dishes/`, alles gepusht auf `origin/redesign`.

## Pflichtlektüre (in dieser Reihenfolge)

1. **`CLAUDE.md`** — projekt-übergreifender Kontext (Guardrails, Konventionen)
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — Rebuild-Spec + Roadmap-Tabelle
3. **`docs/backlog.md`** — Feature-Backlog inkl. Dish-Import + AI-Prompt
4. **`docs/redesign/handoffs/session-7-to-8.md`** — direkter Vorgänger

## Aktueller Repo-Zustand

- **Branch:** `redesign` (auf GitHub gepusht)
- **Letzter Commit:** `ad061d7 feat(picker+settings): dish picker overlay, aligned settings, collapse`
- **Vorheriger Commit:** `68eae74 feat(data+ui): ingredient DB, 15 neue Rezepte, Sheet-Reroll-Pill`
- **Working Tree:** sauber
- **Dev-Server:** läuft nicht — start bei Bedarf mit `npm run dev`
- **Bild-Assets:** `public/dishes/dish-1.jpg` … `dish-32.jpg` (800 px, JPG q72, ~170 KB pro Bild)

## Was in Session 8 gebaut wurde

### Iteration 2 — Ernährungspräferenzen (fertig)

- `dishes.json`: alle 32 Gerichte mit `tags`-Array (`contains-meat/fish/lactose/gluten/egg`)
- `matchesPreferences()` in `reroll.js` filtert Reroll-Pool nach aktiven Diät-Präferenzen
- Settings-Sheet: 3 Filter-Chips (Fleisch/Fisch/Vegetarisch) mit **positiver OR-Semantik**
  — deckungsgleich mit Picker-Chips
- Vegan/Laktosefrei/Glutenfrei entfernt (redundant, wenn's zurück soll: separate Chips oder AND-Filter)
- Fallback: bei < 7 Kandidaten fällt Reroll auf alle Dishes zurück

### Ingredient-DB Migration (Big Bang)

- Neue `src/data/ingredients.json` mit **146 Zutaten** (label, cat, unit, size, note, per_100g)
- Dish-Ingredients referenzieren nur noch `{key, grams, note?}` — Makros werden zur Laufzeit
  in `data/dishes.js` per `enrichIngredient()` aus DB berechnet
- Alte 17 Dishes migriert (Diffs zu vorherigen inline-Werten waren ≤ 5 kcal)
- 15 neue Rezepte aus `docs/Gerichte-Uebersicht.md` (IDs 18–32) ergänzt — Brote wurden ausgelassen
  (840 min Kochzeit ist nicht Meal-Planner-Content)
- Dish-Totals werden im JSON beim Migrations-Skript aus DB berechnet und gespeichert

### Dish-Picker (neues Modul)

- **Edit-Pille oben links** auf jeder Card öffnet das Picker-Overlay für den Tag
- **Bottom-Sheet** analog Detail/Settings (Handle-Bar 28 dp + 40×5 Pill, Close-Button rund 36 dp,
  Swipe-down zum Schließen, fixed 88 vh Höhe)
- **Zwei Filter-Zeilen:**
  - Diät (Fleisch/Fisch/Vegetarisch) — OR-Verknüpfung
  - Attribute (Schnell ≤ 30 min / Wenig Zutaten ≤ 8) — AND
- **Sortierung** bei aktivem Attribut-Filter: Schnell → cooktime asc, Wenig Zutaten → Zutatenzahl asc,
  beide → cooktime primär
- **Sticky Filter-Row** wird beim Scrollen kompakter (Padding + Chip-Höhe schrumpfen)
- **Tile-Kacheln** zeigen Bild + Titel + Meta + Shopping-Pille unten rechts (offene Zutaten-Zahl)
- **Aktuelles Gericht** (dish.id === state.assignment[currentDay]): primary Border + Tint als
  Body-Background + Day-Badge oben links in aktivem Look, wird IMMER angezeigt auch wenn Filter
  nicht matcht
- **Bereits an anderem Tag geplante Gerichte**: 38 % Opacity (nur Bild + Body, Day-Badge bleibt
  voll sichtbar), `pointer-events: none`, `aria-disabled`
- **Vor-Auswahl der Filter** aus globalen Settings: `state.settings.preferences.*` → aktiviert
  entsprechende Picker-Chips beim Öffnen, plus `maxCookTime ≤ 30 → 'fast'`
- Klick auf Tile: `state.assignment[day] = id`, Selection bleibt erhalten (analog rerollDay-Fix)

### Weitere UX-Verbesserungen

- **Detail-Sheet**: Reroll-Pille links neben Einkaufslisten-Pille, wechselt in-place auf neu
  ausgelostes Gericht (Tab bleibt erhalten)
- **rerollDay**: `state.selected[day]` wird NICHT mehr resetted (Tag bleibt in Einkaufsliste
  auch nach Gericht-Wechsel). rerollAll leert weiterhin alles (kompletter Neustart)
- **Card-Pillen** einheitlich 26 dp (Edit oben-links, Portion oben-rechts, Makro unten)
- **Badges M3-konform positioniert**: Bottom-Nav + Card-Zutaten-Badge Zentrum auf Icon-Ecke
- **Progress-Track sichtbar**: neuer `--md-sys-color-primary-track` (teal-getönter Grau statt
  fast unsichtbarem primary-container) für Ring + Shopping-Progress-Bar
- **Statusbar-Icons** bleiben bei System-Darkmode dunkel (Capacitor SystemBars style=LIGHT)
- **Settings-Sections einklappbar** mit Chevron im Header, State transient in Modul-Set

## Aktueller State-Snapshot

```js
state = {
  assignment: { [day]: dishId },       // 1..32
  selected: { [day]: bool },
  portions: { [day]: number },         // 1..6
  checkedShopping: Set<string>,
  dishBag: { [day]: number[] },
  view: 'dashboard' | 'shopping',
  collapsedCategories: Set<string>,
  settings: {
    defaultPortions: 1..6,
    maxCookTime: 20..120,
    preferences: {                     // ← Positive OR-Semantik!
      meat: bool,
      fish: bool,
      vegetarian: bool,
    },
    theme: 'auto' | 'light' | 'dark',  // NOCH NICHT FUNKTIONAL
  },
}
```

`STORAGE_KEY = 'mahlzeit-state-v2'`. Auto-Save am Ende jedes `refresh()`.

## Code-Struktur (neu / geändert)

```
src/
  data/
    ingredients.json          ← NEU: kanonische Zutaten-DB
    dishes.json               ← MIGRIERT: schlanke {key, grams} Referenzen
    dishes.js                 ← REWRITE: reichert Ingredients aus DB an
  dish-picker/                ← NEU
    render.js                 ← Overlay, Filter, Sortierung, Handlers
  settings/
    render.js                 ← Section-Collapse, positive Chip-Semantik
  dashboard/
    card.js                   ← Edit-Pille + onOpenPicker Handler
    render.js                 ← onOpenPicker durchgereicht
    reroll.js                 ← matchesPreferences rewrite, selected bleibt
  detail-sheet/
    render.js                 ← Reroll-Pille im Sheet
  main.js                     ← mountDishPicker + onPick-Callback
  state.js                    ← preferences-Struktur vereinfacht

styles/components/
  dish-picker.css             ← NEU
  card.css                    ← Edit-Pille styling
  settings-sheet.css          ← Section-Toggle Chevron + Body-hidden

public/dishes/
  dish-1.jpg .. dish-32.jpg   ← alle 32 Bilder (800 px, JPG q72)

docs/
  Bilder-Prompts.md           ← NEU: Prompt-Vorlagen für alle 32 Bilder
  Gerichte-Uebersicht.md      ← NEU: User's Rezept-Sammlung als md-Quelle
```

## Wo weitermachen — Iteration-Optionen für Session 9

### Iteration 3 — Küchen-Präferenzen (empfohlener nächster Schritt)

- Neue Section im Settings-Sheet (aktuell "Kommt bald"): Multi-Select bevorzugter Küchen
- Cuisines aus Dishes ableiten: `[...new Set(allDishes.map(d => d.cuisine))]` → aktuell 32 unterschiedliche
  Cuisines, evtl. gruppieren (Asiatisch / Europäisch / Amerikanisch / Nahost / …)
- Semantik: **weighted Pool** (kein harter Filter) — bevorzugte Cuisine bekommt doppelte
  Gewichtung in `shuffled()` beim Reroll. Vermeidet Monotonie
- Optional: Picker-Filter für Küche (positive OR)

### Iteration 4 — Profil + Tageskalorien

- Alter, Größe, Gewicht, Geschlecht, Aktivitätslevel → Mifflin-St Jeor Formel → BMR × PAL
- Ziel-Modus (Halten / Abnehmen / Aufbauen, ±500 kcal Adjustment)
- Makro-Verteilung: Standard 30/40/30 (P/KH/F) oder Custom Slider
- **Anzeige:** Vergleich Ziel-vs-Ist Wochensumme — möglicher Platz: Chip im Header oder eigene
  Section im Dashboard

### Iteration 5 — Dark Mode

- M3 Dark Palette in `tokens.css` — alle `--md-sys-color-*` bekommen Dark-Varianten
- `@media (prefers-color-scheme: dark)` als Auto-Modus
- Manual-Override im Settings: Auto / Hell / Dunkel, gespeichert in `state.settings.theme`
- Body-Klasse via `document.body.dataset.theme = state.settings.theme` für Override
- Beachten: MainActivity.java setzt `setAppearanceLightStatusBars(true)` hart — muss dynamisch werden

### Iteration 6 — Akzentfarbe / Dynamic Color

- Prüfen ob `capacitor-android-dynamic-color` (Community Plugin) wartungsstabil ist
- Falls ja: `WallpaperColors.primaryColor` als CSS-Var für alle primary-basierten Tokens
- Fallback: manueller Farbwähler in Settings (5–6 Presets)

### Iteration 7 — Datenverwaltung

- Export: `state` als JSON zum Download / Clipboard
- Import: JSON parsen, in `state` schreiben, `saveState()`, `refresh()`
- "Alle Daten zurücksetzen" mit Bestätigungs-Dialog

### Iteration ∞ — Gerichte-Import

- Neue "Meine Gerichte"-Section im Settings-Sheet: Formular oder JSON-Paste
- Bild-Handling: Upload → `public/dishes/` (via Capacitor Filesystem Plugin, weil WebView-Kontext)
- Backend würde die neue `ingredients.json` erweitern (neue Zutaten-Keys)

## Constraints (aus CLAUDE.md, aktuell)

- **Kein Framework** ohne Rückfrage — Vanilla JS + ES Modules
- **Keine Tests** (Solo-Projekt)
- **Deutsche UI-Strings**
- **Touch-Targets ≥ 48 px** (Card-Overlay-Pillen 26 dp sind Ausnahme — bewusst kompakt für Overlay-Kontext)
- **Storage-Key `mahlzeit-state-v2`** unveränderlich ohne Migration
- **Package-ID mit `applicationIdSuffix ".dev"`** auf `redesign` — vor Merge auf main zurücknehmen

## Bekannte Environment-Constraints

- **Subagent-Worktree-Dispatch schlägt fehl:** Sandbox verweigert `Agent`-Aufrufe. Direktausführung
- **`curl` im Bash-Sandbox** braucht absoluten Pfad (`/usr/bin/curl`)
- **Gradle** braucht JDK 11+ — nutze `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`
- **Bash `cd android`-Chained Commands** ändern das Working-Directory für Folge-Calls — bei jedem
  Build-Cycle mit vollem Repo-Root-Path arbeiten

## Erster empfohlener Move für Session 9

```bash
git status                                    # sicherstellen: on redesign, clean
git log --oneline main..redesign | head       # inspiziere Commits seit main
cat docs/redesign/handoffs/session-8-to-9.md  # diesen Handoff
```

Danach mit User klären: **Iteration 3 (Küchen-Präferenzen)** starten, oder andere Iteration
priorisieren? Meine Empfehlung: Iteration 3 — sie ergänzt die Diät-Filter aus Iteration 2
konzeptuell (Präferenz-basierte Auswahl), ist überschaubar (weighted Reroll) und liefert
direkt spürbaren Nutzwert.
