# Handoff — Mahlzeit-App Rebuild, Session 10

## Kontext in einem Satz

Session 9 hat Iteration 3 (Küchen-Präferenzen als **Hard-Filter**) plus umfangreichen UI-Feinschliff für Picker, Settings-Sheet und Einkaufsliste umgesetzt (Sticky-Header-Stapel, smart Klick-Verhalten, Expand/Collapse-All, Section-Summaries).

## Pflichtlektüre (in dieser Reihenfolge)

1. **`CLAUDE.md`** — projekt-übergreifender Kontext (Guardrails, Konventionen)
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — Rebuild-Spec + Roadmap-Tabelle
3. **`docs/redesign/2026-07-26-session-9-plan.md`** — Session-9 Design + Entscheidungen (dort ist die Küche noch als Weighted-Filter dokumentiert — im Laufe der Session zu Hard-Filter geändert, siehe unten)
4. **`docs/redesign/handoffs/session-8-to-9.md`** — direkter Vorgänger

## Aktueller Repo-Zustand

- **Branch:** `redesign` (lokal, **nicht gepusht** — Session 9 ist 3 commits ahead)
- **Commits (neueste zuerst):**
  - `0fb82da feat(picker+settings): hard-filter für küche, sticky-fixes, expand/collapse`
  - `b2b6371 feat(iteration-3): küchen-präferenzen mit weighted reroll (3×)`
  - `f59aa81 docs(redesign): session 9 plan — iteration 3 küchen-präferenzen`
- **Working Tree:** sauber (Handoff-Update noch ungestagt)
- **Dev-Server:** lief zuletzt auf `http://localhost:5176/` — starte bei Bedarf neu mit `npm run dev`

## Was in Session 9 gebaut wurde

### Iteration 3 — Küchen-Präferenzen (fertig)

- `src/data/dishes.json`: alle 32 Gerichte bekommen `cuisineGroup: "asian" | "mediterranean" | "middleEast" | "americas"`. Feld `cuisine` bleibt unverändert (Card/Detail zeigen weiter granulare Bezeichnung).
- **Bucket-Verteilung:** asian 16, mediterranean 11, middleEast 3, americas 2 (Summe 32).
- `src/data/dishes.js`: neuer Export `weightedShuffle(ids, weightFn)` — gewichteter Fisher-Yates. Wird weiterhin genutzt für die Weighted-Bevorzugung im Reroll-Fallback-Pfad (wenn zu wenig Kandidaten für Hard-Filter).
- `src/dashboard/reroll.js`: **Küche ist Hard-Filter** (statt Weighted wie im Plan-Doc). `eligibleDishIds()` hat zweistufige Fallback-Kaskade: erst mit Cuisine + Diät + Kochzeit, dann ohne Cuisine, dann `allDishIds`. Weighted bleibt aktiv fürs Reroll, wirkt aber nur im Fallback-Fall (dort sind Kandidaten anderer Küchen dabei). — **Grund für Wechsel:** User beobachtete, dass Weighted (75 % asian bei aktivem Chip) sich zu wenig deterministisch anfühlt; Hard-Filter mit Fallback verhält sich wie erwartet, ohne bei kleinen Buckets (Amerikanisch, 2 Rezepte) zu crashen.
- `src/state.js`: neuer Slot `settings.cuisines: { asian, mediterranean, middleEast, americas }`, alle Defaults `false`. `loadState()` mergt fehlende Keys mit `?? false`, Alt-Sessions ohne Feld starten neutral.
- `src/settings/render.js`: Section `kuechen` verliert Placeholder + `settings-section-body--soon`, bekommt 4 Chips über neuen Helper `renderCuisineChip(key, label)`. Handler analog zum Diät-Chip-Handler (`.pref-chip[data-cuisine]`), **invalidiert zusätzlich `state.dishBag`** damit Präferenz-Änderungen sofort beim nächsten Reroll wirken (gilt auch für Diät-Chips und Kochzeit-Slider).

### UI-Feinschliff — Picker, Settings, Einkaufsliste

**Dish-Picker (`src/dish-picker/`):**
- Neue Cuisine-Filter-Zeile (4 Chips: Asiatisch/Mediterran/Nahost/Amerikanisch, OR-Semantik analog Diät)
- Filter-Section ist einklappbar mit "aktiv/gesamt"-Counter im Header (positive Framing, konsistent mit Einkaufslisten-Category-Count)
- **FLACHE Struktur:** Toggle-Header + Body als Geschwister direkt im scrollenden `.picker-body`. Kein `<section>`-Wrapper — sonst würde der sticky Header mit dem Wrapper rausrollen. Dokumentiert im CSS-Kommentar.
- **Smart Klick-Handler** analog Settings/Shopping: Header sticky UND Body nicht mehr sichtbar → `expand + scrollIntoView`; sonst normal togglen mit `scrollTop`-Kompensation gegen Sichtsprung
- **Filter-Chips immer einzeilig** pro Gruppe (`flex-wrap: nowrap` + `overflow-x: auto`, native Touch-Scroll, Scrollbar versteckt) — semantische Gruppe bleibt visuell zusammen
- Counter transparent, rechts vor dem Chevron (`margin-right: auto` auf Titel drückt Counter+Chevron als Gruppe rechts)
- `scroll-margin-top: 44px` auf Body gegen Header-Überdeckung nach `scrollIntoView`

**Settings-Sheet (`src/settings/render.js` + `styles/components/settings-sheet.css`):**
- `<section>`-Wrapper entfernt, flache Struktur analog Shopping (Kommentar mit Warnung zur Wrapper-Falle drin)
- Sticky-Header-Stapel: jeder Section-Toggle bekommt `--stack-idx`, staffelt sich per `top: calc(var(--stack-idx, 0) * var(--settings-section-header-height, 44px))`
- Smart Klick-Handler (siehe Picker) mit Helper `isHeaderSticky` / `isBodyVisibleBelow` / `measureBodySpace`
- **Section-Summary** rechts im Header (Portionen-Zahl, `formatCookTime`, `aktiv/gesamt` für Filter). Transparent (kein Chip-Hintergrund). Sichtbar nur wenn Header sticky UND Body rausgescrollt (`sticky && !bodyVisible`, identische Bedingung zum smart Klick). `updateStickyState()` läuft am `scroll`-Listener und nach jeder Layout-Änderung.
- Alle relevanten Handler rufen `updateSectionSummary(key)` für Live-Update
- **Expand/Collapse-All-Toggle** im Sheet-Header rechts (nur einer sichtbar je Zustand: mind. eine collapsed → Expand; sonst → Collapse). Buttons immer im DOM mit `hidden`-Attribut, `syncHeaderActions()` synct nach jedem Toggle. **Wichtige CSS-Falle:** `.settings-header__action[hidden] { display: none }` explizit — sonst überschreibt `display: inline-flex` das Browser-`[hidden]`-Default.
- `scroll-margin-top: (stack-idx + 1) * header-height` gegen Header-Überdeckung
- **Expand-Handler mutiert inline** (nicht `renderShell()`), weil `renderShell()` das Overlay-DOM inklusive `.is-open`-Klasse ersetzen und dann Slide-out-Animation triggern würde

**Einkaufsliste (`src/shopping-list/`):**
- Expand/Collapse-All-Buttons rechts in der Progress-Zeile (32×32 dp, `unfold_more` / `unfold_less`). Nur einer sichtbar je Zustand.
- Expand öffnet nur Kategorien mit noch offenen Zutaten (vollständig erledigte bleiben zu, weil Auto-Collapse sie bewusst dort hin gefahren hat)
- Callbacks direkt in `shopping-list/render.js` verdrahtet, nicht als Prop durchgereicht

**Detail-Sheet (`styles/components/sheet.css`):**
- Reroll-Pille bekommt auch den Aktiv-Look (primary bg + weißer Text) wenn Gericht selected — vorher bewusst neutral gehalten, ist jetzt konsistent mit List-Toggle und Stepper

**Cross-Cutting Farb-Änderungen:**
- Alle Präferenz-Chips (Filter im Picker, Diät/Küche in Settings) mit `aria-pressed="true"` nutzen jetzt `primary` bg + `on-primary` Text (statt `primary-tint` bg + dunkler Text) — konsistent mit kcal-Pille auf der Card und der aktiven Portion-Row
- Label "Amerika" → "Amerikanisch" (Settings + Picker)

### Verifikation

- **Node-Simulation** (1000 rerollAll-Wochen mit ursprünglicher Weighted-Variante, historisch):
  - Neutral: 50% / 34% / 9% / 6% (folgt Bucket-Größe)
  - Nur `asian` aktiv: 73% / 18% / 5% / 3% (+23pp Bevorzugung)
  - Aktuelles Hard-Filter-Verhalten ist deterministisch: aktive Cuisines geben 100 % des Pools, wenn ≥ 7 Kandidaten übrig; sonst Fallback ohne Cuisine.
- **Vite Smoke-Test:** alle geänderten Module laden mit HTTP 200 auf `http://localhost:5176/`.
- **Manueller Browser-Test durch User** — mehrfach iteriert, jede UI-Feedback-Runde einzeln validiert.

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
    preferences: {                     // Diät (Iteration 2, OR-Filter)
      meat: bool,
      fish: bool,
      vegetarian: bool,
    },
    cuisines: {                        // NEU: Küche (Iteration 3, Weighted Reroll)
      asian: bool,
      mediterranean: bool,
      middleEast: bool,
      americas: bool,
    },
    theme: 'auto' | 'light' | 'dark',  // NOCH NICHT FUNKTIONAL
  },
}
```

`STORAGE_KEY = 'mahlzeit-state-v2'` unverändert.

## Code-Struktur (Deltas Session 9)

```
src/
  data/
    dishes.json      ← cuisineGroup pro Dish (+96/−32)
    dishes.js        ← weightedShuffle Export
  dashboard/
    reroll.js        ← weightedShuffle + cuisineWeight, shuffled-Import entfernt
  settings/
    render.js        ← renderCuisineChip + Handler-Block
  state.js           ← cuisines-Slot + loadState-Merge

docs/redesign/
  2026-07-26-session-9-plan.md          ← Design-Doc
  handoffs/session-9-to-10.md           ← DIESER HANDOFF
```

Keine neuen CSS-Regeln — Chips reusen `.pref-chip`. Keine neuen Assets.

## Wo weitermachen — Iteration-Optionen für Session 10

### Iteration 4 — Profil + Tageskalorien

- Alter, Größe, Gewicht, Geschlecht, Aktivitätslevel → Mifflin-St Jeor Formel → BMR × PAL
- Ziel-Modus (Halten / Abnehmen / Aufbauen, ±500 kcal Adjustment)
- Makro-Verteilung: Standard 30/40/30 (P/KH/F) oder Custom Slider
- **Anzeige:** Vergleich Ziel-vs-Ist Wochensumme — möglicher Platz: Chip im Header oder eigene Section im Dashboard

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

### Kleines Follow-Up — Küchen-Präferenz im Picker

- Picker bekommt 3. Filter-Zeile "Küche" mit 4 Chips (Asian/Med/Nahost/Amerika)
- Semantik: OR-Filter (analog Diät) — nicht weighted (Picker ist ohnehin manuell)
- Kann in eine der oben genannten Iterationen mit reingezogen werden oder eigene Mini-Session

### Iteration ∞ — Gerichte-Import

- Neue "Meine Gerichte"-Section im Settings-Sheet: Formular oder JSON-Paste
- Bild-Handling: Upload → `public/dishes/` (via Capacitor Filesystem Plugin, weil WebView-Kontext)
- Backend würde die neue `ingredients.json` erweitern (neue Zutaten-Keys)

## Constraints (aus CLAUDE.md, aktuell)

- **Kein Framework** ohne Rückfrage — Vanilla JS + ES Modules
- **Keine Tests** (Solo-Projekt) — für stochastische Features wie Weighted-Reroll ist Node-Simulation außerhalb des Test-Runners der pragmatische Ersatz
- **Deutsche UI-Strings**
- **Touch-Targets ≥ 48 px** (Card-Overlay-Pillen 26 dp sind Ausnahme — bewusst kompakt für Overlay-Kontext)
- **Storage-Key `mahlzeit-state-v2`** unveränderlich ohne Migration
- **Package-ID mit `applicationIdSuffix ".dev"`** auf `redesign` — vor Merge auf main zurücknehmen

## Bekannte Environment-Constraints

- **Subagent-Worktree-Dispatch schlägt fehl:** Sandbox verweigert `Agent`-Aufrufe. Direktausführung
- **`curl` im Bash-Sandbox** braucht absoluten Pfad (`/usr/bin/curl`)
- **Gradle** braucht JDK 11+ — nutze `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`
- **Bash `cd android`-Chained Commands** ändern das Working-Directory für Folge-Calls — bei jedem Build-Cycle mit vollem Repo-Root-Path arbeiten

## Erster empfohlener Move für Session 10

```bash
git status                                     # sauber, on redesign
git log --oneline origin/redesign..redesign    # 2 commits ungepusht (docs + feat)
git push                                       # falls nicht schon manuell geschehen
cat docs/redesign/handoffs/session-9-to-10.md  # diesen Handoff
```

Danach mit User klären: **Iteration 4 (Profil + Tageskalorien)** angehen, oder Dark Mode / Datenverwaltung vorziehen? Meine Empfehlung: **Iteration 4** — sie ergänzt die Ist-Kalorien-Anzeige der Card um einen Ziel-Wert und macht die Wochensumme erst wirklich aussagekräftig. Alternativ ist Dark Mode ein sichtbarer Quick-Win, hat aber die MainActivity-Statusbar-Komplikation.
