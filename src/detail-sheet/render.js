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
