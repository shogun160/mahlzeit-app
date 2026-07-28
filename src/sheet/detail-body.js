// Body-Renderer fuer Sheet-Mode 'detail'. Enthaelt Tabs (Zutaten/Rezept),
// Panel-Track, Macro-Footer und Handler fuer Tab-Wechsel + Ingredient-Check +
// Panel-Swipe. Hero + Info-Section liegen im Sheet-Level (render.js).

import { state } from '../state.js';
import { dishesById } from '../data/dishes.js';
import { toggleChecked } from '../shopping-list/check.js';
import { renderIngredients, renderMacroFooter } from '../detail-sheet/ingredients.js';
import { renderRecipe } from '../detail-sheet/recipe.js';

const TAB_ORDER = ['zutaten', 'rezept'];
const TAB_LABELS = { zutaten: 'Zutaten', rezept: 'Rezept' };
const SWIPE_THRESHOLD_PX = 55;
const SWIPE_DIRECTIONAL_RATIO = 1.4;

// Modul-lokaler Ref auf das aktuelle Body-Container-Element und die
// Sheet-API. Wird bei attach() gesetzt, bei detach() zurueckgesetzt.
let bodyEl = null;
let currentApi = null;

export const detailBody = {
  render(session) {
    const dish = dishesById.get(state.assignment[session.day]);
    if (!dish) return '';
    const portions = state.portions[session.day];
    const trackOffset = TAB_ORDER.indexOf(session.detailTab) * 50;
    return `
      <div class="sheet-tabs" role="tablist" aria-label="Ansicht">
        ${TAB_ORDER.map((t) => `
          <button class="sheet-tabs__btn ${t === session.detailTab ? 'sheet-tabs__btn--active' : ''}"
                  role="tab"
                  aria-selected="${t === session.detailTab ? 'true' : 'false'}"
                  data-tab="${t}">${TAB_LABELS[t]}</button>
        `).join('')}
      </div>
      <div class="sheet-body">
        <div class="sheet-tabs__track" style="transform: translateX(-${trackOffset}%);">
          <div class="sheet-tabs__panel" role="tabpanel" data-tab="zutaten">${renderIngredients(dish, portions)}</div>
          <div class="sheet-tabs__panel" role="tabpanel" data-tab="rezept">${renderRecipe(dish)}</div>
        </div>
      </div>
      ${renderMacroFooter(dish, portions)}
    `;
  },

  attach(rootEl, session, api) {
    bodyEl = rootEl;
    currentApi = api;
    attachTabHandlers(session);
    attachIngredientCheckHandlers();
    attachPanelSwipe(session);
  },

  detach() {
    bodyEl = null;
    currentApi = null;
  },

  onPortionChange(session) {
    if (!bodyEl) return;
    const dish = dishesById.get(state.assignment[session.day]);
    if (!dish) return;
    const portions = state.portions[session.day];
    // Ingredients-Panel neu; Rezept-Panel ist portionsunabhaengig, bleibt.
    const ingredientsPanel = bodyEl.querySelector('.sheet-tabs__panel[data-tab="zutaten"]');
    if (ingredientsPanel) ingredientsPanel.innerHTML = renderIngredients(dish, portions);
    attachIngredientCheckHandlers();
    // Macro-Footer aktualisieren.
    const footer = bodyEl.querySelector('.sheet-macro-footer');
    if (footer) footer.outerHTML = renderMacroFooter(dish, portions);
  },

  onDishChange(session) {
    // Dish hat gewechselt (Reroll, Day-Swipe, Fav/List-Toggle). Wir bauen
    // beide Panels + Footer neu, Tab-Zustand bleibt aus session.detailTab.
    if (!bodyEl) return;
    bodyEl.innerHTML = this.render(session);
    attachTabHandlers(session);
    attachIngredientCheckHandlers();
    attachPanelSwipe(session);
  },
};

// --- Handlers ---

function attachTabHandlers(session) {
  if (!bodyEl) return;
  bodyEl.querySelectorAll('.sheet-tabs__btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(session, btn.dataset.tab));
  });
}

function switchTab(session, nextTab) {
  if (!bodyEl || session.detailTab === nextTab) return;
  session.detailTab = nextTab;
  const idx = TAB_ORDER.indexOf(nextTab);
  const track = bodyEl.querySelector('.sheet-tabs__track');
  if (track) track.style.transform = `translateX(-${idx * 50}%)`;
  bodyEl.querySelectorAll('.sheet-tabs__btn').forEach((btn) => {
    const isActive = btn.dataset.tab === nextTab;
    btn.classList.toggle('sheet-tabs__btn--active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

// Klick auf Zutaten-Zeile togglet Check-Zustand in state.checkedShopping
// (geteilt mit Einkaufsliste). Nur lokal die Klasse toggeln — kein Rerender,
// damit Tab-Scroll erhalten bleibt. Dashboard + Einkaufsliste ziehen via
// api.onChange() nach.
function attachIngredientCheckHandlers() {
  if (!bodyEl) return;
  const items = bodyEl.querySelectorAll('.ingredient[data-key]');
  items.forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      toggleChecked(key);
      el.classList.toggle('ingredient--checked');
      if (currentApi) currentApi.onChange();
    });
  });
}

// Horizontal-Swipe auf .sheet-body wechselt zwischen Zutaten/Rezept-Tab.
// Nur Touch (passive listeners) — Maus-Swipe ist an einem Desktop irrelevant.
function attachPanelSwipe(session) {
  if (!bodyEl) return;
  const body = bodyEl.querySelector('.sheet-body');
  if (!body) return;
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
    const idx = TAB_ORDER.indexOf(session.detailTab);
    if (dx < 0 && idx < TAB_ORDER.length - 1) switchTab(session, TAB_ORDER[idx + 1]);
    else if (dx > 0 && idx > 0) switchTab(session, TAB_ORDER[idx - 1]);
  }, { passive: true });
}
