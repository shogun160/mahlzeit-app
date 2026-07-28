// Sanity-Script fuer den Ziel-orientierten Reroll.
//
// Simuliert 100x rerollAll fuer mehrere Profile-Konstellationen und printet
// Vorher/Nachher-Delta-Statistik. "Vorher" = nur Random-Start (aktuelles
// Verhalten pre-Session-27), "Nachher" = Random-Start + Greedy-Swap.
//
// Aufruf: node scripts/reroll-sanity.js

import { allDishes, allDishIds, dishesById, weightedShuffle, shuffled } from '../src/data/dishes.js';
import { dinnerTarget, effectiveMacroTargets, dishScale } from '../src/nutrition/target.js';
import { weekFitness, optimizeAssignment } from '../src/dashboard/optimizer.js';
import { DAYS } from '../src/state.js';

const SIMULATIONS = 100;

// Profile-Konstellationen: verschiedene Presets + Tageskalorien.
// dailyTargetOverride setzt den Wochen-kcal-Bezug fix, macroPreset
// legt die Makro-Verteilung fest.
const PROFILES = [
  { label: 'Ausgewogen @ 2000',    daily: 2000, preset: 'balanced' },
  { label: 'Proteinreich @ 2400',  daily: 2400, preset: 'protein' },
  { label: 'Kohlenhydratarm @ 1800', daily: 1800, preset: 'lowcarb' },
  { label: 'Fettarm @ 2200',       daily: 2200, preset: 'lowfat' },
];

function buildProfile(daily, preset) {
  // Vollstaendiges Profil-Objekt fuer target.js. dinnerKcalOverride wird
  // NICHT gesetzt — dinnerTarget rechnet dann auf DINNER_STANDARD_SHARE
  // (35 %) des daily.
  return {
    gender: 'male',
    age: 40,
    heightCm: 180,
    weightKg: 80,
    activityLevel: 3,
    goal: 'maintain',
    dailyTargetOverride: daily,
    breakfastKcal: null,
    lunchKcal: null,
    dinnerKcalOverride: null,
    macroPreset: preset,
    macroTargets: null,
  };
}

function randomStart(pool) {
  const assignment = {};
  const shuffledPool = shuffled(pool);
  DAYS.forEach((day, i) => { assignment[day] = shuffledPool[i]; });
  return assignment;
}

function assignmentTotals(assignment, profile) {
  const dinner = dinnerTarget(profile);
  let kcal = 0, p = 0, kh = 0, f = 0;
  for (const day in assignment) {
    const dish = dishesById.get(assignment[day]);
    if (!dish) continue;
    const scale = dishScale(dish.kcal, dinner);
    kcal += dish.kcal * scale;
    p    += dish.p    * scale;
    kh   += dish.kh   * scale;
    f    += dish.f    * scale;
  }
  return { kcal, p, kh, f };
}

function targets(profile) {
  const dinner = dinnerTarget(profile);
  const macros = effectiveMacroTargets(profile);
  return {
    kcal: dinner * DAYS.length,
    p:    macros.p * DAYS.length,
    kh:   macros.kh * DAYS.length,
    f:    macros.f * DAYS.length,
  };
}

function absDelta(actual, target) {
  return {
    kcal: Math.abs(actual.kcal - target.kcal),
    p:    Math.abs(actual.p - target.p),
    kh:   Math.abs(actual.kh - target.kh),
    f:    Math.abs(actual.f - target.f),
  };
}

function stat(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    avg: sum / values.length,
    median: sorted[Math.floor(sorted.length / 2)],
    max: sorted[sorted.length - 1],
  };
}

function runSimulation(profile, pool) {
  const t = targets(profile);
  const before = { kcal: [], p: [], kh: [], f: [] };
  const after  = { kcal: [], p: [], kh: [], f: [] };

  for (let i = 0; i < SIMULATIONS; i++) {
    const start = randomStart(pool);
    const startTotals = assignmentTotals(start, profile);
    const startDelta = absDelta(startTotals, t);
    before.kcal.push(startDelta.kcal);
    before.p.push(startDelta.p);
    before.kh.push(startDelta.kh);
    before.f.push(startDelta.f);

    const optimized = optimizeAssignment(start, pool, profile);
    const optTotals = assignmentTotals(optimized, profile);
    const optDelta = absDelta(optTotals, t);
    after.kcal.push(optDelta.kcal);
    after.p.push(optDelta.p);
    after.kh.push(optDelta.kh);
    after.f.push(optDelta.f);
  }

  return { before, after, targets: t };
}

function printReport(label, result) {
  console.log(`\n=== ${label} ===`);
  console.log(`Ziel/Woche: kcal=${result.targets.kcal.toFixed(0)}  P=${result.targets.p.toFixed(0)}  KH=${result.targets.kh.toFixed(0)}  F=${result.targets.f.toFixed(0)}`);
  for (const metric of ['kcal', 'p', 'kh', 'f']) {
    const b = stat(result.before[metric]);
    const a = stat(result.after[metric]);
    const improvement = b.avg > 0 ? ((b.avg - a.avg) / b.avg * 100).toFixed(1) : '0.0';
    console.log(
      `${metric.padEnd(4)}  vorher Ø=${b.avg.toFixed(1)} med=${b.median.toFixed(1)} max=${b.max.toFixed(1)}` +
      `  nachher Ø=${a.avg.toFixed(1)} med=${a.median.toFixed(1)} max=${a.max.toFixed(1)}` +
      `  Verbesserung Ø: ${improvement}%`,
    );
  }
}

// Main
console.log(`Ziel-Reroll Sanity — ${SIMULATIONS} Simulationen pro Profil.`);
console.log(`Pool-Groesse (eligible ohne Filter): ${allDishIds.length} Rezepte.`);

const pool = allDishIds;
for (const p of PROFILES) {
  const profile = buildProfile(p.daily, p.preset);
  const result = runSimulation(profile, pool);
  printReport(p.label, result);
}
