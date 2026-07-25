import { formatGrams } from '../util/format.js';

// Baut die Zutaten-Liste als HTML-String.
// dish.ingredients: [{ key, label, grams, unit, ... }, ...]
// portions: aktuell gültige Portionen für den zugehörigen Tag (state.portions[day])
export function renderIngredients(dish, portions) {
  const rows = dish.ingredients.map((ing) => `
    <li class="ingredient">
      <span class="ingredient__label">${ing.label}</span>
      <span class="ingredient__qty">${formatGrams(ing.grams, portions)}</span>
    </li>
  `).join('');
  return `<ul class="ingredient-list">${rows}</ul>`;
}
