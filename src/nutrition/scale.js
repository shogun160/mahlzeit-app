import { state, getActiveProfile } from '../state.js';
import { dinnerTarget, dishScale, scaledGrams } from './target.js';
import { dinersForPortion } from './diners.js';

// State-abhängige Convenience-Wrapper: Kombinieren des aktuellen Profil-Ziels
// mit der reinen Skalierungslogik aus target.js. Consumer (Card, Wochen-Bar,
// Detail-Sheet-Nährwerte) brauchen so nur einen einzigen Aufruf, wenn sie
// den passenden Faktor für ein Gericht wollen. Bezieht sich immer auf den
// AKTIVEN User — die Bedarfs-Anzeige folgt der activeProfileId, egal wieviele
// Personen mitkochen.
export function getScaleForDish(dish) {
  const target = dinnerTarget(getActiveProfile());
  return dishScale(dish?.kcal, target);
}

// Multi-Profile-Aggregat: Summe der Skalierungen aller teilnehmenden Diner.
// Wird fuer Kochmengen (Einkaufsliste, Detail-Sheet-Zutaten und -Naehrwerte)
// benoetigt — dort zaehlt was ALLE zusammen brauchen, nicht nur der aktive
// User.
//
// Beispiel: portions=3, profiles=[Oliver, Partner], DEFAULT_USER als Fueller:
//   totalFactor = scale(Oliver) + scale(Partner) + scale(DEFAULT_USER)
// Bei Solo (portions=1) reduziert es sich auf scale(activeProfile) — was
// dem alten Verhalten entspricht.
export function totalFactorForDish(dish, portions) {
  const kcal = dish?.kcal;
  const diners = dinersForPortion(portions, state.settings.profiles);
  return diners.reduce((sum, d) => sum + dishScale(kcal, dinnerTarget(d)), 0);
}

// Fuer die Naehrwert-Anzeige pro Person im Detail-Sheet: Array von
// {diner, scale, isDefault} pro teilnehmender Person. Reihenfolge entspricht
// den ersten N Profilen, danach DEFAULT_USER-Fueller. isDefault markiert
// die Fueller-Zeilen, damit sie im UI als "Gast" gelabelt werden koennen.
export function dinerScalesForDish(dish, portions) {
  const kcal = dish?.kcal;
  const diners = dinersForPortion(portions, state.settings.profiles);
  return diners.map((d) => ({
    diner: d,
    scale: dishScale(kcal, dinnerTarget(d)),
    isDefault: d.id === '_default',
  }));
}

// Wrapper für scaledGrams: rechnet die Kochmenge einer Zutat fuer die
// gegebene Personenzahl. Multi-Profile: aggregiert ueber alle Diner via
// totalFactorForDish. Bei diskreten Einheiten (Eier, Stück) wird auf ganze
// Stück gerundet.
export function scaledGramsForDay(ing, portions, dish) {
  return scaledGrams(ing, totalFactorForDish(dish, portions));
}

// Durchschnittlicher Skalierungsfaktor pro Person ueber alle mitkochenden
// Diner. Fuer die Karten-Anzeige (kcal/Makros je Karte) — der User will
// sehen was "eine durchschnittliche Portion" wiegt, nicht die kumulierte
// Gesamt-Kochmenge. Bei Solo = identisch zu getScaleForDish.
export function avgScaleForDish(dish, portions) {
  const n = Math.max(1, portions | 0);
  return totalFactorForDish(dish, n) / n;
}
