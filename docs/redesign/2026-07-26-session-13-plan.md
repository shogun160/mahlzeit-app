# Session 13 Implementation Plan — Onboarding-Wizard

> **Environment note aus Sessions 1-12:** Subagent-Worktree-Dispatch nicht verfügbar. Direktausführung in der Haupt-Session. Gradle braucht `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`.

> **REQUIRED SUB-SKILL:** Steps sind mit Checkboxen (`- [ ]`) auszuführen, in der Reihenfolge des Dokuments. Am Ende jeder Task steht ein Commit-Command — nach jedem Commit ist ein sauberer Zwischenstand erreicht, an dem der User pausieren oder abbrechen kann.

**Spec:** [`docs/redesign/2026-07-26-onboarding-design.md`](2026-07-26-onboarding-design.md) (Commit `0efd1ea`)

**Goal:** 5-Step-Bottom-Sheet-Wizard fürs Ersteinrichten des Profils (Name, Biometrie, Alltag, Mahlzeiten, Ergebnis mit Slider-Feintuning). Auto-Open beim allerersten Start, Re-Trigger über Placeholder-Pille im Dashboard und Button in der Daten-Section. Beta-Reset für alle bereits installierten Sessions.

**Architecture:**

- **State-Erweiterung:** `profile.name: null`, `settings.onboardingSeen: boolean`. Alle bestehenden Wizard-relevanten Slots (`age/heightCm/weightKg/activityLevel/goal/breakfastKcal/lunchKcal`) verlieren ihre pragmatischen Defaults und werden `null`.
- **Neues Modul `src/onboarding/`:** `wizard.js` (Mount/Open/Close/Navigation/Draft), `steps.js` (Step-Renderer 1–4), `result.js` (Step 5 mit Live-Slider). Analog zum bestehenden `dashboard/macro-popup.js`-Pattern.
- **Neue Guard-Funktion `isProfileComplete()`** in `nutrition/target.js` — komplementär zu `hasProfile()` (das bleibt biometrisch). `isProfileComplete` prüft zusätzlich `activityLevel/goal/breakfastKcal/lunchKcal`. Name ist nicht Teil des Checks (optional).
- **Migration in `loadState()`:** Wenn `onboardingSeen` im geladenen Storage fehlt (= alte Session vor Session 13), werden die 8 Wizard-Slots hart auf `null` gezogen. Storage-Key bleibt `mahlzeit-state-v2`.
- **Placeholder-Pille** in `calorie-bar.js` — dritter Return-Pfad wenn `!isProfileComplete()` und `showCalorieBar !== false`. CTA "Einrichtung starten".
- **Daten-Section aktivieren** in `settings/render.js:188` — erste Row wird zum immer sichtbaren Wizard-Trigger.
- **Auto-Open in `main.js`** nach `loadState()`, `saveState()`.
- **Beta-Branding:** App-Name in `capacitor.config.json` + `strings.xml` auf `"Mahlzeit Beta"` (war `"Mahlzeit Neu"`). Package-ID-Suffix `.dev` existiert bereits (`android/app/build.gradle:12`).

**Tech Stack:** unverändert. Vanilla JS (ES Modules), Vite, CSS Custom Properties. Keine neuen Packages.

---

## Design-Entscheidungen (aus Spec)

| Frage | Entscheidung | Warum |
|---|---|---|
| Trigger-Verhalten | Auto-Open **nur beim ersten Start**, danach nur manuell | Sanfter Einstieg, kein Wiederholungs-Zwang |
| Wizard-Struktur | Gruppiert in 5 Steps (Über dich / Körper / Alltag / Mahlzeiten / Ergebnis) | 8 Felder als narrative Bündelung, 2 Felder pro Step |
| Slider-Verhalten | Stiller Default (Range-Mitte oder pragmatischer Wert), Weiter immer aktiv | Kein "empty"-Slider-Zustand nötig, User weiterklicken heißt Default akzeptieren |
| Touched-Tracking | Nur touched Felder werden persistiert — nicht touched bleiben `null` | Sonst wäre `isProfileComplete()` fälschlich true nach "Später" ohne Eingabe |
| Namensfeld | Optional, Text-Input als erstes Feld in Step 1 | Öffnet Copy-Personalisierung (Ergebnis-Screen "Fertig, {Name}"), Multi-User-Vorbereitung |
| Ergebnis-Slider | Tagesziel-Slider (1000–4000, Step 50) mit Live-Update auf Abendessen + Makros | User sieht Wirkung sofort, Refresh-Icon setzt auf Vorschlag zurück |
| Höhe des Wizard-Sheets | `88vh` (identisch zum Settings-Sheet) | Konsistent mit bestehendem Sheet-Vokabular |
| z-index | 1300 (über Settings-Sheet) | Wizard aus Daten-Section aufrufbar, muss darüber liegen |
| Kein Swipe-to-Close | Nur "Später" / Backdrop / Fertig schließen | Fortschritt sonst versehentlich verloren |
| Progress-Anzeige | Progress-Bar analog `.shop-progress__track` + Label "Schritt X von 5" | Bestehendes Pattern, kein neues Element |
| Beta-Reset-Storage-Key | Bleibt `mahlzeit-state-v2` — Migration innerhalb v2 | Kein Bump = User behält Assignment/Präferenzen/etc. |
| Beta-Branding-Trigger | Fehlen von `onboardingSeen` in geladenem Storage | Selbst-detektierender Migrations-Marker |

---

## Voraussetzungen

- **Working Directory:** `/Users/oliverwosnitza/Documents/Mahlzeit-App`
- **Branch:** `redesign` (`git branch --show-current` → `redesign`)
- **Working Tree:** sauber bis auf den frisch committeten Design-Doc (`0efd1ea`)
- **Session 12 abgeschlossen** (Makro-Popup, Preset-Chips, Slider) — Handoff [`docs/redesign/handoffs/session-11-to-12.md`](handoffs/session-11-to-12.md)

## Datei-Struktur nach dieser Session

```
Mahlzeit-App/
├── src/
│   ├── state.js                                ← geändert (profile.name, onboardingSeen, Beta-Reset)
│   ├── main.js                                 ← geändert (mountOnboardingWizard, Auto-Open)
│   ├── nutrition/
│   │   └── target.js                           ← geändert (+ isProfileComplete)
│   ├── dashboard/
│   │   └── calorie-bar.js                      ← geändert (Placeholder-Pille-Pfad)
│   ├── settings/
│   │   └── render.js                           ← geändert (Daten-Section aktivieren)
│   └── onboarding/                             ← NEU (ganzer Ordner)
│       ├── wizard.js                           ← NEU (Sheet + Nav + Draft)
│       ├── steps.js                            ← NEU (Step 1–4 Renderer)
│       └── result.js                           ← NEU (Step 5 mit Live-Slider)
├── styles/
│   └── components/
│       ├── onboarding-wizard.css               ← NEU
│       └── calorie-bar.css                     ← geändert (empty-Variante)
├── index.html                                  ← geändert (CSS-Link, Root-Div)
├── capacitor.config.json                       ← geändert (appName = "Mahlzeit Beta")
├── android/app/src/main/res/values/strings.xml ← geändert (app_name / title_activity_main)
└── docs/redesign/
    └── 2026-07-26-session-13-plan.md           ← DIESES DOKUMENT
```

---

## Task 1 — State + Migration + `isProfileComplete()`

**Files:**
- Modify: `src/state.js:65-91` (profile defaults) und `src/state.js:136-189` (loadState-Merge)
- Modify: `src/nutrition/target.js` (neue Export-Funktion)

- [ ] **Step 1.1: Profile-Defaults auf `null` ziehen und `onboardingSeen` ergänzen**

Ersetze in `src/state.js` den bisherigen `settings`-Block:

```js
  settings: {
    defaultPortions: 1,
    maxCookTime: COOKTIME_MAX,
    onboardingSeen: false,          // NEU: true sobald Wizard einmal geöffnet wurde
    preferences: {
      meat: false,
      fish: false,
      vegetarian: false,
    },
    cuisines: {
      asian: false,
      mediterranean: false,
      middleEast: false,
      americas: false,
    },
    profile: {
      // Alle Wizard-Slots starten leer — der Wizard ist die einzige Eingabequelle.
      // hasProfile() bleibt der biometrische Check, isProfileComplete() der neue
      // Ganz-Wizard-Check (inkl. activityLevel/goal/breakfastKcal/lunchKcal).
      // Name ist optional und nicht Teil beider Checks.
      name: null,
      gender: null,
      age: null,
      heightCm: null,
      weightKg: null,
      activityLevel: null,
      goal: null,
      dailyTargetOverride: null,
      breakfastKcal: null,
      lunchKcal: null,
      showCalorieBar: true,
      macroPreset: 'balanced',
      macroTargets: null,
    },
    theme: 'auto',
  },
```

- [ ] **Step 1.2: `loadState()` — Beta-Reset-Migration + neue Slots**

Ersetze in `src/state.js` den `state.settings = { ... }`-Block (aktuell Zeilen 155–184) durch:

```js
    // Settings: mergen mit Defaults, damit neue Slots beim Migrate nicht undefined sind.
    const loadedSettings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {};
    const legacyGlobalPortions = typeof parsed.globalPortions === 'number' ? parsed.globalPortions : undefined;
    // Beta-Reset (Session 13): alte Sessions, die noch keine onboardingSeen-Flag
    // haben, werden komplett durch den Wizard geführt. Wizard-Slots auf null
    // ziehen — unabhängig davon, was drin steht. Nach dem ersten saveState() ist
    // onboardingSeen: true und diese Migration greift nicht mehr.
    const isLegacyPreOnboarding = !('onboardingSeen' in loadedSettings);
    const loadedProfile = loadedSettings.profile ?? {};
    state.settings = {
      defaultPortions: loadedSettings.defaultPortions ?? legacyGlobalPortions ?? 1,
      maxCookTime: loadedSettings.maxCookTime ?? COOKTIME_MAX,
      onboardingSeen: loadedSettings.onboardingSeen ?? false,
      preferences: {
        meat: loadedSettings.preferences?.meat ?? false,
        fish: loadedSettings.preferences?.fish ?? false,
        vegetarian: loadedSettings.preferences?.vegetarian ?? false,
      },
      cuisines: {
        asian: loadedSettings.cuisines?.asian ?? false,
        mediterranean: loadedSettings.cuisines?.mediterranean ?? false,
        middleEast: loadedSettings.cuisines?.middleEast ?? false,
        americas: loadedSettings.cuisines?.americas ?? false,
      },
      profile: {
        name:                 isLegacyPreOnboarding ? null : (loadedProfile.name ?? null),
        gender:               isLegacyPreOnboarding ? null : (loadedProfile.gender ?? null),
        age:                  isLegacyPreOnboarding ? null : (loadedProfile.age ?? null),
        heightCm:             isLegacyPreOnboarding ? null : (loadedProfile.heightCm ?? null),
        weightKg:             isLegacyPreOnboarding ? null : (loadedProfile.weightKg ?? null),
        activityLevel:        isLegacyPreOnboarding ? null : (loadedProfile.activityLevel ?? null),
        goal:                 isLegacyPreOnboarding ? null : (loadedProfile.goal ?? null),
        dailyTargetOverride:  loadedProfile.dailyTargetOverride ?? null,
        breakfastKcal:        isLegacyPreOnboarding ? null : (loadedProfile.breakfastKcal ?? null),
        lunchKcal:            isLegacyPreOnboarding ? null : (loadedProfile.lunchKcal ?? null),
        showCalorieBar:       loadedProfile.showCalorieBar ?? true,
        macroPreset:          loadedProfile.macroPreset ?? 'balanced',
        macroTargets:         loadedProfile.macroTargets ?? null,
      },
      theme: loadedSettings.theme ?? 'auto',
    };
    return true;
```

- [ ] **Step 1.3: `isProfileComplete()` in `nutrition/target.js` ergänzen**

Direkt unter der bestehenden `hasProfile`-Definition (Zeile 62) einfügen:

```js
// True, wenn ALLE Wizard-Felder gesetzt sind (Biometrie + Alltag + Mahlzeiten).
// Ergänzt hasProfile() um activityLevel, goal, breakfastKcal, lunchKcal.
// Name ist bewusst nicht Teil — er ist optional (leerer Name → Copy fällt auf
// unpersönlichen Ton zurück). Genutzt für die Placeholder-Pille-Entscheidung
// im Dashboard.
export function isProfileComplete(profile) {
  if (!hasProfile(profile)) return false;
  return (
    typeof profile.activityLevel === 'number' &&
    (profile.goal === 'maintain' || profile.goal === 'lose' || profile.goal === 'gain') &&
    typeof profile.breakfastKcal === 'number' &&
    typeof profile.lunchKcal === 'number'
  );
}
```

- [ ] **Step 1.4: Node-Sanity-Check `isProfileComplete()`**

Kurzer Command-Line-Test — deckt die drei relevanten Fälle ab:

```bash
node -e "
import('./src/nutrition/target.js').then(({ isProfileComplete }) => {
  const empty = {};
  const partial = { gender: 'male', age: 40, heightCm: 180, weightKg: 80 };
  const complete = { ...partial, activityLevel: 3, goal: 'maintain', breakfastKcal: 400, lunchKcal: 700 };
  console.log('empty:', isProfileComplete(empty), '(erwartet: false)');
  console.log('nur hasProfile:', isProfileComplete(partial), '(erwartet: false)');
  console.log('komplett:', isProfileComplete(complete), '(erwartet: true)');
});
"
```

Erwartete Ausgabe: `false`, `false`, `true`.

- [ ] **Step 1.5: Commit**

```bash
git add src/state.js src/nutrition/target.js
git commit -m "feat(state): profile-slots nullen + isProfileComplete + beta-reset migration"
```

---

## Task 2 — Beta-Branding

**Files:**
- Modify: `capacitor.config.json`
- Modify: `android/app/src/main/res/values/strings.xml`

- [ ] **Step 2.1: `capacitor.config.json` — appName umbenennen**

Ändere Zeile 3:

```json
  "appName": "Mahlzeit Beta",
```

- [ ] **Step 2.2: `android/app/src/main/res/values/strings.xml` — app_name + title umbenennen**

Ändere Zeilen 3–4:

```xml
    <string name="app_name">Mahlzeit Beta</string>
    <string name="title_activity_main">Mahlzeit Beta</string>
```

- [ ] **Step 2.3: `npx cap sync`**

```bash
npx cap sync
```

Erwartete Ausgabe: keine Errors, `SUCCESS`-Zeilen für web + android sync.

- [ ] **Step 2.4: Commit**

```bash
git add capacitor.config.json android/app/src/main/res/values/strings.xml
git commit -m "chore(branding): app-name auf 'Mahlzeit Beta' (nur redesign)"
```

**Note:** Vor Merge auf `main` müssen App-Name und `applicationIdSuffix ".dev"` (`android/app/build.gradle:12`) zurückgesetzt werden. Steht schon als Constraint im Handoff.

---

## Task 3 — Wizard-Sheet-Gerüst (HTML + CSS, ohne Navigation)

**Files:**
- Create: `src/onboarding/wizard.js`
- Create: `styles/components/onboarding-wizard.css`
- Modify: `index.html` (CSS-Link + Root-Div)

- [ ] **Step 3.1: `index.html` erweitern**

CSS-Link einfügen zwischen Zeile 21 (macro-popup) und `</head>`:

```html
  <link rel="stylesheet" href="/styles/components/onboarding-wizard.css" />
```

Root-Div einfügen nach Zeile 35 (`macro-popup-root`):

```html
  <div id="onboarding-root"></div>
```

- [ ] **Step 3.2: `src/onboarding/wizard.js` anlegen — Mount + Open + Close + Shell**

Vollständige Datei anlegen — Skelett mit leerem Body-Slot, Navigation folgt in Task 4:

```js
import { state } from '../state.js';
import { saveState } from '../state.js';

const TRANSITION_MS = 250;
const TOTAL_STEPS = 5;

let rootEl = null;
let onExternalChange = () => {};
let currentStep = 1;

// Draft hält die Werte, die der User im Wizard eingibt. Beim Öffnen aus dem
// aktuellen state.settings.profile pre-fillt. touched trackt pro Feld, ob der
// User es aktiv angefasst hat — nur touched-Werte werden bei "Fertig"/"Später"
// persistiert. Damit bleibt isProfileComplete() false wenn der User nur den
// stillen Default gesehen hat.
let draft = {};
let touched = {};

export function mountOnboardingWizard(el, { onChange } = {}) {
  rootEl = el;
  onExternalChange = onChange || (() => {});
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export function openOnboardingWizard() {
  if (!rootEl) throw new Error('Onboarding-Wizard nicht gemountet.');
  // Draft aus aktuellem State pre-fillen (bei First-Run alles null).
  const p = state.settings.profile;
  draft = {
    name: p.name,
    gender: p.gender,
    age: p.age,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    activityLevel: p.activityLevel,
    goal: p.goal,
    breakfastKcal: p.breakfastKcal,
    lunchKcal: p.lunchKcal,
    dailyTargetOverride: p.dailyTargetOverride,
  };
  touched = {
    name: false, gender: false, age: false, heightCm: false, weightKg: false,
    activityLevel: false, goal: false, breakfastKcal: false, lunchKcal: false,
    dailyTargetOverride: false,
  };
  currentStep = 1;

  // onboardingSeen SOFORT setzen — auch bei App-Crash während Wizard nicht wieder
  // auto-triggern. saveState() persistiert das direkt.
  state.settings.onboardingSeen = true;
  saveState();

  renderShell();
  rootEl.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => rootEl.querySelector('.onboarding-overlay').classList.add('is-open'));
  });
  document.addEventListener('keydown', handleEsc);
}

export function closeOnboardingWizard() {
  if (!rootEl || rootEl.hidden) return;
  const overlay = rootEl.querySelector('.onboarding-overlay');
  if (overlay) overlay.classList.remove('is-open');
  document.removeEventListener('keydown', handleEsc);
  setTimeout(() => {
    if (rootEl && !rootEl.querySelector('.onboarding-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
    }
  }, TRANSITION_MS);
}

function handleEsc(ev) {
  if (ev.key === 'Escape') persistAndClose();
}

// Persistiert alle touched-Felder in state.settings.profile, ruft saveState() +
// onChange, schließt Sheet. Gemeinsame Endroutine für "Fertig", "Später" und
// Backdrop-Klick.
function persistAndClose() {
  const p = state.settings.profile;
  for (const key of Object.keys(touched)) {
    if (touched[key]) {
      p[key] = draft[key];
    }
  }
  saveState();
  onExternalChange();
  closeOnboardingWizard();
}

function renderShell() {
  const progressPct = (currentStep / TOTAL_STEPS) * 100;
  rootEl.innerHTML = `
    <div class="onboarding-overlay" data-role="backdrop">
      <div class="onboarding-sheet" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div class="onboarding-handle" aria-hidden="true"></div>
        <div class="onboarding-header">
          <div class="onboarding-header__row">
            <button class="onboarding-later" type="button" data-action="later">Später</button>
            <h2 class="onboarding-header__title" id="onboarding-title">Einrichtung</h2>
            <span class="onboarding-header__spacer" aria-hidden="true"></span>
          </div>
          <div class="onboarding-progress">
            <div class="onboarding-progress__label">Schritt ${currentStep} von ${TOTAL_STEPS}</div>
            <div class="onboarding-progress__track"
                 role="progressbar"
                 aria-valuemin="1"
                 aria-valuemax="${TOTAL_STEPS}"
                 aria-valuenow="${currentStep}">
              <div class="onboarding-progress__fill" style="width: ${progressPct}%"></div>
            </div>
          </div>
        </div>
        <div class="onboarding-body" data-role="step-slot">
          <!-- Step-Content kommt in Task 4/5/6/7/8/9 -->
          <p class="onboarding-placeholder">Step ${currentStep}</p>
        </div>
        <div class="onboarding-footer" data-role="footer-slot">
          <!-- Nav-Buttons kommen in Task 4 -->
        </div>
      </div>
    </div>
  `;
  attachShellHandlers();
}

function attachShellHandlers() {
  const overlay = rootEl.querySelector('[data-role="backdrop"]');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) persistAndClose();
  });
  rootEl.querySelector('[data-action="later"]').addEventListener('click', persistAndClose);
}
```

- [ ] **Step 3.3: `styles/components/onboarding-wizard.css` anlegen — Sheet-Grundstruktur**

Vollständige Datei — Layout analog zu `settings-sheet.css`. Progress-Pattern aus `.shop-progress__track/__fill` übernommen.

```css
/* Onboarding-Wizard — Bottom-Sheet, 88vh, z-index über Settings-Sheet.
   Slide-up-Animation via .is-open Class-Toggle. Kein Swipe-to-Close — nur
   "Später"-Button und Backdrop-Klick lösen den Persist-und-Close-Flow aus. */

.onboarding-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1300;
  opacity: 0;
  pointer-events: none;
  transition: opacity 250ms ease;
}
.onboarding-overlay.is-open {
  opacity: 1;
  pointer-events: auto;
}

.onboarding-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 88vh;
  background: var(--md-sys-color-surface);
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  transform: translateY(100%);
  transition: transform 250ms cubic-bezier(0.2, 0, 0, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.onboarding-overlay.is-open .onboarding-sheet {
  transform: translateY(0);
}

.onboarding-handle {
  width: 40px;
  height: 4px;
  background: var(--md-sys-color-on-surface-variant);
  opacity: 0.4;
  border-radius: 999px;
  margin: 10px auto 0;
  flex-shrink: 0;
}

/* Header: Zeile 1 mit Später / Titel / Spacer. Zeile 2 mit Progress-Label +
   Progress-Bar. Später-Button links, Titel mittig via Grid mit Spacer rechts. */
.onboarding-header {
  padding: 12px 16px 16px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}
.onboarding-header__row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.onboarding-later {
  justify-self: start;
  min-height: var(--touch-target-min);
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.9375rem;
  cursor: pointer;
  border-radius: 999px;
}
.onboarding-later:active {
  background: var(--md-sys-color-surface-container);
}
.onboarding-header__title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  text-align: center;
}
.onboarding-header__spacer {
  /* nur da, damit der Titel im Grid mittig bleibt */
}

/* Progress-Zeile — analog zu .shop-progress__track/__fill. */
.onboarding-progress__label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
  margin-bottom: 6px;
  font-variant-numeric: tabular-nums;
}
.onboarding-progress__track {
  height: 6px;
  border-radius: 999px;
  background: var(--md-sys-color-primary-track);
  overflow: hidden;
}
.onboarding-progress__fill {
  height: 100%;
  border-radius: 999px;
  background: var(--md-sys-color-primary);
  transition: width 250ms cubic-bezier(0.2, 0, 0, 1);
}

/* Body: scrollbar, viel Padding. Placeholder für Task 3 — wird in Task 4 durch
   den Step-Renderer ersetzt. */
.onboarding-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 24px 20px;
}
.onboarding-placeholder {
  text-align: center;
  color: var(--md-sys-color-on-surface-variant);
}

/* Footer: fix, mit Padding. Zurück / Weiter / Fertig kommen in Task 4. */
.onboarding-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}
.onboarding-footer:empty {
  display: none;
}
```

- [ ] **Step 3.4: In `main.js` einbauen und temporär auf Auto-Open testen**

Import hinzufügen (nach Zeile 10, vor `attachViewSwipe`):

```js
import { mountOnboardingWizard, openOnboardingWizard } from './onboarding/wizard.js';
```

Root-Konstante ergänzen (nach Zeile 23, vor `bottomNavRoot`):

```js
const onboardingRoot = document.getElementById('onboarding-root');
```

Mount-Aufruf ergänzen (nach `mountMacroPopup`-Block, Zeile 78-81):

```js
mountOnboardingWizard(onboardingRoot, { onChange: refresh });
```

**Temporärer Test-Trigger** (wird in Task 12 durch die richtige Auto-Open-Logik ersetzt): unten in `main.js`, vor `refresh()` einfügen:

```js
// TEMP: manueller Test-Trigger für Wizard-Gerüst — in Task 12 durch Auto-Open ersetzt
window.__testWizard = openOnboardingWizard;
```

- [ ] **Step 3.5: Sheet visuell testen**

```bash
npm run dev
```

Im Browser: DevTools-Console öffnen, `__testWizard()` eingeben. Sheet muss von unten slide-up-en, "Später" muss schließen, Backdrop-Klick muss schließen, Progress-Bar zeigt 20 %.

- [ ] **Step 3.6: Commit**

```bash
git add index.html src/main.js src/onboarding/wizard.js styles/components/onboarding-wizard.css
git commit -m "feat(onboarding): sheet-gerüst mit header/progress/footer-slot"
```

---

## Task 4 — Navigation + Draft-State + Footer-Buttons

**Files:**
- Modify: `src/onboarding/wizard.js`

- [ ] **Step 4.1: `renderShell()` erweitern um Step-Renderer-Dispatch und Footer-Renderer**

Erweitere `renderShell()` in `src/onboarding/wizard.js` — ersetze die `data-role="step-slot"` und `data-role="footer-slot"` Divs mit Aufrufen an neue Funktionen `renderStepContent()` und `renderFooter()`:

Ersetze innerhalb der `renderShell()`-Funktion den Body- und Footer-Block:

```js
        <div class="onboarding-body" data-role="step-slot">
          ${renderStepContent()}
        </div>
        <div class="onboarding-footer" data-role="footer-slot">
          ${renderFooter()}
        </div>
```

- [ ] **Step 4.2: `renderStepContent()` als temporären Dispatcher hinzufügen**

Direkt unter `renderShell()` einfügen — der echte Content für die Steps folgt in Tasks 5–9, hier nur ein Placeholder:

```js
function renderStepContent() {
  return `<p class="onboarding-placeholder">Step ${currentStep} — Content folgt.</p>`;
}
```

- [ ] **Step 4.3: `renderFooter()` mit Zurück/Weiter/Fertig-Buttons**

Direkt unter `renderStepContent()` einfügen:

```js
function renderFooter() {
  const isFirst = currentStep === 1;
  const isLast = currentStep === TOTAL_STEPS;
  const primaryLabel = isLast ? 'Fertig' : 'Weiter';
  const primaryAction = isLast ? 'finish' : 'next';
  const back = isFirst
    ? '<span class="onboarding-footer__spacer" aria-hidden="true"></span>'
    : `<button class="onboarding-btn onboarding-btn--tertiary" type="button" data-action="back">Zurück</button>`;
  return `
    ${back}
    <button class="onboarding-btn onboarding-btn--primary" type="button" data-action="${primaryAction}">${primaryLabel}</button>
  `;
}
```

- [ ] **Step 4.4: Navigation-Handler in `attachShellHandlers()` ergänzen**

Erweitere `attachShellHandlers()` — nach dem Later-Handler die Next/Back/Finish-Handler ergänzen:

```js
function attachShellHandlers() {
  const overlay = rootEl.querySelector('[data-role="backdrop"]');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) persistAndClose();
  });
  rootEl.querySelector('[data-action="later"]').addEventListener('click', persistAndClose);

  const nextBtn = rootEl.querySelector('[data-action="next"]');
  if (nextBtn) nextBtn.addEventListener('click', goNext);
  const backBtn = rootEl.querySelector('[data-action="back"]');
  if (backBtn) backBtn.addEventListener('click', goBack);
  const finishBtn = rootEl.querySelector('[data-action="finish"]');
  if (finishBtn) finishBtn.addEventListener('click', persistAndClose);

  attachStepHandlers();
}

function goNext() {
  if (currentStep < TOTAL_STEPS) {
    currentStep++;
    renderShell();
  }
}

function goBack() {
  if (currentStep > 1) {
    currentStep--;
    renderShell();
  }
}

// Placeholder — pro Step werden in Tasks 5–9 die Field-Handler ergänzt.
function attachStepHandlers() {
  // wird in späteren Tasks pro Step gefüllt
}
```

- [ ] **Step 4.5: Button-Styles in `onboarding-wizard.css` ergänzen**

Am Ende der Datei einfügen:

```css
.onboarding-btn {
  min-height: var(--touch-target-min);
  padding: 10px 24px;
  border-radius: 999px;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.onboarding-btn--primary {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  margin-left: auto;
}
.onboarding-btn--tertiary {
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
}
.onboarding-btn--tertiary:active {
  background: var(--md-sys-color-surface-container);
}
.onboarding-btn:active {
  transform: scale(0.98);
}
.onboarding-footer__spacer {
  flex: 0 0 auto;
  visibility: hidden;
}
```

- [ ] **Step 4.6: Browser-Test Navigation**

`__testWizard()` erneut aufrufen. Weiter-Button muss zu Step 2 gehen, Zurück muss zurück, Progress-Bar animiert. Auf Step 5 muss der Button "Fertig" heißen und das Sheet schließen.

- [ ] **Step 4.7: Commit**

```bash
git add src/onboarding/wizard.js styles/components/onboarding-wizard.css
git commit -m "feat(onboarding): step-navigation mit zurück/weiter/fertig"
```

---

## Task 5 — Step 1: Über dich (Name + Geschlecht + Alter)

**Files:**
- Create: `src/onboarding/steps.js`
- Modify: `src/onboarding/wizard.js` (Import + Dispatcher)
- Modify: `styles/components/onboarding-wizard.css` (Field-Styles)

- [ ] **Step 5.1: `src/onboarding/steps.js` anlegen mit Step 1 Renderer**

```js
import { AGE_MIN, AGE_MAX } from '../nutrition/target.js';

// Field-Konstanten für stille Defaults. Werden angezeigt wenn Draft-Wert null
// ist — der User sieht einen sinnvollen Startwert, muss aber aktiv klicken/
// ziehen, damit das Feld als touched zählt und persistiert wird.
export const DEFAULTS = {
  gender: 'male',
  age: 40,
  heightCm: 180,
  weightKg: 80,
  activityLevel: 3,
  goal: 'maintain',
  breakfastKcal: 400,
  lunchKcal: 700,
};

// Step 1: Über dich — Name (optional Text-Input) + Geschlecht (2 Chips) + Alter
// (Stepper). Draft-Werte werden aus dem übergebenen draft-Object gelesen; Chip-
// Aktive-States über aria-pressed. Handler kommen in wizard.js.
export function renderStep1(draft) {
  const nameVal = draft.name ?? '';
  const genderVal = draft.gender ?? DEFAULTS.gender;
  const ageVal = draft.age ?? DEFAULTS.age;
  const ageMinusDisabled = ageVal <= AGE_MIN;
  const agePlusDisabled = ageVal >= AGE_MAX;
  return `
    <h3 class="onboarding-step__title">Über dich</h3>
    <p class="onboarding-step__desc">Damit wir deinen täglichen Kalorienbedarf berechnen können.</p>

    <div class="onboarding-field">
      <label class="onboarding-field__label" for="onb-name">Wie sollen wir dich nennen?</label>
      <input class="onboarding-input"
             id="onb-name"
             type="text"
             maxlength="30"
             value="${escapeAttr(nameVal)}"
             placeholder="Dein Name (optional)"
             data-action="name-change" />
    </div>

    <div class="onboarding-field">
      <div class="onboarding-field__label">Geschlecht</div>
      <div class="onboarding-chips" role="group" aria-label="Geschlecht">
        <button class="pref-chip" type="button" data-action="gender-pick" data-value="female" aria-pressed="${genderVal === 'female'}">Weiblich</button>
        <button class="pref-chip" type="button" data-action="gender-pick" data-value="male" aria-pressed="${genderVal === 'male'}">Männlich</button>
      </div>
    </div>

    <div class="onboarding-field">
      <div class="onboarding-field__row">
        <div class="onboarding-field__label">Alter</div>
        <div class="stepper stepper--compact" role="group" aria-label="Alter">
          <button class="stepper__btn" type="button" data-action="age-minus" aria-label="Weniger" ${ageMinusDisabled ? 'disabled' : ''}>−</button>
          <span class="stepper__value" data-role="age-value">${ageVal}</span>
          <button class="stepper__btn" type="button" data-action="age-plus" aria-label="Mehr" ${agePlusDisabled ? 'disabled' : ''}>+</button>
        </div>
      </div>
    </div>
  `;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

- [ ] **Step 5.2: Import in `wizard.js` und Dispatcher erweitern**

Import oben in `src/onboarding/wizard.js` ergänzen (unter dem `saveState`-Import):

```js
import { renderStep1, DEFAULTS } from './steps.js';
import { AGE_MIN, AGE_MAX } from '../nutrition/target.js';
```

`renderStepContent()`-Funktion ersetzen:

```js
function renderStepContent() {
  switch (currentStep) {
    case 1: return renderStep1(draft);
    // Steps 2–5 folgen in Tasks 6–9
    default: return `<p class="onboarding-placeholder">Step ${currentStep} — Content folgt.</p>`;
  }
}
```

- [ ] **Step 5.3: `attachStepHandlers()` für Step 1**

Ersetze den Placeholder `attachStepHandlers()`:

```js
function attachStepHandlers() {
  if (currentStep === 1) attachStep1Handlers();
  // Steps 2–5 folgen in Tasks 6–9
}

function attachStep1Handlers() {
  // Name (touched sobald Input-Event feuert, auch bei leerem String)
  const nameInput = rootEl.querySelector('[data-action="name-change"]');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const v = nameInput.value.trim();
      draft.name = v === '' ? null : v;
      touched.name = true;
    });
  }

  // Geschlecht-Chips (touched sobald aktiver Klick)
  rootEl.querySelectorAll('[data-action="gender-pick"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value;
      draft.gender = val;
      touched.gender = true;
      rootEl.querySelectorAll('[data-action="gender-pick"]').forEach((other) => {
        other.setAttribute('aria-pressed', String(other.dataset.value === val));
      });
    });
  });

  // Alter-Stepper (touched sobald Klick, Draft aus Default seeden)
  const ageMinus = rootEl.querySelector('[data-action="age-minus"]');
  const agePlus = rootEl.querySelector('[data-action="age-plus"]');
  const ageValEl = rootEl.querySelector('[data-role="age-value"]');
  const changeAge = (delta) => {
    const current = draft.age ?? DEFAULTS.age;
    const next = Math.max(AGE_MIN, Math.min(AGE_MAX, current + delta));
    draft.age = next;
    touched.age = true;
    if (ageValEl) ageValEl.textContent = String(next);
    if (ageMinus) ageMinus.disabled = next <= AGE_MIN;
    if (agePlus) agePlus.disabled = next >= AGE_MAX;
  };
  if (ageMinus) ageMinus.addEventListener('click', () => changeAge(-1));
  if (agePlus) agePlus.addEventListener('click', () => changeAge(+1));
}
```

- [ ] **Step 5.4: Step-Styles in `onboarding-wizard.css` ergänzen**

Am Ende der Datei einfügen:

```css
/* Step-Content — großzügige Abstände, Titel und Beschreibung oben. */
.onboarding-step__title {
  margin: 0 0 8px 0;
  font-size: 1.375rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}
.onboarding-step__desc {
  margin: 0 0 24px 0;
  font-size: 0.9375rem;
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.4;
}

.onboarding-field {
  margin-bottom: 24px;
}
.onboarding-field__label {
  display: block;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  margin-bottom: 10px;
}
.onboarding-field__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.onboarding-input {
  width: 100%;
  min-height: var(--touch-target-min);
  padding: 10px 14px;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: 12px;
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  font-size: 1rem;
  box-sizing: border-box;
}
.onboarding-input:focus {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: -1px;
  border-color: transparent;
}

.onboarding-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
```

- [ ] **Step 5.5: Browser-Test Step 1**

`__testWizard()` — Step 1 muss Titel "Über dich", Beschreibung, Name-Input, Gender-Chips und Alter-Stepper zeigen. Chips wechseln aria-pressed bei Klick, Stepper zählt hoch/runter, Name-Input akzeptiert Text. Weiter → Step 2 (Placeholder). Zurück → Step 1, Werte sind noch da (draft überlebt).

- [ ] **Step 5.6: Commit**

```bash
git add src/onboarding/steps.js src/onboarding/wizard.js styles/components/onboarding-wizard.css
git commit -m "feat(onboarding): step 1 (über dich) — name/gender/alter"
```

---

## Task 6 — Step 2: Körper (Größe + Gewicht)

**Files:**
- Modify: `src/onboarding/steps.js` (renderStep2)
- Modify: `src/onboarding/wizard.js` (Dispatcher + Handler)

- [ ] **Step 6.1: `renderStep2()` in `steps.js` ergänzen**

Am Ende der Datei einfügen (vor `escapeAttr`):

```js
export function renderStep2(draft) {
  const heightVal = draft.heightCm ?? DEFAULTS.heightCm;
  const weightVal = draft.weightKg ?? DEFAULTS.weightKg;
  return `
    <h3 class="onboarding-step__title">Körper</h3>
    <p class="onboarding-step__desc">Für die Berechnung des Grundumsatzes.</p>

    <div class="onboarding-field">
      <div class="onboarding-field__row">
        <div class="onboarding-field__label">Größe</div>
        <div class="onboarding-field__value" data-role="height-value">${heightVal} cm</div>
      </div>
      <input class="settings-slider"
             type="range"
             min="140"
             max="220"
             step="1"
             value="${heightVal}"
             data-action="height-change"
             aria-label="Größe in Zentimetern" />
    </div>

    <div class="onboarding-field">
      <div class="onboarding-field__row">
        <div class="onboarding-field__label">Gewicht</div>
        <div class="onboarding-field__value" data-role="weight-value">${weightVal} kg</div>
      </div>
      <input class="settings-slider"
             type="range"
             min="40"
             max="200"
             step="1"
             value="${weightVal}"
             data-action="weight-change"
             aria-label="Gewicht in Kilogramm" />
    </div>
  `;
}
```

- [ ] **Step 6.2: Dispatcher in `wizard.js` erweitern**

Import ergänzen:

```js
import { renderStep1, renderStep2, DEFAULTS } from './steps.js';
```

`renderStepContent()` erweitern:

```js
function renderStepContent() {
  switch (currentStep) {
    case 1: return renderStep1(draft);
    case 2: return renderStep2(draft);
    default: return `<p class="onboarding-placeholder">Step ${currentStep} — Content folgt.</p>`;
  }
}
```

- [ ] **Step 6.3: Handler für Step 2**

`attachStepHandlers()` erweitern:

```js
function attachStepHandlers() {
  if (currentStep === 1) attachStep1Handlers();
  if (currentStep === 2) attachStep2Handlers();
}

function attachStep2Handlers() {
  bindSlider('height-change', 'height-value', 'heightCm', (v) => `${v} cm`);
  bindSlider('weight-change', 'weight-value', 'weightKg', (v) => `${v} kg`);
}

// Slider-Binding-Helper: setzt Draft + touched auf input, aktualisiert Value-Label
// live. Wird auch in Tasks 7 und 8 verwendet (activityLevel-Slider gibt's nicht,
// nur breakfast/lunch/dailyTargetOverride).
function bindSlider(action, valueRole, draftKey, formatter) {
  const slider = rootEl.querySelector(`[data-action="${action}"]`);
  const valEl = rootEl.querySelector(`[data-role="${valueRole}"]`);
  if (!slider) return;
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value, 10);
    draft[draftKey] = v;
    touched[draftKey] = true;
    if (valEl) valEl.textContent = formatter(v);
  });
}
```

- [ ] **Step 6.4: Field-Value-Style in `onboarding-wizard.css`**

Am Ende einfügen:

```css
.onboarding-field__value {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 6.5: Browser-Test Step 2**

Weiter aus Step 1 → Step 2 zeigt Größe/Gewicht mit Slidern. Slider-Bewegung updated Wert-Label live. Zurück → Step 1, Vorwärts → Step 2, Werte bleiben.

- [ ] **Step 6.6: Commit**

```bash
git add src/onboarding/steps.js src/onboarding/wizard.js styles/components/onboarding-wizard.css
git commit -m "feat(onboarding): step 2 (körper) — größe/gewicht slider"
```

---

## Task 7 — Step 3: Alltag (Aktivität + Ziel)

**Files:**
- Modify: `src/onboarding/steps.js`
- Modify: `src/onboarding/wizard.js`

- [ ] **Step 7.1: Top-Import in `steps.js` erweitern**

Ersetze in `src/onboarding/steps.js` die erste Zeile:

```js
import { AGE_MIN, AGE_MAX } from '../nutrition/target.js';
```

durch:

```js
import { AGE_MIN, AGE_MAX, ACTIVITY_LEVELS, GOALS } from '../nutrition/target.js';
```

- [ ] **Step 7.2: `renderStep3()` in `steps.js` ergänzen**

Am Ende der Datei einfügen (vor der `escapeAttr`-Funktion):

```js
export function renderStep3(draft) {
  const activityVal = draft.activityLevel ?? DEFAULTS.activityLevel;
  const goalVal = draft.goal ?? DEFAULTS.goal;
  return `
    <h3 class="onboarding-step__title">Alltag</h3>
    <p class="onboarding-step__desc">Wie aktiv bist du und was möchtest du erreichen?</p>

    <div class="onboarding-field">
      <div class="onboarding-field__label">Aktivität</div>
      <div class="onboarding-chips onboarding-chips--nowrap" role="group" aria-label="Aktivitätslevel">
        ${ACTIVITY_LEVELS.map((a) => `
          <button class="pref-chip" type="button" data-action="activity-pick" data-value="${a.level}" aria-pressed="${activityVal === a.level}">${a.label}</button>
        `).join('')}
      </div>
    </div>

    <div class="onboarding-field">
      <div class="onboarding-field__label">Ziel</div>
      <div class="onboarding-chips" role="group" aria-label="Ziel">
        ${GOALS.map((g) => `
          <button class="pref-chip" type="button" data-action="goal-pick" data-value="${g.key}" aria-pressed="${goalVal === g.key}">${g.label}</button>
        `).join('')}
      </div>
    </div>
  `;
}
```

- [ ] **Step 7.3: Dispatcher + Handler**

In `wizard.js` — Import:

```js
import { renderStep1, renderStep2, renderStep3, DEFAULTS } from './steps.js';
```

`renderStepContent()`:

```js
function renderStepContent() {
  switch (currentStep) {
    case 1: return renderStep1(draft);
    case 2: return renderStep2(draft);
    case 3: return renderStep3(draft);
    default: return `<p class="onboarding-placeholder">Step ${currentStep} — Content folgt.</p>`;
  }
}
```

`attachStepHandlers()`:

```js
function attachStepHandlers() {
  if (currentStep === 1) attachStep1Handlers();
  if (currentStep === 2) attachStep2Handlers();
  if (currentStep === 3) attachStep3Handlers();
}

function attachStep3Handlers() {
  bindChipGroup('activity-pick', 'activityLevel', (v) => parseInt(v, 10));
  bindChipGroup('goal-pick', 'goal', (v) => v);
}

// Chip-Binding-Helper: Klick setzt Draft + touched, aktualisiert aria-pressed
// aller Chips in der Gruppe. parser konvertiert data-value (String) in den
// Draft-Typ (number für activityLevel, string für gender/goal).
function bindChipGroup(action, draftKey, parser) {
  rootEl.querySelectorAll(`[data-action="${action}"]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = parser(btn.dataset.value);
      draft[draftKey] = val;
      touched[draftKey] = true;
      rootEl.querySelectorAll(`[data-action="${action}"]`).forEach((other) => {
        other.setAttribute('aria-pressed', String(parser(other.dataset.value) === val));
      });
    });
  });
}
```

- [ ] **Step 7.4: CSS für nowrap-Chip-Reihe**

Am Ende von `onboarding-wizard.css`:

```css
.onboarding-chips--nowrap {
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}
.onboarding-chips--nowrap::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 7.5: Browser-Test Step 3**

Step 3 zeigt 5 Aktivitätslevel-Chips (nowrap, horizontal scrollbar wenn nötig) und 3 Ziel-Chips. aria-pressed toggelt korrekt.

- [ ] **Step 7.6: Commit**

```bash
git add src/onboarding/steps.js src/onboarding/wizard.js styles/components/onboarding-wizard.css
git commit -m "feat(onboarding): step 3 (alltag) — aktivität/ziel chips"
```

---

## Task 8 — Step 4: Mahlzeiten (Frühstück + Mittag)

**Files:**
- Modify: `src/onboarding/steps.js`
- Modify: `src/onboarding/wizard.js`

- [ ] **Step 8.1: `renderStep4()` in `steps.js` ergänzen**

Am Ende (vor `escapeAttr`):

```js
export function renderStep4(draft) {
  const breakfastVal = draft.breakfastKcal ?? DEFAULTS.breakfastKcal;
  const lunchVal = draft.lunchKcal ?? DEFAULTS.lunchKcal;
  return `
    <h3 class="onboarding-step__title">Mahlzeiten</h3>
    <p class="onboarding-step__desc">Was isst du typischerweise vor dem Abendessen? Der Rest wird dein Abend-Ziel.</p>

    <div class="onboarding-field">
      <div class="onboarding-field__row">
        <div class="onboarding-field__label">Frühstück</div>
        <div class="onboarding-field__value" data-role="breakfast-value">${breakfastVal.toLocaleString('de-DE')} kcal</div>
      </div>
      <input class="settings-slider"
             type="range"
             min="100"
             max="1000"
             step="50"
             value="${breakfastVal}"
             data-action="breakfast-change"
             aria-label="Frühstück-Kalorien" />
    </div>

    <div class="onboarding-field">
      <div class="onboarding-field__row">
        <div class="onboarding-field__label">Mittag</div>
        <div class="onboarding-field__value" data-role="lunch-value">${lunchVal.toLocaleString('de-DE')} kcal</div>
      </div>
      <input class="settings-slider"
             type="range"
             min="100"
             max="1000"
             step="50"
             value="${lunchVal}"
             data-action="lunch-change"
             aria-label="Mittag-Kalorien" />
    </div>
  `;
}
```

- [ ] **Step 8.2: Dispatcher + Handler in `wizard.js`**

Import:

```js
import { renderStep1, renderStep2, renderStep3, renderStep4, DEFAULTS } from './steps.js';
```

`renderStepContent()`:

```js
function renderStepContent() {
  switch (currentStep) {
    case 1: return renderStep1(draft);
    case 2: return renderStep2(draft);
    case 3: return renderStep3(draft);
    case 4: return renderStep4(draft);
    default: return `<p class="onboarding-placeholder">Step ${currentStep} — Content folgt.</p>`;
  }
}
```

`attachStepHandlers()`:

```js
function attachStepHandlers() {
  if (currentStep === 1) attachStep1Handlers();
  if (currentStep === 2) attachStep2Handlers();
  if (currentStep === 3) attachStep3Handlers();
  if (currentStep === 4) attachStep4Handlers();
}

function attachStep4Handlers() {
  const fmt = (v) => `${v.toLocaleString('de-DE')} kcal`;
  bindSlider('breakfast-change', 'breakfast-value', 'breakfastKcal', fmt);
  bindSlider('lunch-change', 'lunch-value', 'lunchKcal', fmt);
}
```

- [ ] **Step 8.3: Browser-Test Step 4**

Frühstück/Mittag als Slider, Werte in "de-DE" formatiert (kein Punkt bei 400/700 aber "1.000" bei 1000). Slider-Bewegung updated live.

- [ ] **Step 8.4: Commit**

```bash
git add src/onboarding/steps.js src/onboarding/wizard.js
git commit -m "feat(onboarding): step 4 (mahlzeiten) — frühstück/mittag slider"
```

---

## Task 9 — Step 5: Ergebnis (Anzeige + Live-Slider)

**Files:**
- Create: `src/onboarding/result.js`
- Modify: `src/onboarding/wizard.js`
- Modify: `styles/components/onboarding-wizard.css`

- [ ] **Step 9.1: `src/onboarding/result.js` anlegen**

Rechenlogik: mergt `draft` mit `state.settings.profile` (für hasProfile-Check), berechnet `dailyTarget` und `dinnerTarget`. Der Slider ändert `draft.dailyTargetOverride`.

```js
import {
  dailyTarget,
  effectiveDailyTarget,
  dinnerTarget,
  MACRO_PRESETS,
  MACRO_PRESET_DEFAULT,
} from '../nutrition/target.js';
import { state } from '../state.js';
import { DEFAULTS } from './steps.js';

const ICON_REFRESH = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;

// Baut ein temporäres Profile-Object aus draft (mit Defaults für nicht-touched
// Slider), damit dailyTarget()/dinnerTarget() rechnen können. Wenn essentielle
// Felder fehlen (z. B. gender), gibt useResolvedProfile null zurück — dann
// zeigen wir eine "Bitte vorherige Schritte ausfüllen"-Notiz statt Zahlen.
function resolvedProfile(draft) {
  const p = state.settings.profile;
  const merged = {
    gender: draft.gender ?? p.gender,
    age: draft.age ?? p.age,
    heightCm: draft.heightCm ?? p.heightCm,
    weightKg: draft.weightKg ?? p.weightKg,
    activityLevel: draft.activityLevel ?? p.activityLevel,
    goal: draft.goal ?? p.goal,
    breakfastKcal: draft.breakfastKcal ?? p.breakfastKcal ?? DEFAULTS.breakfastKcal,
    lunchKcal: draft.lunchKcal ?? p.lunchKcal ?? DEFAULTS.lunchKcal,
    dailyTargetOverride: draft.dailyTargetOverride ?? null,
    macroPreset: p.macroPreset ?? MACRO_PRESET_DEFAULT,
    macroTargets: null, // Ergebnis nutzt immer das Preset
  };
  // Für die Berechnung dürfen gender/age/heightCm/weightKg/activityLevel/goal
  // nicht null sein. Fallbacks aus DEFAULTS greifen — der Draft ist im letzten
  // Step evtl. unvollständig (User hat übersprungen).
  merged.gender = merged.gender ?? DEFAULTS.gender;
  merged.age = merged.age ?? DEFAULTS.age;
  merged.heightCm = merged.heightCm ?? DEFAULTS.heightCm;
  merged.weightKg = merged.weightKg ?? DEFAULTS.weightKg;
  merged.activityLevel = merged.activityLevel ?? DEFAULTS.activityLevel;
  merged.goal = merged.goal ?? DEFAULTS.goal;
  return merged;
}

// Skaliert Preset (P/KH/F Prozente) auf gegebene Dinner-kcal. Rundet auf
// ganze Gramm für die Anzeige.
function macrosForKcal(kcalTarget, presetKey) {
  const preset = MACRO_PRESETS.find((m) => m.key === presetKey) ?? MACRO_PRESETS[0];
  return {
    p: Math.round((kcalTarget * (preset.p / 100)) / 4),
    kh: Math.round((kcalTarget * (preset.kh / 100)) / 4),
    f: Math.round((kcalTarget * (preset.f / 100)) / 9),
    kcal: Math.round(kcalTarget),
  };
}

export function renderStep5(draft) {
  const p = resolvedProfile(draft);
  const suggestion = dailyTarget(p);   // ohne Override
  const effective = effectiveDailyTarget(p); // mit Override falls gesetzt
  const dinner = dinnerTarget(p);
  const isOverride = draft.dailyTargetOverride != null && draft.dailyTargetOverride !== suggestion;
  const macros = dinner != null ? macrosForKcal(dinner, p.macroPreset) : null;
  const nameGreeting = draft.name ? `, ${draft.name}` : '';
  const fmt = (n) => n == null ? '—' : n.toLocaleString('de-DE');
  const sliderVal = effective ?? DEFAULTS.breakfastKcal + DEFAULTS.lunchKcal + 500;
  return `
    <h3 class="onboarding-step__title">Fertig${nameGreeting}.</h3>
    <p class="onboarding-step__desc">Dein Bedarf ist bereit.</p>

    <div class="onboarding-result__card onboarding-result__card--primary">
      <div class="onboarding-result__card-header">
        <span class="onboarding-result__label">Tages-Bedarf</span>
        <button class="settings-refresh"
                type="button"
                data-action="target-reset"
                data-role="target-reset"
                ${isOverride ? '' : 'hidden'}
                aria-label="Vorschlag wiederherstellen">
          ${ICON_REFRESH}
        </button>
      </div>
      <div class="onboarding-result__value onboarding-result__value--big" data-role="target-value">${fmt(effective)} kcal</div>
      <input class="settings-slider"
             type="range"
             min="1000"
             max="4000"
             step="50"
             value="${sliderVal}"
             data-action="target-change"
             aria-label="Tageskalorien-Ziel" />
      <div class="onboarding-result__suggestion" data-role="target-suggestion" ${isOverride ? '' : 'hidden'}>
        Vorschlag: ${fmt(suggestion)} kcal
      </div>
    </div>

    <div class="onboarding-result__row">
      <div class="onboarding-result__card">
        <div class="onboarding-result__label">Frühstück</div>
        <div class="onboarding-result__value">${fmt(draft.breakfastKcal ?? DEFAULTS.breakfastKcal)} kcal</div>
      </div>
      <div class="onboarding-result__card">
        <div class="onboarding-result__label">Mittag</div>
        <div class="onboarding-result__value">${fmt(draft.lunchKcal ?? DEFAULTS.lunchKcal)} kcal</div>
      </div>
    </div>

    <div class="onboarding-result__card onboarding-result__card--accent">
      <div class="onboarding-result__label">Abendessen</div>
      <div class="onboarding-result__value onboarding-result__value--big" data-role="dinner-value">${fmt(dinner)} kcal</div>
    </div>

    ${macros ? `
      <div class="onboarding-result__macros" data-role="macros-slot">
        ${renderMacros(macros)}
      </div>
    ` : ''}

    <p class="onboarding-result__note">Du kannst alle Werte später in den Einstellungen anpassen.</p>
  `;
}

function renderMacros(macros) {
  return `
    <div class="onboarding-macro"><span class="onboarding-macro__key onboarding-macro__key--p">P</span><span>${macros.p} g</span></div>
    <div class="onboarding-macro"><span class="onboarding-macro__key onboarding-macro__key--kh">KH</span><span>${macros.kh} g</span></div>
    <div class="onboarding-macro"><span class="onboarding-macro__key onboarding-macro__key--f">F</span><span>${macros.f} g</span></div>
    <div class="onboarding-macro onboarding-macro--kcal">${macros.kcal.toLocaleString('de-DE')} kcal</div>
  `;
}

// Live-Refresh nach Slider-Bewegung oder Reset: rendert Karten neu (nur die
// betroffenen Slots), Slider-Position bleibt (der DOM-Node wird nicht ersetzt).
export function refreshResultDynamic(rootEl, draft) {
  const p = resolvedProfile(draft);
  const suggestion = dailyTarget(p);
  const effective = effectiveDailyTarget(p);
  const dinner = dinnerTarget(p);
  const isOverride = draft.dailyTargetOverride != null && draft.dailyTargetOverride !== suggestion;
  const macros = dinner != null ? macrosForKcal(dinner, p.macroPreset) : null;
  const fmt = (n) => n == null ? '—' : n.toLocaleString('de-DE');

  const targetValEl = rootEl.querySelector('[data-role="target-value"]');
  if (targetValEl) targetValEl.textContent = `${fmt(effective)} kcal`;

  const dinnerValEl = rootEl.querySelector('[data-role="dinner-value"]');
  if (dinnerValEl) dinnerValEl.textContent = `${fmt(dinner)} kcal`;

  const suggestionEl = rootEl.querySelector('[data-role="target-suggestion"]');
  if (suggestionEl) {
    suggestionEl.textContent = `Vorschlag: ${fmt(suggestion)} kcal`;
    suggestionEl.hidden = !isOverride;
  }

  const resetBtn = rootEl.querySelector('[data-role="target-reset"]');
  if (resetBtn) resetBtn.hidden = !isOverride;

  const macrosSlot = rootEl.querySelector('[data-role="macros-slot"]');
  if (macrosSlot && macros) macrosSlot.innerHTML = renderMacros(macros);
}
```

- [ ] **Step 9.2: Dispatcher + Handler in `wizard.js`**

Import ergänzen (unter dem steps.js-Import):

```js
import { renderStep5, refreshResultDynamic } from './result.js';
import { dailyTarget } from '../nutrition/target.js';
```

`renderStepContent()`:

```js
function renderStepContent() {
  switch (currentStep) {
    case 1: return renderStep1(draft);
    case 2: return renderStep2(draft);
    case 3: return renderStep3(draft);
    case 4: return renderStep4(draft);
    case 5: return renderStep5(draft);
    default: return `<p class="onboarding-placeholder">Step ${currentStep}</p>`;
  }
}
```

`attachStepHandlers()`:

```js
function attachStepHandlers() {
  if (currentStep === 1) attachStep1Handlers();
  if (currentStep === 2) attachStep2Handlers();
  if (currentStep === 3) attachStep3Handlers();
  if (currentStep === 4) attachStep4Handlers();
  if (currentStep === 5) attachStep5Handlers();
}

function attachStep5Handlers() {
  const slider = rootEl.querySelector('[data-action="target-change"]');
  if (slider) {
    slider.addEventListener('input', () => {
      draft.dailyTargetOverride = parseInt(slider.value, 10);
      touched.dailyTargetOverride = true;
      refreshResultDynamic(rootEl, draft);
    });
  }
  const resetBtn = rootEl.querySelector('[data-action="target-reset"]');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      draft.dailyTargetOverride = null;
      touched.dailyTargetOverride = true;
      // Slider wieder auf Vorschlag setzen
      if (slider) {
        const p = state.settings.profile;
        // Suggestion aus resolvedProfile-Logik gespiegelt — hier reicht dailyTarget
        // mit gemergedem profile. Wir nutzen state.settings.profile als Basis für
        // die statische Berechnung — der Draft-Kern (biometrische Felder) wurde
        // bereits im Slider-Setup verwendet.
        const mergedFake = {
          gender: draft.gender ?? p.gender ?? DEFAULTS.gender,
          age: draft.age ?? p.age ?? DEFAULTS.age,
          heightCm: draft.heightCm ?? p.heightCm ?? DEFAULTS.heightCm,
          weightKg: draft.weightKg ?? p.weightKg ?? DEFAULTS.weightKg,
          activityLevel: draft.activityLevel ?? p.activityLevel ?? DEFAULTS.activityLevel,
          goal: draft.goal ?? p.goal ?? DEFAULTS.goal,
        };
        const s = dailyTarget(mergedFake);
        if (s != null) slider.value = String(s);
      }
      refreshResultDynamic(rootEl, draft);
    });
  }
}
```

- [ ] **Step 9.3: CSS für Ergebnis-Karten in `onboarding-wizard.css`**

Am Ende einfügen:

```css
/* Ergebnis-Karten (Step 5). Große Zahlen für Tagesbedarf und Abendessen,
   kleinere für Frühstück/Mittag. Makro-Row klein und kompakt am Ende. */
.onboarding-result__card {
  background: var(--md-sys-color-surface-container);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
}
.onboarding-result__card--primary {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}
.onboarding-result__card--accent {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}
.onboarding-result__card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.onboarding-result__label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: currentColor;
  opacity: 0.85;
}
.onboarding-result__value {
  font-size: 1rem;
  font-weight: 600;
  color: currentColor;
  font-variant-numeric: tabular-nums;
}
.onboarding-result__value--big {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 4px;
}
.onboarding-result__suggestion {
  font-size: 0.8125rem;
  color: currentColor;
  opacity: 0.7;
  margin-top: 6px;
}
.onboarding-result__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
.onboarding-result__row .onboarding-result__card {
  margin-bottom: 0;
}
.onboarding-result__macros {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  background: var(--md-sys-color-surface-container-lowest);
  border-radius: 999px;
  margin-bottom: 16px;
  align-items: center;
  justify-content: space-between;
}
.onboarding-macro {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}
.onboarding-macro__key {
  font-weight: 700;
}
.onboarding-macro__key--p { color: var(--chart-color-p); }
.onboarding-macro__key--kh { color: var(--chart-color-kh); }
.onboarding-macro__key--f { color: var(--chart-color-f); }
.onboarding-macro--kcal {
  color: var(--md-sys-color-primary);
  font-weight: 700;
}
.onboarding-result__note {
  font-size: 0.8125rem;
  color: var(--md-sys-color-on-surface-variant);
  text-align: center;
  margin: 8px 0 0;
}
```

- [ ] **Step 9.4: Browser-Test Step 5**

Von Step 4 → Step 5. Titel zeigt "Fertig, {Name}." wenn Name eingegeben (sonst "Fertig."). Tages-Bedarf, Frühstück, Mittag, Abendessen, Makro-Row werden gezeigt. Slider-Bewegung updated Tagesbedarf + Abendessen + Makros LIVE. Refresh-Icon setzt zurück. "Fertig" schließt.

- [ ] **Step 9.5: Commit**

```bash
git add src/onboarding/result.js src/onboarding/wizard.js styles/components/onboarding-wizard.css
git commit -m "feat(onboarding): step 5 (ergebnis) mit live-slider"
```

---

## Task 10 — Placeholder-Pille im Dashboard

**Files:**
- Modify: `src/dashboard/calorie-bar.js`
- Modify: `styles/components/calorie-bar.css`

- [ ] **Step 10.1: `calorie-bar.js` — dritten Return-Pfad einfügen**

Ersetze die bisherige `renderCalorieBar`-Funktion (Zeile 14-57) durch:

```js
export function renderCalorieBar() {
  const { profile } = state.settings;
  if (profile.showCalorieBar === false) return '';

  // Wenn Profil unvollständig: Placeholder-Pille als Wizard-Trigger.
  // Ausnahme: showCalorieBar false → gar keine Pille (User hat sie bewusst versteckt).
  if (!isProfileComplete(profile)) {
    return `
      <button class="calorie-bar calorie-bar--empty" type="button" data-action="open-onboarding" aria-label="Einrichtung starten — Bedarfs-Anzeige aktivieren">
        <span class="calorie-bar__label">Bedarf</span>
        <span class="calorie-bar__values">
          <span class="calorie-bar__cta">Einrichtung starten</span>
        </span>
      </button>
    `;
  }

  // Vollständiges Profil: normale Bedarfs-Pille (bisheriges Verhalten).
  const target = dinnerTarget(profile);
  if (target == null || target <= 0) return '';
  const [low, high] = kcalRange(target);

  const selectedDays = DAYS.filter((d) => state.selected[d]);
  const selectedCount = selectedDays.length;
  const intakeSum = selectedDays.reduce((sum, day) => {
    const dish = dishesById.get(state.assignment[day]);
    if (!dish) return sum;
    return sum + dish.kcal * getScaleForDish(dish);
  }, 0);
  const avg = selectedCount > 0 ? Math.round(intakeSum / selectedCount) : null;

  let modifier = '';
  if (avg != null) {
    if (avg > high) modifier = 'calorie-bar--over';
    else if (avg < low) modifier = 'calorie-bar--under';
  }

  const avgText = avg == null ? '—' : `${format(avg)} kcal`;

  return `
    <button class="calorie-bar ${modifier}" type="button" data-action="open-macro-popup" aria-label="Bedarf pro Tag: Zielkorridor ${format(low)} bis ${format(high)} Kilokalorien, Durchschnitt der ausgewählten Gerichte ${avg == null ? 'nicht verfügbar' : format(avg) + ' Kilokalorien'} — Details öffnen">
      <span class="calorie-bar__label">Bedarf</span>
      <span class="calorie-bar__values">
        <span class="calorie-bar__target">${format(low)}&thinsp;–&thinsp;${format(high)} kcal</span>
      </span>
      <span class="calorie-bar__avg">
        <span class="calorie-bar__avg-label">Ø ${selectedCount}/${DAYS.length}</span>
        <span class="calorie-bar__intake">${avgText}</span>
      </span>
    </button>
  `;
}
```

**Wichtig:** Der Import für `isProfileComplete` muss oben ergänzt werden. Ersetze:

```js
import { hasProfile, dinnerTarget, kcalRange } from '../nutrition/target.js';
```

durch:

```js
import { hasProfile, isProfileComplete, dinnerTarget, kcalRange } from '../nutrition/target.js';
```

- [ ] **Step 10.2: CSS-Variant `.calorie-bar--empty` in `calorie-bar.css` ergänzen**

Am Ende der Datei einfügen:

```css
/* Placeholder-Pille für unvollständiges Profil — gleiche Basis-Geometrie wie
   die normale Bedarfs-Pille, aber zentrierter CTA-Text statt Werte. */
.calorie-bar--empty {
  justify-content: center;
}
.calorie-bar--empty .calorie-bar__values {
  flex: 0 0 auto;
}
.calorie-bar__cta {
  color: var(--md-sys-color-primary);
  font-weight: 600;
  font-size: 0.9375rem;
}
```

- [ ] **Step 10.3: `dashboard/render.js` — Signatur + Handler erweitern**

`dashboard/render.js` bindet den `open-macro-popup`-Handler direkt am Element (Zeile 40-43), nicht per Delegation. Der neue `open-onboarding`-Handler wird analog gebunden.

Ersetze in `src/dashboard/render.js` die Zeile 18:

```js
export function renderDashboard(root, onChange, onOpenDetail, onOpenPicker, onOpenMacroPopup) {
```

durch:

```js
export function renderDashboard(root, onChange, onOpenDetail, onOpenPicker, onOpenMacroPopup, onOpenOnboarding) {
```

Und ersetze den Handler-Block Zeilen 40-43:

```js
    const trigger = barEl.matches('[data-action="open-macro-popup"]') ? barEl : barEl.querySelector('[data-action="open-macro-popup"]');
    if (trigger && onOpenMacroPopup) {
      trigger.addEventListener('click', () => onOpenMacroPopup());
    }
```

durch:

```js
    const macroTrigger = barEl.matches('[data-action="open-macro-popup"]') ? barEl : barEl.querySelector('[data-action="open-macro-popup"]');
    if (macroTrigger && onOpenMacroPopup) {
      macroTrigger.addEventListener('click', () => onOpenMacroPopup());
    }
    const onboardingTrigger = barEl.matches('[data-action="open-onboarding"]') ? barEl : barEl.querySelector('[data-action="open-onboarding"]');
    if (onboardingTrigger && onOpenOnboarding) {
      onboardingTrigger.addEventListener('click', () => onOpenOnboarding());
    }
```

- [ ] **Step 10.4: `main.js` — Callback durchreichen**

In `src/main.js` — der `renderDashboard`-Aufruf hat aktuell 5 Argumente. Ergänze `openOnboardingWizard` als 6.:

```js
  renderDashboard(dashboardRoot, refresh, openDetailSheet, openDishPicker, openMacroPopup, openOnboardingWizard);
```

- [ ] **Step 10.5: Browser-Test Placeholder-Pille**

`npm run dev`, App neu laden (frischer State via DevTools `localStorage.clear()`). Auto-Open-Wizard erscheint (aus Task 3 der TEMP-Trigger — das ist ok für den Test). "Später" klicken → Placeholder-Pille steht auf Dashboard: "Bedarf / Einrichtung starten". Klick → Wizard geht wieder auf.

- [ ] **Step 10.6: Commit**

```bash
git add src/dashboard/calorie-bar.js src/dashboard/render.js src/main.js styles/components/calorie-bar.css
git commit -m "feat(dashboard): placeholder-pille als wizard-trigger bei unvollständigem profil"
```

---

## Task 11 — Settings-Trigger in Daten-Section

**Files:**
- Modify: `src/settings/render.js`
- Modify: `styles/components/settings-sheet.css`

- [ ] **Step 11.1: Daten-Section umbauen in `settings/render.js`**

Ersetze in `src/settings/render.js:188-190` den bisherigen "Kommt bald"-Block:

```js
          ${section('daten', 'Daten', `
            <div class="settings-row">
              <div class="settings-row__label">
                <div class="settings-row__label-primary">Einrichtung</div>
                <div class="settings-row__label-secondary">Profil-Werte über den Wizard neu setzen</div>
              </div>
              <button class="settings-action-btn" type="button" data-action="open-onboarding">Starten</button>
            </div>
            <p class="settings-section__note settings-section__note--soft">Kommt bald — Backup exportieren/importieren, Alle Daten zurücksetzen</p>
          `)}
```

- [ ] **Step 11.2: Button-Styles + soft note in `settings-sheet.css`**

Am Ende einfügen:

```css
.settings-action-btn {
  min-height: var(--touch-target-min);
  padding: 8px 20px;
  border-radius: 999px;
  border: 1px solid var(--md-sys-color-outline);
  background: transparent;
  color: var(--md-sys-color-primary);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
}
.settings-action-btn:active {
  background: var(--md-sys-color-surface-container);
  transform: scale(0.98);
}
.settings-section__note--soft {
  margin-top: 12px;
  opacity: 0.6;
}
```

- [ ] **Step 11.3: Handler wiring in `settings/render.js`**

Der Settings-Sheet bindet Handler in der `attachHandlers()`-Funktion (Zeile 591). Ergänze am Ende dieser Funktion (direkt vor dem schließenden `}`) den Onboarding-Trigger:

```js
  rootEl.querySelectorAll('[data-action="open-onboarding"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeSettingsSheet();
      setTimeout(() => onExternalOpenOnboarding(), TRANSITION_MS);
    });
  });
```

`onExternalOpenOnboarding` muss oben deklariert und im Mount-Setup akzeptiert werden. Ersetze:

```js
let onExternalOpenMacro = () => {};
```

durch:

```js
let onExternalOpenMacro = () => {};
let onExternalOpenOnboarding = () => {};
```

Und ersetze `mountSettingsSheet`:

```js
export function mountSettingsSheet(el, { onChange, onOpenMacro, onOpenOnboarding } = {}) {
  rootEl = el;
  onExternalChange = onChange || (() => {});
  onExternalOpenMacro = onOpenMacro || (() => {});
  onExternalOpenOnboarding = onOpenOnboarding || (() => {});
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}
```

- [ ] **Step 11.4: `main.js` — Callback durchreichen**

In `src/main.js` — erweitere den `mountSettingsSheet`-Aufruf:

```js
mountSettingsSheet(settingsRoot, {
  onChange: refresh,
  onOpenMacro: () => openMacroPopup(),
  onOpenOnboarding: () => openOnboardingWizard(),
});
```

- [ ] **Step 11.5: Browser-Test Settings-Trigger**

Settings-Sheet öffnen (Header-Zahnrad), zur Daten-Section scrollen, "Starten"-Button klicken. Settings-Sheet muss schließen, Wizard direkt danach aufgehen. In den Wizard eingegebene Werte sollen beim nächsten Öffnen aus Settings pre-fillen.

- [ ] **Step 11.6: Commit**

```bash
git add src/settings/render.js src/main.js styles/components/settings-sheet.css
git commit -m "feat(settings): einrichtung-starten-button in daten-section"
```

---

## Task 12 — Auto-Open-Logik in `main.js`

**Files:**
- Modify: `src/main.js`

- [ ] **Step 12.1: TEMP-Trigger entfernen und echte Auto-Open-Logik einbauen**

In `src/main.js` — die zwei Zeilen aus Task 3 entfernen:

```js
// TEMP: manueller Test-Trigger für Wizard-Gerüst — in Task 12 durch Auto-Open ersetzt
window.__testWizard = openOnboardingWizard;
```

Ersetze durch die eigentliche Auto-Open-Logik, direkt vor `refresh()` am Ende der Datei:

```js
// Onboarding-Auto-Open beim allerersten App-Start. Wizard setzt onboardingSeen
// sofort auf true (in openOnboardingWizard() selbst), damit auch ein Crash
// während des Wizards kein Re-Trigger auslöst.
if (state.settings.onboardingSeen === false) {
  openOnboardingWizard();
}
```

- [ ] **Step 12.2: Browser-Test Auto-Open**

DevTools → Application → Local Storage → `mahlzeit-state-v2` löschen. Seite neu laden. Wizard muss automatisch aufgehen. "Später" klicken. Seite nochmal neu laden — **Wizard darf jetzt NICHT mehr automatisch aufgehen**. Placeholder-Pille steht im Dashboard.

- [ ] **Step 12.3: Beta-Reset-Test**

DevTools-Console:

```js
const s = JSON.parse(localStorage.getItem('mahlzeit-state-v2'));
delete s.settings.onboardingSeen;
s.settings.profile.gender = 'male';
s.settings.profile.age = 30;
localStorage.setItem('mahlzeit-state-v2', JSON.stringify(s));
location.reload();
```

Nach dem Reload muss der Wizard aufgehen (weil `onboardingSeen` fehlt), und der Draft muss **leer** starten (weil Migration `gender` und `age` zurücknullen sollte). Progress zeigt "Schritt 1 von 5", Name-Input leer, Gender-Chips ohne Auswahl (aria-pressed=false).

- [ ] **Step 12.4: Commit**

```bash
git add src/main.js
git commit -m "feat(onboarding): auto-open beim allerersten app-start"
```

---

## Task 13 — Manueller Browser-Test (End-to-End)

- [ ] **Step 13.1: Frischer Flow**

`localStorage.clear()` + Reload. Alle 5 Steps durchklicken mit Eingaben:
- Step 1: Name "Testuser", Weiblich, Alter 35
- Step 2: 170 cm, 65 kg
- Step 3: "Aktiv", "Abnehmen"
- Step 4: Frühstück 500, Mittag 800
- Step 5: Prüfen dass Tagesbedarf plausibel (BMR × PAL × 0.9 - 500 = ca. 1700–1900 kcal), Abendessen = Tagesbedarf - 500 - 800, Makros nach Balanced-Preset (30/40/30), Slider ziehen updated live.
- "Fertig". Sheet schließt. Bedarfs-Pille zeigt normale Werte (nicht mehr "Einrichtung starten").

- [ ] **Step 13.2: Später-Flow**

`localStorage.clear()` + Reload. Wizard geht auf. Sofort "Später" klicken.
- Placeholder-Pille "Einrichtung starten" muss auf Dashboard stehen.
- Reload → **Wizard darf NICHT automatisch aufgehen** (onboardingSeen ist true).
- Klick auf Placeholder-Pille → Wizard geht auf mit leerem Draft.

- [ ] **Step 13.3: Teil-Ausfüll-Flow**

`localStorage.clear()` + Reload. Wizard, Step 1: Nur Namen eintragen ("Test"), sonst nichts. Weiter bis Step 5. Dann "Später".
- Placeholder-Pille muss noch da sein (isProfileComplete = false, weil gender/age/etc. nicht touched wurden).
- Klick auf Placeholder → Wizard pre-fillt Name="Test", alles andere leer.

- [ ] **Step 13.4: Settings-Trigger-Flow**

Nach kompletter Ausfüllung (Test 13.1): Settings-Sheet → Daten-Section → "Starten". Wizard geht auf, alle Werte pre-gefillt. Nur Ziel ändern zu "Aufbauen", "Fertig". Bedarfs-Pille zeigt geänderten Wert.

- [ ] **Step 13.5: Beta-Reset-Simulation**

Wie Step 12.3 — sicherstellen dass User mit alter Session einmal durchgeführt werden.

- [ ] **Step 13.6: showCalorieBar-Interaktion**

Nach kompletter Ausfüllung: In Settings `showCalorieBar` auf false toggeln (falls es einen sichtbaren Toggle gibt, sonst per DevTools). Placeholder-Pille darf danach auch NICHT erscheinen wenn Profil unvollständig ist — Test dafür: Wizard neu starten aus Settings, Werte "leeren" (Refresh-Buttons wo verfügbar), "Fertig". Placeholder-Pille bleibt aus wenn showCalorieBar=false.

---

## Task 14 — Vite-Build & Sync (APK auf Anfrage)

- [ ] **Step 14.1: Vite-Build**

```bash
npm run build
```

Erwartet: `built in Xms`, kein Error.

- [ ] **Step 14.2: `npx cap sync`**

```bash
npx cap sync
```

- [ ] **Step 14.3: APK-Build NUR auf explizite Anfrage vom User**

Wenn der User "apk bauen" sagt:

```bash
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./android/gradlew -p android assembleDebug
```

Erwartet: `BUILD SUCCESSFUL`, APK unter `android/app/build/outputs/apk/debug/app-debug.apk`.

Sonst überspringen — Präferenz "APK-Build nur auf Anfrage" aus User-Memory.

---

## Nicht im Scope

- Makro-Preset-Picker im Wizard (bleibt im Makro-Popup, Session 12)
- Multi-User (Backlog)
- Export / Import / kompletter Reset (Iteration 7)
- Dark Mode (Iteration 5)
- "Bist du sicher?"-Dialog beim Später-Klick (Design bewusst so)
- Zurücksetzen der Beta-Branding vor Merge auf `main` (separate Aufgabe später)

## Guardrails (aus CLAUDE.md)

- Storage-Key `mahlzeit-state-v2` bleibt — Migration innerhalb v2, kein Bump
- Package-ID `com.mahlzeit.myapp.dev` unverändert (Suffix in `build.gradle:12` existiert schon)
- Deutsche UI-Strings, Du-Ansprache durchgehend
- Touch-Targets ≥ 48 px für alle Chips/Buttons/Stepper
- Kein Framework — Vanilla JS + ES Modules
- Nach jedem substantiellen Task: Commit (frequent commits, kleine Zwischenstände)
- Vor Merge auf `main`: `applicationIdSuffix ".dev"` in `build.gradle` und "Mahlzeit Beta" in `strings.xml` + `capacitor.config.json` zurücksetzen
