// Ziel-orientierter Reroll: reine Funktionen fuer Fitness-Score und
// Greedy-Swap-Optimierung. Kein Import aus state.js — Consumer (reroll.js)
// reichen den aktuellen Assignment-Snapshot und das Ziel-Profil rein.
//
// Fitness ist die Summe quadrierter, normalisierter Deltas ueber vier
// Metriken (kcal, P, KH, F) gegen dayCount × Ziel. Kleiner = besser.

import { DAYS } from '../state.js';
import { dishesById } from '../data/dishes.js';
import { dinnerTarget, effectiveMacroTargets, dishScale } from '../nutrition/target.js';

// Fitness gegen dayCount × Ziel. Verwendet vom rerollDay-Boost mit dem
// aktuellen Selected-Scope, und von weekFitness (dayCount = 7).
export function dayScopeFitness(assignment, dayCount, profile) {
  const dinner = dinnerTarget(profile);
  const macros = effectiveMacroTargets(profile);
  if (!dinner || !macros) return 0;

  const target = {
    kcal: dinner * dayCount,
    p:    macros.p * dayCount,
    kh:   macros.kh * dayCount,
    f:    macros.f * dayCount,
  };

  let actual = { kcal: 0, p: 0, kh: 0, f: 0 };
  for (const day in assignment) {
    const dish = dishesById.get(assignment[day]);
    if (!dish) continue;
    const scale = dishScale(dish.kcal, dinner);
    actual.kcal += dish.kcal * scale;
    actual.p    += dish.p    * scale;
    actual.kh   += dish.kh   * scale;
    actual.f    += dish.f    * scale;
  }

  const deltaSq = (a, t) => {
    if (t === 0) return 0;
    const d = (a - t) / t;
    return d * d;
  };
  return deltaSq(actual.kcal, target.kcal)
       + deltaSq(actual.p,    target.p)
       + deltaSq(actual.kh,   target.kh)
       + deltaSq(actual.f,    target.f);
}

// Wochen-Fitness fuer rerollAll: dayCount = 7.
export function weekFitness(assignment, profile) {
  return dayScopeFitness(assignment, DAYS.length, profile);
}

// Greedy Swap: startet vom aktuellen Assignment, prueft fuer jeden Tag ob
// ein Tausch gegen einen Pool-Kandidaten die Wochen-Fitness verbessert.
// Deterministisch (kein Zufall im Loop, nur im Start-Assignment). Terminiert
// frueh, wenn eine ganze Runde keine Verbesserung mehr bringt.
//
// - assignment: { [day]: dishId } — Start-Assignment, wird nicht mutiert
// - pool: number[] — eligible Dish-IDs (Kochzeit + Diaet + Cuisine gefiltert)
// - profile: Target-Profil (via getTargetProfile im Aufrufer)
// - maxRounds: Sicherheits-Cap, praktisch nach 3-8 Runden fertig
export function optimizeAssignment(assignment, pool, profile, maxRounds = 50) {
  const current = { ...assignment };
  let bestScore = weekFitness(current, profile);
  if (bestScore === 0) return current;

  for (let round = 0; round < maxRounds; round++) {
    let improvedThisRound = false;
    for (const day of DAYS) {
      const currentUsed = new Set(Object.values(current));
      currentUsed.delete(current[day]);
      for (const candidateId of pool) {
        if (candidateId === current[day]) continue;
        if (currentUsed.has(candidateId)) continue;
        const trial = { ...current, [day]: candidateId };
        const trialScore = weekFitness(trial, profile);
        if (trialScore < bestScore) {
          current[day] = candidateId;
          bestScore = trialScore;
          improvedThisRound = true;
        }
      }
    }
    if (!improvedThisRound) break;
  }
  return current;
}
