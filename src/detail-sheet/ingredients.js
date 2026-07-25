import { formatGrams } from '../util/format.js';
import { state } from '../state.js';

// Baut die Zutaten-Liste als HTML-String, inklusive Check-Kreise vor jeder Zeile
// und einer Sum-Row am Ende mit Gesamt-kcal + Makro-Aufteilung.
// dish.ingredients: [{ key, label, grams, unit, ... }, ...]
// portions: aktuell gültige Portionen für den zugehörigen Tag (state.portions[day])
// Der Check-Zustand kommt aus state.checkedShopping — geteilt mit der Einkaufsliste.
export function renderIngredients(dish, portions) {
  const rows = dish.ingredients.map((ing) => {
    const checked = state.checkedShopping.has(ing.key);
    const cls = ['ingredient'];
    if (checked) cls.push('ingredient--checked');
    return `
      <li class="${cls.join(' ')}" data-key="${ing.key}">
        <span class="ingredient__check" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 10.5 8.5 15 16 6"></polyline>
          </svg>
        </span>
        <span class="ingredient__label">${ing.label}</span>
        <span class="ingredient__qty">${formatGrams(ing.grams, portions)}</span>
      </li>
    `;
  }).join('');
  return `
    <ul class="ingredient-list">${rows}</ul>
    ${renderMacroSum(dish, portions)}
  `;
}

// Zweizeilige Sum-Row: oben "Gesamt … kcal", darunter g-Werte + %-Anteile.
// Prozente = kcal-Anteil des Makros (Atwater: 4 kcal/g P, 4 kcal/g KH, 9 kcal/g F).
// Basis für die %-Berechnung ist die Summe der Makro-Kalorien (nicht dish.kcal),
// damit sich die drei Prozente auf ~100 % addieren.
function renderMacroSum(dish, portions) {
  const kcal = Math.round(dish.kcal * portions);
  const p = Math.round(dish.p * portions);
  const kh = Math.round(dish.kh * portions);
  const f = Math.round(dish.f * portions);
  const kcalP = p * 4;
  const kcalKh = kh * 4;
  const kcalF = f * 9;
  const total = kcalP + kcalKh + kcalF;
  const pctP = total > 0 ? Math.round((kcalP / total) * 100) : 0;
  const pctKh = total > 0 ? Math.round((kcalKh / total) * 100) : 0;
  const pctF = total > 0 ? Math.round((kcalF / total) * 100) : 0;

  return `
    <div class="ingredient-sum" role="group" aria-label="Gesamt-Nährwerte">
      <div class="ingredient-sum__row">
        <span class="ingredient-sum__label">Gesamt</span>
        <span class="ingredient-sum__kcal">${kcal} kcal</span>
      </div>
      <div class="ingredient-sum__macros">
        <span>${p} g P (${pctP}%)</span>
        <span class="ingredient-sum__sep" aria-hidden="true">·</span>
        <span>${kh} g KH (${pctKh}%)</span>
        <span class="ingredient-sum__sep" aria-hidden="true">·</span>
        <span>${f} g F (${pctF}%)</span>
      </div>
    </div>
  `;
}
