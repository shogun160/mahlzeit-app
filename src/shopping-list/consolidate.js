import { state, DAYS } from '../state.js';
import { dishesById } from '../data/dishes.js';
import { ingredientRegistry } from '../data/ingredient-registry.js';
import { scaledGramsForDay } from '../nutrition/scale.js';

// Aggregiert alle Zutaten der ausgewählten Tage in eine flache Map.
// Rückgabe: { [key]: { key, label, cat, unit, size, note, sum, isLeftover } }
// - sum: Summe der Tagesmengen über alle selektierten Tage. Pro Tag exakt die
//        Menge, die auch im Detail-Sheet steht (scaledGramsForDay: portions ×
//        Diner-Skalierung, Stück auf 0.25 gerundet, Aromageber gedämpft).
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
    // Menge pro Tag kommt aus scaledGramsForDay — derselben Funktion, die auch
    // das Detail-Sheet nutzt. Das ist wichtig: scaledGramsForDay rundet
    // Stueck-Zutaten auf 0.25-Schritte und daempft Aromageber (bund/el/tl).
    // Wuerde hier stattdessen roh mit dem Tagesfaktor multipliziert, summierte
    // die Liste ungerundete Mengen und liefe gegen das, was im Rezept steht:
    // zwei Gerichte mit angezeigter "1/2 Gurke" landeten bei 2 Gurken statt 1.
    const portions = state.portions[day] || 1;
    dish.ingredients.forEach((ing) => {
      if (!consolidated[ing.key]) {
        consolidated[ing.key] = {
          key: ing.key,
          label: ing.label,
          cat: ing.cat,
          unit: ing.unit,
          size: ing.size,
          displayUnit: ing.displayUnit,
          gramsPerUnit: ing.gramsPerUnit,
          note: ing.note,
          sum: 0,
          isLeftover: false,
        };
      }
      // Vorrat-Zutaten mit displayUnit (Öl, Sojasauce, Honig als EL/TL) sollen
      // die konsolidierte Menge zeigen — der User will wissen wieviel er braucht,
      // um den Vorrat prüfen zu können. Vorrat ohne displayUnit (Sesam, Gewürze
      // in Prisen) bleibt bei sum=0 → reines "Vorrat prüfen".
      const contributesSum = ing.unit !== 'vorrat' || ing.displayUnit;
      consolidated[ing.key].sum += contributesSum ? scaledGramsForDay(ing, portions, dish) : 0;
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
