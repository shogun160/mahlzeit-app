# Session 3 Implementation Plan — Interaktionen (Reroll, Portions, Selection)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Environment note aus Session 1/2:** Subagent-Worktree-Dispatch ist im Sandbox nicht verfügbar (fehlende Hooks). Direktausführung in der Haupt-Session, siehe `docs/redesign/handoffs/session-2-to-3.md`.

**Goal:** Das Dashboard wird interaktiv. Pro Karte: Portion-Stepper (−/+, 1–6), "Wechseln"-Button (Shuffle-Bag-Reroll ohne Wiederholung bis alle 17 durch), "Liste"-Button (Toggle-Selection für Einkaufsliste). Im Header: Global-Portion-Stepper (überschreibt alle Tage) und "Alle wechseln" (kompletter neuer Wochenplan). Kein Detail-Sheet, keine Einkaufsliste — kommt Session 4/5.

**Architecture:**
- **State bleibt zentrale Quelle** (`src/state.js`). Neu: Konstanten `PORTIONS_MIN`/`PORTIONS_MAX`, State-Slot `dishBag` (`{ [day]: number[] }` — Card-spezifische Reroll-Pools), `initState`-Default für `selected` wird `false` (vorher `true` — konsistent zu alter App auf `main`).
- **Interaktionen als thin modules** ohne Framework: `reroll.js`, `portions.js`, `selection.js` sind reine State-Mutatoren und rufen einen zentralen `refresh()`-Callback. Kein Reducer, kein Event-Bus.
- **`refresh()`** wird von `main.js` als Modul-Export bereitgestellt und rendert Header + Dashboard neu. Kein Diffing — 7 Cards + Header sind billig genug für Full-Rerender.
- **Kleines Refaktoring vorab:** `dishesById` und die Fisher-Yates-Helper werden aus `render.js` in ein `src/data/dishes.js`-Modul gehoben, damit `reroll.js` sie ohne Zyklus nutzen kann.
- **Neue Files bekommen jeweils eigene CSS-Component:** `styles/components/header.css`, `styles/components/stepper.css` (shared: Header + Card). `card.css` wird um Action-Row und Selected-State erweitert.

**Tech Stack:** Vite 8.1.5, Vanilla JS (ES Modules), CSS Custom Properties. Kein neues Package.

---

## Voraussetzungen

- Working Directory: `/Users/oliverwosnitza/Documents/Mahlzeit-App`
- Branch: `redesign` (`git branch --show-current` → `redesign`)
- Working Tree: sauber
- Session 2 abgeschlossen (7 Cards Mo–So rendern mit Zufalls-Assignment)

## Referenz-Semantik aus der alten App auf `main`

Bereits inspiziert (`git show main:www/index.html`), Kern-Fakten die diesen Plan formen:

- `PORTIONS_MIN = 1`, `PORTIONS_MAX = 6` — kein 8, kein Unlimited.
- `initAssignment()` setzt für jeden Tag `selected[day] = false` und `portions[day] = 1`.
- `changeGlobalPortion(delta)`: clampt `globalPortions` auf [1, 6], setzt danach für alle Tage `portions[day] = globalPortions`. Also **überschreibt** alle Karten, egal was vorher lokal eingestellt war.
- `rerollPools[day]` ist pro Karte eine Shuffled Queue aller Dish-IDs ohne die aktuell auf DIESER Karte gezeigte. Beim Reroll wird gezogen; ein Kandidat wird übersprungen, wenn er gerade auf einem anderen Tag gezeigt wird (`usedElsewhere`-Check). Bei leerem Pool: refill (allowed 2 attempts).
- Nach `rerollDay(day)`: `selected[day] = false` (weil neue Zutaten → alte Einkaufslisten-Auswahl ungültig).
- `rerollAll()`: neuer Pool = alle IDs außer den aktuell zugeordneten (17 − 7 = 10 verfügbar), erste 7 zuweisen; alle `selected[day] = false`; `rerollPools = {}` (Bags resetten). Zusätzlich `checkedShopping.clear()` — für Session 3 nicht relevant (kommt Session 5).

## Datei-Struktur nach dieser Session

```
Mahlzeit-App/
├── src/
│   ├── main.js                        ← geändert (Header + Dashboard rendern, refresh() exportieren)
│   ├── state.js                       ← geändert (PORTIONS_MIN/MAX, dishBag, selected-Default false)
│   ├── data/
│   │   ├── dishes.json                ← unverändert
│   │   └── dishes.js                  ← NEU (import JSON, dishesById, shuffled(), allDishIds())
│   └── dashboard/
│       ├── render.js                  ← geändert (nutzt data/dishes.js, kein eigener Fisher-Yates mehr)
│       ├── card.js                    ← geändert (Portion-Stepper, Action-Row, Selected-Visual)
│       ├── header.js                  ← NEU (Logo, Global-Stepper, Reroll-All)
│       ├── reroll.js                  ← NEU (rerollDay + rerollAll, Bag-Logik)
│       ├── portions.js                ← NEU (changePortion, changeGlobalPortion)
│       └── selection.js               ← NEU (toggleSelected)
├── styles/
│   └── components/
│       ├── card.css                   ← erweitert (action-row, portion-stepper-slot, selected)
│       ├── header.css                 ← NEU
│       └── stepper.css                ← NEU (shared: Header + Card)
├── index.html                         ← geändert (2 neue CSS-Links)
└── docs/redesign/
    ├── 2026-07-25-session-3-plan.md   ← dieses Doc
    └── handoffs/
        └── session-3-to-4.md          ← NEU am Ende
```

---

## Task 1: `state.js` erweitern (Konstanten, `dishBag`, Selected-Default)

**Warum:** Session 2 hat `initState` mit `selected[day] = true` gebaut — bewusster Default aus "alles ist geplant". Die alte App macht `false` (Nutzer wählt aktiv aus, was er einkauft). Zurück zu `false` für Feature-Parität. Außerdem brauchen wir jetzt Portions-Grenzen und den State-Slot für den Reroll-Bag (siehe Handoff-Empfehlung: Bag im State, nicht modul-lokal → wird in Session 6 automatisch persistiert).

**Files:**
- Modify: `src/state.js` (Komplettersatz)

- [ ] **Step 1: `src/state.js` ersetzen**

```js
// Zentraler In-Memory-State.
// Persistenz (localStorage-Key "mahlzeit-state-v2") kommt in Session 6.

export const DAYS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];

export const PORTIONS_MIN = 1;
export const PORTIONS_MAX = 6;

// Struktur laut Design-Doc Section 6 (plus dishBag für Reroll-Historie).
//   assignment       { [day: string]: number }   // Tag → dishId
//   selected         { [day: string]: boolean }  // Tag ausgewählt für Einkaufsliste?
//   portions         { [day: string]: number }   // Portionen pro Tag, clamp [MIN,MAX]
//   globalPortions   number                      // Portionen-Regler im Header, clamp [MIN,MAX]
//   checkedShopping  Set<string>                 // abgehakte Zutaten-Keys (Session 5)
//   dishBag          { [day: string]: number[] } // pro Karte: Shuffle-Bag-Queue, wird beim Ziehen konsumiert
export const state = {
  assignment: {},
  selected: {},
  portions: {},
  globalPortions: 1,
  checkedShopping: new Set(),
  dishBag: {},
};

// Initialisiert selected/portions passend zu einem frischen Assignment.
// Default: alle Tage abgewählt, jeweils 1 Portion (analog zur alten App auf main).
export function initState(assignment) {
  state.assignment = assignment;
  state.selected = {};
  state.portions = {};
  state.dishBag = {};
  for (const day of DAYS) {
    state.selected[day] = false;
    state.portions[day] = 1;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/state.js
git commit -m "feat(state): add PORTIONS_MIN/MAX, dishBag slot, selected default false"
```

---

## Task 2: `src/data/dishes.js` als geteiltes Data-Modul

**Warum:** Bisher liegt `dishesById` (Map) sowie `shuffled()` (Fisher-Yates) in `render.js`. `reroll.js` braucht beides ebenso, und wir wollen keinen zirkulären Import `render.js ↔ reroll.js`. Sauberere Trennung: JSON-Import + Hilfsdatenstrukturen in ein Modul, alle Consumer importieren daraus.

**Files:**
- Create: `src/data/dishes.js`

- [ ] **Step 1: `src/data/dishes.js` erstellen**

```js
import dishesData from './dishes.json';

// Rohe Arrays und Lookups aus der JSON-Datenquelle.
export const allDishes = dishesData.dishes;
export const dishesById = new Map(allDishes.map((d) => [d.id, d]));
export const allDishIds = allDishes.map((d) => d.id);
// meta wird in Session 5 (Einkaufsliste) gebraucht — jetzt schon exportieren
// damit spätere Consumer nicht nochmal umstrukturieren müssen.
export const ingredientMeta = dishesData.meta;

// Fisher-Yates: mischt Array in-place. Wir arbeiten auf einer Kopie.
export function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/dishes.js
git commit -m "refactor(data): extract dishesById, allDishIds, shuffled into shared module"
```

---

## Task 3: `render.js` auf das neue Data-Modul umstellen

**Warum:** Aufräumen. Die Reroll-Module ziehen sich dieselben Helper aus `data/dishes.js`, `render.js` bleibt schlank und rein rendernd.

**Files:**
- Modify: `src/dashboard/render.js` (Komplettersatz)

- [ ] **Step 1: `src/dashboard/render.js` ersetzen**

```js
import { createDayCard } from './card.js';
import { state, DAYS, initState } from '../state.js';
import { dishesById, allDishIds, shuffled } from '../data/dishes.js';

function pickInitialAssignment() {
  const picks = shuffled(allDishIds).slice(0, DAYS.length);
  const assignment = {};
  DAYS.forEach((day, i) => {
    assignment[day] = picks[i];
  });
  return assignment;
}

export function renderDashboard(root) {
  // Erst-Initialisierung: falls noch kein Assignment vorliegt, würfeln.
  // (Sobald Persistenz in Session 6 kommt, wird ein geladenes Assignment vorrangig sein.)
  if (Object.keys(state.assignment).length === 0) {
    initState(pickInitialAssignment());
  }

  root.innerHTML = '';
  for (const day of DAYS) {
    const dish = dishesById.get(state.assignment[day]);
    root.appendChild(createDayCard({ day, dish }));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/render.js
git commit -m "refactor(dashboard): render.js uses shared data module"
```

---

## Task 4: Reroll-Modul mit Shuffle-Bag-Logik

**Warum:** Kernstück. `rerollDay` implementiert die "Bag pro Karte" — jede Card hat eine eigene Warteschlange, die alle Dish-IDs außer der aktuell gezeigten enthält. Beim Reroll wird gezogen (mit Skip falls die ID gerade auf einem anderen Tag ist), leere Queue → refill. `rerollAll` würfelt komplett neu und resettet alle Bags.

**Files:**
- Create: `src/dashboard/reroll.js`

- [ ] **Step 1: `src/dashboard/reroll.js` erstellen**

```js
import { state, DAYS } from '../state.js';
import { allDishIds, shuffled } from '../data/dishes.js';

// Baut den Card-spezifischen Bag neu: alle IDs außer der aktuell auf DIESER Karte gezeigten,
// zufällig geordnet. Wird sowohl bei leerem Bag als auch nach "Alle wechseln" gerufen.
function refillBag(day) {
  const currentId = state.assignment[day];
  state.dishBag[day] = shuffled(allDishIds).filter((id) => id !== currentId);
}

export function rerollDay(day) {
  const usedElsewhere = new Set(
    DAYS.filter((d) => d !== day).map((d) => state.assignment[d]),
  );

  if (!state.dishBag[day] || state.dishBag[day].length === 0) {
    refillBag(day);
  }

  // Max zwei Anläufe: findet der erste keinen freien Kandidaten (weil alle noch
  // in usedElsewhere sind), Bag refillen und nochmal versuchen.
  let pick = null;
  for (let attempt = 0; attempt < 2 && pick === null; attempt++) {
    while (state.dishBag[day].length > 0) {
      const candidate = state.dishBag[day].shift();
      if (!usedElsewhere.has(candidate)) {
        pick = candidate;
        break;
      }
      // candidate wird gerade auf einem anderen Tag gezeigt — verwerfen
    }
    if (pick === null) {
      refillBag(day);
    }
  }
  if (pick === null) return; // wirklich kein Gericht verfügbar (17 Dishes → sollte nie passieren)

  state.assignment[day] = pick;
  state.selected[day] = false; // neue Zutaten → alte Auswahl ungültig
}

export function rerollAll() {
  const previousIds = new Set(Object.values(state.assignment));
  let pool = shuffled(allDishIds).filter((id) => !previousIds.has(id));
  if (pool.length < DAYS.length) {
    // Fallback falls die Dish-Datenbank je unter 2× Anzahl Tage schrumpft
    pool = shuffled(allDishIds);
  }
  DAYS.forEach((day, i) => {
    state.assignment[day] = pool[i];
    state.selected[day] = false;
  });
  state.dishBag = {}; // Karten-spezifische Bags starten nach "Alle wechseln" neu
}
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/reroll.js
git commit -m "feat(dashboard): reroll module with shuffle-bag semantics"
```

---

## Task 5: Portions-Modul (lokal + global)

**Files:**
- Create: `src/dashboard/portions.js`

- [ ] **Step 1: `src/dashboard/portions.js` erstellen**

```js
import { state, DAYS, PORTIONS_MIN, PORTIONS_MAX } from '../state.js';

function clamp(n) {
  return Math.min(PORTIONS_MAX, Math.max(PORTIONS_MIN, n));
}

export function changePortion(day, delta) {
  state.portions[day] = clamp(state.portions[day] + delta);
}

// Setzt den Header-Wert und überschreibt alle Card-Werte auf denselben Wert.
// Analog zur alten App auf main.
export function changeGlobalPortion(delta) {
  state.globalPortions = clamp(state.globalPortions + delta);
  for (const day of DAYS) {
    state.portions[day] = state.globalPortions;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/portions.js
git commit -m "feat(dashboard): portions module (local + global with clamp 1-6)"
```

---

## Task 6: Selection-Modul

**Files:**
- Create: `src/dashboard/selection.js`

- [ ] **Step 1: `src/dashboard/selection.js` erstellen**

```js
import { state } from '../state.js';

export function toggleSelected(day) {
  state.selected[day] = !state.selected[day];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/selection.js
git commit -m "feat(dashboard): selection module (toggle day for shopping list)"
```

---

## Task 7: Header-Modul

**Warum:** Ein neuer sichtbarer Bereich oberhalb der Cards. Layout: Logo links, rechts Global-Stepper + Reroll-All-Icon-Button. Der Toggle-All-Selection-Button aus der alten App bleibt weg (koppelt an Einkaufslisten-Interna, kommt Session 5/6).

Ich exportiere `renderHeader(root, { onGlobalPortionChange, onRerollAll })` — Callbacks explizit übergeben, damit das Modul keine Abhängigkeit auf `main.js`' `refresh()` hat.

**Files:**
- Create: `src/dashboard/header.js`

- [ ] **Step 1: `src/dashboard/header.js` erstellen**

```js
import { state, PORTIONS_MIN, PORTIONS_MAX } from '../state.js';

export function renderHeader(root, { onGlobalPortionChange, onRerollAll }) {
  root.innerHTML = '';

  const header = document.createElement('header');
  header.className = 'app-header';

  const minusDisabled = state.globalPortions <= PORTIONS_MIN;
  const plusDisabled = state.globalPortions >= PORTIONS_MAX;

  header.innerHTML = `
    <div class="app-header__logo-wrap">
      <img class="app-header__logo" src="/logo.png" alt="Mahlzeit" />
    </div>
    <div class="app-header__actions">
      <div class="stepper" role="group" aria-label="Portionen für alle Tage">
        <svg class="stepper__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <button class="stepper__btn" data-action="global-minus" aria-label="Weniger Personen für alle Tage" ${minusDisabled ? 'disabled' : ''}>−</button>
        <span class="stepper__value">${state.globalPortions}</span>
        <button class="stepper__btn" data-action="global-plus" aria-label="Mehr Personen für alle Tage" ${plusDisabled ? 'disabled' : ''}>+</button>
      </div>
      <button class="icon-btn" data-action="reroll-all" aria-label="Alle Gerichte neu auslosen" title="Alle neu auslosen">
        <img src="/icons/icon-auslosen.png" alt="" />
      </button>
    </div>
  `;

  header.querySelector('[data-action="global-minus"]').addEventListener('click', () => onGlobalPortionChange(-1));
  header.querySelector('[data-action="global-plus"]').addEventListener('click', () => onGlobalPortionChange(1));
  header.querySelector('[data-action="reroll-all"]').addEventListener('click', () => onRerollAll());

  root.appendChild(header);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/header.js
git commit -m "feat(dashboard): header with global portion stepper and reroll-all"
```

---

## Task 8: `card.js` erweitern — Stepper, Action-Row, Selected-State

**Warum:** Die Card bekommt jetzt die pro-Tag-Steuerung: einen kleinen Portion-Stepper unter der Meta-Zeile und eine Action-Row am unteren Rand mit "Wechseln" und "Liste"-Buttons. Ein "Zutaten"-Button aus der alten App ist bewusst nicht dabei — der öffnet ein Detail-Sheet und ist Session 4.

Selected-Zustand kriegt eine visuelle Kennzeichnung (Border oder Ring in Primary-Farbe). Wird via `.day-card--selected`-Modifier gesteuert.

Ich exportiere `createDayCard({ day, dish, portions, isSelected, handlers })` — Handlers als Objekt (`{ onPortionChange, onReroll, onToggleSelected }`), analog zum Header.

**Files:**
- Modify: `src/dashboard/card.js` (Komplettersatz)

- [ ] **Step 1: `src/dashboard/card.js` ersetzen**

```js
import { PORTIONS_MIN, PORTIONS_MAX } from '../state.js';

// Rendert eine einzelne Day-Card als <article>-Element.
// Erwartet:
//   { day: string,
//     dish: { id, name, cuisine, cooktime, ... },
//     portions: number,
//     isSelected: boolean,
//     handlers: { onPortionChange(delta), onReroll(), onToggleSelected() } }
export function createDayCard({ day, dish, portions, isSelected, handlers }) {
  const article = document.createElement('article');
  article.className = 'day-card' + (isSelected ? ' day-card--selected' : '');
  const imageSrc = `/dishes/dish-${dish.id}.jpg`;
  const minusDisabled = portions <= PORTIONS_MIN;
  const plusDisabled = portions >= PORTIONS_MAX;
  const selectionIcon = isSelected ? 'icon-einkaufsliste-aktiv' : 'icon-einkaufsliste-inaktiv';
  const selectionLabel = isSelected ? 'Für Einkaufsliste abwählen' : 'Für Einkaufsliste auswählen';

  article.innerHTML = `
    <img class="day-card__image" src="${imageSrc}" alt="${dish.name}" loading="lazy" />
    <div class="day-card__body">
      <div class="day-card__meta-row">
        <div class="day-card__meta-text">
          <div class="day-card__day">${day}</div>
          <h2 class="day-card__title">${dish.name}</h2>
          <div class="day-card__meta">~${dish.cooktime} Min. · ${dish.cuisine}</div>
        </div>
        <div class="stepper stepper--compact" role="group" aria-label="Portionen für ${day}">
          <svg class="stepper__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <button class="stepper__btn" data-action="portion-minus" aria-label="Weniger Personen für ${day}" ${minusDisabled ? 'disabled' : ''}>−</button>
          <span class="stepper__value">${portions}</span>
          <button class="stepper__btn" data-action="portion-plus" aria-label="Mehr Personen für ${day}" ${plusDisabled ? 'disabled' : ''}>+</button>
        </div>
      </div>
      <div class="day-card__actions">
        <button class="action-btn" data-action="reroll" aria-label="Neues Gericht für ${day} auslosen">
          <img src="/icons/icon-auslosen.png" alt="" />
          <span>Wechseln</span>
        </button>
        <button class="action-btn" data-action="toggle-selected" aria-label="${selectionLabel}">
          <img src="/icons/${selectionIcon}.png" alt="" />
          <span>Liste</span>
        </button>
      </div>
    </div>
  `;

  article.querySelector('[data-action="portion-minus"]').addEventListener('click', () => handlers.onPortionChange(-1));
  article.querySelector('[data-action="portion-plus"]').addEventListener('click', () => handlers.onPortionChange(1));
  article.querySelector('[data-action="reroll"]').addEventListener('click', () => handlers.onReroll());
  article.querySelector('[data-action="toggle-selected"]').addEventListener('click', () => handlers.onToggleSelected());

  return article;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/card.js
git commit -m "feat(dashboard): card with portion stepper, reroll & selection actions"
```

---

## Task 9: `render.js` — Handler-Wiring einbauen

**Warum:** Der Dashboard-Renderer muss jetzt pro Card die Handler injizieren. `render.js` bekommt einen `onChange`-Callback (kommt von `main.js`), der nach jeder Mutation `refresh()` triggert.

**Files:**
- Modify: `src/dashboard/render.js` (Komplettersatz)

- [ ] **Step 1: `src/dashboard/render.js` ersetzen**

```js
import { createDayCard } from './card.js';
import { state, DAYS, initState } from '../state.js';
import { dishesById, allDishIds, shuffled } from '../data/dishes.js';
import { rerollDay } from './reroll.js';
import { changePortion } from './portions.js';
import { toggleSelected } from './selection.js';

function pickInitialAssignment() {
  const picks = shuffled(allDishIds).slice(0, DAYS.length);
  const assignment = {};
  DAYS.forEach((day, i) => {
    assignment[day] = picks[i];
  });
  return assignment;
}

export function renderDashboard(root, onChange) {
  // Erst-Initialisierung: falls noch kein Assignment vorliegt, würfeln.
  if (Object.keys(state.assignment).length === 0) {
    initState(pickInitialAssignment());
  }

  root.innerHTML = '';
  for (const day of DAYS) {
    const dish = dishesById.get(state.assignment[day]);
    const card = createDayCard({
      day,
      dish,
      portions: state.portions[day],
      isSelected: state.selected[day],
      handlers: {
        onPortionChange: (delta) => {
          changePortion(day, delta);
          onChange();
        },
        onReroll: () => {
          rerollDay(day);
          onChange();
        },
        onToggleSelected: () => {
          toggleSelected(day);
          onChange();
        },
      },
    });
    root.appendChild(card);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/render.js
git commit -m "feat(dashboard): wire card handlers to interaction modules"
```

---

## Task 10: `main.js` — Header + Dashboard rendern, refresh() orchestrieren

**Warum:** Der Einstiegspunkt bekommt zwei Root-Elemente (Header, Dashboard) und eine `refresh()`-Funktion, die beide neu rendert. Header und Card-Handlers rufen `refresh` nach jeder Mutation.

Wir brauchen dafür Container in der `index.html` — Header in einen eigenen `<header id="app-header">`, Cards weiterhin in `<main id="app">`. Damit ist Header optisch/logisch getrennt.

**Files:**
- Modify: `index.html` (neuer `<header>`-Container + zwei neue CSS-Links)
- Modify: `src/main.js` (Komplettersatz)

- [ ] **Step 1: `index.html` erweitern**

Öffnen und den `<body>`-Block ersetzen; im `<head>` die zwei neuen CSS-Links ergänzen. Neues File komplett:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Mahlzeit</title>
  <link rel="icon" type="image/png" href="/logo.png" />
  <link rel="stylesheet" href="/styles/tokens.css" />
  <link rel="stylesheet" href="/styles/base.css" />
  <link rel="stylesheet" href="/styles/components/header.css" />
  <link rel="stylesheet" href="/styles/components/stepper.css" />
  <link rel="stylesheet" href="/styles/components/card.css" />
</head>
<body>
  <div id="app-header"></div>
  <main id="app"></main>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: `src/main.js` ersetzen**

```js
import { renderHeader } from './dashboard/header.js';
import { renderDashboard } from './dashboard/render.js';
import { rerollAll } from './dashboard/reroll.js';
import { changeGlobalPortion } from './dashboard/portions.js';

const headerRoot = document.getElementById('app-header');
const dashboardRoot = document.getElementById('app');

function refresh() {
  renderHeader(headerRoot, {
    onGlobalPortionChange: (delta) => {
      changeGlobalPortion(delta);
      refresh();
    },
    onRerollAll: () => {
      rerollAll();
      refresh();
    },
  });
  renderDashboard(dashboardRoot, refresh);
}

refresh();
```

- [ ] **Step 3: Commit**

```bash
git add index.html src/main.js
git commit -m "feat(app): orchestrate header + dashboard via refresh() callback"
```

---

## Task 11: Stepper-Styles (`styles/components/stepper.css`)

**Warum:** Shared zwischen Header (`.stepper`) und Card (`.stepper.stepper--compact`). Grundgestalt: Pill-Container mit −/Zahl/+, Icon links. Touch-Targets ≥ 44 px im Header, kompakt in der Card (die Card ist eng, Meta-Row muss zwei Zeilen tolerieren können).

**Files:**
- Create: `styles/components/stepper.css`

- [ ] **Step 1: `styles/components/stepper.css` erstellen**

```css
.stepper {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: var(--radius-pill);
  background: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface);
  user-select: none;
}

.stepper__icon {
  width: 18px;
  height: 18px;
  color: var(--md-sys-color-on-surface-variant);
  margin: 0 2px;
}

.stepper__btn {
  min-width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface);
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background 120ms ease;
}

.stepper__btn:hover:not(:disabled) {
  background: var(--md-sys-color-surface-container-lowest);
}

.stepper__btn:active:not(:disabled) {
  transform: scale(0.95);
}

.stepper__btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.stepper__value {
  min-width: 20px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

/* Kompakte Variante für die Card — kleiner, damit Meta-Row nicht überläuft */
.stepper--compact {
  padding: 2px 4px;
  gap: 2px;
}

.stepper--compact .stepper__icon {
  width: 16px;
  height: 16px;
  margin: 0 1px;
}

.stepper--compact .stepper__btn {
  min-width: 28px;
  height: 28px;
  font-size: 1rem;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles/components/stepper.css
git commit -m "feat(styles): shared stepper component (header + compact card variant)"
```

---

## Task 12: Header-Styles (`styles/components/header.css`)

**Warum:** Layout: Sticky-Top mit Safe-Area-Inset für später auf dem Handy (Statusbar-Overlap vermeiden). Logo links, Aktionen rechts.

**Files:**
- Create: `styles/components/header.css`

- [ ] **Step 1: `styles/components/header.css` erstellen**

```css
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  max-width: 600px;
  margin: 0 auto;
  padding: 12px 16px;
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
  background: var(--md-sys-color-surface);
  position: sticky;
  top: 0;
  z-index: 10;
}

.app-header__logo-wrap {
  display: flex;
  align-items: center;
}

.app-header__logo {
  height: 36px;
  width: auto;
  display: block;
}

.app-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  width: var(--touch-target-min);
  height: var(--touch-target-min);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: none;
  background: transparent;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background 120ms ease;
}

.icon-btn:hover {
  background: var(--md-sys-color-surface-container-low);
}

.icon-btn:active {
  transform: scale(0.95);
}

.icon-btn img {
  width: 24px;
  height: 24px;
  display: block;
  object-fit: contain;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles/components/header.css
git commit -m "feat(styles): app header (sticky, safe-area-top aware, icon-btn base)"
```

---

## Task 13: `card.css` erweitern — Meta-Row-Layout, Action-Row, Selected-State

**Warum:** Die bisherige Card hatte Title + Meta stapelig; jetzt muss der Meta-Bereich zwei-spaltig werden (Text links, Stepper rechts) und darunter die Action-Row liegen. Selected-State bekommt einen Ring in Primary-Farbe.

**Files:**
- Modify: `styles/components/card.css` (Komplettersatz)

- [ ] **Step 1: `styles/components/card.css` ersetzen**

```css
.day-card {
  background: var(--md-sys-color-surface-container-lowest);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: var(--md-elevation-1);
  transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
}

.day-card:active {
  transform: scale(0.99);
  box-shadow: var(--md-elevation-2);
}

.day-card--selected {
  border-color: var(--md-sys-color-primary);
  box-shadow: 0 0 0 2px var(--md-sys-color-primary-container), var(--md-elevation-1);
}

.day-card__image {
  width: 100%;
  height: 180px;
  object-fit: cover;
  display: block;
  background: var(--md-sys-color-surface-container-low);
}

.day-card__body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.day-card__meta-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.day-card__meta-text {
  flex: 1 1 auto;
  min-width: 0;
}

.day-card__day {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--md-sys-color-primary);
  margin-bottom: 4px;
}

.day-card__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  margin-bottom: 6px;
  line-height: 1.3;
}

.day-card__meta {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface-variant);
}

.day-card__actions {
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
  padding-top: 12px;
}

.action-btn {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: var(--touch-target-min);
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, transform 120ms ease;
}

.action-btn:hover {
  background: var(--md-sys-color-surface);
}

.action-btn:active {
  transform: scale(0.98);
}

.action-btn img {
  width: 20px;
  height: 20px;
  display: block;
  object-fit: contain;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles/components/card.css
git commit -m "feat(styles): card with meta-row split, action-row, selected ring"
```

---

## Task 14: Base-Layout an Header anpassen

**Warum:** `main` hatte bisher `padding-top: 16px` — jetzt sitzt der Header darüber und liefert seine eigene Padding. `main` sollte oben nur noch minimalen Abstand haben, damit die erste Card nicht direkt am Header klebt.

**Files:**
- Modify: `styles/base.css`

- [ ] **Step 1: `styles/base.css` öffnen**

Aktueller `main`-Block:
```css
main {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
  padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 20px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
```

- [ ] **Step 2: `main`-Padding-Top auf 8 reduzieren (Header hat schon 12+SafeArea)**

Ersetzen durch:
```css
main {
  max-width: 600px;
  margin: 0 auto;
  padding: 8px 16px;
  padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 20px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
```

- [ ] **Step 3: Commit**

```bash
git add styles/base.css
git commit -m "style(base): tighten main padding-top now that header sits above"
```

---

## Task 15: Dev-Server Smoke-Test

**Files:** — (nur Verifikation)

- [ ] **Step 1: Dev-Server im Hintergrund starten**

```bash
npm run dev
```

(Läuft; öffnet Browser automatisch.)

- [ ] **Step 2: HTTP-Endpoints prüfen**

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf -o /dev/null http://localhost:5173/; then
    echo "READY after ${i}s"; break
  fi
  sleep 1
done
for path in / /src/main.js /src/dashboard/header.js /src/dashboard/reroll.js /src/dashboard/portions.js /src/dashboard/selection.js /styles/components/header.css /styles/components/stepper.css /icons/icon-auslosen.png /icons/icon-einkaufsliste-aktiv.png /icons/icon-einkaufsliste-inaktiv.png /logo.png; do
  code=$(curl -sI -o /dev/null -w "%{http_code}" "http://localhost:5173${path}")
  echo "$code  $path"
done
```

Expected: alle 200.

- [ ] **Step 3: User-Checkpoint — visuell im Browser prüfen**

Das muss der User selbst machen. Erwartetes Verhalten:

- **Header** oben sichtbar: Logo links, Portion-Stepper (mit Personen-Icon, "1"), Reroll-All-Icon rechts.
- **7 Cards** darunter, wie in Session 2, ergänzt um:
  - Rechts oben in der Meta-Region ein kleiner Portion-Stepper.
  - Unter dem Meta-Bereich eine Action-Row mit zwei Buttons: "Wechseln" (Icon `icon-auslosen`) und "Liste" (Icon-Toggle je nach `selected`).
- **Interaktionen** (klick-testen):
  - Card-Stepper `+`/`−` erhöht/senkt nur diesen Tag, clampt bei 1 und 6, disabled-Buttons bei Grenzwerten.
  - Header-Stepper `+`/`−` setzt alle 7 Card-Stepper auf denselben Wert.
  - Card-"Wechseln" tauscht nur diese Card gegen ein Gericht, das aktuell auf keiner Card ist (7 Klicks nacheinander → alle bisherigen Gerichte weg, keine Wiederholung).
  - Card-"Liste" toggelt den Selected-State — sichtbar durch Ring in Primary-Farbe um die Card + Icon-Wechsel.
  - Header-"Alle wechseln" → komplett neue 7 Cards, alle deselektiert.

- [ ] **Step 4: Dev-Server beenden**

Terminal: `Ctrl+C` (bzw. `kill %1` wenn im Background gestartet).

---

## Task 16: Production-Build testen

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: Vite meldet erfolgreichen Build, JS-Bundle geringfügig gewachsen (~5–8 kB gegenüber Session 2 wegen Header + Interaktionsmodule).

- [ ] **Step 2: Größe prüfen**

```bash
du -sh www/ && ls www/
```

Expected: unter 2.5 MB gesamt.

- [ ] **Step 3: Cleanup**

```bash
rm -rf www/
```

---

## Task 17: Handoff für Session 4 schreiben + Push

**Files:**
- Create: `docs/redesign/handoffs/session-3-to-4.md`

- [ ] **Step 1: Handoff-Doc anlegen**

Analog zu `session-2-to-3.md` strukturieren. Inhalte:

- Kontext-Satz: was Session 3 gebaut hat (Header + Interaktionen komplett, Shuffle-Bag im State, `refresh()`-Orchestrierung in main.js)
- Pflichtlektüre: `CLAUDE.md`, Design-Doc, Session-3-Plan
- Aktueller Repo-Zustand
- Was Session 4 tun muss (Roadmap-Zeile "Detail-Sheet — Sheet-Component, Zutaten-View, Rezept-View, Swipe zwischen Tabs"):
  - Sheet-Component (Bottom-Sheet mit Backdrop, öffnet durch Klick auf Card-Image oder neuen "Zutaten"-Button)
  - Zwei Tabs: "Zutaten" und "Rezept"
  - Zutaten-View: Liste aus `dish.ingredients` (mit `label`, `grams`), Portions-Skalierung anhand `state.portions[day]`
  - Rezept-View: nummerierte Liste aus `dish.steps`
  - Swipe zwischen Tabs (Touch + Tastatur)
- Constraints (deutsch, kein Framework, keine Persistenz)
- Environment-Constraint (kein Subagent-Worktree)
- Empfohlener Skill-Flow (writing-plans → executing-plans direkt in Session)
- Bewusste Entscheidungen aus Session 3, die für Session 4 relevant sind:
  - Card-Klick öffnet aktuell nichts — Session 4 soll `onOpenDetail`-Handler an `createDayCard` durchreichen, `refresh()` bleibt für den Content
  - `state.portions[day]` ist die Portionen-Quelle für die Zutaten-Skalierung
  - `dishesById.get(dishId)` liefert `dish.ingredients` und `dish.steps`
  - `refresh()` in main.js ist der zentrale Re-Render — Detail-Sheet kann via eigenes Modul + eigenes Root-Element gerendert werden (nicht Teil von refresh, weil Modal-Overlay)

- [ ] **Step 2: Auch den Session-3-Plan committen**

```bash
git add docs/redesign/2026-07-25-session-3-plan.md docs/redesign/handoffs/session-3-to-4.md
git commit -m "docs(redesign): add session 3 plan + handoff for fresh claude session"
```

- [ ] **Step 3: Push**

```bash
git status && git push
```

Expected: `nothing to commit, working tree clean`, dann Push erfolgreich.

- [ ] **Step 4: Commit-Log der Session ansehen**

```bash
git log --oneline main..redesign
```

Expected: die neuen Commits aus Session 3 ontop von Session 2.

---

## Definition of Done

- ✅ `state.js` exportiert `PORTIONS_MIN`, `PORTIONS_MAX`, hat `dishBag`-Slot, `initState` setzt `selected` auf `false`
- ✅ `src/data/dishes.js` exportiert `allDishes`, `dishesById`, `allDishIds`, `ingredientMeta`, `shuffled`
- ✅ `src/dashboard/reroll.js`, `portions.js`, `selection.js`, `header.js` existieren und implementieren die spezifizierte Semantik
- ✅ `src/dashboard/card.js` rendert Card mit Portion-Stepper, Wechseln-Button, Liste-Button und Selected-State
- ✅ `src/main.js` orchestriert Header + Dashboard über `refresh()`
- ✅ `index.html` verlinkt drei CSS-Files (`header.css`, `stepper.css`, `card.css`) und hat `#app-header` + `#app` Container
- ✅ `styles/components/header.css` und `styles/components/stepper.css` existieren; `card.css` und `base.css` sind erweitert
- ✅ Browser-Check: alle spezifizierten Interaktionen funktionieren wie in Task 15 Step 3 beschrieben
- ✅ `npm run build` läuft ohne Errors, unter 2.5 MB
- ✅ Handoff `docs/redesign/handoffs/session-3-to-4.md` erstellt
- ✅ Alles auf `origin/redesign` gepusht

## Was ist bewusst NICHT Teil dieser Session

- **Toggle-All-Selection-Button** aus der alten App (koppelt an `checkedShopping.clear()` und Einkaufslisten-Interna) → Session 5
- **Detail-Sheet** (Zutaten- und Rezept-View, Swipe zwischen Tabs) → Session 4
- **Klick auf Card öffnet Detail-Sheet** → Session 4 (aktuell macht Card-Body-Klick nichts, nur Buttons reagieren)
- **Makros (kcal/P/KH/F) auf der Card** — sind auf `main` da, im Rebuild noch nicht designed. Bewusst nicht in Session 3 nachziehen — separat entscheiden.
- **Einkaufsliste** → Session 5
- **Persistenz** (`mahlzeit-state-v2` in localStorage) → Session 6
- **Bottom-Nav und Swipe zwischen Screens** → Session 6
- **APK-Build + `npx cap sync` + Merge nach `main`** → Session 7
