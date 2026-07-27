# Handoff — Session 21 → 22 (Mahlzeit-App)

## Fokus Session 22: Phase C — Live-Testing + Release

Session 21 hat Phase A (App-Änderungen) und Phase B (Repo-Contribution-Files + GitHub Action) des **Rezept-Import End-to-End**-Features komplett implementiert. Branch `rezept-import` ist bereit für Live-Testing (Phase C) und Release.

- **Design-Doc:** [`docs/redesign/2026-07-27-rezept-import-design.md`](../2026-07-27-rezept-import-design.md)
- **Plan-Doc:** [`docs/redesign/2026-07-27-rezept-import-plan.md`](../2026-07-27-rezept-import-plan.md)

## Session-21-Recap

### Was fertig ist

- **Phase 0** (2 Commits): `schemaVersion: 1` in `dishes.json` und `ingredients.json`, neue `src/data/remote-config.js` mit URLs / Schema-Konstanten / Rate-Limits / `IMPORT_ENABLED`-Flag.
- **Phase A** (14 Commits, inkl. 1 Revert): State-Slots + Persistenz, `mergeRemote` + `isNewDish`, Fetcher + `checkSchemaVersion`, Diff-Funktion, Image-Cache (Capacitor + IndexedDB-Fallback), `performImport` + `performAutoCheck` + `canManualFetch`, Auto-Check-Trigger in `main.js`, Badge am Burger-Icon, Settings-Section „Rezepte", Update-Sheet, `dish-image.js` mit Card-Integration, Neu-Marker-Filter + Card-Prop.
- **Phase B** (11 Commits, inkl. Rename): Validator-Skelett + Pflichtfelder + Ingredient-Konsistenz + Sanity + Prefix-Warnung + Bild-Checks (`sharp@0.35.3`), GitHub Workflow `pr-recipe-check.yml`, PR- und Issue-Templates, `docs/recipe-schema.md`, `docs/recipe-image-prompt.md`, `CONTRIBUTING.md`, README-Update mit „Rezepte beisteuern"-Section, Verworfen-Header im alten Template.

### Was getestet ist

- **Node-Simulation:** 4 Test-Suiten alle grün:
  - `src/state.test.mjs` — Set-Persistenz + Fresh-Install
  - `src/data/dishes.test.mjs` — Merger + Cleanup + Missing-Ingredient-Filter (5 Fälle)
  - `src/data/remote-updates.test.mjs` — Schema-Check + Diff (11 Checks)
  - `scripts/validate-recipe.test.mjs` — 15 Validator-Fälle mit echten Fixture-Repos
- **Build:** `npm run build` läuft sauber. Zwei `INEFFECTIVE_DYNAMIC_IMPORT`-Warnungen (harmlos — siehe „Bekannte Rest-Punkte" unten).

### Was NICHT getestet ist

- **Browser-Live-Test** — Auto-Check-Flow, Badge-Sichtbarkeit, Update-Sheet-Interaktion, Rate-Limit, Fehler-Sheets. Simulation nur logisch.
- **APK-Live-Test** — Filesystem-basierter Bild-Cache, End-to-End auf echtem Android-Gerät.
- **GitHub-Action-Live-Test** — Der Workflow wurde nur inhaltlich verifiziert, nicht in einer echten PR-Runde durchlaufen.

### Notable Deviations aus der Umsetzung

Alle Deviations vom Plan-Doc wurden in den Commits dokumentiert:

1. **Node 25 JSON-Imports** — überall wo `dishes.json` / `ingredients.json` als ES-Modul importiert wird, wurde `with { type: 'json' }` ergänzt (Node 25 hart erforderlich, Vite strippt den Attribut beim Bundling).
2. **A.1 State-Reset** — Remote-Slot-Reset wurde an den TOP von `loadState()` verlegt (statt nur success-path), damit Fresh-Install saubere Defaults hat.
3. **A.6 sharp-Bump** — Validator-Dependency von `^0.33.0` auf `^0.35.3` (libvips CVEs).
4. **A.10 „Kommt bald"-Note entfernt** — In `settings/render.js` wurde die alte Placeholder-Note der Daten-Section entfernt, weil sie durch die neue Rezepte-Section überholt ist. Die Daten-Section behält den „Einrichtung"-Button.
5. **A.11 CSS-Klassen** — Update-Sheet nutzt `.update-sheet-overlay` + eigene BEM-Namensraum (statt `.sheet-backdrop`), passend zur bestehenden `styles/components/profile-share-sheet.css`.
6. **A.12 Detail-Sheet-Bild reverted** — Der Implementer hatte ein neues `<img>`-Element im Detail-Sheet-Header ergänzt (ohne CSS). Wurde als separater Commit rückgängig gemacht. Falls du im Detail-Sheet einen Hero-Bild-Bereich willst, ist das ein eigener UX-Task.
7. **A.13 Filter-Gruppe umbenannt** — `group: 'special'` → `group: 'neu'` (Konsistenz mit `state.remoteNewIds` und Filter-Label „Neu"). Ganze Codebase wurde nach „special" durchsucht — keine weitere Stelle.

## Branch-State beim Session-Ende

- **`rezept-import`** — **27 Commits ahead of `main`**, working tree sauber. **NICHT** auf remote gepusht — das ist der erste Schritt in Session 22.
- **`main`** — `612a5bf` (docs plan) — unverändert seit Session-Anfang plus die drei initialen Doc-/Fix-Commits (Icon-Fix + Design + Plan).
- **`beta`** — `290f28f` (Session 20 Multi-User) — unverändert, wird in Phase C.4 gemerged.
- **`multiuser`** — `39e3f1d` — abgeschlossen, keine weiteren Änderungen erwartet.

## Phase C — Reihenfolge und Details

Alle 4 Tasks sind noch offen. Jede erfordert User-Handlung (physisches Gerät, GitHub-Klicks, Merge-Entscheidungen). Reihenfolge streng einhalten — jeder Schritt validiert die vorherigen.

### C.1: Dev-Server-Test

**Vor jedem anderen C-Task.** Erwischt UI-Regressionen bevor eine APK gebaut wird.

```bash
npm run dev
```

Test-Checkliste (im Browser, DevTools offen):

- **Auto-Check läuft beim Start:** Network-Tab zeigt zwei GET-Requests gegen `raw.githubusercontent.com/shogun160/mahlzeit-app/main/src/data/{dishes,ingredients}.json`. Wenn Remote = Bundled ist: keine Badge-Sichtbarkeit erwartet.
- **Badge forcieren:** Console → `state.remoteHasUpdates = true; refresh()`. Badge muss am Burger-Icon oben rechts erscheinen (kleiner roter Dot).
- **Badge-Clear:** Burger klicken → Settings-Sheet öffnet → Badge weg (auch wenn Rezepte-Section nicht sichtbar).
- **Settings → „Rezepte"-Section:** neue Section sichtbar, Summary zeigt „Noch nicht geprüft" oder „Zuletzt geprüft: vor X min · alle Rezepte sind aktuell", Button „Nach neuen Rezepten suchen" klickbar.
- **Update-Sheet „alles aktuell":** Console → `state.remoteLastFetchAt = null`; Settings → Button → Loading-Sheet → Toast „Deine Rezepte sind aktuell.".
- **Rate-Limit:** direkt zweiter Klick binnen 60s → Toast „Bereits gerade geprüft, keine neuen Rezepte.".
- **Fehler-Sheet:** DevTools → Network → Offline; Console → `state.remoteLastFetchAt = null`; Settings → Button → Fehler-Sheet „Keine Verbindung — versuch es später erneut.".
- **Neue-Rezepte-Fall (optional):** einen Test-Rezept lokal in `state.remoteDishes` löschen (falls schon Remote geladen wurde) oder in `dishes.json` einen Eintrag temporär entfernen — Auto-Check würde das als „neu" erkennen.

Bei Fund von Regressionen: Bug fixen bevor du zu C.2 gehst.

### C.2: Beta-APK-Test

**Nur nach explizitem „APK bauen"-OK** (Memory-Guardrail `feedback_apk_only_on_request.md`).

Schritte:

1. Version-Bump in `android/app/build.gradle`: `versionCode 4`, `versionName "1.3"`.
2. `npm run build && npx cap sync`.
3. `cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug`.
4. APK auf Test-Gerät installieren (deinstalliert die vorherige, weil Package-ID gleich).
5. End-to-End auf Gerät: Auto-Check läuft, Badge erscheint bei neuen Rezepten, Import lädt Metadata + Bilder progressiv, Cards zeigen die neuen Rezepte, Detail-Sheet öffnet sich normal, App-Neustart → alles persistiert, Bilder aus Cache.
6. Android-Settings → App-Daten löschen → Auto-Check baut alles neu auf.

Sonderfall: wenn kein tatsächlich neuer Remote-Rezept-PR existiert, hast du beim ersten Import 0 neue Rezepte. Um End-to-End zu testen, brauchst du entweder Task C.3 (dummy PR mit Merge) oder du löschst manuell einen bundled-Eintrag aus deinem lokalen `state.remoteDishes`.

### C.3: Dummy-PR-Action-Test

**Push `rezept-import` VOR C.3.** Der Test funktioniert nur wenn die Action auf `main` bereits verfügbar ist — also entweder der Feature-Branch ist gemerged (dann brauchst du keinen Dummy-PR mehr) oder du machst den PR gegen einen Test-Branch mit der Action drin.

Für einen sauberen End-to-End-Action-Test empfehle ich:

1. **Alternative A — Test vor Merge:** Öffne den PR von `rezept-import` → `main`. Der Workflow trigger'd, weil `dishes.json`/`ingredients.json` geändert sind (durch die `schemaVersion`-Ergänzung). Action läuft grün → Bestätigung dass Workflow-YAML valide ist. Danach normal mergen.
2. **Alternative B — echter Dummy-PR nach Merge:** Nach Merge einen extra Test-Branch aufmachen, absichtlich fehlerhaftes Rezept einfügen (falsche `cuisineGroup`, fehlendes Bild, kcal-Fehler), PR gegen `main`. Action muss rot sein mit PR-Kommentar. Danach fixen, grün prüfen, PR schließen (nicht mergen — reines Test).

Alternative A ist billiger — nutzt den echten Merge-PR als „automatischer Rauchtest". Alternative B ist gründlicher — deckt Fehler-Fälle ab.

### C.4: Merge + Stable-Release

Nur nach C.1-C.3 alle grün.

1. Merge `rezept-import → beta`, push. Beta-APK bauen (falls du eine separate Beta-Test-Runde willst — sonst überspringen).
2. Merge `beta → main`, push.
3. Stable-APK: bereits gebaut in C.2 wenn nichts sich zwischen beta und main geändert hat. Sonst neu bauen (`versionCode 4`, `versionName "1.3"`, Debug-signiert wie 1.2).
4. `docs/redesign/backlog.md`: beide Einträge („Rezepte aus GitHub-Repo aktualisieren" + „Community-Rezepte per GitHub Pull Request") als **„Umgesetzt in Session 21 (1.3)"** markieren.
5. Handoff-Doc für Session 22 → 23 schreiben.

## Bekannte Rest-Punkte

- **Two `INEFFECTIVE_DYNAMIC_IMPORT`-Warnungen im Build:**
  - `src/util/toast.js` — vor Session 21 schon so.
  - `src/data/remote-updates.js` — `main.js` importiert es dynamisch (per Design, um First-Render nicht zu blockieren), aber `update-sheet.js` und `rezepte-section.js` importieren es statisch. Effekt: das Modul landet im Haupt-Chunk, nicht in einem separaten Chunk. Funktional egal, kosmetisch ein Cleanup-Kandidat für später (entweder alle statisch, oder alle dynamisch).
- **UI-Position „Neu"-Marker deferred:** Card hat `.day-card--new`-Klasse + `data-is-new`-Attribut, aber KEIN visueller Marker. Die Position (Badge oben-links, Textzeile, Farb-Akzent) sollte in der Live-App entschieden werden. Filter-Chip „Neu" im Picker ist funktional, taucht aber ohne bewusste Styling-Iteration wie jeder andere Chip auf.
- **Detail-Sheet Hero-Bild deferred:** Task A.12-Revert. Falls im Detail-Sheet ein Bild gewünscht ist, braucht es CSS-Design + eventuell Layout-Anpassung.
- **`cuisineGroup`-Enum-Erweiterung:** Aktuell nur `mediterranean, asian, middleEast, americas`. Sobald ein Rezept in `indian, european, german` etc. reinkommt, muss die Konstante in `src/dish-picker/render.js` (FILTERS-Array), `scripts/validate-recipe.mjs` (CUISINE_GROUPS) und `docs/recipe-schema.md` synchron erweitert werden.
- **Feature-Flag Kill-Switch:** `IMPORT_ENABLED` in `remote-config.js` ist auf `true`. Falls das Feature akut Rollback braucht: Flag auf `false`, APK 1.3.1 bauen.

## Referenz-Files

- **Design-Doc:** [`docs/redesign/2026-07-27-rezept-import-design.md`](../2026-07-27-rezept-import-design.md)
- **Plan-Doc:** [`docs/redesign/2026-07-27-rezept-import-plan.md`](../2026-07-27-rezept-import-plan.md) — Phase C ist detailliert dokumentiert in Task C.1-C.4
- **Backlog:** [`docs/redesign/backlog.md`](../backlog.md) — die zwei Einträge „Rezepte aus GitHub-Repo aktualisieren" + „Community-Rezepte per GitHub Pull Request"
- **Contribution-Doku im Repo:** [`CONTRIBUTING.md`](../../../CONTRIBUTING.md), [`docs/recipe-schema.md`](../../recipe-schema.md), [`docs/recipe-image-prompt.md`](../../recipe-image-prompt.md)
- **GitHub Workflow:** [`.github/workflows/pr-recipe-check.yml`](../../../.github/workflows/pr-recipe-check.yml)

## Einstiegs-Move für Session 22

```bash
# Aktuellen Stand pruefen
git status
git log rezept-import --oneline -30
git branch -v

# Wenn noch nicht gepusht:
# git push -u origin rezept-import

# Dev-Server fuer C.1 starten
npm run dev
# Browser oeffnen (DevTools an), Test-Checkliste aus diesem Doc durchgehen
```

Alle Regressionen aus C.1 → als Fix-Commits auf `rezept-import` legen. Dann weiter mit C.2 (nach explizitem APK-OK).
