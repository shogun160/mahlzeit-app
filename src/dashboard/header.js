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
