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
      <button class="icon-btn" data-action="reroll-all" aria-label="Alle Gerichte neu auslosen" title="Alle neu auslosen">
        <img src="/icons/icon-auslosen.png" alt="" />
      </button>
      <div class="stepper stepper--pill" role="group" aria-label="Portionen für alle Tage">
        <svg class="stepper__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <button class="stepper__btn" data-action="global-minus" aria-label="Weniger Personen für alle Tage" ${minusDisabled ? 'disabled' : ''}>−</button>
        <span class="stepper__value">${state.globalPortions}</span>
        <button class="stepper__btn" data-action="global-plus" aria-label="Mehr Personen für alle Tage" ${plusDisabled ? 'disabled' : ''}>+</button>
      </div>
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
          <svg width="24" height="24" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
            <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/>
          </svg>
        </button>
      ` : ''}
    </div>
  `;

  const resetBtn = root.querySelector('[data-action="reset-checked"]');
  if (resetBtn) resetBtn.addEventListener('click', () => onResetChecked());
}
