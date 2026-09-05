import dishesData from './dishes.json' with { type: 'json' };
import ingredientsData from './ingredients.json' with { type: 'json' };
import { state } from '../state.js';

// Kanonische Zutaten-Datenbank (single source of truth für label, cat, unit,
// size, note, per_100g Makros). Ein Ingredient-Key darf App-weit nur einmal
// definiert sein — Änderungen hier ziehen automatisch in alle Rezepte durch.
// Bundled-Registry; Remote-Ingredients werden pro Rebuild dazu gemergt.
const bundledIngredients = ingredientsData.ingredients;

// Merged Ingredients (bundled + remote) — wird bei jedem rebuildDishes() neu
// berechnet. Primaer intern genutzt (fuer enrichIngredient); Consumer verwenden
// normalerweise die pro-dish enriched-Struktur.
//
// Als Live-Binding exportiert fuer die Zutaten-Suche im Eigene-Zutat-Sheet.
// Bewusst nicht ingredientRegistry: das kennt nur Zutaten, die in einem Gericht
// vorkommen, und friert seinen Stand beim Modul-Load ein — Remote-Zutaten
// fehlen dort. Hier sehen Importer nach rebuildDishes() den gemergten Stand.
export let allIngredients = { ...bundledIngredients };

// Dish-Ingredients werden beim Laden angereichert: das JSON speichert nur
// {key, grams, note?}, hier werden label, cat, unit, size und die konkreten
// Makros (per_100g × grams) aus der DB dazugelegt. Consumer (Card, Detail-Sheet,
// Shopping-Liste) sehen weiterhin dieselben Felder wie vor der DB-Migration.
function enrichIngredient(ing) {
  const entry = allIngredients[ing.key];
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

// Live-Bindings: nach rebuildDishes() sehen alle Importer die aktualisierten
// Werte (ESM export-let-Semantik). Consumer greifen weiter direkt auf die
// Namen zu — nur der Inhalt aendert sich, wenn Remote-Rezepte importiert oder
// beim Start aus dem persistierten State geladen werden.
export let allDishes = enrichDishes(dishesData.dishes);
export let dishesById = new Map(allDishes.map((d) => [d.id, d]));
export let allDishIds = allDishes.map((d) => d.id);

function enrichDishes(rawDishes) {
  return rawDishes.map((d) => ({
    ...d,
    ingredients: d.ingredients.map(enrichIngredient),
  }));
}

// Mergt bundled + persistierte Remote-Rezepte/Zutaten und rebuildet die
// exportierten Live-Bindings. Wird aufgerufen:
//   - beim App-Start nach loadState() (Persisted-Import wieder aktivieren)
//   - nach jedem erfolgreichen performImport (frische Rezepte einblenden)
// Ohne Aufruf sehen Consumer nur bundled — Remote-Import bleibt unsichtbar.
export function rebuildDishes() {
  const remoteDishes = Array.isArray(state.remoteDishes) ? state.remoteDishes : [];
  const remoteIngredients = state.remoteIngredients && typeof state.remoteIngredients === 'object'
    ? state.remoteIngredients
    : {};
  const merged = mergeRemote({
    bundled: dishesData.dishes,
    bundledIngredients,
    remoteDishes,
    remoteIngredients,
  });
  // allIngredients zuerst setzen — enrichIngredient liest daraus.
  allIngredients = merged.ingredients;
  const enriched = enrichDishes(merged.dishes);
  allDishes = enriched;
  dishesById = new Map(enriched.map((d) => [d.id, d]));
  allDishIds = enriched.map((d) => d.id);
}

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

// Merger fuer den Remote-Rezept-Import (Session 21).
//
// Regeln:
// 1. Bundled hat immer Vorrang. Remote-Dishes mit einer ID die bereits
//    bundled ist werden verworfen und ihre ID zurueckgegeben (staleRemoteIds),
//    damit der Caller State + Bild-Cache aufraeumen kann.
// 2. Analog fuer Ingredients: bundled Key bleibt, Remote-Kopie wird ignoriert.
//    Guardrail 8 (keine Duplikat-Zutaten) greift damit automatisch.
// 3. Remote-Dishes werden geskipped wenn sie auf einen Ingredient-Key
//    verweisen, der weder bundled noch remote ist. Warnung wird gesammelt.
//
// Rueckgabe:
//   { dishes: Dish[]           merged, ohne die geskippten
//   , ingredients: { key: Ing } merged, bundled hat Vorrang
//   , staleRemoteIds: number[] Remote-IDs die aus State/Cache raus muessen
//   , warnings: { id: number, name: string, missingKey: string }[]
//   }
//
// Verwendet KEINE globale State-Referenz — pure Funktion fuer Testbarkeit.
export function mergeRemote({ bundled, bundledIngredients, remoteDishes, remoteIngredients }) {
  const bundledIds = new Set(bundled.map((d) => d.id));
  const staleRemoteIds = [];
  const warnings = [];

  // Ingredients-Merger: bundled zuerst, dann Remote-Keys die nicht bundled sind.
  const ingredients = { ...bundledIngredients };
  for (const [key, ing] of Object.entries(remoteIngredients || {})) {
    if (!(key in ingredients)) ingredients[key] = ing;
  }

  // Dishes-Merger:
  const dishes = [...bundled];
  for (const d of remoteDishes || []) {
    if (bundledIds.has(d.id)) {
      staleRemoteIds.push(d.id);
      continue;
    }
    // Missing-Ingredient-Filter.
    const missing = (d.ingredients || []).find((ing) => !(ing.key in ingredients));
    if (missing) {
      warnings.push({ id: d.id, name: d.name, missingKey: missing.key });
      continue;
    }
    dishes.push(d);
  }

  return { dishes, ingredients, staleRemoteIds, warnings };
}

// isNewDish liefert true wenn die ID im aktuellen "Neu"-Batch ist.
// Consumer (Card, Picker-Filter) nutzen das. State-Zugriff erlaubt hier,
// weil das eine reine Getter-Konvention ist.
export function isNewDish(id) {
  return state.remoteNewIds instanceof Set && state.remoteNewIds.has(id);
}
