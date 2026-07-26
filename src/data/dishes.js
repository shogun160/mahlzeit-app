import dishesData from './dishes.json';
import ingredientsData from './ingredients.json';

// Kanonische Zutaten-Datenbank (single source of truth für label, cat, unit,
// size, note, per_100g Makros). Ein Ingredient-Key darf App-weit nur einmal
// definiert sein — Änderungen hier ziehen automatisch in alle Rezepte durch.
export const ingredientsDb = ingredientsData.ingredients;

// Dish-Ingredients werden beim Laden angereichert: das JSON speichert nur
// {key, grams, note?}, hier werden label, cat, unit, size und die konkreten
// Makros (per_100g × grams) aus der DB dazugelegt. Consumer (Card, Detail-Sheet,
// Shopping-Liste) sehen weiterhin dieselben Felder wie vor der DB-Migration.
function enrichIngredient(ing) {
  const entry = ingredientsDb[ing.key];
  if (!entry) {
    // Sollte nach dem Big-Bang-Refactor nicht mehr vorkommen. Wenn doch:
    // hart failen macht den Fehler sichtbar statt still falsche Werte zu liefern.
    throw new Error(`Ingredient-Key nicht in DB: ${ing.key}`);
  }
  const g = ing.grams;
  const p100 = entry.per100g;
  return {
    key: ing.key,
    grams: g,
    label: entry.label,
    cat: entry.cat,
    unit: entry.unit,
    size: entry.size ?? null,
    // Rezept-Anzeige-Einheit ("tl" / "el") — nur bei löffelbaren Zutaten
    // (Öle, Sauce, Süßes, Paste). Konvertiert grams zur Ausgabe in Löffel,
    // ohne die interne g-Rechnung (kcal, Skalierung, Einkaufsliste) zu ändern.
    displayUnit: entry.displayUnit ?? null,
    gramsPerUnit: entry.gramsPerUnit ?? null,
    // Dish-spezifisches note (z. B. "TK-Packung à 400 g") hat Vorrang vor der
    // DB-Note; wenn beide fehlen, null.
    note: ing.note ?? entry.note ?? null,
    kcal: +(p100.kcal * g / 100).toFixed(1),
    p:    +(p100.p    * g / 100).toFixed(1),
    kh:   +(p100.kh   * g / 100).toFixed(1),
    f:    +(p100.f    * g / 100).toFixed(1),
  };
}

// Alle Dishes einmalig anreichern (immutable, wird nicht mehr geändert).
export const allDishes = dishesData.dishes.map((d) => ({
  ...d,
  ingredients: d.ingredients.map(enrichIngredient),
}));
export const dishesById = new Map(allDishes.map((d) => [d.id, d]));
export const allDishIds = allDishes.map((d) => d.id);

// Fisher-Yates: mischt Array in-place. Wir arbeiten auf einer Kopie.
export function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Gewichteter Shuffle: iterativ wird pro Runde ein Kandidat proportional zu
// seinem weightFn-Gewicht aus dem verbleibenden Pool gezogen. Ergebnis ist eine
// Permutation aller IDs, aber Kandidaten mit höherem Gewicht landen tendenziell
// weiter vorne. weightFn(id) muss > 0 sein — Sicherheitsclamp auf 0.0001.
// Genutzt vom Reroll, um bevorzugte Küchen (Faktor 3) sichtbar häufiger, aber
// nicht ausschließlich in der Woche unterzubringen.
export function weightedShuffle(ids, weightFn) {
  const pool = ids.slice();
  const result = [];
  while (pool.length > 0) {
    const weights = pool.map((id) => Math.max(0.0001, weightFn(id)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < weights.length; idx++) {
      r -= weights[idx];
      if (r <= 0) break;
    }
    if (idx >= pool.length) idx = pool.length - 1;
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}
