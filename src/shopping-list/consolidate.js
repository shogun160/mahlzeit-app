import { state, DAYS } from '../state.js';
import { dishesById } from '../data/dishes.js';
import { ingredientRegistry } from '../data/ingredient-registry.js';

// Aggregiert alle Zutaten der ausgewählten Tage in eine flache Map.
// Rückgabe: { [key]: { key, label, cat, unit, size, note, sum, isLeftover } }
// - sum: Summe der grams über alle selektierten Tage, jeweils mit state.portions[day] skaliert.
//        Für unit === 'vorrat' bleibt sum = 0 (Anzeige zeigt "Vorrat prüfen" statt Menge).
// - isLeftover: true für Zutaten, die nur in checkedShopping stehen, weil ihr
//        Gericht nachträglich abgewählt wurde. Menge ist dann unbekannt → sum = 0.
//        Meta (label/cat/unit/size/note) kommt aus ingredientRegistry.
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
          isLeftover: false,
        };
      }
      consolidated[ing.key].sum += ing.unit === 'vorrat' ? 0 : ing.grams * scale;
    });
  });

  // Abgehakte Zutaten aus abgewählten Gerichten bleiben sichtbar (als Leftover),
  // bis der User sie unhakt oder den Reset-Button drückt. Menge unbekannt.
  state.checkedShopping.forEach((key) => {
    if (consolidated[key]) return;
    const meta = ingredientRegistry[key];
    if (!meta) return;
    consolidated[key] = {
      ...meta,
      sum: 0,
      isLeftover: true,
    };
  });

  return consolidated;
}
