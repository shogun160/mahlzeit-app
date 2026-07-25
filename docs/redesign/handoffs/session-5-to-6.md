# Handoff — Mahlzeit-App Rebuild, Session 6

## Kontext in einem Satz

Du übernimmst einen laufenden Rebuild einer Meal-Planner-App (Capacitor + Vanilla JS + Vite). Session 5 (Einkaufsliste — Konsolidierung aller `selected`-Tage, Kategorien-Rendering, einheiten-aware `formatQuantity` für Gramm/Stück/Bund/Zehe/Ei/Vorrat, Check-Interaktion mit In-Place-Durchstreichung, sticky Progress-Bar mit Frosted-Glass, Screen-Wechsel Dashboard ↔ Shopping via horizontalem Swipe, view-abhängiger Header mit Reset-Button, plus umfangreicher Card-Feinschliff: Makros als Overlay auf Bild, dynamischer Zutaten-Badge, Portion-Stepper aufs Bild, kompaktere Body-Abstände, globaler Primary-Tint-Token) ist abgeschlossen. Jetzt steht Session 6 an: **Bottom-Navigation + localStorage-Persistenz**.

## Wo du dich orientieren solltest — Pflichtlektüre

Alles im Repo:

1. **`CLAUDE.md`** — projekt-übergreifender Kontext (7 Guardrails). **Wird beim Session-Start automatisch geladen.**
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — vollständige Rebuild-Spec. Session 6 ist Zeile in der Roadmap-Tabelle: *"Bottom-Navigation + localStorage-Persistenz"*.
3. **`docs/redesign/2026-07-25-session-5-plan.md`** — Session-5-Plan mit den Modulen die jetzt existieren, den Design-Entscheidungen (Swipe-Nav, Check-stays, sticky Progress) und den Modul-Signaturen.
4. **`docs/redesign/handoffs/session-4-to-5.md`** — voriger Handoff (Detail-Sheet + Card-Layout).

Nicht duplizieren — lies sie, dann beginne.

## Aktueller Repo-Zustand

- **Branch:** `redesign` (nicht `main`!) — bei Session-Ende auf GitHub gepusht
- **Commits seit main:** `git log --oneline main..redesign | wc -l` — Session 5 hat 25+ Commits addiert
- **Working Tree:** sauber, `www/` gelöscht (gitignored — Vite generiert neu)
- **Dev-Server:** läuft NICHT — start bei Bedarf mit `npm run dev` (Port 5173)

## Was in Session 5 gebaut wurde

### Kern-Feature Einkaufsliste

**Neue Files:**

- `src/shopping-list/categories.js` — `CAT_ORDER` (`frisch → trocken → gewuerze → oel → sonstig`) + `CAT_LABELS` (Frische/Trocken/Gewürze/Öl / Fett/Sonstiges)
- `src/shopping-list/consolidate.js` — `buildConsolidatedList()` liest `state.selected`/`state.portions`/`state.assignment`, aggregiert pro `ing.key`, liefert Map mit `sum`-Feld (Gramm portions-skaliert), `unit`/`size`/`note` durchgereicht
- `src/shopping-list/check.js` — `toggleChecked(key)` + `resetChecked()`
- `src/shopping-list/progress.js` — `renderProgress(items)` HTML-String für "N von M offen" + Fill-Bar
- `src/shopping-list/render.js` — `renderShoppingList(root, { onChange })` orchestriert Progress + Kategorien-Gruppen + Zutaten-Zeilen + Empty-State
- `src/nav/swipe.js` — `attachViewSwipe(el, { onViewChange })` horizontaler Screen-Swipe (Threshold 55 px + Ratio 1.4, identisch zum Sheet-Swipe)
- `styles/components/shopping-list.css` — sticky Progress mit backdrop-blur, Kategorien-Groups, Check-Rows mit primary-Kreis + Durchstreichung, Empty-State
- `styles/components/view-track.css` — `.view-track { width: 200%; transform: translateX(0 | -50%) }`, `.view { flex: 0 0 50%; overflow-y: auto }`, `.view > * { flex-shrink: 0 }`

**Geänderte Files (Kern):**

- `src/state.js` — `view: 'dashboard' | 'shopping'` Slot + `setView(next)` + `VIEWS` const
- `src/util/format.js` — `formatQuantity(item)` neben `formatGrams` (einheiten-aware: aufgerundet auf 10 g / ganzes Stück / Bund / Zehe / Ei, "Vorrat prüfen" für `vorrat`)
- `src/dashboard/header.js` — view-abhängig: Dashboard-Header (Stepper + Reroll) vs. Shopping-Header (nur Logo + Reset wenn `checkedShopping.size > 0`)
- `src/main.js` — refresh() rendert Header (view-aware) + BEIDE Views (Dashboard + Shopping) + setzt `data-view` auf `#view-track`, Swipe-Handler auf `<main>` mit `setView + refresh`
- `styles/base.css` — Body als `flex-column height: 100dvh overflow: hidden`, main als overflow-clip
- `index.html` — `<main id="app">` enthält `<div id="view-track">` mit zwei `<section class="view">` Kindern

### Nach-Session-5 Feinschliff (deutlich umfangreicher als reine Kern-Feature)

Diese kamen alle nach dem ursprünglichen Session-5-Plan als visuelle Iterationen dazu:

**Card-Layout überarbeitet:**
- **Makros-Overlay unten rechts auf Bild** (`.day-card__makros`): kcal als kräftiger Primary-Chip, P/KH/F als frosted-white Pills (`rgba(255,255,255,0.88)` + `backdrop-filter: blur(8px)`). Feste `min-width` pro Typ (kcal 88, P 64, KH 76, F 64 px) damit sie beim Portion-Wechsel nicht springen. Werte skalieren mit `portions` (Math.round × portions).
- **Portion-Stepper aufs Bild** (`.day-card__portion-overlay`): frosted-glass Pill oben rechts, nutzt `.stepper--pill` Modifier (kleinere Variante — Höhe 26 px matcht Makro-Pills).
- **Zutaten-Anzahl-Badge dynamisch**: zeigt `openIngredientsCount` (Zutaten des Gerichts, die NICHT in `state.checkedShopping`). Badge wandert:
  - `!isSelected` → am Zutaten-Icon ("so viele Zutaten fehlen")
  - `isSelected` → am Liste-Icon ("so viele offen auf der Liste")
  - `openIngredientsCount === 0` → kein Badge sichtbar
- **Header-Row** (`.day-card__header-row`): Wochentag links + Meta (`~40 Min. · Skandinavisch`) rechts in einer Zeile mit `justify-content: space-between` — spart eine Body-Zeile.
- **Titel einzeilig**: `min-height: 2.6em` (2-Zeilen-Reserve) entfernt, dafür `white-space: nowrap + text-overflow: ellipsis`. Ein Dish (`Putenhackbällchen Tomatensauce Couscous`) manuell gekürzt zu `Putenbällchen Tomate Couscous`.
- **Body-Padding + gap reduziert**: 12/16/14 statt 16/16/16, day/meta margin-bottom 2 px statt 4 px, actions padding-top 10 px statt 12 px.

**Header umgebaut:**
- **Full-Width** (max-width entfernt) — Header läuft über die volle Viewport-Breite.
- **Beide Header-Zonen (`.app-header__logo-wrap`, `.app-header__actions`) min-height 48 px** — Dashboard und Shopping haben identische Header-Höhe, auch wenn Actions leer sind.
- **Reroll-Icon links vom Stepper** (statt rechts) — visuell klarere Trennung: Auslös-Action links, primärer Regler rechts.
- **Portion-Stepper nutzt `.stepper--pill`** (26 px hoch, matcht Card-Overlay-Stepper).
- **Reset-Icon = Material Symbols "refresh"** (offizielles SVG mit `viewBox="0 -960 960 960"`, `fill="currentColor"`), in `.icon-btn svg` global auf `var(--md-sys-color-primary)` gesetzt (statt on-surface).
- **Logo größer**: 44 px statt 36 px (nutzt die touch-target min-height besser aus).

**Global Primary-Tint als Token:**
- Neuer Token `--md-sys-color-primary-tint` in tokens.css (`color-mix(primary 30%, surface-container-lowest)`) + `--primary-tint-hover` (35%)
- Alle bisher inline color-mix-Aufrufe migriert:
  - `.day-card--selected .action-btn` + `.day-card--selected .stepper--compact`
  - `.action-btn--active` + hover
  - `.icon-btn--active` (aktuell nicht mehr genutzt aber Klasse existiert)
  - `.recipe-step::before` (Rezept-Nummern-Kreise — vorher `--md-sys-color-primary-container`)
- **Ergebnis:** Wenn der Token in tokens.css geändert wird, ziehen alle aktiv-Zustände global nach.

**Progress-Bar-Feinschliff:**
- **Sticky bündig am Header**: `view--shopping padding-top: 0`, `.shop-progress margin-inline: -16px + padding 14px 16px` → läuft über volle Viewport-Breite direkt unter Header.
- **Frosted-Glass beim Scroll**: `background: color-mix(surface 82%, transparent)` + `backdrop-filter: blur(10px)` → Content schimmert durch beim Scrollen.
- `user-select: none + touch-action: pan-y` damit Scroll-Gesten sauber durchrutschen.

**Rezept-Nummern zentriert:**
- `.recipe-step` umgestellt auf `display: flex; align-items: center; gap: 12px` — Nummer-Kreis (::before) ist jetzt vertikal mittig zum ganzen Text (auch bei mehrzeiligen Schritten). Vorher `position: absolute; top: 0` → oben ausgerichtet.

**Reroll-Bug gefixt:**
- `rerollAll()` setzt jetzt `state.portions[day] = state.globalPortions` für alle Tage. Beim "Alle wechseln" fallen Portionen auf den globalen Header-Wert zurück (User-Regression aus Session 4). Einzelnes `rerollDay(day)` lässt Portionen bewusst unverändert.

**Sheet-Close-Swipe hinzugefügt (Handle + Header):**
- `attachCloseSwipe()` in `src/detail-sheet/render.js`: `pointerdown` auf `.sheet` (mit Filter — nicht auf Buttons, Steppern oder Panels), `setPointerCapture(pointerId)` bindet Follow-Events ans Sheet, `pointerup` misst dy > 55 px + Richtungs-Ratio 1.4 → `closeDetailSheet()`.
- Panel bleibt scroll-frei (nativer `overflow-y: auto` scroll bleibt).
- **iOS/Material-Konvention:** Close-Swipe funktioniert nur außerhalb der scrollbaren Panels. "Swipe von überall" bräuchte einen custom Scroll-Manager (500-1000 LOC State Machine) — bewusst nicht implementiert.
- Handle-Bar Klick-Zone auf 28 px erhöht (visuelle Pille bleibt 40×5 px in `outline-variant`).
- `.sheet-header { touch-action: none }` verhindert dass Browser dort Scroll-Geste erkennt und `pointercancel` schickt.

## Was für Session 6 zu tun ist

Aus Design-Doc Section 1 und Roadmap-Zeile Session 6:

> **"Bottom-Navigation + localStorage-Persistenz"**

Feature-Details:

### 1. Bottom-Navigation

- Fixed am unteren Rand, `--bottom-nav-height: 64px` bereits in tokens.css reserviert
- Zwei Tabs: **Dashboard** (Icon `/icons/icon-dashboard.png`, bereits vorhanden) und **Einkaufsliste** (Icons `/icons/icon-einkaufsliste-aktiv.png` + `/icons/icon-einkaufsliste-inaktiv.png`, bereits vorhanden)
- Tab-Click ruft dasselbe `setView(next) + refresh()`-Paar wie der Swipe (Session 5, `src/nav/swipe.js`). Kein zweiter State-Slot — Bottom-Nav und Swipe schreiben auf identischen `state.view`.
- Aktiver Tab visuell hervorheben (z. B. mit `--md-sys-color-primary-tint` — passt zur globalen Aktiv-Farbe)
- Safe-Area unten respektieren: `padding-bottom: env(safe-area-inset-bottom)`
- Views bekommen `padding-bottom: var(--bottom-nav-height) + safe-area` damit letzter Content nicht unter der Nav verschwindet (aktuell nur `safe-area + 20px`)
- Sheet + Backdrop müssen visuell ÜBER der Bottom-Nav liegen (z-index: view < bottom-nav < sheet-overlay)

**Modul-Vorschlag:**
```
src/nav/
  bottom.js         ← NEU: renderBottomNav(root, { onNavigate })
  swipe.js          ← existiert, unverändert
styles/components/
  bottom-nav.css    ← NEU
index.html          ← <nav id="bottom-nav" class="bottom-nav"></nav> nach <main>
```

### 2. localStorage-Persistenz

- Storage-Key: **`mahlzeit-state-v2`** (Guardrail in CLAUDE.md — v1 = alte App auf `main`, v2 = Rebuild)
- Serialisieren nach jedem `refresh()` in `main.js`
- **Set-Konvertierung:** `state.checkedShopping` ist `Set<string>` → `Array.from()` beim Serialisieren, `new Set(...)` beim Laden
- Plain Objects (`assignment`, `selected`, `portions`, `dishBag`) gehen direkt durch JSON
- `state.view` mit persistieren → User startet auf letzter Ansicht
- `state.globalPortions` mit persistieren
- Beim App-Start: `loadState()` in `state.js`, fällt auf Init-Defaults zurück wenn nichts gespeichert oder JSON-Parse fehlschlägt
- Auto-Save via Wrapper um `refresh()` oder als eigener `persistState()`-Aufruf nach jedem Mutator (letzteres granularer aber mehr Aufrufe)

**Modul-Vorschlag:**
```
src/state/
  storage.js        ← NEU: loadState(), saveState() — kapselt localStorage + Set-Serialisierung
  ODER direkt in
src/state.js        ← erweitern
```

Ich würde direkt in `state.js` erweitern — der Overhead ist klein, kein extra Modul nötig für ~30 LOC.

## Constraints (aus Design-Doc / CLAUDE.md, hier zur Erinnerung)

- **Kein Framework** ohne Rückfrage
- **Vanilla JS + ES Modules**, kein TypeScript, keine Tests
- **Deutsche UI-Strings**
- **Touch-Targets ≥ 48 px** — Bottom-Nav-Tabs beachten
- **Storage-Key `mahlzeit-state-v2`** unveränderlich ohne Migration (Guardrail)
- **Persistenz-Trigger:** nach jedem `refresh()` in `main.js` — konsistent mit dem View-Rendering-Zyklus

## Bekannte Environment-Constraints

- **Subagent-Worktree-Dispatch schlägt fehl:** Sandbox verweigert `Agent`-Aufrufe. Sessions 1–5 wurden in Direktausführung in der Haupt-Session gefahren — genauso weitermachen.
- **`curl` im Bash-Sandbox braucht absoluten Pfad** (`/usr/bin/curl`) innerhalb von for-Loops.
- **Touch-Events feuern nicht mit Maus im Browser** — DevTools Device Mode simuliert touch für Test. Pointer-Events funktionieren mit beiden. Der Close-Swipe im Sheet nutzt Pointer-Events + `setPointerCapture`, funktioniert daher im Browser (falls Sheet-Element gefunden wird) und am Handy.

## Design-Entscheidungen für Session 6 (vor Session-Start noch mit User zu klären)

Diese drei UX-Fragen sind NICHT vorab geklärt — hier musst du den User grillen bevor du den Session-6-Plan finalisierst:

1. **Bottom-Nav-Style:** Icons mit oder ohne Labels? Nur Icons ist Material-mäßig kompakter, mit Labels klarer für Nutzer.
2. **Persistenz-Umfang:** `state.view` und `state.globalPortions` mit-persistieren? (Empfehlung: ja, für konsistentes App-Erlebnis nach Neustart.)
3. **`dishBag` (Reroll-Historie):** persistieren oder pro Session neu? Wenn ja: mehr Continuity bei Reroll. Wenn nein: fresh start jedes App-Öffnen.

## Bewusste Entscheidungen aus Session 5, die für Session 6 relevant sind

- **`setView(next)` in `state.js`** ist der zentrale View-Setter — Bottom-Nav ruft ihn identisch wie Swipe.
- **`state.view`** ist bereits im State-Objekt (Default `'dashboard'`). Persistieren = direkt einbinden.
- **`state.checkedShopping` ist `Set<string>`** — braucht Konvertierung bei Serialisierung (`Array.from()` / `new Set()`).
- **`state.dishBag`** ist plain Object mit Arrays (`{ [day: string]: number[] }`), geht direkt durch JSON.
- **`refresh()`** ist der zentrale Render-Trigger — Auto-Save Aufruf am Ende von `refresh()` ist der einfachste Persistenz-Hook.
- **`.view` (in view-track.css)** hat aktuell `padding-bottom: calc(safe-area + 20px)`. Session 6 muss das auf `calc(var(--bottom-nav-height) + safe-area + 20px)` erweitern, damit Content nicht unter Bottom-Nav verschwindet.
- **z-index-Reihenfolge derzeit:**
  - `.view` — kein z-index (default 0)
  - `.shop-progress` — z-index 5 (sticky in view)
  - `.app-header` — z-index 10 (sticky in body flex)
  - `.sheet-overlay` — z-index 100
- **Bottom-Nav sollte z-index zwischen ~50 und 100 haben** — über view + progress + header, aber unter sheet-overlay.
- **Sheet + Bottom-Nav:** Wenn Sheet offen, sollte Bottom-Nav optisch überdeckt sein (sheet-overlay hat z-index 100, deckt volle Viewport-Höhe → passt automatisch).
- **Card-Layout ist "final" für Session 5:** Bild-Overlay-Pattern (Portion + Makros auf Bild), Body kompakt, Header-Row. Nicht nochmal grundsätzlich umbauen ohne User-Rückfrage.

## Empfohlener Skill-Flow

1. `writing-plans` invoken, Session-6-Plan schreiben (`docs/redesign/2026-07-25-session-6-plan.md`). Vor dem Plan die 3 offenen Design-Fragen mit User klären.
2. `executing-plans` direkt in Haupt-Session. Nach Bottom-Nav-Rendering visueller Checkpoint mit User (Screenshot). Nach Persistenz: Regressionstest — App komplett neu laden, Zustand sollte identisch sein.

## Erster empfohlener Move

```bash
git status                                # sicherstellen: on redesign, clean
git log --oneline main..redesign | head  # inspiziere Session-5-Commits
grep -n "bottom-nav\|--bottom-nav-height" styles/tokens.css styles/base.css
grep -rn "state.view\|setView\|VIEWS" src/
```

Dann die drei Design-Fragen mit User klären, `writing-plans` invoken.
