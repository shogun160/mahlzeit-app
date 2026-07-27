# Rezept-Import End-to-End — Design

**Datum:** 2026-07-27
**Status:** Design (nach Brainstorming, vor Umsetzungs-Plan)
**Session:** 21

## Zielsetzung

Neue Rezepte sollen die App-Nutzer erreichen, **ohne** dass ein APK-Update nötig ist. Zwei zusammengehörige Bausteine:

- **Konsum-Pfad (App):** Die App fetched Rezept-Daten aus dem öffentlichen GitHub-Repo und importiert sie in den lokalen State — inkl. Bild-Cache.
- **Contribution-Pfad (Repo):** Templates, Doku und eine GitHub Action stellen sicher, dass Community-PRs (oder eigene) sauber gemerged werden können und die Content-Qualität stabil bleibt.

**Kernprinzip:** Content-Rollout entkoppelt vom Schema-Rollout. Neue Rezepte kommen ohne APK-Update. Schema-Änderungen bleiben APK-gebunden — bei Version-Mismatch klare Fehlermeldung „Bitte App aktualisieren".

## Design-Entscheidungen (Übersicht)

| Thema | Entscheidung |
|-------|--------------|
| Update-Scope | Nur neue Rezepte via Remote. `revision`-Feld pro Rezept im Schema als Zukunfts-Öffnung dokumentiert, aktuell nicht ausgewertet. |
| Update-Trigger | Silent Auto-Check 1x/Tag beim App-Start + Badge am Burger-Icon im Header + manueller Button in Settings. |
| Update-Sheet | Kompakte Text-Liste + Bulk-Import („X Rezepte laden"). Kein Einzel-Select. |
| Content-Channel | Keine Trennung. Beta-APK und Stable-APK fetchen beide von `main`. Kein `applicationIdSuffix`, kein Env-Var für Fetch-URL. |
| Fehler bei Missing Ingredient | Rezept wird übersprungen, Rest lädt normal, Warnung im Ergebnis-Sheet. |
| Rate-Limit manueller Button | 60s Soft-Cache. Button bleibt klickbar; innerhalb der Cache-Zeit Toast statt neuer Fetch. |
| Cache-Cleanup | Lazy beim Merger — Remote-Einträge deren ID jetzt bundled ist raus aus State + Bild via `Filesystem.deleteFile` fire-and-forget. |
| Duplicate-Warnung für Zutaten | Human-Checkliste im PR-Template + 4-Zeichen-Prefix-Warnung in der Action (kein Block, nur Kommentar). |
| Doku-Struktur | Getrennte Files: `CONTRIBUTING.md`, `docs/recipe-schema.md`, `docs/recipe-image-prompt.md`. README bekommt „Rezepte beisteuern"-Section. Bestehendes `docs/redesign/recipe-import-template.md` mit Verworfen-Redirect. |
| „Neu"-Markierung | Funktion (State + Merger-Cleanup + Filter-API) fest im Design. UI-Position (Badge, Filter-Chip) wird in separater Iteration bei der Umsetzung festgelegt. |

## Phase A — App-Änderungen

### Konfiguration

Neue Datei `src/data/remote-config.js`:

```js
const REPO_BASE = 'https://raw.githubusercontent.com/shogun160/mahlzeit-app/main';

export const dishesUrl = `${REPO_BASE}/src/data/dishes.json`;
export const ingredientsUrl = `${REPO_BASE}/src/data/ingredients.json`;
export const dishImageUrl = (id) => `${REPO_BASE}/public/dishes/dish-${id}.jpg`;

export const SCHEMA_VERSION_DISHES = 1;
export const SCHEMA_VERSION_INGREDIENTS = 1;

export const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const MANUAL_RATE_LIMIT_MS = 60 * 1000;

// Notfall-Kill-Switch: false schaltet Auto-Check UND manuellen Button aus.
// Ermöglicht einen Feature-Rollback ohne größeren Code-Umbau (nur Konstante
// flippen und neue APK bauen).
export const IMPORT_ENABLED = true;
```

Kein Channel-Split — der Fetch-Branch ist hart `main`.

### State-Slots

Neu in `src/state.js`, alle in `mahlzeit-state-v2` persistiert (Guardrail 2 bleibt intakt, nur zusätzliche Felder):

```js
state.remoteDishes = [];           // Dish[] wie in dishes.json
state.remoteIngredients = {};      // { key → Ingredient } wie in ingredients.json
state.remoteUpdatedAt = null;      // ISO-String vom letzten erfolgreichen Fetch
state.remoteHasUpdates = false;    // vom Auto-Check gesetzt, nach Öffnen des Settings-Sheets gecleart
state.remoteLastFetchAt = null;    // ISO-String für 60s-Soft-Rate-Limit
state.remoteNewIds = new Set();    // IDs die aktuell als „Neu" gelten
```

Set-Serialisierung als Array beim Save/Load (Muster wie bestehendes `state.selected`).

### Schema-Versionierung

`dishes.json` und `ingredients.json` bekommen ein neues Top-Level-Feld `schemaVersion: 1` (einmalige Migration im Rahmen dieses Features).

`revision`-Feld pro Rezept wird im Schema-Doku erwähnt, aber vom Loader nicht ausgewertet — Zukunfts-Öffnung für ein späteres „Fixes von Bundled-Rezepten via Remote"-Feature (aktuell nicht Scope).

**Mismatch-Verhalten:**

- Remote-Version == lokal: Import läuft.
- Remote-Version > lokal: Fehler-Sheet „Neue Rezepte nutzen ein neueres Datenformat. Bitte die App aktualisieren und dann erneut versuchen." Kein Retry.
- Remote-Version < lokal (sollte nicht vorkommen): Fehler-Sheet mit Link „Bitte melde dies auf GitHub".
- `schemaVersion` fehlt komplett: gleicher Fehler-Pfad wie „zu alt".

### Merger-Logik + Cleanup

Erweiterung von `src/data/dishes.js`. Beim Modul-Load (und nach jedem erfolgreichen Remote-Import) läuft:

1. **Cleanup-Pass:** Für jedes Remote-Dish, dessen ID inzwischen in Bundled ist:
   - Aus `state.remoteDishes` raus
   - Aus `state.remoteNewIds` raus
   - Bild-Datei per `Filesystem.deleteFile('remote-dishes/dish-<id>.jpg')` fire-and-forget
2. **Merger:** Bundled zuerst, dann Remote-Dishes deren ID nicht bundled ist. Bundled hat immer Vorrang.
3. **Missing-Ingredient-Filter:** Wenn ein Remote-Dish auf einen Ingredient-Key verweist, der weder bundled noch in `state.remoteIngredients` ist, wird das Rezept übersprungen und die Warnung in ein Array gesammelt, das das Update-Sheet ausliest.
4. **Ingredient-Merger analog:** Bundled hat Vorrang; Remote-Ingredients mit bereits bundled Key werden ignoriert (Guardrail 8).

### Auto-Check

Trigger in `main.js` beim App-Start (nach State-Load, vor First-Render):

```js
// Bedingung: Netz erreichbar UND (remoteUpdatedAt fehlt ODER älter als AUTO_CHECK_INTERVAL_MS)
// → silent Fetch der beiden JSON-Dateien
// → Schema-Check; bei Fail: still, remoteHasUpdates bleibt false
// → Diff gegen bundled + state.remoteDishes; neue IDs vorhanden → remoteHasUpdates = true
// → refresh() zieht den Badge nach
// Bei jedem Fehler: silent (kein Toast). remoteLastFetchAt wird trotzdem gesetzt.
```

Der Auto-Check zieht nur die JSONs (~50 KB gesamt), nie Bilder — die kommen erst beim expliziten Import.

### Badge

- Position: **Burger-Icon** (`ICON_MENU` in `src/dashboard/header.js`), sowohl im Dashboard- als auch im Shopping-View.
- Darstellung: kleiner roter Dot ohne Zahl (analog zum Shopping-Nav-Badge, aber kleiner und ohne Text).
- Sichtbar wenn `state.remoteHasUpdates === true`.
- Wird gecleart sobald der User das Settings-Sheet öffnet (nicht erst beim Scrollen zur „Rezepte"-Section — er hat das Signal gesehen).

### Settings-UI

Neue Section **„Rezepte"** im Settings-Sheet (Reihenfolge nach existierenden Sections, sinnvoll unten oder direkt vor „Erscheinungsbild"). Struktur:

```
📋 Rezepte
   [dynamische Summary — siehe unten]
   [ Nach neuen Rezepten suchen ]   ← Secondary-Button
```

**Section-Summary (dynamisch):**

- Nie geprüft: „Noch nicht geprüft"
- Geprüft, alles aktuell: „Zuletzt geprüft: vor 3 Tagen · alle Rezepte sind aktuell"
- Neue verfügbar: „X neue Rezepte verfügbar · zuletzt geprüft: vor 2 Std." + kleiner Dot in der Section-Zeile

### Update-Sheet

Nach Klick auf den manuellen Button (oder wenn User dem Badge folgt und dann den Button drückt):

**Fall „neue Rezepte gefunden":**

```
Neue Rezepte gefunden (3)

• Butter Chicken mit Basmati    (Indisch)
• Falafel-Bowl mit Tahini       (Nahost)
• Miso-Ramen mit Ei             (Asiatisch)

[ 3 Rezepte laden ]  ← Primary
[ Abbrechen ]        ← Text-Button
```

Nach Bestätigung: Progress-Sheet „2 von 3 geladen…" während Bilder sequentiell gefetcht werden. Metadata ist sofort im State (Cards sichtbar mit Silhouetten-Fallback), Bilder pop-in wenn geladen. Bei übersprungenen Rezepten (Missing Ingredient) am Ende Info-Zeile: „3 Rezepte geladen · 1 übersprungen (Butter Chicken — Zutat `butter_ghee` fehlt)".

**Fall „alles aktuell":**

Toast „Deine Rezepte sind aktuell." (kein Sheet). Section-Summary updated.

**Fall „innerhalb 60s bereits geprüft":**

Toast „Bereits gerade geprüft, keine neuen Rezepte." (kein neuer Fetch).

### Fehler-Handling

Sechs Fehler-Klassen mit klarer UX:

1. **Keine Verbindung / Fetch-Fehler:**
   Auto-Check silent. Manueller Button → Toast „Keine Verbindung — versuch es später erneut."

2. **JSON-Parse-Fehler:**
   Auto-Check silent. Manueller Button → Toast „Rezepte-Datei ist beschädigt — bitte später erneut."

3. **Schema-Mismatch (Remote > lokal):**
   Auto-Check setzt `remoteHasUpdates = false` (kein Badge). Manueller Button → Fehler-Sheet mit App-Update-Hinweis, kein Retry.

4. **Missing Ingredient in Remote-Dish:**
   Dish wird geskipped, Warnung im Ergebnis-Sheet.

5. **Bild-Download-Fehler:**
   1x Retry nach 2s. Wenn wieder fehlgeschlagen: Bild bleibt Fallback-Silhouette, kein Toast. `state.remoteImageFailures = new Set()` mit TTL 24h — beim nächsten App-Start wird die Failure-Liste geleert und Downloads werden neu versucht.

6. **Concurrent Fetches:**
   Manueller Button während Auto-Check läuft: laufender Fetch wird via `state.remoteFetchPromise` (transient, nicht persistiert) geshared. Keine zwei parallelen Requests.

### Bild-Caching

**Speicherort:** `Directory.Data/remote-dishes/dish-<id>.jpg` (Capacitor Filesystem API).

**Web/Dev-Fallback** (`npm run dev` im Browser): IndexedDB mit Blob-URLs. Wrapper `imageCache.get(id)` / `imageCache.put(id, blob)` mit zwei Implementierungen.

**Bild-URL-Auflösung** im Card-Render und Detail-Sheet:

```js
function resolveDishImage(id) {
  if (bundledDishIds.has(id)) return `/dishes/dish-${id}.jpg`;   // Vite public
  const cached = imageCache.get(id);
  if (cached) return cached;                                     // Filesystem oder Blob
  return `/dishes/dish-placeholder.jpg`;                         // Silhouette
}
```

**Download-Ablauf beim Import:**

1. Metadata sofort ins State — Cards sind ab jetzt sichtbar (mit Fallback-Bild).
2. Bilder sequentiell downloaden (kein `Promise.all` — GitHub Raw hat großzügige Limits, aber wir verzichten auf 20 parallele Requests bei großen Batches).
3. Nach Download: Cache-Write + Card-Refresh via Event-Bus.
4. Fehler: siehe Fehler-Klasse 5.

**Cache-Größe:** Kein aktiver Cleanup außer dem Lazy-Merger-Cleanup. Erwartete Größe bei 100 Remote-Rezepten × 150 KB = ~15 MB — im Rahmen für eine App.

**User-Reset** (Android-Settings → App-Daten löschen): Cache + State weg, Bundled bleibt. Auto-Check beim nächsten Start baut neu auf. Kein Handling nötig, bewusst so dokumentiert.

### „Neu"-Markierung

**State:** `state.remoteNewIds: Set<id>`, siehe oben.

**Zustandsübergänge:**

- **Nach erfolgreichem Import:** Set wird komplett *ersetzt* durch die IDs des aktuellen Batches. Alte „Neu"-Markierungen verschwinden.
- **Beim Merger:** IDs die inzwischen bundled sind → aus dem Set raus (APK-Update-Fall).
- **Update-Check ohne Treffer:** Set bleibt unverändert. Die vorherigen „Neu"-Rezepte bleiben markiert bis nächster Import oder APK-Update.

**API für Consumer** (Card, Picker):

- `isNewDish(id) → boolean` in `src/data/dishes.js` exportiert.
- Card-Template (`src/dashboard/card.js`) bekommt optionales `isNew`-Prop. Rendering ist erstmal ein No-Op — die konkrete UI-Position (Badge oben-links, Textzeile, Farb-Akzent, …) wird bei der Live-App-Iteration entschieden, nicht im Design.
- Filter-Modul im Picker bekommt einen neuen Filter-Eintrag mit Test `(d) => isNewDish(d.id)`. Chip-Position und -Label werden ebenfalls bei der Live-Iteration festgelegt. Chip nur sichtbar wenn `state.remoteNewIds.size > 0`.

### Rate-Limit

- **Manueller Button:** 60s Soft-Cache. Wenn `remoteLastFetchAt` jünger als 60s: Toast statt neuer Fetch. Button bleibt visuell klickbar (kein Disabled-State).
- **Auto-Check:** 24h. Wenn `remoteUpdatedAt` jünger als 24h beim App-Start: kein Auto-Fetch.

## Phase B — Repo-Änderungen

### Datei-Struktur

Neue Dateien:

```
.github/
  pull_request_template.md
  ISSUE_TEMPLATE/
    recipe-suggestion.yml
  workflows/
    pr-recipe-check.yml
CONTRIBUTING.md
docs/
  recipe-schema.md
  recipe-image-prompt.md
scripts/
  validate-recipe.mjs
  package.json                     ← sharp-Dep, isoliert von App-package.json
```

Modifiziert:

```
README.md                          ← neue Section "Rezepte beisteuern"
docs/redesign/recipe-import-template.md   ← Verworfen-Header + Redirect
src/data/dishes.json               ← + schemaVersion: 1 (Top-Level)
src/data/ingredients.json          ← + schemaVersion: 1 (Top-Level)
```

### `.github/pull_request_template.md`

Wird beim Öffnen jedes PRs als Body-Vorschlag angezeigt:

```markdown
## Neues Rezept — Checkliste

- [ ] JSON in `src/data/dishes.json` ergänzt (Schema: `docs/recipe-schema.md`)
- [ ] Bild als `public/dishes/dish-<id>.jpg` beigelegt (800×800, ≤ 400 kB, JPEG)
- [ ] Neue Zutaten in `src/data/ingredients.json` ergänzt (falls nötig)
- [ ] Vor dem Anlegen geprüft, dass Zutaten nicht bereits unter anderem Key existieren
- [ ] Nährwerte plausibel (kcal ≈ p·4 + kh·4 + f·9, Toleranz ± 100)
- [ ] Bild-Prompt aus `docs/recipe-image-prompt.md` genutzt
- [ ] `npm run build` läuft lokal ohne Fehler
- [ ] PR gegen `main`-Branch
```

### `.github/ISSUE_TEMPLATE/recipe-suggestion.yml`

GitHub-Formular für User ohne Git. Felder:

- Name (String, required)
- Küche (Dropdown: mediterranean, asian, middleEast, americas, andere)
- Zutaten (Multi-Line Textarea)
- Zubereitungs-Schritte (Multi-Line Textarea)
- Optional: Bild-Anhang

Nicht auto-mergbar. Wird manuell (oder mit KI-Assistenz) in JSON übernommen.

### `CONTRIBUTING.md`

Root-Datei, wird von GitHub am „Contribute"-Button des Repos angezeigt:

```markdown
# Beitragen — Rezepte

Neue Rezepte sind willkommen. Zwei Wege:

## Mit Git (Pull Request)
1. Fork und Branch von `main` erstellen
2. Rezept in `src/data/dishes.json` ergänzen (Schema: docs/recipe-schema.md)
3. Bild als `public/dishes/dish-<neue-id>.jpg` beilegen (Prompt: docs/recipe-image-prompt.md)
4. Falls nötig neue Zutaten in `src/data/ingredients.json`
5. PR gegen `main`

Automatische Checks laufen. Bei rotem Check: Kommentare der Action lesen.
Nach Merge landet das Rezept beim nächsten Repo-Update-Check der App.

## Ohne Git (Issue-Formular)
Issues → New Issue → "Rezept-Vorschlag" → Formular ausfüllen.
Ich übernehme die Rezepte manuell in die Datenbank.

## Bild-Standard
Siehe docs/recipe-image-prompt.md — 800×800 JPEG, Foodblog-Stil.
```

### `docs/recipe-schema.md`

Extrahiert aus `docs/redesign/recipe-import-template.md`. Ohne die verworfenen Felder `newIngredients` und `image` (Contributor editiert direkt `ingredients.json` und legt Bild als eigenständige Datei ab).

Enthält:

- Feld-Referenz-Tabelle für Dish (id, name, cuisine, cuisineGroup, cooktime, kcal, p, kh, f, tags, ingredients, steps, optional revision)
- Enum-Werte für `cuisineGroup`: `mediterranean, asian, middleEast, americas` — Erweiterung dokumentiert (bei Bedarf um `indian, european, german` etc. ergänzen, dann im Filter-Modul das Enum synchron erweitern)
- Feld-Referenz für Ingredient (label, cat, unit, per100g, optional displayUnit, gramsPerUnit, size, note)
- Konventionen: Guardrail 8, Sprachstil in Steps, Portions-Definition
- Hinweis auf `revision`-Feld als Zukunfts-Öffnung (aktuell nicht ausgewertet)

### `docs/recipe-image-prompt.md`

Extrahiert aus `docs/redesign/recipe-import-template.md`. Enthält:

- Bild-Prompt-Template mit den drei Platzhaltern (Dish-Name, Zutaten/Zubereitung, Container)
- Konsistenz-Rahmen (Foodblog-Style, low three-quarter angle, natural daylight, marble/wood background, subtle props)
- Ausgabe-Format (1:1, ≥ 800×800, JPEG)
- Referenz-Beispiel aus dem Katalog
- Modell-agnostisch (funktioniert mit ChatGPT / Midjourney / Nano-Banana)

### README-Update

Bestehende „Rezepte hinzufügen"-Section (aktuell für lokalen Edit-Workflow) wird umgeschrieben zu:

```markdown
## Rezepte beisteuern

Neue Rezepte sind willkommen! Zwei Wege:

- **Mit Git:** Pull Request gegen `main`. Details in [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Ohne Git:** Issue via Formular (Issues → New Issue → „Rezept-Vorschlag").

Bild-Standard und JSON-Schema siehe [`docs/recipe-image-prompt.md`](docs/recipe-image-prompt.md) und [`docs/recipe-schema.md`](docs/recipe-schema.md).
```

### `docs/redesign/recipe-import-template.md`

Bekommt einen Kopf-Block:

```markdown
> ⚠️ **Verworfen** — dieses Template war für den File-Picker-Import-Ansatz gedacht (siehe [`backlog.md`](backlog.md) → „Rezept-Import (File-Picker) — verworfen").
>
> Für aktuelle Contribution siehe:
> - Schema-Referenz: [`docs/recipe-schema.md`](../recipe-schema.md)
> - Bild-Prompt: [`docs/recipe-image-prompt.md`](../recipe-image-prompt.md)
> - Contribution-Guide: [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
```

Datei bleibt sonst inhaltlich erhalten (Backlog verlinkt drauf).

## GitHub Action

### `.github/workflows/pr-recipe-check.yml`

**Trigger:**

```yaml
on:
  pull_request:
    branches: [main]
    paths:
      - 'src/data/dishes.json'
      - 'src/data/ingredients.json'
      - 'public/dishes/*.jpg'
```

**Wichtig:** `pull_request`, nicht `pull_request_target` — das ist die sichere Variante. `pull_request_target` würde mit Base-Branch-Kontext laufen und wäre die bekannte „pwn request"-Lücke.

**Job-Skelett:**

```yaml
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2   # für Diff gegen Base
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install validator deps
        working-directory: scripts
        run: npm ci
      - name: Run validator
        run: node scripts/validate-recipe.mjs
```

Keine Ausführung von Scripts aus dem PR-Content. Nur JSON und Bilder werden gelesen, nie eval'd.

### Bild-Checks (`scripts/validate-recipe.mjs` mit `sharp`)

Für jedes im PR geänderte / neue Bild in `public/dishes/dish-<id>.jpg`:

- Dimension: 800×800 ± 10 px
- Dateigröße ≤ 400 kB
- Format JPEG (kein PNG/WebP/AVIF)

### JSON-Checks

**Pflichtfelder in jedem neuen Dish:**
`id, name, cuisine, cuisineGroup, cooktime, kcal, p, kh, f, tags, ingredients, steps`

**`cuisineGroup` gegen Enum:** `mediterranean, asian, middleEast, americas`

**`id` eindeutig:**
- gegen bestehende IDs im Base-Branch (aus dem `git diff`-Kontext)
- gegen andere aktuell offene PRs (via `gh pr list` in der Action)

**Bild-Datei existiert:** für jede neue Dish-ID muss `public/dishes/dish-<id>.jpg` im PR sein.

**Ingredient-Keys existieren:** alle `ingredients[].key` müssen entweder in `src/data/ingredients.json` (bundled + im PR ergänzt) enthalten sein.

**Nährwerte-Sanity:** `|declared kcal − (p·4 + kh·4 + f·9)| < 100`.

**Prefix-Warnung (kein Block):** Wenn ein neuer Ingredient-Key mit denselben 4 Zeichen startet wie ein existierender → Warn-Kommentar am PR („Prefix-Kollision: `oregano_g` startet wie `oregano_tl` — bitte prüfen ob es sich um dieselbe Zutat handelt.").

**Steps-Format:** Jeder Step ist ein nicht-leerer String, endet auf Satzzeichen.

### Ergebnis

- **Fehler:** Roter Check + PR-Kommentar mit konkreten Zeilen und Fix-Hinweisen.
- **Erfolg:** Grüner Check ohne Kommentar (kein Rauschen).
- **Warnungen:** Grüner Check + Kommentar mit Warnung-Details (User entscheidet).

### Sicherheits-Notizen

- **`scripts/package.json` ist isoliert** von der App-`package.json`. `sharp` und ggf. weitere Validator-Deps werden nur in `scripts/node_modules/` installiert — greifen nie in den App-Build ein.
- **Kein `npm ci` mit PR-Content-Deps.** Die Action installiert nur die eingecheckte `scripts/package.json`.
- **Keine PR-Scripts ausgeführt.** Validator liest nur Daten-Dateien.

## Testing-Strategie

### Node-Simulation

Nach dem Muster von `src/profile-share/payload.test.mjs`:

- `src/data/dishes.test.mjs` — Merger + Cleanup + Missing-Ingredient-Filter
- `src/data/remote-updates.test.mjs` — Schema-Version-Check (alle 4 Fälle)
- `scripts/validate-recipe.test.mjs` — Pflichtfelder, Enum, Sanity, Prefix-Warnung, fehlende Bild-Datei; läuft in der Action als Vor-Check

### Manuelles Browser-Testing (`npm run dev`)

- Update-Flow: `REPO_BASE` temporär auf einen Fork oder Test-Branch zeigen
- Auto-Check-Timing: `state.remoteUpdatedAt` in DevTools auf gestern setzen, Reload → Badge erscheint
- 60s-Rate-Limit: doppelter Klick → zweiter Toast „bereits gerade geprüft"
- Fehler-Sheets: Netz offline, dann manueller Button → „Keine Verbindung"-Toast
- Missing-Ingredient: temporär in `dishes.json` einen kaputten Key setzen, Update ziehen → Sheet zeigt „X übersprungen"

### Live-APK (Beta-APK auf Gerät)

- End-to-End: PR gegen main mergen → Beta-App wartet auf Auto-Check am nächsten Tag → Badge → Import-Sheet → neuer Rezept im Picker sichtbar
- Bild-Progressive-Load: erst Card mit Silhouette, dann Bild pop-in
- App-Neustart nach Import: Rezept persistiert, Bild kommt aus Cache (kein neuer Fetch)
- App-Daten-Reset über Android-Settings: Auto-Check baut alles neu auf

### PR-Workflow-Self-Test

- Dummy-PR mit absichtlichen Fehlern (falsche kcal, fehlendes Bild, ungültige `cuisineGroup`) → Action muss alle Fehler flaggen
- Zweiter Dummy-PR mit legalen Werten → Action grün
- Beide PRs schließen ohne Merge

## Release-Flow

1. Feature-Entwicklung auf `multiuser` (Phase A + Phase B in Sub-Tasks)
2. Merge `multiuser → beta`, APK bauen (`versionCode: 4`, `versionName: "1.3"`)
3. Beta-Test-Runde:
   - Dummy-Rezept-PR gegen main aufmachen (Test-Fehler-Fälle) → Action prüfen
   - Dummy-PR reparieren, mergen → Beta-App Auto-Check → Badge → Import → sichtbar
   - Rate-Limit, Fehler-Sheets, Neu-Marker durchspielen
4. Merge `beta → main`, Stable-APK bauen
5. Rollback-Plan falls Import ein Problem hat:
   - Action deaktivieren (Workflow disablen)
   - Import-Feature-Flag in `remote-config.js` auf `false`, Notfall-APK 1.3.1

APK-Bau nur nach expliziter Aufforderung (Memory-Guardrail).

## Offene Punkte für die Umsetzung

- **UI-Position für „Neu"-Marker** (Card-Badge, Filter-Chip, Detail-Sheet-Hinweis) — wird bei der Live-App-Iteration entschieden, nicht im Design fixiert.
- **Verhalten bei leerem Update-Check bzgl. `remoteNewIds`** — aktuell: Set bleibt unverändert. Falls du willst „leerer Check leert die Liste", ist das ein 5-Zeilen-Fix.
- **`indian, european, german` als `cuisineGroup`-Enum-Erweiterung** — nicht Teil dieses Designs (aktuell nur die 4 vorhandenen Werte). Bei erstem Rezept in einer dieser Küchen: Enum in `recipe-schema.md`, Validator und Picker-Filter synchron erweitern.

## Referenzen

- **Handoff:** [`docs/redesign/handoffs/session-20-to-21.md`](handoffs/session-20-to-21.md)
- **Backlog:** [`docs/redesign/backlog.md`](backlog.md) — „Rezepte aus GitHub-Repo aktualisieren" und „Community-Rezepte per GitHub Pull Request"
- **Verworfenes File-Picker-Template:** [`docs/redesign/recipe-import-template.md`](recipe-import-template.md)
- **CLAUDE.md-Guardrails:** insbesondere 2 (Storage-Key), 6 (Statusbar), 7 (build + sync), 8 (Zutaten-Wiederverwendung)
