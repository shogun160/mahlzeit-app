import { PORTIONS_MIN, PORTIONS_MAX } from '../state.js';

// Material-Symbols-Icons für die Card-Actions (SVG, currentColor).
// - format_list_bulleted für Zutaten (klare Listen-Metapher)
// - autorenew für Wechseln (Reroll, klare Refresh-Metapher)
// - shopping_bag (outlined) für Liste — identisches Icon wie die Bottom-Nav.
//   Kein Filled/Outlined-Toggle: das Aktiv-Signal trägt die Card-weite Farb-
//   Umschaltung (Buttons werden primary + weiß), das Icon-Detail wäre bei 18 dp
//   zu subtil um Signalwirkung zu haben.
const ICON_INGREDIENTS = `<svg class="action-btn__icon" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M360-200v-80h480v80H360Zm0-240v-80h480v80H360Zm0-240v-80h480v80H360ZM200-160q-17 0-28.5-11.5T160-200q0-17 11.5-28.5T200-240q17 0 28.5 11.5T240-200q0 17-11.5 28.5T200-160Zm0-240q-17 0-28.5-11.5T160-440q0-17 11.5-28.5T200-480q17 0 28.5 11.5T240-440q0 17-11.5 28.5T200-400Zm0-240q-17 0-28.5-11.5T160-680q0-17 11.5-28.5T200-720q17 0 28.5 11.5T240-680q0 17-11.5 28.5T200-640Z"/></svg>`;
const ICON_REROLL = `<svg class="action-btn__icon" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;
const ICON_LIST = `<svg class="action-btn__icon" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm0-80h480v-480h-80v80q0 17-11.5 28.5T600-520q-17 0-28.5-11.5T560-560v-80H400v80q0 17-11.5 28.5T360-520q-17 0-28.5-11.5T320-560v-80h-80v480Zm160-560h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-720Z"/></svg>`;
// Material Symbol edit — für Direct-Pick-Pille oben links auf jeder Card.
const ICON_EDIT = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M200-200h56l345-345-56-56-345 345v56Zm572-403L602-771l56-56q23-23 56.5-23t56.5 23l56 56q23 23 24 55.5T829-660l-57 57Zm-58 59L290-120H120v-170l424-424 170 170Zm-141-29-28-28 56 56-28-28Z"/></svg>`;

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
//       onOpenDetail(tab),             // tab: 'zutaten' | 'rezept'
//       onOpenPicker()                 // öffnet Direct-Pick-Overlay für diesen Tag
//     } }
export function createDayCard({ day, dish, portions, isSelected, openIngredientsCount, handlers }) {
  const article = document.createElement('article');
  article.className = 'day-card' + (isSelected ? ' day-card--selected' : '');
  const imageSrc = `/dishes/dish-${dish.id}.jpg`;
  const minusDisabled = portions <= PORTIONS_MIN;
  const plusDisabled = portions >= PORTIONS_MAX;
  const selectionLabel = isSelected ? 'Für Einkaufsliste abwählen' : 'Für Einkaufsliste auswählen';

  // Makros werden mit den Portionen skaliert und ganzzahlig gerundet.
  const kcal = Math.round(dish.kcal * portions);
  const protein = Math.round(dish.p * portions);
  const carbs = Math.round(dish.kh * portions);
  const fat = Math.round(dish.f * portions);

  article.innerHTML = `
    <div class="day-card__image-wrap">
      <img class="day-card__image" src="${imageSrc}" alt="${dish.name}" loading="lazy" data-action="open-recipe" />
      <div class="day-card__edit-overlay">
        <button class="edit-pill" data-action="open-picker" aria-label="Anderes Gericht für ${day} auswählen" title="Anderes Gericht auswählen">
          ${ICON_EDIT}
        </button>
      </div>
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
            ${ICON_INGREDIENTS}
            ${openIngredientsCount > 0 ? `<span class="action-btn__badge">${openIngredientsCount}</span>` : ''}
          </span>
          <span>Zutaten</span>
        </button>
        <button class="action-btn" data-action="reroll" aria-label="Neues Gericht für ${day} auslosen">
          ${ICON_REROLL}
          <span>Wechseln</span>
        </button>
        <button class="action-btn" data-action="toggle-selected" aria-pressed="${isSelected}" aria-label="${selectionLabel}">
          ${ICON_LIST}
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
  article.querySelector('[data-action="open-picker"]').addEventListener('click', () => handlers.onOpenPicker());

  // Content-Bereich (Body außerhalb Stepper und Actions) öffnet ebenfalls den Rezept-Tab.
  // Kein separater Wrapper — Klick-Filter via closest().
  const body = article.querySelector('.day-card__body');
  body.addEventListener('click', (ev) => {
    if (ev.target.closest('.stepper, .day-card__actions')) return;
    handlers.onOpenDetail('rezept');
  });

  return article;
}
