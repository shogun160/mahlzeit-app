// Ziel-orientierter Reroll: reine Funktionen fuer Fitness-Score und
// Greedy-Swap-Optimierung. Reine Funktionen ohne Zugriff auf laufzeitlichen State.
// Der Consumer (reroll.js) reicht Assignment-Snapshot und Ziel-Profil rein. DAYS ist
// eine unveraenderliche Konstante (kein State-Zugriff zur Laufzeit).
//
// Fitness ist die Summe quadrierter, normalisierter Deltas ueber vier
// Metriken (kcal, P, KH, F) gegen dayCount × Ziel. Kleiner = besser.

import { DAYS } from '../state.js';
import { dishesById } from '../data/dishes.js';
import { dinnerTarget, dinnerMacroTargets, dishScale } from '../nutrition/target.js';

// Toleranz fuer den Swap-Loop: unter allen verbessernden Kandidaten wird
// zufaellig einer aus dem Toleranzband gewaehlt. Ohne diesen Random-Anteil
// terminiert der Greedy-Swap immer im selben lokalen Optimum — jeder
// Reroll liefert dieselben Gerichte. 15 % Toleranz statt 5 % akzeptiert
// eine kleine Ziel-Naehe-Einbusse, kauft dafuer deutlich mehr Vielfalt:
// der Optimizer waehlt bei jedem Swap aus einem breiteren Kandidatenfeld,
// was unterschiedliche Wochen-Lineups auch bei stark biased Presets ergibt.
const SWAP_TOLERANCE = 0.15;

// Penalty pro Nachbarschafts-Konflikt (Vortag oder Nachtag hat dieselbe
// proteinCategory). Wird ins Fitness-Score addiert. Linear ueber die Woche
// (Mo hat nur Nachbar Di, So nur Nachbar Sa) — max 6 Konflikte, max 0.6
// Score-Delta. Klein genug damit die 4 Kernmetriken (kcal, P, KH, F) fuehren,
// gross genug damit Nachbarschafts-Ausgleich sichtbar wird.
export const NEIGHBOR_PENALTY = 0.1;

// Fitness gegen dayCount × Ziel. Verwendet vom rerollDay-Boost mit dem
// aktuellen Selected-Scope, und von weekFitness (dayCount = 7).
export function dayScopeFitness(assignment, dayCount, profile) {
  const dinner = dinnerTarget(profile);
  const macros = dinnerMacroTargets(profile);
  if (!dinner || !macros) return 0;

  const target = {
    kcal: dinner * dayCount,
    p:    macros.p * dayCount,
    kh:   macros.kh * dayCount,
    f:    macros.f * dayCount,
  };

  let actual = { kcal: 0, p: 0, kh: 0, f: 0 };
  for (const day of Object.keys(assignment)) {
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

// Zaehlt Nachbarschafts-Konflikte im Assignment. Linear: Mo hat Nachbar Di,
// So hat Nachbar Sa (kein Wrap-around). Zaehlt Paare — bei gleicher Kategorie
// in Mo+Di gibt es EIN Konflikt-Paar, nicht zwei. So kommen wir auf max 6
// (bei allen 6 Paaren gleiche Kategorie).
function countNeighborConflicts(assignment) {
  let conflicts = 0;
  for (let i = 0; i < DAYS.length - 1; i++) {
    const dishA = dishesById.get(assignment[DAYS[i]]);
    const dishB = dishesById.get(assignment[DAYS[i + 1]]);
    if (!dishA || !dishB) continue;
    if (dishA.proteinCategory && dishA.proteinCategory === dishB.proteinCategory) {
      conflicts++;
    }
  }
  return conflicts;
}

// Wochen-Fitness fuer rerollAll: dayCount = 7. Addiert Nachbarschafts-Penalty
// ontop der 4 Metrik-Fitness — dayScopeFitness bleibt sauber.
export function weekFitness(assignment, profile) {
  const base = dayScopeFitness(assignment, DAYS.length, profile);
  const penalty = countNeighborConflicts(assignment) * NEIGHBOR_PENALTY;
  return base + penalty;
}

// Greedy Swap: startet vom aktuellen Assignment, prueft fuer jeden Tag ob
// ein Tausch gegen einen Pool-Kandidaten die Wochen-Fitness verbessert.
// Pro Tag werden alle verbessernden Kandidaten gesammelt; aus dem Toleranz-
// band (SWAP_TOLERANCE relativ zum besten) wird zufaellig einer gewaehlt —
// das verhindert, dass der Loop immer im selben lokalen Optimum landet.
// Terminiert frueh, wenn eine ganze Runde keine Verbesserung mehr bringt.
//
// - assignment: { [day]: dishId } — Start-Assignment, wird nicht mutiert
// - pool: number[] — eligible Dish-IDs (Kochzeit + Diaet + Cuisine gefiltert)
// - profile: Target-Profil (via getTargetProfile im Aufrufer)
// - options.maxRounds: Sicherheits-Cap, praktisch nach 3-8 Runden fertig
// - options.lockedDays: Set<string> von Tagen die NICHT geswappt werden
//   duerfen. Genutzt vom Wiederentdeckungs-Mechanismus: der Wildcard-Slot
//   bleibt fix, damit die anderen 6 Slots sich um ihn herum optimieren.
export function optimizeAssignment(assignment, pool, profile, options = {}) {
  const { maxRounds = 50, lockedDays = new Set() } = options;
  const current = { ...assignment };
  let bestScore = weekFitness(current, profile);
  if (bestScore === 0) return current; // Perfektes Match — Loop unnoetig.

  for (let round = 0; round < maxRounds; round++) {
    let improvedThisRound = false;
    for (const day of DAYS) {
      if (lockedDays.has(day)) continue;
      const currentUsed = new Set(Object.values(current));
      currentUsed.delete(current[day]);

      // Alle Kandidaten sammeln die den aktuellen Score verbessern.
      const improvers = [];
      for (const candidateId of pool) {
        if (candidateId === current[day]) continue;
        if (currentUsed.has(candidateId)) continue;
        const trial = { ...current, [day]: candidateId };
        const trialScore = weekFitness(trial, profile);
        if (trialScore < bestScore) {
          improvers.push({ id: candidateId, score: trialScore });
        }
      }

      if (improvers.length === 0) continue;

      // Toleranzband: alle Kandidaten deren Score max SWAP_TOLERANCE
      // relativ zum besten schlechter sind. Zufaellig einen waehlen.
      improvers.sort((a, b) => a.score - b.score);
      const minCandScore = improvers[0].score;
      const acceptable = improvers.filter((c) => {
        const denom = Math.max(Math.abs(minCandScore), 0.0001);
        return (c.score - minCandScore) / denom <= SWAP_TOLERANCE;
      });
      const pick = acceptable[Math.floor(Math.random() * acceptable.length)];
      current[day] = pick.id;
      bestScore = pick.score;
      improvedThisRound = true;
    }
    if (!improvedThisRound) break;
  }
  return current;
}
