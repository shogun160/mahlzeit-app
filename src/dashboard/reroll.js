import { state, DAYS } from '../state.js';
import { allDishIds, dishesById, weightedShuffle } from '../data/dishes.js';
import { getEffectivePreferences } from '../nutrition/preferences.js';

// Faktor für bevorzugte Küchen im Weighted-Shuffle. 3× ist spürbar (Bevorzugte
// tauchen sichtbar häufiger auf), lässt aber genug Raum für Vielfalt. Siehe
// docs/redesign/2026-07-26-session-9-plan.md für die Entscheidung.
const CUISINE_PREFERENCE_WEIGHT = 3;

// Gewicht einer Dish-ID für den Weighted-Reroll: 3, wenn dish.cuisineGroup
// einer aktiven Präferenz entspricht; sonst 1. Wenn keine Präferenz aktiv
// ist, gibt sie für alle 1 zurück → Verhalten identisch zu shuffled().
function cuisineWeight(id) {
  const dish = dishesById.get(id);
  if (!dish) return 1;
  const prefs = state.settings.cuisines || {};
  const anyActive = Object.values(prefs).some(Boolean);
  if (!anyActive) return 1;
  return prefs[dish.cuisineGroup] ? CUISINE_PREFERENCE_WEIGHT : 1;
}

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

// Gerichte, die den Filter des Users passieren. Zweistufige Fallback-Kaskade,
// damit der User sich nicht in einen leeren Pool klicken kann:
//   1. cooktime + diet + cuisine (Küche ist Hard-Filter, wenn aktiv)
//   2. cooktime + diet         (Küche gedroppt, wenn Stufe 1 < DAYS liefert)
//   3. allDishIds              (letzte Rettung — auch cooktime/diet gedroppt)
// Küche als Hard-Filter statt Weighted: bevorzugte Buckets liefern verbindlich,
// solange genug Kandidaten für die Woche existieren. Bei kleinen Buckets
// (z. B. "Amerika" mit nur 2 Rezepten und "vegetarisch" aktiv → evtl. 0 Treffer)
// greift Stufe 2 und `cuisineWeight` sorgt im Weighted-Shuffle weiter dafür,
// dass die bevorzugten Küchen wenigstens tendenziell nach vorne kommen.
// Export weil auch beim Erst-Auslosen (pickInitialAssignment) genutzt.
export function eligibleDishIds() {
  const maxTime = state.settings.maxCookTime;
  const prefs = getEffectivePreferences();
  const cuisines = state.settings.cuisines || {};
  const activeCuisines = Object.keys(cuisines).filter((k) => cuisines[k]);

  const withoutCuisine = allDishIds.filter((id) => {
    const dish = dishesById.get(id);
    if (!dish) return false;
    if (dish.cooktime > maxTime) return false;
    return matchesPreferences(dish, prefs);
  });

  if (activeCuisines.length === 0) {
    return withoutCuisine.length >= DAYS.length ? withoutCuisine : allDishIds;
  }

  const withCuisine = withoutCuisine.filter((id) => {
    const dish = dishesById.get(id);
    return activeCuisines.includes(dish.cuisineGroup);
  });
  if (withCuisine.length >= DAYS.length) return withCuisine;
  if (withoutCuisine.length >= DAYS.length) return withoutCuisine;
  return allDishIds;
}

// Baut den Card-spezifischen Bag neu: alle IDs außer der aktuell auf DIESER Karte gezeigten,
// zufällig geordnet — nur aus dem eligible Pool (Kochzeit-Filter greift auch beim Reroll).
function refillBag(day) {
  const currentId = state.assignment[day];
  state.dishBag[day] = weightedShuffle(eligibleDishIds(), cuisineWeight).filter((id) => id !== currentId);
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
  // Tag auf inaktiv setzen: beim Reroll (unbewusste Änderung) will der User
  // typisch nicht dass das neue Rezept sofort im Einkaufskorb landet. Wenn er
  // das neue Gericht behalten möchte, kann er den Tag manuell anhaken oder
  // gezielt via Picker wählen (der setzt selected = true automatisch).
  // Wichtig: checkedShopping bleibt unangetastet — gekaufte Artikel bleiben
  // gekauft. Nicht-abgehakte Zutaten des alten Rezepts verschwinden ohnehin,
  // weil der Tag nicht mehr in der Consolidated-List zählt.
  state.selected[day] = false;
}

export function rerollAll() {
  const previousIds = new Set(Object.values(state.assignment));
  const pool = eligibleDishIds();
  let shuffledPool = weightedShuffle(pool, cuisineWeight).filter((id) => !previousIds.has(id));
  if (shuffledPool.length < DAYS.length) {
    // Fallback: nimm auch bekannte Gerichte, damit wir 7 zusammenbekommen.
    // Weighted bleibt aktiv — Präferenzen sollen auch im Fallback wirken.
    shuffledPool = weightedShuffle(pool, cuisineWeight);
  }
  DAYS.forEach((day, i) => {
    state.assignment[day] = shuffledPool[i];
    state.selected[day] = false;
    // Portionen springen auf den User-Standard (settings.defaultPortions).
    state.portions[day] = state.settings.defaultPortions;
  });
  state.dishBag = {};
  // checkedShopping bleibt unangetastet — bereits gekaufte Artikel bleiben
  // erhalten, auch wenn die neuen Gerichte sie evtl. nicht mehr enthalten
  // (dann als Leftover sichtbar). Für einen echten Reset gibt es den
  // separaten Reset-Button in der Einkaufsliste.
}
