import { state, DAYS } from '../state.js';
import { allDishIds, dishesById, shuffled } from '../data/dishes.js';

// Prüft, ob ein Dish alle aktiven Ernährungspräferenzen erfüllt.
// vegan/vegetarian sind stärkere Über-Filter (schließen mehrere contains-Tags
// gleichzeitig aus), die einzelnen noMeat/noFish-Flags bleiben aber unabhängig
// aktivierbar für User, die z. B. nur Fleisch weglassen wollen.
function matchesPreferences(dish, prefs) {
  const tags = dish.tags || [];
  const has = (t) => tags.includes(t);
  if (prefs.noMeat && has('contains-meat')) return false;
  if (prefs.noFish && has('contains-fish')) return false;
  if (prefs.lactoseFree && has('contains-lactose')) return false;
  if (prefs.glutenFree && has('contains-gluten')) return false;
  if (prefs.vegetarian && (has('contains-meat') || has('contains-fish'))) return false;
  if (prefs.vegan && (has('contains-meat') || has('contains-fish') || has('contains-lactose') || has('contains-egg'))) return false;
  return true;
}

// Gerichte, die den Filter des Users passieren (Kochzeit + Ernährungspräferenzen).
// Falls die Filter-Regel zu wenige Kandidaten für 7 Tage lässt, fallen wir auf
// das komplette Dish-Set zurück — sonst könnte der User sich in einen Zustand
// klicken, in dem gar kein Reroll mehr möglich ist.
// Export weil auch beim Erst-Auslosen (pickInitialAssignment) genutzt.
export function eligibleDishIds() {
  const maxTime = state.settings.maxCookTime;
  const prefs = state.settings.preferences || {};
  const filtered = allDishIds.filter((id) => {
    const dish = dishesById.get(id);
    if (!dish) return false;
    if (dish.cooktime > maxTime) return false;
    return matchesPreferences(dish, prefs);
  });
  return filtered.length >= DAYS.length ? filtered : allDishIds;
}

// Baut den Card-spezifischen Bag neu: alle IDs außer der aktuell auf DIESER Karte gezeigten,
// zufällig geordnet — nur aus dem eligible Pool (Kochzeit-Filter greift auch beim Reroll).
function refillBag(day) {
  const currentId = state.assignment[day];
  state.dishBag[day] = shuffled(eligibleDishIds()).filter((id) => id !== currentId);
}

export function rerollDay(day) {
  const usedElsewhere = new Set(
    DAYS.filter((d) => d !== day).map((d) => state.assignment[d]),
  );

  if (!state.dishBag[day] || state.dishBag[day].length === 0) {
    refillBag(day);
  }

  let pick = null;
  for (let attempt = 0; attempt < 2 && pick === null; attempt++) {
    while (state.dishBag[day].length > 0) {
      const candidate = state.dishBag[day].shift();
      if (!usedElsewhere.has(candidate)) {
        pick = candidate;
        break;
      }
    }
    if (pick === null) {
      refillBag(day);
    }
  }
  if (pick === null) return;

  state.assignment[day] = pick;
  state.selected[day] = false;
}

export function rerollAll() {
  const previousIds = new Set(Object.values(state.assignment));
  const pool = eligibleDishIds();
  let shuffledPool = shuffled(pool).filter((id) => !previousIds.has(id));
  if (shuffledPool.length < DAYS.length) {
    // Fallback: nimm auch bekannte Gerichte, damit wir 7 zusammenbekommen.
    shuffledPool = shuffled(pool);
  }
  DAYS.forEach((day, i) => {
    state.assignment[day] = shuffledPool[i];
    state.selected[day] = false;
    // Portionen springen auf den User-Standard (settings.defaultPortions).
    state.portions[day] = state.settings.defaultPortions;
  });
  state.dishBag = {};
}
