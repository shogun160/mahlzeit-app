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

  return article;
}
