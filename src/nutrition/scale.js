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

// Aromageber-Einheiten die bei Multi-Person-Skalierung gedaempft werden:
// bund (Petersilie, Fruehlingszwiebel), el/tl (Oele, Sauce, Gewuerze,
// Paste). 8 EL Oel fuer 8 Personen laeuft ueber die Pfanne — sqrt-Daempfung
// bringt das auf ~3 EL. Fuer 1 Person keine Aenderung.
function shouldDampPortions(ing) {
  return ing.unit === 'bund' || ing.displayUnit === 'el' || ing.displayUnit === 'tl';
}

// Wrapper für scaledGrams: rechnet die Kochmenge einer Zutat fuer die
// gegebene Personenzahl. Multi-Profile: aggregiert ueber alle Diner via
// totalFactorForDish. Bei diskreten Einheiten (Eier, Stück) wird auf ganze
// Stück gerundet. Aromageber (bund/el/tl) werden mit sqrt gedaempft —
// bei 4 Personen nur ~2x statt 4x, weil Kraeuter/Oele/Gewuerze nicht
// linear mitwachsen muessen. Dishscale (kcal-Ziel) bleibt ungedaempft.
export function scaledGramsForDay(ing, portions, dish) {
  const totalFactor = totalFactorForDish(dish, portions);
  const damping = shouldDampPortions(ing) && portions > 1
    ? Math.sqrt(portions) / portions
    : 1;
  return scaledGrams(ing, totalFactor * damping);
}

// Durchschnittlicher Skalierungsfaktor pro Person ueber alle mitkochenden
// Diner. Fuer die Karten-Anzeige (kcal/Makros je Karte) — der User will
// sehen was "eine durchschnittliche Portion" wiegt, nicht die kumulierte
// Gesamt-Kochmenge. Bei Solo = identisch zu getScaleForDish.
export function avgScaleForDish(dish, portions) {
  const n = Math.max(1, portions | 0);
  return totalFactorForDish(dish, n) / n;
}
