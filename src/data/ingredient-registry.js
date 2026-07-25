import { allDishes } from './dishes.js';

// Aggregiert alle je in einem Gericht vorkommenden Zutaten in ein Lookup:
//   { [key]: { key, label, cat, unit, size, note } }
// Wird für die Einkaufsliste gebraucht, wenn abgehakte Zutaten nach dem Abwählen
// des zugehörigen Gerichts noch angezeigt werden sollen (Leftover). Bewusst aus
// dish.ingredients gebaut statt aus meta — meta ist unvollständig (z. B. fehlt
// dort `rindergulasch`).
export const ingredientRegistry = (() => {
  const map = {};
  for (const dish of allDishes) {
    for (const ing of dish.ingredients) {
      if (!map[ing.key]) {
        map[ing.key] = {
          key: ing.key,
          label: ing.label,
          cat: ing.cat,
          unit: ing.unit,
          size: ing.size,
          note: ing.note,
        };
      }
    }
  }
  return map;
})();
