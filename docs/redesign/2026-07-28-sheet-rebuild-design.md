# Sheet-Rebuild — Detail-Sheet + Dish-Picker als ein Modul

**Datum:** 2026-07-28
**Branch:** `sheet-rebuild`
**Ziel-APK:** 1.4.6-beta

## Problem

Detail-Sheet und Dish-Picker sind zwei separate Bottom-Sheet-Overlays. Sie haben mittlerweile ein **identisches Hero** (Bild, Handle, Reroll/Fav/Liste-Pills, Wochentag-Pill, kcal-Pill, Portion-Stepper). Der Wechsel zwischen ihnen (Edit-Pill in Detail-Sheet → Picker, geplant: Info-Pill im Picker → Detail-Sheet) sieht mit den animierten Close/Open-Übergängen wie Flackern aus. Die Instant-Hacks (`transition: none` + inline styles) sind fragil.

Zusätzlich duplizieren beide Module:
- Hero-HTML-Rendering (~80 Zeilen)
- Open/Close-Logik mit Doppel-rAF-Animation
- Close-Swipe-Handler
- (Nur Detail-Sheet aktuell) Horizontal-Swipe für Day-Wechsel
- Handler-Registrierung für Reroll, Fav, List, Portion

Jede zukünftige Header-Änderung muss an beiden Stellen gepflegt werden.

## Lösung: Ein Sheet, zwei Modi

**Ein einziges Bottom-Sheet-Overlay-Modul** (`src/sheet/render.js`) hält den Hero und wechselt intern den Body zwischen zwei Modi:

- `mode: 'detail'` — Tabs (Zutaten/Rezept) + Body-Content + Macro-Footer
- `mode: 'picker'` — Filter + Gerichte-Grid

Der Hero bleibt beim Modus-Wechsel im DOM stehen. Kein Close/Open. Kein Transition-Race.

## State-Modell

Ein modulweiter `session`-Kontext ersetzt die aktuellen zwei Contexts:

```js
let session = null;
// = {
//   day:       'Mo',      // aktueller Wochentag
//   mode:      'detail',  // 'detail' | 'picker'
//   detailTab: 'zutaten', // 'zutaten' | 'rezept' — nur relevant in detail-mode
//   pickerAfterPickCallback: null,  // nur relevant in picker-mode
// }
```

`dishId` ist NICHT im session — der Hero liest immer live `state.assignment[session.day]`. Bei Reroll ändert sich das automatisch beim nächsten `renderShell()`.

Der Picker-spezifische Filter-State (`activeFilters`, `filtersCollapsed`) bleibt modulweit im Picker-Body-Modul, damit er Sheet-Close/Reopen überlebt (aktuelles Verhalten).

## Body-Renderer-Contract

Beide Body-Renderer implementieren ein einheitliches Interface:

```js
// src/sheet/detail-body.js
export const detailBody = {
  render(session)              // → HTML-String für den Body-Bereich
  attach(rootEl, session, api) // Handler binden nach dem Render
  detach()                     // Cleanup wenn Body abgeschaltet wird
  onPortionChange(session)     // wird gerufen wenn User im Hero die Portion aendert
  onDishChange(session)        // wird gerufen wenn Reroll / Day-Swipe das Dish wechselt
};
```

`api` bündelt die Sheet-Level-Callbacks, die der Body braucht:

```js
{
  switchMode(nextMode, opts) // Body-Router aufrufen
  close()                    // Sheet schliessen
  onChange()                 // externen Change-Callback triggern (Dashboard refresh + save)
}
```

`detail-body` verwendet `switchMode` NICHT (Edit-Pill sitzt im Hero, nicht im Body). `picker-body` ruft `switchMode('detail', { tab: 'zutaten' })` bei Klick auf ein Tile (statt aktueller `onExternalPick` + `closeDishPicker` + `openDetailSheet`-Kette).

Der Sheet-Level (Hero-Reroll, Fav, List, Portion) ruft `body.onDishChange(...)` bzw. `body.onPortionChange(...)` — der Body entscheidet dann, was zu tun ist (z. B. Detail-Body baut Zutaten neu auf, Picker-Body markiert das neue Tile).

## Neue Features (im Rebuild direkt mitgenommen)

Diese hängen so eng am gerade umzubauenden Code, dass es einfacher ist, sie im Rebuild direkt einzubauen als nachher:

- **Info-Pill im Picker-Hero-Top-Left** (Material Symbol `info`) — analog Edit-Pill im Detail-Hero. Handler ruft `switchMode('detail', { tab: 'zutaten' })`.
- **Horizontal-Swipe im Picker-Hero** — analog Detail-Sheet. `attachHeroSwipe` sitzt jetzt im Sheet-Modul und funktioniert für beide Modi identisch.

Instant-Transition-Flag entfällt komplett — es wird nicht mehr gebraucht, weil kein Close/Open mehr passiert.

## Migrations-Plan

**Passes** — jeder Pass ist einzeln testbar, kein Riesen-Commit am Ende.

### Pass 1: Struktur anlegen
- `src/sheet/render.js` neu — vollständiges Hero-Rendering, Open/Close, Swipes, Mode-Router
- `src/sheet/detail-body.js` neu — Body-Content für Detail-Modus, importiert von altem `src/detail-sheet/ingredients.js` + `src/detail-sheet/recipe.js` (die bleiben unangetastet)
- `src/sheet/picker-body.js` neu — Body-Content für Picker-Modus, importiert Filter/Grid-Logik aus altem `src/dish-picker/render.js`
- Alte Module bleiben zunächst nebeneinander stehen (nicht angerufen)

### Pass 2: Caller umstellen
- `src/main.js` — `mountSheet` statt `mountDetailSheet` + `mountDishPicker`
- Alle `openDetailSheet(...)` → `openSheet({ mode: 'detail', dishId, tab, day })`
- Alle `openDishPicker(...)` → `openSheet({ mode: 'picker', day, onAfterPick })`
- Dashboard-Card, Macro-Popup, Onboarding, Detail-Body-Edit-Pill, Picker-Body-Info-Pill

### Pass 3: Alte Module abschalten
- `src/detail-sheet/render.js` — löschen (ingredients + recipe bleiben)
- `src/dish-picker/render.js` — kompletter Inhalt in `picker-body.js` migriert, alte Datei löschen
- CSS `dish-picker.css` — was picker-body-spezifisch bleibt, ansonsten aufräumen
- CSS `sheet.css` — bleibt (Hero + Info-Section-Klassen), evtl. leichte Restrukturierung

### Pass 4: Beta-APK 1.4.6-beta
- Vollständiger Live-Test aller Flows:
  - Dashboard-Card öffnet Detail (zutaten/rezept)
  - Dashboard-Card öffnet Picker
  - Detail-Sheet: Reroll, Fav, List, Portion, Tab-Wechsel, Zutaten-Check, Day-Swipe, Close-Swipe, Edit-Pill → Picker-Mode
  - Picker: Filter, Tile-Klick → Detail-Mode, Reroll, Fav, List, Portion, Day-Swipe, Close-Swipe, Info-Pill → Detail-Mode
  - Macro-Popup öffnet Detail
  - Onboarding-Wizard-Flow (nutzt aktuell Detail-Sheet?)

## Risiken

- **Filter-State-Persistence:** `activeFilters` und `filtersCollapsed` sind aktuell modul-lokal im Picker-Modul. Wenn der User Detail-Mode → Picker-Mode wechselt, sollen die vom letzten Picker-Open erhalten bleiben. Bleibt so — modul-lokal im `picker-body.js`.
- **`renderShell` in Detail-Body bei Portion-Wechsel:** Aktuell macht `handleSheetPortion` in Detail-Sheet in-place-Updates (nicht full renderShell). Muss beim Umbau berücksichtigt werden — Body-Renderer bekommt einen Hook `onPortionChange(session)`, der die betroffenen DOM-Teile im Body updated.
- **Macro-Footer position:** Aktuell ist der Macro-Footer ein Sibling von `.sheet-body` (unten am Sheet). Muss im neuen Layout an der gleichen Position sitzen (unter dem Body). Der Body-Renderer muss den Footer entweder mitliefern oder das Sheet-Modul weiss vom Modus, dass es ihn rendert.
- **Async-Bild-Binding:** `bindDishImage(imgEl, dishId)` wird nach jedem renderShell gerufen. Beim Mode-Wechsel bleibt das Bild dasselbe (currentDay ändert sich nicht) — sollte nicht neu geladen werden. Session-Diff prüfen.
- **Day-Swipe bei Picker-Mode:** currentDay ändert sich, damit auch `state.assignment[day]`. Beim Swipe zum Nachbartag ändert sich der Dish im Hero. Im Detail-Mode: Body baut Zutaten für neuen Dish neu. Im Picker-Mode: Grid muss den neuen "current"-Marker setzen.

## Nicht im Scope

- **Andere Sheets** (settings, profile-detail, macro-popup, onboarding, update-sheet, profile-share, add-choice) bleiben wie sie sind. Sie haben eigene Semantik und teilen den Hero nicht.
- **Framework-Umstellung** (Vue/React/etc.) — nach wie vor Vanilla + Vite.
- **CSS-Refactor** über den Rebuild-Umfang hinaus — nur was durch die JS-Umstellung überflüssig wird, wird gelöscht.

## Callers-Inventar

Wer ruft aktuell openDetailSheet / openDishPicker auf:

- `src/main.js`
  - `mountDetailSheet(...)` line 174
  - `mountDishPicker(...)` line 224
  - Verdrahtungen zwischen den Sheets (macro-popup → openDetailSheet)
- `src/dashboard/card.js` — via handlers-Callbacks aus `renderDashboard`
- `src/dashboard/macro-popup.js` — öffnet Detail-Sheet für ein Rezept
- `src/detail-sheet/render.js` line 197 — Edit-Pill öffnet Picker (entfällt beim Rebuild)
- Onboarding? Zu prüfen.

## Rollback-Plan

Wenn der Rebuild im Beta-Test kaputt geht:
- Feature-Branch bleibt, wir mergen `main` nicht rein
- `main` läuft weiter mit 1.4.5 stable
- Rebuild wird fertiggestellt oder Branch gelöscht

Die 5 Sessions zurück in `docs/redesign/handoffs/` decken das aktuelle Detail-Sheet-Design ab — falls wir den Rebuild komplett verwerfen müssen und später neu anfangen wollen.
