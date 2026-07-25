import dishesData from './dishes.json';

// Rohe Arrays und Lookups aus der JSON-Datenquelle.
export const allDishes = dishesData.dishes;
export const dishesById = new Map(allDishes.map((d) => [d.id, d]));
export const allDishIds = allDishes.map((d) => d.id);
// meta wird in Session 5 (Einkaufsliste) gebraucht — jetzt schon exportieren
// damit spätere Consumer nicht nochmal umstrukturieren müssen.
export const ingredientMeta = dishesData.meta;

// Fisher-Yates: mischt Array in-place. Wir arbeiten auf einer Kopie.
export function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
