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

// Makro-Footer fuer beide Tabs (Zutaten + Rezept).
// portions=1: die 4 Header-Pills mittig (kcal + P + KH + F) fuer eine Person
//   (Total = aktiver User scale).
// portions>1: KEINE Summe — stattdessen eine Zeile pro Profil-User (Label +
//   4 Pills mit dessen Werten) und, falls Gaeste mitessen, EINE einzige
//   "Standard"-Zeile mit den Werten fuer EINE Standard-Person (unabhaengig
//   wieviel Gaeste).
export function renderMacroFooter(dish, portions) {
  if (portions > 1) {
    return `
      <div class="sheet-macro-footer" role="group" aria-label="Nährwerte pro Person">
        ${renderMultiUserRows(dish, portions)}
      </div>
    `;
  }
  const totalFactor = totalFactorForDish(dish, portions);
  const kcal = Math.round(dish.kcal * totalFactor);
  const p = Math.round(dish.p * totalFactor);
  const kh = Math.round(dish.kh * totalFactor);
  const f = Math.round(dish.f * totalFactor);
  return `
    <div class="sheet-macro-footer" role="group" aria-label="Nährwerte">
      <div class="sheet-macro-footer__pills">
        <span class="makro-pill makro-pill--kcal" aria-hidden="true">${kcal}<span class="unit"> kcal</span></span>
        <span class="makro-pill makro-pill--p" aria-hidden="true">${p}<span class="unit"> g P</span></span>
        <span class="makro-pill makro-pill--kh" aria-hidden="true">${kh}<span class="unit"> g KH</span></span>
        <span class="makro-pill makro-pill--f" aria-hidden="true">${f}<span class="unit"> g F</span></span>
      </div>
    </div>
  `;
}

// Eine Zeile je Profil-User + eine "Standard"-Zeile falls Gaeste dabei sind.
// Berechnung je User: dish.kcal * user-snap-scale — identische Formel wie
// bei portions=1 (dort totalFactor = active user's snap-scale). Snap auf
// 0.25-Schritte kommt aus dishScale, damit Kochmengen und Anzeige denselben
// Wert nutzen. Wenn alle Ziele auf denselben Scale snappen (z. B. alle auf
// 1.0), sind auch die Zeilen identisch — das ist der bewusst gewaehlte
// Trade-off der Snap-Rundung.
function renderMultiUserRows(dish, portions) {
  const diners = dinerScalesForDish(dish, portions);
  const userDiners = diners.filter((d) => !d.isDefault);
  const guestDiners = diners.filter((d) => d.isDefault);
  const rows = userDiners.map(({ diner, scale }, idx) => {
    // Erster Profil-User = "Du" (der Owner der App). Weitere User mit
    // Profilname (Fallback "User 2"/"User 3"/...).
    const label = idx === 0 ? 'Du' : (diner.name || `User ${idx + 1}`);
    return renderDinerPillRow(dish, scale, label);
  });
  if (guestDiners.length > 0) {
    const label = guestDiners.length === 1 ? 'Gast' : 'Gäste';
    rows.push(renderDinerPillRow(dish, guestDiners[0].scale, label));
  }
  return rows.join('');
}

function renderDinerPillRow(dish, scale, label) {
  const kcal = Math.round(dish.kcal * scale);
  const p = Math.round(dish.p * scale);
  const kh = Math.round(dish.kh * scale);
  const f = Math.round(dish.f * scale);
  return `
    <div class="sheet-macro-footer__row">
      <span class="sheet-macro-footer__label">${escapeHtml(label)}</span>
      <div class="sheet-macro-footer__pills">
        <span class="makro-pill makro-pill--kcal" aria-hidden="true">${kcal}<span class="unit"> kcal</span></span>
        <span class="makro-pill makro-pill--p" aria-hidden="true">${p}<span class="unit"> g P</span></span>
        <span class="makro-pill makro-pill--kh" aria-hidden="true">${kh}<span class="unit"> g KH</span></span>
        <span class="makro-pill makro-pill--f" aria-hidden="true">${f}<span class="unit"> g F</span></span>
      </div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
