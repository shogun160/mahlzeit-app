// Baut das JSON-Payload fuer den Rezepte-Kalender-Export.
// Basis: alle Tage mit state.selected[day] === true und gesetztem
// state.assignment[day]. Pro Rezept ein Meal-Objekt mit Zutaten (skaliert +
// vorformatiert) und Zubereitungsschritten. Datums-Zuordnung erfolgt nicht
// hier — der Empfaenger (Claude-Session) mappt Wochentag-Kuerzel auf konkrete
// Daten.
// Spec: docs/superpowers/specs/2026-08-01-rezepte-kalender-export-design.md

import { state, DAYS } from '../state.js';
import { dishesById } from '../data/dishes.js';
import { ingredientRegistry } from '../data/ingredient-registry.js';
import { totalFactorForDish } from '../nutrition/scale.js';
import { formatQuantity } from '../util/format.js';

// Rueckgabe:
//   { exportedAt, timezone, meals: Array<Meal> }
// mit Meal = { day, portions, dishId, name, cuisine, cuisineGroup,
//              cooktime, ingredients: [{label, quantity}], steps: [string] }
//
// Reihenfolge der meals: chronologisch nach DAYS (Mo, Di, ..., So).
// Vorrats-Zutaten ohne displayUnit werden mit "Vorrat pruefen" als quantity
// gefuehrt (analog zu formatQuantity, sum=0 bei diesen Zutaten).
export function buildExportPayload() {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const meals = [];

  for (const day of DAYS) {
    if (!state.selected[day]) continue;
    const dishId = state.assignment[day];
    const dish = dishesById.get(dishId);
    if (!dish) continue;

    const portions = state.portions[day] || 1;
    const dayFactor = totalFactorForDish(dish, portions);

    const ingredients = dish.ingredients.map((ing) => {
      const meta = ingredientRegistry[ing.key] || {};
      // Vorrat-Zutaten ohne displayUnit tragen sum=0 → formatQuantity gibt
      // dann "Vorrat pruefen" zurueck. Fuer alles andere: grams * dayFactor.
      const contributesSum = ing.unit !== 'vorrat' || ing.displayUnit;
      const sum = contributesSum ? ing.grams * dayFactor : 0;
      const item = {
        label: ing.label ?? meta.label ?? ing.key,
        cat: ing.cat ?? meta.cat,
        unit: ing.unit ?? meta.unit,
        size: ing.size ?? meta.size,
        displayUnit: ing.displayUnit ?? meta.displayUnit,
        gramsPerUnit: ing.gramsPerUnit ?? meta.gramsPerUnit,
        note: ing.note ?? meta.note,
        sum,
      };
      return {
        label: item.label,
        quantity: formatQuantity(item),
      };
    });

    meals.push({
      day,
      portions,
      dishId: dish.id,
      name: dish.name,
      cuisine: dish.cuisine ?? null,
      cuisineGroup: dish.cuisineGroup ?? null,
      cooktime: dish.cooktime ?? null,
      ingredients,
      steps: Array.isArray(dish.steps) ? dish.steps.slice() : [],
    });
  }

  return {
    exportedAt: toIsoWithOffset(now),
    timezone,
    meals,
  };
}

// ISO 8601 mit lokalem Zeitzonen-Offset (nicht UTC), damit der Empfaenger
// weiss, in welcher Wanduhr-Zeit der Export lief. Format: 2026-08-01T14:23:00+02:00
function toIsoWithOffset(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const offsetMin = -d.getTimezoneOffset(); // getTimezoneOffset ist invers
  const sign = offsetMin >= 0 ? '+' : '-';
  const oh = pad(Math.floor(Math.abs(offsetMin) / 60));
  const om = pad(Math.abs(offsetMin) % 60);
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${oh}:${om}`;
}

// Anzahl der Rezepte, die aktuell exportiert wuerden. Fuer Disabled-State
// und Toast-Text („N Rezepte kopiert"). Muss dieselbe Filter-Logik nutzen
// wie buildExportPayload, sonst driften Zaehler und Payload auseinander.
export function countExportableMeals() {
  let count = 0;
  for (const day of DAYS) {
    if (!state.selected[day]) continue;
    if (!dishesById.get(state.assignment[day])) continue;
    count += 1;
  }
  return count;
}
