# Handoff — Session 24 → 25 (Mahlzeit-App)

## Fokus Session 24: Picker-Hero + Vorbereitung Sheet-Rebuild

Session 24 hat den Dish-Picker-Header schrittweise dem Detail-Sheet angeglichen (1:1 Hero mit Bild, Overlays, Portion-Stepper). Dabei wurde klar: es gibt zu viel Duplikation zwischen den zwei Sheet-Modulen. Session 25 fängt einen **kompletten Rebuild** an — beide Sheets werden zu einem shared Modul mit zwei Modi (`detail` / `picker`).

## Commits auf `main` (session 24)

```
5beaf89 feat(sheets): instant transition detail-sheet -> picker via edit-pill
639aafb feat(sheets): kcal-pill im hero + picker+detail-sheet auf gleiche hoehe
e492839 chore(release): version 1.4.5 stable (versionCode 17)
977f4c6 feat(dish-picker): makros-pills im hero (kcal, p, kh, f) links neben dem stepper
7ea7cd5 chore(release): version 1.4.4 stable (versionCode 16)
29754f7 feat(dish-picker): hero-header aus dem detail-sheet uebernehmen
```

## Was passierte konkret

### 1. Dish-Picker bekommt Detail-Sheet-Hero (Commit `29754f7`)
- Bild + Handle + Reroll-Pill (top-left) + Neu/Fav/Liste-Pills (top-right) + Wochentag-Pill (bottom-left) + Portion-Stepper (bottom-right)
- **Bewusst weggelassen:** Edit-Pill (im Picker zirkulär) + Horizontal-Swipe auf dem Bild (Day-Wechsel)
- Alter Text-Header (`.picker-handle` + `.picker-header` + `.picker-close`) komplett raus
- Filter-Section standardmäßig eingeklappt (`filtersCollapsed = true` bei `openDishPicker`)
- **API-Änderung:** `mountDishPicker` hat jetzt `onChange`-Callback zusätzlich zu `onPick`. Reroll/Fav/List/Portion aus dem Hero nutzen `onChange` (nur Dashboard-Refresh), nicht `onPick` (der hätte Auto-Select-Nebenwirkungen).

### 2. APK 1.4.4 gebaut (Commit `7ea7cd5`), gepusht via beta → main.

### 3. Makros-Pills im Picker-Hero (Commit `977f4c6`, später zurückgenommen)
Nach Anfrage wurden alle 4 Makros (kcal, P, KH, F) in eine `.sheet-hero__meta-row` neben den Stepper gesetzt. Erst als 2-Sub-Container-Struktur, dann als 5 flache Siblings (kcal + P + KH + F + Stepper, alle wrap-fähig).

### 4. APK 1.4.5 gebaut (Commit `e492839`).

### 5. Iteration (Commit `639aafb`) — kcal-Pill im Detail-Sheet + shared meta-row
- Picker-Sheet-Höhe 88vh → 85vh (matcht Detail-Sheet)
- P/KH/F aus Picker-Hero raus, nur kcal-Pill bleibt (Detail-Sheet hat unten den vollständigen Macro-Footer)
- kcal-Pill AUCH im Detail-Sheet-Hero (analog Picker)
- `.sheet-hero__meta-row`-Styles von `dish-picker.css` nach `sheet.css` gezogen (jetzt shared)
- `.sheet-hero__stepper-overlay`-Wrapper entfällt, Stepper sitzt als Sibling in der Meta-Row

### 6. Instant-Transition Edit-Pill (Commit `5beaf89`)
- `closeDetailSheet({ instant })` und `openDishPicker({ ..., instant })` bekommen ein Flag
- Detail-Sheet-Edit-Pill nutzt beides → keine Slide-Animation beim Wechsel Detail → Picker (Hero ist identisch, würde flackern)
- Für die Rückrichtung (Picker → Detail nach Pick) wurde das NICHT implementiert — folgt im Rebuild automatisch

## Wichtigstes Ergebnis: Sheet-Rebuild geplant

Nach diesen Iterationen wurde klar: Detail-Sheet und Picker teilen jetzt Hero + Info-Section komplett. Weitere geplante Features (Info-Pill im Picker, Horizontal-Swipe im Picker) hätten die Duplikation weiter erhöht. Deshalb Entscheidung für **Option 3 — Ein Sheet, zwei Modi**.

**Design-Doc:** [`docs/redesign/2026-07-28-sheet-rebuild-design.md`](../2026-07-28-sheet-rebuild-design.md)

**Feature-Branch:** `sheet-rebuild` (existiert auf origin, aktuell nur mit dem Design-Doc als Commit `069e0d6`)

Kernidee:
- Ein Modul `src/sheet/render.js` mit Hero + Open/Close/Swipe + Mode-Router
- Zwei Body-Renderer: `src/sheet/detail-body.js` (Tabs + Ingredients/Recipe + Macro-Footer) und `src/sheet/picker-body.js` (Filter + Grid)
- Body wechselt in-place bei Mode-Switch — Hero bleibt stehen, kein Slide-down/Slide-up
- Info-Pill im Picker-Hero (Material Symbol `info`) an derselben Position wie Edit-Pill im Detail-Hero. Handler: `switchMode('detail', { tab: 'zutaten' })`
- Horizontal-Swipe im Picker-Hero (Day-Wechsel) — funktioniert für beide Modi identisch
- Instant-Flag entfällt komplett — nicht mehr gebraucht

Details zum State-Modell, Body-Renderer-Contract, Migrations-Plan (4 Passes), Risiken und Callers-Inventar: alle im Design-Doc.

## Branch-State beim Session-Ende

- **`main`** = **`beta`** = **`origin/main`** = **`origin/beta`** = **`5beaf89`**
- **`sheet-rebuild`** = **`origin/sheet-rebuild`** = **`069e0d6`** (nur Design-Doc)
- Working tree clean auf beiden Branches

## Test-Zustand

- **Stable-APK 1.4.5** gebaut aus `main`: `android/app/build/outputs/apk/debug/app-debug.apk` (34 MB)
- Enthält alle Iterationen bis inkl. `e492839` (kcal + P/KH/F im Picker-Hero, 5 flache Siblings)
- **NICHT enthalten:** `639aafb` (kcal auch im Detail-Sheet, Picker nur kcal statt aller Makros, meta-row-CSS-Move, Sheet-Hoehe 85vh) und `5beaf89` (instant-transition Edit-Pill)
- Für einen APK mit dem aktuellen `main`-Stand: Version bumpen auf `1.4.6-beta` (versionCode 18) oder direkt Stable `1.4.6`
- Für den Rebuild: APK 1.4.6-beta aus `sheet-rebuild` sobald Pass 4 durch ist

## Einstiegs-Move für Session 25

```bash
git status                       # sollte clean sein
git checkout sheet-rebuild
git log --oneline -3             # nur design-doc commit
```

Dann Design-Doc lesen: [`docs/redesign/2026-07-28-sheet-rebuild-design.md`](../2026-07-28-sheet-rebuild-design.md)

**Reihenfolge Passes:**
1. Struktur anlegen — `src/sheet/render.js`, `src/sheet/detail-body.js`, `src/sheet/picker-body.js`. Alte Module bleiben parallel stehen, sind noch nicht angeschlossen.
2. Caller umstellen — `src/main.js` mount + wire, alle `openDetailSheet`/`openDishPicker`-Sites auf neue Signatur.
3. Alte Module abschalten — `src/detail-sheet/render.js` löschen, `src/dish-picker/render.js` löschen. `ingredients.js` + `recipe.js` bleiben (werden von `detail-body.js` importiert). Filter/Grid-Logik aus `dish-picker/render.js` wandert nach `picker-body.js`.
4. Beta-APK 1.4.6-beta + Live-Test aller Flows.

## Roadmap-Rest (unverändert seit Session 23)

Alle Punkte aus [`session-23-to-24.md`](session-23-to-24.md) unter "Bekannte Rest-Punkte" sind noch offen (Standard-Profil, Einkaufsliste-Feinschliff, Nährstoff-Details, etc.). Kein Fortschritt in Session 24.

**#8 (Picker: Filter-Section-Header Scroll+Expand)** — teilweise adressiert durch "collapsed by default", aber die Scroll-Trigger-Logik wurde nicht angepackt. Beim Rebuild neu bewerten ob noch relevant.

## Skill-Empfehlungen für Session 25

- **`superpowers:writing-plans`** für den Rebuild — großes Modul, kein Rumfummeln
- **`superpowers:test-driven-development`** ist im Projekt nicht Standard (kein Test-Framework), also übersprungen
- **`superpowers:verification-before-completion`** vor jedem "Rebuild fertig!"-Statement — Sheet-Wechsel und Handler-Verkabelung sind bekannt fehleranfällig, muss live-getestet werden
- Bei Rezept-Änderungen: CLAUDE.md-Regel "Rezept-Bestätigung" beachten

## Sonstige Notizen

- **Filter-State-Persistence:** `activeFilters` und `filtersCollapsed` sind aktuell modul-lokal im Picker-Modul (überleben Sheet-Close/Reopen im Session-Lifetime). Bleibt so im Rebuild — modul-lokal in `picker-body.js`.
- **Push-Flow:** Direkter Push auf `main` funktioniert per Fast-Forward aus beta. Wenn wieder blockiert: erst beta, dann main (siehe session-23-to-24 Push-Erinnerung).
- **Rezept-Änderungen in Session 24:** keine.

## Offene User-Beobachtungen (nicht bestätigt)

- **"Sticky-Header schließt oben an?"** — In Session 24 gefragt, technisch verifiziert (kein Spalt zwischen `.sheet-info` und sticky `.picker-filters__header`), aber User-Bestätigung fehlt. Beim Rebuild wieder prüfen — mit dem in-place-mode-swap könnte sich die visuelle Situation eh ändern.
