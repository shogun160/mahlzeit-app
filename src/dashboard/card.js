import { PORTIONS_MIN, PORTIONS_MAX, isFavorite } from '../state.js';
import { getScaleForDish } from '../nutrition/scale.js';

// Material-Symbols-Icons für die Card-Actions (SVG, currentColor).
// - format_list_bulleted für Zutaten (klare Listen-Metapher)
// - autorenew für Wechseln (Reroll, klare Refresh-Metapher)
// - shopping_bag (outlined default, filled bei selected) fuer Liste — signalisiert
//   den "auf Einkaufsliste"-Zustand direkt am Icon zusaetzlich zum Card-Tint.
const ICON_INGREDIENTS = `<svg class="action-btn__icon" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M360-200v-80h480v80H360Zm0-240v-80h480v80H360Zm0-240v-80h480v80H360ZM200-160q-17 0-28.5-11.5T160-200q0-17 11.5-28.5T200-240q17 0 28.5 11.5T240-200q0 17-11.5 28.5T200-160Zm0-240q-17 0-28.5-11.5T160-440q0-17 11.5-28.5T200-480q17 0 28.5 11.5T240-440q0 17-11.5 28.5T200-400Zm0-240q-17 0-28.5-11.5T160-680q0-17 11.5-28.5T200-720q17 0 28.5 11.5T240-680q0 17-11.5 28.5T200-640Z"/></svg>`;
const ICON_REROLL = `<svg class="action-btn__icon" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;
const ICON_LIST = `<svg class="action-btn__icon" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm0-80h480v-480h-80v80q0 17-11.5 28.5T600-520q-17 0-28.5-11.5T560-560v-80H400v80q0 17-11.5 28.5T360-520q-17 0-28.5-11.5T320-560v-80h-80v480Zm160-560h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-720Z"/></svg>`;
const ICON_LIST_FILLED = `<svg class="action-btn__icon" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm160-640h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-720Z"/></svg>`;
// Material Symbol edit — für Direct-Pick-Pille oben links auf jeder Card.
const ICON_EDIT = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M200-200h56l345-345-56-56-345 345v56Zm572-403L602-771l56-56q23-23 56.5-23t56.5 23l56 56q23 23 24 55.5T829-660l-57 57Zm-58 59L290-120H120v-170l424-424 170 170Zm-141-29-28-28 56 56-28-28Z"/></svg>`;
// Material Symbols favorite — Outline fuer nicht-favorisiert, Fill fuer On.
// Sitzt als Pille rechts neben Fett und togglet Lieblingsgericht-Status.
const ICON_FAV_OUTLINE = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m480-121-41-37q-105.77-97.12-174.88-167.56Q195-396 154-451.5T96.5-552Q80-597 80-643q0-90.15 60.5-150.58Q201-854 290-854q57 0 105.5 27t84.5 78q42-54 89-79.5T670-854q89 0 149.5 60.42Q880-733.15 880-643q0 46-16.5 91T806-451.5Q765-396 695.88-325.56 626.77-255.12 521-158l-41 37Zm0-79q101.24-93.15 166.62-159.58Q712-426 750.5-476t54-89.13q15.5-39.13 15.5-77.87 0-65-42.5-107.5T670-793q-51.63 0-95.31 31.5Q531-730 504-660h-49q-26-69-70-101t-95-32q-65 0-107.5 42.5T140-643q0 38.74 15.5 77.87Q171-526 209.5-476t104 116.42Q378.87-293.15 480-200Zm0-296Z"/></svg>`;
const ICON_FAV_FILL    = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m480-121-41-37q-105.77-97.12-174.88-167.56Q195-396 154-451.5T96.5-552Q80-597 80-643q0-90.15 60.5-150.58Q201-854 290-854q52 0 98.5 22t81.5 62q35-40 81.5-62t98.5-22q89 0 149.5 60.42Q880-733.15 880-643q0 46-16.5 91T806-451.5Q765-396 695.88-325.56 626.77-255.12 521-158l-41 37Z"/></svg>`;

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
//       onOpenPicker(),                // öffnet Direct-Pick-Overlay für diesen Tag
//       onToggleFavorite()             // togglet Lieblingsgericht-Status
//     } }
export function createDayCard({ day, dish, portions, isSelected, openIngredientsCount, handlers }) {
  const article = document.createElement('article');
  article.className = 'day-card' + (isSelected ? ' day-card--selected' : '');
  const imageSrc = `/dishes/dish-${dish.id}.jpg`;
  const minusDisabled = portions <= PORTIONS_MIN;
  const plusDisabled = portions >= PORTIONS_MAX;
  const selectionLabel = isSelected ? 'Für Einkaufsliste abwählen' : 'Für Einkaufsliste auswählen';

  // kcal + Makros je Karte auf Basis des AKTIVEN Users — eine Portion, so
  // wie er sie isst. Weder kumulierte Kochmenge (frueher portions*x) noch
  // Ø ueber alle mitkochenden Diner.
  const userScale = getScaleForDish(dish);
  const kcal = Math.round(dish.kcal * userScale);
  const protein = Math.round(dish.p * userScale);
  const carbs = Math.round(dish.kh * userScale);
  const fat = Math.round(dish.f * userScale);

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
      <div class="day-card__makros">
        <span class="makro-pill makro-pill--kcal" aria-hidden="true">${kcal}<span class="unit"> kcal</span></span>
        <span class="makro-pill makro-pill--p" aria-hidden="true">${protein}<span class="unit"> g P</span></span>
        <span class="makro-pill makro-pill--kh" aria-hidden="true">${carbs}<span class="unit"> g KH</span></span>
        <span class="makro-pill makro-pill--f" aria-hidden="true">${fat}<span class="unit"> g F</span></span>
        <button class="makro-pill makro-pill--fav ${isFavorite(dish.id) ? 'is-on' : ''}"
                type="button"
                data-action="toggle-favorite"
                aria-pressed="${isFavorite(dish.id)}"
                aria-label="${isFavorite(dish.id) ? 'Favorit entfernen' : 'Als Favorit markieren'}">
          ${isFavorite(dish.id) ? ICON_FAV_FILL : ICON_FAV_OUTLINE}
        </button>
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
          ${isSelected ? ICON_LIST_FILLED : ICON_LIST}
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
  // Favoriten-Toggle: click stopPropagation, damit der Bild-Klick (open-recipe)
  // nicht mit ausgeloest wird — die Herz-Pille sitzt zwar in .day-card__makros
  // (own layer), aber die Pille selbst hat pointer-events: auto, deshalb sicher
  // ist stopPropagation.
  const favBtn = article.querySelector('[data-action="toggle-favorite"]');
  if (favBtn) {
    favBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      handlers.onToggleFavorite();
    });
  }

  // Content-Bereich (Body außerhalb Stepper und Actions) öffnet ebenfalls den Rezept-Tab.
  // Kein separater Wrapper — Klick-Filter via closest().
  const body = article.querySelector('.day-card__body');
  body.addEventListener('click', (ev) => {
    if (ev.target.closest('.stepper, .day-card__actions')) return;
    handlers.onOpenDetail('rezept');
  });

  return article;
}
