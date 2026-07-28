// Body-Renderer fuer Sheet-Mode 'picker'. Filter-Section (Chips + Reset +
// Kollaps) + Ergebnis-Grid mit Bucket-Logik (main / overflow "Bereits geplant").
// Filter-State (activeFilters + filtersCollapsed) ist modul-lokal — ueberlebt
// Mode-Wechsel innerhalb einer Sheet-Session, wird beim Sheet-Close aber NICHT
// automatisch resettet (Muster analog Settings-Sheet).

import { state, DAYS, isFavorite, toggleFavorite, saveState } from '../state.js';
import { getEffectivePreferences, getEffectiveCuisines, dishCuisineVoteCount, isFavoriteAnyDiner, favoriteLikesCount } from '../nutrition/preferences.js';
import { getScaleForDish } from '../nutrition/scale.js';
import { allDishes, dishesById, isNewDish } from '../data/dishes.js';
import { resolveDishImage, bindDishImage } from '../data/dish-image.js';

// Material Symbol shopping_bag — Shop-Pille auf Tiles + Fav-Icon fuer
// Favoriten-Filter-Chip. Fuer Fav gibts Fill+Outline.
const ICON_SHOPPING = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm0-80h480v-480h-80v80q0 17-11.5 28.5T600-520q-17 0-28.5-11.5T560-560v-80H400v80q0 17-11.5 28.5T360-520q-17 0-28.5-11.5T320-560v-80h-80v480Zm160-560h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-720Z"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M256-200l-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>`;
const ICON_FAV_OUTLINE = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m480-121-41-37q-105.77-97.12-174.88-167.56Q195-396 154-451.5T96.5-552Q80-597 80-643q0-90.15 60.5-150.58Q201-854 290-854q57 0 105.5 27t84.5 78q42-54 89-79.5T670-854q89 0 149.5 60.42Q880-733.15 880-643q0 46-16.5 91T806-451.5Q765-396 695.88-325.56 626.77-255.12 521-158l-41 37Zm0-79q101.24-93.15 166.62-159.58Q712-426 750.5-476t54-89.13q15.5-39.13 15.5-77.87 0-65-42.5-107.5T670-793q-51.63 0-95.31 31.5Q531-730 504-660h-49q-26-69-70-101t-95-32q-65 0-107.5 42.5T140-643q0 38.74 15.5 77.87Q171-526 209.5-476t104 116.42Q378.87-293.15 480-200Zm0-296Z"/></svg>`;
const ICON_FAV_FILL    = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m480-121-41-37q-105.77-97.12-174.88-167.56Q195-396 154-451.5T96.5-552Q80-597 80-643q0-90.15 60.5-150.58Q201-854 290-854q52 0 98.5 22t81.5 62q35-40 81.5-62t98.5-22q89 0 149.5 60.42Q880-733.15 880-643q0 46-16.5 91T806-451.5Q765-396 695.88-325.56 626.77-255.12 521-158l-41 37Z"/></svg>`;
const ICON_NEW_STAR = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>`;

// Filter-Definitionen — Semantik siehe alter dish-picker/render.js.
// Diet (OR), Cuisine (OR), Attr (AND), Kcal (OR), Macro (OR). Gesamt-Test:
// dietOk && cuisineOk && attrOk && kcalOk && macroOk.
const FILTERS = [
  { key: 'meat',   label: 'Fleisch',       group: 'diet',    test: (d) => d.tags.includes('contains-meat') },
  { key: 'fish',   label: 'Fisch',         group: 'diet',    test: (d) => d.tags.includes('contains-fish') },
  { key: 'veg',    label: 'Vegetarisch',   group: 'diet',    test: (d) => !d.tags.includes('contains-meat') && !d.tags.includes('contains-fish') },
  { key: 'asian',         label: 'Asiatisch',   group: 'cuisine', test: (d) => d.cuisineGroup === 'asian' },
  { key: 'mediterranean', label: 'Mediterran',  group: 'cuisine', test: (d) => d.cuisineGroup === 'mediterranean' },
  { key: 'middleEast',    label: 'Nahost',      group: 'cuisine', test: (d) => d.cuisineGroup === 'middleEast' },
  { key: 'americas',      label: 'Amerikanisch', group: 'cuisine', test: (d) => d.cuisineGroup === 'americas' },
  { key: 'fast',      label: 'Schnell',       group: 'attr', test: (d) => d.cooktime <= 30 },
  { key: 'simple',    label: 'Wenig Zutaten', group: 'attr', test: (d) => openIngredientCount(d) <= 8 },
  { key: 'favorite',  label: 'Favoriten',     group: 'attr', icon: ICON_FAV_FILL, test: (d) => isFavoriteAnyDiner(d.id) },
  { key: 'is-new',    label: 'Neu importiert', group: 'attr', icon: ICON_NEW_STAR, test: (d) => isNewDish(d.id) },
  { key: 'kcal_low',  label: 'Kalorienarm',   group: 'kcal', test: (d) => d.kcal < KCAL_MEDIAN },
  { key: 'kcal_high', label: 'Kalorienreich', group: 'kcal', test: (d) => d.kcal > KCAL_MEDIAN },
  { key: 'macro_protein', label: 'Proteinreich',    group: 'macro', test: (d) => macroPct(d).p > 35 },
  { key: 'macro_lowcarb', label: 'Kohlenhydratarm', group: 'macro', test: (d) => macroPct(d).kh < 30 },
  { key: 'macro_lowfat',  label: 'Fettarm',         group: 'macro', test: (d) => macroPct(d).f < 25 },
  { key: 'macro_balanced', label: 'Ausgewogen',  group: 'macro', test: (d) => {
    const m = macroPct(d);
    return m.p >= 22 && m.p <= 42 && m.kh >= 22 && m.kh <= 42 && m.f >= 22 && m.f <= 42;
  } },
];

const KCAL_MEDIAN = 950;
const SCROLL_COMPACT_THRESHOLD = 8;
const FLIP_DURATION_MS = 380;
const FLIP_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

// Modul-lokaler Ref auf aktuellen Body-Container + API. Wird bei attach() /
// detach() bzw. beim ersten Rendern gesetzt.
let bodyEl = null;
let currentApi = null;
let currentDay = null;

// Filter-State ueberlebt Body-Detach (bewusst: der User kann Detail-Mode
// wechseln und im Picker-Mode zurueckkommen, sein Filter-Setup soll bleiben).
// Erst bei Sheet-Open sollte deriveInitialFilters neu triggern — wir tun das
// beim ersten render() pro currentDay-Session.
let activeFilters = new Set();
let filtersCollapsed = true;
let filtersInitialized = false;

function macroPct(dish) {
  const macroKcal = dish.p * 4 + dish.kh * 4 + dish.f * 9;
  if (macroKcal === 0) return { p: 0, kh: 0, f: 0 };
  return {
    p: (dish.p * 4) / macroKcal * 100,
    kh: (dish.kh * 4) / macroKcal * 100,
    f: (dish.f * 9) / macroKcal * 100,
  };
}

function openIngredientCount(dish) {
  return dish.ingredients.filter((i) => !state.checkedShopping.has(i.key)).length;
}

function isDishInCart(dishId) {
  for (const day of DAYS) {
    if (state.assignment[day] === dishId && state.selected[day]) return true;
  }
  return false;
}

// Diaet-Prefs aus Multi-User-Konsens, Kuechen aus globalen Settings. User
// kann jederzeit uebersteuern.
function deriveInitialFilters() {
  const set = new Set();
  const p = getEffectivePreferences();
  if (p.meat) set.add('meat');
  if (p.fish) set.add('fish');
  if (p.vegetarian) set.add('veg');
  const c = getEffectiveCuisines();
  if (c.asian)         set.add('asian');
  if (c.mediterranean) set.add('mediterranean');
  if (c.middleEast)    set.add('middleEast');
  if (c.americas)      set.add('americas');
  if ((state.settings.maxCookTime ?? 999) <= 30) set.add('fast');
  return set;
}

// Reset-Hook fuer Sheet-Open — wird von render.js beim ersten Betreten des
// Picker-Modus in einer Session gerufen (dazu: BODIES.picker.resetForSession).
// Aktuell rufen wir es intern beim ersten render() pro currentDay-Wechsel.
function ensureFiltersInitialized() {
  if (filtersInitialized) return;
  activeFilters = deriveInitialFilters();
  filtersCollapsed = true;
  filtersInitialized = true;
}

// --- Contract ---

export const pickerBody = {
  render(session) {
    // Neue Session (anderer Day) → Filter zuruecksetzen. Innerhalb derselben
    // Session (Mode-Switch) bleiben Filter stehen.
    if (currentDay !== session.day) {
      filtersInitialized = false;
      currentDay = session.day;
    }
    ensureFiltersInitialized();
    const currentDishId = state.assignment[session.day];
    const { main, overflow } = filteredDishes(session);
    const used = usedElsewhereMap(session);
    return `
      <div class="picker-body">
        ${renderFiltersSection()}
        ${renderResults(main, overflow, currentDishId, used)}
      </div>
    `;
  },

  attach(rootEl, session, api) {
    bodyEl = rootEl;
    currentApi = api;
    attachHandlers(session);
    requestAnimationFrame(fitFilterFontSize);
  },

  detach() {
    bodyEl = null;
    currentApi = null;
    // currentDay + Filter-State bleiben — Filter-Persistence ist gewollt.
  },

  onPortionChange() {
    // Portions-Wechsel im Hero hat keine Auswirkung auf das Grid — Tiles
    // zeigen Rezept-basierte Werte (kcal pro Person via getScaleForDish).
  },

  onDishChange(session) {
    // Reroll / Day-Swipe / Fav / List — Grid muss neu (Ranking, current-
    // Marker, Shop-Pille, Fav-Badge aendern sich).
    if (!bodyEl) return;
    if (currentDay !== session.day) {
      // Day-Swipe: neue Filter-Init (Prefs koennten fuer den neuen Tag anders
      // gemeint sein — aktuell nicht, aber semantisch sauber).
      filtersInitialized = false;
      currentDay = session.day;
      ensureFiltersInitialized();
    }
    updateGrid();
  },
};

// --- Filter-Section ---

function chipHtml(f) {
  if (f.icon) {
    return `
      <button class="picker-filter-chip picker-filter-chip--icon"
              type="button"
              data-filter="${f.key}"
              aria-pressed="${activeFilters.has(f.key)}"
              aria-label="${f.label}"
              title="${f.label}">
        ${f.icon}
      </button>
    `;
  }
  return `
    <button class="picker-filter-chip"
            type="button"
            data-filter="${f.key}"
            aria-pressed="${activeFilters.has(f.key)}">
      ${f.label}
    </button>
  `;
}

function renderFiltersSection() {
  const total = FILTERS.length;
  const active = FILTERS.filter((f) => activeFilters.has(f.key)).length;
  const collapsed = filtersCollapsed;
  const chevron = `<svg class="picker-filters__chevron" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z"/></svg>`;
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

// --- Grid ---

// Ergebnis-Struktur: main (Filter-passend + Wochenkontext), overflow (bereits
// geplante Tage die filter-fremd oder Shopping-locked sind). Details siehe
// alter dish-picker/render.js.
function filteredDishes(session) {
  const currentDishId = state.assignment[session.day];
  const used = usedElsewhereMap(session);
  const activeDiet    = FILTERS.filter((f) => f.group === 'diet'    && activeFilters.has(f.key));
  const activeCuisine = FILTERS.filter((f) => f.group === 'cuisine' && activeFilters.has(f.key));
  const activeAttr    = FILTERS.filter((f) => f.group === 'attr'    && activeFilters.has(f.key));
  const activeKcal    = FILTERS.filter((f) => f.group === 'kcal'    && activeFilters.has(f.key));
  const activeMacro   = FILTERS.filter((f) => f.group === 'macro'   && activeFilters.has(f.key));

  // Diaet-Filter: konsistent zum Dashboard-Reroll AND-Exclude-Semantik.
  // Wenn min. ein Diaet-Chip aktiv ist, gelten die inaktiven als HARTE
  // Ausschluesse. Beispiel: Fleisch + Vegetarisch aktiv, Fisch inaktiv →
  // Rezepte mit contains-fish werden gefiltert, auch wenn sie zusaetzlich
  // contains-meat tragen (Paella mit Huhn + Garnelen). Keine Diaet-Chip
  // aktiv → neutral, jedes Rezept passiert.
  const activeDietKeys = new Set(activeDiet.map((f) => f.key));
  const passesDiet = (d) => {
    if (activeDietKeys.size === 0) return true;
    const isMeat = d.tags.includes('contains-meat');
    const isFish = d.tags.includes('contains-fish');
    const isVeg  = !isMeat && !isFish;
    if (!activeDietKeys.has('meat') && isMeat) return false;
    if (!activeDietKeys.has('fish') && isFish) return false;
    if (!activeDietKeys.has('veg')  && isVeg)  return false;
    return true;
  };

  const passesFilter = (d) => {
    if (activeFilters.size === 0) return true;
    const dietOk    = passesDiet(d);
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
      if (d.id === currentDishId) return true;
      if (used.has(d.id)) return true;
      return passesFilter(d);
    });
  }

  const sortFast = activeFilters.has('fast');
  const sortSimple = activeFilters.has('simple');
  const kcalLow = activeFilters.has('kcal_low');
  const kcalHigh = activeFilters.has('kcal_high');
  const sortKcalLow = kcalLow && !kcalHigh;
  const sortKcalHigh = kcalHigh && !kcalLow;
  const sortProtein = activeFilters.has('macro_protein');
  const sortLowCarb = activeFilters.has('macro_lowcarb');
  const sortLowFat = activeFilters.has('macro_lowfat');
  const anySort = sortFast || sortSimple || sortKcalLow || sortKcalHigh || sortProtein || sortLowCarb || sortLowFat;
  if (anySort) {
    result.sort((a, b) => {
      const favA = favoriteLikesCount(a.id);
      const favB = favoriteLikesCount(b.id);
      if (favA !== favB) return favB - favA;
      const voteA = dishCuisineVoteCount(a);
      const voteB = dishCuisineVoteCount(b);
      if (voteA !== voteB) return voteB - voteA;
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
  } else {
    result.sort((a, b) => {
      const favA = favoriteLikesCount(a.id);
      const favB = favoriteLikesCount(b.id);
      if (favA !== favB) return favB - favA;
      const voteA = dishCuisineVoteCount(a);
      const voteB = dishCuisineVoteCount(b);
      if (voteA !== voteB) return voteB - voteA;
      return a.id - b.id;
    });
  }

  const selectable = [];
  const overflow = [];
  for (const d of result) {
    const isCurrent = d.id === currentDishId;
    const isUsed = used.has(d.id);
    if (isCurrent) {
      // Aktueller Tag landet immer in "Bereits geplant" (ausgegraut) — er
      // ist der Slot in den man gerade pickt, kein sinnvolles Ziel.
      overflow.push(d);
    } else if (isUsed) {
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
  const dayForOverflow = (id) => id === currentDishId ? session.day : used.get(id);
  const byWeekday = (a, b) => DAYS.indexOf(dayForOverflow(a.id)) - DAYS.indexOf(dayForOverflow(b.id));
  overflow.sort(byWeekday);
  return { main: selectable, overflow };
}

function usedElsewhereMap(session) {
  const map = new Map();
  for (const day of DAYS) {
    if (day === session.day) continue;
    const id = state.assignment[day];
    if (id != null && !map.has(id)) map.set(id, day);
  }
  return map;
}

function renderResults(main, overflow, currentDishId, used) {
  const favActive = activeFilters.has('favorite');
  const diners = state.settings.profiles.slice(0, state.settings.defaultPortions || 1);
  const anyFav = diners.some((p) => Object.keys(p.favorites || {}).length > 0);
  const newActive = activeFilters.has('is-new');
  const hasNew = state.remoteNewIds.size > 0;
  let emptyMsg;
  if (favActive && !anyFav) {
    emptyMsg = `<p class="picker-empty">Noch keine Favoriten — Nimm dir ein Herz ${ICON_FAV_FILL}</p>`;
  } else if (newActive && !hasNew) {
    emptyMsg = `<p class="picker-empty">Keine neuen Rezepte ${ICON_NEW_STAR}</p>`;
  } else {
    emptyMsg = '<p class="picker-empty">Keine Gerichte für diese Filter.</p>';
  }
  const mainHtml = main.length > 0
    ? `<div class="picker-grid">${main.map((d) => renderTile(d, d.id === currentDishId, used)).join('')}</div>`
    : emptyMsg;
  const overflowHtml = overflow.length > 0
    ? `
      <div class="picker-divider" role="separator" aria-label="Bereits geplant">
        <span class="picker-divider__label">Bereits geplant</span>
      </div>
      <div class="picker-grid picker-grid--overflow">${overflow.map((d) => renderTile(d, d.id === currentDishId, used)).join('')}</div>
    `
    : '';
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

function renderTile(dish, isCurrent, usedMap) {
  const otherDay = isCurrent ? null : (usedMap.get(dish.id) ?? null);
  const otherDayLocked = !!otherDay && state.selected[otherDay] === true;
  // isCurrent = das aktuell fuer session.day zugewiesene Gericht. Wird wie
  // die anderen bereits-geplanten Tiles ausgegraut behandelt.
  const isDisabled = otherDayLocked || isCurrent;
  const displayDay = isCurrent ? currentDay : otherDay;
  const cls = ['picker-tile'];
  if (isDisabled) cls.push('picker-tile--disabled');
  const disabledAttr = isDisabled ? 'aria-disabled="true" tabindex="-1"' : '';
  const dayBadge = displayDay
    ? `<span class="picker-tile__day-badge picker-tile__day-badge--active">${displayDay}</span>`
    : '';
  const newBadge = isNewDish(dish.id)
    ? `<span class="picker-tile__new" aria-label="Neu importiert" title="Neu importiert">${ICON_NEW_STAR}</span>`
    : '';
  const openCount = openIngredientCount(dish);
  const isInCart = isDishInCart(dish.id);
  const shopCls = 'picker-tile__shop' + (isInCart ? ' picker-tile__shop--active' : '');
  // Pill zeigen wenn Gericht im Cart ist (auch bei 0 offenen Zutaten — Signal
  // "alle Zutaten schon gekauft") oder wenn außerhalb des Carts noch Zutaten
  // fehlen (unveraendertes Verhalten). Reihenfolge: Zahl vor Icon.
  const shopPill = (isInCart || openCount > 0)
    ? `<span class="${shopCls}" aria-label="${openCount === 0 ? 'Alle Zutaten gekauft' : `${openCount} offene Zutaten`}">
         <span class="picker-tile__shop-count">${openCount}</span>
         ${ICON_SHOPPING}
       </span>`
    : '';
  const favOn = isFavorite(dish.id);
  const favCls = 'picker-tile__fav' + (favOn ? ' picker-tile__fav--active' : '');
  const favBadge = `
    <span class="${favCls}"
          role="button"
          tabindex="0"
          data-action="toggle-fav"
          data-dish-id="${dish.id}"
          aria-pressed="${favOn}"
          aria-label="${favOn ? 'Favorit entfernen' : 'Als Favorit markieren'}"
          title="${favOn ? 'Favorit entfernen' : 'Als Favorit markieren'}">
      ${favOn ? ICON_FAV_FILL : ICON_FAV_OUTLINE}
    </span>
  `;
  return `
    <button class="${cls.join(' ')}"
            type="button"
            data-dish-id="${dish.id}"
            aria-label="${dish.name} auswählen${otherDay ? ` — bereits am ${otherDay} geplant` : ''}"
            aria-current="${isCurrent ? 'true' : 'false'}"
            ${disabledAttr}>
      <div class="picker-tile__image-wrap">
        ${newBadge}
        ${dayBadge}
        ${favBadge}
        ${shopPill}
        <img class="picker-tile__img" src="${resolveDishImage(dish.id)}" alt="" loading="lazy" data-dish-image-id="${dish.id}" />
      </div>
      <div class="picker-tile__body">
        <div class="picker-tile__title">${dish.name}</div>
        <div class="picker-tile__meta">~${dish.cooktime} Min · ${Math.round(dish.kcal * getScaleForDish(dish))} kcal</div>
      </div>
    </button>
  `;
}

// Verkleinert die Chip-Schrift bis alle nowrap-Rows in ihre Container-Breite
// passen. CSS-Variable --picker-chip-font wird auf bodyEl gesetzt.
function fitFilterFontSize() {
  if (!bodyEl) return;
  const rows = bodyEl.querySelectorAll('.picker-filter-row--nowrap');
  if (rows.length === 0) return;
  const maxPx = 14;
  const minPx = 10;
  let size = maxPx;
  bodyEl.style.setProperty('--picker-chip-font', `${size}px`);
  const overflows = () => Array.from(rows).some((r) => r.scrollWidth > r.clientWidth + 1);
  let guard = 20;
  while (overflows() && size > minPx && guard-- > 0) {
    size -= 0.5;
    bodyEl.style.setProperty('--picker-chip-font', `${size}px`);
  }
}

// --- Handlers ---

function attachHandlers(session) {
  if (!bodyEl) return;

  // Filter-Chip Toggle: activeFilters mutieren, Filter-UI + Grid rebuilden.
  bodyEl.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const key = btn.dataset.filter;
      if (activeFilters.has(key)) activeFilters.delete(key);
      else activeFilters.add(key);
      updateFilters();
      updateGrid();
    });
  });

  attachTileHandlers(session);
  attachFavBadgeHandlers();

  // Bild-Binding fuer Tiles (Remote-Cache-URI).
  bodyEl.querySelectorAll('img[data-dish-image-id]').forEach((imgEl) => {
    const id = parseInt(imgEl.dataset.dishImageId, 10);
    if (!isNaN(id)) bindDishImage(imgEl, id);
  });

  // Filter-Reset.
  const resetBtn = bodyEl.querySelector('[data-action="reset-filters"]');
  if (resetBtn) {
    resetBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (activeFilters.size === 0) return;
      activeFilters.clear();
      updateFilters();
      updateGrid();
    });
  }

  // Filter-Section-Header: togglet Collapse. Sticky+unsichtbar → expand+scroll,
  // sonst normal togglen mit scrollTop-Kompensation.
  const toggleBtn = bodyEl.querySelector('[data-action="toggle-filters"]');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const bodyBox = bodyEl.querySelector('.picker-filters__body');
      const scrollRoot = bodyEl.querySelector('.picker-body') || bodyEl;
      const sticky = isFilterHeaderSticky(toggleBtn, scrollRoot);
      const bodyVisible = bodyBox && !bodyBox.hidden && isFilterBodyVisibleBelow(bodyBox, toggleBtn);

      if (sticky && !bodyVisible) {
        filtersCollapsed = false;
        toggleBtn.classList.remove('picker-filters__header--collapsed');
        toggleBtn.setAttribute('aria-expanded', 'true');
        if (bodyBox) bodyBox.hidden = false;
        requestAnimationFrame(() => {
          if (bodyBox) bodyBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        return;
      }

      let compensation = 0;
      if (!filtersCollapsed && bodyBox && scrollRoot) {
        const bodyRect = bodyBox.getBoundingClientRect();
        const bodySpace = bodyRect.height + (parseFloat(getComputedStyle(bodyBox).marginBottom) || 0);
        const rootTop = scrollRoot.getBoundingClientRect().top;
        const scrolledPast = rootTop - bodyRect.top;
        compensation = Math.max(0, Math.min(scrolledPast, bodySpace));
      }
      filtersCollapsed = !filtersCollapsed;
      toggleBtn.classList.toggle('picker-filters__header--collapsed', filtersCollapsed);
      toggleBtn.setAttribute('aria-expanded', String(!filtersCollapsed));
      if (bodyBox) bodyBox.hidden = filtersCollapsed;
      if (compensation > 0 && scrollRoot) {
        scrollRoot.scrollTop = Math.max(0, scrollRoot.scrollTop - compensation);
      }
    });
  }

  // Grids-Header: scrollt zum Anfang der Grids-Body.
  const gridsHeader = bodyEl.querySelector('[data-action="scroll-grids-top"]');
  if (gridsHeader) {
    gridsHeader.addEventListener('click', () => {
      const gridsBody = bodyEl.querySelector('.picker-grids__body');
      if (gridsBody) gridsBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Scroll-Compact-Klasse auf .picker-body (scroll container).
  const scroll = bodyEl.querySelector('.picker-body');
  if (scroll) {
    scroll.addEventListener('scroll', () => {
      scroll.classList.toggle('picker-body--scrolled', scroll.scrollTop > SCROLL_COMPACT_THRESHOLD);
    }, { passive: true });
  }
}

function attachTileHandlers(session) {
  if (!bodyEl) return;
  bodyEl.querySelectorAll('button[data-dish-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-disabled') === 'true') return;
      const id = parseInt(btn.dataset.dishId, 10);
      if (currentApi) {
        currentApi.onPick(session.day, id);
        // Nach Pick: automatisch in Detail-Mode wechseln (Design-Entscheidung
        // des Rebuilds — vorher hat der Picker einfach geschlossen).
        currentApi.switchMode('detail', { tab: 'zutaten' });
      }
    });
  });
}

function attachFavBadgeHandlers() {
  if (!bodyEl) return;
  bodyEl.querySelectorAll('[data-action="toggle-fav"]').forEach((el) => {
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const id = parseInt(el.dataset.dishId, 10);
      toggleFavorite(id);
      saveState();
      if (currentApi) currentApi.onChange();
      updateGrid({ preserveScroll: true, animate: true });
    });
    el.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      ev.stopPropagation();
      const id = parseInt(el.dataset.dishId, 10);
      toggleFavorite(id);
      saveState();
      if (currentApi) currentApi.onChange();
      updateGrid({ preserveScroll: true, animate: true });
    });
  });
}

function updateFilters() {
  if (!bodyEl) return;
  bodyEl.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.setAttribute('aria-pressed', activeFilters.has(btn.dataset.filter) ? 'true' : 'false');
  });
  const active = FILTERS.filter((f) => activeFilters.has(f.key)).length;
  const countEl = bodyEl.querySelector('[data-role="filter-count"]');
  if (countEl) countEl.textContent = `${active}/${FILTERS.length}`;
  const resetBtn = bodyEl.querySelector('[data-role="filter-reset"]');
  if (resetBtn) resetBtn.hidden = active === 0;
}

function updateGrid({ preserveScroll = false, animate = false } = {}) {
  if (!bodyEl || !currentDay) return;
  const session = { day: currentDay };
  const currentDishId = state.assignment[currentDay];
  const { main, overflow } = filteredDishes(session);
  const used = usedElsewhereMap(session);
  const scroll = bodyEl.querySelector('.picker-body');
  const prevScrollTop = scroll ? scroll.scrollTop : 0;
  const oldRects = animate ? collectTileRects(bodyEl) : null;
  const oldGrids = bodyEl.querySelector('.picker-grids');
  if (oldGrids) oldGrids.remove();

  const container = bodyEl.querySelector('.picker-body') || bodyEl;
  container.insertAdjacentHTML('beforeend', renderResults(main, overflow, currentDishId, used));

  bodyEl.querySelectorAll('img[data-dish-image-id]').forEach((imgEl) => {
    const id = parseInt(imgEl.dataset.dishImageId, 10);
    if (!isNaN(id)) bindDishImage(imgEl, id);
  });
  attachTileHandlers(session);
  attachFavBadgeHandlers();

  if (preserveScroll && scroll) {
    scroll.scrollTop = prevScrollTop;
  } else if (scroll) {
    scroll.scrollTop = 0;
    scroll.classList.remove('picker-body--scrolled');
  }
  if (oldRects) playTileFlip(bodyEl, oldRects);
}

function collectTileRects(root) {
  const rects = new Map();
  root.querySelectorAll('button[data-dish-id]').forEach((el) => {
    rects.set(el.dataset.dishId, el.getBoundingClientRect());
  });
  return rects;
}

function playTileFlip(root, oldRects) {
  root.querySelectorAll('button[data-dish-id]').forEach((el) => {
    const oldRect = oldRects.get(el.dataset.dishId);
    if (!oldRect) return;
    const newRect = el.getBoundingClientRect();
    if (!newRect.width || !newRect.height) return;
    if (!oldRect.width || !oldRect.height) return;
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = `transform ${FLIP_DURATION_MS}ms ${FLIP_EASING}`;
      el.style.transform = '';
    });
  });
}

function isFilterHeaderSticky(btn, scrollRoot) {
  if (!scrollRoot) return false;
  const relTop = btn.getBoundingClientRect().top - scrollRoot.getBoundingClientRect().top;
  return relTop <= 2;
}

function isFilterBodyVisibleBelow(body, btn) {
  const bodyRect = body.getBoundingClientRect();
  if (bodyRect.height === 0) return false;
  const btnRect = btn.getBoundingClientRect();
  return bodyRect.bottom > btnRect.bottom + 2;
}
