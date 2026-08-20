// Baut das JSON-Payload fuer den Rezepte-Kalender-Export.
// Basis: alle Tage mit state.selected[day] === true und gesetztem
// state.assignment[day]. Pro Rezept ein Meal-Objekt mit Zutaten (skaliert +
// vorformatiert) und Zubereitungsschritten. Datums-Zuordnung erfolgt nicht
// hier — der Empfaenger (Claude-Session) mappt Wochentag-Kuerzel auf konkrete
// Daten.
// Spec: docs/superpowers/specs/2026-08-01-rezepte-kalender-export-design.md

import { state, DAYS } from '../state.js';
import { dishesById } from '../data/dishes.js';
import { scaledGramsForDay } from '../nutrition/scale.js';
import { formatIngredientQuantity } from '../util/format.js';

// Rueckgabe:
//   { exportedAt, timezone, meals: Array<Meal> }
// mit Meal = { day, portions, dishId, name, cuisine, cuisineGroup,
//              cooktime, ingredients: [{label, quantity, grams}], steps: [string] }
//
// quantity ist der Anzeige-String wie im Rezept ("½ Stück", "3 EL", "225 g"),
// grams die exakte Kochmenge dahinter. Beide braucht es: die Anzeige hebt
// Garnitur-Mengen aufs Viertel (¼ Mango statt 30 g), gerechnet wird mit grams.
//
// Reihenfolge der meals: chronologisch nach DAYS (Mo, Di, ..., So).
//
// Mengen kommen aus demselben Pfad wie das Detail-Sheet: scaledGramsForDay
// (0.25-Raster bei Stueck-Zutaten, Kleinmengen exakt, sqrt-Daempfung fuer
// Aromageber) plus formatIngredientQuantity. Bewusst NICHT formatQuantity —
// das ist der Einkaufs-Formatierer, der auf ganze Stueck aufrundet. Fuer den
// Einkauf ist das richtig (man kauft keine halbe Gurke), fuer eine
// Kochanleitung nicht: aus 175 g Blumenkohl wurde so "1 Stueck" (700 g).
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

    // dish stammt aus dishesById, ist also bereits angereichert (label, unit,
    // size, displayUnit) — kein Registry-Fallback noetig.
    const ingredients = dish.ingredients.map((ing) => {
      const grams = scaledGramsForDay(ing, portions, dish);
      return {
        label: ing.label,
        quantity: formatIngredientQuantity(ing, grams),
        grams: Math.round(grams),
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
