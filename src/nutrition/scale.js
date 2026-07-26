import { getActiveProfile } from '../state.js';
import { dinnerTarget, dishScale, scaledGrams } from './target.js';

// State-abhängige Convenience-Wrapper: Kombinieren des aktuellen Profil-Ziels
// mit der reinen Skalierungslogik aus target.js. Consumer (Card, Detail-Sheet,
// Einkaufsliste, Wochen-Bar) brauchen so nur einen einzigen Aufruf, wenn sie
// den passenden Faktor für ein Gericht wollen.
export function getScaleForDish(dish) {
  const target = dinnerTarget(getActiveProfile());
  return dishScale(dish?.kcal, target);
}

// Wrapper für scaledGrams, der zusätzlich portions einbezieht. Multiplikator =
// portions × userScale — beide werden gemeinsam angewendet und bei diskreten
// Einheiten (Eier, Stück) auf ganze Stück gerundet.
export function scaledGramsForDay(ing, portions, dish) {
  const userScale = getScaleForDish(dish);
  return scaledGrams(ing, portions * userScale);
}
