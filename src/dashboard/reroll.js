import { state, DAYS } from '../state.js';
import { allDishIds, dishesById, weightedShuffle } from '../data/dishes.js';
import { getEffectivePreferences, getEffectiveCuisines, dishCuisineVoteCount } from '../nutrition/preferences.js';
import { getTargetProfile } from '../nutrition/target.js';
import { optimizeAssignment, dayScopeFitness, NEIGHBOR_PENALTY } from './optimizer.js';

// Faktor für bevorzugte Küchen im Weighted-Shuffle. 3× ist spürbar (Bevorzugte
// tauchen sichtbar häufiger auf), lässt aber genug Raum für Vielfalt. Siehe
// docs/redesign/2026-07-26-session-9-plan.md für die Entscheidung.
const CUISINE_PREFERENCE_WEIGHT = 3;

// TAU steuert im refillBag wie stark die Fitness gegenueber dem Cuisine-
// Weight dominiert. exp(-(score-min)/TAU): TAU = 0.02 empirisch — Kandidaten
// mit doppelt so hohem Delta bekommen ~1/e = 37 % Gewicht. Klein genug damit
// Fitness fuehrt, gross genug damit Zufall drin bleibt.
const TAU = 0.02;

// Anzahl Historieneintraege die als previousIds-Filter im Optimizer wirken.
// Die restlichen History-Eintraege dienen NUR dem Wiederentdeckungs-Check
// (Wildcard-Einstreu — siehe unten).
const HISTORY_FILTER_LENGTH = 2;

// Gesamte Historien-Laenge. Aeltere Wochen werden nur zum Recency-Tracking
// genutzt, nicht mehr als previousIds gefiltert. So bleibt der Optimizer-
// Pool gross genug fuer Ziel-Naehe, gleichzeitig sehen wir welche Rezepte
// laenger nicht dran waren und koennen sie gezielt einstreuen.
const HISTORY_LENGTH = 6;

// Gewicht einer Dish-ID für den Weighted-Reroll bei Multi-User: proportional
// zur Anzahl der mitkochenden Diner, die diese cuisineGroup als Praeferenz
// gewaehlt haben. Basis 1, +CUISINE_PREFERENCE_WEIGHT pro Voter. Bei Solo /
// keine Prefs -> 1 fuer alle (Verhalten identisch zu shuffled()).
function cuisineWeight(id) {
  const dish = dishesById.get(id);
  if (!dish) return 1;
  const votes = dishCuisineVoteCount(dish);
  if (votes === 0) return 1;
  return 1 + votes * CUISINE_PREFERENCE_WEIGHT;
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
  const cuisines = getEffectiveCuisines();
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

// Zaehlt wie viele Nachbarn (Vortag/Nachtag) dieselbe proteinCategory haben
// wie das Kandidat-Rezept. Linear: Mo hat keinen linken Nachbarn, So keinen
// rechten. Max 2 Konflikte.
function neighborConflictsForDay(dishId, day) {
  const dish = dishesById.get(dishId);
  if (!dish || !dish.proteinCategory) return 0;
  const dayIdx = DAYS.indexOf(day);
  let conflicts = 0;
  for (const neighborIdx of [dayIdx - 1, dayIdx + 1]) {
    if (neighborIdx < 0 || neighborIdx >= DAYS.length) continue;
    const neighborDish = dishesById.get(state.assignment[DAYS[neighborIdx]]);
    if (neighborDish && neighborDish.proteinCategory === dish.proteinCategory) {
      conflicts++;
    }
  }
  return conflicts;
}

// Bag-Refill mit Fitness-Boost: Kandidaten die den Wochen-Kontext naeher
// an die Ziele bringen bekommen exponentielles Extra-Gewicht ontop des
// bestehenden Cuisine-Faktors. Fitness bezieht sich auf die aktuell
// markierten Tage plus den Reroll-Tag — der Ø den der User im
// Naehrstoff-Sheet sieht. Zufall bleibt drin: User kann mehrfach rollen
// bis was gefaellt.
function refillBag(day) {
  const currentId = state.assignment[day];
  const profile = getTargetProfile();
  const pool = eligibleDishIds().filter((id) => id !== currentId);

  // Scope: alle selected Tage + der Reroll-Tag. Bei 0 selected wird nur
  // dieser eine Tag gegen 1x dinnerTarget bewertet (Einzel-Rezept-Match).
  const selectedDays = DAYS.filter((d) => d !== day && state.selected[d]);
  const scopeDays = [...selectedDays, day];
  const dayCount = scopeDays.length;

  // Fitness pro Kandidat: wie gut waere der Wochen-Scope wenn dieser
  // Kandidat am Reroll-Tag landet.
  const scores = new Map();
  for (const id of pool) {
    const trial = {};
    for (const d of scopeDays) trial[d] = (d === day) ? id : state.assignment[d];
    scores.set(id, dayScopeFitness(trial, dayCount, profile));
  }
  const minScore = scores.size > 0 ? Math.min(...scores.values()) : 0;

  // Combined-Weight: (a) Cuisine-Bonus (1 oder 1+3xVoters), (b) Fitness-
  // Boost exp(-(score-minScore)/TAU), (c) Nachbarschafts-Penalty fuer
  // Kandidaten die dieselbe proteinCategory wie ein Nachbartag haetten.
  const combined = (id) => {
    const cuisine = cuisineWeight(id);
    const s = scores.get(id) ?? 0;
    const neighborPenalty = neighborConflictsForDay(id, day) * NEIGHBOR_PENALTY;
    const boost = Math.exp(-(s + neighborPenalty - minScore) / TAU);
    return cuisine * boost;
  };

  state.dishBag[day] = weightedShuffle(pool, combined);
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
  // Snapshot des aktuellen Assignments — wird nach dem Reroll in die History
  // geschoben. Vorherige Weeks (state.rerollHistory) tragen ebenfalls zu
  // previousIds bei.
  const oldAssignment = { ...state.assignment };
  const previousIds = new Set(Object.values(oldAssignment));
  for (const historyAssignment of state.rerollHistory.slice(0, HISTORY_FILTER_LENGTH)) {
    for (const id of Object.values(historyAssignment)) previousIds.add(id);
  }

  const pool = eligibleDishIds();
  let shuffledPool = weightedShuffle(pool, cuisineWeight).filter((id) => !previousIds.has(id));
  let optimizePool = pool.filter((id) => !previousIds.has(id));
  if (shuffledPool.length < DAYS.length) {
    // Fallback: nimm auch bekannte Gerichte, damit wir 7 zusammenbekommen.
    // Weighted bleibt aktiv — Praeferenzen sollen auch im Fallback wirken.
    shuffledPool = weightedShuffle(pool, cuisineWeight);
    optimizePool = pool;
  }

  // Random-Start (Cuisine-gewichtet, previousIds gemieden).
  const startAssignment = {};
  DAYS.forEach((day, i) => { startAssignment[day] = shuffledPool[i]; });

  // Ziel-orientierte Optimierung: Greedy-Swap gegen Wochen-Sollwerte.
  // optimizePool ohne previousIds — sonst tauscht der Optimizer die
  // Vermeidung wieder rein. Bei unvollstaendigem Profil greift
  // getTargetProfile auf Standard-Profil zurueck.
  const profile = getTargetProfile();
  let optimized = optimizeAssignment(startAssignment, optimizePool, profile);

  // Wildcard-Einstreu: 1 Rezept das in den letzten HISTORY_LENGTH Wochen nie
  // dran war (inklusive aktuellem Assignment) wird zufaellig in einen Slot
  // gesetzt, danach optimiert der Optimizer die anderen 6 Slots um das
  // gelockte Rezept herum. So kommt garantiert jede Woche ein "vergessenes"
  // Rezept zurueck, ohne die Woche komplett aus dem Ziel-Korridor zu werfen.
  const usedInRecency = new Set(Object.values(optimized));
  for (const historyAssignment of state.rerollHistory.slice(0, HISTORY_LENGTH)) {
    for (const id of Object.values(historyAssignment)) usedInRecency.add(id);
  }
  const forgotten = eligibleDishIds().filter((id) => !usedInRecency.has(id) && !Object.values(optimized).includes(id));

  if (forgotten.length > 0) {
    const wildcardId = forgotten[Math.floor(Math.random() * forgotten.length)];
    const targetDay = DAYS[Math.floor(Math.random() * DAYS.length)];
    const wildcardAssignment = { ...optimized, [targetDay]: wildcardId };
    const lockedDays = new Set([targetDay]);
    const finalPool = eligibleDishIds().filter((id) => !previousIds.has(id));
    const finalOptimizePool = finalPool.length >= DAYS.length ? finalPool : eligibleDishIds();
    optimized = optimizeAssignment(wildcardAssignment, finalOptimizePool, profile, { lockedDays });
  }

  DAYS.forEach((day) => {
    state.assignment[day] = optimized[day];
    state.selected[day] = false;
    // Portionen springen auf den User-Standard (settings.defaultPortions).
    state.portions[day] = state.settings.defaultPortions;
  });
  state.dishBag = {};

  // History aktualisieren: das alte Assignment wird "letzte Woche". Cap
  // auf HISTORY_LENGTH — aeltere Wochen fallen raus.
  state.rerollHistory.unshift(oldAssignment);
  while (state.rerollHistory.length > HISTORY_LENGTH) state.rerollHistory.pop();

  // checkedShopping bleibt unangetastet — bereits gekaufte Artikel bleiben
  // erhalten, auch wenn die neuen Gerichte sie evtl. nicht mehr enthalten
  // (dann als Leftover sichtbar). Fuer einen echten Reset gibt es den
  // separaten Reset-Button in der Einkaufsliste.
}
