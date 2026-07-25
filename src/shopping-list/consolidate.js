import { state, DAYS } from '../state.js';
import { dishesById } from '../data/dishes.js';

// Aggregiert alle Zutaten der ausgewählten Tage in eine flache Map.
// Rückgabe: { [key]: { key, label, cat, unit, size, note, sum } }
// - sum: Summe der grams über alle selektierten Tage, jeweils mit state.portions[day] skaliert.
//        Für unit === 'vorrat' bleibt sum = 0 (Anzeige zeigt "Vorrat prüfen" statt Menge).
// - cat / unit / size / note: übernommen von der ersten Zutat des Keys (identisch über Dishes).
export function buildConsolidatedList() {
  const activeDays = DAYS.filter((d) => state.selected[d]);
  const consolidated = {};
  activeDays.forEach((day) => {
    const dishId = state.assignment[day];
    const dish = dishesById.get(dishId);
    if (!dish) return;
    const scale = state.portions[day] || 1;
    dish.ingredients.forEach((ing) => {
      if (!consolidated[ing.key]) {
        consolidated[ing.key] = {
          key: ing.key,
          label: ing.label,
          cat: ing.cat,
          unit: ing.unit,
          size: ing.size,
          note: ing.note,
          sum: 0,
        };
      }
      consolidated[ing.key].sum += ing.unit === 'vorrat' ? 0 : ing.grams * scale;
    });
  });
  return consolidated;
}
