# Handoff — Session 23 → 24 (Mahlzeit-App)

## Fokus Session 23: Detail-Sheet-Rebuild + Kleine Fixes

Session 23 sollte laut Plan „kleine Fixes und Design-Optimierungen" werden — daraus wurde effektiv ein kompletter Rebuild des Detail-Sheets (Bild-Hero, Overlays, Swipe, Reroll, Liste-Toggle, Multi-User-Footer) plus mehrere kleinere Follow-Ups aus der Roadmap. Alle Änderungen sind auf `main` gemerged, Stable-APK 1.4.3 gebaut.

## Session-23-Recap

### 1. Detail-Sheet komplett umgebaut (großer Brocken)

Aus dem alten Text-Header ist ein 1:1-Dashboard-Card-artiger Hero geworden:

- **Hero-Bild** 130 px hoch, Gerichtbild als Hintergrund
- **Overlays** (alle 40 × 40 kreisrund oben, kleiner unten):
  - Oben links: Edit-Pill (öffnet Picker) + Reroll-Pill (würfelt neu)
  - Oben rechts: Sparkles (nur bei `isNewDish`) + Fav-Pill + Liste-Toggle-Pill
  - Unten links: Wochentag-Pill (26 px, kcal-Pill-Look)
  - Unten rechts: Personen-Stepper (frosted-glass)
- **Body-Info**: Meta (`~Min. · Cuisine`) + Titel (einzeilig, Ellipsis)
- **Tabs** Zutaten/Rezept (unverändert), Content wischbar
- **Makro-Footer** als Sibling der `.sheet-body` — sichtbar in beiden Tabs:
  - portions=1: 4 Pills mittig (kcal + P + KH + F) mit `dish.kcal × userScale`
  - portions>1: Zeile pro User (`Du`, dann Profilname) + optional eine „Gast"/"Gäste"-Zeile mit `dish.kcal × standardProfileScale`. Snap-Rundung aus `dishScale` bleibt, identisch zur Kochmengen-Berechnung.
- **Horizontal-Swipe** über das Bild wechselt Wochentag (Mo → So, kein Wrap-Around), gleicher Tab bleibt. Runter-Swipe schließt weiterhin.
- **Picker-Callback**: `openDishPicker(day, { onAfterPick })` — nach Pick öffnet das Sheet automatisch mit dem neuen Gericht im gleichen Tab. Wenn Picker ohne Pick geschlossen wird, öffnet nichts.

Bugfix während des Umbaus: `renderShell()` setzt `.is-open` direkt aufs Overlay wenn Sheet schon offen war. Ohne diesen Fix fehlten dem re-gerenderten Overlay die `pointer-events: auto` → Klicks fielen durchs Sheet aufs Dashboard-Card-Image drunter, was das Sheet mit dem ursprünglich geklickten Tag wieder öffnete und `currentContext` überschrieb (klassischer Debug-Marathon).

### 2. Kleinere Roadmap-Punkte

- **#1** Expand-All-Icon im Einkaufsliste-Done-State: erscheint jetzt auch wenn alles abgehakt UND alles collapsed ist. Handler öffnet dann alle gerenderten Kategorien (nicht nur die mit offenen Items).
- **#2** Erstes Komma im Done-Banner entfernt. Zusätzlich `–` + `!` raus, Wort „Mahlzeit" ersetzt durch `logo.png` (2.8em hoch, Dark-Mode via `brightness(0) invert(1)`, Light-Mode-Farbe intensiviert via `brightness(0.45) saturate(1.7)`).
- **#6** Wochentag-Pill Picker: konnte nicht mehr reproduziert werden — vermutlich durch andere Änderungen mitgefixt. User hält die Augen offen.
- **Rezept-Rename** Carne-Asada-Bowl (id 34): Name gekürzt, damit im einzeiligen Detail-Sheet-Titel keine Ellipsis nötig ist.

### 3. Overlay-Blur (neu)

`util/overlay-blur.js` beobachtet per MutationObserver alle 10 Sheet-Roots (detail, settings, picker, macro, onboarding, add-choice, update, profile-\*). Sobald ein Sheet sichtbar + `.is-open` gesetzt hat, setzt der Observer `body.has-open-overlay`. CSS blurred dann `#app-header`, `#app`, `#bottom-nav` mit `filter: blur(3px)` (60 ms Transition, `filter: blur(0)` als Default für saubere Interpolation).

Warum nicht `backdrop-filter`: auf Android WebView unzuverlässig. JS-Weg funktioniert immer, verlangt kein Eingriff in einzelne Sheet-Module.

### 4. Dashboard-Neu-Marker

Sparkles-Icon in `day-card__portion-overlay` links neben der Fav-Pill wenn `isNewDish(dish.id)` — analog zum Detail-Sheet-Hero. Zeigt sichtbar welche Rezepte aus dem letzten Remote-Import stammen.

### 5. Settings-Default

`collapsedSections` beim App-Start um `daten`, `rezepte`, `ueber` erweitert — beim ersten Öffnen sind nur **Profile** + **Darstellung** aufgeklappt (die täglich relevanten Sections). Rest muss bewusst ausgeklappt werden. Transient, überlebt Sheet-Close/Reopen aber nicht App-Restart.

## Version-History Session 23

| Version | versionCode | Was |
|---|---:|---|
| 1.4.0-beta | 11 | Detail-Sheet-Rebuild (Bild-Hero, Overlays, Swipe) |
| 1.4.1-beta | 12 | Multi-User-Footer + Overlay-Blur (backdrop-filter) |
| 1.4.2-beta | 13 | Overlay-Blur-Fix (per Body-Class statt backdrop-filter) |
| 1.4.3-beta | 14 | Dashboard-Neu-Marker + schnellerer Blur-Toggle (auf `.is-open`) |
| 1.4.3 | 15 | Stable-Release inkl. Einkaufsliste-Done-State-Fixes + Mahlzeit-Schriftzug im Banner |

Nach 1.4.3-stable kamen noch (ohne Version-Bump):
- Mahlzeit-Schriftzug im Light-Mode farbintensiver
- Settings: nur Profile + Darstellung default expanded

## Branch-State beim Session-Ende

- **`main`** = **`beta`** = `ad98e20` — beide synchron.
- **Feature-Branch `detail-sheet-hero`** wurde nach Merge lokal + remote gelöscht.
- Keine offenen PRs.
- Working tree clean, keine uncommitted Änderungen.

## Bekannte Rest-Punkte (Backlog / später)

### Aus der Session-23-Roadmap noch offen (8 von 12)

- **#3** Einkaufsliste-Kategorie-Counter auf positives Framing (aktuell `0/5` bei erledigt, soll `5/5` sein — konsistent zum globalen Zähler oben).
- **#5** Einkaufskorb-Badge auch bei 0 anzeigen (aktuell versteckt wenn keine offenen Zutaten).
- **#8** Picker: Filter-Section-Header Scroll+Expand analog zur Einkaufsliste.
- **#9** Nährstoff-Details: Hinweistext „Ø basiert nur auf markierten Gerichten" einfügen.
- **#10** Nährstoff-Details: Makro-Donut wie im Onboarding-Wizard (ersetzt/ergänzt aktuelle Pills). Detailklärung noch offen.
- **#11** Standard-Profil-Card: dashed Border wie „Profil hinzufügen".
- **#12** Standard-Profil-Card: kcal-Bereich statt Alter/Größe/Gewicht.
- **#13** Standard-Profil-Detail: nur Abendessen-kcal-Slider, alle anderen Felder raus.

Alle in [`docs/redesign/session-23-roadmap.md`](../session-23-roadmap.md) mit Screenshot-Referenzen dokumentiert.

### Weitere Backlog-Punkte

- **File-pro-Rezept + Auto-ID-Vergabe** (siehe [`backlog.md`](../backlog.md)) — bei Community-PRs Konflikte am dishes.json-Ende.
- **Filesystem-Bild-Cache in Real-Traffic-Runde noch nicht verifiziert** (bisher alle importierten Rezepte auch bundled).
- **Validator Prefix-Kollision False-Positive** bei `gewuerz_*`-Keys.
- **`AUTO_CHECK_INTERVAL_MS`** ist raus — bei Bedarf aus Session-22 log rekonstruierbar (Commit `56f618e`).

## Neu während Session 23 aufgetaucht

- **Snap-Rundung im Multi-User-Footer**: Die Pill-Werte je User können identisch aussehen wenn beide Ziele auf denselben `dishScale` snappen (0.25-Schritte). Der User hat das als „Bug" gemeldet — ist aber konsistent zur Kochmengen-Berechnung. Wenn irgendwann exakte Werte gewünscht sind: eine separate `displayScale` ohne Snap machen (Kochmengen behalten Snap, nur Anzeige nicht). Aktuell bewusst konsistent gelassen.
- **Debug-Bug Wochentag-Pill Picker (#6)** ließ sich mit Log nicht reproduzieren. User hält die Augen offen für ein spezifisches Szenario (aktuelles Fleisch-Gericht + Fisch-Filter aktiv).

## Test-Zustand am Session-Ende

- Stable-APK 1.4.3 (versionCode 15) gebaut, aus `main`.
- APK-Pfad: `android/app/build/outputs/apk/debug/app-debug.apk`.
- Auf Handy installiert und getestet: Detail-Sheet, Multi-User-Footer, Overlay-Blur, Dashboard-Neu-Marker, Mahlzeit-Schriftzug im Banner alles OK.
- `remote-config.js` zeigt korrekt auf `main`.

## Einstiegs-Move für Session 24

```bash
git status
git log main --oneline -5
```

Falls User mit den Rest-Punkten weitermachen will: siehe Roadmap oben. Kandidaten für einen kompakten nächsten Batch:

1. **Standard-Profil komplett** (#11 + #12 + #13 zusammen — thematisch verwandt, gemeinsame Änderung in `settings/render.js` + `profile-detail-sheet.js`).
2. **Einkaufsliste-Feinschliff** (#3 + #5 — kleine Änderungen in `shopping-list/render.js` bzw. `dish-picker/render.js`).
3. **Nährstoff-Details-Umbau** (#9 + #10 — brauchen erst Detailklärung was der Donut zeigen soll).
4. **Picker Filter-Sticky** (#8 — Copy der Einkaufsliste-Header-Klick-Logik).

Bei Rezept-Änderungen: CLAUDE.md-Regel „Rezept-Bestätigung" beachten — vollständigen Entwurf zeigen bevor Commit.
