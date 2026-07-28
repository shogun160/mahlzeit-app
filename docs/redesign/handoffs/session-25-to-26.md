# Handoff — Session 25 → 26 (Mahlzeit-App)

## Fokus Session 25: Sheet-Rebuild Pass 1 + 2 (Design-Doc → laufender Code auf main)

Session 24 hatte den Rebuild geplant und einen Design-Doc auf `sheet-rebuild` gelegt. Session 25 hat Pass 1 (neue Module anlegen) und Pass 2 (Caller umstellen) durchgezogen, den Rebuild live-getestet und alle Regressionen gefixt. Beta-APK 1.4.6-beta wurde gebaut, freigegeben, und via `beta → main` fast-forward auf `main` gemergt. Alte Sheet-Module sind noch physisch im Repo, aber nicht mehr aufgerufen — Pass 3 (Löschen) ist offen.

## Commits auf `main` (session 25)

Fast-forward-Merge von `beta` auf `main`, letzter Commit ist `e383000`:

```
e383000 refactor(sheet): in-place hero-update nach tile-pick statt outerHTML-swap
4f40e79 fix(sheet): hero + info folgen dem neuen dish nach picker-tile-pick
1cf6d85 fix(sheet): hero-pill-clicks nicht vom swipe-handler geschluckt
a0d141d style(sheet): hoehe 85vh -> 88vh
3dc7081 fix(sheet): overlay-blur-liste kennt neuen sheet-root
5d5044d merge: sheet-scroll-fix (body-slot als flex-container)
6cc14be fix(sheet): body-slot-flex-container fuer detail-body + picker-body scroll
f5cf03d merge: sheet-rebuild pass 1+2 (unified sheet-modul, ohne alte module-loeschung)
b59bfaf chore(release): version 1.4.6-beta (versionCode 18)
33fbbd3 fix(sheet): hero-swipe bleibt nach day-swipe/reroll funktionsfaehig
b4e8a1d feat(sheet): pass 2 — caller auf mountSheet/openSheet umgestellt
34f893d feat(sheet): pass 1 — module fuer unified sheet (render + detail-body + picker-body)
069e0d6 docs(sheet-rebuild): design-doc fuer detail-sheet + picker als ein modul
```

## Was passierte konkret

### 1. Pass 1: neue Module (Commit `34f893d`)
- `src/sheet/render.js` (~534 Zeilen) — Hero + Info + Mode-Router + Sheet-Level-Handler (Reroll/Fav/List/Portion) + Swipes (Hero horizontal + vertikal Close, Close-Swipe am Sheet)
- `src/sheet/detail-body.js` (~147 Zeilen) — Tabs + Panels + Macro-Footer + Ingredient-Check-Handler + Panel-Swipe. Importiert weiter `renderIngredients` + `renderMacroFooter` aus `src/detail-sheet/ingredients.js` und `renderRecipe` aus `src/detail-sheet/recipe.js`.
- `src/sheet/picker-body.js` (~709 Zeilen) — Filter-Section + Grid + Bucket-Logik + Sort + FLIP-Animation + Tile/Fav/Reset-Handler. Modul-lokaler Filter-State (`activeFilters`, `filtersCollapsed`).
- Alte Module blieben unangetastet, wurden noch nicht aufgerufen.
- Body-Renderer-Contract: `render(session) / attach(rootEl, session, api) / detach() / onPortionChange(session) / onDishChange(session)`.
- API-Objekt aus `render.js` an Body: `{ switchMode, close, onChange, onPick }`.

### 2. Pass 2: Caller umstellen (Commit `b4e8a1d`)
- `index.html`: `#detail-sheet-root` + `#dish-picker-root` raus, ein `#sheet-root` rein.
- `src/main.js`: Imports auf `mountSheet, openSheet` aus `./sheet/render.js` umgestellt. `mountDetailSheet` + `mountDishPicker` entfernt. Sheet-Callbacks `renderDashboard`/`macro-popup` rufen `openSheet({ mode: 'detail'|'picker', day, tab })`. `onPick`-Semantik (Auto-Select + Doppelbelegung-Reroll) sitzt jetzt in `mountSheet({ onPick: ... })` statt im alten Picker.
- Alte Module (`src/detail-sheet/render.js`, `src/dish-picker/render.js`) werden nicht mehr referenziert, tree-shaken vom Bundle.

### 3. Bug-Fixes im Live-Test (in dieser Reihenfolge)

**`33fbbd3` — Hero-Swipe nach erstem Day-Swipe/Reroll tot.**
`rerenderHeroAndInfo` ersetzte `.sheet-hero` per outerHTML, aber `attachHeroLevelHandlersOnly` hatte `attachHeroSwipe()` vergessen. Fix: alle Hero-Handler (Bild, Portion, Fav, List, Mode-Pill, Swipe) in eine gemeinsame `attachHeroHandlers()` konsolidiert, die sowohl beim Mount als auch nach jedem Rerender läuft. Duplikation zwischen den zwei Handler-Blöcken damit weg.

**`6cc14be` — Nichts scrollbar (Zutaten, Rezept, Picker).**
Der neue `.sheet-body-slot`-Wrapper hatte kein Flex/Overflow-Setup — die Flex-Kette vom `.sheet` war unterbrochen, damit konnten `.sheet-body` (Detail) und `.picker-body` (Picker) nicht mehr wachsen. Fix: `.sheet-body-slot { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }` in `styles/components/sheet.css`.

**`3dc7081` — Kein Hintergrund-Blur beim Sheet-Open.**
`installOverlayBlur` in `src/util/overlay-blur.js` watchte noch `detail-sheet-root` + `dish-picker-root`, die in Pass 2 aus dem HTML raus sind. Fix: Liste auf `sheet-root` umgestellt.

**`a0d141d` — Sheet-Höhe `85vh → 88vh`** (Wunsch: "ein bisschen höher").

**`1cf6d85` — Hero-Pill-Klicks (Edit, Info, Refresh, Fav, List) wurden manchmal nicht getroffen.**
`attachHeroSwipe` rief `setPointerCapture` sofort im `pointerdown`. Wenn der Touch minimal neben dem visuellen Pill-Rand landete (also technisch auf `.sheet-hero`), fing der Hero den Pointer ab und der Browser feuerte kein Click-Event mehr an die Pill. Fix: `setPointerCapture` erst nach ≥ 8 px Bewegung im `pointermove` (echter Swipe erkannt). Bei einem kurzen Tap läuft der Klick normal an das Button-Target durch.

**`4f40e79` / `e383000` — Nach Picker-Tile-Pick zeigte Hero das alte Gericht.**
`picker-body`-Tile-Handler ruft `api.onPick(day, id)` → `state.assignment[day]` wird ersetzt, dann `api.switchMode('detail', { tab: 'zutaten' })` → Body zeigt Zutaten des NEUEN Gerichts. Aber Hero + Info wurden nicht neu gerendert, zeigten weiter Bild/Titel/kcal des ALTEN Gerichts. Erster Versuch war `rerenderHeroAndInfo()` in `api.onPick` — der outerHTML-Swap ausgelöst während der noch laufende Tile-Click den DOM instabil machte. Finaler Fix: neue `updateHeroDish()` macht in-place-Update (bindDishImage + textContent/innerHTML auf inneren Nodes) statt outerHTML-Swap. Handler bleiben intakt, Click läuft sauber durch bis `switchMode` den Body austauscht.

### 4. Verhaltens-Änderungen (bewusst, aus dem Rebuild-Design)
- **Info-Pill oben-links im Picker-Hero** (Material Symbol `info`) — an derselben Position wie die Edit-Pill im Detail-Hero. Klick wechselt in Detail-Mode.
- **Horizontal-Swipe im Picker-Hero** (Day-Wechsel) — vorher nur im Detail-Sheet.
- **Klick auf Picker-Tile** wechselt jetzt automatisch in Detail-Mode statt den Picker zu schließen. Der User hat das im Live-Test bestätigt ("gute idee").
- **Keine Slide-down/Slide-up-Übergänge** zwischen Detail und Picker mehr — Hero+Info bleiben stehen, nur Body-Slot wird ausgetauscht (`switchMode`).
- `instant`-Flag komplett entfallen — wird nicht mehr gebraucht.

### 5. Release
- Version `1.4.6-beta` (versionCode 18) — Commit `b59bfaf`.
- Beta-APK aus `beta` gebaut, live-getestet.
- `sheet-rebuild → beta` (2 Merge-Commits `f5cf03d`, `5d5044d`), dann `beta → main` per fast-forward.

## Branch-State beim Session-Ende

- **`main`** = **`beta`** = **`origin/main`** = **`origin/beta`** = **`e383000`**
- **`sheet-rebuild`** = **`origin/sheet-rebuild`** = **`32157f2`** — inhaltlich identisch zu beta/main, aber lineare Cherry-Pick-Historie ohne die Merge-Commits.
- Working tree clean auf allen Branches.

## APK-Zustand

- **Beta-APK 1.4.6-beta** (versionCode 18) gebaut, live-getestet, freigegeben. Datei: `android/app/build/outputs/apk/debug/app-debug.apk`.
- Diese APK ist **inhaltlich identisch mit main** (fast-forward-merge, keine main-only Änderungen).
- Version im Gradle steht weiter auf `1.4.6-beta` — falls Session 26 eine **Stable-APK** baut: Bump auf `1.4.6` / versionCode 19, `chore(release): version 1.4.6`-Commit, APK aus main.

## Offen für Session 26

### Pass 3: alte Module physisch löschen
- `src/detail-sheet/render.js` — komplett löschen.
- `src/dish-picker/render.js` — komplett löschen.
- `src/detail-sheet/ingredients.js` + `src/detail-sheet/recipe.js` — **bleiben**, werden von `src/sheet/detail-body.js` importiert.
- CSS: `styles/components/dish-picker.css` bleibt (Filter, Grid, Tile-Styles werden weiter genutzt). `sheet.css` bleibt. Evtl. Aufräumen was nur der alte Detail-Sheet-Header war (`.picker-handle`, `.picker-header`, `.picker-close` sind schon in Session 24 raus).
- Nach Löschung: build-check dass keine dangling imports.

### Pass 4: Live-Test aller Flows
Der Beta-Test in Session 25 hat die Haupt-Flows abgedeckt (Card öffnet Detail/Picker, Reroll, Fav, List, Portion, Day-Swipe, Close-Swipe, Info-Pill → Detail, Edit-Pill → Picker, Tile-Klick, Filter). Was noch NICHT explizit bestätigt wurde:
- Macro-Popup öffnet Detail-Sheet für ein Rezept
- Onboarding-Wizard-Flows (öffnet der Wizard das Sheet? Zu prüfen — Callers-Inventar in Session 24 hatte "Onboarding? Zu prüfen." offen)
- Multi-User-Szenarien (Multi-Diner Zutaten-Skalierung im Detail-Mode)
- Remote-Rezept-Import + Neu-Marker im Picker
- Empty-States (Favoriten-Filter ohne Favoriten, is-new ohne neue Rezepte)

### Stable-APK 1.4.6
Wenn gewünscht: Version-Bump + APK aus main. Der Rebuild ist stable genug (Beta-Test war umfangreich).

### Roadmap-Rest (unverändert)
Alle Punkte aus [`session-23-to-24.md`](session-23-to-24.md) "Bekannte Rest-Punkte" sind noch offen (Standard-Profil, Einkaufsliste-Feinschliff, Nährstoff-Details, etc.).

**#8 (Picker: Filter-Section-Header Scroll+Expand)** — beim Rebuild in `picker-body.js` übernommen, Semantik unverändert. Neu zu bewerten ob die Scroll-Trigger-Logik noch nötig ist oder ob "collapsed by default" reicht.

## Skill-Empfehlungen für Session 26

- **Pass 3 ist rein mechanisch** (löschen + build-check) — keine Skill nötig.
- **`superpowers:verification-before-completion`** vor jedem "Rebuild fertig!"-Statement.
- Wenn Bugs im Live-Test: **`superpowers:systematic-debugging`**.
- Bei Rezept-Änderungen: CLAUDE.md-Regel "Rezept-Bestätigung" beachten.

## Sonstige Notizen

- **Filter-State-Persistence:** `activeFilters` + `filtersCollapsed` sind modul-lokal in `picker-body.js`. Überleben Mode-Switch innerhalb einer Sheet-Session; werden bei Day-Wechsel neu initialisiert (`ensureFiltersInitialized`).
- **Rezept-Änderungen in Session 25:** keine.
- **Neue Roots im index.html:** nur `#sheet-root`. `#detail-sheet-root` + `#dish-picker-root` sind raus.
- **Overlay-Blur:** funktioniert für alle Sheets. Die Liste in `overlay-blur.js` ist auf dem aktuellen Stand.
- **CSS-Änderungen an `styles/components/sheet.css`:** Neuer Selektor `.sheet-body-slot` (Flex-Container). Kein Refactor darüber hinaus.
- **Push-Flow:** direkter Push auf `main` per fast-forward funktioniert wenn beta ihn davor bekommt. Merge-Guard verlangt explizite Zustimmung, siehe CLAUDE.md.
