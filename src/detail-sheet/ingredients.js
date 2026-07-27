import { formatIngredientQuantity } from '../util/format.js';
import { state } from '../state.js';
import { scaledGramsForDay, totalFactorForDish, dinerScalesForDish } from '../nutrition/scale.js';

// Reihenfolge nach Rezept-Logik (Hauptzutat zuerst), bewusst anders als die
// Einkaufsliste (die folgt dem Einkaufsweg mit Obst/Gemüse zuerst).
const CAT_ORDER_DETAIL = [
  'fleisch_fisch',
  'frisch',
  'trocken',
  'kuehlung',
  'gewuerze',
  'oel',
  'sonstig',
];

function sortByCategory(ingredients) {
  return ingredients
    .map((ing, idx) => ({ ing, idx }))
    .sort((a, b) => {
      const rankA = CAT_ORDER_DETAIL.indexOf(a.ing.cat);
      const rankB = CAT_ORDER_DETAIL.indexOf(b.ing.cat);
      const ra = rankA === -1 ? CAT_ORDER_DETAIL.length : rankA;
      const rb = rankB === -1 ? CAT_ORDER_DETAIL.length : rankB;
      if (ra !== rb) return ra - rb;
      return a.idx - b.idx;
    })
    .map(({ ing }) => ing);
}

// Baut die Zutaten-Liste als HTML-String, inklusive Check-Kreise vor jeder Zeile.
// dish.ingredients: [{ key, label, grams, unit, ... }, ...]
// portions: aktuell gültige Portionen für den zugehörigen Tag (state.portions[day])
// Der Check-Zustand kommt aus state.checkedShopping — geteilt mit der Einkaufsliste.
// Der Makro-Footer ist NICHT hier drin — er lebt als Sheet-Bottom-Element in
// beiden Tabs (siehe renderMacroFooter, in render.js unter der sheet-body).
export function renderIngredients(dish, portions) {
  const rows = sortByCategory(dish.ingredients).map((ing) => {
    const checked = state.checkedShopping.has(ing.key);
    const cls = ['ingredient'];
    if (checked) cls.push('ingredient--checked');
    // scaledGramsForDay wendet portions × userScale an und rundet bei
    // diskreten Einheiten (Eier, Stück, Bund, Zehen) auf ganze Stück.
    const grams = scaledGramsForDay(ing, portions, dish);
    return `
      <li class="${cls.join(' ')}" data-key="${ing.key}">
        <span class="ingredient__check" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 10.5 8.5 15 16 6"></polyline>
          </svg>
        </span>
        <span class="ingredient__label">${ing.label}</span>
        <span class="ingredient__qty">${formatIngredientQuantity(ing, grams)}</span>
      </li>
    `;
  }).join('');
  return `<ul class="ingredient-list">${rows}</ul>`;
}

// Makro-Footer fuer beide Tabs (Zutaten + Rezept). Zeigt die 4 Header-Pills
// (kcal + P + KH + F) mittig — Werte sind die Total-Summe fuer alle Portionen
// via totalFactorForDish. Bei portions > 1 zusaetzlich Pro-Diner-Aufteilung.
export function renderMacroFooter(dish, portions) {
  const totalFactor = totalFactorForDish(dish, portions);
  const kcal = Math.round(dish.kcal * totalFactor);
  const p = Math.round(dish.p * totalFactor);
  const kh = Math.round(dish.kh * totalFactor);
  const f = Math.round(dish.f * totalFactor);
  const dinerRows = portions > 1 ? renderDinerRows(dish, portions) : '';
  return `
    <div class="sheet-macro-footer" role="group" aria-label="Gesamt-Nährwerte">
      <div class="sheet-macro-footer__pills">
        <span class="makro-pill makro-pill--kcal" aria-hidden="true">${kcal}<span class="unit"> kcal</span></span>
        <span class="makro-pill makro-pill--p" aria-hidden="true">${p}<span class="unit"> g P</span></span>
        <span class="makro-pill makro-pill--kh" aria-hidden="true">${kh}<span class="unit"> g KH</span></span>
        <span class="makro-pill makro-pill--f" aria-hidden="true">${f}<span class="unit"> g F</span></span>
      </div>
      ${dinerRows}
    </div>
  `;
}

// Pro-Diner-Aufteilung: eine kleine Zeile pro Person mit kcal + P/KH/F.
// Reihenfolge: erste N Profile in profiles-Reihenfolge, dann Gaeste
// (DEFAULT_USER). Name-Fallback: "User 1"/"User 2"/... wenn kein Name
// gesetzt, "Gast" fuer DEFAULT_USER-Fueller.
function renderDinerRows(dish, portions) {
  const rows = dinerScalesForDish(dish, portions).map(({ diner, scale, isDefault }, idx) => {
    const label = isDefault ? 'Gast' : (diner.name || `User ${idx + 1}`);
    const kcal = Math.round(dish.kcal * scale);
    const p = Math.round(dish.p * scale);
    const kh = Math.round(dish.kh * scale);
    const f = Math.round(dish.f * scale);
    return `
      <div class="ingredient-sum__diner-row">
        <span class="ingredient-sum__diner-label">${escapeHtml(label)}</span>
        <span class="ingredient-sum__diner-values">
          ${kcal} kcal · ${p} g <span class="ingredient-sum__key ingredient-sum__key--p">P</span>
          · ${kh} g <span class="ingredient-sum__key ingredient-sum__key--kh">KH</span>
          · ${f} g <span class="ingredient-sum__key ingredient-sum__key--f">F</span>
        </span>
      </div>
    `;
  }).join('');
  return `<div class="ingredient-sum__diners" aria-label="Aufteilung pro Person">${rows}</div>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
