# Profil teilen / importieren — Implementierungs-Plan

> **Für ausführende Agenten:** Diese Datei nutzt Checkbox-Syntax (`- [ ]`) für Tracking. Etappen sind grob 30–90 min groß. Commit-Marker sind gesetzt. TDD ist NICHT der Standard-Pfad (Guardrail 10: keine Tests) — für `payload.js` gibt es eine Node-Simulation, alles UI-seitige wird manuell im Browser + APK getestet.

**Goal:** Ein Profil aus `state.settings.profiles[i]` als kompaktes JSON verpacken und über Android-Share-Sheet, QR-Code und Copy-Paste teilen/empfangen. QR-Scan zusätzlich als Onboarding-Alternative im Wizard-Welcome und beim Anlegen von Person n+1.

**Architecture:** Neues Modul-Cluster unter `src/profile-share/` (payload, share-sheet, import-sheet, scanner, qr) plus `src/util/toast.js`. `state.addProfile()` bleibt der einzige Import-Sink — keine State-Struktur-Änderung, keine Migration. Alle Design-Entscheidungen sind in `docs/redesign/2026-07-27-profil-teilen-import-design.md` festgehalten und im Plan referenziert.

**Tech Stack:** Vanilla ES-Module, Vite, Capacitor 8. Neue Deps: `@capacitor/share@^8`, `@capacitor-mlkit/barcode-scanning@^8`, `qrcode@^1`.

**Referenz-Design:** `docs/redesign/2026-07-27-profil-teilen-import-design.md` — für Enum-Werte, Fehler-Codes, Payload-Format, Toast-Texte gilt das Design-Doc als Wahrheit.

---

## File-Struktur (Übersicht)

### Neu zu erstellen

| Pfad | Aufgabe |
|---|---|
| `src/profile-share/payload.js` | Encode / Decode / Sanitize + Version-Guard + Enum-Validation |
| `src/profile-share/payload.test.mjs` | Node-Simulation gegen `payload.js` (Round-Trip + Fehlerfälle) |
| `src/profile-share/qr.js` | Wrapper um `qrcode` npm — rendert Canvas |
| `src/profile-share/scanner.js` | Wrapper um `@capacitor-mlkit/barcode-scanning` mit Permission-Handling |
| `src/profile-share/share-sheet.js` | Export-Sheet: QR + Share-Button + Copy-Button |
| `src/profile-share/import-sheet.js` | Import-Sheet: Scanner + Text-Paste + Toast-Feedback |
| `src/profile-share/welcome-screen.js` | Wiederverwendbarer Welcome-Screen für Wizard + Sub-Wizard |
| `src/profile-share/add-choice-sheet.js` | Auswahl-Sheet für Settings „+ Profil hinzufügen" (Manuell / QR / Text) |
| `src/util/toast.js` | Snackbar-Helper (`showToast(text, opts?)`) |
| `styles/components/profile-share-sheet.css` | Styles für Export + Import + Welcome + Add-Choice-Sheets |
| `styles/components/toast.css` | Toast/Snackbar-Styles |

### Zu modifizieren

| Pfad | Änderung |
|---|---|
| `src/settings/profile-detail-sheet.js` | „Profil teilen"-Button oberhalb „Löschen", ausgeblendet für `_default` |
| `src/settings/render.js` | „+ Profil hinzufügen"-Button öffnet `add-choice-sheet` statt direkt Wizard |
| `src/onboarding/wizard.js` | `showWelcome`-Flag, Welcome-Screen-Rendering in `renderStepContent()`, Erst-Welcome in `openOnboardingWizard()`, Sub-Wizard-Welcome in `startSubProfileWizard()` |
| `src/main.js` | Mount für Share-Sheet, Import-Sheet, Add-Choice-Sheet, Toast; DOM-Container in `index.html` referenzieren |
| `index.html` | Neue `<div>`-Container für die neuen Sheets + Toast; zwei neue `<link>`-Zeilen für CSS |
| `package.json` | 3 neue Dependencies |

---

## Etappe 1: Payload-Modul (isolierte Logik)

**Ziel:** `encodeProfile()` + `decodeProfile()` mit Version-Guard, Favoriten-Cap, Enum-Validation, Sanitizer. Node-Simulation als sichere Basis vor UI-Arbeit.

**Files:**
- Create: `src/profile-share/payload.js`
- Create: `src/profile-share/payload.test.mjs`

### Task 1.1: Payload-Modul-Grundgerüst

- [ ] **Schritt 1: Datei anlegen** `src/profile-share/payload.js` mit folgendem Inhalt:

```js
// Serialisierung / Deserialisierung Profil <-> Wire-Format fuer Teilen/Import.
// Details: docs/redesign/2026-07-27-profil-teilen-import-design.md

const WIRE_TYPE = 'mahlzeit-profile';
const WIRE_VERSION = 1;
const FAVORITES_CAP = 15;
const MAX_PAYLOAD_BYTES = 20 * 1024;

const VALID_GENDER = new Set(['male', 'female']);
const VALID_ACTIVITY = new Set([1, 2, 3, 4, 5]);
const VALID_GOAL = new Set(['maintain', 'lose', 'gain']);
const VALID_MACRO_PRESET = new Set(['balanced', 'protein', 'lowcarb', 'lowfat']);
const VALID_PREFS = ['meat', 'fish', 'vegetarian'];
const VALID_CUISINES = ['asian', 'mediterranean', 'middleEast', 'americas'];

// Base64 isomorph (Browser: btoa/atob; Node fuer Tests: Buffer).
function toBase64(str) {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
  return Buffer.from(str, 'utf8').toString('base64');
}
function fromBase64(str) {
  if (typeof atob === 'function') return decodeURIComponent(escape(atob(str)));
  return Buffer.from(str, 'base64').toString('utf8');
}

export function encodeProfile(profile) {
  const favEntries = Object.entries(profile.favorites || {}).filter(([, v]) => v === true);
  const favoritesTotal = favEntries.length;
  const shared = favEntries.slice(0, FAVORITES_CAP);
  const favorites = Object.fromEntries(shared);
  const wire = {
    type: WIRE_TYPE,
    version: WIRE_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      name: profile.name ?? null,
      gender: profile.gender ?? null,
      age: profile.age ?? null,
      heightCm: profile.heightCm ?? null,
      weightKg: profile.weightKg ?? null,
      activityLevel: profile.activityLevel ?? null,
      goal: profile.goal ?? null,
      dailyTargetOverride: profile.dailyTargetOverride ?? null,
      breakfastKcal: profile.breakfastKcal ?? null,
      lunchKcal: profile.lunchKcal ?? null,
      showCalorieBar: profile.showCalorieBar !== false,
      macroPreset: profile.macroPreset ?? 'balanced',
      macroTargets: profile.macroTargets ?? null,
      preferences: {
        meat: !!profile.preferences?.meat,
        fish: !!profile.preferences?.fish,
        vegetarian: !!profile.preferences?.vegetarian,
      },
      cuisines: {
        asian: !!profile.cuisines?.asian,
        mediterranean: !!profile.cuisines?.mediterranean,
        middleEast: !!profile.cuisines?.middleEast,
        americas: !!profile.cuisines?.americas,
      },
      favorites,
    },
  };
  const text = toBase64(JSON.stringify(wire));
  return { text, meta: { favoritesTotal, favoritesShared: shared.length } };
}

export function decodeProfile(input, { knownDishIds } = {}) {
  if (typeof input !== 'string') return { error: 'PARSE_ERROR', detail: 'input not string' };
  if (input.length > MAX_PAYLOAD_BYTES) return { error: 'TOO_LARGE', detail: `${input.length} bytes` };
  let json;
  try {
    // Auto-detect: entweder Base64 (Standard) oder direkt JSON (Legacy/Debug).
    const trimmed = input.trim();
    const raw = trimmed.startsWith('{') ? trimmed : fromBase64(trimmed);
    json = JSON.parse(raw);
  } catch (e) {
    return { error: 'PARSE_ERROR', detail: String(e && e.message || e) };
  }
  if (!json || json.type !== WIRE_TYPE) return { error: 'BAD_TYPE', detail: `type=${json?.type}` };
  if (json.version !== WIRE_VERSION) return { error: 'BAD_VERSION', detail: `version=${json.version}` };
  const p = json.profile;
  if (!p || typeof p !== 'object') return { error: 'INVALID_FIELD', detail: 'profile missing' };

  // Enum-Validation. null erlaubt fuer Wizard-Felder (User war noch nie im Wizard).
  const enumErr = validateEnums(p);
  if (enumErr) return { error: 'INVALID_FIELD', detail: enumErr };

  // Sanitize: unbekannte favorites-Keys entfernen, wenn knownDishIds bekannt.
  const filteredFavorites = {};
  let skipped = 0;
  const knownSet = knownDishIds ? new Set(knownDishIds.map(String)) : null;
  for (const [dishId, on] of Object.entries(p.favorites || {})) {
    if (on !== true) continue;
    if (knownSet && !knownSet.has(String(dishId))) { skipped++; continue; }
    filteredFavorites[dishId] = true;
  }

  const sanitized = {
    name: typeof p.name === 'string' ? p.name : null,
    gender: p.gender ?? null,
    age: typeof p.age === 'number' ? p.age : null,
    heightCm: typeof p.heightCm === 'number' ? p.heightCm : null,
    weightKg: typeof p.weightKg === 'number' ? p.weightKg : null,
    activityLevel: typeof p.activityLevel === 'number' ? p.activityLevel : null,
    goal: p.goal ?? null,
    dailyTargetOverride: typeof p.dailyTargetOverride === 'number' ? p.dailyTargetOverride : null,
    breakfastKcal: typeof p.breakfastKcal === 'number' ? p.breakfastKcal : null,
    lunchKcal: typeof p.lunchKcal === 'number' ? p.lunchKcal : null,
    showCalorieBar: p.showCalorieBar !== false,
    macroPreset: p.macroPreset ?? 'balanced',
    macroTargets: p.macroTargets && typeof p.macroTargets === 'object' ? p.macroTargets : null,
    preferences: {
      meat: !!p.preferences?.meat,
      fish: !!p.preferences?.fish,
      vegetarian: !!p.preferences?.vegetarian,
    },
    cuisines: {
      asian: !!p.cuisines?.asian,
      mediterranean: !!p.cuisines?.mediterranean,
      middleEast: !!p.cuisines?.middleEast,
      americas: !!p.cuisines?.americas,
    },
    favorites: filteredFavorites,
  };
  return { profile: sanitized, meta: { favoritesSkipped: skipped } };
}

function validateEnums(p) {
  if (p.gender != null && !VALID_GENDER.has(p.gender)) return `gender=${p.gender}`;
  if (p.activityLevel != null && !VALID_ACTIVITY.has(p.activityLevel)) return `activityLevel=${p.activityLevel}`;
  if (p.goal != null && !VALID_GOAL.has(p.goal)) return `goal=${p.goal}`;
  if (p.macroPreset != null && !VALID_MACRO_PRESET.has(p.macroPreset)) return `macroPreset=${p.macroPreset}`;
  return null;
}
```

- [ ] **Schritt 2: `macroPreset`-Enum verifizieren** — Öffne `src/nutrition/target.js` und suche nach `macroPreset ===` und `MACRO_PRESETS`. Passe die `VALID_MACRO_PRESET`-Menge oben so an, dass sie exakt zu den im Projekt existierenden Presets passt. Falls Namen abweichen: `VALID_MACRO_PRESET`-Zeile aktualisieren.

**Erwartete Verifikations-Befehle:**
```bash
grep -n "macroPreset ===\|MACRO_PRESETS\|const PRESETS" src/nutrition/target.js src/nutrition/*.js
```

### Task 1.2: Node-Simulation für Payload-Modul

- [ ] **Schritt 1: Datei anlegen** `src/profile-share/payload.test.mjs`:

```js
// Manuelle Sanity-Simulation fuer payload.js. Guardrail 10: keine Framework-
// Tests, nur ausfuehrbares Node-Script. Aufruf: `node src/profile-share/payload.test.mjs`.
// Exit-Code != 0 bei Fehler.

import { encodeProfile, decodeProfile } from './payload.js';

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log('  OK  ', name);
  } else {
    failures++;
    console.error('  FAIL', name, detail ? `-> ${detail}` : '');
  }
}

// -- Round-Trip mit voll ausgefuelltem Profil --
const source = {
  id: 'u1', // wird beim Encode ignoriert
  name: 'Oliver',
  gender: 'male',
  age: 38,
  heightCm: 180,
  weightKg: 78,
  activityLevel: 3,
  goal: 'maintain',
  dailyTargetOverride: 2200,
  breakfastKcal: 550,
  lunchKcal: 770,
  showCalorieBar: true,
  macroPreset: 'balanced',
  macroTargets: null,
  preferences: { meat: true, fish: true, vegetarian: false },
  cuisines: { asian: true, mediterranean: false, middleEast: false, americas: false },
  favorites: { '3': true, '12': true },
};

const { text, meta } = encodeProfile(source);
check('encode: text vorhanden', typeof text === 'string' && text.length > 0);
check('encode: favoritesShared = 2', meta.favoritesShared === 2);
check('encode: favoritesTotal = 2', meta.favoritesTotal === 2);

const decoded = decodeProfile(text, { knownDishIds: [3, 12, 99] });
check('decode: kein Fehler', !decoded.error, decoded.error);
check('decode: name uebernommen', decoded.profile?.name === 'Oliver');
check('decode: id NICHT drin', !('id' in (decoded.profile || {})));
check('decode: gender male', decoded.profile?.gender === 'male');
check('decode: favorites 2 vorhanden', Object.keys(decoded.profile?.favorites || {}).length === 2);
check('decode: skipped = 0', decoded.meta?.favoritesSkipped === 0);

// -- Favoriten-Filter (unbekannte IDs) --
const decodedFiltered = decodeProfile(text, { knownDishIds: [3] });
check('filter: nur bekannte Favoriten', Object.keys(decodedFiltered.profile.favorites).length === 1);
check('filter: skipped = 1', decodedFiltered.meta.favoritesSkipped === 1);

// -- Favoriten-Cap 15 --
const many = {};
for (let i = 1; i <= 30; i++) many[String(i)] = true;
const bigSource = { ...source, favorites: many };
const bigEnc = encodeProfile(bigSource);
check('cap: shared = 15', bigEnc.meta.favoritesShared === 15);
check('cap: total = 30', bigEnc.meta.favoritesTotal === 30);
const bigDec = decodeProfile(bigEnc.text);
check('cap: decoded hat 15 Favoriten', Object.keys(bigDec.profile.favorites).length === 15);

// -- Fehlerfaelle --
const err1 = decodeProfile('not-base64-@@@');
check('err: PARSE_ERROR bei Muell', err1.error === 'PARSE_ERROR', err1.error);

const err2 = decodeProfile(Buffer.from(JSON.stringify({ type: 'foo', version: 1, profile: {} }), 'utf8').toString('base64'));
check('err: BAD_TYPE bei falschem Typ', err2.error === 'BAD_TYPE', err2.error);

const err3 = decodeProfile(Buffer.from(JSON.stringify({ type: 'mahlzeit-profile', version: 99, profile: {} }), 'utf8').toString('base64'));
check('err: BAD_VERSION bei alter/neuer Version', err3.error === 'BAD_VERSION', err3.error);

const err4 = decodeProfile(Buffer.from(JSON.stringify({
  type: 'mahlzeit-profile', version: 1,
  profile: { gender: 'martian' },
}), 'utf8').toString('base64'));
check('err: INVALID_FIELD bei ungueltigem gender', err4.error === 'INVALID_FIELD', err4.error);

const err5 = decodeProfile('A'.repeat(21 * 1024));
check('err: TOO_LARGE bei > 20 KB', err5.error === 'TOO_LARGE', err5.error);

// -- Legacy: JSON direkt statt Base64 (Debug-Modus) --
const jsonInput = JSON.stringify({
  type: 'mahlzeit-profile', version: 1, exportedAt: 'x',
  profile: { ...source, id: undefined },
});
const jsonDec = decodeProfile(jsonInput);
check('legacy: JSON direkt akzeptiert', !jsonDec.error, jsonDec.error);

// -- Payload ohne Name --
const nameless = { ...source, name: null };
const namelessEnc = encodeProfile(nameless);
const namelessDec = decodeProfile(namelessEnc.text);
check('null-name: decoded name = null', namelessDec.profile.name === null);

if (failures > 0) {
  console.error(`\n${failures} Test(s) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle Payload-Tests OK.');
```

- [ ] **Schritt 2: Simulation ausführen**

```bash
node src/profile-share/payload.test.mjs
```

Erwartet: 20+ Zeilen `OK`, letzte Zeile `Alle Payload-Tests OK.`. Bei `FAIL` → Fehlermeldung anschauen, `payload.js` korrigieren, wieder ausführen.

- [ ] **Schritt 3: Commit**

```bash
git add src/profile-share/payload.js src/profile-share/payload.test.mjs
git commit -m "feat(profile-share): payload encode/decode + node-sim"
```

---

## Etappe 2: Toast-Helper

**Ziel:** Wiederverwendbarer Snackbar-Helper `showToast(text, opts?)`. Wird von Etappe 4 (Copy-Feedback) und Etappe 5 (Import-Bestätigung) genutzt.

**Files:**
- Create: `src/util/toast.js`
- Create: `styles/components/toast.css`
- Modify: `index.html` — neuer `<link>` + `<div id="toast-root">`
- Modify: `src/main.js` — Import (Nebenwirkung: `toast.js` mountet Root beim ersten Aufruf, kein Extra-Mount nötig)

### Task 2.1: Toast-Modul

- [ ] **Schritt 1: `src/util/toast.js` anlegen:**

```js
// Kleiner Snackbar-Helper. Rendert am unteren Rand des Viewports, blendet
// automatisch nach `duration` aus. Kein Queue-System (Solo-App-Scope: mehrere
// Toasts zeitgleich kommen praktisch nicht vor); neuer Toast ersetzt alten.

let rootEl = null;
let hideTimer = null;

function ensureRoot() {
  if (rootEl && document.body.contains(rootEl)) return rootEl;
  rootEl = document.getElementById('toast-root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'toast-root';
    document.body.appendChild(rootEl);
  }
  return rootEl;
}

export function showToast(text, { duration = 2500, tone = 'default' } = {}) {
  const root = ensureRoot();
  root.innerHTML = '';
  const el = document.createElement('div');
  el.className = `toast toast--${tone}`;
  el.setAttribute('role', 'status');
  el.textContent = text;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => { if (el.parentNode === root) root.removeChild(el); }, 250);
  }, duration);
}
```

- [ ] **Schritt 2: `styles/components/toast.css` anlegen:**

```css
#toast-root {
  position: fixed;
  bottom: max(24px, env(safe-area-inset-bottom, 24px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 3000;
  pointer-events: none;
}
.toast {
  background: var(--md-sys-color-inverse-surface, #303030);
  color: var(--md-sys-color-inverse-on-surface, #fff);
  padding: 12px 20px;
  border-radius: 24px;
  font-size: 14px;
  line-height: 1.35;
  box-shadow: 0 8px 20px rgba(0,0,0,.25);
  opacity: 0;
  transform: translateY(12px);
  transition: opacity .2s ease, transform .2s ease;
  max-width: min(92vw, 480px);
  text-align: center;
  pointer-events: auto;
}
.toast.is-visible {
  opacity: 1;
  transform: translateY(0);
}
.toast--error {
  background: var(--md-sys-color-error, #b3261e);
  color: var(--md-sys-color-on-error, #fff);
}
```

- [ ] **Schritt 3: `index.html` erweitern** — nach der letzten `<link>`-Zeile (aktuell `profile-detail-sheet.css` / `onboarding-wizard.css`, siehe Zeilen ~42–45) einfügen:

```html
  <link rel="stylesheet" href="/styles/components/toast.css" />
  <link rel="stylesheet" href="/styles/components/profile-share-sheet.css" />
```

(Der zweite Link ist für Etappe 4 — jetzt schon rein, spart doppelte Änderung.)

- [ ] **Schritt 4: Sanity-Check im Browser** — `npm run dev`, dann in DevTools-Konsole:

```js
import('/src/util/toast.js').then(m => m.showToast('Hallo Welt'))
```

Erwartet: Snackbar erscheint unten Mitte, verschwindet nach ~2,5 s.

- [ ] **Schritt 5: Commit**

```bash
git add src/util/toast.js styles/components/toast.css index.html
git commit -m "feat(util): toast/snackbar helper"
```

---

## Etappe 3: NPM-Dependencies installieren

**Ziel:** Alle drei Deps installieren und Capacitor-Sync ausführen, damit Android-Manifest die Kamera-Permission mitbekommt.

- [ ] **Schritt 1: Deps installieren**

```bash
npm install @capacitor/share@^8 @capacitor-mlkit/barcode-scanning qrcode
```

Hinweis: `@capacitor-mlkit/barcode-scanning` hat kein `^8`-Pin — nimm die neueste stabile Major-Version. Nach dem Install `npm ls @capacitor-mlkit/barcode-scanning` ausführen und die installierte Version im nächsten Commit-Text notieren.

- [ ] **Schritt 2: `npx cap sync android`**

```bash
npm run build && npx cap sync android
```

Erwartet: Ausgabe listet die drei neuen Plugins (`@capacitor/share`, `@capacitor-mlkit/barcode-scanning`) unter „Sync finished". `qrcode` ist Web-only und taucht nicht auf.

- [ ] **Schritt 3: Android-Manifest prüfen** — Datei `android/app/src/main/AndroidManifest.xml` öffnen und sicherstellen dass die Camera-Permission drin ist:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

Wenn nicht vorhanden: MLKit-Plugin sollte sie automatisch via `AndroidManifest`-Merger einfügen. Falls sie nach `cap sync` fehlt, im `<manifest>`-Element manuell ergänzen (vor `<application>`).

- [ ] **Schritt 4: Commit**

```bash
git add package.json package-lock.json android/
git commit -m "chore(deps): @capacitor/share + mlkit barcode-scanning + qrcode"
```

---

## Etappe 4: QR-Generator + Export-Sheet

**Ziel:** „Profil teilen"-Button im Profil-Detail-Sheet öffnet ein Sub-Sheet mit QR-Canvas, „Teilen" (Share-API), „In Zwischenablage" (Clipboard), Favoriten-Hinweis.

**Files:**
- Create: `src/profile-share/qr.js`
- Create: `src/profile-share/share-sheet.js`
- Create: `styles/components/profile-share-sheet.css` (wurde in Etappe 2 bereits verlinkt)
- Modify: `src/settings/profile-detail-sheet.js` — Button + Handler
- Modify: `src/main.js` — Share-Sheet mounten
- Modify: `index.html` — Container-Div für Share-Sheet

### Task 4.1: QR-Wrapper

- [ ] **Schritt 1: `src/profile-share/qr.js` anlegen:**

```js
// Wrapper um qrcode-lib. Wir nutzen `toCanvas` weil das ohne Base64-Bild-URL
// direkt aufs Canvas rendert (schneller, weniger Zwischenschritte).
import QRCode from 'qrcode';

export async function renderQrToCanvas(canvasEl, text, { size = 240 } = {}) {
  try {
    await QRCode.toCanvas(canvasEl, text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}
```

### Task 4.2: Share-Sheet-Modul

- [ ] **Schritt 1: `src/profile-share/share-sheet.js` anlegen:**

```js
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { encodeProfile } from './payload.js';
import { renderQrToCanvas } from './qr.js';
import { showToast } from '../util/toast.js';

let rootEl = null;
let isOpen = false;
const TRANSITION_MS = 200;

export function mountProfileShareSheet(el) {
  rootEl = el;
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export async function openProfileShareSheet(profile) {
  if (!rootEl) throw new Error('Share-Sheet nicht gemountet.');
  const { text, meta } = encodeProfile(profile);
  const displayName = profile.name || 'Profil';
  const favHint = renderFavHint(meta);
  rootEl.innerHTML = `
    <div class="share-sheet-overlay" data-role="backdrop">
      <div class="share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-sheet-title">
        <div class="share-sheet__handle" aria-hidden="true"></div>
        <div class="share-sheet__header">
          <h2 class="share-sheet__title" id="share-sheet-title">Profil teilen</h2>
          <button class="share-sheet__close" type="button" data-action="close" aria-label="Schließen">✕</button>
        </div>
        <div class="share-sheet__body">
          <p class="share-sheet__desc">„${escapeHtml(displayName)}" als QR oder Text weitergeben — dein Partner kann es in Mahlzeit importieren.</p>
          <div class="share-sheet__qr-wrap">
            <canvas class="share-sheet__qr" data-role="qr" width="240" height="240" aria-label="QR-Code des Profils"></canvas>
          </div>
          ${favHint}
          <div class="share-sheet__actions">
            <button class="btn btn--primary share-sheet__btn" type="button" data-action="share">Teilen</button>
            <button class="btn btn--secondary share-sheet__btn" type="button" data-action="copy">In Zwischenablage</button>
          </div>
          <textarea class="share-sheet__fallback" data-role="fallback" hidden readonly>${escapeHtml(text)}</textarea>
        </div>
      </div>
    </div>
  `;
  rootEl.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      isOpen = true;
      rootEl.querySelector('.share-sheet-overlay')?.classList.add('is-open');
    });
  });
  attachHandlers(text);
  const canvas = rootEl.querySelector('[data-role="qr"]');
  const qrResult = await renderQrToCanvas(canvas, text, { size: 240 });
  if (!qrResult.ok) {
    const wrap = rootEl.querySelector('.share-sheet__qr-wrap');
    if (wrap) wrap.innerHTML = '<p class="share-sheet__qr-error">QR nicht darstellbar — bitte Text-Teilen nutzen.</p>';
  }
}

export function closeProfileShareSheet() {
  if (!rootEl || rootEl.hidden) return;
  isOpen = false;
  rootEl.querySelector('.share-sheet-overlay')?.classList.remove('is-open');
  setTimeout(() => {
    if (rootEl && !rootEl.querySelector('.share-sheet-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
    }
  }, TRANSITION_MS);
}

function renderFavHint(meta) {
  if (meta.favoritesTotal === 0) return '';
  if (meta.favoritesTotal <= 15) {
    return `<p class="share-sheet__fav-hint">${meta.favoritesTotal} Favoriten geteilt</p>`;
  }
  return `<p class="share-sheet__fav-hint share-sheet__fav-hint--warn">15 von ${meta.favoritesTotal} Favoriten geteilt (nur die ersten 15 passen)</p>`;
}

function attachHandlers(text) {
  rootEl.querySelector('[data-action="close"]')?.addEventListener('click', closeProfileShareSheet);
  rootEl.querySelector('[data-role="backdrop"]')?.addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) closeProfileShareSheet();
  });
  rootEl.querySelector('[data-action="share"]')?.addEventListener('click', async () => {
    await handleShare(text);
  });
  rootEl.querySelector('[data-action="copy"]')?.addEventListener('click', async () => {
    await handleCopy(text);
  });
}

async function handleShare(text) {
  const isNative = Capacitor.isNativePlatform();
  if (isNative) {
    try {
      await Share.share({ title: 'Mahlzeit-Profil', text });
      return;
    } catch (e) {
      // User hat abgebrochen ODER Share nicht verfuegbar -> Fallback Copy.
      await handleCopy(text);
      return;
    }
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try { await navigator.share({ title: 'Mahlzeit-Profil', text }); return; } catch { /* fallthrough */ }
  }
  await handleCopy(text);
}

async function handleCopy(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showToast('Kopiert — jetzt in Chat/Mail einfügen');
      return;
    }
  } catch { /* fallthrough */ }
  // Letzter Fallback: Textarea sichtbar machen, User markiert selbst.
  const ta = rootEl.querySelector('[data-role="fallback"]');
  if (ta) {
    ta.hidden = false;
    ta.focus();
    ta.select();
    showToast('Bitte manuell kopieren');
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

### Task 4.3: Share-Sheet-CSS

- [ ] **Schritt 1: `styles/components/profile-share-sheet.css` anlegen:**

```css
/* Gemeinsame Basis fuer Share-, Import-, Welcome- und Add-Choice-Sheets. */
.share-sheet-overlay,
.import-sheet-overlay,
.welcome-overlay,
.add-choice-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 2000;
  opacity: 0;
  transition: opacity .2s ease;
  padding: 0;
}
.share-sheet-overlay.is-open,
.import-sheet-overlay.is-open,
.welcome-overlay.is-open,
.add-choice-overlay.is-open {
  opacity: 1;
}
.share-sheet,
.import-sheet,
.welcome-sheet,
.add-choice-sheet {
  background: var(--md-sys-color-surface, #fff);
  color: var(--md-sys-color-on-surface, #111);
  width: 100%;
  max-width: 560px;
  border-radius: 24px 24px 0 0;
  padding: 8px 20px 24px;
  box-shadow: 0 -8px 24px rgba(0,0,0,.2);
  transform: translateY(24px);
  transition: transform .2s ease;
  max-height: 92vh;
  overflow: auto;
}
.share-sheet-overlay.is-open .share-sheet,
.import-sheet-overlay.is-open .import-sheet,
.welcome-overlay.is-open .welcome-sheet,
.add-choice-overlay.is-open .add-choice-sheet {
  transform: translateY(0);
}
.share-sheet__handle,
.import-sheet__handle,
.welcome-sheet__handle,
.add-choice-sheet__handle {
  width: 36px;
  height: 4px;
  background: var(--md-sys-color-outline-variant, #ccc);
  border-radius: 2px;
  margin: 4px auto 12px;
}
.share-sheet__header,
.import-sheet__header,
.welcome-sheet__header,
.add-choice-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.share-sheet__title,
.import-sheet__title,
.welcome-sheet__title,
.add-choice-sheet__title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}
.share-sheet__close,
.import-sheet__close,
.welcome-sheet__close,
.add-choice-sheet__close {
  min-width: 48px;
  min-height: 48px;
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  color: inherit;
}
.share-sheet__desc,
.import-sheet__desc,
.welcome-sheet__desc,
.add-choice-sheet__desc {
  margin: 0 0 16px;
  color: var(--md-sys-color-on-surface-variant, #444);
  font-size: 14px;
  line-height: 1.4;
}
.share-sheet__qr-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  padding: 12px;
  border-radius: 16px;
  margin: 8px auto 16px;
  width: fit-content;
}
.share-sheet__qr { display: block; }
.share-sheet__qr-error {
  color: var(--md-sys-color-error, #b3261e);
  font-size: 14px;
  text-align: center;
}
.share-sheet__fav-hint {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant, #444);
  margin: 0 0 16px;
  text-align: center;
}
.share-sheet__fav-hint--warn {
  color: var(--md-sys-color-error, #b3261e);
}
.share-sheet__actions,
.import-sheet__actions,
.welcome-sheet__actions,
.add-choice-sheet__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.share-sheet__btn,
.import-sheet__btn,
.welcome-sheet__btn,
.add-choice-sheet__btn {
  min-height: 48px;
  width: 100%;
}
.share-sheet__fallback {
  width: 100%;
  min-height: 96px;
  margin-top: 12px;
  font-family: monospace;
  font-size: 12px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--md-sys-color-outline-variant, #ccc);
  background: var(--md-sys-color-surface-variant, #f5f5f5);
  color: var(--md-sys-color-on-surface-variant, #444);
}
```

### Task 4.4: Verdrahtung im Profil-Detail-Sheet

- [ ] **Schritt 1: Verstehe die Delete-Button-Zeile** — Öffne `src/settings/profile-detail-sheet.js` und finde die Zeile mit dem roten „Profil löschen"-Button. Suche nach `data-action="delete"` oder `Profil löschen`.

```bash
grep -n "data-action=\"delete\"\|Profil löschen\|profile-detail__delete" src/settings/profile-detail-sheet.js
```

- [ ] **Schritt 2: „Profil teilen"-Button einfügen** — Direkt VOR dem Delete-Button-Markup einen neuen Button einfügen. Der Button wird nur gerendert wenn `currentProfile.id !== '_default'` (Standard-Profil ist nicht teilbar).

Beispiel-Snippet (an die vorhandene Struktur anpassen):

```js
${currentProfile.id !== '_default' ? `
  <button class="btn btn--secondary profile-detail__share" type="button" data-action="share-profile">
    Profil teilen
  </button>
` : ''}
```

Falls schon eine sichtbare Container-Section für Actions existiert, den Button in dieselbe Section einfügen. Andernfalls in derselben Element-Ebene wie der Delete-Button, direkt darüber.

- [ ] **Schritt 3: Handler binden** — Im Bereich der Event-Handler-Bindings (Suche nach `data-action="delete"` Handler) einen neuen Handler ergänzen:

```js
rootEl.querySelector('[data-action="share-profile"]')?.addEventListener('click', () => {
  import('../profile-share/share-sheet.js').then(({ openProfileShareSheet }) => {
    openProfileShareSheet(currentProfile);
  });
});
```

Dynamic-Import ist Absicht: die Share-Sheet-Dependencies (`@capacitor/share`, `qrcode`) sollen nicht beim App-Start geladen werden, sondern erst wenn tatsächlich geteilt wird.

- [ ] **Schritt 4: Container-Div in `index.html`** — Suche das existierende `<div id="profile-detail-sheet-root"></div>` (oder Äquivalent) und ergänze DARUNTER:

```html
<div id="profile-share-sheet-root"></div>
```

- [ ] **Schritt 5: Mount in `src/main.js`** — Import + Mount der Share-Sheet:

```js
import { mountProfileShareSheet } from './profile-share/share-sheet.js';
// ...
mountProfileShareSheet(document.getElementById('profile-share-sheet-root'));
```

Achte auf konsistente Reihenfolge zu den existierenden Mounts (z. B. neben `mountProfileDetailSheet`).

### Task 4.5: Manueller Test + Commit

- [ ] **Schritt 1: Dev-Server**

```bash
npm run dev
```

- [ ] **Schritt 2: Browser-Test**
  1. Settings öffnen → Profile-Section → aktives Profil („Oliver") antippen → Profil-Detail-Sheet öffnet
  2. Neuer „Profil teilen"-Button sichtbar oberhalb „Profil löschen"
  3. Klick → Share-Sheet öffnet, QR-Canvas wird gerendert (schwarzer QR auf weiß, ~240 px)
  4. Kein Favoriten-Hinweis wenn 0 Favoriten; „N Favoriten geteilt" bei 1–15; Warn-Formulierung bei > 15
  5. „Teilen"-Button: im Browser ohne Web-Share-API → Fallback Copy + Toast „Kopiert…"
  6. „In Zwischenablage"-Button: Text landet in Clipboard (in DevTools per `navigator.clipboard.readText().then(console.log)` verifizieren)
  7. Standard-Profil öffnen → „Profil teilen"-Button ist NICHT sichtbar

- [ ] **Schritt 3: Commit**

```bash
git add src/profile-share/qr.js src/profile-share/share-sheet.js styles/components/profile-share-sheet.css src/settings/profile-detail-sheet.js src/main.js index.html
git commit -m "feat(profile-share): export sheet mit QR + share + copy"
```

---

## Etappe 5: QR-Scanner + Import-Sheet

**Ziel:** `import-sheet.js` mit zwei Tabs/Modi (QR-Scan / Text-Paste), Toast nach erfolgreichem Import, Fehler-Handling inline.

**Files:**
- Create: `src/profile-share/scanner.js`
- Create: `src/profile-share/import-sheet.js`
- Modify: `styles/components/profile-share-sheet.css` — Import-Sheet-spezifische Ergänzungen
- Modify: `src/main.js` — Mount
- Modify: `index.html` — Container-Div

### Task 5.1: Scanner-Wrapper

- [ ] **Schritt 1: `src/profile-share/scanner.js` anlegen:**

```js
// Wrapper um @capacitor-mlkit/barcode-scanning. Kapselt Permission-Handling
// und den Native-vs-Web-Zweig (Web hat keinen Scanner -> Fallback).
import { Capacitor } from '@capacitor/core';

let BarcodeScannerRef = null;
async function loadPlugin() {
  if (BarcodeScannerRef) return BarcodeScannerRef;
  const mod = await import('@capacitor-mlkit/barcode-scanning');
  BarcodeScannerRef = mod.BarcodeScanner;
  return BarcodeScannerRef;
}

export function isScannerAvailable() {
  return Capacitor.isNativePlatform();
}

export async function requestPermission() {
  const B = await loadPlugin();
  const res = await B.requestPermissions();
  return res.camera === 'granted' || res.camera === 'limited';
}

// startScan zeigt die native Kamera-UI von MLKit (Full-Screen-Preview).
// Rueckgabe: erkannter Payload (String) oder null bei Abbruch.
export async function scanOnce() {
  const B = await loadPlugin();
  try {
    const result = await B.scan({ formats: ['QR_CODE'] });
    const first = result?.barcodes?.[0];
    return first?.rawValue ?? null;
  } catch (e) {
    // User hat abgebrochen oder Kamera-Fehler.
    return null;
  }
}
```

### Task 5.2: Import-Sheet-Modul

- [ ] **Schritt 1: `src/profile-share/import-sheet.js` anlegen:**

```js
import { addProfile } from '../state.js';
import { decodeProfile } from './payload.js';
import { getAllDishes } from '../data/dishes.js';
import { showToast } from '../util/toast.js';
import { isScannerAvailable, requestPermission, scanOnce } from './scanner.js';

let rootEl = null;
let isOpen = false;
let onDone = null; // Callback (importedProfile) fuer Wizard/Settings.
const TRANSITION_MS = 200;

export function mountProfileImportSheet(el) {
  rootEl = el;
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

// opts.onImported(profile): wird nach erfolgreichem addProfile aufgerufen,
// bevor das Sheet schliesst. Wizard/Sub-Wizard nutzen das fuer Skip-Logik.
export function openProfileImportSheet({ onImported } = {}) {
  if (!rootEl) throw new Error('Import-Sheet nicht gemountet.');
  onDone = onImported || (() => {});
  renderChoice();
  rootEl.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      isOpen = true;
      rootEl.querySelector('.import-sheet-overlay')?.classList.add('is-open');
    });
  });
}

export function closeProfileImportSheet() {
  if (!rootEl || rootEl.hidden) return;
  isOpen = false;
  rootEl.querySelector('.import-sheet-overlay')?.classList.remove('is-open');
  setTimeout(() => {
    if (rootEl && !rootEl.querySelector('.import-sheet-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
    }
  }, TRANSITION_MS);
}

// Screen 1: Auswahl QR-Scan oder Text-Paste.
function renderChoice() {
  const scannerHint = isScannerAvailable() ? '' : `<p class="import-sheet__hint">Kamera-Scan nur in der App verfügbar — im Browser bitte Text-Paste nutzen.</p>`;
  rootEl.innerHTML = `
    <div class="import-sheet-overlay" data-role="backdrop">
      <div class="import-sheet" role="dialog" aria-modal="true" aria-labelledby="import-sheet-title">
        <div class="import-sheet__handle" aria-hidden="true"></div>
        <div class="import-sheet__header">
          <h2 class="import-sheet__title" id="import-sheet-title">Profil importieren</h2>
          <button class="import-sheet__close" type="button" data-action="close" aria-label="Schließen">✕</button>
        </div>
        <div class="import-sheet__body">
          <p class="import-sheet__desc">QR-Code eines anderen Mahlzeit-Profils scannen oder den geteilten Text einfügen.</p>
          ${scannerHint}
          <div class="import-sheet__actions">
            <button class="btn btn--primary import-sheet__btn" type="button" data-action="scan"${isScannerAvailable() ? '' : ' disabled'}>QR-Code scannen</button>
            <button class="btn btn--secondary import-sheet__btn" type="button" data-action="paste">Text einfügen</button>
          </div>
        </div>
      </div>
    </div>
  `;
  attachChoiceHandlers();
}

function attachChoiceHandlers() {
  rootEl.querySelector('[data-action="close"]')?.addEventListener('click', closeProfileImportSheet);
  rootEl.querySelector('[data-role="backdrop"]')?.addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) closeProfileImportSheet();
  });
  rootEl.querySelector('[data-action="scan"]')?.addEventListener('click', handleScanFlow);
  rootEl.querySelector('[data-action="paste"]')?.addEventListener('click', renderPaste);
}

async function handleScanFlow() {
  const granted = await requestPermission();
  if (!granted) {
    showToast('Kamera-Berechtigung nötig — bitte in Systemeinstellungen erlauben oder Text einfügen.', { tone: 'error', duration: 4000 });
    return;
  }
  const scanned = await scanOnce();
  if (!scanned) {
    // User hat abgebrochen — Sheet bleibt offen mit Choice-Screen.
    return;
  }
  const result = tryImport(scanned);
  if (!result.ok) {
    showToast(result.message, { tone: 'error', duration: 3500 });
    return;
  }
  finishImport(result.profile, result.meta);
}

// Screen 2: Textarea + Import-Button.
function renderPaste() {
  const canPaste = typeof navigator !== 'undefined' && navigator.clipboard?.readText;
  rootEl.querySelector('.import-sheet__body').innerHTML = `
    <p class="import-sheet__desc">Text aus Chat/Mail hier einfügen:</p>
    <textarea class="import-sheet__textarea" data-role="paste" rows="5" placeholder="hier einfügen…"></textarea>
    <p class="import-sheet__error" data-role="paste-error" hidden></p>
    <div class="import-sheet__actions">
      ${canPaste ? `<button class="btn btn--secondary import-sheet__btn" type="button" data-action="paste-clipboard">Aus Zwischenablage einfügen</button>` : ''}
      <button class="btn btn--primary import-sheet__btn" type="button" data-action="do-import" disabled>Importieren</button>
      <button class="btn btn--text import-sheet__btn" type="button" data-action="back">Zurück</button>
    </div>
  `;
  const ta = rootEl.querySelector('[data-role="paste"]');
  const doBtn = rootEl.querySelector('[data-action="do-import"]');
  ta.addEventListener('input', () => {
    doBtn.disabled = ta.value.trim().length === 0;
    rootEl.querySelector('[data-role="paste-error"]').hidden = true;
  });
  rootEl.querySelector('[data-action="paste-clipboard"]')?.addEventListener('click', async () => {
    try {
      const t = await navigator.clipboard.readText();
      ta.value = t;
      doBtn.disabled = t.trim().length === 0;
    } catch { /* ignore */ }
  });
  rootEl.querySelector('[data-action="do-import"]').addEventListener('click', () => {
    const result = tryImport(ta.value.trim());
    if (!result.ok) {
      const err = rootEl.querySelector('[data-role="paste-error"]');
      err.textContent = result.message;
      err.hidden = false;
      return;
    }
    finishImport(result.profile, result.meta);
  });
  rootEl.querySelector('[data-action="back"]').addEventListener('click', renderChoice);
}

function tryImport(text) {
  const knownDishIds = getAllDishes().map((d) => d.id);
  const decoded = decodeProfile(text, { knownDishIds });
  if (decoded.error) {
    return { ok: false, message: messageForError(decoded.error) };
  }
  return { ok: true, profile: decoded.profile, meta: decoded.meta };
}

function messageForError(code) {
  switch (code) {
    case 'PARSE_ERROR': return 'Konnte den Text nicht lesen — sicher der richtige aus Mahlzeit?';
    case 'BAD_TYPE': return 'Das ist kein Mahlzeit-Profil.';
    case 'BAD_VERSION': return 'Diese Profil-Version wird von deiner App nicht unterstützt — bitte aktualisieren.';
    case 'INVALID_FIELD': return 'Profil hat ein ungültiges Feld — Import abgebrochen.';
    case 'TOO_LARGE': return 'Datei zu groß — vermutlich kein Mahlzeit-Profil.';
    default: return 'Import fehlgeschlagen.';
  }
}

function finishImport(profile, meta) {
  const added = addProfile(profile);
  const name = added.name || null;
  const skipped = meta?.favoritesSkipped || 0;
  const nameStr = name ? `Profil von ${name} hinzugefügt` : 'Profil hinzugefügt';
  const suffix = skipped > 0 ? ` (${skipped} Favoriten übersprungen)` : '';
  showToast(nameStr + suffix);
  closeProfileImportSheet();
  onDone(added);
}
```

- [ ] **Schritt 2: `getAllDishes()` verifizieren** — Falls die Funktion nicht existiert oder anders heißt: kurz suchen und Import-Zeile anpassen.

```bash
grep -n "export.*dishes\|export function getAll\|export const dishes" src/data/dishes.js
```

Falls die Datei `dishes.js` nur `dishes.json` als Array exportiert (z. B. `export const dishes = [...]` oder `import dishes from './dishes.json'`), Zeile 3 in `import-sheet.js` anpassen:

```js
import { dishes } from '../data/dishes.js';   // statt getAllDishes
// ... und weiter unten:
const knownDishIds = dishes.map((d) => d.id);
```

### Task 5.3: Import-Sheet-CSS ergänzen

- [ ] **Schritt 1: `styles/components/profile-share-sheet.css` erweitern** — am Ende der Datei anhängen:

```css
.import-sheet__hint {
  font-size: 13px;
  color: var(--md-sys-color-error, #b3261e);
  margin: -8px 0 12px;
}
.import-sheet__textarea {
  width: 100%;
  min-height: 120px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid var(--md-sys-color-outline-variant, #ccc);
  background: var(--md-sys-color-surface-variant, #f5f5f5);
  color: var(--md-sys-color-on-surface, #111);
  font-family: monospace;
  font-size: 12px;
  resize: vertical;
  margin-bottom: 8px;
}
.import-sheet__error {
  color: var(--md-sys-color-error, #b3261e);
  font-size: 13px;
  margin: 0 0 12px;
}
```

### Task 5.4: Container + Mount

- [ ] **Schritt 1: `index.html`** — nach `#profile-share-sheet-root` einfügen:

```html
<div id="profile-import-sheet-root"></div>
```

- [ ] **Schritt 2: `src/main.js`** — analog zum Share-Sheet mounten:

```js
import { mountProfileImportSheet } from './profile-share/import-sheet.js';
// ...
mountProfileImportSheet(document.getElementById('profile-import-sheet-root'));
```

### Task 5.5: Manueller Test + Commit

- [ ] **Schritt 1: Round-Trip im Browser (ohne Kamera):**
  1. Dev-Server `npm run dev`
  2. Aktives Profil öffnen → „Profil teilen" → „In Zwischenablage" → Toast bestätigt Copy
  3. Import-Sheet manuell öffnen — in DevTools-Konsole:
     ```js
     import('/src/profile-share/import-sheet.js').then(m => m.openProfileImportSheet())
     ```
  4. „Text einfügen" → „Aus Zwischenablage einfügen" → „Importieren" → Toast „Profil von Oliver hinzugefügt", Sheet schließt
  5. Settings → Profile-Liste zeigt neue Zeile am Ende
  6. Textmüll (z. B. „hallo") einfügen → Fehler-Meldung unter Textarea

- [ ] **Schritt 2: APK-Test** (nur wenn Scanner getestet werden soll — Guardrail: APK nur auf Anfrage; falls User zustimmt):
  ```bash
  npm run build && npx cap sync android
  cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
  ```
  APK installieren, „Profil teilen" auf Handy A → Handy B öffnet Import-Sheet → QR-Scan → Toast + Profil im Settings.

- [ ] **Schritt 3: Commit**

```bash
git add src/profile-share/scanner.js src/profile-share/import-sheet.js styles/components/profile-share-sheet.css src/main.js index.html
git commit -m "feat(profile-share): import sheet mit qr-scan + text-paste"
```

---

## Etappe 6: Wizard-Integration

**Ziel:** Welcome-Screen VOR Wizard Step 1 (Erstonboarding) und VOR Sub-Wizard Step 1 (Person n+1). Bei QR/Text-Import: Wizard-Skip.

**Files:**
- Modify: `src/onboarding/wizard.js` — `showWelcome`-Flag, Welcome-Rendering in `renderStepContent()`, Erst-Welcome in `openOnboardingWizard()`, Sub-Wizard-Welcome in `startSubProfileWizard()`

### Task 6.1: Welcome-State in `wizard.js`

- [ ] **Schritt 1: State-Flag ergänzen** — Oben in `wizard.js` bei den anderen Modul-Variablen (z. B. `personIndex`, `showFollowup`) hinzufügen:

```js
let showWelcome = false;   // true = statt Step-Content Welcome-Screen zeigen
```

- [ ] **Schritt 2: `openOnboardingWizard()` erweitern** — In `openOnboardingWizard(opts = {})` nach dem `if (opts.addProfile) { ... } else { ... }`-Block, VOR `state.settings.onboardingSeen = true`:

```js
// Welcome-Screen nur beim First-Run (nicht bei addProfile aus Settings — dort
// hat der User schon manuell "+ Profil hinzufuegen" geklickt, ein zweiter
// Choice-Screen waere redundant).
showWelcome = !opts.addProfile;
```

- [ ] **Schritt 3: `startSubProfileWizard()` erweitern** — die Funktion an Stelle wizard.js:240 anpassen:

```js
function startSubProfileWizard() {
  const p = addProfile({});
  editingProfileId = p.id;
  showFollowup = false;
  showWelcome = true;   // Sub-Wizard startet auch mit Welcome-Screen
  currentStep = 1;
  initDraftFromProfile(p);
  renderShell();
}
```

### Task 6.2: Welcome-Screen rendern

- [ ] **Schritt 1: `renderStepContent()` erweitern** — Ganz am Anfang der Funktion (vor `if (showFollowup) return renderFollowup();`):

```js
function renderStepContent() {
  if (showWelcome) return renderWelcome();
  if (showFollowup) return renderFollowup();
  switch (currentStep) {
    // ... unverändert
  }
}
```

- [ ] **Schritt 2: `renderWelcome()` neu ergänzen** — irgendwo in wizard.js (z. B. direkt unter `renderFollowup`):

```js
function renderWelcome() {
  const isSub = isSubProfileWizard();
  const title = isSub ? 'Person hinzufügen' : 'Willkommen bei Mahlzeit';
  const desc = isSub
    ? 'Neue Person manuell einrichten oder Profil-QR eines anderen Mahlzeit-Nutzers übernehmen.'
    : 'Zum ersten Mal hier? Richte dein Profil ein oder übernimm ein bestehendes.';
  return `
    <div class="wizard-welcome">
      <h3 class="wizard-welcome__title">${title}</h3>
      <p class="wizard-welcome__desc">${desc}</p>
      <div class="wizard-welcome__actions">
        <button class="btn btn--primary wizard-welcome__btn" type="button" data-action="welcome-manual">Manuell einrichten</button>
        <button class="btn btn--secondary wizard-welcome__btn" type="button" data-action="welcome-scan">Profil-QR scannen</button>
        <button class="btn btn--text wizard-welcome__btn" type="button" data-action="welcome-paste">Text einfügen</button>
      </div>
    </div>
  `;
}
```

- [ ] **Schritt 3: Handler binden** — In `attachStepHandlers()` (oder falls es einen dedizierten Welcome-Handler-Punkt gibt, siehe `attachShellHandlers`) am Anfang:

```js
function attachStepHandlers() {
  if (showWelcome) {
    attachWelcomeHandlers();
    return;
  }
  // ... unverändert (attachStep1Handlers etc.)
}

function attachWelcomeHandlers() {
  rootEl.querySelector('[data-action="welcome-manual"]')?.addEventListener('click', () => {
    showWelcome = false;
    renderShell();
  });
  const openImport = () => {
    import('../profile-share/import-sheet.js').then(({ openProfileImportSheet }) => {
      openProfileImportSheet({
        onImported: (importedProfile) => onWizardImported(importedProfile),
      });
    });
  };
  rootEl.querySelector('[data-action="welcome-scan"]')?.addEventListener('click', openImport);
  rootEl.querySelector('[data-action="welcome-paste"]')?.addEventListener('click', openImport);
}

function onWizardImported(importedProfile) {
  // Der Wizard wollte gerade eigentlich das aktuelle Slot-Profil einrichten.
  // Import legt aber ein NEUES Profil ans Ende der Liste an. Damit das
  // importierte Profil den Slot der aktuellen Person einnimmt, den vorher
  // angelegten Blank-Slot entfernen und den importierten an dessen Stelle
  // moven bzw. bei First-Run ganz nach vorne moven (aktives Profil).
  if (isSubProfileWizard()) {
    // Blank-Sub-Profil (das startSubProfileWizard vorhin angelegt hat) wieder loeschen.
    removeProfile(editingProfileId);
    // importedProfile ist bereits im state, hat aber ne u-ID am Ende. Semantisch
    // ok — die Reihenfolge Person 2/3/... entspricht der profiles-Array-Reihenfolge.
    editingProfileId = importedProfile.id;
    // Weiter zum naechsten Follow-up-Check.
    maybeShowFollowupOrClose();
  } else {
    // First-Run: importedProfile ans erste Slot ziehen (aktives Profil).
    setActiveProfileId(importedProfile.id);
    // Alten Blank-User u1 (falls noch komplett leer) entfernen — sonst hat der
    // User zwei Profile: das importierte (jetzt aktiv) und einen alten leeren.
    const profiles = state.settings.profiles;
    const stale = profiles.find((p) => p.id !== importedProfile.id && isBlankProfile(p));
    if (stale && profiles.length > 1) removeProfile(stale.id);
    saveState();
    closeOnboardingWizard();
  }
}

// Hilfs-Check: Profil wurde nie im Wizard angefasst?
function isBlankProfile(p) {
  return p && p.name == null && p.gender == null && p.age == null && p.heightCm == null && p.weightKg == null;
}
```

- [ ] **Schritt 4: Fehlende Imports ergänzen** — In `wizard.js` Zeile 1: `setActiveProfileId` und ggf. `saveState` aus `../state.js` importieren, falls noch nicht drin. Aktuell steht: `import { state, getActiveProfile, getProfileById, addProfile, removeProfile, saveState } from '../state.js';` — `setActiveProfileId` fehlt und muss ergänzt werden:

```js
import { state, getActiveProfile, getProfileById, addProfile, removeProfile, saveState, setActiveProfileId } from '../state.js';
```

### Task 6.3: Welcome-CSS

- [ ] **Schritt 1: `styles/components/onboarding-wizard.css`** öffnen und am Ende anhängen:

```css
.wizard-welcome {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px 8px 8px;
  text-align: center;
}
.wizard-welcome__title {
  font-size: 22px;
  font-weight: 600;
  margin: 0;
}
.wizard-welcome__desc {
  color: var(--md-sys-color-on-surface-variant, #444);
  font-size: 14px;
  line-height: 1.4;
  margin: 0 0 12px;
}
.wizard-welcome__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: stretch;
}
.wizard-welcome__btn {
  min-height: 48px;
}
```

### Task 6.4: Footer während Welcome verstecken

- [ ] **Schritt 1: `renderFooter()` erweitern** — Die Funktion beginnt mit einer Prüfung ob Follow-up angezeigt wird. Analog ergänzen:

```js
function renderFooter() {
  if (showWelcome) return '';   // Welcome hat eigene Aktionen im Body
  if (showFollowup) { /* bisherige Follow-up-Logik */ }
  // ... rest unveraendert
}
```

Konkret: die erste Zeile in `renderFooter()` ergänzen (Position finden per `grep -n "function renderFooter" src/onboarding/wizard.js`).

- [ ] **Schritt 2: Progress-Bar während Welcome verstecken** — In `renderShell()` an der Stelle wo `progressBar` definiert wird:

```js
const progressBar = (showFollowup || showWelcome) ? '' : `
  <div class="onboarding-progress">
    ...unveraendert
  </div>
`;
```

### Task 6.5: Manueller Wizard-Test + Commit

- [ ] **Schritt 1: First-Run-Simulation**
  1. In DevTools: `localStorage.removeItem('mahlzeit-state-v2')` + Reload → Wizard öffnet
  2. Neuer Welcome-Screen zeigt „Willkommen bei Mahlzeit" mit drei Buttons
  3. „Manuell einrichten" → Step 1 wie bisher
  4. State erneut leeren + Reload → Welcome → „Text einfügen" → Textarea → Base64-Payload einfügen (aus Etappe 4-Test) → Import → Toast → Wizard schließt, Dashboard sichtbar
  5. Settings → Profile-Liste zeigt das importierte Profil als AKTIV (erstes)

- [ ] **Schritt 2: Sub-Wizard-Test** (Onboarding mit `defaultPortions=2`)
  1. State leeren + Wizard durchlaufen manuell → Follow-up „Weitere Person?" → Ja
  2. Neuer Welcome-Screen mit „Person hinzufügen" + Person-Pille „Person 2 von 2"
  3. „Text einfügen" → Import → weiter zum finalen Follow-up-Check (kein weiterer Sub-Wizard, weil Personen voll)

- [ ] **Schritt 3: Commit**

```bash
git add src/onboarding/wizard.js styles/components/onboarding-wizard.css
git commit -m "feat(onboarding): welcome screen mit qr-import option"
```

---

## Etappe 7: Settings „+ Profil hinzufügen"-Umbau

**Ziel:** Der bestehende „+ Profil hinzufügen"-Button öffnet nicht mehr direkt den Wizard, sondern ein Auswahl-Sheet mit „Manuell / QR / Text".

**Files:**
- Create: `src/profile-share/add-choice-sheet.js`
- Modify: `src/settings/render.js` — Handler-Umleitung
- Modify: `src/main.js` — Mount
- Modify: `index.html` — Container

### Task 7.1: Add-Choice-Sheet

- [ ] **Schritt 1: `src/profile-share/add-choice-sheet.js` anlegen:**

```js
// Zwischen-Sheet zwischen "+ Profil hinzufuegen" und Wizard/Import.
// Zeigt drei Optionen. Auswahl fuehrt in Wizard (addProfile-Modus) oder
// Import-Sheet.

let rootEl = null;
let onManual = null;
let onImport = null;
const TRANSITION_MS = 200;

export function mountAddChoiceSheet(el) {
  rootEl = el;
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export function openAddChoiceSheet({ onManualChoice, onImportChoice }) {
  if (!rootEl) throw new Error('Add-Choice-Sheet nicht gemountet.');
  onManual = onManualChoice;
  onImport = onImportChoice;
  rootEl.innerHTML = `
    <div class="add-choice-overlay" data-role="backdrop">
      <div class="add-choice-sheet" role="dialog" aria-modal="true" aria-labelledby="add-choice-title">
        <div class="add-choice-sheet__handle" aria-hidden="true"></div>
        <div class="add-choice-sheet__header">
          <h2 class="add-choice-sheet__title" id="add-choice-title">Profil hinzufügen</h2>
          <button class="add-choice-sheet__close" type="button" data-action="close" aria-label="Schließen">✕</button>
        </div>
        <div class="add-choice-sheet__body">
          <p class="add-choice-sheet__desc">Wie möchtest du das neue Profil anlegen?</p>
          <div class="add-choice-sheet__actions">
            <button class="btn btn--primary add-choice-sheet__btn" type="button" data-action="manual">Manuell einrichten</button>
            <button class="btn btn--secondary add-choice-sheet__btn" type="button" data-action="scan">Profil-QR scannen</button>
            <button class="btn btn--text add-choice-sheet__btn" type="button" data-action="paste">Text einfügen</button>
          </div>
        </div>
      </div>
    </div>
  `;
  rootEl.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => rootEl.querySelector('.add-choice-overlay')?.classList.add('is-open'));
  });
  attach();
}

function attach() {
  rootEl.querySelector('[data-action="close"]')?.addEventListener('click', close);
  rootEl.querySelector('[data-role="backdrop"]')?.addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) close();
  });
  rootEl.querySelector('[data-action="manual"]')?.addEventListener('click', () => {
    close();
    onManual && onManual();
  });
  const importFn = () => {
    close();
    onImport && onImport();
  };
  rootEl.querySelector('[data-action="scan"]')?.addEventListener('click', importFn);
  rootEl.querySelector('[data-action="paste"]')?.addEventListener('click', importFn);
}

function close() {
  if (!rootEl || rootEl.hidden) return;
  rootEl.querySelector('.add-choice-overlay')?.classList.remove('is-open');
  setTimeout(() => {
    if (rootEl && !rootEl.querySelector('.add-choice-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
    }
  }, TRANSITION_MS);
}
```

### Task 7.2: Settings-Handler umbauen

- [ ] **Schritt 1: Bestehenden Handler finden** — In `src/settings/render.js` den Handler für `.settings-profile-add` (Zeile ~330):

```bash
grep -n "settings-profile-add\|profile-add" src/settings/render.js
```

- [ ] **Schritt 2: Handler ersetzen** — Den bestehenden Click-Handler auf `.settings-profile-add` durch folgenden ersetzen:

```js
// Aktuell: oeffnet direkt Wizard im addProfile-Modus.
// Neu: oeffnet Auswahl-Sheet, das je nach Wahl in Wizard oder Import-Sheet geht.
addBtn.addEventListener('click', () => {
  Promise.all([
    import('../profile-share/add-choice-sheet.js'),
    import('../profile-share/import-sheet.js'),
    import('../onboarding/wizard.js'),
  ]).then(([{ openAddChoiceSheet }, importMod, wizardMod]) => {
    openAddChoiceSheet({
      onManualChoice: () => wizardMod.openOnboardingWizard({ addProfile: true }),
      onImportChoice: () => importMod.openProfileImportSheet({
        onImported: () => {
          // Settings-Sheet neu rendern damit neue Zeile sichtbar wird.
          if (typeof rerenderProfileSection === 'function') rerenderProfileSection();
        },
      }),
    });
  });
});
```

- [ ] **Schritt 3: `rerenderProfileSection` prüfen** — In `settings/render.js` gibt es laut Session-18-Code eine Re-Render-Funktion für die Profil-Liste (Zeile ~424: „Aktualisiert die Profil-Liste in der offenen Section"). Namen verifizieren:

```bash
grep -n "^function.*profile\|export function.*profile\|refreshProfile\|renderProfileList\|updateProfileList" src/settings/render.js
```

Den korrekten Funktionsnamen im Handler oben einsetzen. Falls die Funktion nicht exportiert ist: entweder exportieren, oder das gesamte Settings-Sheet re-öffnen (`closeSettingsSheet() + openSettingsSheet()`).

### Task 7.3: Mount + Container

- [ ] **Schritt 1: `index.html`** — nach `#profile-import-sheet-root` einfügen:

```html
<div id="add-choice-sheet-root"></div>
```

- [ ] **Schritt 2: `src/main.js`** ergänzen:

```js
import { mountAddChoiceSheet } from './profile-share/add-choice-sheet.js';
// ...
mountAddChoiceSheet(document.getElementById('add-choice-sheet-root'));
```

### Task 7.4: Manueller Test + Commit

- [ ] **Schritt 1: Test-Flow**
  1. Dev-Server, Settings → Profile → „+ Profil hinzufügen" → Add-Choice-Sheet öffnet mit drei Optionen
  2. „Manuell einrichten" → bestehender Sub-Wizard-Flow für neuen User startet
  3. State reset, gleichen Schritt wieder, aber „Text einfügen" → Import-Sheet → Base64 einfügen → Toast → Profil in Liste
  4. „Profil-QR scannen" im Browser: Button ist disabled (nur Native), Hinweis-Text sichtbar

- [ ] **Schritt 2: Commit**

```bash
git add src/profile-share/add-choice-sheet.js src/settings/render.js src/main.js index.html
git commit -m "feat(settings): add-choice sheet fuer profil-hinzufuegen"
```

---

## Etappe 8: Abschluss

### Task 8.1: Node-Simulation nochmal durchlaufen

- [ ] **Schritt 1:**

```bash
node src/profile-share/payload.test.mjs
```

Erwartet: unverändert alle Tests grün. (Sanity-Check dass keine späteren Etappen `payload.js` gebrochen haben.)

### Task 8.2: Doc-Sync-Check

- [ ] **Schritt 1: Backlog updaten** — In `docs/redesign/backlog.md` den Abschnitt „Profil teilen / importieren" (Zeile ~213) mit Status-Header versehen:

```markdown
## Profil teilen / importieren

**Status:** Umgesetzt in Session 19 — siehe [Design-Doc](2026-07-27-profil-teilen-import-design.md) und [Implementierungs-Plan](2026-07-27-profil-teilen-import-plan.md).

...bestehender Text bleibt als Kontext...
```

### Task 8.3: Beta-Branch-Sync

- [ ] **Schritt 1:** Falls die Umsetzung auf einem Feature-Branch lief (`beta`/`multiuser`), am Ende der Session cherry-picken oder mergen auf die anderen Branches — analog zum Vorgehen bei den Session-19-Docs.

### Task 8.4: Handoff für Session 20

- [ ] **Schritt 1:** `docs/redesign/handoffs/session-19-to-20.md` schreiben — nutze `handoff`-Skill falls verfügbar, sonst nach Muster von `session-18-to-19.md`.

---

## Self-Review Notes

**Coverage-Check gegen Design-Doc:**

| Design-Abschnitt | Implementiert in |
|---|---|
| Architektur (5 neue Module + Toast) | Etappen 1, 2, 4, 5, 7 |
| Neue Deps (share, mlkit, qrcode) | Etappe 3 |
| Trigger-Punkte (5 Stück) | Task 4.4 (Detail-Sheet), Task 6.2 (Wizard-Welcome), Task 6.1 (Sub-Wizard), Task 7.2 (Settings) |
| JSON-Payload-Schema | Task 1.1 (`payload.js`) |
| Version-Guard + Enum + Cap | Task 1.1 + verifiziert in Task 1.2 |
| Standard-Profil ausgeblendet | Task 4.4 Schritt 2 |
| Export-Sheet-Layout | Task 4.2 |
| Favoriten-Hinweis-Regel (0/1-15/16+) | `renderFavHint` in Task 4.2 |
| Import-Sheet-Layout | Task 5.2 |
| Toast statt Preview | Task 5.2 `finishImport` |
| Scanner-Permission-Handling | Task 5.1 + 5.2 `handleScanFlow` |
| Fehler-Codes → User-Messages | Task 5.2 `messageForError` |
| Sanitizer (unbekannte Favoriten) | Task 1.1 `decodeProfile` + Task 5.2 `tryImport` |
| Wizard-Skip nach Import | Task 6.2 `onWizardImported` |

**Alle Design-Fehlerfälle im Plan abgedeckt?** Ja — `messageForError` deckt alle 5 Codes ab; Scanner-Permission-Deny hat separaten Pfad; Kein-Kamera-Gerät (Web) hat Hinweis + disabled Button.

**Type-Konsistenz-Check:**
- `openProfileImportSheet({ onImported })` — Callback-Name konsistent Task 5.2 + Task 6.2 + Task 7.2.
- `openProfileShareSheet(profile)` — nur profile, konsistent Task 4.2 + Task 4.4.
- `addProfile(patch)` bleibt unverändert (Task 5.2 nutzt es korrekt).

**Bekannte lose Enden für Session 20+:**
- Doc-Update (Task 8.2) ist optional — kann in Handoff erwähnt werden.
- Handoff-Doc (Task 8.4) hängt vom Session-Verlauf ab.
- APK-Build für Scanner-Test nur auf User-Anfrage (Guardrail).
