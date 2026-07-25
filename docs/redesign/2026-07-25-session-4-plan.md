# Session 4 Implementation Plan — Detail-Sheet (Zutaten + Rezept, Swipe zwischen Tabs)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Environment note aus Session 1-3:** Subagent-Worktree-Dispatch ist im Sandbox nicht verfügbar. Direktausführung in der Haupt-Session, siehe `docs/redesign/handoffs/session-3-to-4.md`.

**Goal:** Klick auf Card-Bild, Card-Content oder neuen "Zutaten"-Button öffnet ein Bottom-Sheet, das entweder die Zutaten-Liste (mit Portion-Skalierung) oder die nummerierten Rezept-Schritte zeigt. Tabs im Sheet-Header lassen sich per Klick oder horizontalem Swipe wechseln, ein Portion-Stepper im Sheet ändert `state.portions[day]` und aktualisiert Sheet-Content + Cards.

**Architecture:**
- **Neues `src/detail-sheet/`-Modul** analog zu Session 3s `src/dashboard/`. Drei Files: `render.js` (Sheet-Component, Öffnen/Schließen, Tab-Switch, Swipe), `ingredients.js` (Zutaten-HTML), `recipe.js` (Schritte-HTML). Ein Utility-Modul `src/util/format.js` für die Gramm-Skalierung — landet einmal an einer Stelle, wird in Session 5 (Einkaufsliste) wiederverwendet.
- **Sheet-Root ist ein separates DOM-Element** (`<div id="detail-sheet-root">`) außerhalb von `#app-header` und `#app`. Es ist NICHT Teil von `refresh()` in `main.js` — der Sheet rendert sich selbst, öffnet und schließt außerhalb dieses Zyklus (siehe Handoff-Constraint).
- **Cross-Widget-Update** funktioniert über einen `onExternalChange`-Callback, den `main.js` beim Mount des Sheets injiziert. Wenn der Sheet-Portion-Stepper `state.portions[day]` ändert, ruft er (a) intern seinen eigenen Content-Refresh und (b) den externen Callback, der `refresh()` in `main.js` triggert — Card zeigt aktualisierte Portion.
- **Tab-Switch mit horizontalem Slide.** `.sheet-body` ist `overflow:hidden`, darin ein `.sheet-tabs__track` mit `width:200%` und zwei `.sheet-tabs__panel`-Kindern (je `flex:0 0 50%`). Track bekommt `transform: translateX(0)` oder `translateX(-50%)` mit `transition: 250ms ease`. Jedes Panel hat eigenes `overflow-y:auto` — unabhängige Scroll-Position pro Tab.
- **Swipe-Detektion via touchstart/touchend** auf `.sheet-body`. Threshold: `|Δx| > 55 && |Δx| > 1.4 * |Δy|` (analog zur alten App auf `main`). Kein Live-Follow via touchmove — snap-nur, keine dragende Animation.
- **Schließ-Trigger**: Backdrop-Klick, Close-Button (✕), Escape-Taste.

**Tech Stack:** Vite 8.1.5, Vanilla JS (ES Modules), CSS Custom Properties + `color-mix()`, native Touch-Events. Kein neues Package.

---

## Design-Entscheidungen (autonom getroffen, ohne User-Rückfrage per Session-Instruktion)

| Frage | Entscheidung | Begründung |
|---|---|---|
| Sheet-Höhe | **85vh** fixiert | Aus Handoff-Empfehlung (~85 %). Fixe Höhe wirkt konsistent, unabhängig von Content-Länge. Body scrollt bei längerem Content. |
| Backdrop | **Nur Fade** (rgba(15,23,42,0.42), opacity 0→1 in 200 ms), **kein Blur** | Blur kostet auf Android sichtbar Performance und ist im M3-Bottom-Sheet-Spec nicht Standard. |
| Zutaten-Skalierung | `Math.round(grams * portions)` **immer in Gramm** | Wie alte App. Sheet ist Rezept-/Koch-Kontext → Gramm ist präzise und universell verständlich. Einheiten-aware Formatting (Stück/Zehe/Bund) bleibt der Einkaufsliste vorbehalten (Session 5). |
| Portion-Stepper im Sheet | **JA**, im Sheet-Header rechts (kompakte Variante) | Realistisches Kochszenario: User öffnet Rezept, merkt "ach 3 statt 2 Portionen". Sheet zu → Card-Stepper → Sheet wieder auf ist zu viel Friction. Cross-Widget-Update via `onExternalChange`. |
| Selected-Toggle im Sheet | **NEIN** | Card hat den "Liste"-Button, Sheet fokussiert auf Zutaten/Rezept. Keine redundanten Controls. |
| Wechseln im Sheet | **NEIN** | Bleibt Card-Aktion (Handoff-Empfehlung). |
| Öffnungs-Trigger | **3 Wege**: Card-Bild → Rezept, Card-Content (Day+Meta+Titel-Bereich) → Rezept, neuer "Zutaten"-Button → Zutaten | Deckt intuitive Erwartungen ab (Bild-Tap ist Standard, Explicit-Button für Zutaten). |
| Action-Row-Reihenfolge | **Zutaten \| Wechseln \| Liste** | Aus Handoff. Zutaten links, da neue Aktion und häufig genutzt. |
| Tab-Switch-Animation | Horizontaler Slide via `translateX` mit 250 ms Transition | Materialtypisch, macht Swipe-Verhalten kohärenter (Swipe-Richtung entspricht dem, was sich bewegt). |
| Swipe-Implementierung | Threshold-basiert (touchstart/touchend, kein touchmove) | Simpler Code, wenige Regressionsrisiken. Live-Follow kann bei Bedarf später ergänzt werden. |
| Zutaten-Note "TK-Packung à 400 g" | **Weglassen** im Sheet | Note ist Einkaufslisten-relevant, im Kochkontext eher störend. |
| Sheet-Icon für Zutaten-Button | `icon-rezept-zutaten.png` | Einziges thematisch passendes Icon im `public/icons/`-Pool. |

---

## Voraussetzungen

- Working Directory: `/Users/oliverwosnitza/Documents/Mahlzeit-App`
- Branch: `redesign` (`git branch --show-current` → `redesign`)
- Working Tree: sauber
- Session 3 abgeschlossen (Header + Card-Interaktionen live, `refresh()` orchestriert Header + Dashboard)

## Datei-Struktur nach dieser Session

```
Mahlzeit-App/
├── src/
│   ├── main.js                        ← geändert (mountDetailSheet + Card-onOpenDetail-Verdrahtung)
│   ├── detail-sheet/                  ← NEU
│   │   ├── render.js                  ← NEU (Sheet-Component, Open/Close, Tabs, Swipe, Escape)
│   │   ├── ingredients.js             ← NEU (Zutaten-Liste mit Skalierung)
│   │   └── recipe.js                  ← NEU (Nummerierte Schritte)
│   ├── util/                          ← NEU
│   │   └── format.js                  ← NEU (formatGrams: grams*portions → "220 g")
│   └── dashboard/
│       ├── card.js                    ← geändert (Zutaten-Button, Bild-Klick, Content-Klick)
│       └── render.js                  ← geändert (onOpenDetail-Handler durchreichen)
├── styles/
│   └── components/
│       └── sheet.css                  ← NEU
├── index.html                         ← geändert (Sheet-Root + CSS-Link)
└── docs/redesign/
    ├── 2026-07-25-session-4-plan.md   ← dieses Doc
    └── handoffs/
        └── session-4-to-5.md          ← NEU am Ende
```

---

## Task 1: `src/util/format.js` — Gramm-Formatter

**Warum:** Wird von `ingredients.js` und (Session 5) von der Einkaufsliste gebraucht. Ein zentraler Ort, damit Rundungs-Regeln überall gleich sind. Formatting-Regel: `Math.round(grams * portions)` als Integer, kein Komma. Grund: alle Basis-Werte in `dishes.json` sind bereits ganzzahlig, und Bruchgramm-Anzeigen ("227,3 g") wirken pseudo-präzise für ein Rezept.

**Files:**
- Create: `src/util/format.js`

- [ ] **Step 1: `src/util/format.js` erstellen**

```js
// Formatiert eine Gramm-Menge, skaliert mit den Portionen, für die Detail-Ansicht.
// Rundet auf ganze Gramm — Rezept-Präzision reicht, kein Pseudo-Komma.
// Beispiel: formatGrams(220, 3) → "660 g"
export function formatGrams(baseGrams, portions) {
  return `${Math.round(baseGrams * portions)} g`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/util/format.js
git commit -m "feat(util): add formatGrams helper for portion-scaled quantities"
```

---

## Task 2: `src/detail-sheet/ingredients.js` — Zutaten-Liste

**Warum:** Rendert die Zutaten des aktuellen Gerichts als vertikale Liste. Zwei Spalten pro Zeile: Label (fluide breit) links, Menge rechts. `dish.ingredients` ist ein Array mit `{ key, label, grams, unit, ... }` — wir nutzen nur `label` und `grams`. Die Skalierung passiert über den bereits importierten `formatGrams`-Helper.

Als HTML-String, nicht als DOM-Node — der Sheet-Renderer setzt das Ergebnis via `innerHTML` in das Panel-Element. Konsistent mit dem Rendering-Stil in `card.js` und `header.js`.

**Files:**
- Create: `src/detail-sheet/ingredients.js`

- [ ] **Step 1: `src/detail-sheet/ingredients.js` erstellen**

```js
import { formatGrams } from '../util/format.js';

// Baut die Zutaten-Liste als HTML-String.
// dish.ingredients: [{ key, label, grams, unit, ... }, ...]
// portions: aktuell gültige Portionen für den zugehörigen Tag (state.portions[day])
export function renderIngredients(dish, portions) {
  const rows = dish.ingredients.map((ing) => `
    <li class="ingredient">
      <span class="ingredient__label">${ing.label}</span>
      <span class="ingredient__qty">${formatGrams(ing.grams, portions)}</span>
    </li>
  `).join('');
  return `<ul class="ingredient-list">${rows}</ul>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/detail-sheet/ingredients.js
git commit -m "feat(detail-sheet): ingredients list with portion-scaled grams"
```

---

## Task 3: `src/detail-sheet/recipe.js` — Rezept-Schritte

**Warum:** Nummerierte Liste aus `dish.steps` (Array von Strings). Nummern kommen per CSS-Counter — semantisches `<ol>` reicht, keine expliziten Nummern im HTML.

**Files:**
- Create: `src/detail-sheet/recipe.js`

- [ ] **Step 1: `src/detail-sheet/recipe.js` erstellen**

```js
// Baut die nummerierte Rezept-Liste als HTML-String.
// dish.steps: [string, ...] (5–8 Schritte pro Gericht laut dishes.json)
// Nummern werden per CSS-Counter gerendert — <ol> ist semantisch, <li> stumm.
export function renderRecipe(dish) {
  const items = dish.steps.map((step) => `
    <li class="recipe-step">${step}</li>
  `).join('');
  return `<ol class="recipe-list">${items}</ol>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/detail-sheet/recipe.js
git commit -m "feat(detail-sheet): numbered recipe steps view"
```

---

## Task 4: `src/detail-sheet/render.js` — Sheet-Component

**Warum:** Kernstück von Session 4. Verwaltet den Sheet-Lebenszyklus:

- `mountDetailSheet(rootEl, { onChange })` wird einmal von `main.js` beim Start aufgerufen. Speichert `rootEl` und den `onChange`-Callback (der `refresh()` triggert), initialisiert den Root leer und versteckt.
- `openDetailSheet(dishId, tab, day)` rendert den Sheet-Content in den Root, zeigt ihn per `hidden = false` und fügt in einem `requestAnimationFrame` die `.is-open`-Klasse hinzu (damit die CSS-Transition greift statt sofort zu snappen). Aktiviert Escape-Listener.
- `closeDetailSheet()` entfernt `.is-open`, entfernt Escape-Listener, wartet 250 ms (Transition-Dauer), setzt dann `hidden = true` und leert den Zustand.
- Tab-Switch (Klick auf Tab-Button oder Swipe): setzt `currentContext.tab`, verschiebt `.sheet-tabs__track` per `translateX`, aktualisiert Tab-Buttons-Aktiv-State. **Kein Re-Render der Panels** — die stehen von Anfang an beide da, Panel-Scroll-Positionen bleiben pro Tab erhalten.
- Portion-Change via Sheet-Stepper: ruft `changePortion(day, delta)`, aktualisiert **nur** das Ingredients-Panel (Rezept ist portionsunabhängig) + den Stepper-Value + Disabled-States, ruft dann `onExternalChange()` damit die Card auch aktualisiert wird.
- Swipe-Detection: `touchstart` merkt Start-Koordinaten, `touchend` prüft Δx/Δy, wechselt Tab wenn Threshold gerissen.

**Files:**
- Create: `src/detail-sheet/render.js`

- [ ] **Step 1: `src/detail-sheet/render.js` erstellen**

```js
import { state, PORTIONS_MIN, PORTIONS_MAX } from '../state.js';
import { dishesById } from '../data/dishes.js';
import { changePortion } from '../dashboard/portions.js';
import { renderIngredients } from './ingredients.js';
import { renderRecipe } from './recipe.js';

const TAB_ORDER = ['zutaten', 'rezept'];
const TAB_LABELS = { zutaten: 'Zutaten', rezept: 'Rezept' };
const TRANSITION_MS = 250;
const SWIPE_THRESHOLD_PX = 55;
const SWIPE_DIRECTIONAL_RATIO = 1.4; // |dx| muss 1.4x größer als |dy| sein

let rootEl = null;
let onExternalChange = () => {};
let currentContext = null; // { dishId, day, tab }

// --- Mount / Lifecycle ---

export function mountDetailSheet(el, { onChange } = {}) {
  rootEl = el;
  onExternalChange = onChange || (() => {});
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export function openDetailSheet(dishId, tab, day) {
  if (!rootEl) throw new Error('Detail-Sheet nicht gemountet — mountDetailSheet zuerst aufrufen.');
  currentContext = { dishId, day, tab };
  renderShell();
  rootEl.hidden = false;
  // Doppel-rAF garantiert, dass der Browser den initialen `translateY(100%)`-Zustand
  // ge-paintet hat, bevor wir `.is-open` setzen — sonst springt der Sheet einfach hoch.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => rootEl.querySelector('.sheet-overlay').classList.add('is-open'));
  });
  document.addEventListener('keydown', handleEscape);
}

export function closeDetailSheet() {
  if (!rootEl || rootEl.hidden) return;
  const overlay = rootEl.querySelector('.sheet-overlay');
  if (overlay) overlay.classList.remove('is-open');
  document.removeEventListener('keydown', handleEscape);
  setTimeout(() => {
    // Nur wirklich verstecken, wenn nicht in der Zwischenzeit wieder geöffnet.
    if (rootEl && !rootEl.querySelector('.sheet-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
      currentContext = null;
    }
  }, TRANSITION_MS);
}

function handleEscape(ev) {
  if (ev.key === 'Escape') closeDetailSheet();
}

// --- Rendering ---

function renderShell() {
  const dish = dishesById.get(currentContext.dishId);
  const { day, tab } = currentContext;
  const portions = state.portions[day];
  const minusDisabled = portions <= PORTIONS_MIN;
  const plusDisabled = portions >= PORTIONS_MAX;
  const trackOffset = TAB_ORDER.indexOf(tab) * 50;

  rootEl.innerHTML = `
    <div class="sheet-overlay" data-role="backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-handle" aria-hidden="true"></div>
        <div class="sheet-header">
          <div class="sheet-header__title-wrap">
            <div class="sheet-header__day">${day}</div>
            <h2 class="sheet-header__title" id="sheet-title">${dish.name}</h2>
          </div>
          <div class="sheet-header__actions">
            <div class="stepper stepper--compact" role="group" aria-label="Portionen für ${day}">
              <svg class="stepper__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <button class="stepper__btn" data-action="sheet-portion-minus" aria-label="Weniger Personen für ${day}" ${minusDisabled ? 'disabled' : ''}>−</button>
              <span class="stepper__value">${portions}</span>
              <button class="stepper__btn" data-action="sheet-portion-plus" aria-label="Mehr Personen für ${day}" ${plusDisabled ? 'disabled' : ''}>+</button>
            </div>
            <button class="sheet-close" data-action="close" aria-label="Schließen">✕</button>
          </div>
        </div>
        <div class="sheet-tabs" role="tablist" aria-label="Ansicht">
          ${TAB_ORDER.map((t) => `
            <button class="sheet-tabs__btn ${t === tab ? 'sheet-tabs__btn--active' : ''}"
                    role="tab"
                    aria-selected="${t === tab ? 'true' : 'false'}"
                    data-tab="${t}">${TAB_LABELS[t]}</button>
          `).join('')}
        </div>
        <div class="sheet-body">
          <div class="sheet-tabs__track" style="transform: translateX(-${trackOffset}%);">
            <div class="sheet-tabs__panel" role="tabpanel" data-tab="zutaten">${renderIngredients(dish, portions)}</div>
            <div class="sheet-tabs__panel" role="tabpanel" data-tab="rezept">${renderRecipe(dish)}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  attachHandlers();
}

function attachHandlers() {
  const overlay = rootEl.querySelector('[data-role="backdrop"]');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) closeDetailSheet();
  });
  rootEl.querySelector('[data-action="close"]').addEventListener('click', closeDetailSheet);
  rootEl.querySelector('[data-action="sheet-portion-minus"]').addEventListener('click', () => handleSheetPortion(-1));
  rootEl.querySelector('[data-action="sheet-portion-plus"]').addEventListener('click', () => handleSheetPortion(1));
  rootEl.querySelectorAll('.sheet-tabs__btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  attachSwipe();
}

function attachSwipe() {
  const body = rootEl.querySelector('.sheet-body');
  let startX = 0, startY = 0, tracking = false;
  body.addEventListener('touchstart', (ev) => {
    if (ev.touches.length !== 1) return;
    startX = ev.touches[0].clientX;
    startY = ev.touches[0].clientY;
    tracking = true;
  }, { passive: true });
  body.addEventListener('touchend', (ev) => {
    if (!tracking) return;
    tracking = false;
    const dx = ev.changedTouches[0].clientX - startX;
    const dy = ev.changedTouches[0].clientY - startY;
    if (Math.abs(dx) <= SWIPE_THRESHOLD_PX) return;
    if (Math.abs(dx) <= Math.abs(dy) * SWIPE_DIRECTIONAL_RATIO) return;
    const idx = TAB_ORDER.indexOf(currentContext.tab);
    if (dx < 0 && idx < TAB_ORDER.length - 1) switchTab(TAB_ORDER[idx + 1]);
    else if (dx > 0 && idx > 0) switchTab(TAB_ORDER[idx - 1]);
  }, { passive: true });
}

// --- Interactions ---

function switchTab(nextTab) {
  if (!currentContext || currentContext.tab === nextTab) return;
  currentContext.tab = nextTab;
  const idx = TAB_ORDER.indexOf(nextTab);
  rootEl.querySelector('.sheet-tabs__track').style.transform = `translateX(-${idx * 50}%)`;
  rootEl.querySelectorAll('.sheet-tabs__btn').forEach((btn) => {
    const isActive = btn.dataset.tab === nextTab;
    btn.classList.toggle('sheet-tabs__btn--active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

function handleSheetPortion(delta) {
  if (!currentContext) return;
  changePortion(currentContext.day, delta);
  const dish = dishesById.get(currentContext.dishId);
  const portions = state.portions[currentContext.day];
  // Ingredients-Panel neu rendern; Rezept-Panel ist portionsunabhängig, unverändert lassen.
  const ingredientsPanel = rootEl.querySelector('.sheet-tabs__panel[data-tab="zutaten"]');
  ingredientsPanel.innerHTML = renderIngredients(dish, portions);
  // Stepper-Anzeige aktualisieren
  rootEl.querySelector('.stepper__value').textContent = portions;
  rootEl.querySelector('[data-action="sheet-portion-minus"]').disabled = portions <= PORTIONS_MIN;
  rootEl.querySelector('[data-action="sheet-portion-plus"]').disabled = portions >= PORTIONS_MAX;
  // Cards im Hintergrund aktualisieren (Card-Stepper zeigt neuen Wert).
  onExternalChange();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/detail-sheet/render.js
git commit -m "feat(detail-sheet): sheet component with tabs, swipe, portion stepper"
```

---

## Task 5: `styles/components/sheet.css` — Sheet-Styles

**Warum:** Overlay (fixed, dunkler Backdrop, fade-in), Sheet-Container (bottom, 85vh, translate-up-animation), Handle, Header mit Titel + Stepper + Close, Tab-Bar mit Active-Underline, Body mit horizontal shiftbarem Track, zwei Panels je mit eigenem vertikalen Scroll. Zutaten- und Rezept-Item-Styling.

Nutzt die bestehenden Design-Tokens (`--md-sys-color-*`, `--radius-*`, `--touch-target-min`) und die `.stepper.stepper--compact`-Klassen aus `stepper.css`. Kein Duplikat, keine neuen Tokens.

**Files:**
- Create: `styles/components/sheet.css`

- [ ] **Step 1: `styles/components/sheet.css` erstellen**

```css
/* Overlay ist der Full-Screen-Backdrop, hält das Sheet unten am Rand. */
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(15, 23, 42, 0.42);
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease;
}

.sheet-overlay.is-open {
  opacity: 1;
  pointer-events: auto;
}

/* Der Sheet selbst: 85vh, sitzt initial unten außerhalb (translateY 100%),
   schiebt sich beim Öffnen hoch. Max-Breite matcht das Card-Layout. */
.sheet {
  width: 100%;
  max-width: 640px;
  height: 85vh;
  background: var(--md-sys-color-surface-container-lowest);
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.14);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateY(100%);
  transition: transform 250ms cubic-bezier(0.2, 0, 0, 1);
}

.sheet-overlay.is-open .sheet {
  transform: translateY(0);
}

/* Kleine Drag-Indikator-Pille oben — rein visuell (kein Drag-Handler in Session 4). */
.sheet-handle {
  width: 40px;
  height: 5px;
  border-radius: 99px;
  background: var(--md-sys-color-outline-variant);
  margin: 10px auto 4px;
  flex-shrink: 0;
}

.sheet-header {
  flex-shrink: 0;
  padding: 6px 20px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.sheet-header__title-wrap {
  min-width: 0;
  flex: 1 1 auto;
}

.sheet-header__day {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--md-sys-color-primary);
  margin-bottom: 2px;
}

.sheet-header__title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sheet-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.sheet-close {
  width: 36px;
  height: 36px;
  border: none;
  background: color-mix(in srgb, var(--md-sys-color-primary) 12%, var(--md-sys-color-surface-container-lowest));
  color: var(--md-sys-color-on-primary-container);
  border-radius: 50%;
  font-size: 1.125rem;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 120ms ease, transform 120ms ease;
}

.sheet-close:hover {
  background: color-mix(in srgb, var(--md-sys-color-primary) 18%, var(--md-sys-color-surface-container-lowest));
}

.sheet-close:active {
  transform: scale(0.94);
}

/* Tab-Bar: zwei gleichbreite Buttons, Aktiver mit Unterstreichung. */
.sheet-tabs {
  flex-shrink: 0;
  display: flex;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.sheet-tabs__btn {
  flex: 1 1 0;
  min-height: var(--touch-target-min);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 12px 8px;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease;
}

.sheet-tabs__btn:hover {
  color: var(--md-sys-color-on-surface);
}

.sheet-tabs__btn--active {
  color: var(--md-sys-color-primary);
  border-bottom-color: var(--md-sys-color-primary);
}

/* Body ist der scroll-clip; Track hält beide Panels nebeneinander (200% breit)
   und wird per translateX verschoben. Jedes Panel scrollt intern eigenständig. */
.sheet-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.sheet-tabs__track {
  display: flex;
  width: 200%;
  height: 100%;
  transition: transform 250ms cubic-bezier(0.2, 0, 0, 1);
}

.sheet-tabs__panel {
  flex: 0 0 50%;
  overflow-y: auto;
  padding: 16px 20px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

/* Zutaten-Liste */
.ingredient-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.ingredient {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.ingredient:last-child {
  border-bottom: none;
}

.ingredient__label {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--md-sys-color-on-surface);
  font-size: 0.9375rem;
}

.ingredient__qty {
  flex-shrink: 0;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.9375rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* Rezept-Schritte: <ol> mit CSS-Counter für runde Nummern-Badges. */
.recipe-list {
  list-style: none;
  counter-reset: recipe-step;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.recipe-step {
  counter-increment: recipe-step;
  position: relative;
  padding-left: 40px;
  color: var(--md-sys-color-on-surface);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.recipe-step::before {
  content: counter(recipe-step);
  position: absolute;
  left: 0;
  top: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  font-weight: 700;
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles/components/sheet.css
git commit -m "feat(styles): detail sheet (overlay, tabs track, ingredients + recipe styles)"
```

---

## Task 6: `index.html` — Sheet-Root + CSS-Link

**Warum:** Sheet braucht ein eigenes Root-Element außerhalb von `#app-header` und `#app`, damit es als Overlay über allem liegen kann. `<div id="detail-sheet-root">` wird von `main.js` gemountet. Zusätzlich der CSS-Link.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: `index.html` erweitern (CSS-Link + Root-Div)**

Aktueller Inhalt:
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
  <header id="app-header" class="app-header"></header>
  <main id="app"></main>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

Ersetzen durch:
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
</head>
<body>
  <header id="app-header" class="app-header"></header>
  <main id="app"></main>
  <div id="detail-sheet-root"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat(index): mount detail-sheet root + link sheet.css"
```

---

## Task 7: `src/dashboard/card.js` — Zutaten-Button + Bild-Klick + Content-Klick

**Warum:** Card bekommt einen dritten Action-Button "Zutaten" (als **ersten** in der Row: Zutaten | Wechseln | Liste). Zusätzlich werden zwei neue Klick-Zonen ergänzt:

1. **Card-Bild** → öffnet Sheet auf Rezept-Tab
2. **Content-Bereich** (`.day-card__body`, aber ausgenommen `.stepper` und `.day-card__actions`) → öffnet Sheet auf Rezept-Tab

Handler-Interface bekommt neu: `handlers.onOpenDetail(tab)` mit `tab` ∈ `'zutaten' | 'rezept'`.

Content-Klick-Filter: `event.target.closest('.stepper, .day-card__actions')` — wenn nicht `null`, ignoriere (der User hat auf eine Interaktion geklickt). Simpler als jedem Text-Element einen Handler zu geben; das Float-Layout bleibt unangetastet.

Bild bekommt `cursor: pointer` via CSS (kommt in Task 8), sonst sichtbar keine Änderung.

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
//     handlers: {
//       onPortionChange(delta),
//       onReroll(),
//       onToggleSelected(),
//       onOpenDetail(tab)              // tab: 'zutaten' | 'rezept'
//     } }
export function createDayCard({ day, dish, portions, isSelected, handlers }) {
  const article = document.createElement('article');
  article.className = 'day-card' + (isSelected ? ' day-card--selected' : '');
  const imageSrc = `/dishes/dish-${dish.id}.jpg`;
  const minusDisabled = portions <= PORTIONS_MIN;
  const plusDisabled = portions >= PORTIONS_MAX;
  const selectionIcon = isSelected ? 'icon-einkaufsliste-aktiv' : 'icon-einkaufsliste-inaktiv';
  const selectionLabel = isSelected ? 'Für Einkaufsliste abwählen' : 'Für Einkaufsliste auswählen';

  article.innerHTML = `
    <img class="day-card__image" src="${imageSrc}" alt="${dish.name}" loading="lazy" data-action="open-recipe" />
    <div class="day-card__body">
      <div class="stepper stepper--compact" role="group" aria-label="Portionen für ${day}">
        <svg class="stepper__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <button class="stepper__btn" data-action="portion-minus" aria-label="Weniger Personen für ${day}" ${minusDisabled ? 'disabled' : ''}>−</button>
        <span class="stepper__value">${portions}</span>
        <button class="stepper__btn" data-action="portion-plus" aria-label="Mehr Personen für ${day}" ${plusDisabled ? 'disabled' : ''}>+</button>
      </div>
      <div class="day-card__day">${day}</div>
      <div class="day-card__meta">~${dish.cooktime} Min. · ${dish.cuisine}</div>
      <h2 class="day-card__title">${dish.name}</h2>
      <div class="day-card__actions">
        <button class="action-btn" data-action="open-ingredients" aria-label="Zutaten für ${day} anzeigen">
          <img src="/icons/icon-rezept-zutaten.png" alt="" />
          <span>Zutaten</span>
        </button>
        <button class="action-btn" data-action="reroll" aria-label="Neues Gericht für ${day} auslosen">
          <img src="/icons/icon-auslosen.png" alt="" />
          <span>Wechseln</span>
        </button>
        <button class="action-btn ${isSelected ? 'action-btn--active' : ''}" data-action="toggle-selected" aria-label="${selectionLabel}">
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
  article.querySelector('[data-action="open-ingredients"]').addEventListener('click', () => handlers.onOpenDetail('zutaten'));
  article.querySelector('[data-action="open-recipe"]').addEventListener('click', () => handlers.onOpenDetail('rezept'));

  // Content-Bereich (Body außerhalb Stepper und Actions) öffnet ebenfalls den Rezept-Tab.
  // Kein separater Wrapper — Klick-Filter via closest().
  const body = article.querySelector('.day-card__body');
  body.addEventListener('click', (ev) => {
    if (ev.target.closest('.stepper, .day-card__actions')) return;
    handlers.onOpenDetail('rezept');
  });

  return article;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/card.js
git commit -m "feat(card): add ingredients button + image/content click to open detail sheet"
```

---

## Task 8: `styles/components/card.css` — Klickbare Bild/Content-Zonen visuell

**Warum:** Ein `.day-card__image` und `.day-card__body` (außer Interaktions-Kindern) sind jetzt klickbar. Ergänze `cursor: pointer` für Discoverability. Das Body-Layout selbst bleibt unangetastet.

**Files:**
- Modify: `styles/components/card.css`

- [ ] **Step 1: `styles/components/card.css` erweitern**

Ans Ende der Datei anhängen:

```css

/* Bild und Content-Bereich öffnen das Detail-Sheet (Rezept-Tab).
   Nur der Cursor signalisiert die Interaktion — keine Farb- oder Overlay-Änderung,
   damit die Card nicht wie ein einzelner riesiger Button wirkt. */
.day-card__image {
  cursor: pointer;
}

.day-card__body {
  cursor: pointer;
}

/* Interaktive Kinder ignorieren den Body-Cursor und zeigen ihren eigenen. */
.day-card__body .stepper,
.day-card__body .stepper__btn,
.day-card__body .action-btn {
  cursor: default;
}

.day-card__body .stepper__btn:not(:disabled),
.day-card__body .action-btn {
  cursor: pointer;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles/components/card.css
git commit -m "style(card): pointer cursor on image + body to signal open-detail affordance"
```

---

## Task 9: `src/dashboard/render.js` — onOpenDetail-Handler durchreichen

**Warum:** `renderDashboard` bekommt einen zweiten Callback `onOpenDetail(dishId, tab, day)`. Wird von `main.js` injiziert und für jede Card zu `handlers.onOpenDetail(tab)` gemappt (weil die Card selbst nur den Tab weitergibt — `dishId` und `day` sind im Card-Scope schon bekannt).

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

export function renderDashboard(root, onChange, onOpenDetail) {
  // Erst-Initialisierung: falls noch kein Assignment vorliegt, würfeln.
  if (Object.keys(state.assignment).length === 0) {
    initState(pickInitialAssignment());
  }

  root.innerHTML = '';
  for (const day of DAYS) {
    const dishId = state.assignment[day];
    const dish = dishesById.get(dishId);
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
        onOpenDetail: (tab) => {
          onOpenDetail(dishId, tab, day);
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
git commit -m "feat(dashboard): pass onOpenDetail handler through to each card"
```

---

## Task 10: `src/main.js` — Sheet mounten, Card mit Sheet verdrahten

**Warum:** Startet den Sheet-Mount einmalig beim App-Init und verdrahtet den Card-`onOpenDetail`-Callback mit `openDetailSheet(...)`. Der Sheet ruft `refresh()` als `onExternalChange`, wenn sein interner Portion-Stepper `state.portions[day]` ändert.

**Files:**
- Modify: `src/main.js` (Komplettersatz)

- [ ] **Step 1: `src/main.js` ersetzen**

```js
import { renderHeader } from './dashboard/header.js';
import { renderDashboard } from './dashboard/render.js';
import { rerollAll } from './dashboard/reroll.js';
import { changeGlobalPortion } from './dashboard/portions.js';
import { mountDetailSheet, openDetailSheet } from './detail-sheet/render.js';

const headerRoot = document.getElementById('app-header');
const dashboardRoot = document.getElementById('app');
const sheetRoot = document.getElementById('detail-sheet-root');

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
  renderDashboard(dashboardRoot, refresh, openDetailSheet);
}

// Sheet einmalig mounten; interne Portion-Änderungen triggern refresh() damit Cards
// mitgezogen werden.
mountDetailSheet(sheetRoot, { onChange: refresh });

refresh();
```

- [ ] **Step 2: Commit**

```bash
git add src/main.js
git commit -m "feat(app): mount detail-sheet + wire card open-detail to openDetailSheet"
```

---

## Task 11: Dev-Server Smoke-Test (HTTP + visueller Checkpoint)

**Files:** — (nur Verifikation)

- [ ] **Step 1: Dev-Server im Hintergrund starten**

```bash
npm run dev
```

Vite startet auf Port 5173, öffnet den Browser automatisch. Bei Bedarf im Vordergrund lassen und im zweiten Terminal weitermachen — oder `npm run dev &` und `disown`.

- [ ] **Step 2: HTTP-Endpoints prüfen**

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf -o /dev/null http://localhost:5173/; then
    echo "READY after ${i}s"; break
  fi
  sleep 1
done
for path in \
  / \
  /src/main.js \
  /src/detail-sheet/render.js \
  /src/detail-sheet/ingredients.js \
  /src/detail-sheet/recipe.js \
  /src/util/format.js \
  /styles/components/sheet.css \
  /icons/icon-rezept-zutaten.png \
  ; do
  code=$(curl -sI -o /dev/null -w "%{http_code}" "http://localhost:5173${path}")
  echo "$code  $path"
done
```

Expected: alle 200.

- [ ] **Step 3: User-Checkpoint — visuell im Browser prüfen**

Der User testet folgende Interaktionen:

**Sheet-Öffner:**
- Klick auf Card-Bild → Sheet öffnet auf **Rezept**-Tab
- Klick auf Card-Content-Bereich (Day/Titel/Meta-Zeile) → Sheet öffnet auf **Rezept**-Tab
- Klick auf "Zutaten"-Button in der Action-Row → Sheet öffnet auf **Zutaten**-Tab
- Klick auf "Wechseln"/"Liste"/Portion-Stepper → Sheet öffnet **nicht** (normale Card-Aktionen)

**Sheet-Content:**
- Sheet-Höhe ~85 % des Viewports, unten am Rand, oben abgerundet
- Backdrop verdunkelt den Rest sichtbar, kein Blur
- Header zeigt Wochentag (klein, primary) + Dish-Name (groß) links, rechts kompakten Portion-Stepper + Close-Button
- Tab-Bar unter Header: "Zutaten" | "Rezept", aktiver Tab unterstrichen (primary)
- Zutaten-Tab: Liste von Zutaten, Label links, Gramm-Menge rechts (fett, tabular-nums)
- Rezept-Tab: nummerierte Schritte mit runden Nummern-Badges (primary-container background)

**Sheet-Interaktionen:**
- Klick auf "Rezept"-Tab → Panel schiebt horizontal nach rechts (Rezept sichtbar)
- Klick auf "Zutaten"-Tab → Panel schiebt zurück
- Horizontaler Swipe im Body: links → Rezept, rechts → Zutaten
- Portion-Stepper im Sheet-Header: `+`/`−` ändert Zutaten-Mengen live (Rezept unverändert) UND die Card-Portion-Anzeige im Hintergrund
- Klick auf Backdrop (dunkler Bereich um den Sheet) → schließt
- Klick auf ✕-Button → schließt
- Escape-Taste → schließt
- Öffnungs- und Schließ-Animation: Sheet slidet von unten hoch bzw. runter, Backdrop fadet 200 ms

**Regression-Check (aus Session 3):**
- Header-Global-Stepper, Reroll-All, Card-Stepper, Wechseln, Liste — alles wie vorher
- Selected-Card-Tint (15 % primary) wird von Sheet-Öffnungen nicht getroffen

- [ ] **Step 4: Dev-Server beenden**

Terminal: `Ctrl+C` oder `kill %1`.

---

## Task 12: Production-Build testen

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: Vite meldet erfolgreichen Build, JS-Bundle wächst um ~4–6 kB gegenüber Session 3 (Sheet + Ingredients + Recipe + Format).

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

## Task 13: Handoff für Session 5 schreiben + Push

**Files:**
- Create: `docs/redesign/handoffs/session-4-to-5.md`

- [ ] **Step 1: Handoff-Doc anlegen**

Analog zu `session-3-to-4.md` strukturieren. Inhalte:

- Kontext-Satz: was Session 4 gebaut hat (Detail-Sheet mit zwei Tabs, Zutaten-Skalierung, Rezept-Schritte, horizontaler Swipe, Portion-Stepper im Sheet der Cards mitzieht, Escape/Backdrop/Close alle als Schließer)
- Pflichtlektüre: `CLAUDE.md`, Design-Doc, Session-4-Plan, aktueller Handoff
- Aktueller Repo-Zustand (`git log --oneline main..redesign` — ~13 neue Commits addiert)
- Was Session 5 tun muss (Roadmap-Zeile "Einkaufsliste — Kategorien-Rendering, Check-Interaktion, Progress-Bar"):
  - Neue Screen-Fläche (aktuell nur Dashboard sichtbar — Einkaufsliste wird zweiter Screen, aber Bottom-Nav erst Session 6 → für Session 5 vermutlich Zweit-Root oder Toggle-Button im Header als Übergang)
  - Zutaten aller `selected`-Days konsolidieren (siehe `buildConsolidatedList()` in `/tmp/mahlzeit-main.html`)
  - Nach Kategorien gruppieren (`ing.cat`: `frisch`, `trocken`, `oel`, `gewuerze`, `sonstig`) → in JSON `dishes.meta[key][1]` und `ing.cat` verfügbar
  - Einheiten-aware Anzeige (Gramm, Stück, Bund, Zehe, Ei, "Vorrat prüfen" bei `unit === 'vorrat'`) — siehe `displayQty()` in `/tmp/mahlzeit-main.html`
  - Check-Interaktion pro Zutat → `state.checkedShopping` (Set)
  - Progress-Bar oben zeigt "X von Y erledigt"
- Bewusste Entscheidungen aus Session 4, die für Session 5 relevant sind:
  - `src/util/format.js` existiert mit `formatGrams` — Session 5 kann eine `formatQuantity(item)`-Funktion daneben stellen, die je nach `unit` unterschiedlich formatiert
  - `state.checkedShopping` ist bereits als `Set` im `state`-Objekt vorhanden (Session 3), aber noch nicht befüllt
  - Sheet-Component ist auf Detail-Sheet zugeschnitten (Zutaten/Rezept-Tabs, Portion-Stepper) — die Einkaufsliste sollte NICHT im selben Sheet leben, sondern ein eigener Screen (Session 6 macht dann Bottom-Nav zum Umschalten)
  - `refresh()` in `main.js` orchestriert weiter Header + Dashboard; wenn Session 5 einen Shopping-Screen ergänzt, muss `refresh()` erweitert werden (oder ein zweiter Toggle)
  - `state.selected[day]` bestimmt, welche Tage in die Einkaufsliste einfließen — Card-"Liste"-Button aus Session 3 bleibt die Auswahl-Quelle
- Constraints (deutsch, kein Framework, keine Persistenz, Touch-Targets ≥ 48 px)
- Environment-Constraint (kein Subagent-Worktree)
- Empfohlener Skill-Flow (writing-plans → executing-plans direkt in Haupt-Session)

- [ ] **Step 2: Session-4-Plan + Handoff committen**

```bash
git add docs/redesign/2026-07-25-session-4-plan.md docs/redesign/handoffs/session-4-to-5.md
git commit -m "docs(redesign): add session 4 plan + handoff for fresh claude session"
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

Expected: die neuen Commits aus Session 4 ontop von Session 3.

---

## Definition of Done

- ✅ `src/util/format.js` exportiert `formatGrams(baseGrams, portions)`
- ✅ `src/detail-sheet/ingredients.js` exportiert `renderIngredients(dish, portions)`, gibt HTML-String zurück
- ✅ `src/detail-sheet/recipe.js` exportiert `renderRecipe(dish)`, gibt HTML-String zurück
- ✅ `src/detail-sheet/render.js` exportiert `mountDetailSheet`, `openDetailSheet(dishId, tab, day)`, `closeDetailSheet()`
- ✅ Sheet rendert Header (Day + Titel + Portion-Stepper + Close), Tab-Bar (Zutaten | Rezept mit Active-Underline), Body mit shift-Track
- ✅ Klick auf Tab-Header wechselt via `translateX` (250 ms)
- ✅ Horizontaler Swipe im Body wechselt Tabs (Threshold 55 px, |dx| > 1.4 * |dy|)
- ✅ Portion-Stepper im Sheet ändert `state.portions[day]`, aktualisiert Ingredients-Panel + Cards (via `onExternalChange`)
- ✅ Sheet schließt via Backdrop, ✕-Button, Escape-Taste
- ✅ Öffnungs-/Schließ-Animation: Sheet slidet mit `transform: translateY`, Backdrop fadet
- ✅ `src/dashboard/card.js` hat dritten Action-Button "Zutaten" (als erster), Bild und Content-Bereich rufen `handlers.onOpenDetail(tab)`
- ✅ `src/dashboard/render.js` reicht `onOpenDetail` an jede Card
- ✅ `src/main.js` mountet Sheet einmalig, verdrahtet Card mit `openDetailSheet`
- ✅ `styles/components/sheet.css` existiert, `styles/components/card.css` bekommt Cursor-Regeln
- ✅ `index.html` hat `<div id="detail-sheet-root">` und den `sheet.css`-Link
- ✅ Browser-Check (Task 11 Step 3): alle Interaktionen wie beschrieben
- ✅ `npm run build` läuft ohne Errors, unter 2.5 MB
- ✅ Handoff `docs/redesign/handoffs/session-4-to-5.md` erstellt
- ✅ Alles auf `origin/redesign` gepusht

## Was ist bewusst NICHT Teil dieser Session

- **Einheiten-aware Formatting** (Stück, Bund, Zehe, Ei) → Session 5 (Einkaufsliste), da dort der User-Nutzen liegt
- **Makros (kcal/P/KH/F)** — sind in `dishes.json` vorhanden, aber im Rebuild noch nicht designed. Bleibt eine separate Entscheidung
- **Einkaufsliste** → Session 5
- **Bottom-Navigation zwischen Dashboard und Einkaufsliste** → Session 6
- **Live-Follow beim Swipe** (touchmove-Tracking, drag-along Animation) — Threshold-only reicht und ist einfacher zu debuggen
- **Drag-to-close via Sheet-Handle** — Handle ist nur visuell, kein Handler. Wenn User es später will, ist es ein isolierter Zusatz
- **Persistenz** (`mahlzeit-state-v2` in localStorage) → Session 6
- **APK-Build + `npx cap sync` + Merge nach `main`** → Session 7
