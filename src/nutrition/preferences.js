import { state, getActiveProfile } from '../state.js';

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
  const profiles = state.settings.profiles ?? [];
  const n = Math.max(1, state.settings.defaultPortions ?? 1);
  // Nur echte Profile, keine DEFAULT_USER-Fueller — Gaeste haben keine
  // deklarierten Prefs, sollen die Auswahl nicht einschraenken.
  const diners = profiles.slice(0, n);
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
