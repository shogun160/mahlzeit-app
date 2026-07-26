import { state, DAYS } from '../state.js';
import { allDishes } from '../data/dishes.js';

// Material Symbol shopping_bag — identisches Icon wie in Card + Bottom-Nav.
const ICON_SHOPPING = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm0-80h480v-480h-80v80q0 17-11.5 28.5T600-520q-17 0-28.5-11.5T560-560v-80H400v80q0 17-11.5 28.5T360-520q-17 0-28.5-11.5T320-560v-80h-80v480Zm160-560h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-720Z"/></svg>`;
// Material Symbol close — X-Icon für den Filter-Reset-Button im Picker-Header.
const ICON_CLOSE = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M256-200l-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>`;

// Filter-Chips oben im Picker. Vier Gruppen mit unterschiedlicher Verknüpfung:
//
//   diet (Fleisch/Fisch/Vegetarisch): OR — mindestens eine der aktiven muss
//     matchen. Sind alle drei aktiv oder keine, wirkt die Gruppe wie "alle".
//     Die drei sind sich gegenseitig ausschließende Kategorien.
//
//   cuisine (Asiatisch/Mediterran/Nahost/Amerikanisch): OR — analog Diät.
//     Mehrere aktive Küchen ergänzen sich additiv, keine aktive = alle.
//
//   attr (Schnell/Wenig Zutaten): AND — jede aktive muss matchen. Das sind
//     unabhängige Zusatz-Constraints, die man kumulativ enger schneidet.
//
//   kcal (Kalorienarm/Kalorienreich): OR — hilft dem User die Wochenbilanz
//     aktiv zu steuern. Gemessen an der Rezept-Basis (dish.kcal, ungeskaliert)
//     gegen den Median der Basis-Range (800-1100 kcal → 950): "Arm" = kleiner
//     als 950, "Reich" = größer als 950. Bewusst NICHT gegen das skalierte
//     kcal + Abendessen-Ziel — die Skalierung bringt alle Gerichte nahe ans
//     Ziel, sodass "arm/reich" dort keine Aussagekraft mehr hat.
//
// Kombiniert:  dietOk && cuisineOk && attrOk && kcalOk && macroOk
const FILTERS = [
  { key: 'meat',   label: 'Fleisch',       group: 'diet',    test: (d) => d.tags.includes('contains-meat') },
  { key: 'fish',   label: 'Fisch',         group: 'diet',    test: (d) => d.tags.includes('contains-fish') },
  { key: 'veg',    label: 'Vegetarisch',   group: 'diet',    test: (d) => !d.tags.includes('contains-meat') && !d.tags.includes('contains-fish') },
  { key: 'asian',         label: 'Asiatisch',   group: 'cuisine', test: (d) => d.cuisineGroup === 'asian' },
  { key: 'mediterranean', label: 'Mediterran',  group: 'cuisine', test: (d) => d.cuisineGroup === 'mediterranean' },
  { key: 'middleEast',    label: 'Nahost',      group: 'cuisine', test: (d) => d.cuisineGroup === 'middleEast' },
  { key: 'americas',      label: 'Amerikanisch', group: 'cuisine', test: (d) => d.cuisineGroup === 'americas' },
  { key: 'fast',   label: 'Schnell',       group: 'attr',    test: (d) => d.cooktime <= 30 },
  { key: 'simple', label: 'Wenig Zutaten', group: 'attr',    test: (d) => openIngredientCount(d) <= 8 },
  { key: 'kcal_low',  label: 'Kalorienarm',   group: 'kcal', test: (d) => d.kcal < KCAL_MEDIAN },
  { key: 'kcal_high', label: 'Kalorienreich', group: 'kcal', test: (d) => d.kcal > KCAL_MEDIAN },
  { key: 'macro_protein', label: 'P-reich',      group: 'macro', test: (d) => macroPct(d).p > 35 },
  { key: 'macro_lowcarb', label: 'KH-arm',       group: 'macro', test: (d) => macroPct(d).kh < 30 },
  { key: 'macro_lowfat',  label: 'F-arm',        group: 'macro', test: (d) => macroPct(d).f < 25 },
  { key: 'macro_balanced', label: 'Ausgewogen',  group: 'macro', test: (d) => {
    const m = macroPct(d);
    return m.p >= 22 && m.p <= 42 && m.kh >= 22 && m.kh <= 42 && m.f >= 22 && m.f <= 42;
  } },
];

// Median der Rezept-Basis-Range (Rezepte sind auf 800-1100 kcal abgestimmt,
// siehe CLAUDE.md-Kontext). Grenze für Kalorien-Filter im Picker.
const KCAL_MEDIAN = 950;

// Makro-Verteilung eines Gerichts in Prozent (P/KH/F Kalorien / Gesamt-Makro-
// kcal). Skalierungs-invariant — die Verhältnisse bleiben bei Rezept-
// Skalierung gleich, also lässt sich sinnvoll filtern.
// Faktoren: P und KH je 4 kcal/g, F 9 kcal/g.
function macroPct(dish) {
  const macroKcal = dish.p * 4 + dish.kh * 4 + dish.f * 9;
  if (macroKcal === 0) return { p: 0, kh: 0, f: 0 };
  return {
    p: (dish.p * 4) / macroKcal * 100,
    kh: (dish.kh * 4) / macroKcal * 100,
    f: (dish.f * 9) / macroKcal * 100,
  };
}

// Anzahl noch nicht abgehakter Zutaten dieses Gerichts — identisch zur Pille
// auf dem Picker-Tile und zum Card-Badge im Dashboard. Wird sowohl vom
// "Wenig Zutaten"-Filter als auch vom Sort genutzt, damit Sichtbares (Pille)
// und Ranking konsistent bleiben.
function openIngredientCount(dish) {
  return dish.ingredients.filter((i) => !state.checkedShopping.has(i.key)).length;
}

// True wenn das Gericht an mindestens einem der ausgewählten Tage geplant ist —
// also faktisch auf der Einkaufsliste steht. Steuert die Aktiv-Optik der Shop-
// Pille im Picker, damit der User beim Umwählen sieht welche Gerichte bereits
// im Korb liegen.
function isDishInCart(dishId) {
  for (const day of DAYS) {
    if (state.assignment[day] === dishId && state.selected[day]) return true;
  }
  return false;
}

const TRANSITION_MS = 250;
const SCROLL_COMPACT_THRESHOLD = 8; // px Scroll bis Filter-Row zusammenklappt
const SWIPE_THRESHOLD_PX = 55;
const SWIPE_DIRECTIONAL_RATIO = 1.4; // |dy| muss 1.4x größer als |dx| sein

let rootEl = null;
let onExternalPick = null;
let currentDay = null;
let activeFilters = new Set();
// Collapse-State der Filter-Section — modul-lokal (transient, verliert sich
// beim App-Restart, überlebt aber Sheet-Close/Reopen weil das Modul lebt).
// Konsistent mit dem Muster im Settings-Sheet.
let filtersCollapsed = false;

export function mountDishPicker(el, { onPick } = {}) {
  rootEl = el;
  onExternalPick = onPick || (() => {});
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export function openDishPicker(day) {
  if (!rootEl) throw new Error('Dish-Picker nicht gemountet.');
  currentDay = day;
  activeFilters = deriveInitialFilters();
  // Frisch öffnen → Filter-Section standardmäßig aufgeklappt zeigen. Der User
  // muss die aktiven Chips sehen bevor er weiter interagiert.
  filtersCollapsed = false;
  renderShell();
  rootEl.hidden = false;
  // Doppel-rAF für Slide-up-Animation (initial translateY(100%) → 0).
  requestAnimationFrame(() => {
    requestAnimationFrame(() => rootEl.querySelector('.picker-overlay').classList.add('is-open'));
  });
  document.addEventListener('keydown', handleEsc);
}

export function closeDishPicker() {
  if (!rootEl || rootEl.hidden) return;
  const overlay = rootEl.querySelector('.picker-overlay');
  if (overlay) overlay.classList.remove('is-open');
  document.removeEventListener('keydown', handleEsc);
  setTimeout(() => {
    if (rootEl && !rootEl.querySelector('.picker-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
      currentDay = null;
    }
  }, TRANSITION_MS);
}

function handleEsc(ev) {
  if (ev.key === 'Escape') closeDishPicker();
}

// Leitet aus den globalen Settings die vor-aktivierten Picker-Filter ab.
// Settings-Chips mappen 1:1 auf die Picker-Chips (Diät + Küche). User kann
// im Picker jederzeit deaktivieren, ohne die globalen Settings zu ändern.
function deriveInitialFilters() {
  const set = new Set();
  const p = state.settings.preferences || {};
  if (p.meat) set.add('meat');
  if (p.fish) set.add('fish');
  if (p.vegetarian) set.add('veg');
  const c = state.settings.cuisines || {};
  if (c.asian)         set.add('asian');
  if (c.mediterranean) set.add('mediterranean');
  if (c.middleEast)    set.add('middleEast');
  if (c.americas)      set.add('americas');
  if ((state.settings.maxCookTime ?? 999) <= 30) set.add('fast');
  return set;
}

function chipHtml(f) {
  return `
    <button class="picker-filter-chip"
            type="button"
            data-filter="${f.key}"
            aria-pressed="${activeFilters.has(f.key)}">
      ${f.label}
    </button>
  `;
}

// Filter-Section-Header ist klickbar und togglet den Collapse-State. Zeigt
// gleichzeitig einen "aktiv/gesamt"-Zähler (positive Framing), damit der User
// im eingeklappten Zustand sieht, wie viele Filter gerade wirken.
//
// FLACHE Struktur: Header und Body als Geschwister direkt im picker-body —
// kein <section>-Wrapper. Nur so bleibt der Header sticky, wenn er weit
// hochgescrollt wird. Ein Wrapper würde den Header mit rausschieben, sobald
// die Section komplett den scroll-Container verlässt (siehe shopping-list.css
// / settings-sheet.css für dieselbe Falle).
function renderFiltersSection() {
  const total = FILTERS.length;
  const active = FILTERS.filter((f) => activeFilters.has(f.key)).length;
  const collapsed = filtersCollapsed;
  const chevron = `<svg class="picker-filters__chevron" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z"/></svg>`;
  // Reset sitzt DIREKT hinter dem "Filter"-Titel (linksbündig). Der ganze
  // Header ist ein <button> für Kollaps — Reset ist deshalb ein <span> mit
  // role="button" (nested <button> in <button> wäre invalides HTML). Klick-
  // Handler stoppt Propagation, sonst würde der Kollaps mit ausgelöst.
  // Sichtbarkeit per hidden-Attribut: nur wenn mind. ein Filter aktiv.
  const resetHidden = active === 0;
  return `
    <button class="picker-filters__header ${collapsed ? 'picker-filters__header--collapsed' : ''}"
            type="button"
            data-action="toggle-filters"
            aria-expanded="${!collapsed}"
            aria-label="Filter">
      <span class="picker-filters__title">Filter</span>
      <span class="picker-filters__reset"
            role="button"
            tabindex="0"
            data-action="reset-filters"
            data-role="filter-reset"
            ${resetHidden ? 'hidden' : ''}
            aria-label="Alle Filter zurücksetzen"
            title="Alle Filter zurücksetzen">
        ${ICON_CLOSE}
      </span>
      <span class="picker-filters__spacer" aria-hidden="true"></span>
      <span class="picker-filters__count" data-role="filter-count">${active}/${total}</span>
      ${chevron}
    </button>
    <div class="picker-filters__body" ${collapsed ? 'hidden' : ''}>
      <div class="picker-filter-row">
        ${FILTERS.filter((f) => f.group === 'diet').map(chipHtml).join('')}
      </div>
      <div class="picker-filter-row picker-filter-row--nowrap">
        ${FILTERS.filter((f) => f.group === 'cuisine').map(chipHtml).join('')}
      </div>
      <div class="picker-filter-row picker-filter-row--nowrap">
        ${FILTERS.filter((f) => f.group === 'macro').map(chipHtml).join('')}
      </div>
      <div class="picker-filter-row">
        ${FILTERS.filter((f) => f.group === 'kcal').map(chipHtml).join('')}
      </div>
      <div class="picker-filter-row">
        ${FILTERS.filter((f) => f.group === 'attr').map(chipHtml).join('')}
      </div>
    </div>
  `;
}

// Ergebnis-Struktur des Pickers:
//   main     — Gerichte die den Filter erfüllen (inkl. aktueller + geplante
//              die passen), sortiert wie unten beschrieben.
//   overflow — geplante Gerichte anderer Tage die den Filter NICHT erfüllen.
//              Kommen unter einem Divider, damit klar wird: "diese sind hier
//              nur wegen der Wochenplanung, würden sonst rausgefiltert".
function filteredDishes() {
  const currentDishId = state.assignment[currentDay];
  const used = usedElsewhereMap();
  const activeDiet    = FILTERS.filter((f) => f.group === 'diet'    && activeFilters.has(f.key));
  const activeCuisine = FILTERS.filter((f) => f.group === 'cuisine' && activeFilters.has(f.key));
  const activeAttr    = FILTERS.filter((f) => f.group === 'attr'    && activeFilters.has(f.key));
  const activeKcal    = FILTERS.filter((f) => f.group === 'kcal'    && activeFilters.has(f.key));
  const activeMacro   = FILTERS.filter((f) => f.group === 'macro'   && activeFilters.has(f.key));

  // Reine Filter-Prüfung ohne "immer zeigen"-Ausnahmen — wird sowohl beim
  // Vorfiltern als auch bei der Divider-Bucket-Zuordnung genutzt.
  const passesFilter = (d) => {
    if (activeFilters.size === 0) return true;
    const dietOk    = activeDiet.length    === 0 || activeDiet.some((f) => f.test(d));
    const cuisineOk = activeCuisine.length === 0 || activeCuisine.some((f) => f.test(d));
    const attrOk    = activeAttr.every((f) => f.test(d));
    const kcalOk    = activeKcal.length    === 0 || activeKcal.some((f) => f.test(d));
    const macroOk   = activeMacro.length   === 0 || activeMacro.some((f) => f.test(d));
    return dietOk && cuisineOk && attrOk && kcalOk && macroOk;
  };

  let result;
  if (activeFilters.size === 0) {
    result = allDishes.slice();
  } else {
    result = allDishes.filter((d) => {
      // Bereits in der Wochenplanung stehende Gerichte (aktueller Tag +
      // andere Tage) immer im Result — auch wenn sie den Filter nicht
      // erfüllen. Die Bucket-Logik unten trennt sie visuell per Divider,
      // damit der User Filter-Treffer und Wochenkontext auseinanderhalten kann.
      if (d.id === currentDishId) return true;
      if (used.has(d.id)) return true;
      return passesFilter(d);
    });
  }

  // Sortierung nach aktiven Filtern (Kette: erste Position gewinnt):
  //   Schnell aktiv       → nach cooktime (aufsteigend)
  //   Wenig Zutaten aktiv → nach offenen Zutaten (aufsteigend)
  //   Kalorienarm aktiv   → nach dish.kcal (aufsteigend, wenigste oben)
  //   Kalorienreich aktiv → nach dish.kcal (absteigend, höchste oben)
  //   Proteinreich aktiv  → nach P% (absteigend, proteinreichste oben)
  //   KH-arm aktiv        → nach KH% (aufsteigend, ärmste oben)
  //   Nichts davon        → natürliche Reihenfolge (nach id)
  // "Wenig Zutaten" sortiert bewusst nach offenen (nicht abgehakten) Zutaten,
  // damit Ranking und die auf jedem Tile sichtbare Pille denselben Wert zeigen.
  // Makro-Sortierung greift nur wenn genau eines der beiden Extrem-Chips
  // aktiv ist — "Ausgewogen" ist selbst schon eine breite Range, da bringt
  // Sortierung keinen sinnvollen Ranking-Wert.
  const sortFast = activeFilters.has('fast');
  const sortSimple = activeFilters.has('simple');
  const kcalLow = activeFilters.has('kcal_low');
  const kcalHigh = activeFilters.has('kcal_high');
  // Beide kcal-Filter aktiv = OR umfasst alle Gerichte → kein wirksamer
  // Filter, also auch keine kcal-Sortierung (fällt auf id zurück).
  const sortKcalLow = kcalLow && !kcalHigh;
  const sortKcalHigh = kcalHigh && !kcalLow;
  const sortProtein = activeFilters.has('macro_protein');
  const sortLowCarb = activeFilters.has('macro_lowcarb');
  const sortLowFat = activeFilters.has('macro_lowfat');
  if (sortFast || sortSimple || sortKcalLow || sortKcalHigh || sortProtein || sortLowCarb || sortLowFat) {
    result.sort((a, b) => {
      if (sortFast) {
        const d = a.cooktime - b.cooktime;
        if (d !== 0) return d;
      }
      if (sortSimple) {
        const d = openIngredientCount(a) - openIngredientCount(b);
        if (d !== 0) return d;
      }
      if (sortKcalLow) {
        const d = a.kcal - b.kcal;
        if (d !== 0) return d;
      }
      if (sortKcalHigh) {
        const d = b.kcal - a.kcal;
        if (d !== 0) return d;
      }
      if (sortProtein) {
        const d = macroPct(b).p - macroPct(a).p;
        if (d !== 0) return d;
      }
      if (sortLowCarb) {
        const d = macroPct(a).kh - macroPct(b).kh;
        if (d !== 0) return d;
      }
      if (sortLowFat) {
        const d = macroPct(a).f - macroPct(b).f;
        if (d !== 0) return d;
      }
      return a.id - b.id;
    });
  }

  // Bucket-Logik nach Shopping-Status:
  //   main (obere Liste):
  //     1. aktuelles Gericht ganz oben (Ausgangspunkt)
  //     2. wählbare Gerichte + geplante Gerichte deren Tag NICHT in der
  //        Einkaufsliste steht und die den Filter erfüllen — alle gemischt
  //        in der Sortier-Reihenfolge (result.sort weiter oben).
  //   overflow (unter Divider "Bereits geplant"):
  //     3. geplante Gerichte deren Tag IN der Einkaufsliste steht — egal ob
  //        der Filter passt oder nicht (die stehen fest im Wochenplan).
  //     4. geplante Gerichte deren Tag NICHT in der Einkaufsliste steht, aber
  //        den Filter nicht erfüllen (wären sonst nicht sichtbar).
  const current = [];
  const selectable = [];
  const overflow = [];
  for (const d of result) {
    if (d.id === currentDishId) {
      current.push(d);
      continue;
    }
    if (used.has(d.id)) {
      const plannedDay = used.get(d.id);
      const lockedByShopping = state.selected[plannedDay] === true;
      if (lockedByShopping) {
        overflow.push(d);
      } else if (passesFilter(d)) {
        selectable.push(d);
      } else {
        overflow.push(d);
      }
    } else {
      selectable.push(d);
    }
  }
  const byWeekday = (a, b) => DAYS.indexOf(used.get(a.id)) - DAYS.indexOf(used.get(b.id));
  overflow.sort(byWeekday);
  return {
    main: [...current, ...selectable],
    overflow,
  };
}

// Map dishId → Wochentag (nicht der currentDay), an dem dieses Gericht bereits
// geplant ist. Für diese Tiles zeigen wir das disabled-Layout + einen Tag-Badge
// oben links. Bei mehreren Vorkommen gewinnt der zuerst gefundene Tag (DAYS-
// Reihenfolge = Mo..So).
function usedElsewhereMap() {
  const map = new Map();
  for (const day of DAYS) {
    if (day === currentDay) continue;
    const id = state.assignment[day];
    if (id != null && !map.has(id)) map.set(id, day);
  }
  return map;
}

function renderShell() {
  const currentDishId = state.assignment[currentDay];
  const { main, overflow } = filteredDishes();
  const used = usedElsewhereMap();
  const wasOpen = !rootEl.hidden;

  rootEl.innerHTML = `
    <div class="picker-overlay ${wasOpen ? 'is-open' : ''}" data-role="backdrop">
      <div class="picker-sheet" role="dialog" aria-modal="true" aria-labelledby="picker-title">
        <div class="picker-handle" aria-hidden="true"></div>
        <div class="picker-body">
          <div class="picker-header">
            <h2 class="picker-title" id="picker-title">${currentDay} — Gericht wählen</h2>
            <button class="picker-close" data-action="close" aria-label="Schließen">✕</button>
          </div>
          ${renderFiltersSection()}
          ${renderResults(main, overflow, currentDishId, used)}
        </div>
      </div>
    </div>
  `;

  attachHandlers();
  // Font-Fitter läuft nach Layout (rAF), damit scrollWidth/clientWidth bereits
  // korrekt sind. Betrifft die nowrap-Küchen-Zeile — die bestimmt die minimale
  // Schriftgröße für alle Filter-Chips.
  requestAnimationFrame(fitFilterFontSize);
}

// Rendert den Ergebnis-Bereich: Wrapper .picker-grids analog zum Filter-
// Container (sticky Header + Body), umfasst Haupt-Grid, optional Divider und
// Overflow-Grid. Header ist NICHT klickbar/kollapsbar — er markiert nur den
// Container visuell.
// Empty-Message erscheint wenn main leer ist — der Divider samt overflow wird
// trotzdem angezeigt (mit "Bereits geplant" wird klar, warum die Tiles trotz
// Filter-Empty da sind).
function renderResults(main, overflow, currentDishId, used) {
  const mainHtml = main.length > 0
    ? `<div class="picker-grid">${main.map((d) => renderTile(d, d.id === currentDishId, used)).join('')}</div>`
    : '<p class="picker-empty">Keine Gerichte für diese Filter.</p>';
  const overflowHtml = overflow.length > 0
    ? `
      <div class="picker-divider" role="separator" aria-label="Bereits geplant">
        <span class="picker-divider__label">Bereits geplant</span>
      </div>
      <div class="picker-grid picker-grid--overflow">${overflow.map((d) => renderTile(d, false, used)).join('')}</div>
    `
    : '';
  // Counter zeigt "verfügbar / gesamt" — positive Framing analog Filter-Counter.
  // "verfügbar" = alle Gerichte im main-Bereich (wählbar, inkl. aktuelles).
  // Chevron ist rein visuell (Layout-Konsistenz zum Filter-Header) — kein
  // Klick-Handler, kein Kollaps.
  const availableCount = main.length;
  const totalCount = allDishes.length;
  const chevron = `<svg class="picker-grids__chevron" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z"/></svg>`;
  return `
    <div class="picker-grids">
      <button class="picker-grids__header"
              type="button"
              data-action="scroll-grids-top"
              aria-label="Zum Anfang der Gerichte scrollen">
        <span class="picker-grids__title">Gerichte</span>
        <span class="picker-grids__count">${availableCount}/${totalCount}</span>
        ${chevron}
      </button>
      <div class="picker-grids__body">
        ${mainHtml}${overflowHtml}
      </div>
    </div>
  `;
}

// Verkleinert die Chip-Schrift schrittweise (14 → 10 px in 0.5-Schritten) bis
// ALLE nowrap-Rows in ihre Container-Breite passen. Der ermittelte Wert wird
// per CSS-Variable auf rootEl gesetzt und greift für alle Filter-Chips — so
// bleibt die Optik zwischen den Zeilen konsistent (kleinster Fit gewinnt).
function fitFilterFontSize() {
  if (!rootEl) return;
  const rows = rootEl.querySelectorAll('.picker-filter-row--nowrap');
  if (rows.length === 0) return;
  const maxPx = 14;
  const minPx = 10;
  let size = maxPx;
  rootEl.style.setProperty('--picker-chip-font', `${size}px`);
  const overflows = () => Array.from(rows).some((r) => r.scrollWidth > r.clientWidth + 1);
  let guard = 20;
  while (overflows() && size > minPx && guard-- > 0) {
    size -= 0.5;
    rootEl.style.setProperty('--picker-chip-font', `${size}px`);
  }
}

function renderTile(dish, isCurrent, usedMap) {
  // isCurrent (dieses Gericht ist an currentDay zugewiesen) sticht disabled —
  // das Tile für den eigenen Tag soll nie ausgegraut sein, auch wenn dasselbe
  // Gericht an einem anderen Tag ebenfalls geplant ist.
  //
  // Disabled-Status greift NUR wenn der andere Tag auch in der Einkaufsliste
  // steht (state.selected[otherDay]). Ist der andere Tag zwar geplant aber
  // nicht auf der Liste, bleibt das Tile wählbar — der Weekday-Badge markiert
  // die Wochenplanung weiterhin, damit der User die Doppelbelegung sieht.
  const otherDay = isCurrent ? null : (usedMap.get(dish.id) ?? null);
  const otherDayLocked = !!otherDay && state.selected[otherDay] === true;
  const isDisabled = otherDayLocked;
  const displayDay = isCurrent ? currentDay : otherDay;
  const cls = ['picker-tile'];
  if (isCurrent) cls.push('picker-tile--current');
  if (isDisabled) cls.push('picker-tile--disabled');
  const disabledAttr = isDisabled ? 'aria-disabled="true" tabindex="-1"' : '';
  // Aktueller Tag: Badge im Aktiv-Look (primary bg, weiße Schrift — analog
  // zur kcal-Pille auf der Card). Fremder Tag: Frosted-Glass Badge (primary
  // Schrift auf weißem semi-transparent bg).
  const badgeCls = 'picker-tile__day-badge' + (isCurrent ? ' picker-tile__day-badge--active' : '');
  const dayBadge = displayDay
    ? `<span class="${badgeCls}">${displayDay}</span>`
    : '';
  // Anzahl noch nicht abgehakter Zutaten dieses Gerichts — identische Semantik
  // wie beim Card-Badge im Dashboard ("so viele Zutaten stehen noch offen").
  const openCount = openIngredientCount(dish);
  // Shop-Pille im Aktiv-Look nur wenn das Gericht bereits im Einkaufskorb liegt
  // (mind. ein selected-Tag mit diesem Gericht). Wenn das aktuelle Gericht des
  // currentDay nicht im Korb ist, bleibt seine Pille neutral.
  const isInCart = isDishInCart(dish.id);
  const shopCls = 'picker-tile__shop' + (isInCart ? ' picker-tile__shop--active' : '');
  const shopPill = openCount > 0
    ? `<span class="${shopCls}" aria-label="${openCount} offene Zutaten">
         ${ICON_SHOPPING}
         <span class="picker-tile__shop-count">${openCount}</span>
       </span>`
    : '';
  return `
    <button class="${cls.join(' ')}"
            type="button"
            data-dish-id="${dish.id}"
            aria-label="${dish.name} auswählen${otherDay ? ` — bereits am ${otherDay} geplant` : ''}"
            aria-current="${isCurrent ? 'true' : 'false'}"
            ${disabledAttr}>
      <div class="picker-tile__image-wrap">
        ${dayBadge}
        ${shopPill}
        <img class="picker-tile__img" src="/dishes/dish-${dish.id}.jpg" alt="" loading="lazy" />
      </div>
      <div class="picker-tile__body">
        <div class="picker-tile__title">${dish.name}</div>
        <div class="picker-tile__meta">~${dish.cooktime} Min · ${dish.kcal} kcal</div>
      </div>
    </button>
  `;
}

function attachHandlers() {
  const overlay = rootEl.querySelector('[data-role="backdrop"]');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) closeDishPicker();
  });
  rootEl.querySelector('[data-action="close"]').addEventListener('click', closeDishPicker);

  // Filter-Chip Klick: toggle Filter + Grid neu bauen. Wir ersetzen NUR body-
  // Inneres, nicht das ganze Sheet — spart Reflow und lässt Scroll-Position stehen.
  rootEl.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const key = btn.dataset.filter;
      if (activeFilters.has(key)) activeFilters.delete(key);
      else activeFilters.add(key);
      updateFilters();
      updateGrid();
    });
  });

  // Tile-Klick: aria-disabled Tiles ignorieren (bereits an anderem Tag geplant).
  rootEl.querySelectorAll('[data-dish-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-disabled') === 'true') return;
      const id = parseInt(btn.dataset.dishId, 10);
      onExternalPick(currentDay, id);
      closeDishPicker();
    });
  });

  // Reset-Button im Filter-Header: leert alle aktiven Filter komplett (nicht
  // zurück auf Settings-Defaults — der User soll durch "Reset" wirklich alles
  // sehen, für die Settings-Defaults kann er den Picker neu öffnen).
  const resetBtn = rootEl.querySelector('[data-action="reset-filters"]');
  if (resetBtn) {
    resetBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (activeFilters.size === 0) return;
      activeFilters.clear();
      updateFilters();
      updateGrid();
    });
  }

  // Filter-Section-Header: togglet Collapse. Body wird hidden gesetzt, Modifier-
  // Klasse steuert Rotation des Chevrons + kompaktere Sticky-Höhe.
  const toggleBtn = rootEl.querySelector('[data-action="toggle-filters"]');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const bodyEl = rootEl.querySelector('.picker-filters__body');
      const scrollRoot = rootEl.querySelector('.picker-body');
      const sticky = isFilterHeaderSticky(toggleBtn, scrollRoot);
      const bodyVisible = bodyEl && !bodyEl.hidden && isFilterBodyVisibleBelow(bodyEl, toggleBtn);

      // Sticky UND unsichtbar → expand + scroll (analog Einstellungen: statt
      // "aus dem Nichts einzuklappen" springen wir zur Section).
      if (sticky && !bodyVisible) {
        filtersCollapsed = false;
        toggleBtn.classList.remove('picker-filters__header--collapsed');
        toggleBtn.setAttribute('aria-expanded', 'true');
        if (bodyEl) bodyEl.hidden = false;
        requestAnimationFrame(() => {
          if (bodyEl) bodyEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        return;
      }

      // Normal togglen. Beim Einklappen scrollTop-Kompensation um den bereits
      // oben rausgescrollten Anteil des Bodys — Sicht bleibt stabil.
      let compensation = 0;
      if (!filtersCollapsed && bodyEl && scrollRoot) {
        const bodyRect = bodyEl.getBoundingClientRect();
        const bodySpace = bodyRect.height + (parseFloat(getComputedStyle(bodyEl).marginBottom) || 0);
        const rootTop = scrollRoot.getBoundingClientRect().top;
        const scrolledPast = rootTop - bodyRect.top;
        compensation = Math.max(0, Math.min(scrolledPast, bodySpace));
      }
      filtersCollapsed = !filtersCollapsed;
      toggleBtn.classList.toggle('picker-filters__header--collapsed', filtersCollapsed);
      toggleBtn.setAttribute('aria-expanded', String(!filtersCollapsed));
      if (bodyEl) bodyEl.hidden = filtersCollapsed;
      if (compensation > 0 && scrollRoot) {
        scrollRoot.scrollTop = Math.max(0, scrollRoot.scrollTop - compensation);
      }
    });
  }

  // Gerichte-Header ist klickbar — scrollt zum Anfang der grids-Liste
  // (analog Einstellungen: springen statt vom Nichts scrollen). scrollIntoView
  // nutzt scroll-margin-top aus dem CSS, damit das Ziel unter den gestapelten
  // sticky Headern landet, nicht dahinter.
  const gridsHeader = rootEl.querySelector('[data-action="scroll-grids-top"]');
  if (gridsHeader) {
    gridsHeader.addEventListener('click', () => {
      const gridsBody = rootEl.querySelector('.picker-grids__body');
      if (gridsBody) gridsBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Scroll-Listener für Compact-Filter-Row: schaltet .picker-body--scrolled
  // beim Erreichen des Thresholds. Position: sticky auf .picker-filters hält
  // sie sichtbar; in Compact-Modus schrumpfen padding + Pills.
  const body = rootEl.querySelector('.picker-body');
  body.addEventListener('scroll', () => {
    body.classList.toggle('picker-body--scrolled', body.scrollTop > SCROLL_COMPACT_THRESHOLD);
  }, { passive: true });

  attachCloseSwipe();
}

// Runter-Swipe auf Handle oder Header schließt das Picker-Sheet — identisches
// Pattern wie in Detail-/Settings-Sheet. Body (scrollbar) und interaktive
// Elemente sind ausgenommen, damit Klicks/Scroll dort nicht als Swipe zählen.
function attachCloseSwipe() {
  const sheet = rootEl.querySelector('.picker-sheet');
  if (!sheet) return;
  const s = { startX: 0, startY: 0, tracking: false };

  sheet.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (ev.target.closest('button, .picker-filter-chip')) return;
    // Body-Inhalt (scrollbar) ist ausgenommen — aber .picker-header darin ist
    // erlaubt, weil er als sticky Titel-Zeile die klassische Drag-Handle-Funktion
    // mit übernimmt (analog Detail-/Settings-Sheet).
    if (ev.target.closest('.picker-body') && !ev.target.closest('.picker-header')) return;
    s.startX = ev.clientX;
    s.startY = ev.clientY;
    s.tracking = true;
    try { sheet.setPointerCapture(ev.pointerId); } catch (_) {}
  });

  sheet.addEventListener('pointerup', (ev) => {
    if (!s.tracking) return;
    s.tracking = false;
    try { sheet.releasePointerCapture(ev.pointerId); } catch (_) {}
    const dx = ev.clientX - s.startX;
    const dy = ev.clientY - s.startY;
    if (dy <= SWIPE_THRESHOLD_PX) return;
    if (dy <= Math.abs(dx) * SWIPE_DIRECTIONAL_RATIO) return;
    closeDishPicker();
  });

  sheet.addEventListener('pointercancel', () => { s.tracking = false; });
}

function updateFilters() {
  rootEl.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.setAttribute('aria-pressed', activeFilters.has(btn.dataset.filter) ? 'true' : 'false');
  });
  // Counter im Header aktualisieren — total ist konstant, active ändert sich
  // mit jedem Chip-Klick. Nur textContent, kein Re-Render der Section.
  const active = FILTERS.filter((f) => activeFilters.has(f.key)).length;
  const countEl = rootEl.querySelector('[data-role="filter-count"]');
  if (countEl) {
    countEl.textContent = `${active}/${FILTERS.length}`;
  }
  // Reset-Button ein-/ausblenden — nur sichtbar wenn mindestens ein Filter
  // aktiv ist. hidden-Attribut statt Remove, damit der Handler bestehen bleibt.
  const resetBtn = rootEl.querySelector('[data-role="filter-reset"]');
  if (resetBtn) {
    resetBtn.hidden = active === 0;
  }
}

function updateGrid() {
  const currentDishId = state.assignment[currentDay];
  const { main, overflow } = filteredDishes();
  const used = usedElsewhereMap();
  const body = rootEl.querySelector('.picker-body');
  // Kompletten Grids-Container wegräumen — Filter-Header/Body bleiben.
  const oldGrids = body.querySelector('.picker-grids');
  if (oldGrids) oldGrids.remove();

  body.insertAdjacentHTML('beforeend', renderResults(main, overflow, currentDishId, used));
  // Handler für alle neuen Tiles binden (main + overflow).
  body.querySelectorAll('[data-dish-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-disabled') === 'true') return;
      const id = parseInt(btn.dataset.dishId, 10);
      onExternalPick(currentDay, id);
      closeDishPicker();
    });
  });

  // Nach Filter-Wechsel: Scroll auf 0 zurück und Compact-Klasse entfernen,
  // damit die Filter-Row zurück in den Expanded-State geht. Ohne das würde
  // ein Filter-Klick nach einem Runter-Scroll die kompakte Filter-Row
  // beibehalten (visuelle Inkonsistenz gegenüber dem frischen Sheet-Open).
  body.scrollTop = 0;
  body.classList.remove('picker-body--scrolled');
}

// Ist der Filter-Toggle-Header aktuell im Sticky-Modus (top: 0 im scrollRoot)?
// Analog isHeaderSticky in settings/render.js — hier gibts nur einen Header,
// also kein stack-idx, sticky-Top ist immer 0.
function isFilterHeaderSticky(btn, scrollRoot) {
  if (!scrollRoot) return false;
  const relTop = btn.getBoundingClientRect().top - scrollRoot.getBoundingClientRect().top;
  return relTop <= 2;
}

// Ist der Filter-Body noch (mind. teilweise) unter dem Header sichtbar?
function isFilterBodyVisibleBelow(body, btn) {
  const bodyRect = body.getBoundingClientRect();
  if (bodyRect.height === 0) return false;
  const btnRect = btn.getBoundingClientRect();
  return bodyRect.bottom > btnRect.bottom + 2;
}
