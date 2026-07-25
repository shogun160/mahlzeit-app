# Session 5 Implementation Plan — Einkaufsliste (Kategorien, Check-Interaktion, Progress, Swipe-Navigation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Environment note aus Session 1-4:** Subagent-Worktree-Dispatch ist im Sandbox nicht verfügbar. Direktausführung in der Haupt-Session, siehe `docs/redesign/handoffs/session-4-to-5.md`.

**Goal:** Die Einkaufsliste kommt als zweiter Screen dazu — konsolidiert Zutaten aller `state.selected`-Tage, gruppiert sie in fünf Kategorien, formatiert Mengen einheiten-aware (g/Stück/Bund/Zehe/Ei/Vorrat) und lässt sie einzeln abhaken. Progress-Bar oben zeigt Fortschritt sticky. Screen-Wechsel zwischen Dashboard und Einkaufsliste erfolgt über horizontalen Swipe.

**Architecture:**

- **Neues `src/shopping-list/`-Modul** (analog `src/dashboard/` und `src/detail-sheet/` aus Session 3/4). Fünf Files:
  - `categories.js` — `CAT_ORDER` + `CAT_LABELS` als reine Konstanten
  - `consolidate.js` — `buildConsolidatedList()` liest `state.selected`/`state.portions`/`state.assignment` und liefert Map<key, { key, label, cat, unit, size, note, sum }>
  - `check.js` — `toggleChecked(key)` mutiert `state.checkedShopping`
  - `progress.js` — `renderProgress(root, items)` erzeugt Progress-Zeile "X von Y offen" + gefüllte Bar
  - `render.js` — `renderShoppingList(root, { onChange })` orchestriert Progress + Kategorien-Gruppen + Zutaten-Zeilen
- **Neues `src/nav/`-Modul** mit `swipe.js` — `attachViewSwipe(el, { onViewChange })` hängt Touch-Handler auf, ruft `onViewChange('dashboard' | 'shopping')` beim Swipe. Threshold identisch zum Sheet-Swipe (55 px, 1.4× Richtungs-Ratio).
- **`state.view`** neuer Slot in `state.js`: `'dashboard' | 'shopping'`, Default `'dashboard'`.
- **Layout-Umbau**: `main` wird zum Overflow-Clipper (`overflow: hidden`), Body zum `flex-column`-Container mit `height: 100dvh`. Darin ein `<div id="view-track">` mit `width: 200%`, zwei Kinder-`<section class="view">` je `flex: 0 0 50%`. Track schiebt sich per `transform: translateX(0 | -50%)` mit 250 ms cubic-bezier. Jede View scrollt intern per `overflow-y: auto`. Sticky-Progress in Shopping-View wird sticky relativ zur View (nicht mehr zum Body).
- **Header kontextabhängig**: `renderHeader(root, { view, ... })` rendert bei Dashboard-View wie in Session 3-4 (Logo + Global-Stepper + Reroll-All), bei Shopping-View nur Logo + Reset-Button (nur wenn `state.checkedShopping.size > 0`).
- **`refresh()` in `main.js`** rendert Header (mit aktueller `state.view`) und beide Views (Dashboard + Shopping) parallel, setzt Track-Offset entsprechend `state.view`. Beide Views werden immer gerendert, damit der Swipe die inaktive View bereits fertig gerendert sieht.

**Tech Stack:** Vite 8.1.5, Vanilla JS (ES Modules), CSS Custom Properties + `color-mix()`, native Touch-Events. Kein neues Package.

---

## Design-Entscheidungen (vor Session-Start mit User geklärt, siehe Handoff)

| Frage | Entscheidung | Begründung |
|---|---|---|
| Screen-Wechsel Dashboard ↔ Shopping | **Horizontaler Swipe** auf Body/Track, kein Header-Toggle, kein URL-Hash | Session 6 addiert Bottom-Nav ontop — Swipe-Code bleibt weiter Trigger. Keine Wegwerf-Arbeit. |
| Check-Interaktion | Abgehakte Zutaten **bleiben in-place**, durchgestrichen + gedimmt | Kein Orientierungsverlust bei versehentlichem Klick, User sieht was schon erledigt ist. |
| Progress-Bar-Position | **Sticky oben** in der Shopping-View | Fortschritts-Feedback beim Abhaken ist genau dann wertvoll, wenn man tief in der Liste ist. |
| Kategorie-Reihenfolge | `frisch → trocken → gewuerze → oel → sonstig` (identisch zur alten App auf `main`) | Bewährte Reihenfolge, matcht typische Einkaufs-Layouts (frisch am Rand, trocken in Mitte, Gewürze zum Schluss). |
| Kategorie-Labels | Kürzer als in `main`: "Frische / Trocken / Gewürze / Öl / Fett / Sonstiges" (siehe Handoff) | Rebuild-Kontext: knappere Labels, moderneres Look-and-Feel. |
| Einheiten-aware Anzeige | Neue Funktion `formatQuantity(item)` in `src/util/format.js`, `formatGrams` bleibt für Sheet-Kontext | Sheet = Rezept-Präzision in g. Einkaufsliste = kaufbare Einheiten mit Aufrundung (10 g / ganzes Stück). |
| Reset-Button "Alle wieder auf offen" | **JA**, im Shopping-Header rechts, sichtbar nur wenn `checkedShopping.size > 0` | Handoff sagt "optional" — hat klaren UX-Nutzen (User beginnt neue Einkaufstour, will Häkchen zurücksetzen). Unsichtbar wenn nichts abgehakt, spart visuelle Klutter. |
| Check-Icon-Style | Native `<input type="checkbox">` mit `accent-color: var(--md-sys-color-primary)` | Kein extra Asset nötig, native Accessibility, tap-Verhalten wie erwartet. |
| Leftover-Behandlung (abgehakte Zutaten aus abgewählten Gerichten) | **Weglassen** — Session 5 keeps it simple | Alte App hatte komplexe "Leftover-Done"-Logik + pendingSection + moveTimers. Für den Rebuild-MVP nicht nötig; Zutaten von abgewählten Gerichten verschwinden einfach mitsamt ihrem Check-Zustand aus der Anzeige (`state.checkedShopping` behält den Key, aber renderShoppingList ignoriert Keys, die nicht im aktuellen Consolidated sind). |
| Leere Einkaufsliste | Empty-State-Text "Keine Gerichte für die Liste ausgewählt. Nutze den Liste-Button auf einer Karte." | Klar sichtbar warum leer ist, Verweis auf Auslöse-Aktion. |
| "Alles abgehakt"-Zustand | Progress zeigt "0 von N offen" mit 100 % gefüllter Bar in primary. Kein zusätzliches Banner. | Progress-Bar visualisiert es schon, kein doppelter Feedback nötig. |
| View-Track-Höhe | `main { height: 100%; overflow: hidden; }`, Views scrollen intern | Nötig damit `translateX` nicht die Body-Höhe krude verändert. Header bleibt oben durch Body-`flex-column`. |
| Sticky-Header-Mechanismus | `body { display: flex; flex-direction: column; height: 100dvh; overflow: hidden; }` — Header ist erstes Flex-Kind, bleibt oben ohne `position: sticky` | Ohne Body-Scroll wirkt `position: sticky` sowieso wie static — die visuelle Wirkung ist identisch, aber Layout wird sauberer. `.app-header { position: sticky }` kann bleiben (harmlos) oder auf `static` reduziert werden. Ich lasse `sticky` drin, um Session-3-Diff minimal zu halten. |

---

## Voraussetzungen

- Working Directory: `/Users/oliverwosnitza/Documents/Mahlzeit-App`
- Branch: `redesign` (`git branch --show-current` → `redesign`)
- Working Tree: sauber
- Session 4 abgeschlossen (Detail-Sheet live, `refresh()` orchestriert Header + Dashboard, Sheet lebt außerhalb)

## Datei-Struktur nach dieser Session

```
Mahlzeit-App/
├── src/
│   ├── main.js                        ← geändert (View-Rendering + Swipe-Mount)
│   ├── state.js                       ← geändert (view-Slot + setView)
│   ├── nav/                           ← NEU
│   │   └── swipe.js                   ← NEU (attachViewSwipe)
│   ├── shopping-list/                 ← NEU
│   │   ├── categories.js              ← NEU (CAT_ORDER, CAT_LABELS)
│   │   ├── consolidate.js             ← NEU (buildConsolidatedList)
│   │   ├── check.js                   ← NEU (toggleChecked, resetChecked)
│   │   ├── progress.js                ← NEU (renderProgress)
│   │   └── render.js                  ← NEU (renderShoppingList)
│   ├── util/
│   │   └── format.js                  ← geändert (formatQuantity daneben stellen)
│   └── dashboard/
│       └── header.js                  ← geändert (view-abhängiges Rendering)
├── styles/
│   ├── base.css                       ← geändert (body flex-column, main clip)
│   └── components/
│       ├── view-track.css             ← NEU (Track + View-Slide)
│       └── shopping-list.css          ← NEU
├── index.html                         ← geändert (view-track-Struktur, neue CSS-Links)
└── docs/redesign/
    ├── 2026-07-25-session-5-plan.md   ← dieses Doc
    └── handoffs/
        └── session-5-to-6.md          ← NEU am Ende
```

---

## Task 1: `src/state.js` — `view`-Slot + `setView`-Helper

**Warum:** Der `state`-Container hält die aktuelle View. Setzt Default `'dashboard'` und exportiert `setView(next)` als schmalen Helper, damit `swipe.js` und `main.js` nicht direkt am Objekt herumschrauben.

**Files:**
- Modify: `src/state.js`

- [ ] **Step 1: `src/state.js` ergänzen**

Nach dem `state`-Objekt und `initState`, folgendes ergänzen (nichts am bestehenden `state` löschen, nur `view` als neuen Slot):

Zeile für Zeile:
- Im `state`-Objekt (`export const state = { ... }`) einen neuen Slot `view: 'dashboard'` ergänzen.
- Am Ende des Files eine neue exportierte Funktion `setView(next)` hinzufügen.

Fertiges File:

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

export const VIEWS = ['dashboard', 'shopping'];

// Struktur laut Design-Doc Section 6 (plus dishBag für Reroll-Historie).
//   assignment       { [day: string]: number }   // Tag → dishId
//   selected         { [day: string]: boolean }  // Tag ausgewählt für Einkaufsliste?
//   portions         { [day: string]: number }   // Portionen pro Tag, clamp [MIN,MAX]
//   globalPortions   number                      // Portionen-Regler im Header, clamp [MIN,MAX]
//   checkedShopping  Set<string>                 // abgehakte Zutaten-Keys (Session 5)
//   dishBag          { [day: string]: number[] } // pro Karte: Shuffle-Bag-Queue, wird beim Ziehen konsumiert
//   view             'dashboard' | 'shopping'    // aktive Screen-Ansicht (Session 5)
export const state = {
  assignment: {},
  selected: {},
  portions: {},
  globalPortions: 1,
  checkedShopping: new Set(),
  dishBag: {},
  view: 'dashboard',
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

// Setzt die aktive Screen-Ansicht. Wird von Swipe-Handler und (Session 6) Bottom-Nav gerufen.
// No-op wenn `next` unbekannt — schützt vor Tippfehlern.
export function setView(next) {
  if (!VIEWS.includes(next)) return;
  state.view = next;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/state.js
git commit -m "feat(state): add view slot + setView helper for screen navigation"
```

---

## Task 2: `src/util/format.js` — `formatQuantity` daneben stellen

**Warum:** Einkaufsliste braucht einheiten-aware Formatting. `formatGrams` (Sheet-Kontext, präzise Gramm) bleibt unverändert; `formatQuantity(item)` ist die neue Funktion für Einkaufsliste (aufgerundet auf 10 g bzw. ganze Stück/Bund/Zehe/Ei, "Vorrat prüfen" für `vorrat`). Consumer: `src/shopping-list/render.js`. Referenz-Logik: `displayQty()` aus `main` (siehe `/tmp/mahlzeit-main.html` nach `git show main:www/index.html > /tmp/mahlzeit-main.html`).

**Files:**
- Modify: `src/util/format.js`

- [ ] **Step 1: `src/util/format.js` erweitern**

Ans Ende der Datei anhängen:

```js

// Formatiert eine konsolidierte Einkaufslisten-Zutat einheiten-aware.
// item: { key, label, unit, size, note, sum } — sum ist die aggregierte Gramm-Menge
// (portions-skaliert und über alle ausgewählten Tage aufsummiert), außer bei unit='vorrat'.
// Aufrundung so, dass der User im Laden praktikable Mengen kauft (10 g, ganze Stück etc.).
export function formatQuantity(item) {
  if (item.unit === 'vorrat') return 'Vorrat prüfen';
  if (item.unit === 'g') {
    const g = Math.ceil(item.sum / 10) * 10;
    return `${g} g` + (item.note ? ` — ${item.note}` : '');
  }
  if (item.unit === 'stueck') {
    const n = Math.max(1, Math.ceil(item.sum / item.size));
    return `${n} Stück` + (item.note ? ` — ${item.note}` : '');
  }
  if (item.unit === 'bund') {
    const n = Math.max(1, Math.ceil(item.sum / item.size));
    return `${n} Bund`;
  }
  if (item.unit === 'zehe') {
    const n = Math.max(1, Math.ceil(item.sum / item.size));
    return `${n} Zehe(n)`;
  }
  if (item.unit === 'ei') {
    const n = Math.max(1, Math.round(item.sum / item.size));
    return `${n} Stück`;
  }
  return '';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/util/format.js
git commit -m "feat(util): add formatQuantity for shopping-list unit-aware display"
```

---

## Task 3: `src/shopping-list/categories.js` — Konstanten

**Warum:** `CAT_ORDER` und `CAT_LABELS` an einer zentralen Stelle. Wird von `render.js` und (Session 6 evtl.) Filter-UI gebraucht. Als reines Konstantenfile ohne Logik, damit es beim Testen/Skimmen leicht zu erfassen ist.

**Files:**
- Create: `src/shopping-list/categories.js`

- [ ] **Step 1: `src/shopping-list/categories.js` erstellen**

```js
// Kategorie-Reihenfolge in der Einkaufsliste (typisches Supermarkt-Layout:
// Frisch außen, Trocken/Gewürze innen, Öl & Sonstiges am Ende).
export const CAT_ORDER = ['frisch', 'trocken', 'gewuerze', 'oel', 'sonstig'];

// Deutsche Anzeige-Labels. Bewusst kurz gehalten (Rebuild-UI ist knapper als main).
export const CAT_LABELS = {
  frisch: 'Frische',
  trocken: 'Trocken',
  gewuerze: 'Gewürze',
  oel: 'Öl / Fett',
  sonstig: 'Sonstiges',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/shopping-list/categories.js
git commit -m "feat(shopping-list): category order + german labels"
```

---

## Task 4: `src/shopping-list/consolidate.js` — Zutaten aggregieren

**Warum:** Liest `state.selected` (welche Tage), `state.assignment` (welcher Tag → welche dishId), `state.portions` (Skalierung), aggregiert alle Zutaten der selektierten Tage per `ing.key` und liefert eine Map. `sum` ist die Summe der Gramm über alle Tage (portions-skaliert); für `unit === 'vorrat'` bleibt `sum = 0`. Referenz: `buildConsolidatedList()` in `/tmp/mahlzeit-main.html` (~Z. 941).

Rückgabetyp bewusst Map statt Array — Zugriff per key ist O(1) und render.js braucht `Object.values(...)` sowieso, um pro Kategorie zu filtern.

**Files:**
- Create: `src/shopping-list/consolidate.js`

- [ ] **Step 1: `src/shopping-list/consolidate.js` erstellen**

```js
import { state, DAYS } from '../state.js';
import { dishesById } from '../data/dishes.js';

// Aggregiert alle Zutaten der ausgewählten Tage in eine flache Map.
// Rückgabe: { [key]: { key, label, cat, unit, size, note, sum } }
// - sum: Summe der grams über alle selektierten Tage, jeweils mit state.portions[day] skaliert.
//        Für unit === 'vorrat' bleibt sum = 0 (Anzeige zeigt "Vorrat prüfen" statt Menge).
// - cat / unit / size / note: übernommen von der ersten Zutat des Keys (identisch über Dishes).
export function buildConsolidatedList() {
  const activeDays = DAYS.filter((d) => state.selected[d]);
  const consolidated = {};
  activeDays.forEach((day) => {
    const dishId = state.assignment[day];
    const dish = dishesById.get(dishId);
    if (!dish) return;
    const scale = state.portions[day] || 1;
    dish.ingredients.forEach((ing) => {
      if (!consolidated[ing.key]) {
        consolidated[ing.key] = {
          key: ing.key,
          label: ing.label,
          cat: ing.cat,
          unit: ing.unit,
          size: ing.size,
          note: ing.note,
          sum: 0,
        };
      }
      consolidated[ing.key].sum += ing.unit === 'vorrat' ? 0 : ing.grams * scale;
    });
  });
  return consolidated;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shopping-list/consolidate.js
git commit -m "feat(shopping-list): consolidate selected-day ingredients per key"
```

---

## Task 5: `src/shopping-list/check.js` — Check-State-Mutation

**Warum:** Zwei Mutationen: `toggleChecked(key)` togglet einen Key im `state.checkedShopping`-Set, `resetChecked()` leert es. Getrennt vom Rendering, damit die State-Änderung testbar/nachvollziehbar isoliert bleibt.

**Files:**
- Create: `src/shopping-list/check.js`

- [ ] **Step 1: `src/shopping-list/check.js` erstellen**

```js
import { state } from '../state.js';

// Togglet den Check-Zustand einer Zutat. Set-Semantik: identischer key wird
// hinzugefügt oder entfernt. Kein Nebeneffekt sonst — Rendering ist Aufrufer-Sache.
export function toggleChecked(key) {
  if (state.checkedShopping.has(key)) {
    state.checkedShopping.delete(key);
  } else {
    state.checkedShopping.add(key);
  }
}

// Setzt alle Häkchen zurück. Wird vom Reset-Button im Shopping-Header genutzt.
export function resetChecked() {
  state.checkedShopping.clear();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shopping-list/check.js
git commit -m "feat(shopping-list): toggle + reset check state helpers"
```

---

## Task 6: `src/shopping-list/progress.js` — Progress-Zeile

**Warum:** Isolierte HTML-Erzeugung für die Progress-Zeile: Label "X von Y offen" plus horizontale Fill-Bar. Bekommt die konsolidierten Items als Argument, filtert selbst gegen `state.checkedShopping` — hält die render.js schlank.

**Files:**
- Create: `src/shopping-list/progress.js`

- [ ] **Step 1: `src/shopping-list/progress.js` erstellen**

```js
import { state } from '../state.js';

// Baut die Progress-Zeile für die Einkaufsliste als HTML-String.
// items: Array<{ key, ... }> aus buildConsolidatedList → Object.values(...).
// Zeigt "N von M offen" und eine gefüllte Bar mit prozentualem Fortschritt (done/total).
export function renderProgress(items) {
  const total = items.length;
  const openCount = items.filter((i) => !state.checkedShopping.has(i.key)).length;
  const doneCount = total - openCount;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return `
    <div class="shop-progress">
      <div class="shop-progress__label">
        <span class="shop-progress__open">${openCount}</span>
        <span class="shop-progress__of">von ${total} offen</span>
      </div>
      <div class="shop-progress__track">
        <div class="shop-progress__fill" style="width: ${pct}%;"></div>
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shopping-list/progress.js
git commit -m "feat(shopping-list): sticky progress row with fill bar"
```

---

## Task 7: `src/shopping-list/render.js` — Screen-Rendering

**Warum:** Orchestriert die komplette Shopping-View: konsolidiert Zutaten, rendert Progress oben, dann pro Kategorie eine Gruppe mit `<h2>`-Header + Liste von Zutaten-Zeilen. Bindet Click-Handler pro Zeile für den Check-Toggle. Empty-State wenn nichts ausgewählt.

Rendering-Stil: HTML-String bauen, `root.innerHTML = ...` setzen, dann Handler per `addEventListener` binden — identisch zum Dashboard-Modul.

**Files:**
- Create: `src/shopping-list/render.js`

- [ ] **Step 1: `src/shopping-list/render.js` erstellen**

```js
import { state } from '../state.js';
import { buildConsolidatedList } from './consolidate.js';
import { toggleChecked } from './check.js';
import { renderProgress } from './progress.js';
import { CAT_ORDER, CAT_LABELS } from './categories.js';
import { formatQuantity } from '../util/format.js';

// Rendert die komplette Shopping-View in `root`.
// onChange wird nach jedem Check-Toggle aufgerufen — damit `main.js#refresh()`
// die View + Header (Reset-Button-Sichtbarkeit) neu zeichnet.
export function renderShoppingList(root, { onChange }) {
  const consolidated = buildConsolidatedList();
  const items = Object.values(consolidated);

  if (items.length === 0) {
    root.innerHTML = renderEmptyState();
    return;
  }

  const groupsHtml = CAT_ORDER.map((cat) => {
    const groupItems = items
      .filter((i) => i.cat === cat)
      .sort((a, b) => a.label.localeCompare(b.label, 'de'));
    if (groupItems.length === 0) return '';
    return renderGroup(cat, groupItems);
  }).join('');

  root.innerHTML = `
    ${renderProgress(items)}
    <div class="shop-groups">${groupsHtml}</div>
  `;

  root.querySelectorAll('.shop-item').forEach((el) => {
    el.addEventListener('click', () => {
      toggleChecked(el.dataset.key);
      onChange();
    });
  });
}

function renderGroup(cat, groupItems) {
  const rows = groupItems.map(renderRow).join('');
  return `
    <section class="shop-group">
      <h2 class="shop-group__title">${CAT_LABELS[cat]} <span class="shop-group__count">· ${groupItems.length}</span></h2>
      <ul class="shop-list">${rows}</ul>
    </section>
  `;
}

function renderRow(item) {
  const checked = state.checkedShopping.has(item.key);
  return `
    <li class="shop-item ${checked ? 'shop-item--checked' : ''}" data-key="${item.key}">
      <span class="shop-item__check" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 10.5 8.5 15 16 6"></polyline>
        </svg>
      </span>
      <span class="shop-item__body">
        <span class="shop-item__label">${item.label}</span>
        <span class="shop-item__qty">${formatQuantity(item)}</span>
      </span>
    </li>
  `;
}

function renderEmptyState() {
  return `
    <div class="shop-empty">
      <p class="shop-empty__title">Keine Zutaten in der Liste.</p>
      <p class="shop-empty__sub">Wähle Gerichte auf dem Dashboard über den Liste-Button aus.</p>
    </div>
  `;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shopping-list/render.js
git commit -m "feat(shopping-list): render progress + grouped categories + check rows"
```

---

## Task 8: `styles/components/shopping-list.css` — Screen-Styles

**Warum:** Progress-Zeile sticky oben (auf `.view`-Scroll-Container), Gruppen-Header, Zutaten-Zeile mit Check-Zone links + Label/Menge rechts, checked-State (durchgestrichen, gedimmt, Check-Icon in primary), Empty-State-Zentrierung. Nutzt bestehende Design-Tokens.

Wichtig für Sticky: `.shop-progress` bekommt `position: sticky; top: 0` — funktioniert weil `.view` der Scroll-Container ist (aus `view-track.css` in Task 10).

**Files:**
- Create: `styles/components/shopping-list.css`

- [ ] **Step 1: `styles/components/shopping-list.css` erstellen**

```css
/* Sticky Progress oben in der Shopping-View. Deckt beim Scrollen die darunter
   liegenden Kategorien-Header ab (die haben deutlich niedrigeren z-index). */
.shop-progress {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--md-sys-color-surface);
  padding: 12px 0 14px;
  margin-bottom: 4px;
}

.shop-progress__label {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  margin-bottom: 6px;
  font-variant-numeric: tabular-nums;
}

.shop-progress__of {
  color: var(--md-sys-color-on-surface-variant);
  font-weight: 600;
}

.shop-progress__track {
  height: 6px;
  border-radius: 999px;
  background: var(--md-sys-color-primary-container);
  overflow: hidden;
}

.shop-progress__fill {
  height: 100%;
  border-radius: 999px;
  background: var(--md-sys-color-primary);
  transition: width 250ms cubic-bezier(0.2, 0, 0, 1);
}

/* Kategorie-Gruppen */
.shop-groups {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.shop-group__title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--md-sys-color-primary);
  margin: 0 0 8px 2px;
}

.shop-group__count {
  color: var(--md-sys-color-on-surface-variant);
  font-weight: 600;
}

.shop-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Eine Zutaten-Zeile: großes Touch-Target, Check-Zone links, Body rechts. */
.shop-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--md-sys-color-surface-container-lowest);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 12px;
  padding: 10px 14px;
  min-height: var(--touch-target-min);
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, opacity 180ms ease;
}

.shop-item:hover {
  background: color-mix(in srgb, var(--md-sys-color-primary) 6%, var(--md-sys-color-surface-container-lowest));
}

.shop-item:active {
  transform: scale(0.995);
}

/* Check-Kreis: 24 px, Border wenn offen, gefüllt + Icon wenn checked. */
.shop-item__check {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--md-sys-color-on-surface-variant);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
}

.shop-item__check svg {
  width: 16px;
  height: 16px;
}

.shop-item__body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.shop-item__label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  line-height: 1.3;
  transition: color 180ms ease, text-decoration-color 180ms ease;
}

.shop-item__qty {
  font-size: 0.8125rem;
  color: var(--md-sys-color-on-surface-variant);
  font-variant-numeric: tabular-nums;
  transition: color 180ms ease;
}

/* Checked-State: Check-Kreis füllt sich mit primary, Text ist durchgestrichen + gedimmt. */
.shop-item--checked {
  background: color-mix(in srgb, var(--md-sys-color-primary) 5%, var(--md-sys-color-surface-container-lowest));
  border-color: color-mix(in srgb, var(--md-sys-color-primary) 22%, var(--md-sys-color-outline-variant));
}

.shop-item--checked .shop-item__check {
  background: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.shop-item--checked .shop-item__label {
  color: var(--md-sys-color-on-surface-variant);
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--md-sys-color-on-surface-variant) 60%, transparent);
}

.shop-item--checked .shop-item__qty {
  color: color-mix(in srgb, var(--md-sys-color-on-surface-variant) 70%, transparent);
  text-decoration: line-through;
}

/* Empty-State */
.shop-empty {
  padding: 64px 24px 40px;
  text-align: center;
  color: var(--md-sys-color-on-surface-variant);
}

.shop-empty__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  margin: 0 0 6px;
}

.shop-empty__sub {
  font-size: 0.875rem;
  margin: 0;
  max-width: 300px;
  margin-inline: auto;
  line-height: 1.5;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles/components/shopping-list.css
git commit -m "feat(styles): shopping list — sticky progress, category groups, check rows"
```

---

## Task 9: `src/nav/swipe.js` — Screen-Swipe

**Warum:** Horizontaler Swipe zwischen Dashboard und Shopping. Analog zum Sheet-Swipe (Threshold 55 px, Ratio 1.4 damit vertikales Scrollen dominant bleibt), aber auf View-Ebene: Callback ruft `main.js` mit `'dashboard'` oder `'shopping'`.

Warum eigenes Modul: Session 6 addiert Bottom-Nav-Tabs, die den gleichen View-Wechsel triggern. `swipe.js` bleibt daneben bestehen als zweiter Trigger.

**Files:**
- Create: `src/nav/swipe.js`

- [ ] **Step 1: `src/nav/swipe.js` erstellen**

```js
import { state, VIEWS } from '../state.js';

const SWIPE_THRESHOLD_PX = 55;
const SWIPE_DIRECTIONAL_RATIO = 1.4; // |dx| muss 1.4x größer als |dy| sein

// Hängt horizontalen Swipe-Handler an `el` (typisch das <main>-Element).
// onViewChange('dashboard' | 'shopping') wird gerufen wenn Threshold gerissen wurde
// UND der Swipe in eine gültige Richtung ging (kein Wrap-around).
// Aktueller View wird aus `state.view` gelesen — keine eigene Kopie.
export function attachViewSwipe(el, { onViewChange }) {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  el.addEventListener(
    'touchstart',
    (ev) => {
      if (ev.touches.length !== 1) return;
      startX = ev.touches[0].clientX;
      startY = ev.touches[0].clientY;
      tracking = true;
    },
    { passive: true },
  );

  el.addEventListener(
    'touchend',
    (ev) => {
      if (!tracking) return;
      tracking = false;
      const dx = ev.changedTouches[0].clientX - startX;
      const dy = ev.changedTouches[0].clientY - startY;
      if (Math.abs(dx) <= SWIPE_THRESHOLD_PX) return;
      if (Math.abs(dx) <= Math.abs(dy) * SWIPE_DIRECTIONAL_RATIO) return;

      const idx = VIEWS.indexOf(state.view);
      // dx < 0 = Wisch nach links = nächster View rechts.
      if (dx < 0 && idx < VIEWS.length - 1) onViewChange(VIEWS[idx + 1]);
      else if (dx > 0 && idx > 0) onViewChange(VIEWS[idx - 1]);
    },
    { passive: true },
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/nav/swipe.js
git commit -m "feat(nav): horizontal swipe handler for screen navigation"
```

---

## Task 10: `styles/components/view-track.css` — Track + View-Slide

**Warum:** Der View-Track ist der horizontal shiftbare Container mit den beiden View-Panels drin. Analog zum `.sheet-tabs__track` aus Session 4, aber auf Screen-Level. Jedes `.view`-Panel hat eigenen vertikalen Scroll (damit Sticky-Progress in Shopping-View auf View-Ebene funktioniert) und internes `padding` (das früher auf `main` lag).

**Files:**
- Create: `styles/components/view-track.css`

- [ ] **Step 1: `styles/components/view-track.css` erstellen**

```css
/* Track sitzt in <main>, ist 200% breit, hält beide Views nebeneinander.
   Verschiebt sich per translateX per state.view. */
.view-track {
  display: flex;
  width: 200%;
  height: 100%;
  transition: transform 250ms cubic-bezier(0.2, 0, 0, 1);
}

.view-track[data-view="dashboard"] {
  transform: translateX(0);
}

.view-track[data-view="shopping"] {
  transform: translateX(-50%);
}

/* Jede View: 50% des Tracks (= 100% Viewport-Breite), scrollt intern vertikal,
   damit Sticky-Elemente innerhalb der View relativ zu ihrem eigenen Scroll wirken.
   max-width + margin-inline zentriert die Content-Spalte (früher auf <main>). */
.view {
  flex: 0 0 50%;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
  padding: 8px 16px;
  padding-bottom: calc(env(safe-area-inset-bottom) + 20px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Content-Column zentrieren. Da .view direkt Content hält, begrenzt max-width
   auf .view selbst — kein extra Wrapper nötig. */
.view--dashboard,
.view--shopping {
  max-width: 600px;
  margin-inline: auto;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles/components/view-track.css
git commit -m "feat(styles): view-track slides horizontally between screens"
```

---

## Task 11: `styles/base.css` — Body als Flex-Column, Main als Clip

**Warum:** Damit der View-Track horizontal in `main` clippt und Views intern scrollen, muss:
- Body ein `flex-column`-Container werden mit `height: 100dvh` und `overflow: hidden`.
- Header ist erstes Flex-Kind, feste Höhe (kein Grow).
- `main` ist zweites Flex-Kind mit `flex: 1 1 auto` und `overflow: hidden` (clippt horizontales Slide).
- Alte padding/gap-Regeln auf `main` fallen weg — sie leben jetzt auf `.view`.

**Files:**
- Modify: `styles/base.css`

- [ ] **Step 1: `styles/base.css` ersetzen**

```css
/* Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  height: 100%;
}

/* Body ist der App-Container: Header oben (fixe Höhe), Main darunter (flex-grow, clippt).
   Vertikaler Scroll passiert innerhalb der aktiven .view — nicht auf body. */
body {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}

/* Header behält seine bisherigen Styles (siehe header.css). Er ist erstes flex-Kind
   und wächst nicht — nimmt seine Content-Höhe. */

/* Main clippt horizontales Sliding vom view-track. Vertikales Scrolling passiert
   innerhalb der einzelnen .view (siehe view-track.css). */
main {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles/base.css
git commit -m "refactor(base): body flex-column, main as overflow clip for view-track"
```

---

## Task 12: `index.html` — View-Track-Struktur + neue CSS-Links

**Warum:** `<main id="app">` bekommt statt direktem Content ein `<div id="view-track">` mit zwei Views drin. Zusätzlich die zwei neuen CSS-Links: `view-track.css` und `shopping-list.css`.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: `index.html` ersetzen**

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
  <link rel="stylesheet" href="/styles/components/sheet.css" />
  <link rel="stylesheet" href="/styles/components/view-track.css" />
  <link rel="stylesheet" href="/styles/components/shopping-list.css" />
</head>
<body>
  <header id="app-header" class="app-header"></header>
  <main id="app">
    <div id="view-track" class="view-track" data-view="dashboard">
      <section id="view-dashboard" class="view view--dashboard"></section>
      <section id="view-shopping" class="view view--shopping"></section>
    </div>
  </main>
  <div id="detail-sheet-root"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat(index): mount view-track with dashboard + shopping panels"
```

---

## Task 13: `src/dashboard/header.js` — View-abhängiges Rendering

**Warum:** Bei Dashboard-View wie in Session 3-4 (Logo + Global-Stepper + Reroll-All). Bei Shopping-View: nur Logo links + optional Reset-Button rechts (nur sichtbar wenn `state.checkedShopping.size > 0`). Reset ruft `resetChecked()` und danach den `onChange`-Callback.

Signatur ändert sich: `renderHeader(root, { view, onGlobalPortionChange, onRerollAll, onResetChecked })`. `main.js` (Task 14) reicht `view` und die neuen/alten Callbacks durch.

Reset-Icon: kein PNG-Asset, stattdessen ein Inline-SVG (Refresh-Kreis) — konsistent mit Stepper-User-Icon (auch inline SVG).

**Files:**
- Modify: `src/dashboard/header.js` (Komplettersatz)

- [ ] **Step 1: `src/dashboard/header.js` ersetzen**

```js
import { state, PORTIONS_MIN, PORTIONS_MAX } from '../state.js';

// Rendert den Header. Layout hängt an `view`:
// - dashboard: Logo + Global-Stepper + Reroll-All (Session 3-4-Verhalten)
// - shopping: Logo + Reset-Button (nur wenn checkedShopping nicht leer)
export function renderHeader(root, { view, onGlobalPortionChange, onRerollAll, onResetChecked }) {
  if (view === 'shopping') {
    renderShoppingHeader(root, { onResetChecked });
  } else {
    renderDashboardHeader(root, { onGlobalPortionChange, onRerollAll });
  }
}

function renderDashboardHeader(root, { onGlobalPortionChange, onRerollAll }) {
  const minusDisabled = state.globalPortions <= PORTIONS_MIN;
  const plusDisabled = state.globalPortions >= PORTIONS_MAX;

  root.innerHTML = `
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

  root.querySelector('[data-action="global-minus"]').addEventListener('click', () => onGlobalPortionChange(-1));
  root.querySelector('[data-action="global-plus"]').addEventListener('click', () => onGlobalPortionChange(1));
  root.querySelector('[data-action="reroll-all"]').addEventListener('click', () => onRerollAll());
}

function renderShoppingHeader(root, { onResetChecked }) {
  const showReset = state.checkedShopping.size > 0;

  root.innerHTML = `
    <div class="app-header__logo-wrap">
      <img class="app-header__logo" src="/logo.png" alt="Mahlzeit" />
    </div>
    <div class="app-header__actions">
      ${showReset ? `
        <button class="icon-btn" data-action="reset-checked" aria-label="Alle Häkchen zurücksetzen" title="Alle Häkchen zurücksetzen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7"></path>
            <polyline points="3 4 3 10 9 10"></polyline>
          </svg>
        </button>
      ` : ''}
    </div>
  `;

  const resetBtn = root.querySelector('[data-action="reset-checked"]');
  if (resetBtn) resetBtn.addEventListener('click', () => onResetChecked());
}
```

- [ ] **Step 2: `styles/components/header.css` erweitern — Inline-SVG in `.icon-btn`**

Der bestehende `.icon-btn`-Style stylet die `<img>`-Kinder (`icon-auslosen.png`). Der neue Reset-Button nutzt Inline-SVG statt PNG — damit es identisch aussieht (22 px, Farbe aus dem Text-Color), am Ende von `styles/components/header.css` ergänzen:

```css

/* Inline-SVG-Kind in .icon-btn analog zum <img>-Kind stylen (Reset-Icon). */
.icon-btn svg {
  width: 22px;
  height: 22px;
  color: var(--md-sys-color-on-surface);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/header.js styles/components/header.css
git commit -m "feat(header): view-aware rendering with reset button on shopping view"
```

---

## Task 14: `src/main.js` — View-Rendering + Swipe-Mount

**Warum:** Zentraler Orchestrator. `refresh()` liest `state.view`, setzt das `data-view`-Attribut auf `#view-track` (Track slidet über CSS), rendert IMMER beide Views (Dashboard rechts, Shopping links) und den Header (view-abhängig). Der Swipe-Handler wird einmalig auf `<main>` gemountet und ruft `setView` + `refresh` beim View-Wechsel.

Beide Views immer rendern hat zwei Gründe: (a) Swipe-Animation sieht schon den korrekten Ziel-Content, (b) beim View-Wechsel via Swipe ist keine Render-Verzögerung.

**Files:**
- Modify: `src/main.js` (Komplettersatz)

- [ ] **Step 1: `src/main.js` ersetzen**

```js
import { renderHeader } from './dashboard/header.js';
import { renderDashboard } from './dashboard/render.js';
import { rerollAll } from './dashboard/reroll.js';
import { changeGlobalPortion } from './dashboard/portions.js';
import { renderShoppingList } from './shopping-list/render.js';
import { resetChecked } from './shopping-list/check.js';
import { mountDetailSheet, openDetailSheet } from './detail-sheet/render.js';
import { attachViewSwipe } from './nav/swipe.js';
import { state, setView } from './state.js';

const headerRoot = document.getElementById('app-header');
const mainEl = document.getElementById('app');
const viewTrack = document.getElementById('view-track');
const dashboardRoot = document.getElementById('view-dashboard');
const shoppingRoot = document.getElementById('view-shopping');
const sheetRoot = document.getElementById('detail-sheet-root');

function refresh() {
  // Header ist view-abhängig — Dashboard-Actions vs. Shopping-Reset.
  renderHeader(headerRoot, {
    view: state.view,
    onGlobalPortionChange: (delta) => {
      changeGlobalPortion(delta);
      refresh();
    },
    onRerollAll: () => {
      rerollAll();
      refresh();
    },
    onResetChecked: () => {
      resetChecked();
      refresh();
    },
  });

  // Beide Views immer rendern: der Swipe braucht den Zielinhalt sofort sichtbar.
  renderDashboard(dashboardRoot, refresh, openDetailSheet);
  renderShoppingList(shoppingRoot, { onChange: refresh });

  // Track slidet per CSS-Attribut-Selektor auf `data-view`.
  viewTrack.dataset.view = state.view;
}

// Sheet einmalig mounten; interne Portion-Änderungen triggern refresh() damit Cards
// und Shopping-Mengen mitgezogen werden.
mountDetailSheet(sheetRoot, { onChange: refresh });

// Screen-Swipe einmalig mounten — nutzt state.view aus dem Modul.
attachViewSwipe(mainEl, {
  onViewChange: (next) => {
    setView(next);
    refresh();
  },
});

refresh();
```

- [ ] **Step 2: Commit**

```bash
git add src/main.js
git commit -m "feat(app): render both views + mount screen swipe, header view-aware"
```

---

## Task 15: Dev-Server Smoke-Test (HTTP + visueller Checkpoint)

**Files:** — (nur Verifikation)

- [ ] **Step 1: Dev-Server im Hintergrund starten**

```bash
npm run dev
```

Vite startet auf Port 5173, öffnet den Browser automatisch. Bei Bedarf mit `&` im Hintergrund + `disown`.

- [ ] **Step 2: HTTP-Endpoints prüfen**

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  if /usr/bin/curl -sf -o /dev/null http://localhost:5173/; then
    echo "READY after ${i}s"; break
  fi
  sleep 1
done
for path in \
  / \
  /src/main.js \
  /src/state.js \
  /src/nav/swipe.js \
  /src/shopping-list/render.js \
  /src/shopping-list/consolidate.js \
  /src/shopping-list/check.js \
  /src/shopping-list/progress.js \
  /src/shopping-list/categories.js \
  /src/util/format.js \
  /styles/components/view-track.css \
  /styles/components/shopping-list.css \
  ; do
  code=$(/usr/bin/curl -sI -o /dev/null -w "%{http_code}" "http://localhost:5173${path}")
  echo "$code  $path"
done
```

Expected: alle 200.

- [ ] **Step 3: User-Checkpoint — visuell im Browser prüfen**

Der User testet folgende Interaktionen:

**Dashboard-View (initial):**
- Wie Session 4: sticky Header mit Global-Stepper + Reroll, 7 Cards, Portion-Stepper und Actions funktionieren
- Body scrollt intern in der Dashboard-View (nicht mehr auf body-Level)

**Screen-Wechsel via Swipe:**
- Horizontaler Swipe nach links (auf Card oder freiem Bereich) → Shopping-View slidet rein
- Horizontaler Swipe nach rechts auf Shopping-View → Dashboard slidet zurück
- Vertikales Scrollen bleibt funktional (Ratio 1.4 filtert schräge Swipes raus)
- Header wechselt bei View-Change: Global-Stepper + Reroll-All (Dashboard) ↔ nur Logo bzw. Logo + Reset (Shopping)

**Shopping-View — Empty-State (frisch, nichts ausgewählt):**
- Zeigt "Keine Zutaten in der Liste." + Sub-Text
- Kein Progress, keine Gruppen

**Shopping-View — mit Auswahl:**
- Auf Dashboard 2-3 Tage über "Liste"-Button auswählen
- Swipe zu Shopping → sticky Progress oben ("N von M offen" + gefüllte Bar bei 0 %)
- Kategorien-Gruppen: Frische / Trocken / Gewürze / Öl / Fett / Sonstiges (in dieser Reihenfolge, nur mit Content-Gruppen sichtbar)
- Jede Gruppe: Header + Item-Count, dann Zutaten-Zeilen (Label + Menge, sortiert alphabetisch)
- Mengen einheiten-aware: "500 g", "2 Stück", "1 Bund", "Vorrat prüfen"

**Check-Interaktion:**
- Klick auf Zutaten-Zeile → Zeile wird durchgestrichen + gedimmt, Check-Kreis füllt sich primary mit weißem Häkchen
- Progress-Zeile aktualisiert live ("N-1 von M offen", Bar füllt sich)
- Zutat bleibt an gleicher Position (kein Reorder)
- Zweiter Klick → togglet zurück, wird wieder offen

**Reset-Button (Shopping-Header):**
- Nach mind. einem Häkchen erscheint der Reset-Button rechts im Header (Refresh-Kreis-SVG)
- Klick → alle Häkchen weg, Reset-Button verschwindet, Progress zurück auf "N von N offen"

**Cross-View-Konsistenz:**
- Portion-Änderung im Sheet oder Card triggert Shopping-Update (Mengen ändern sich)
- Karte abwählen ("Liste"-Button aus) → deren Zutaten verschwinden aus Shopping
- Detail-Sheet öffnet weiterhin nur von Dashboard, funktioniert wie in Session 4

**Regression-Check (aus Session 3-4):**
- Header sticky verhalten OK (bleibt oben, auch wenn View intern scrollt)
- Sheet öffnet über Card-Bild/Content/Zutaten-Button, Portion-Stepper synct
- Selected-Card-Tint, action-btn--active für Liste-Button — unverändert
- Reroll-All + Global-Stepper — funktionieren

- [ ] **Step 4: Dev-Server beenden**

Terminal: `Ctrl+C` oder `kill %1`.

---

## Task 16: Production-Build testen

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: Vite meldet erfolgreichen Build, JS-Bundle wächst um ~5–8 KB gegenüber Session 4 (Shopping-Module + Swipe-Nav).

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

## Task 17: Handoff für Session 6 schreiben + Push

**Files:**
- Create: `docs/redesign/handoffs/session-5-to-6.md`

- [ ] **Step 1: Handoff-Doc anlegen**

Analog zu `session-4-to-5.md` strukturieren. Inhalte:

- Kontext-Satz: was Session 5 gebaut hat (Shopping-View mit Kategorien-Rendering, einheiten-aware Formatting via `formatQuantity`, Check-Interaktion mit In-Place-Durchstreichung, sticky Progress-Bar, Screen-Wechsel Dashboard ↔ Shopping via horizontalem Swipe, view-abhängiger Header mit Reset-Button)
- Pflichtlektüre: `CLAUDE.md`, Design-Doc, Session-5-Plan, aktueller Handoff
- Aktueller Repo-Zustand (`git log --oneline main..redesign` — Session 5 fügt ~15-17 Commits hinzu)
- Was Session 6 tun muss (Roadmap-Zeile Session 6: **Bottom-Navigation + localStorage-Persistenz**):
  - Bottom-Nav-Bar am unteren Rand mit zwei Tabs (Dashboard / Einkaufsliste), Icons `icon-dashboard.png` + `icon-einkaufsliste-aktiv/inaktiv.png` (schon in `public/icons/`)
  - Tab-Click ruft dasselbe `setView(next) + refresh()`-Paar wie der Swipe (Task 9). Kein zweiter State-Slot.
  - `--bottom-nav-height` (64px in tokens.css) ist bereits reserviert, muss in `.view` als `padding-bottom` respektiert werden (aktuell nur `safe-area`).
  - Persistenz: `state`-Serialisierung nach jedem `refresh()` in localStorage-Key `mahlzeit-state-v2`. `Set<string>` (checkedShopping) → `Array` für JSON. Beim App-Start laden und ins `state`-Objekt zurückspielen. Migration bewusst nicht nötig (v1 war die alte App).
- Bewusste Entscheidungen aus Session 5, die für Session 6 relevant sind:
  - `setView(next)` in `state.js` ist der zentrale View-Setter — Bottom-Nav ruft ihn identisch wie Swipe
  - `state.view` wird beim Persistieren mitgeschrieben — User startet die App auf dem zuletzt gesehenen Screen
  - `state.checkedShopping` ist `Set<string>` — braucht `Array.from()` beim Serialisieren und `new Set(...)` beim Laden
  - `dishBag` (Reroll-Historie) ist plain Object, geht direkt durch JSON
  - Bottom-Nav MUSS unter Sheet und über `.view` liegen (`z-index`-Reihenfolge: view < bottom-nav < sheet-overlay)
- Constraints (deutsch, kein Framework, Touch-Targets ≥ 48 px)
- Environment-Constraint (kein Subagent-Worktree)
- Empfohlener Skill-Flow (writing-plans → executing-plans direkt in Haupt-Session)

- [ ] **Step 2: Session-5-Plan + Handoff committen**

```bash
git add docs/redesign/2026-07-25-session-5-plan.md docs/redesign/handoffs/session-5-to-6.md
git commit -m "docs(redesign): add session 5 plan + handoff for fresh claude session"
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

Expected: die neuen Commits aus Session 5 ontop von Session 4.

---

## Definition of Done

- ✅ `src/state.js` hat `view`-Slot (Default `'dashboard'`) und `setView`-Helper
- ✅ `src/util/format.js` exportiert `formatQuantity(item)` neben `formatGrams(baseGrams, portions)`
- ✅ `src/shopping-list/categories.js` exportiert `CAT_ORDER` + `CAT_LABELS`
- ✅ `src/shopping-list/consolidate.js` exportiert `buildConsolidatedList()` — liefert Map<key, item> aggregiert aus `state.selected`-Days
- ✅ `src/shopping-list/check.js` exportiert `toggleChecked(key)` + `resetChecked()`
- ✅ `src/shopping-list/progress.js` exportiert `renderProgress(items)` als HTML-String
- ✅ `src/shopping-list/render.js` exportiert `renderShoppingList(root, { onChange })` — Progress + Gruppen + Empty-State
- ✅ `src/nav/swipe.js` exportiert `attachViewSwipe(el, { onViewChange })` mit Threshold 55 px + Ratio 1.4
- ✅ `src/dashboard/header.js` renders view-abhängig (Dashboard: Stepper+Reroll, Shopping: Logo+Reset-if-checked)
- ✅ `src/main.js` orchestriert Header + beide Views + Sheet + Swipe
- ✅ `styles/base.css` hat body als flex-column + main als overflow-clip
- ✅ `styles/components/view-track.css` shifted Track per `data-view`-Attribut
- ✅ `styles/components/shopping-list.css` hat sticky Progress, Kategorien-Groups, Check-Rows
- ✅ `index.html` hat `<main id="app">` mit `<div id="view-track">` und zwei `.view`-Kindern
- ✅ Browser-Check (Task 15 Step 3): alle Interaktionen wie beschrieben
- ✅ `npm run build` läuft ohne Errors, unter 2.5 MB
- ✅ Handoff `docs/redesign/handoffs/session-5-to-6.md` erstellt
- ✅ Alles auf `origin/redesign` gepusht

## Was ist bewusst NICHT Teil dieser Session

- **Bottom-Navigation** → Session 6 (Roadmap). Swipe reicht als alleiniger Trigger für Session 5.
- **localStorage-Persistenz** → Session 6. Session-Ende = frischer State.
- **Leftover-Done-Handling** (abgehakte Zutaten aus abgewählten Gerichten separat anzeigen) — bewusst vereinfacht, siehe Design-Entscheidungen-Tabelle.
- **Erledigt-Section mit Chevron** aus alter App — vereinfacht: checked bleibt in-place, gedimmt.
- **Live-Follow beim View-Swipe** (touchmove-Tracking, drag-along Animation) — Threshold-only reicht, konsistent mit Sheet-Swipe.
- **Filter/Suche in der Shopping-Liste** — nicht in der Roadmap.
- **Sortierung nach Häufigkeit / historische Käufe** — nicht in der Roadmap.
- **APK-Build + `npx cap sync` + Merge nach `main`** → Session 7.
