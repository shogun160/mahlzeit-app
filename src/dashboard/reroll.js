import { state, DAYS } from '../state.js';
import { allDishIds, dishesById, shuffled } from '../data/dishes.js';

// Prüft, ob ein Dish alle aktiven Ernährungspräferenzen erfüllt.
// vegan/vegetarian sind stärkere Über-Filter (schließen mehrere contains-Tags
// gleichzeitig aus), die einzelnen noMeat/noFish-Flags bleiben aber unabhängig
// aktivierbar für User, die z. B. nur Fleisch weglassen wollen.
// Semantik der Ernährungspräferenzen (identisch zum Picker): Diät-Gruppe
// (meat/fish/vegetarian) = OR-Verknüpfung. Wenn eine oder mehrere aktiv,
// muss Dish mindestens eine erfüllen. Keine aktiv = neutral (jedes Dish).
function matchesPreferences(dish, prefs) {
  const tags = dish.tags || [];
  const has = (t) => tags.includes(t);
  const isMeat = has('contains-meat');
  const isFish = has('contains-fish');
  const isVeg  = !isMeat && !isFish;

  const dietChecks = [];
  if (prefs.meat)       dietChecks.push(isMeat);
  if (prefs.fish)       dietChecks.push(isFish);
  if (prefs.vegetarian) dietChecks.push(isVeg);
  if (dietChecks.length > 0 && !dietChecks.some(Boolean)) return false;

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
  // Selection bewusst NICHT resetten — wenn der Tag schon für die Einkaufsliste
  // angehakt war, bleibt er das auch beim Gericht-Wechsel. Nur rerollAll (kompletter
  // Neustart) leert die Selection global.
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
