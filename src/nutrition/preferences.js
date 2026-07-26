import { state, getActiveProfile } from '../state.js';

const CUISINE_KEYS = ['asian', 'mediterranean', 'middleEast', 'americas'];

function activeDiners() {
  const profiles = state.settings.profiles ?? [];
  const n = Math.max(1, state.settings.defaultPortions ?? 1);
  return profiles.slice(0, n);
}

// Ermittelt die effektiven Diaet-Prefs fuer den Dish-Picker + Reroll bei
// Multi-User-Kochen. Regel:
//   1) Schnittmenge der Diaet-Prefs aller mitkochenden Profile (erste N =
//      state.settings.defaultPortions) — nur Diaeten, die ALLE gemeinsam
//      selektiert haben, sind vorausgewaehlt.
//   2) Wenn Schnitt leer -> Fallback auf Diaet-Prefs des aktiven Users
//      (profiles[0]). Beispiel: User 1 Fleisch, User 2 Fisch, User 3
//      vegetarisch -> Schnitt leer -> Fleisch (weil User 1 aktiv).
//   3) Wenn auch der aktive User keine Prefs gesetzt hat -> leeres Set
//      (Filter neutral, alle Dishes erlaubt).
//
// Rueckgabe: { meat: boolean, fish: boolean, vegetarian: boolean }.
export function getEffectivePreferences() {
  const diners = activeDiners();
  const keys = ['meat', 'fish', 'vegetarian'];

  const anyDeclared = diners.some((p) => keys.some((k) => p.preferences?.[k]));
  if (!anyDeclared) {
    // Kein Diner hat irgendwas gewaehlt -> weiter mit aktivem Profil
    // (falls der irgendwas hat) oder leerem Set.
    const active = getActiveProfile();
    return {
      meat: !!active.preferences?.meat,
      fish: !!active.preferences?.fish,
      vegetarian: !!active.preferences?.vegetarian,
    };
  }

  // Schnitt: eine Pref ist "im Konsens" wenn ALLE Diner die entweder
  // aktiv haben ODER gar keine Diaet-Prefs deklariert haben (dann sind sie
  // "egal" und blockieren den Konsens nicht). Diner mit deklarierten Prefs
  // muessen die spezifische Pref selektiert haben.
  const intersection = {};
  for (const k of keys) {
    intersection[k] = diners.every((p) => {
      const hasAnyPref = keys.some((kk) => p.preferences?.[kk]);
      if (!hasAnyPref) return true; // Diner ohne Prefs blockiert nicht
      return !!p.preferences?.[k];
    });
  }

  const intersectionEmpty = keys.every((k) => !intersection[k]);
  if (!intersectionEmpty) return intersection;

  // Fallback: Prefs des aktiven Users.
  const active = getActiveProfile();
  return {
    meat: !!active.preferences?.meat,
    fish: !!active.preferences?.fish,
    vegetarian: !!active.preferences?.vegetarian,
  };
}

// Kuechen-Prefs: Union aller mitkochenden Profile. Anders als bei Diaet-Prefs
// KEIN Schnitt — wenn irgendein Diner eine Kueche moechte, ist sie im Filter
// aktiviert. Reihenfolge im Picker: Dishes mit meisten Voter-Uebereinstimmungen
// oben (siehe dishCuisineVoteCount).
export function getEffectiveCuisines() {
  const diners = activeDiners();
  const union = {};
  for (const k of CUISINE_KEYS) {
    union[k] = diners.some((p) => !!p.cuisines?.[k]);
  }
  return union;
}

// Wie viele der mitkochenden Diner haben die cuisineGroup dieses Dishes als
// Praeferenz selektiert? Basis fuer das Ranking im Dish-Picker (mehr Voter =
// weiter oben). Return 0 wenn niemand die Kueche gewaehlt hat.
export function dishCuisineVoteCount(dish) {
  if (!dish?.cuisineGroup) return 0;
  const diners = activeDiners();
  let count = 0;
  for (const p of diners) {
    if (p.cuisines?.[dish.cuisineGroup]) count++;
  }
  return count;
}

// Favoriten-Union: true wenn IRGENDEIN mitkochender Diner dieses Dish als
// Favorit markiert hat. Genutzt als Filter-Test im Dish-Picker (Chip
// "Favoriten"). Herz-Icon auf Karten/Sheets zeigt weiter isFavorite() —
// das ist die persoenliche Markierung des aktiven Users.
export function isFavoriteAnyDiner(dishId) {
  const diners = activeDiners();
  return diners.some((p) => !!p.favorites?.[dishId]);
}

// Anzahl der mitkochenden Diner, die dieses Dish favorisieren. Basis fuer
// das Ranking im Dish-Picker: mehr Likes -> weiter oben. Return 0 wenn
// niemand.
export function favoriteLikesCount(dishId) {
  const diners = activeDiners();
  let count = 0;
  for (const p of diners) {
    if (p.favorites?.[dishId]) count++;
  }
  return count;
}
