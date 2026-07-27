# Rezept-Import End-to-End — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rezepte werden zur Laufzeit aus dem GitHub-Repo `main`-Branch geladen (ohne APK-Update) UND ein Community-PR-Workflow inklusive automatischer Validierung wird im Repo eingerichtet.

**Architecture:** Zwei aufeinander aufbauende Phasen. Phase A erweitert die App um Fetcher, Merger, State-Slots, Bild-Cache, Auto-Check, Badge, Settings-Section und Update-Sheet. Phase B ergänzt Repo-Dateien (`CONTRIBUTING.md`, PR-/Issue-Templates, Schema-/Bild-Doku, GitHub Action mit Validator-Script). Bundled-Daten haben immer Vorrang vor Remote — die APK bleibt die „Wahrheit".

**Tech Stack:** Vanilla JS (ES-Module), Vite 8, Capacitor 8 (`@capacitor/filesystem` fürs Bild-Caching wird neu hinzugefügt), Node 20 für die GitHub Action + Validator, `sharp` als isolierte Dev-Dep in `scripts/`.

**Design-Referenz:** [`docs/redesign/2026-07-27-rezept-import-design.md`](2026-07-27-rezept-import-design.md)

---

## Phase 0 — Grundlagen

### Task 0.1: schemaVersion in JSON-Datenbanken

**Files:**
- Modify: `src/data/dishes.json` (Top-Level ergänzen)
- Modify: `src/data/ingredients.json` (Top-Level ergänzen)

- [ ] **Step 1: `schemaVersion` in `src/data/dishes.json` ergänzen**

Bestehende Struktur:
```json
{
  "dishes": [ /* ... */ ]
}
```

Neue Struktur (Top-Level-Feld VOR `dishes`):
```json
{
  "schemaVersion": 1,
  "dishes": [ /* ... unverändert ... */ ]
}
```

- [ ] **Step 2: `schemaVersion` in `src/data/ingredients.json` ergänzen**

Bestehende Struktur:
```json
{
  "ingredients": { /* ... */ }
}
```

Neue Struktur:
```json
{
  "schemaVersion": 1,
  "ingredients": { /* ... unverändert ... */ }
}
```

- [ ] **Step 3: Verifizieren dass App noch baut und läuft**

Run:
```bash
npm run build
```
Expected: kein Fehler. `www/`-Output wird neu geschrieben.

- [ ] **Step 4: Commit**

```bash
git add src/data/dishes.json src/data/ingredients.json
git commit -m "$(cat <<'EOF'
feat(data): schemaVersion=1 in dishes.json und ingredients.json

Bereitet die Runtime-Merger-Logik vor: die App wird Remote-Daten
mit einer im Repo hinterlegten Schema-Version pruefen. schemaVersion
1 ist der aktuelle Stand. Neue Felder werden diese Version nicht
inkrementieren, nur strukturelle Aenderungen.
EOF
)"
```

---

### Task 0.2: `src/data/remote-config.js` mit Konfiguration

**Files:**
- Create: `src/data/remote-config.js`

- [ ] **Step 1: `src/data/remote-config.js` schreiben**

```js
// Konfiguration fuer den Remote-Rezept-Import.
// Alle Fetches gehen gegen den main-Branch des oeffentlichen Repos —
// keine Channel-Trennung fuer Content (siehe Design-Doc: Beta-APK und
// Stable-APK sehen denselben Rezept-Bestand).

const REPO_BASE = 'https://raw.githubusercontent.com/shogun160/mahlzeit-app/main';

export const dishesUrl = `${REPO_BASE}/src/data/dishes.json`;
export const ingredientsUrl = `${REPO_BASE}/src/data/ingredients.json`;
export const dishImageUrl = (id) => `${REPO_BASE}/public/dishes/dish-${id}.jpg`;

// Schema-Versionen: muessen mit den Werten in dishes.json / ingredients.json
// uebereinstimmen. Bei Remote-Version > lokal blockt die App den Import mit
// klarer Fehlermeldung (User muss App aktualisieren).
export const SCHEMA_VERSION_DISHES = 1;
export const SCHEMA_VERSION_INGREDIENTS = 1;

// Auto-Check laeuft beim App-Start hoechstens einmal alle 24h.
export const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Manueller Button hat einen 60s-Soft-Cache: innerhalb dieser Zeit
// wird kein neuer Fetch ausgeloest, sondern ein Toast angezeigt.
export const MANUAL_RATE_LIMIT_MS = 60 * 1000;

// Notfall-Kill-Switch: false schaltet Auto-Check UND manuellen Button aus.
// Ermoeglicht einen Feature-Rollback ohne groesseren Code-Umbau (nur
// Konstante flippen und neue APK bauen).
export const IMPORT_ENABLED = true;
```

- [ ] **Step 2: Commit**

```bash
git add src/data/remote-config.js
git commit -m "$(cat <<'EOF'
feat(data): remote-config als zentrale Import-Konfiguration

Fuehrt die Konstanten fuer den Remote-Rezept-Import ein:
- Fetch-URLs fuer dishes.json, ingredients.json und Bilder (immer main)
- Schema-Versionen (muessen zu den JSONs passen)
- Auto-Check-Intervall (24h) und manuelles Rate-Limit (60s)
- IMPORT_ENABLED-Feature-Flag als Kill-Switch
EOF
)"
```

---

## Phase A — App-Logik

### Task A.1: State-Slots und Persistenz-Migration

**Files:**
- Modify: `src/state.js` (State-Objekt + `saveState` + `loadState`)
- Create: `src/state.test.mjs`

- [ ] **Step 1: Failing Test schreiben — Set-Serialisierung für `remoteNewIds`**

Erstelle `src/state.test.mjs`:

```js
// Sanity-Simulation fuer state.js — nur die Remote-Slot-Persistenz.
// Aufruf: `node src/state.test.mjs`. Exit != 0 bei Fehler.
//
// Nutzt einen In-Memory-localStorage-Shim, damit Node-Ausfuehrung ohne
// Browser klappt.

// --- localStorage-Shim ---
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

// Import erst NACH dem Shim.
const { state, saveState, loadState } = await import('./state.js');

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  OK  ', name);
  else { failures++; console.error('  FAIL', name, detail ? `-> ${detail}` : ''); }
}

// -- Round-Trip fuer remoteNewIds (Set) --
state.assignment = { Montag: 1 };
state.remoteNewIds = new Set([5, 12, 33]);
state.remoteUpdatedAt = '2026-07-27T10:00:00.000Z';
saveState();

// State zuruecksetzen und neu laden.
state.remoteNewIds = new Set();
state.remoteUpdatedAt = null;
loadState();

check('remoteNewIds als Set nach loadState', state.remoteNewIds instanceof Set);
check('remoteNewIds hat 3 Eintraege', state.remoteNewIds.size === 3);
check('remoteNewIds enthaelt 5', state.remoteNewIds.has(5));
check('remoteNewIds enthaelt 33', state.remoteNewIds.has(33));
check('remoteUpdatedAt persistiert', state.remoteUpdatedAt === '2026-07-27T10:00:00.000Z');

// -- Fresh Install: remoteNewIds als leeres Set --
delete store['mahlzeit-state-v2'];
state.remoteNewIds = new Set([99]);   // vermuellen
loadState();
check('Fresh Install: remoteNewIds ist leeres Set', state.remoteNewIds instanceof Set && state.remoteNewIds.size === 0);

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log('\nAlle Checks OK.');
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

Run:
```bash
node src/state.test.mjs
```
Expected: FAIL — `state.remoteNewIds` ist noch nicht implementiert (undefined statt Set).

- [ ] **Step 3: State-Slots ins Default-State-Objekt einfügen**

In `src/state.js`, das exportierte `state`-Objekt bekommt neue Top-Level-Slots. Direkt nach den bestehenden `collapsedCategories: new Set()`-Zeile einfügen, VOR `settings: { ... }`:

```js
  // Remote-Rezept-Import (Session 21). Alle Slots werden in mahlzeit-state-v2
  // persistiert (Guardrail 2 bleibt intakt — nur zusaetzliche Felder, kein
  // Storage-Key-Wechsel). Sets werden wie collapsedCategories als Array
  // serialisiert.
  remoteDishes: [],                // Dish[] wie in dishes.json (ohne enrichment — beim Load wird angereichert)
  remoteIngredients: {},           // { key -> Ingredient } wie in ingredients.json
  remoteUpdatedAt: null,           // ISO-String vom letzten erfolgreichen Fetch
  remoteHasUpdates: false,         // vom Auto-Check gesetzt, nach Oeffnen des Settings-Sheets gecleart
  remoteLastFetchAt: null,         // ISO-String fuer 60s-Soft-Rate-Limit
  remoteNewIds: new Set(),         // IDs die aktuell als "Neu" gelten
  remoteImageFailures: new Set(),  // IDs deren Bild-Download failed hat (TTL 24h — beim Start gecleart)
```

- [ ] **Step 4: `saveState()` erweitern**

In `src/state.js`, innerhalb des `snapshot`-Objekts (nach `collapsedCategories: Array.from(state.collapsedCategories)`), ergänzen:

```js
      remoteDishes: state.remoteDishes,
      remoteIngredients: state.remoteIngredients,
      remoteUpdatedAt: state.remoteUpdatedAt,
      remoteHasUpdates: state.remoteHasUpdates,
      remoteLastFetchAt: state.remoteLastFetchAt,
      remoteNewIds: Array.from(state.remoteNewIds),
      // remoteImageFailures wird bewusst NICHT persistiert (TTL 24h,
      // beim naechsten Start ohnehin cleared).
```

- [ ] **Step 5: `loadState()` erweitern**

In `src/state.js`, nach der Zeile `state.collapsedCategories = new Set(...)`, ergänzen:

```js
    state.remoteDishes = Array.isArray(parsed.remoteDishes) ? parsed.remoteDishes : [];
    state.remoteIngredients = (parsed.remoteIngredients && typeof parsed.remoteIngredients === 'object') ? parsed.remoteIngredients : {};
    state.remoteUpdatedAt = typeof parsed.remoteUpdatedAt === 'string' ? parsed.remoteUpdatedAt : null;
    state.remoteHasUpdates = parsed.remoteHasUpdates === true;
    state.remoteLastFetchAt = typeof parsed.remoteLastFetchAt === 'string' ? parsed.remoteLastFetchAt : null;
    state.remoteNewIds = new Set(Array.isArray(parsed.remoteNewIds) ? parsed.remoteNewIds : []);
    state.remoteImageFailures = new Set();  // TTL 24h: beim Start immer frisch
```

- [ ] **Step 6: Test erneut ausführen**

Run:
```bash
node src/state.test.mjs
```
Expected: alle Checks `OK`.

- [ ] **Step 7: Commit**

```bash
git add src/state.js src/state.test.mjs
git commit -m "$(cat <<'EOF'
feat(state): remote-import slots + persistenz

Fuegt die State-Slots fuer den Remote-Rezept-Import hinzu:
remoteDishes, remoteIngredients, remoteUpdatedAt, remoteHasUpdates,
remoteLastFetchAt, remoteNewIds (Set), remoteImageFailures (transient).

Alle bleiben in mahlzeit-state-v2 persistiert (Guardrail 2 intakt).
Sets werden als Array serialisiert wie collapsedCategories.
remoteImageFailures ist bewusst nicht persistiert (24h-TTL beim
Neustart).

Node-Test src/state.test.mjs deckt Round-Trip + Fresh-Install ab.
EOF
)"
```

---

### Task A.2: Merger + Cleanup + Missing-Ingredient-Filter

**Files:**
- Modify: `src/data/dishes.js` (Merger + Cleanup-Pass + isNewDish-Export)
- Create: `src/data/dishes.test.mjs`

- [ ] **Step 1: Failing Tests schreiben**

Erstelle `src/data/dishes.test.mjs`:

```js
// Sanity-Simulation fuer den Remote-Merger + Cleanup + Missing-Ingredient-Filter.
// Testet die reine Logik ueber die exportierte Funktion mergeRemote(),
// nicht die Modul-Load-Reihenfolge selbst.
// Aufruf: `node src/data/dishes.test.mjs`.

import { mergeRemote } from './dishes.js';

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  OK  ', name);
  else { failures++; console.error('  FAIL', name, detail ? `-> ${detail}` : ''); }
}

// Testfixtures.
const bundled = [
  { id: 1, name: 'Bundle-1', ingredients: [{ key: 'karotte', grams: 100 }] },
  { id: 2, name: 'Bundle-2', ingredients: [{ key: 'reis_basmati', grams: 80 }] },
];
const bundledIngredients = {
  karotte:      { label: 'Karotte',       cat: 'frisch', unit: 'g', per100g: { kcal: 41, p: 0.9, kh: 9.6, f: 0.2 } },
  reis_basmati: { label: 'Basmati-Reis',  cat: 'trocken', unit: 'g', per100g: { kcal: 350, p: 7.0, kh: 78,  f: 0.9 } },
};

// -- Fall 1: Remote hat neues Rezept, das nicht in Bundled ist --
{
  const remote = [
    { id: 99, name: 'Remote-99', ingredients: [{ key: 'karotte', grams: 50 }] },
  ];
  const result = mergeRemote({
    bundled, bundledIngredients,
    remoteDishes: remote,
    remoteIngredients: {},
  });
  check('Fall 1: dishes hat 3 Eintraege', result.dishes.length === 3);
  check('Fall 1: Remote-99 im Ergebnis', result.dishes.some((d) => d.id === 99));
  check('Fall 1: keine Warnungen', result.warnings.length === 0);
  check('Fall 1: keine ID zum Cleanup', result.staleRemoteIds.length === 0);
}

// -- Fall 2: Remote-Rezept mit ID die inzwischen bundled ist --
{
  const remote = [
    { id: 2, name: 'REMOTE-Doublet', ingredients: [{ key: 'karotte', grams: 50 }] },
    { id: 99, name: 'Remote-99', ingredients: [{ key: 'karotte', grams: 50 }] },
  ];
  const result = mergeRemote({
    bundled, bundledIngredients,
    remoteDishes: remote,
    remoteIngredients: {},
  });
  check('Fall 2: Bundle-2 (nicht REMOTE-Doublet) im Ergebnis', result.dishes.find((d) => d.id === 2)?.name === 'Bundle-2');
  check('Fall 2: Remote-99 trotzdem drin', result.dishes.some((d) => d.id === 99));
  check('Fall 2: staleRemoteIds enthaelt 2', result.staleRemoteIds.includes(2));
  check('Fall 2: staleRemoteIds enthaelt NICHT 99', !result.staleRemoteIds.includes(99));
}

// -- Fall 3: Remote-Rezept referenziert unbekannten Ingredient-Key --
{
  const remote = [
    { id: 99, name: 'Kaputt', ingredients: [{ key: 'butter_ghee', grams: 20 }] },
    { id: 100, name: 'Sauber', ingredients: [{ key: 'karotte', grams: 50 }] },
  ];
  const result = mergeRemote({
    bundled, bundledIngredients,
    remoteDishes: remote,
    remoteIngredients: {},
  });
  check('Fall 3: Sauber (id=100) im Ergebnis', result.dishes.some((d) => d.id === 100));
  check('Fall 3: Kaputt (id=99) NICHT im Ergebnis', !result.dishes.some((d) => d.id === 99));
  check('Fall 3: Warnung fuer id=99 vorhanden', result.warnings.some((w) => w.id === 99 && w.missingKey === 'butter_ghee'));
}

// -- Fall 4: Remote-Ingredient wird respektiert (fuer neuen Ingredient-Key) --
{
  const remote = [
    { id: 99, name: 'Neu', ingredients: [{ key: 'butter_ghee', grams: 20 }] },
  ];
  const remoteIngredients = {
    butter_ghee: { label: 'Butterschmalz', cat: 'kuehlung', unit: 'g', per100g: { kcal: 900, p: 0, kh: 0, f: 100 } },
  };
  const result = mergeRemote({
    bundled, bundledIngredients,
    remoteDishes: remote,
    remoteIngredients,
  });
  check('Fall 4: Neu (id=99) im Ergebnis', result.dishes.some((d) => d.id === 99));
  check('Fall 4: butter_ghee Ingredient im gemergten Ingredients', result.ingredients.butter_ghee?.label === 'Butterschmalz');
  check('Fall 4: bundled karotte hat Vorrang (nicht ueberschrieben)', result.ingredients.karotte?.label === 'Karotte');
}

// -- Fall 5: Bundled Ingredient hat Vorrang, Remote-Doppelung wird ignoriert --
{
  const remote = [];
  const remoteIngredients = {
    karotte: { label: 'FAKE-KAROTTE', cat: 'x', unit: 'g', per100g: { kcal: 999, p: 0, kh: 0, f: 0 } },
  };
  const result = mergeRemote({
    bundled, bundledIngredients,
    remoteDishes: remote,
    remoteIngredients,
  });
  check('Fall 5: karotte-Label ist bundled-Wert', result.ingredients.karotte.label === 'Karotte');
}

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log('\nAlle Checks OK.');
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

Run:
```bash
node src/data/dishes.test.mjs
```
Expected: FAIL — `mergeRemote` ist nicht exportiert.

- [ ] **Step 3: `mergeRemote` in `src/data/dishes.js` implementieren**

Am Ende von `src/data/dishes.js` (nach den bestehenden Exports) ergänzen:

```js
// Merger fuer den Remote-Rezept-Import (Session 21).
//
// Regeln:
// 1. Bundled hat immer Vorrang. Remote-Dishes mit einer ID die bereits
//    bundled ist werden verworfen und ihre ID zurueckgegeben (staleRemoteIds),
//    damit der Caller State + Bild-Cache aufraeumen kann.
// 2. Analog fuer Ingredients: bundled Key bleibt, Remote-Kopie wird ignoriert.
//    Guardrail 8 (keine Duplikat-Zutaten) greift damit automatisch.
// 3. Remote-Dishes werden geskipped wenn sie auf einen Ingredient-Key
//    verweisen, der weder bundled noch remote ist. Warnung wird gesammelt.
//
// Rueckgabe:
//   { dishes: Dish[]           merged, ohne die geskippten
//   , ingredients: { key: Ing } merged, bundled hat Vorrang
//   , staleRemoteIds: number[] Remote-IDs die aus State/Cache raus muessen
//   , warnings: { id: number, name: string, missingKey: string }[]
//   }
//
// Verwendet KEINE globale State-Referenz — pure Funktion fuer Testbarkeit.
export function mergeRemote({ bundled, bundledIngredients, remoteDishes, remoteIngredients }) {
  const bundledIds = new Set(bundled.map((d) => d.id));
  const staleRemoteIds = [];
  const warnings = [];

  // Ingredients-Merger: bundled zuerst, dann Remote-Keys die nicht bundled sind.
  const ingredients = { ...bundledIngredients };
  for (const [key, ing] of Object.entries(remoteIngredients || {})) {
    if (!(key in ingredients)) ingredients[key] = ing;
  }

  // Dishes-Merger:
  const dishes = [...bundled];
  for (const d of remoteDishes || []) {
    if (bundledIds.has(d.id)) {
      staleRemoteIds.push(d.id);
      continue;
    }
    // Missing-Ingredient-Filter.
    const missing = (d.ingredients || []).find((ing) => !(ing.key in ingredients));
    if (missing) {
      warnings.push({ id: d.id, name: d.name, missingKey: missing.key });
      continue;
    }
    dishes.push(d);
  }

  return { dishes, ingredients, staleRemoteIds, warnings };
}

// isNewDish liefert true wenn die ID im aktuellen "Neu"-Batch ist.
// Consumer (Card, Picker-Filter) nutzen das. State-Zugriff erlaubt hier,
// weil das eine reine Getter-Konvention ist.
import { state } from '../state.js';
export function isNewDish(id) {
  return state.remoteNewIds instanceof Set && state.remoteNewIds.has(id);
}
```

- [ ] **Step 4: Test erneut ausführen**

Run:
```bash
node src/data/dishes.test.mjs
```
Expected: alle Checks `OK`.

- [ ] **Step 5: Commit**

```bash
git add src/data/dishes.js src/data/dishes.test.mjs
git commit -m "$(cat <<'EOF'
feat(data): mergeRemote + isNewDish fuer remote-import

mergeRemote() ist die reine Merger-Logik: Bundled hat Vorrang,
Remote-IDs die inzwischen bundled sind landen in staleRemoteIds
(Cleanup-Signal), Missing-Ingredient-Faelle werden geskipped und
als Warnung zurueckgegeben.

isNewDish(id) prueft state.remoteNewIds — wird von Card und
Picker-Filter genutzt (UI-Rendering folgt in spaeteren Tasks).

Node-Test src/data/dishes.test.mjs deckt: neue Remote-Rezepte,
Bundled-Vorrang mit staleRemoteIds, Missing-Ingredient-Skip,
Remote-Ingredients hinzufuegen, Bundled-Ingredient-Vorrang.
EOF
)"
```

---

### Task A.3: Remote-Fetcher + Schema-Version-Check

**Files:**
- Create: `src/data/remote-updates.js`
- Create: `src/data/remote-updates.test.mjs`

- [ ] **Step 1: Failing Test schreiben**

Erstelle `src/data/remote-updates.test.mjs`:

```js
// Sanity-Simulation fuer checkSchemaVersion. Der eigentliche Fetch wird
// separat in Browser/APK getestet — hier nur reine Logik.
// Aufruf: `node src/data/remote-updates.test.mjs`.

import { checkSchemaVersion, SCHEMA_ERROR } from './remote-updates.js';

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  OK  ', name);
  else { failures++; console.error('  FAIL', name, detail ? `-> ${detail}` : ''); }
}

// -- Match --
check(
  'match: version == expected → null (kein Fehler)',
  checkSchemaVersion({ schemaVersion: 1 }, 1) === null,
);

// -- Zu neu --
check(
  'zu neu: remote > local → SCHEMA_TOO_NEW',
  checkSchemaVersion({ schemaVersion: 2 }, 1) === SCHEMA_ERROR.TOO_NEW,
);

// -- Zu alt --
check(
  'zu alt: remote < local → SCHEMA_TOO_OLD',
  checkSchemaVersion({ schemaVersion: 0 }, 1) === SCHEMA_ERROR.TOO_OLD,
);

// -- Fehlend --
check(
  'fehlend: kein schemaVersion → SCHEMA_MISSING',
  checkSchemaVersion({}, 1) === SCHEMA_ERROR.MISSING,
);
check(
  'null: schemaVersion null → SCHEMA_MISSING',
  checkSchemaVersion({ schemaVersion: null }, 1) === SCHEMA_ERROR.MISSING,
);

// -- Nicht-Zahl --
check(
  'string: schemaVersion "1" → SCHEMA_MISSING (nicht number)',
  checkSchemaVersion({ schemaVersion: '1' }, 1) === SCHEMA_ERROR.MISSING,
);

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log('\nAlle Checks OK.');
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

Run:
```bash
node src/data/remote-updates.test.mjs
```
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: `src/data/remote-updates.js` schreiben (nur Schema-Check-Teil)**

```js
// Remote-Rezept-Import: Fetcher, Schema-Version-Check, Diff, Orchestrierung.
// Wird von main.js (Auto-Check beim Start) und von der Settings-Rezepte-Section
// (manueller Button) aufgerufen.
//
// Design-Doc: docs/redesign/2026-07-27-rezept-import-design.md

import {
  dishesUrl, ingredientsUrl, dishImageUrl,
  SCHEMA_VERSION_DISHES, SCHEMA_VERSION_INGREDIENTS,
  AUTO_CHECK_INTERVAL_MS, MANUAL_RATE_LIMIT_MS,
  IMPORT_ENABLED,
} from './remote-config.js';

export const SCHEMA_ERROR = Object.freeze({
  TOO_NEW: 'SCHEMA_TOO_NEW',
  TOO_OLD: 'SCHEMA_TOO_OLD',
  MISSING: 'SCHEMA_MISSING',
});

// Prueft schemaVersion-Feld im remote-JSON gegen die lokal erwartete Version.
// Rueckgabe: null bei Match, sonst ein SCHEMA_ERROR-Code.
export function checkSchemaVersion(remoteJson, expectedVersion) {
  const v = remoteJson?.schemaVersion;
  if (typeof v !== 'number') return SCHEMA_ERROR.MISSING;
  if (v > expectedVersion) return SCHEMA_ERROR.TOO_NEW;
  if (v < expectedVersion) return SCHEMA_ERROR.TOO_OLD;
  return null;
}

// Wird in spaeteren Tasks um fetchRemoteJsons + performImport erweitert.
```

- [ ] **Step 4: Test erneut ausführen**

Run:
```bash
node src/data/remote-updates.test.mjs
```
Expected: alle Checks `OK`.

- [ ] **Step 5: Commit**

```bash
git add src/data/remote-updates.js src/data/remote-updates.test.mjs
git commit -m "$(cat <<'EOF'
feat(data): remote-updates modul mit schema-check

Neues Modul src/data/remote-updates.js. Zunaechst nur die reine
Logik-Funktion checkSchemaVersion() und die SCHEMA_ERROR-Enum-
Konstanten. Fetcher + Import-Orchestrierung folgen in den naechsten
Tasks.

Node-Test deckt alle 4 Faelle ab: Match, Remote zu neu, Remote zu
alt, Feld fehlt/nicht-Zahl.
EOF
)"
```

---

### Task A.4: Fetcher-Funktion

**Files:**
- Modify: `src/data/remote-updates.js`

- [ ] **Step 1: `fetchRemoteJsons()` in `remote-updates.js` ergänzen**

Am Ende der Datei anfügen:

```js
// Fetcher fuer beide JSON-Dateien parallel. Nutzt native fetch() (in Node 20+
// verfuegbar, in Browsern eh Standard, in Capacitor-WebViews ebenfalls).
//
// Rueckgabe im Erfolgsfall:
//   { ok: true, dishes: <parsedJson>, ingredients: <parsedJson> }
// Im Fehlerfall:
//   { ok: false, error: 'NETWORK' | 'PARSE' | 'SCHEMA_TOO_NEW' | 'SCHEMA_TOO_OLD' | 'SCHEMA_MISSING' }
//
// Der Aufrufer entscheidet, wie das UX auf die Fehler reagiert.
export async function fetchRemoteJsons() {
  let dishesJson;
  let ingredientsJson;

  try {
    const [dishesRes, ingredientsRes] = await Promise.all([
      fetch(dishesUrl, { cache: 'no-store' }),
      fetch(ingredientsUrl, { cache: 'no-store' }),
    ]);
    if (!dishesRes.ok || !ingredientsRes.ok) return { ok: false, error: 'NETWORK' };
    dishesJson = await dishesRes.json();
    ingredientsJson = await ingredientsRes.json();
  } catch (_) {
    return { ok: false, error: 'NETWORK' };
  }

  // Schema-Checks.
  const dishesErr = checkSchemaVersion(dishesJson, SCHEMA_VERSION_DISHES);
  const ingredientsErr = checkSchemaVersion(ingredientsJson, SCHEMA_VERSION_INGREDIENTS);
  const err = dishesErr || ingredientsErr;
  if (err) return { ok: false, error: err };

  return { ok: true, dishes: dishesJson, ingredients: ingredientsJson };
}
```

- [ ] **Step 2: Manueller Sanity-Check im Browser (nach npm run dev, Task A.10)**

Skip in dieser Task. Wird in Task A.10 im Browser getestet.

- [ ] **Step 3: Commit**

```bash
git add src/data/remote-updates.js
git commit -m "$(cat <<'EOF'
feat(data): fetchRemoteJsons parallelisiert beide JSONs

Fetcher zieht dishes.json und ingredients.json parallel per fetch()
(kein Cache — wir wollen aktuellen Repo-Stand). Rueckgabe-Objekt
unterscheidet ok=true/false; Fehler-Codes NETWORK/PARSE/SCHEMA_*
lassen den Aufrufer entscheiden wie das UX reagiert.

Kein Node-Test — Fetch ist Netz-abhaengig, wird in Browser/APK
manuell getestet.
EOF
)"
```

---

### Task A.5: Diff-Funktion (welche IDs sind neu?)

**Files:**
- Modify: `src/data/remote-updates.js`
- Modify: `src/data/remote-updates.test.mjs`

- [ ] **Step 1: Failing Test ergänzen**

Am Ende von `src/data/remote-updates.test.mjs` (VOR dem `if (failures > 0)`-Block) einfügen:

```js
// -- diffRemoteAgainstLocal --
import { diffRemoteAgainstLocal } from './remote-updates.js';

const bundled = [{ id: 1 }, { id: 2 }, { id: 3 }];

// Fall: Remote hat alles was bundled ist plus zwei neue.
{
  const remote = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 42 }, { id: 43 }];
  const already = [];
  const diff = diffRemoteAgainstLocal({ bundled, alreadyImported: already, remote });
  check('diff: 2 neue IDs', diff.newIds.length === 2);
  check('diff: 42 dabei', diff.newIds.includes(42));
  check('diff: 43 dabei', diff.newIds.includes(43));
}

// Fall: eine der "neuen" IDs ist schon importiert.
{
  const remote = [{ id: 42 }, { id: 43 }];
  const already = [{ id: 42 }];
  const diff = diffRemoteAgainstLocal({ bundled, alreadyImported: already, remote });
  check('diff: nur 43 als neu', diff.newIds.length === 1 && diff.newIds[0] === 43);
}

// Fall: alles ist entweder bundled oder schon importiert.
{
  const remote = [{ id: 1 }, { id: 42 }];
  const already = [{ id: 42 }];
  const diff = diffRemoteAgainstLocal({ bundled, alreadyImported: already, remote });
  check('diff: nichts neues', diff.newIds.length === 0);
}
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

Run:
```bash
node src/data/remote-updates.test.mjs
```
Expected: FAIL — `diffRemoteAgainstLocal` nicht exportiert.

- [ ] **Step 3: `diffRemoteAgainstLocal` in `remote-updates.js` ergänzen**

Am Ende der Datei anfügen:

```js
// Ermittelt welche Remote-Dishes wirklich neu sind — also weder bundled noch
// bereits in state.remoteDishes vorhanden.
export function diffRemoteAgainstLocal({ bundled, alreadyImported, remote }) {
  const known = new Set([
    ...bundled.map((d) => d.id),
    ...alreadyImported.map((d) => d.id),
  ]);
  const newIds = remote.filter((d) => !known.has(d.id)).map((d) => d.id);
  return { newIds };
}
```

- [ ] **Step 4: Test erneut ausführen**

Run:
```bash
node src/data/remote-updates.test.mjs
```
Expected: alle Checks `OK`.

- [ ] **Step 5: Commit**

```bash
git add src/data/remote-updates.js src/data/remote-updates.test.mjs
git commit -m "$(cat <<'EOF'
feat(data): diffRemoteAgainstLocal ermittelt neue rezepte

Pure Funktion: gegeben bundled + bereits importierte + remote,
liefert sie die IDs die wirklich neu sind. Genutzt vom Auto-Check
(entscheidet ob Badge gezeigt wird) und vom Update-Sheet (Liste
der neu zu importierenden Rezepte).

Node-Test deckt: neue IDs, teilweise schon importiert, nichts neues.
EOF
)"
```

---

### Task A.6: Bild-Cache-Wrapper

**Files:**
- Create: `src/util/image-cache.js`

- [ ] **Step 1: `@capacitor/filesystem` als Dependency ergänzen**

Run:
```bash
npm install @capacitor/filesystem@^8
```
Expected: `package.json` bekommt einen neuen Dep-Eintrag.

- [ ] **Step 2: `src/util/image-cache.js` schreiben**

```js
// Bild-Cache fuer Remote-Rezepte.
// - In Capacitor (Android): schreibt/liest Dateien in Directory.Data/remote-dishes/
// - In Browser (npm run dev): nutzt IndexedDB mit Blob-URLs als Fallback.
//
// API:
//   await imageCache.has(id) -> boolean
//   await imageCache.get(id) -> string | null (Datei-URI oder Blob-URL, direkt in <img src> nutzbar)
//   await imageCache.put(id, blob) -> void
//   await imageCache.remove(id) -> void
//
// Wichtig: IndexedDB-Fallback ist nur fuer Dev-Testing gedacht.
// In der APK laeuft immer der Capacitor-Zweig.

import { Capacitor } from '@capacitor/core';

const DIR = 'remote-dishes';   // relativ zu Directory.Data
const IDB_NAME = 'mahlzeit-remote-images';
const IDB_STORE = 'images';

// --- Capacitor-Impl -----------------------------------------------------

async function capacitorImpl() {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');

  return {
    async has(id) {
      try {
        await Filesystem.stat({ path: `${DIR}/dish-${id}.jpg`, directory: Directory.Data });
        return true;
      } catch (_) {
        return false;
      }
    },
    async get(id) {
      try {
        const res = await Filesystem.getUri({ path: `${DIR}/dish-${id}.jpg`, directory: Directory.Data });
        // Capacitor liefert file:// - webview-tauglich via Capacitor.convertFileSrc.
        return Capacitor.convertFileSrc(res.uri);
      } catch (_) {
        return null;
      }
    },
    async put(id, blob) {
      const base64 = await blobToBase64(blob);
      await Filesystem.writeFile({
        path: `${DIR}/dish-${id}.jpg`,
        data: base64,
        directory: Directory.Data,
        recursive: true,
      });
    },
    async remove(id) {
      try {
        await Filesystem.deleteFile({ path: `${DIR}/dish-${id}.jpg`, directory: Directory.Data });
      } catch (_) { /* schon weg → ignorieren */ }
    },
  };
}

// --- IndexedDB-Impl (Dev-Fallback) --------------------------------------

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key, value) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// In-Memory-URL-Registry: URL.createObjectURL erzeugt neue String-Referenzen,
// die wir wiederverwenden statt jedes Mal neu erstellen.
const blobUrls = new Map();

function indexedDbImpl() {
  return {
    async has(id) {
      return !!(await idbGet(`dish-${id}`));
    },
    async get(id) {
      if (blobUrls.has(id)) return blobUrls.get(id);
      const blob = await idbGet(`dish-${id}`);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      blobUrls.set(id, url);
      return url;
    },
    async put(id, blob) {
      await idbPut(`dish-${id}`, blob);
      if (blobUrls.has(id)) {
        URL.revokeObjectURL(blobUrls.get(id));
        blobUrls.delete(id);
      }
    },
    async remove(id) {
      await idbDelete(`dish-${id}`);
      if (blobUrls.has(id)) {
        URL.revokeObjectURL(blobUrls.get(id));
        blobUrls.delete(id);
      }
    },
  };
}

// --- Helper -------------------------------------------------------------

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result);
      // "data:image/jpeg;base64,XYZ..." -> nur der XYZ-Teil
      const commaIdx = dataUrl.indexOf(',');
      resolve(dataUrl.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// --- Public API ---------------------------------------------------------

let impl = null;

async function getImpl() {
  if (impl) return impl;
  impl = Capacitor.isNativePlatform() ? await capacitorImpl() : indexedDbImpl();
  return impl;
}

export const imageCache = {
  async has(id) { return (await getImpl()).has(id); },
  async get(id) { return (await getImpl()).get(id); },
  async put(id, blob) { return (await getImpl()).put(id, blob); },
  async remove(id) { return (await getImpl()).remove(id); },
};
```

- [ ] **Step 3: Build verifizieren**

Run:
```bash
npm run build
```
Expected: kein Fehler, `www/`-Output aktualisiert.

- [ ] **Step 4: Cap sync**

Run:
```bash
npx cap sync
```
Expected: `@capacitor/filesystem` wird ins Android-Projekt aufgenommen (Zeile im Output).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/util/image-cache.js
git commit -m "$(cat <<'EOF'
feat(util): image-cache wrapper capacitor + indexeddb

Neuer Wrapper fuer Remote-Bild-Persistenz. In Capacitor (Android)
liegen Dateien unter Directory.Data/remote-dishes/dish-<id>.jpg —
via Capacitor.convertFileSrc als <img>-src nutzbar. Im Browser
(npm run dev) faellt der Wrapper auf IndexedDB mit Blob-URLs
zurueck, damit Dev-Testing ohne Filesystem klappt.

@capacitor/filesystem v8 wird als neue Dependency ergaenzt.
EOF
)"
```

---

### Task A.7: Import-Orchestration (JSONs übernehmen + Bilder herunterladen)

**Files:**
- Modify: `src/data/remote-updates.js`

- [ ] **Step 1: `performImport` in `remote-updates.js` implementieren**

Am Ende der Datei anfügen:

```js
import { state, saveState } from '../state.js';
import { imageCache } from '../util/image-cache.js';
import { mergeRemote } from './dishes.js';
import dishesData from './dishes.json';
import ingredientsData from './ingredients.json';

const bundledDishes = dishesData.dishes;
const bundledIngredients = ingredientsData.ingredients;

// Orchestriert einen kompletten Import-Vorgang:
// 1. Fetch JSONs (mit Schema-Check)
// 2. Diff gegen bundled + bereits importierte → newIds
// 3. Wenn keine neuen IDs: return { ok: true, imported: [], warnings: [] }
// 4. Sonst: neue Rezepte + ihre neuen Ingredients ins State schreiben (via Merger)
// 5. Bilder sequentiell nachladen (Progress-Callback ruft Consumer alle Sekunden mit
//    { current, total }-Objekt)
// 6. State speichern, remoteNewIds ersetzen
//
// Signatur:
//   performImport({ onProgress? }) → Promise<{ ok, imported, warnings, error? }>
//
// onProgress erhaelt { phase: 'metadata' | 'images', current, total, currentName? }
export async function performImport({ onProgress } = {}) {
  if (!IMPORT_ENABLED) return { ok: false, error: 'DISABLED' };

  onProgress?.({ phase: 'metadata', current: 0, total: 1 });

  const fetched = await fetchRemoteJsons();
  if (!fetched.ok) return { ok: false, error: fetched.error };

  state.remoteLastFetchAt = new Date().toISOString();

  // Diff: welche IDs sind wirklich neu?
  const alreadyImported = state.remoteDishes;
  const { newIds } = diffRemoteAgainstLocal({
    bundled: bundledDishes,
    alreadyImported,
    remote: fetched.dishes.dishes,
  });

  if (newIds.length === 0) {
    state.remoteUpdatedAt = state.remoteLastFetchAt;
    state.remoteHasUpdates = false;
    saveState();
    return { ok: true, imported: [], warnings: [] };
  }

  // Neue Dishes rausziehen aus dem Remote-JSON.
  const newDishes = fetched.dishes.dishes.filter((d) => newIds.includes(d.id));

  // Neue Ingredients auch mitnehmen (alle die noch nicht bekannt sind).
  const knownKeys = new Set([
    ...Object.keys(bundledIngredients),
    ...Object.keys(state.remoteIngredients),
  ]);
  const newIngredients = {};
  for (const [key, ing] of Object.entries(fetched.ingredients.ingredients)) {
    if (!knownKeys.has(key)) newIngredients[key] = ing;
  }

  // Merger laufen lassen (Cleanup + Missing-Ingredient-Filter).
  const merged = mergeRemote({
    bundled: bundledDishes,
    bundledIngredients,
    remoteDishes: [...state.remoteDishes, ...newDishes],
    remoteIngredients: { ...state.remoteIngredients, ...newIngredients },
  });

  // Cleanup fuer stale-IDs aus dem Bild-Cache.
  for (const staleId of merged.staleRemoteIds) {
    imageCache.remove(staleId).catch(() => { /* fire-and-forget */ });
  }

  // Alle Dishes die den Missing-Ingredient-Filter ueberlebt haben.
  const survived = merged.dishes
    .filter((d) => newIds.includes(d.id))
    .map((d) => d.id);

  // State schreiben (aber nur die Remote-Anteile — die bundled bleiben in dishesData).
  state.remoteDishes = merged.dishes.filter((d) => !bundledDishes.some((b) => b.id === d.id));
  state.remoteIngredients = {};
  for (const [key, ing] of Object.entries(merged.ingredients)) {
    if (!(key in bundledIngredients)) state.remoteIngredients[key] = ing;
  }
  state.remoteNewIds = new Set(survived);

  // Bilder sequentiell downloaden.
  onProgress?.({ phase: 'images', current: 0, total: survived.length });
  let done = 0;
  for (const id of survived) {
    const dish = newDishes.find((d) => d.id === id);
    try {
      const res = await fetch(dishImageUrl(id));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      await imageCache.put(id, blob);
    } catch (_) {
      // Erst Retry nach 2s, dann Failure notieren.
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res2 = await fetch(dishImageUrl(id));
        if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
        const blob = await res2.blob();
        await imageCache.put(id, blob);
      } catch (_) {
        state.remoteImageFailures.add(id);
      }
    }
    done++;
    onProgress?.({ phase: 'images', current: done, total: survived.length, currentName: dish?.name });
  }

  state.remoteUpdatedAt = state.remoteLastFetchAt;
  state.remoteHasUpdates = false;
  saveState();

  return {
    ok: true,
    imported: survived,
    warnings: merged.warnings,
  };
}
```

- [ ] **Step 2: Silent Auto-Check-Funktion ergänzen**

Am Ende der Datei anfügen:

```js
// Silent Check ohne Import: fetched nur die JSONs und ermittelt newIds.
// Setzt state.remoteHasUpdates entsprechend. Kein Bild-Download, kein
// Sheet, kein Toast — laueft im Hintergrund beim App-Start.
//
// Bedingungen: IMPORT_ENABLED true, und (remoteUpdatedAt fehlt oder aelter
// als AUTO_CHECK_INTERVAL_MS).
export async function performAutoCheck() {
  if (!IMPORT_ENABLED) return;

  const now = Date.now();
  if (state.remoteUpdatedAt) {
    const last = new Date(state.remoteUpdatedAt).getTime();
    if (!isNaN(last) && (now - last) < AUTO_CHECK_INTERVAL_MS) return;
  }

  const fetched = await fetchRemoteJsons();
  state.remoteLastFetchAt = new Date().toISOString();
  if (!fetched.ok) {
    // Silent — auch bei Schema-Mismatch: kein Badge, weil User nichts tun kann.
    state.remoteHasUpdates = false;
    saveState();
    return;
  }

  const { newIds } = diffRemoteAgainstLocal({
    bundled: bundledDishes,
    alreadyImported: state.remoteDishes,
    remote: fetched.dishes.dishes,
  });

  state.remoteHasUpdates = newIds.length > 0;
  state.remoteUpdatedAt = state.remoteLastFetchAt;
  saveState();
}

// Prueft ob der 60s-Soft-Rate-Limit greift. true = Fetch erlaubt.
export function canManualFetch() {
  if (!state.remoteLastFetchAt) return true;
  const last = new Date(state.remoteLastFetchAt).getTime();
  if (isNaN(last)) return true;
  return (Date.now() - last) >= MANUAL_RATE_LIMIT_MS;
}
```

- [ ] **Step 3: Build verifizieren**

Run:
```bash
npm run build
```
Expected: kein Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/data/remote-updates.js
git commit -m "$(cat <<'EOF'
feat(data): performImport + performAutoCheck orchestrieren remote-import

performImport() ist der komplette Import-Fluss: fetch → schema-check →
diff → merger (mit Missing-Ingredient-Filter + Cleanup) → State
schreiben → Bilder sequentiell downloaden (1x Retry bei Fehler) →
saveState. onProgress-Callback fuer Update-Sheet-Progress.

performAutoCheck() ist der Silent-Check beim App-Start: fetched nur
die JSONs, setzt remoteHasUpdates. Respektiert AUTO_CHECK_INTERVAL_MS.

canManualFetch() prueft den 60s-Soft-Rate-Limit fuer den manuellen
Button.
EOF
)"
```

---

### Task A.8: Auto-Check-Trigger in main.js

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Auto-Check-Aufruf nach `refresh()` in `main.js` einbauen**

In `src/main.js`, nach der Zeile `refresh();` (die einmal am Ende steht, vor dem Onboarding-Check) einfügen:

```js
// Remote-Rezept-Auto-Check: laueft asynchron im Hintergrund, blockiert
// den ersten Render nicht. Wenn neue Rezepte gefunden werden, setzt der
// Check state.remoteHasUpdates=true und triggert einen refresh() damit
// der Badge am Burger-Icon erscheint.
import('./data/remote-updates.js').then(({ performAutoCheck }) => {
  performAutoCheck().then(() => {
    if (state.remoteHasUpdates) refresh();
  }).catch(() => { /* silent */ });
});
```

- [ ] **Step 2: Alten Auto-Check-Cleanup für `remoteImageFailures` im Startup ergänzen**

Direkt nach `loadState();` (Zeile 42) einfügen:

```js
// remoteImageFailures hat 24h-TTL: beim Start wird die Menge immer geleert,
// damit fehlgeschlagene Bild-Downloads am naechsten Tag automatisch neu
// versucht werden. loadState() setzt das Feld schon auf ein leeres Set,
// dieser Kommentar dokumentiert die bewusste Semantik.
```

(Nur ein Kommentar — die tatsächliche Cleanup-Logik ist bereits in `loadState()`.)

- [ ] **Step 3: Manueller Sanity-Check via `npm run dev`**

Run:
```bash
npm run dev
```
- Browser öffnen, DevTools → Network. Erwartetes Verhalten: zwei GET-Requests gegen `raw.githubusercontent.com/…/main/src/data/{dishes,ingredients}.json` beim App-Start.
- Falls der Request fehlschlägt (Repo hat noch kein `schemaVersion: 1` gepusht — aber das haben wir in Task 0.1 erledigt): siehe Console-Log.

Stoppen mit Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "$(cat <<'EOF'
feat(app): auto-check remote rezepte beim app-start

Nach dem ersten refresh() laueft performAutoCheck() asynchron im
Hintergrund. Wenn neue Rezepte gefunden werden, setzt der Check
state.remoteHasUpdates und triggert einen refresh() — der Badge
am Burger-Icon erscheint dann (Task A.9).

Blockiert den First-Render nicht. Fehler sind silent.
EOF
)"
```

---

### Task A.9: Badge am Burger-Icon

**Files:**
- Modify: `src/dashboard/header.js`
- Modify: `src/settings/render.js` (Badge-Clear beim Sheet-Öffnen)

- [ ] **Step 1: Badge-Rendering in `header.js` ergänzen**

In `src/dashboard/header.js`, den `ICON_MENU`-Konstanten-Block ersetzen durch:

```js
// Material Symbol "menu" (Burger) für den Settings-Öffner.
const ICON_MENU = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg>`;

// Kleiner Dot-Badge fuer "neue Rezepte verfuegbar". Wird ueber den Burger
// gelegt und per CSS positioniert.
function menuBtnHtml(hasBadge) {
  const badgeHtml = hasBadge
    ? '<span class="icon-btn__dot" aria-hidden="true"></span>'
    : '';
  const ariaLabel = hasBadge
    ? 'Einstellungen öffnen (neue Rezepte verfügbar)'
    : 'Einstellungen öffnen';
  return `<button class="icon-btn icon-btn--relative" data-action="open-settings" aria-label="${ariaLabel}" title="Einstellungen">
    ${ICON_MENU}${badgeHtml}
  </button>`;
}
```

- [ ] **Step 2: `renderDashboardHeader` und `renderShoppingHeader` nutzen `menuBtnHtml`**

In `renderDashboardHeader`, den Settings-Button-Block ersetzen:

Suche:
```js
      <button class="icon-btn" data-action="open-settings" aria-label="Einstellungen öffnen" title="Einstellungen">
        ${ICON_MENU}
      </button>
```

Ersetze durch:
```js
      ${menuBtnHtml(state.remoteHasUpdates)}
```

Und in `renderShoppingHeader` dieselbe Ersetzung.

- [ ] **Step 3: CSS-Regeln für den Dot ergänzen**

In `styles/` (Datei suchen — vermutlich `styles/components.css` oder `styles/header.css`):

```bash
grep -l "icon-btn" styles/*.css
```

Dann in der gefundenen Datei am Ende ergänzen:

```css
/* Dot-Badge fuer "neue Rezepte verfuegbar" am Burger-Icon. */
.icon-btn--relative {
  position: relative;
}
.icon-btn__dot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--md-sys-color-error);
  pointer-events: none;
}
```

- [ ] **Step 4: Badge-Clear beim Settings-Sheet-Öffnen**

In `src/settings/render.js`, die Funktion `openSettingsSheet` finden. Direkt am Anfang der Funktion (nach der ersten Zeile) einfügen:

```js
  // Badge-Clear: der User hat das Sheet geoeffnet → das Signal ist "gesehen",
  // auch wenn er nicht bis zur Rezepte-Section scrollt.
  if (state.remoteHasUpdates) {
    state.remoteHasUpdates = false;
    // Kein saveState hier — refresh() wird durch onChange-Callback getriggert.
  }
```

Falls `state` in `render.js` noch nicht importiert ist:

```js
import { state } from '../state.js';
```

- [ ] **Step 5: Test in `npm run dev`**

- Browser öffnen. Wenn Repo bereits `schemaVersion: 1` gepusht hat und remote und local synchron sind, wird kein Badge angezeigt.
- Um Badge zu forcieren: DevTools → Console → `state.remoteHasUpdates = true` → App refresh (per Code-Save oder Reload). Badge muss am Burger erscheinen.
- Klick auf Burger → Badge muss verschwinden.

- [ ] **Step 6: Commit**

```bash
git add src/dashboard/header.js src/settings/render.js styles/
git commit -m "$(cat <<'EOF'
feat(header): dot-badge am burger-icon fuer neue rezepte

Wenn state.remoteHasUpdates=true (vom Auto-Check gesetzt), zeigt der
Burger im Header einen kleinen roten Dot oben-rechts. Beim Oeffnen
des Settings-Sheets wird der Flag gecleart, unabhaengig davon ob der
User bis zur Rezepte-Section scrollt.

CSS-Regel .icon-btn__dot mit absolute-Positionierung, Farbe aus
Material-3-Palette (--md-sys-color-error).
EOF
)"
```

---

### Task A.10: Settings-Section „Rezepte"

**Files:**
- Modify: `src/settings/render.js`
- Create: `src/settings/rezepte-section.js`

- [ ] **Step 1: Neue Datei `src/settings/rezepte-section.js`**

```js
// Rendert die "Rezepte"-Section im Settings-Sheet.
// Zeigt eine dynamische Summary + einen Secondary-Button, der den
// Update-Flow triggert (Task A.11).

import { state, saveState } from '../state.js';
import { performImport, canManualFetch } from '../data/remote-updates.js';

// Baut die Summary-Zeile: nie geprueft / alles aktuell / X neue verfuegbar.
export function buildRezepteSummary() {
  if (!state.remoteUpdatedAt) return 'Noch nicht geprüft';
  const ago = formatAgo(state.remoteUpdatedAt);
  const importedCount = Array.isArray(state.remoteDishes) ? state.remoteDishes.length : 0;
  const parts = [`Zuletzt geprüft: ${ago}`];
  if (state.remoteHasUpdates) parts.unshift('Neue Rezepte verfügbar');
  else if (importedCount > 0) parts.push(`${importedCount} zusätzliche Rezepte geladen`);
  else parts.push('alle Rezepte sind aktuell');
  return parts.join(' · ');
}

// HTML-Body der Section (in section() eingesetzt).
export function renderRezepteSectionBody() {
  return `
    <button type="button" class="btn btn--secondary" data-action="rezepte-check">
      Nach neuen Rezepten suchen
    </button>
  `;
}

// Wird nach dem Sheet-Rendering aufgerufen; verdrahtet den Button.
export function wireRezepteSection(root, { onOpenUpdateSheet, onToast }) {
  const btn = root.querySelector('[data-action="rezepte-check"]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!canManualFetch()) {
      onToast?.('Bereits gerade geprüft, keine neuen Rezepte.');
      return;
    }
    onOpenUpdateSheet();
  });
}

// -- Helper -------------------------------------------------------------

function formatAgo(iso) {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return 'unbekannt';
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return `vor ${d} Tagen`;
}
```

- [ ] **Step 2: Section in `settings/render.js` einbauen**

In `src/settings/render.js`, in der `renderShell()`-Funktion (oder wo die Sections gerendert werden — nach dem `section('daten', ...)`-Block), ergänzen:

```js
          ${section('rezepte', 'Rezepte', renderRezepteSectionBody(), '')}
```

Und den Import am Anfang von `render.js` ergänzen:

```js
import { renderRezepteSectionBody, buildRezepteSummary, wireRezepteSection } from './rezepte-section.js';
```

- [ ] **Step 3: Section-Summary dynamisch anzeigen**

In `settings/render.js`, in der `section()`-Funktion oder im Render-Zyklus, sicherstellen dass die Section-Summary für `'rezepte'` aus `buildRezepteSummary()` gezogen wird.

Ansatz: Falls die bestehende `section()`-Funktion einen `summary`-Parameter nimmt, den ergänzen. Sonst nach dem Rendering per JS die `[data-section-summary="rezepte"]`-Element updaten:

```js
// Nach dem Rendering der Sections
const summaryEl = root.querySelector('[data-section-summary="rezepte"]');
if (summaryEl) summaryEl.textContent = buildRezepteSummary();
```

- [ ] **Step 4: Wire-up des Buttons in `mountSettingsSheet`**

In `settings/render.js`, wo das Sheet gemounted wird, nach dem `renderShell()`-Aufruf:

```js
wireRezepteSection(root, {
  onOpenUpdateSheet: () => {
    // wird in Task A.11 implementiert
    console.log('Update-Sheet wird in Task A.11 implementiert');
  },
  onToast: (msg) => showToast?.(msg),
});
```

- [ ] **Step 5: Manueller Test**

Run:
```bash
npm run dev
```
- Settings öffnen → neue Section „Rezepte" ist da mit Summary („Noch nicht geprüft" bei Fresh Install).
- Button „Nach neuen Rezepten suchen" klicken → in Console erscheint „Update-Sheet wird in Task A.11 implementiert".

- [ ] **Step 6: Commit**

```bash
git add src/settings/rezepte-section.js src/settings/render.js
git commit -m "$(cat <<'EOF'
feat(settings): rezepte-section mit dynamischer summary

Neue Section "Rezepte" im Settings-Sheet mit sekundaerem Button
"Nach neuen Rezepten suchen". Section-Summary ist dynamisch:
- Nie geprueft: "Noch nicht geprueft"
- Alles aktuell: "Zuletzt geprueft: vor X min · alle Rezepte sind aktuell"
- Neue verfuegbar: "Neue Rezepte verfuegbar · zuletzt geprueft: vor X min"

Button-Handler pruft canManualFetch() (60s-Soft-Rate-Limit). Der
tatsaechliche Update-Sheet-Flow folgt in Task A.11.
EOF
)"
```

---

### Task A.11: Update-Sheet mit Import-Flow

**Files:**
- Create: `src/settings/update-sheet.js`
- Modify: `src/settings/render.js` (Handler verdrahten)
- Modify: `index.html` (Root-Element für Sheet ergänzen)

- [ ] **Step 1: Root-Element in `index.html` ergänzen**

In `index.html`, direkt neben den anderen Sheet-Roots (`detail-sheet-root`, `settings-sheet-root`), ergänzen:

```html
<div id="update-sheet-root"></div>
```

- [ ] **Step 2: `src/settings/update-sheet.js` schreiben**

```js
// Update-Sheet fuer den Remote-Rezept-Import.
// Rendert je nach Fetch-Ergebnis:
// - Fehler-Sheet (Netz weg / Schema-Mismatch)
// - "Alles aktuell"-Toast (kein Sheet)
// - Preview-Liste mit Bulk-Import-Button
// - Nach Import: Progress + Erfolgs-Zusammenfassung mit Warnungen

import { state, saveState } from '../state.js';
import { performImport, fetchRemoteJsons, diffRemoteAgainstLocal, SCHEMA_ERROR } from '../data/remote-updates.js';
import dishesData from '../data/dishes.json';

let mountRoot = null;
let refreshApp = null;
let showToastFn = null;

export function mountUpdateSheet(root, { onChange, showToast }) {
  mountRoot = root;
  refreshApp = onChange;
  showToastFn = showToast;
}

export async function openUpdateSheet() {
  if (!mountRoot) return;
  renderLoading();

  const fetched = await fetchRemoteJsons();
  if (!fetched.ok) {
    renderError(fetched.error);
    return;
  }

  const { newIds } = diffRemoteAgainstLocal({
    bundled: dishesData.dishes,
    alreadyImported: state.remoteDishes,
    remote: fetched.dishes.dishes,
  });

  if (newIds.length === 0) {
    close();
    showToastFn?.('Deine Rezepte sind aktuell.');
    // remoteUpdatedAt trotzdem updaten damit "vor X min" stimmt.
    state.remoteLastFetchAt = new Date().toISOString();
    state.remoteUpdatedAt = state.remoteLastFetchAt;
    saveState();
    refreshApp?.();
    return;
  }

  const newDishes = fetched.dishes.dishes.filter((d) => newIds.includes(d.id));
  renderPreview(newDishes);
}

function renderLoading() {
  mountRoot.innerHTML = `
    <div class="sheet-backdrop is-open" data-role="backdrop">
      <div class="sheet sheet--update">
        <div class="sheet__body">
          <p>Ich prüfe das Repo…</p>
        </div>
      </div>
    </div>
  `;
  wireBackdrop();
}

function renderError(errorCode) {
  const msg = {
    NETWORK: 'Keine Verbindung — versuch es später erneut.',
    PARSE: 'Rezepte-Datei ist beschädigt — bitte später erneut.',
    [SCHEMA_ERROR.TOO_NEW]: 'Neue Rezepte nutzen ein neueres Datenformat. Bitte die App aktualisieren und dann erneut versuchen.',
    [SCHEMA_ERROR.TOO_OLD]: 'Die Rezept-Quelle ist unerwartet älter als die App. Bitte melde dies auf GitHub.',
    [SCHEMA_ERROR.MISSING]: 'Die Rezept-Quelle hat keine Versions-Angabe. Bitte melde dies auf GitHub.',
  }[errorCode] || 'Unbekannter Fehler beim Update-Check.';

  mountRoot.innerHTML = `
    <div class="sheet-backdrop is-open" data-role="backdrop">
      <div class="sheet sheet--update">
        <div class="sheet__body">
          <h2>Update fehlgeschlagen</h2>
          <p>${msg}</p>
          <button type="button" class="btn btn--secondary" data-action="close">Schließen</button>
        </div>
      </div>
    </div>
  `;
  wireBackdrop();
  mountRoot.querySelector('[data-action="close"]').addEventListener('click', close);
}

function renderPreview(newDishes) {
  const listHtml = newDishes.map((d) => `
    <li class="update-sheet__item">
      <span class="update-sheet__name">${escape(d.name)}</span>
      <span class="update-sheet__cuisine">${escape(d.cuisine || '')}</span>
    </li>
  `).join('');

  mountRoot.innerHTML = `
    <div class="sheet-backdrop is-open" data-role="backdrop">
      <div class="sheet sheet--update">
        <div class="sheet__body">
          <h2>Neue Rezepte gefunden (${newDishes.length})</h2>
          <ul class="update-sheet__list">${listHtml}</ul>
          <div class="update-sheet__actions">
            <button type="button" class="btn btn--primary" data-action="import">${newDishes.length} Rezepte laden</button>
            <button type="button" class="btn btn--text" data-action="cancel">Abbrechen</button>
          </div>
        </div>
      </div>
    </div>
  `;
  wireBackdrop();
  mountRoot.querySelector('[data-action="cancel"]').addEventListener('click', close);
  mountRoot.querySelector('[data-action="import"]').addEventListener('click', () => startImport());
}

async function startImport() {
  const bodyEl = mountRoot.querySelector('.sheet__body');
  bodyEl.innerHTML = `
    <h2>Lade Rezepte…</h2>
    <p data-role="progress">Vorbereitung…</p>
  `;
  const progressEl = bodyEl.querySelector('[data-role="progress"]');

  const result = await performImport({
    onProgress: ({ phase, current, total, currentName }) => {
      if (phase === 'metadata') progressEl.textContent = 'Lese Rezept-Daten…';
      else if (phase === 'images') progressEl.textContent = `${current} von ${total} Bilder geladen${currentName ? ` (${currentName})` : ''}…`;
    },
  });

  if (!result.ok) {
    renderError(result.error);
    return;
  }

  const importedCount = result.imported.length;
  const skippedCount = result.warnings.length;
  const skippedHtml = skippedCount > 0
    ? `<p class="update-sheet__warning">${skippedCount} übersprungen — ${result.warnings.map((w) => `${escape(w.name)} (Zutat \`${escape(w.missingKey)}\` fehlt)`).join(', ')}</p>`
    : '';

  bodyEl.innerHTML = `
    <h2>Fertig</h2>
    <p>${importedCount} Rezept${importedCount === 1 ? '' : 'e'} geladen.</p>
    ${skippedHtml}
    <button type="button" class="btn btn--primary" data-action="close">OK</button>
  `;
  bodyEl.querySelector('[data-action="close"]').addEventListener('click', () => {
    close();
    refreshApp?.();
  });
}

function wireBackdrop() {
  const bd = mountRoot.querySelector('[data-role="backdrop"]');
  bd?.addEventListener('click', (ev) => {
    if (ev.target === bd) close();
  });
}

function close() {
  if (mountRoot) mountRoot.innerHTML = '';
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
```

- [ ] **Step 3: Mount + Wire in `main.js`**

In `src/main.js`, nach den anderen `mount*`-Calls (nach `mountAddChoiceSheet`), ergänzen:

```js
import { mountUpdateSheet, openUpdateSheet } from './settings/update-sheet.js';
```

Am Datei-Ende (bei den anderen Mount-Aufrufen):

```js
const updateSheetRoot = document.getElementById('update-sheet-root');
mountUpdateSheet(updateSheetRoot, {
  onChange: refresh,
  showToast: (msg) => showToast(msg),
});
```

- [ ] **Step 4: `showToast`-Import in `main.js` und `rezepte-section.js` ergänzen**

Der Toast-Helper existiert bereits unter `src/util/toast.js` mit der Signatur `showToast(text, { duration, tone })`.

In `src/main.js` am Anfang der Datei:
```js
import { showToast } from './util/toast.js';
```

In `src/settings/render.js` am Anfang:
```js
import { showToast } from '../util/toast.js';
```

- [ ] **Step 5: `openUpdateSheet` in `rezepte-section.js` verdrahten**

In `src/settings/render.js`, den `wireRezepteSection`-Aufruf aus Task A.10 anpassen:

```js
wireRezepteSection(root, {
  onOpenUpdateSheet: () => openUpdateSheet(),
  onToast: (msg) => showToast(msg),
});
```

Import ergänzen:
```js
import { openUpdateSheet } from './update-sheet.js';
```

- [ ] **Step 6: CSS-Regeln für das Update-Sheet ergänzen**

In `styles/` (in derselben Datei wie andere Sheets, z.B. `styles/sheets.css`):

```css
.sheet--update {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px;
  background: var(--md-sys-color-surface);
  border-radius: 16px 16px 0 0;
}
.update-sheet__list {
  list-style: none;
  padding: 0;
  margin: 12px 0;
}
.update-sheet__item {
  padding: 10px 0;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  display: flex;
  justify-content: space-between;
}
.update-sheet__cuisine {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.9em;
}
.update-sheet__actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.update-sheet__warning {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.9em;
  margin-top: 8px;
}
```

- [ ] **Step 7: Manueller Test**

Run:
```bash
npm run dev
```

- Settings öffnen → „Nach neuen Rezepten suchen" klicken → Update-Sheet öffnet mit „Ich prüfe das Repo…"
- Falls Repo neue Rezepte hat (im echten Betrieb): Preview-Liste sollte zu sehen sein.
- Falls alles aktuell: Toast erscheint, Sheet schließt sich.
- 60s-Rate-Limit: sofort erneut klicken → Toast „Bereits gerade geprüft".

- [ ] **Step 8: Commit**

```bash
git add index.html src/settings/update-sheet.js src/settings/rezepte-section.js src/settings/render.js src/main.js styles/
git commit -m "$(cat <<'EOF'
feat(settings): update-sheet mit import-flow und fehler-sheets

Update-Sheet zeigt je nach Fetch-Ergebnis:
- Loading-Zustand "Ich pruefe das Repo..."
- Fehler-Sheet mit einer deutschen Meldung pro Fehler-Klasse
  (Keine Verbindung, JSON kaputt, Schema zu neu/alt/fehlend)
- Preview-Liste (kompakt, Name + Kueche) mit "X Rezepte laden"-
  Primary + "Abbrechen"
- Nach Import: Progress "N von M Bilder geladen (Name)..."
- Erfolgs-Zusammenfassung mit optionaler Warnung fuer uebersprungene
  Rezepte (Missing Ingredient)

"Alles aktuell"-Fall zeigt keinen Sheet, nur einen Toast.

Root-Element in index.html ergaenzt, mount in main.js, Handler in
rezepte-section.js verdrahtet.
EOF
)"
```

---

### Task A.12: Bild-URL-Resolution + Card-Integration

**Files:**
- Create: `src/data/dish-image.js`
- Modify: `src/dashboard/card.js`
- Modify: `src/detail-sheet/render.js`

- [ ] **Step 1: `src/data/dish-image.js` schreiben**

```js
// Zentrale Bild-URL-Aufloesung: bundled hat Vorrang, sonst Remote-Cache,
// sonst Fallback-Silhouette.
//
// Die Card + das Detail-Sheet rufen resolveDishImage(id) und binden das
// Ergebnis in <img src>. Fuer Remote-Bilder ist die Rueckgabe ein Cache-URI
// (Filesystem oder Blob-URL) — beim ersten Aufruf nach Import kann sie null
// sein, dann wird die Fallback-Silhouette gerendert bis der Bild-Download
// durch ist.

import dishesData from './dishes.json';
import { imageCache } from '../util/image-cache.js';

const bundledIds = new Set(dishesData.dishes.map((d) => d.id));

const PLACEHOLDER = '/dishes/dish-placeholder.jpg';

// Sync-Version fuer Card-Rendering: liefert entweder bundled-URL oder
// Placeholder. Fuer Remote-Bilder muss der Caller separat resolveDishImageAsync
// nutzen und die URL nachtraeglich in die Card patchen.
export function resolveDishImage(id) {
  if (bundledIds.has(id)) return `/dishes/dish-${id}.jpg`;
  return PLACEHOLDER;
}

// Async-Version: liefert echten Cache-URI wenn bereits geladen, sonst null.
export async function resolveDishImageAsync(id) {
  if (bundledIds.has(id)) return `/dishes/dish-${id}.jpg`;
  const cached = await imageCache.get(id);
  return cached || null;
}

// Convenience fuer's Card-Rendering: liefert sofort einen brauchbaren src
// (bundled oder placeholder) UND setzt asynchron den echten Cache-URI wenn
// verfuegbar. Der Consumer uebergibt ein <img>-Element.
export async function bindDishImage(imgEl, id) {
  imgEl.src = resolveDishImage(id);
  if (bundledIds.has(id)) return;
  const url = await resolveDishImageAsync(id);
  if (url) imgEl.src = url;
}
```

- [ ] **Step 2: Placeholder-Bild anlegen**

- Falls `public/dishes/dish-placeholder.jpg` noch nicht existiert: eine schlichte Silhouette (dunkelgrau auf Surface-Farbe, 800×800) unter dem Pfad ablegen. Kann ein simples SVG-to-JPG-Export sein.
- Sanity-Check:
```bash
ls -la public/dishes/dish-placeholder.jpg
```

Falls fehlt: als Notlösung `dish-1.jpg` kopieren und später ersetzen:
```bash
cp public/dishes/dish-1.jpg public/dishes/dish-placeholder.jpg
```

- [ ] **Step 3: Card-Rendering in `src/dashboard/card.js` anpassen**

Die bestehende Card-Bild-URL (`/dishes/dish-<id>.jpg`) durch `resolveDishImage(id)` ersetzen, und nach dem Rendering `bindDishImage()` aufrufen:

Suche in `card.js` nach der Zeile die das Bild rendert (etwa `src="/dishes/dish-${dish.id}.jpg"` oder ähnlich). Ersetze durch `src="${resolveDishImage(dish.id)}"`.

Nach dem Rendering (im DOM-Wire-up-Teil), für jedes gerenderte Card-Bild:
```js
const imgEl = cardEl.querySelector('.day-card__image');
if (imgEl) bindDishImage(imgEl, dish.id);
```

Import am Anfang der Datei:
```js
import { resolveDishImage, bindDishImage } from '../data/dish-image.js';
```

- [ ] **Step 4: Detail-Sheet-Bild analog**

In `src/detail-sheet/render.js` dasselbe Muster anwenden. Suche die Bild-URL, ersetze durch `resolveDishImage(dish.id)`, hänge nach Render einen `bindDishImage`-Aufruf an.

- [ ] **Step 5: Build verifizieren**

Run:
```bash
npm run build
```
Expected: kein Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/data/dish-image.js src/dashboard/card.js src/detail-sheet/render.js public/dishes/dish-placeholder.jpg
git commit -m "$(cat <<'EOF'
feat(data): dish-image mit bundled/remote-cache/fallback-aufloesung

Neuer zentraler Aufloeser resolveDishImage(id): bundled zuerst,
sonst placeholder. resolveDishImageAsync(id) fuer Remote-Bilder
via imageCache. bindDishImage(imgEl, id) ist die Bequemlichkeits-
API fuer Cards/Sheets: sofortiger Placeholder + async-swap.

Card und Detail-Sheet nutzen die neue API. Ein statischer
Placeholder liegt unter public/dishes/dish-placeholder.jpg.
EOF
)"
```

---

### Task A.13: „Neu"-Marker-API + Filter-Chip (Funktion)

**Files:**
- Modify: `src/dish-picker/render.js` (Filter-Eintrag + Test-Funktion)
- Modify: `src/dashboard/card.js` (optionales isNew-Prop, funktional, kein UI)

- [ ] **Step 1: Filter-Eintrag im Picker**

In `src/dish-picker/render.js`, im `FILTERS`-Array (ähnlich strukturiert wie die anderen Filter-Einträge), einen neuen Filter ergänzen — direkt vor der `cuisine`-Gruppe:

```js
  { key: 'is-new', label: 'Neu', group: 'special', test: (d) => isNewDish(d.id) },
```

Import ergänzen:
```js
import { isNewDish } from '../data/dishes.js';
```

- [ ] **Step 2: Filter-Chip nur wenn `remoteNewIds` nicht leer**

Im Render-Code der Filter-Chip-Reihe (dort wo Filter zu Chips gerendert werden), pro Filter prüfen ob er zeigen soll:

```js
// Filter "is-new" nur zeigen wenn es aktuell markierte Neue gibt.
if (f.key === 'is-new' && state.remoteNewIds.size === 0) continue;
```

Falls `state` nicht importiert ist:
```js
import { state } from '../state.js';
```

- [ ] **Step 3: Card-Prop `isNew` (funktional, kein UI)**

In `src/dashboard/card.js` die Card-Render-Funktion um ein optionales `isNew`-Attribut erweitern. Zunächst rein als Daten-Attribut am Card-Element (für spätere CSS-Verdrahtung ohne Code-Änderung):

```js
// Am Anfang der Render-Funktion:
import { isNewDish } from '../data/dishes.js';

// Beim Rendern des Card-Wrapper-Elements:
const isNew = isNewDish(dish.id);
// ... im HTML-String:
`<div class="day-card ${isNew ? 'day-card--new' : ''}" data-is-new="${isNew}">`
```

Kein visueller Marker in dieser Task — die UI-Position wird bei der Live-Iteration entschieden. Die Klasse `.day-card--new` gibt dem User einen Hook.

- [ ] **Step 4: Build verifizieren**

Run:
```bash
npm run build
```
Expected: kein Fehler.

- [ ] **Step 5: Manueller Test**

- `npm run dev`
- In DevTools: `state.remoteNewIds = new Set([1, 5])` setzen und Reload
- Picker öffnen → Filter-Chip „Neu" sollte sichtbar sein
- Aktivieren → nur Rezepte mit ID 1 und 5 sind gefiltert
- Bei leerem `remoteNewIds`: Chip verschwindet

- [ ] **Step 6: Commit**

```bash
git add src/dish-picker/render.js src/dashboard/card.js
git commit -m "$(cat <<'EOF'
feat(picker,card): neu-marker-api + filter-chip (funktional)

isNewDish(id) wird im Picker-Filter genutzt: neuer Chip "Neu" in
der special-Gruppe, sichtbar nur wenn state.remoteNewIds.size > 0.

Card bekommt eine .day-card--new-Klasse + data-is-new-Attribut wenn
das Rezept "Neu" ist. Kein visueller Marker in dieser Task — die
UI-Position wird bei der Live-Iteration entschieden. CSS-Hook ist da.
EOF
)"
```

---

## Phase B — Repo-Contribution-Files

### Task B.1: Scripts-Setup + Validator-Basis

**Files:**
- Create: `scripts/package.json`
- Create: `scripts/validate-recipe.mjs`
- Create: `scripts/validate-recipe.test.mjs`
- Create: `.gitignore` (Ergänzung falls nötig)

- [ ] **Step 1: `scripts/package.json` schreiben**

```json
{
  "name": "mahlzeit-scripts",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "Validator-Scripts fuer PR-Checks. Isoliert von der App-package.json (Sicherheit: die Github Action installiert nur diese Deps, nicht die App-Deps).",
  "scripts": {
    "test": "node validate-recipe.test.mjs"
  },
  "dependencies": {
    "sharp": "^0.33.0"
  }
}
```

- [ ] **Step 2: Install laufen lassen und lockfile erzeugen**

Run:
```bash
cd scripts && npm install
```
Expected: `scripts/node_modules/` und `scripts/package-lock.json` entstehen.

- [ ] **Step 3: `.gitignore` prüfen**

```bash
grep -n "node_modules" /Users/oliverwosnitza/Documents/Mahlzeit-App/.gitignore
```
Falls es nur `node_modules` matcht, dann auch `scripts/node_modules/` einfach abgedeckt.

- [ ] **Step 4: `scripts/validate-recipe.mjs` (Basis-Skelett)**

```js
// Validator fuer Community-PRs mit neuen Rezepten.
// Wird von .github/workflows/pr-recipe-check.yml aufgerufen.
//
// Prueft:
// - Bild-Files (Dimension, Groesse, Format) via sharp
// - JSON-Struktur (Pflichtfelder, Enum, ID-Eindeutigkeit, Sanity)
// - Ingredient-Keys existieren, Prefix-Kollision als Warnung
//
// Rueckgabe: 0 bei Success, 1 bei Fehler. Fehler + Warnungen werden
// als GitHub-Actions-Annotationen auf stdout ausgegeben:
//   ::error file=path,line=n::text
//   ::warning file=path::text
// Ausserdem wird ein Kommentar-Body auf stdout unter "---COMMENT---"
// ausgegeben, den die Action als PR-Kommentar posten kann.

import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';

const CUISINE_GROUPS = ['mediterranean', 'asian', 'middleEast', 'americas'];
const REQUIRED_DISH_FIELDS = ['id', 'name', 'cuisine', 'cuisineGroup', 'cooktime', 'kcal', 'p', 'kh', 'f', 'tags', 'ingredients', 'steps'];
const MAX_IMAGE_BYTES = 400 * 1024;
const IMAGE_SIZE = 800;
const IMAGE_SIZE_TOL = 10;
const KCAL_SANITY_TOL = 100;
const PREFIX_LEN = 4;

const errors = [];
const warnings = [];

function err(file, line, msg) {
  errors.push({ file, line, msg });
}

function warn(file, msg) {
  warnings.push({ file, msg });
}

async function main() {
  // Diff gegen Base-Branch ermitteln — welche Files hat der PR angefasst?
  const changed = getChangedFiles();
  const changedDishesJson = changed.includes('src/data/dishes.json');
  const changedIngredientsJson = changed.includes('src/data/ingredients.json');
  const changedImages = changed.filter((f) => f.startsWith('public/dishes/') && f.endsWith('.jpg'));

  // Basis-Files laden (aus dem PR-Checkout — das ist der neue Stand).
  const dishes = await loadJson('src/data/dishes.json');
  const ingredients = await loadJson('src/data/ingredients.json');

  // Base-Version fuer ID-Eindeutigkeits-Check.
  const baseDishes = await loadBaseJson('src/data/dishes.json');
  const baseIds = new Set((baseDishes?.dishes || []).map((d) => d.id));

  // Weitere Validation-Schritte werden in Task B.2/B.3/B.4 hinzugefuegt.

  emitAnnotations();
  printComment();
  process.exit(errors.length > 0 ? 1 : 0);
}

function getChangedFiles() {
  const res = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf-8' });
  if (res.status !== 0) return [];
  return res.stdout.trim().split('\n').filter(Boolean);
}

async function loadJson(relPath) {
  try {
    const raw = await readFile(relPath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    err(relPath, 0, `Konnte Datei nicht lesen oder parsen: ${e.message}`);
    return null;
  }
}

async function loadBaseJson(relPath) {
  const res = spawnSync('git', ['show', `origin/main:${relPath}`], { encoding: 'utf-8' });
  if (res.status !== 0) return null;
  try {
    return JSON.parse(res.stdout);
  } catch (_) {
    return null;
  }
}

function emitAnnotations() {
  for (const e of errors) console.log(`::error file=${e.file},line=${e.line}::${e.msg}`);
  for (const w of warnings) console.log(`::warning file=${w.file}::${w.msg}`);
}

function printComment() {
  if (errors.length === 0 && warnings.length === 0) return;
  const lines = ['---COMMENT---'];
  if (errors.length > 0) {
    lines.push('## ❌ Fehler', '');
    for (const e of errors) lines.push(`- \`${e.file}\`${e.line ? ` Zeile ${e.line}` : ''}: ${e.msg}`);
    lines.push('');
  }
  if (warnings.length > 0) {
    lines.push('## ⚠️ Warnungen', '');
    for (const w of warnings) lines.push(`- \`${w.file}\`: ${w.msg}`);
  }
  console.log(lines.join('\n'));
}

main().catch((e) => {
  console.error('Validator crashed:', e);
  process.exit(2);
});
```

- [ ] **Step 5: `scripts/validate-recipe.test.mjs` als Skelett**

```js
// Node-Test-Skelett fuer den Validator. Wird in Task B.2/B.3/B.4 erweitert.
// Jeder Test setzt sich ein Fixture-Repo unter /tmp auf, kopiert die Files,
// wechselt hin, ruft validate-recipe.mjs auf und prueft Exit-Code + Output.
//
// Aufruf: `node scripts/validate-recipe.test.mjs`.

// Placeholder — echte Tests in den naechsten Tasks.
console.log('validate-recipe.test.mjs Skelett — Tests folgen in Task B.2 ff.');
```

- [ ] **Step 6: `scripts/node_modules/` und `scripts/package-lock.json` committen**

```bash
cd /Users/oliverwosnitza/Documents/Mahlzeit-App
git add scripts/package.json scripts/package-lock.json scripts/validate-recipe.mjs scripts/validate-recipe.test.mjs
# node_modules NICHT committen (via .gitignore)
git status
```

Prüfe dass `scripts/node_modules/` nicht in `git status` auftaucht.

- [ ] **Step 7: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(scripts): validator-skelett fuer pr-recipe-check

Neues Verzeichnis scripts/ mit isolierter package.json (nur sharp
als Dep). Sicherheits-Rationale: die GitHub Action installiert
NUR diese Deps, nicht die App-Deps — kein Missbrauch-Vektor via
PR-Content.

validate-recipe.mjs enthaelt die Grundstruktur: Diff-Ermittlung
gegen origin/main, JSON-Loading, GitHub-Actions-Annotations
(::error, ::warning), PR-Kommentar-Body. Die konkreten Checks
folgen in B.2 (JSON-Pflichtfelder), B.3 (Ingredient-Konsistenz +
Prefix), B.4 (Bild-Checks).
EOF
)"
```

---

### Task B.2: Validator — Pflichtfelder + Enum + ID-Eindeutigkeit

**Files:**
- Modify: `scripts/validate-recipe.mjs`

- [ ] **Step 1: Neue Dishes ermitteln + Pflichtfeld-Check**

In `scripts/validate-recipe.mjs`, in der `main()`-Funktion (an der Stelle „Weitere Validation-Schritte werden in Task B.2/B.3/B.4 hinzugefuegt"), ergänzen:

```js
  // Neue Dishes = alle die im aktuellen JSON drin sind, aber nicht in base.
  const newDishes = (dishes?.dishes || []).filter((d) => !baseIds.has(d.id));

  for (const d of newDishes) {
    for (const field of REQUIRED_DISH_FIELDS) {
      if (!(field in d) || d[field] === null || d[field] === undefined) {
        err('src/data/dishes.json', 0, `Rezept "${d.name || '?'}" (id=${d.id ?? '?'}): Pflichtfeld \`${field}\` fehlt.`);
      }
    }

    if (d.cuisineGroup && !CUISINE_GROUPS.includes(d.cuisineGroup)) {
      err('src/data/dishes.json', 0, `Rezept "${d.name}" (id=${d.id}): \`cuisineGroup: "${d.cuisineGroup}"\` ist nicht im Enum. Erlaubt: ${CUISINE_GROUPS.join(', ')}`);
    }
  }

  // ID-Eindeutigkeit im aktuellen JSON.
  const seen = new Set();
  for (const d of dishes?.dishes || []) {
    if (seen.has(d.id)) err('src/data/dishes.json', 0, `Doppelte ID: ${d.id}`);
    seen.add(d.id);
  }
```

- [ ] **Step 2: Test-Fixture-Setup in `validate-recipe.test.mjs`**

Ersetze den Placeholder in `scripts/validate-recipe.test.mjs`:

```js
// Node-Test fuer validate-recipe.mjs.
// Baut fuer jeden Test-Fall ein temporaeres Git-Repo unter /tmp,
// legt Fixture-Files ab, macht einen Commit, dann einen "PR-Branch"
// mit dem Test-Content, ruft den Validator und pruefte Exit + Output.
//
// Aufruf: `node scripts/validate-recipe.test.mjs`.

import { mkdtempSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const validatorPath = path.resolve(new URL('.', import.meta.url).pathname, 'validate-recipe.mjs');

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  OK  ', name);
  else { failures++; console.error('  FAIL', name, detail ? `-> ${detail}` : ''); }
}

// Baut ein temporaeres Repo mit Basis-Files auf main und Test-Files auf PR-Branch.
function makeRepo({ mainDishes, mainIngredients, prDishes, prIngredients, prImageIds = [] }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'validator-test-'));

  const runGit = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });

  runGit('init', '-b', 'main');
  runGit('config', 'user.email', 'test@example.com');
  runGit('config', 'user.name', 'Test');

  mkdirSync(path.join(dir, 'src/data'), { recursive: true });
  mkdirSync(path.join(dir, 'public/dishes'), { recursive: true });

  writeFileSync(path.join(dir, 'src/data/dishes.json'), JSON.stringify(mainDishes, null, 2));
  writeFileSync(path.join(dir, 'src/data/ingredients.json'), JSON.stringify(mainIngredients, null, 2));

  runGit('add', '.');
  runGit('commit', '-m', 'main');

  // "origin/main" simulieren durch remote add zu sich selbst — dann fetch.
  runGit('remote', 'add', 'origin', dir);
  runGit('fetch', 'origin', 'main');

  // PR-Branch
  runGit('checkout', '-b', 'pr');
  writeFileSync(path.join(dir, 'src/data/dishes.json'), JSON.stringify(prDishes, null, 2));
  writeFileSync(path.join(dir, 'src/data/ingredients.json'), JSON.stringify(prIngredients, null, 2));
  for (const id of prImageIds) {
    // 1x1 pixel jpeg (base64). Nicht 800x800, aber existiert - wird in B.4
    // von sharp geprueft, hier reicht Existenz fuer Pflichtfeld-Check.
    const jpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AH//Z', 'base64');
    writeFileSync(path.join(dir, `public/dishes/dish-${id}.jpg`), jpg);
  }
  runGit('add', '.');
  runGit('commit', '-m', 'pr');

  return dir;
}

function runValidator(cwd) {
  return spawnSync('node', [validatorPath], { cwd, encoding: 'utf-8' });
}

// -- Fall 1: sauberes neues Rezept -> exit 0
{
  const dir = makeRepo({
    mainDishes: { schemaVersion: 1, dishes: [{ id: 1, name: 'Basis', cuisine: 'X', cuisineGroup: 'asian', cooktime: 10, kcal: 500, p: 20, kh: 60, f: 15, tags: [], ingredients: [{ key: 'karotte', grams: 100 }], steps: ['Kochen.'] }] },
    mainIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'Karotte', cat: 'frisch', unit: 'g', per100g: { kcal: 41, p: 0.9, kh: 9.6, f: 0.2 } } } },
    prDishes: {
      schemaVersion: 1,
      dishes: [
        { id: 1, name: 'Basis', cuisine: 'X', cuisineGroup: 'asian', cooktime: 10, kcal: 500, p: 20, kh: 60, f: 15, tags: [], ingredients: [{ key: 'karotte', grams: 100 }], steps: ['Kochen.'] },
        { id: 2, name: 'Neu', cuisine: 'Y', cuisineGroup: 'mediterranean', cooktime: 20, kcal: 600, p: 30, kh: 50, f: 20, tags: [], ingredients: [{ key: 'karotte', grams: 200 }], steps: ['Braten.'] },
      ],
    },
    prIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'Karotte', cat: 'frisch', unit: 'g', per100g: { kcal: 41, p: 0.9, kh: 9.6, f: 0.2 } } } },
    prImageIds: [2],
  });
  const res = runValidator(dir);
  check('Fall 1: sauberes Rezept -> exit 0', res.status === 0, res.stdout + res.stderr);
}

// -- Fall 2: fehlendes Pflichtfeld -> exit 1
{
  const dir = makeRepo({
    mainDishes: { schemaVersion: 1, dishes: [] },
    mainIngredients: { schemaVersion: 1, ingredients: {} },
    prDishes: { schemaVersion: 1, dishes: [{ id: 5, name: 'Ohne cuisine' /* fehlt */ }] },
    prIngredients: { schemaVersion: 1, ingredients: {} },
  });
  const res = runValidator(dir);
  check('Fall 2: fehlende Felder -> exit 1', res.status === 1);
  check('Fall 2: Fehler-Text erwaehnt cuisine', res.stdout.includes('cuisine'), res.stdout);
}

// -- Fall 3: ungueltige cuisineGroup -> exit 1
{
  const dir = makeRepo({
    mainDishes: { schemaVersion: 1, dishes: [] },
    mainIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'K', cat: 'x', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } } } },
    prDishes: { schemaVersion: 1, dishes: [{ id: 5, name: 'X', cuisine: 'Y', cuisineGroup: 'martian', cooktime: 10, kcal: 500, p: 20, kh: 60, f: 15, tags: [], ingredients: [{ key: 'karotte', grams: 100 }], steps: ['Kochen.'] }] },
    prIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'K', cat: 'x', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } } } },
    prImageIds: [5],
  });
  const res = runValidator(dir);
  check('Fall 3: falsche cuisineGroup -> exit 1', res.status === 1);
  check('Fall 3: Enum-Text im Output', res.stdout.includes('cuisineGroup'), res.stdout);
}

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log('\nAlle Checks OK.');
```

- [ ] **Step 3: Test ausführen**

Run:
```bash
cd scripts && node validate-recipe.test.mjs
```
Expected: alle `OK`.

- [ ] **Step 4: Commit**

```bash
cd /Users/oliverwosnitza/Documents/Mahlzeit-App
git add scripts/validate-recipe.mjs scripts/validate-recipe.test.mjs
git commit -m "$(cat <<'EOF'
feat(scripts): validator prueft pflichtfelder + cuisineGroup + id-eindeutigkeit

Neue Checks im Validator:
- Alle REQUIRED_DISH_FIELDS in neuen Rezepten muessen vorhanden sein
- cuisineGroup gegen Enum ['mediterranean','asian','middleEast','americas']
- IDs im aktuellen dishes.json muessen eindeutig sein

Node-Test setzt temporaere Git-Repos auf mit main + PR-Branch,
ruft den Validator und prueft Exit + Output. Deckt Sauber-Fall,
Missing-Field und falsche cuisineGroup ab.
EOF
)"
```

---

### Task B.3: Validator — Ingredient-Konsistenz + Sanity + Prefix-Warnung

**Files:**
- Modify: `scripts/validate-recipe.mjs`
- Modify: `scripts/validate-recipe.test.mjs`

- [ ] **Step 1: Ingredient-Konsistenz + Sanity in Validator ergänzen**

In `validate-recipe.mjs`, in der `main()`-Funktion nach dem ID-Eindeutigkeits-Block ergänzen:

```js
  // Ingredient-Keys existieren + Sanity-Check pro neuem Dish.
  const ingredientKeys = new Set(Object.keys(ingredients?.ingredients || {}));
  for (const d of newDishes) {
    for (const ing of d.ingredients || []) {
      if (!ingredientKeys.has(ing.key)) {
        err('src/data/dishes.json', 0, `Rezept "${d.name}" (id=${d.id}): Zutaten-Key \`${ing.key}\` existiert nicht in ingredients.json.`);
      }
    }

    // Naehrwerte-Sanity: |declared kcal - (p*4 + kh*4 + f*9)| < KCAL_SANITY_TOL
    const calc = (d.p || 0) * 4 + (d.kh || 0) * 4 + (d.f || 0) * 9;
    if (Math.abs((d.kcal || 0) - calc) >= KCAL_SANITY_TOL) {
      err('src/data/dishes.json', 0, `Rezept "${d.name}" (id=${d.id}): kcal (${d.kcal}) weicht zu stark vom Makro-Rechner ab (${Math.round(calc)}).`);
    }
  }

  // Prefix-Warnung: neue Ingredient-Keys, die mit denselben 4 Zeichen starten wie existierende.
  const baseIngredients = await loadBaseJson('src/data/ingredients.json');
  const baseKeys = new Set(Object.keys(baseIngredients?.ingredients || {}));
  const newKeys = Object.keys(ingredients?.ingredients || {}).filter((k) => !baseKeys.has(k));
  for (const nk of newKeys) {
    const prefix = nk.slice(0, PREFIX_LEN);
    for (const ek of baseKeys) {
      if (ek.slice(0, PREFIX_LEN) === prefix) {
        warn('src/data/ingredients.json', `Prefix-Kollision: neuer Key \`${nk}\` startet wie bestehender \`${ek}\` — bitte pruefen ob es sich um dieselbe Zutat handelt.`);
        break;
      }
    }
  }
```

- [ ] **Step 2: Tests in `validate-recipe.test.mjs` erweitern**

Am Ende der bestehenden Tests (VOR dem `if (failures > 0)`-Block) einfügen:

```js
// -- Fall 4: Ingredient-Key existiert nicht -> exit 1
{
  const dir = makeRepo({
    mainDishes: { schemaVersion: 1, dishes: [] },
    mainIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'K', cat: 'x', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } } } },
    prDishes: { schemaVersion: 1, dishes: [{ id: 5, name: 'X', cuisine: 'Y', cuisineGroup: 'asian', cooktime: 10, kcal: 500, p: 20, kh: 60, f: 15, tags: [], ingredients: [{ key: 'ghee', grams: 20 }], steps: ['Kochen.'] }] },
    prIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'K', cat: 'x', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } } } },
    prImageIds: [5],
  });
  const res = runValidator(dir);
  check('Fall 4: fehlender Ingredient -> exit 1', res.status === 1);
  check('Fall 4: Fehler-Text erwaehnt ghee', res.stdout.includes('ghee'), res.stdout);
}

// -- Fall 5: kcal-Sanity verletzt -> exit 1
{
  const dir = makeRepo({
    mainDishes: { schemaVersion: 1, dishes: [] },
    mainIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'K', cat: 'x', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } } } },
    prDishes: { schemaVersion: 1, dishes: [{ id: 5, name: 'X', cuisine: 'Y', cuisineGroup: 'asian', cooktime: 10, kcal: 5000, p: 20, kh: 60, f: 15, tags: [], ingredients: [{ key: 'karotte', grams: 100 }], steps: ['Kochen.'] }] },
    prIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'K', cat: 'x', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } } } },
    prImageIds: [5],
  });
  const res = runValidator(dir);
  check('Fall 5: kcal-Sanity verletzt -> exit 1', res.status === 1);
  check('Fall 5: Text erwaehnt kcal', res.stdout.includes('kcal'), res.stdout);
}

// -- Fall 6: Prefix-Warnung (nicht-blockend) -> exit 0 (nur Warning)
{
  const dir = makeRepo({
    mainDishes: { schemaVersion: 1, dishes: [] },
    mainIngredients: { schemaVersion: 1, ingredients: { oregano_tl: { label: 'Oregano', cat: 'gewuerze', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } } } },
    prDishes: {
      schemaVersion: 1,
      dishes: [{ id: 5, name: 'X', cuisine: 'Y', cuisineGroup: 'asian', cooktime: 10, kcal: 200, p: 10, kh: 20, f: 5, tags: [], ingredients: [{ key: 'oregano_g', grams: 5 }], steps: ['Kochen.'] }],
    },
    prIngredients: { schemaVersion: 1, ingredients: {
      oregano_tl: { label: 'Oregano', cat: 'gewuerze', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } },
      oregano_g: { label: 'Oregano g', cat: 'gewuerze', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } },
    } },
    prImageIds: [5],
  });
  const res = runValidator(dir);
  check('Fall 6: Prefix-Warnung -> exit 0', res.status === 0, res.stdout);
  check('Fall 6: Warning-Text im Output', res.stdout.includes('Prefix-Kollision'), res.stdout);
}
```

- [ ] **Step 3: Test ausführen**

Run:
```bash
cd scripts && node validate-recipe.test.mjs
```
Expected: alle `OK`.

- [ ] **Step 4: Commit**

```bash
cd /Users/oliverwosnitza/Documents/Mahlzeit-App
git add scripts/validate-recipe.mjs scripts/validate-recipe.test.mjs
git commit -m "$(cat <<'EOF'
feat(scripts): ingredient-konsistenz + sanity + prefix-warnung

Neue Validator-Checks:
- Alle ingredients[].key in neuen Dishes muessen in ingredients.json
  existieren (Error, blockt Merge)
- Naehrwerte-Sanity |kcal - (p*4+kh*4+f*9)| < 100 (Error)
- Prefix-Kollision (erste 4 Zeichen) neuer Ingredient-Keys mit
  bestehenden -> Warning, blockt nicht

Tests decken alle drei Faelle ab: fehlender Key -> exit 1, kcal-
Verletzung -> exit 1, Prefix-Kollision -> exit 0 mit Warning-Text.
EOF
)"
```

---

### Task B.4: Validator — Bild-Checks (sharp)

**Files:**
- Modify: `scripts/validate-recipe.mjs`
- Modify: `scripts/validate-recipe.test.mjs`

- [ ] **Step 1: Bild-Checks im Validator ergänzen**

In `validate-recipe.mjs`, in der `main()`-Funktion nach dem Prefix-Warning-Block ergänzen:

```js
  // Bild-Checks: fuer jedes neue Dish muss public/dishes/dish-<id>.jpg existieren.
  const newImageIds = new Set(newDishes.map((d) => d.id));
  for (const id of newImageIds) {
    const imgPath = `public/dishes/dish-${id}.jpg`;
    let s;
    try {
      s = await stat(imgPath);
    } catch (_) {
      err(imgPath, 0, `Bild fehlt: erwartet ${imgPath} fuer neues Rezept id=${id}.`);
      continue;
    }
    if (s.size > MAX_IMAGE_BYTES) {
      err(imgPath, 0, `Bild zu gross: ${Math.round(s.size / 1024)} kB, erlaubt max. ${Math.round(MAX_IMAGE_BYTES / 1024)} kB.`);
    }
    try {
      const meta = await sharp(imgPath).metadata();
      if (meta.format !== 'jpeg') {
        err(imgPath, 0, `Bild-Format ${meta.format} — erwartet JPEG.`);
      }
      if (Math.abs((meta.width || 0) - IMAGE_SIZE) > IMAGE_SIZE_TOL || Math.abs((meta.height || 0) - IMAGE_SIZE) > IMAGE_SIZE_TOL) {
        err(imgPath, 0, `Bild-Dimension ${meta.width}x${meta.height} — erwartet ${IMAGE_SIZE}x${IMAGE_SIZE} (Toleranz ±${IMAGE_SIZE_TOL}px).`);
      }
    } catch (e) {
      err(imgPath, 0, `Bild konnte nicht gelesen werden: ${e.message}`);
    }
  }

  // Zusaetzliche geaenderte Bilder (nicht zu neuen Dishes gehoerend) auch pruefen.
  for (const imgFile of changedImages) {
    const match = imgFile.match(/dish-(\d+)\.jpg$/);
    if (!match) continue;
    const id = Number(match[1]);
    if (newImageIds.has(id)) continue;   // schon oben gepruft
    // Fuer Update von bestehendem Bild: gleiche Regeln.
    try {
      const s = await stat(imgFile);
      if (s.size > MAX_IMAGE_BYTES) err(imgFile, 0, `Bild zu gross: ${Math.round(s.size / 1024)} kB.`);
      const meta = await sharp(imgFile).metadata();
      if (meta.format !== 'jpeg') err(imgFile, 0, `Bild-Format ${meta.format} — erwartet JPEG.`);
      if (Math.abs((meta.width || 0) - IMAGE_SIZE) > IMAGE_SIZE_TOL || Math.abs((meta.height || 0) - IMAGE_SIZE) > IMAGE_SIZE_TOL) {
        err(imgFile, 0, `Bild-Dimension ${meta.width}x${meta.height} — erwartet ${IMAGE_SIZE}x${IMAGE_SIZE}.`);
      }
    } catch (e) {
      err(imgFile, 0, `Bild konnte nicht gelesen werden: ${e.message}`);
    }
  }
```

- [ ] **Step 2: Tests für Bild-Checks ergänzen**

In `validate-recipe.test.mjs`, vor dem `if (failures > 0)`-Block einfügen:

```js
// -- Fall 7: fehlendes Bild fuer neues Dish -> exit 1
{
  const dir = makeRepo({
    mainDishes: { schemaVersion: 1, dishes: [] },
    mainIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'K', cat: 'x', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } } } },
    prDishes: { schemaVersion: 1, dishes: [{ id: 5, name: 'X', cuisine: 'Y', cuisineGroup: 'asian', cooktime: 10, kcal: 200, p: 10, kh: 20, f: 5, tags: [], ingredients: [{ key: 'karotte', grams: 100 }], steps: ['Kochen.'] }] },
    prIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'K', cat: 'x', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } } } },
    prImageIds: [],   // KEIN Bild
  });
  const res = runValidator(dir);
  check('Fall 7: fehlendes Bild -> exit 1', res.status === 1);
  check('Fall 7: Text erwaehnt Bild', res.stdout.includes('dish-5.jpg') || res.stdout.includes('Bild fehlt'), res.stdout);
}

// -- Fall 8: falsche Bild-Dimension (1x1 statt 800x800) -> exit 1
{
  const dir = makeRepo({
    mainDishes: { schemaVersion: 1, dishes: [] },
    mainIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'K', cat: 'x', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } } } },
    prDishes: { schemaVersion: 1, dishes: [{ id: 5, name: 'X', cuisine: 'Y', cuisineGroup: 'asian', cooktime: 10, kcal: 200, p: 10, kh: 20, f: 5, tags: [], ingredients: [{ key: 'karotte', grams: 100 }], steps: ['Kochen.'] }] },
    prIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'K', cat: 'x', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } } } },
    prImageIds: [5],   // 1x1 pixel jpeg aus dem Fixture
  });
  const res = runValidator(dir);
  check('Fall 8: falsche Bild-Dimension -> exit 1', res.status === 1, res.stdout);
  check('Fall 8: Text erwaehnt Dimension', res.stdout.includes('Dimension') || res.stdout.includes('800x800'), res.stdout);
}
```

- [ ] **Step 3: Test ausführen**

Run:
```bash
cd scripts && node validate-recipe.test.mjs
```
Expected: alle `OK`.

- [ ] **Step 4: Commit**

```bash
cd /Users/oliverwosnitza/Documents/Mahlzeit-App
git add scripts/validate-recipe.mjs scripts/validate-recipe.test.mjs
git commit -m "$(cat <<'EOF'
feat(scripts): bild-checks per sharp im validator

Fuer jedes neue Dish muss public/dishes/dish-<id>.jpg existieren:
- Dimension 800x800 (Toleranz +/-10px)
- Dateigroesse <= 400 kB
- Format JPEG

Zusaetzlich werden Aenderungen an bestehenden Bildern (im PR-Diff)
mit denselben Regeln geprueft.

Tests decken ab: Bild fehlt komplett -> exit 1, falsche Dimension
(1x1 statt 800x800) -> exit 1.
EOF
)"
```

---

### Task B.5: GitHub Workflow

**Files:**
- Create: `.github/workflows/pr-recipe-check.yml`

- [ ] **Step 1: Workflow-YAML schreiben**

```yaml
name: PR Recipe Check

on:
  pull_request:
    branches: [main]
    paths:
      - 'src/data/dishes.json'
      - 'src/data/ingredients.json'
      - 'public/dishes/*.jpg'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout PR
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install validator deps (scripts/)
        working-directory: scripts
        run: npm ci

      - name: Run validator
        id: validate
        continue-on-error: true
        run: |
          set -o pipefail
          node scripts/validate-recipe.mjs | tee validator-output.txt

      - name: Post comment if validator produced output
        if: steps.validate.outputs.exit-code != '0' || contains(hashFiles('validator-output.txt'), 'true')
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const out = fs.readFileSync('validator-output.txt', 'utf-8');
            const idx = out.indexOf('---COMMENT---');
            if (idx === -1) return;
            const body = out.slice(idx + '---COMMENT---'.length).trim();
            if (!body) return;
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body,
            });

      - name: Fail if validator failed
        if: steps.validate.outputs.exit-code != '0'
        run: exit 1
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/pr-recipe-check.yml
git commit -m "$(cat <<'EOF'
feat(ci): github action pruft rezept-prs automatisch

Workflow laeuft bei pull_request (nicht pull_request_target -
Sicherheit: sonst 'pwn request'-Luecke) auf main-Branch, wenn
dishes.json, ingredients.json oder Bilder geaendert wurden.

Installiert nur scripts/package.json (isoliert), ruft den Validator,
postet Kommentar mit Fehler/Warning-Details bei Bedarf, faellt am
Ende wenn validator exit != 0.
EOF
)"
```

---

### Task B.6: PR-Template + Issue-Template

**Files:**
- Create: `.github/pull_request_template.md`
- Create: `.github/ISSUE_TEMPLATE/recipe-suggestion.yml`

- [ ] **Step 1: PR-Template**

```markdown
## Neues Rezept — Checkliste

- [ ] JSON in `src/data/dishes.json` ergänzt (Schema: [`docs/recipe-schema.md`](../docs/recipe-schema.md))
- [ ] Bild als `public/dishes/dish-<id>.jpg` beigelegt (800×800, ≤ 400 kB, JPEG)
- [ ] Neue Zutaten in `src/data/ingredients.json` ergänzt (falls nötig)
- [ ] Vor dem Anlegen geprüft, dass Zutaten nicht bereits unter anderem Key existieren
- [ ] Nährwerte plausibel (kcal ≈ p·4 + kh·4 + f·9, Toleranz ± 100)
- [ ] Bild-Prompt aus [`docs/recipe-image-prompt.md`](../docs/recipe-image-prompt.md) genutzt
- [ ] `npm run build` läuft lokal ohne Fehler
- [ ] PR gegen `main`-Branch

## Kurzbeschreibung
<!-- Was ist das für ein Rezept? Woher stammt es? -->
```

- [ ] **Step 2: Issue-Template**

```yaml
name: Rezept-Vorschlag
description: Ein neues Rezept vorschlagen — Formular für User ohne Git-Kenntnisse.
title: "[Rezept-Vorschlag]: "
labels: ["recipe-suggestion"]
body:
  - type: input
    id: name
    attributes:
      label: Rezept-Name
      placeholder: "z. B. Butter Chicken mit Basmati"
    validations:
      required: true
  - type: dropdown
    id: cuisine
    attributes:
      label: Küche
      options:
        - mediterranean
        - asian
        - middleEast
        - americas
        - andere
    validations:
      required: true
  - type: textarea
    id: ingredients
    attributes:
      label: Zutaten
      description: Eine Zutat pro Zeile, mit ungefährer Menge pro Portion (z. B. "200 g Hähnchenbrust")
      placeholder: "200 g Hähnchenbrust\n80 g Basmati-Reis\n..."
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Zubereitungs-Schritte
      description: Ein Schritt pro Zeile
      placeholder: "Reis nach Packungsanweisung kochen.\nHähnchen würfeln...\n..."
    validations:
      required: true
  - type: textarea
    id: image
    attributes:
      label: Bild (optional)
      description: Falls du ein Bild hast, füge es dem Kommentar bei nach Erstellung des Issues.
```

- [ ] **Step 3: Commit**

```bash
git add .github/pull_request_template.md .github/ISSUE_TEMPLATE/recipe-suggestion.yml
git commit -m "$(cat <<'EOF'
feat(github): pr-template + issue-template fuer rezept-beitrag

PR-Template zeigt beim Oeffnen jedes PRs eine Checkliste (Schema-
Fields, Bild-Format, Sanity, PR gegen main). Verlinkt auf
recipe-schema.md und recipe-image-prompt.md.

Issue-Template als Formular fuer User ohne Git-Kenntnisse. Felder
Name, Kueche (Dropdown), Zutaten, Steps, optional Bild.
Uebernehmen ins JSON passiert manuell.
EOF
)"
```

---

### Task B.7: Schema-Doku

**Files:**
- Create: `docs/recipe-schema.md`

- [ ] **Step 1: `docs/recipe-schema.md` schreiben**

```markdown
# Rezept-Schema

Struktur eines Rezepts in [`src/data/dishes.json`](../src/data/dishes.json) und einer Zutat in [`src/data/ingredients.json`](../src/data/ingredients.json).

## Top-Level

Beide JSONs haben ein `schemaVersion: 1`-Feld direkt neben dem Daten-Array/Objekt. Muss zu den in der App eingebauten Konstanten passen. Bei Erhöhung: alle bestehenden Rezepte müssen zur neuen Version passen (Migrations-Layer im Code).

## Dish

| Feld | Typ | Pflicht | Erklärung |
|------|-----|---------|-----------|
| `id` | Number | ✓ | Eindeutig über alle Rezepte hinweg. Wird für Bild-Pfad, Assignment, Favoriten genutzt. Beim Anlegen: höchste bestehende ID + 1. |
| `name` | String | ✓ | Rezept-Titel wie in der App angezeigt. |
| `cuisine` | String | ✓ | Küche als Klartext (z. B. „Italienisch"). Wird als Filter-Chip angezeigt. |
| `cuisineGroup` | Enum | ✓ | Einer von: `mediterranean`, `asian`, `middleEast`, `americas`. Steuert die Küchen-Filter-Gruppierung. Erweiterung um `indian`, `european`, `german` etc. jederzeit möglich — dann muss die Konstante im Picker (`src/dish-picker/render.js`) und im Validator synchron erweitert werden. |
| `cooktime` | Number | ✓ | Kochzeit in Minuten (inkl. Vorbereitung). |
| `kcal` | Number | ✓ | Kalorien pro Portion (nicht pro 100 g). |
| `p` | Number | ✓ | Protein in Gramm pro Portion. |
| `kh` | Number | ✓ | Kohlenhydrate in Gramm pro Portion. |
| `f` | Number | ✓ | Fett in Gramm pro Portion. |
| `tags` | String[] | ✓ | Attribute für Filter und Warnhinweise. Bekannte Tags: `contains-meat`, `contains-fish`, `contains-lactose`, `contains-gluten`, `vegetarian`, `vegan`, `low-carb`, `high-protein`, `quick` (< 20 min), `few-ingredients` (≤ 7). Unbekannte Tags werden akzeptiert, wirken aber nicht auf Filter. |
| `ingredients` | Array | ✓ | Jede Zutat: `{ key, grams, note? }`. `key` muss in `src/data/ingredients.json` existieren. |
| `ingredients[].note` | String | – | Optionaler Zusatz, z. B. „TK-Packung à 400 g" oder „trocken abwiegen". |
| `steps` | String[] | ✓ | Zubereitungs-Schritte, Reihenfolge = Ausführungsreihenfolge. |
| `revision` | Number | – | **Zukunfts-Öffnung** — aktuell nicht ausgewertet. Kann in einer späteren App-Version genutzt werden, um Fixes an bereits ausgerollten Rezepten via Remote-Update zu erlauben. |

Das Bild liegt als eigenständige Datei unter `public/dishes/dish-<id>.jpg` (800×800, ≤ 400 kB, JPEG). Kein `image`-Feld im JSON.

## Ingredient

Struktur pro Eintrag in `ingredients.<key>`:

| Feld | Typ | Pflicht | Erklärung |
|------|-----|---------|-----------|
| `label` | String | ✓ | User-sichtbarer Name, deutsch. Konvention: Substantiv im Singular („Karotte"), Attribute mit Komma („Chili, frisch"). |
| `cat` | Enum | ✓ | Kategorie für Einkaufslisten-Sortierung. Werte: `frisch`, `kuehlung`, `tk`, `trocken`, `konserve`, `gewuerze`, `bakery`, `getraenke`, `sonstiges`. |
| `unit` | Enum | ✓ | Basis-Einheit: `g`, `ml`, `stueck`, `bund`. |
| `per100g` | Objekt | ✓ | Nährwerte pro 100 g / 100 ml / pro Stück: `{ kcal, p, kh, f }`. |
| `displayUnit` | String | – | Anzeige-Einheit wenn abweichend von `unit`, z. B. `el`, `tl`, `prise`. |
| `gramsPerUnit` | Number | – | Umrechnungsfaktor bei `displayUnit`: wie viele Gramm entsprechen einer Anzeige-Einheit (z. B. 1 EL Öl = 10 g). |
| `size` | Number | – | Durchschnittliche Größe pro Stück in Gramm bei `unit: "stueck"` (z. B. Chili ~ 6 g). |
| `note` | String | – | Zusatzinfo, die in der Einkaufsliste erscheint (z. B. „Becher à 500 g"). |

## Konventionen

- **Zutaten-Wiederverwendung (Guardrail 8):** Vor dem Anlegen einer Zutat immer prüfen, ob sie unter leicht anderem Namen bereits in `src/data/ingredients.json` existiert. Der Validator warnt bei 4-Zeichen-Prefix-Kollisionen, aber semantisch identische Namen (`aubergine` vs `eierpflanze`) müssen manuell erkannt werden.
- **Steps-Sprachstil:** Du-Ansprache, aktive Form, einheitlich „Min." (nicht „min"), Zeitspannen mit Halbgeviert „–" (Alt-Bindestrich), keine Anglizismen.
- **Portionen:** Nährwerte sind pro Portion, nicht pro 100 g. Eine Portion = Standard-Kochmenge für 1 Person (typisch 500–900 kcal).

## Validierung

Die GitHub Action [`pr-recipe-check.yml`](../.github/workflows/pr-recipe-check.yml) prüft PRs automatisch. Details unter [`CONTRIBUTING.md`](../CONTRIBUTING.md).
```

- [ ] **Step 2: Commit**

```bash
git add docs/recipe-schema.md
git commit -m "$(cat <<'EOF'
docs(recipe): schema-referenz fuer contributors

Extrahiert aus docs/redesign/recipe-import-template.md (dem
verworfenen File-Picker-Template) und angepasst auf den PR-basierten
Contribution-Workflow: kein newIngredients-Block mehr (Contributor
editiert direkt ingredients.json), kein image-Pfad im JSON (Bild
liegt als eigenstaendige Datei unter public/dishes/).

revision-Feld als Zukunfts-Oeffnung dokumentiert (aktuell nicht
ausgewertet).
EOF
)"
```

---

### Task B.8: Bild-Prompt-Doku

**Files:**
- Create: `docs/recipe-image-prompt.md`

- [ ] **Step 1: `docs/recipe-image-prompt.md` schreiben**

```markdown
# Rezept-Bild-Prompt

Alle Rezept-Bilder in der App folgen einem einheitlichen Foodblog-Stil (Vogelperspektive-nah, natürliches Licht, marmorner/heller Holzhintergrund, dezente Props). Damit Community-beigesteuerte Bilder sich einfügen, folgt der Prompt einem festen Rahmen — du füllst nur drei Platzhalter aus.

## Prompt-Rahmen (immer identisch)

```
Appetizing food photography of a [DISH NAME IN ENGLISH], [MAIN INGREDIENTS AND PREPARATION IN ENGLISH], garnished with [OPTIONAL GARNISH], in a [CONTAINER]. low three-quarter camera angle at approximately 30 degrees above horizontal — camera placed just above table height and tilted only slightly downward toward the front of the plate, the plate rim clearly visible as a pronounced elongated ellipse, food primarily seen from the side showing full vertical depth and layering of ingredients, only a small portion of the top surface visible — classic food-blog hero shot perspective (NOT top-down, NOT overhead, NOT bird's-eye, NOT flat lay), soft natural daylight, bright neutral background with light marble or light wood texture. Subtle props at the edges including a folded linen napkin and minimalist cutlery. Natural rich colors, subtle styling, clean food blog aesthetic, highly detailed --no top-down, overhead, flat lay, bird's eye view --ar 1:1
```

## Die drei Platzhalter

**`[DISH NAME IN ENGLISH]`** — englischer Rezeptname im Titel-Format.
Beispiele: „chicken skyr tikka masala", „shrimp zucchini pasta", „butter chicken with basmati rice".

**`[MAIN INGREDIENTS AND PREPARATION IN ENGLISH]`** — sichtbare Zutaten mit Zubereitungszustand.
Verben: `seared`, `roasted`, `grilled`, `steamed`, `sautéed`, `julienned`, `sprinkled with`, `drizzled with`, `crumbled`, `wilted`.
Beispiel: „seared chicken breast, fluffy basmati rice, sautéed spinach".

**`[CONTAINER]`** — passendes Gefäß:
- Bowls: `light ceramic bowl`, `shallow ceramic bowl`, `deep pasta bowl`
- Teller: `wide ceramic plate`, `rustic ceramic plate`
- Pfanne: `cast iron pan`, `paella pan`
- Brett: `wooden board`, `slate board`

## Beispiel (Referenz aus dem Katalog)

```
Appetizing food photography of a wild salmon bowl, seared wild salmon fillet, black rice, edamame beans, julienned carrots, thin cucumber slices, sprinkled with sesame seeds and sliced green spring onions, neatly arranged in a light ceramic bowl. [Stil-Rahmen unverändert wie oben]
```

## Ausgabe-Format

- **Ratio:** 1:1 (Quadrat)
- **Auflösung:** empfohlen ≥ 1024×1024, im PR auf 800×800 skalieren
- **Format:** JPEG (kleiner als PNG bei vergleichbarer Qualität)
- **Dateigröße:** ≤ 400 kB
- **Dateiname:** `dish-<id>.jpg` (`<id>` ist die neue Dish-ID)

## Modell-Hinweise

Der Prompt funktioniert mit **ChatGPT/DALL-E**, **Midjourney**, **Nano-Banana** und ähnlichen Diffusionsmodellen. Bei starken Abweichungen: die drei Platzhalter präziser fassen, den Rahmen nicht ändern.

Bei Midjourney: `--ar 1:1` und `--no top-down, overhead, flat lay, bird's eye view` sind schon enthalten.
```

- [ ] **Step 2: Commit**

```bash
git add docs/recipe-image-prompt.md
git commit -m "$(cat <<'EOF'
docs(recipe): image-prompt fuer konsistente rezept-bilder

Extrahiert aus docs/redesign/recipe-import-template.md. Erklaert
den drei-Platzhalter-Ansatz (Dish-Name, Zutaten/Zubereitung,
Container), zeigt Referenz-Beispiel, dokumentiert Ausgabe-Format
(1:1, 800x800, <=400kB JPEG). Modell-agnostisch.
EOF
)"
```

---

### Task B.9: CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: `CONTRIBUTING.md` schreiben**

```markdown
# Beitragen — Rezepte

Neue Rezepte sind willkommen. Zwei Wege:

## Mit Git (Pull Request)

1. **Fork** und einen Branch von `main` erstellen.
2. **Rezept** in `src/data/dishes.json` ergänzen (Schema-Referenz: [`docs/recipe-schema.md`](docs/recipe-schema.md)).
3. **Bild** als `public/dishes/dish-<neue-id>.jpg` beilegen (Prompt: [`docs/recipe-image-prompt.md`](docs/recipe-image-prompt.md)).
4. **Neue Zutaten** in `src/data/ingredients.json` ergänzen, falls das Rezept welche einführt. Vorher **immer** prüfen, ob eine bestehende Zutat wiederverwendet werden kann (Guardrail 8).
5. **PR gegen `main`** öffnen.

Beim Öffnen des PRs läuft die [`pr-recipe-check`-Action](.github/workflows/pr-recipe-check.yml) automatisch. Bei rotem Check: die Kommentare der Action anschauen und die genannten Punkte fixen.

Nach Merge landet das Rezept beim nächsten Repo-Update-Check der App bei allen Usern (dauert bis zu 24h automatisch, oder sofort per Settings > Rezepte > „Nach neuen Rezepten suchen").

## Ohne Git (Issue-Formular)

Issues → **New Issue → „Rezept-Vorschlag"** → Formular ausfüllen. Ich übernehme die Rezepte manuell in die Datenbank.

## Bild-Standard

- 1:1 (Quadrat), 800×800 px, JPEG, ≤ 400 kB
- Foodblog-Stil (natürliches Licht, heller Hintergrund, dezente Props)
- Prompt-Rahmen unter [`docs/recipe-image-prompt.md`](docs/recipe-image-prompt.md)

## Rechtliches

Rezepte und Bilder gehen mit dem PR ins Repo — bitte nur Inhalte einreichen, die du selbst besitzt oder freigegeben sind. Das Projekt ist ein privates Hobby-Projekt ohne Lizenz.
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "$(cat <<'EOF'
docs(contrib): contribution-guide fuer rezept-beitraege

Wird von GitHub am Contribute-Button des Repos angezeigt. Erklaert
beide Wege (PR mit Git, Issue-Formular ohne Git), verlinkt Schema-
und Bild-Prompt-Doku, weist auf die automatische Action-Pruefung
hin.
EOF
)"
```

---

### Task B.10: README-Update + Verworfen-Header im alten Template

**Files:**
- Modify: `README.md`
- Modify: `docs/redesign/recipe-import-template.md`

- [ ] **Step 1: „Rezepte hinzufügen"-Section in `README.md` umschreiben**

In `README.md`, den bestehenden Block ab `## Rezepte hinzufügen` bis vor `## Dokumentation` ersetzen durch:

```markdown
## Rezepte beisteuern

Neue Rezepte sind willkommen! Zwei Wege:

- **Mit Git:** Pull Request gegen `main`. Details in [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Ohne Git:** Issue via Formular (Issues → New Issue → „Rezept-Vorschlag").

Nach Merge landet das Rezept beim nächsten Repo-Update-Check der App automatisch bei allen Usern.

Bild-Standard und JSON-Schema:

- Bild-Prompt: [`docs/recipe-image-prompt.md`](docs/recipe-image-prompt.md)
- Rezept-Schema: [`docs/recipe-schema.md`](docs/recipe-schema.md)
```

- [ ] **Step 2: Verworfen-Header in altem Template**

In `docs/redesign/recipe-import-template.md`, ganz am Anfang der Datei (vor `# Rezept-Import-Template`) einfügen:

```markdown
> ⚠️ **Verworfen** — dieses Template war für den File-Picker-Import-Ansatz gedacht (siehe [`backlog.md`](backlog.md) → „Rezept-Import (File-Picker) — verworfen").
>
> Für aktuelle Contribution:
> - Schema-Referenz: [`docs/recipe-schema.md`](../recipe-schema.md)
> - Bild-Prompt: [`docs/recipe-image-prompt.md`](../recipe-image-prompt.md)
> - Contribution-Guide: [`CONTRIBUTING.md`](../../CONTRIBUTING.md)

---

```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/redesign/recipe-import-template.md
git commit -m "$(cat <<'EOF'
docs: readme rezepte-beitragen-section + verworfen-header

README zeigt jetzt die neue Rezepte-beisteuern-Section (PR-Weg +
Issue-Formular, verlinkt auf CONTRIBUTING/Schema/Bild-Prompt).
Der alte In-App-Edit-Workflow entfaellt — Rezepte kommen ueber
den Repo-Weg zu den Usern.

Das verworfene File-Picker-Template unter docs/redesign/recipe-
import-template.md bekommt einen Verworfen-Header mit Redirect
auf die neuen Doku-Dateien. Datei bleibt sonst inhaltlich
erhalten (Backlog verlinkt drauf).
EOF
)"
```

---

## Phase C — Live-Test + Release

### Task C.1: Dev-Server-Test

**Files:** (keine Änderungen)

- [ ] **Step 1: Dev-Server starten**

Run:
```bash
npm run dev
```

- [ ] **Step 2: Test-Checkliste manuell durchgehen**

Im Browser (Chrome DevTools offen):

**Auto-Check:**
- DevTools → Console → `localStorage.removeItem('mahlzeit-state-v2')` → Reload
- Network-Tab: nach dem Reload sollten zwei GET-Requests gegen `raw.githubusercontent.com/…/main/src/data/{dishes,ingredients}.json` sichtbar sein
- Wenn beide 200 OK und Content plausibel: kein Badge (nichts Neues, weil bundled = remote gleich sind)

**Badge forcieren:**
- Console: `state.remoteHasUpdates = true; refresh()` → Badge muss am Burger-Icon erscheinen
- Burger klicken → Badge weg

**Update-Sheet — „alles aktuell":**
- Console: `state.remoteLastFetchAt = null` (Rate-Limit zurücksetzen)
- Settings → „Nach neuen Rezepten suchen" → Sheet „Ich prüfe…" → Toast „Deine Rezepte sind aktuell." erscheint

**Update-Sheet — „neue verfügbar":**
- Voraussetzung: irgendeine ID in `state.remoteDishes` löschen damit sie „neu" erscheint. Console:
```js
state.remoteDishes = state.remoteDishes.filter((d) => d.id !== 42);
state.remoteLastFetchAt = null;
```
- (Bzw. wenn nichts importiert wurde: einfach beim ersten Import-Klick sollten alle Remote-only-Rezepte als „neu" erscheinen — falls das Repo mehr Rezepte hat als bundled.)

**Rate-Limit:**
- Zweiter Klick binnen 60s auf „Nach neuen Rezepten suchen" → Toast „Bereits gerade geprüft, keine neuen Rezepte."

**Fehler-Sheet „Keine Verbindung":**
- DevTools → Network → Offline aktivieren
- Console: `state.remoteLastFetchAt = null`
- Settings → Update-Button → Fehler-Sheet mit „Keine Verbindung — versuch es später erneut."

**Missing-Ingredient-Warnung:**
- Skip in Dev — schwer zu simulieren ohne Test-Repo. Wird in Beta-Test-Runde (Task C.2) mit Dummy-PR abgedeckt.

- [ ] **Step 3: Dev-Server stoppen mit Ctrl+C**

- [ ] **Step 4: Kein Commit** (nur manueller Test)

---

### Task C.2: Beta-APK-Test

**Files:** (keine Änderungen — Build + Install-Runde)

- [ ] **Step 1: Version-Bump in `android/app/build.gradle`**

Suche `versionCode` und `versionName`. Neue Werte:
- `versionCode 4`
- `versionName "1.3"`

- [ ] **Step 2: Build + Cap Sync**

Run:
```bash
npm run build && npx cap sync
```
Expected: kein Fehler.

- [ ] **Step 3: Debug-APK bauen** (mit expliziter Freigabe)

**FRAGE AN USER:** „Soll ich jetzt die Beta-Debug-APK bauen? (`cd android && ... assembleDebug`)"

Nur bauen wenn User zustimmt (Memory-Guardrail).

- [ ] **Step 4: APK installieren + Test-Runde**

- APK auf Test-Gerät installieren
- App starten → Auto-Check läuft → wenn neue Rezepte da: Badge erscheint
- Settings → „Rezepte" → „Nach neuen Rezepten suchen" → Update-Sheet
- Nach Import: Rezepte im Dashboard/Picker sichtbar, Bilder progressive
- App-Neustart: Rezepte + Bilder persistieren
- Android-Settings → App-Daten löschen → App-Neustart → Auto-Check baut alles neu auf

- [ ] **Step 5: Commit Version-Bump**

```bash
git add android/app/build.gradle
git commit -m "$(cat <<'EOF'
chore(android): version-bump 1.3 (versioncode 4)

Beta-APK fuer Session-21-Feature (rezept-import end-to-end).
EOF
)"
```

---

### Task C.3: Dummy-PR-Test der Action

**Files:** (temporär im Fork oder Test-Branch)

- [ ] **Step 1: Fork oder Test-Branch anlegen**

- Einen Test-Branch aufmachen, z.B. `pr-test-dummy` (oder Fork nutzen).
- Ein Dummy-Rezept mit absichtlichen Fehlern reinlegen: falsche `cuisineGroup`, falscher `kcal`, ohne Bild.

- [ ] **Step 2: PR gegen `main` öffnen**

- Action muss rot werden.
- Action-Kommentar am PR muss die drei Fehler auflisten.

- [ ] **Step 3: Dummy-Rezept reparieren**

- Legale Werte + Bild ergänzen (echtes 800×800 JPEG).
- Action muss grün werden.

- [ ] **Step 4: PR schließen** (ohne Merge)

- Test-Branch löschen.

- [ ] **Step 5: Kein Commit** (nur Test)

---

### Task C.4: Merge beta → main + Stable-Release

- [ ] **Step 1: Merge nach beta**

```bash
git checkout beta
git merge multiuser
git push origin beta
```

**FRAGE AN USER:** „Beta ist gemerged. Soll ich weiter nach main mergen und die Stable-APK bauen?"

- [ ] **Step 2: Nach Zustimmung: Merge nach main**

```bash
git checkout main
git merge beta
git push origin main
```

- [ ] **Step 3: Stable-APK bauen** (nach Freigabe)

```bash
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk app/build/outputs/apk/debug/mahlzeit-1.3.apk
```

- [ ] **Step 4: Alle Backlog-Einträge als „erledigt" markieren**

In `docs/redesign/backlog.md`:
- „Rezepte aus GitHub-Repo aktualisieren" → mit `**Umgesetzt in Session 21** (1.3)` markieren
- „Community-Rezepte per GitHub Pull Request" → analog

- [ ] **Step 5: Commit Backlog-Update**

```bash
git add docs/redesign/backlog.md
git commit -m "$(cat <<'EOF'
docs(backlog): rezept-import umgesetzt in session 21 (1.3)

Beide Backlog-Eintraege (Konsum-Pfad + Contribution-Pfad) markiert
als umgesetzt. Details im Design-Doc:
docs/redesign/2026-07-27-rezept-import-design.md
EOF
)"
```

- [ ] **Step 6: Handoff-Doc für Session 22**

Nach Bedarf ein neues Handoff-Doc schreiben (`docs/redesign/handoffs/session-21-to-22.md`), das die Umsetzung und offene Punkte (UI-Position „Neu"-Marker, ggf. Enum-Erweiterung) für die nächste Session dokumentiert.
