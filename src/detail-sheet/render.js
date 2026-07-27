import { state, PORTIONS_MIN, PORTIONS_MAX, isFavorite, toggleFavorite } from '../state.js';
import { dishesById } from '../data/dishes.js';
import { changePortion } from '../dashboard/portions.js';
import { toggleSelected } from '../dashboard/selection.js';
import { rerollDay } from '../dashboard/reroll.js';
import { toggleChecked } from '../shopping-list/check.js';
import { renderIngredients } from './ingredients.js';
import { renderRecipe } from './recipe.js';

// Material Symbol shopping_bag (outlined) — für den Toggle-Button im Sheet.
const ICON_LIST = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm0-80h480v-480h-80v80q0 17-11.5 28.5T600-520q-17 0-28.5-11.5T560-560v-80H400v80q0 17-11.5 28.5T360-520q-17 0-28.5-11.5T320-560v-80h-80v480Zm160-560h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-720Z"/></svg>`;
// Material Symbol refresh — für Reroll direkt aus dem Sheet.
const ICON_REFRESH = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;
// Material Symbols favorite — Outline off, Fill on. Sitzt in der Header-Day-
// Zeile neben dem Wochentag.
const ICON_FAV_OUTLINE = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m480-121-41-37q-105.77-97.12-174.88-167.56Q195-396 154-451.5T96.5-552Q80-597 80-643q0-90.15 60.5-150.58Q201-854 290-854q57 0 105.5 27t84.5 78q42-54 89-79.5T670-854q89 0 149.5 60.42Q880-733.15 880-643q0 46-16.5 91T806-451.5Q765-396 695.88-325.56 626.77-255.12 521-158l-41 37Zm0-79q101.24-93.15 166.62-159.58Q712-426 750.5-476t54-89.13q15.5-39.13 15.5-77.87 0-65-42.5-107.5T670-793q-51.63 0-95.31 31.5Q531-730 504-660h-49q-26-69-70-101t-95-32q-65 0-107.5 42.5T140-643q0 38.74 15.5 77.87Q171-526 209.5-476t104 116.42Q378.87-293.15 480-200Zm0-296Z"/></svg>`;
const ICON_FAV_FILL    = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m480-121-41-37q-105.77-97.12-174.88-167.56Q195-396 154-451.5T96.5-552Q80-597 80-643q0-90.15 60.5-150.58Q201-854 290-854q52 0 98.5 22t81.5 62q35-40 81.5-62t98.5-22q89 0 149.5 60.42Q880-733.15 880-643q0 46-16.5 91T806-451.5Q765-396 695.88-325.56 626.77-255.12 521-158l-41 37Z"/></svg>`;

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
  if (typeof rootEl.__closeSwipeCleanup === 'function') {
    rootEl.__closeSwipeCleanup();
    rootEl.__closeSwipeCleanup = null;
  }
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
  const isSelected = !!state.selected[day];
  const trackOffset = TAB_ORDER.indexOf(tab) * 50;
  const listToggleLabel = isSelected ? 'Für Einkaufsliste abwählen' : 'Für Einkaufsliste auswählen';

  rootEl.innerHTML = `
    <div class="sheet-overlay" data-role="backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-handle" aria-hidden="true"></div>
        <div class="sheet-header">
          <div class="sheet-header__title-wrap">
            <div class="sheet-header__day">
              <span>${day}</span>
              <button class="sheet-header__fav ${isFavorite(dish.id) ? 'is-on' : ''}"
                      type="button"
                      data-action="toggle-fav"
                      aria-pressed="${isFavorite(dish.id)}"
                      aria-label="${isFavorite(dish.id) ? 'Favorit entfernen' : 'Als Favorit markieren'}"
                      title="${isFavorite(dish.id) ? 'Favorit entfernen' : 'Als Favorit markieren'}">
                ${isFavorite(dish.id) ? ICON_FAV_FILL : ICON_FAV_OUTLINE}
              </button>
            </div>
            <h2 class="sheet-header__title" id="sheet-title">${dish.name}</h2>
          </div>
          <div class="sheet-header__actions">
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
        <div class="sheet-portion-row ${isSelected ? 'sheet-portion-row--active' : ''}">
          <button class="sheet-reroll-toggle" data-action="reroll-day" aria-label="Anderes Gericht auslosen" title="Anderes Gericht auslosen">
            ${ICON_REFRESH}
          </button>
          <button class="sheet-list-toggle" data-action="toggle-list" aria-pressed="${isSelected}" aria-label="${listToggleLabel}">
            ${ICON_LIST}
          </button>
          <div class="stepper stepper--compact stepper--floating" role="group" aria-label="Portionen für ${day}">
            <svg class="stepper__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <button class="stepper__btn" data-action="sheet-portion-minus" aria-label="Weniger Personen für ${day}" ${minusDisabled ? 'disabled' : ''}>−</button>
            <span class="stepper__value">${portions}</span>
            <button class="stepper__btn" data-action="sheet-portion-plus" aria-label="Mehr Personen für ${day}" ${plusDisabled ? 'disabled' : ''}>+</button>
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
  rootEl.querySelector('[data-action="toggle-list"]').addEventListener('click', () => handleToggleList());
  rootEl.querySelector('[data-action="reroll-day"]').addEventListener('click', () => handleReroll());
  // Favoriten-Toggle in der Header-Day-Zeile. In-place Icon/Klass-Swap,
  // damit der Sheet-Inhalt nicht neu gerendert wird (Tab-Scroll bleibt stehen).
  const favBtn = rootEl.querySelector('[data-action="toggle-fav"]');
  if (favBtn) {
    favBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const id = currentContext.dishId;
      toggleFavorite(id);
      const on = isFavorite(id);
      favBtn.classList.toggle('is-on', on);
      favBtn.setAttribute('aria-pressed', String(on));
      const label = on ? 'Favorit entfernen' : 'Als Favorit markieren';
      favBtn.setAttribute('aria-label', label);
      favBtn.setAttribute('title', label);
      favBtn.innerHTML = on ? ICON_FAV_FILL : ICON_FAV_OUTLINE;
      // onExternalChange triggert Dashboard-Rerender (Card-Herz folgt) + saveState.
      onExternalChange();
    });
  }
  rootEl.querySelectorAll('.sheet-tabs__btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  attachIngredientCheckHandlers();
  attachSwipe();
  attachCloseSwipe();
}

// Klick auf eine Zutaten-Zeile togglet den Check-Zustand in state.checkedShopping
// (geteilt mit der Einkaufsliste). Wir aktualisieren die Klasse nur lokal, damit
// keine Reflow-Kaskade läuft — Cards + Einkaufsliste ziehen via onExternalChange nach.
function attachIngredientCheckHandlers() {
  const items = rootEl.querySelectorAll('.ingredient[data-key]');
  items.forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      toggleChecked(key);
      el.classList.toggle('ingredient--checked');
      onExternalChange();
    });
  });
}

// Runter-Swipe im Sheet schließt es. Bereich: gesamter Sheet, außer interaktive
// Kinder (Buttons, Stepper). Wenn im Panel gestartet und das Panel bereits scrollt
// (scrollTop > 0), wird der Swipe ignoriert — der User will scrollen, nicht schließen.
// Bei Panel-Scroll-Gesture aus scrollTop=0 sendet der Browser pointercancel —
// dann brechen wir das Close-Tracking ab und native scroll übernimmt.
// Runter-Swipe auf Handle oder Header schließt das Sheet.
// setPointerCapture bindet den Pointer ans Zone-Element — der Browser kann dann
// keine Scroll-Geste erkennen und sendet kein pointercancel. Alle Follow-Events
// (pointermove/pointerup) landen garantiert auf der Zone.
// Runter-Swipe von überall im Sheet (außer Buttons, Stepper, scrollbare Panels)
// schließt das Sheet. setPointerCapture auf das Sheet-Element bindet alle Follow-
// Events dorthin — pointerup landet garantiert an, auch wenn Zeiger rauswandert,
// und der Browser sendet kein pointercancel weil er die Geste nicht als Scroll
// interpretieren kann (Sheet selbst ist kein scroll-container).
// Runter-Swipe auf Handle oder Header schließt das Sheet — iOS/Material-Konvention.
// Panels haben eigenes Scroll (touch-action: pan-y) → dort kein Close-Swipe.
// setPointerCapture bindet den Pointer ans Sheet, damit auch bei Draging über die
// Zone hinaus alle Events ankommen.
function attachCloseSwipe() {
  const sheet = rootEl.querySelector('.sheet');
  if (!sheet) return;
  const state = { startX: 0, startY: 0, tracking: false };

  sheet.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (ev.target.closest('button, .stepper')) return;
    if (ev.target.closest('.sheet-tabs__panel')) return;
    state.startX = ev.clientX;
    state.startY = ev.clientY;
    state.tracking = true;
    try { sheet.setPointerCapture(ev.pointerId); } catch (e) {}
  });

  sheet.addEventListener('pointerup', (ev) => {
    if (!state.tracking) return;
    state.tracking = false;
    try { sheet.releasePointerCapture(ev.pointerId); } catch (e) {}
    const dx = ev.clientX - state.startX;
    const dy = ev.clientY - state.startY;
    if (dy <= SWIPE_THRESHOLD_PX) return;
    if (dy <= Math.abs(dx) * SWIPE_DIRECTIONAL_RATIO) return;
    closeDetailSheet();
  });

  sheet.addEventListener('pointercancel', () => { state.tracking = false; });
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

// Togglet die Card-Selection (state.selected[day]) direkt aus dem Sheet.
// Aktualisiert nur die Klasse + aria-Attribut lokal — kein full re-render
// des Sheets. Cards und Einkaufsliste ziehen via onExternalChange nach.
function handleToggleList() {
  if (!currentContext) return;
  toggleSelected(currentContext.day);
  const isSelected = !!state.selected[currentContext.day];
  const row = rootEl.querySelector('.sheet-portion-row');
  const btn = rootEl.querySelector('[data-action="toggle-list"]');
  if (row) row.classList.toggle('sheet-portion-row--active', isSelected);
  if (btn) {
    btn.setAttribute('aria-pressed', isSelected);
    btn.setAttribute('aria-label', isSelected ? 'Für Einkaufsliste abwählen' : 'Für Einkaufsliste auswählen');
  }
  onExternalChange();
}

// Reroll direkt aus dem Sheet: würfelt ein neues Dish für den aktuellen Tag,
// aktualisiert currentContext auf die neue dishId und baut den Sheet-Inhalt neu
// (Titel, Panels, Selection-Zustand). Cards im Hintergrund ziehen via
// onExternalChange nach.
function handleReroll() {
  if (!currentContext) return;
  const beforeId = currentContext.dishId;
  rerollDay(currentContext.day);
  const nextId = state.assignment[currentContext.day];
  if (nextId === beforeId) {
    // Kein Wechsel möglich (z. B. alle anderen Dishes sind bereits vergeben) —
    // nichts weiter zu tun.
    onExternalChange();
    return;
  }
  currentContext.dishId = nextId;
  renderShell();
  onExternalChange();
}

function handleSheetPortion(delta) {
  if (!currentContext) return;
  changePortion(currentContext.day, delta);
  const dish = dishesById.get(currentContext.dishId);
  const portions = state.portions[currentContext.day];
  // Ingredients-Panel neu rendern; Rezept-Panel ist portionsunabhängig, unverändert lassen.
  const ingredientsPanel = rootEl.querySelector('.sheet-tabs__panel[data-tab="zutaten"]');
  ingredientsPanel.innerHTML = renderIngredients(dish, portions);
  // Nach dem Re-render die Check-Handler neu binden.
  attachIngredientCheckHandlers();
  // Stepper-Anzeige aktualisieren
  rootEl.querySelector('.stepper__value').textContent = portions;
  rootEl.querySelector('[data-action="sheet-portion-minus"]').disabled = portions <= PORTIONS_MIN;
  rootEl.querySelector('[data-action="sheet-portion-plus"]').disabled = portions >= PORTIONS_MAX;
  // Cards im Hintergrund aktualisieren (Card-Stepper zeigt neuen Wert).
  onExternalChange();
}
