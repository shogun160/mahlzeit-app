import { PORTIONS_MIN, PORTIONS_MAX } from '../state.js';

// Rendert eine einzelne Day-Card als <article>-Element.
// Erwartet:
//   { day: string,
//     dish: { id, name, cuisine, cooktime, ... },
//     portions: number,
//     isSelected: boolean,
//     openIngredientsCount: number,   // Zutaten dieses Gerichts nicht in checkedShopping.
//                                     // Badge sitzt IMMER am Zutaten-Icon — er signalisiert
//                                     // die Zutaten-Menge des Gerichts, unabhängig davon,
//                                     // ob das Gericht schon auf der Einkaufsliste ist.
//     handlers: {
//       onPortionChange(delta),
//       onReroll(),
//       onToggleSelected(),
//       onOpenDetail(tab)              // tab: 'zutaten' | 'rezept'
//     } }
export function createDayCard({ day, dish, portions, isSelected, openIngredientsCount, handlers }) {
  const article = document.createElement('article');
  article.className = 'day-card' + (isSelected ? ' day-card--selected' : '');
  const imageSrc = `/dishes/dish-${dish.id}.jpg`;
  const minusDisabled = portions <= PORTIONS_MIN;
  const plusDisabled = portions >= PORTIONS_MAX;
  const selectionIcon = isSelected ? 'icon-einkaufsliste-aktiv' : 'icon-einkaufsliste-inaktiv';
  const selectionLabel = isSelected ? 'Für Einkaufsliste abwählen' : 'Für Einkaufsliste auswählen';

  // Makros werden mit den Portionen skaliert und ganzzahlig gerundet.
  const kcal = Math.round(dish.kcal * portions);
  const protein = Math.round(dish.p * portions);
  const carbs = Math.round(dish.kh * portions);
  const fat = Math.round(dish.f * portions);

  article.innerHTML = `
    <div class="day-card__image-wrap">
      <img class="day-card__image" src="${imageSrc}" alt="${dish.name}" loading="lazy" data-action="open-recipe" />
      <div class="day-card__portion-overlay">
        <div class="stepper stepper--pill" role="group" aria-label="Portionen für ${day}">
          <svg class="stepper__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <button class="stepper__btn" data-action="portion-minus" aria-label="Weniger Personen für ${day}" ${minusDisabled ? 'disabled' : ''}>−</button>
          <span class="stepper__value">${portions}</span>
          <button class="stepper__btn" data-action="portion-plus" aria-label="Mehr Personen für ${day}" ${plusDisabled ? 'disabled' : ''}>+</button>
        </div>
      </div>
      <div class="day-card__makros" aria-hidden="true">
        <span class="makro-pill makro-pill--kcal">${kcal}<span class="unit"> kcal</span></span>
        <span class="makro-pill makro-pill--p">${protein}<span class="unit"> g P</span></span>
        <span class="makro-pill makro-pill--kh">${carbs}<span class="unit"> g KH</span></span>
        <span class="makro-pill makro-pill--f">${fat}<span class="unit"> g F</span></span>
      </div>
    </div>
    <div class="day-card__body">
      <div class="day-card__header-row">
        <div class="day-card__day">${day}</div>
        <div class="day-card__meta">~${dish.cooktime} Min. · ${dish.cuisine}</div>
      </div>
      <h2 class="day-card__title">${dish.name}</h2>
      <div class="day-card__actions">
        <button class="action-btn" data-action="open-ingredients" aria-label="Zutaten für ${day} anzeigen (${openIngredientsCount} offen)">
          <span class="action-btn__icon-wrap">
            <img src="/icons/icon-rezept-zutaten.png" alt="" />
            ${openIngredientsCount > 0 ? `<span class="action-btn__badge">${openIngredientsCount}</span>` : ''}
          </span>
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
