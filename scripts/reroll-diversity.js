// Vielfalt-Analyse fuer den Ziel-orientierten Reroll.
//
// Simuliert 10 sequenzielle Rerolls pro Makro-Profil (Fresh-Start ohne
// vorheriges Assignment, danach jeweils previousIds = letzte Woche wie im
// echten App-Verhalten). Zaehlt fuer jedes Rezept wie oft es in den 10
// Wochen gezogen wurde, listet auch nicht-gezogene auf.
//
// Aufruf: node scripts/reroll-diversity.js

import { allDishIds, dishesById, shuffled } from '../src/data/dishes.js';
import { optimizeAssignment } from '../src/dashboard/optimizer.js';
import { dinnerTarget, dinnerMacroTargets, dishScale } from '../src/nutrition/target.js';
import { DAYS } from '../src/state.js';

const ROUNDS = 10;

const PROFILES = [
  { label: 'Ausgewogen @ 2000',      daily: 2000, preset: 'balanced' },
  { label: 'Proteinreich @ 2400',    daily: 2400, preset: 'protein'  },
  { label: 'Kohlenhydratarm @ 1800', daily: 1800, preset: 'lowcarb'  },
  { label: 'Fettarm @ 2200',         daily: 2200, preset: 'lowfat'   },
];

function buildProfile(daily, preset) {
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

function weeklyDelta(assignment, profile) {
  const dinner = dinnerTarget(profile);
  const macros = dinnerMacroTargets(profile);
  const target = {
    kcal: dinner * DAYS.length,
    p:    macros.p * DAYS.length,
    kh:   macros.kh * DAYS.length,
    f:    macros.f * DAYS.length,
  };
  const actual = { kcal: 0, p: 0, kh: 0, f: 0 };
  for (const day of DAYS) {
    const dish = dishesById.get(assignment[day]);
    if (!dish) continue;
    const scale = dishScale(dish.kcal, dinner);
    actual.kcal += dish.kcal * scale;
    actual.p    += dish.p    * scale;
    actual.kh   += dish.kh   * scale;
    actual.f    += dish.f    * scale;
  }
  return {
    kcal: actual.kcal - target.kcal,
    p:    actual.p - target.p,
    kh:   actual.kh - target.kh,
    f:    actual.f - target.f,
    target,
  };
}

function simulate(profile) {
  const counts = new Map();
  for (const id of allDishIds) counts.set(id, 0);
  const weeklyDeltas = [];
  const weeklyConflicts = [];
  let history = [];
  let previousIds = new Set();

  for (let round = 0; round < ROUNDS; round++) {
    let shuffledPool = shuffled(allDishIds).filter((id) => !previousIds.has(id));
    let optimizePool = allDishIds.filter((id) => !previousIds.has(id));
    if (shuffledPool.length < DAYS.length) {
      shuffledPool = shuffled(allDishIds);
      optimizePool = allDishIds;
    }

    const start = {};
    DAYS.forEach((d, i) => { start[d] = shuffledPool[i]; });
    let optimized = optimizeAssignment(start, optimizePool, profile);

    // Wildcard-Einstreu wie in rerollAll.
    const usedInRecency = new Set(Object.values(optimized));
    for (const hist of history) {
      for (const id of Object.values(hist)) usedInRecency.add(id);
    }
    const forgotten = allDishIds.filter((id) => !usedInRecency.has(id));
    if (forgotten.length > 0) {
      const wildcardId = forgotten[Math.floor(Math.random() * forgotten.length)];
      const targetDay = DAYS[Math.floor(Math.random() * DAYS.length)];
      const wildcardAssignment = { ...optimized, [targetDay]: wildcardId };
      const lockedDays = new Set([targetDay]);
      let finalPool = allDishIds.filter((id) => !previousIds.has(id));
      if (finalPool.length < DAYS.length) finalPool = allDishIds;
      optimized = optimizeAssignment(wildcardAssignment, finalPool, profile, { lockedDays });
    }

    for (const day of DAYS) {
      const id = optimized[day];
      counts.set(id, counts.get(id) + 1);
    }
    weeklyDeltas.push(weeklyDelta(optimized, profile));

    // Nachbarschafts-Konflikte fuer diese Woche.
    let conflictsThisWeek = 0;
    for (let i = 0; i < DAYS.length - 1; i++) {
      const dishA = dishesById.get(optimized[DAYS[i]]);
      const dishB = dishesById.get(optimized[DAYS[i + 1]]);
      if (dishA && dishB && dishA.proteinCategory && dishA.proteinCategory === dishB.proteinCategory) {
        conflictsThisWeek++;
      }
    }
    weeklyConflicts.push(conflictsThisWeek);

    // History-Cap auf 6 (statt 2), previousIds aus ersten 2.
    history.unshift({ ...optimized });
    while (history.length > 6) history.pop();
    const oldAssignment = optimized;
    previousIds = new Set(Object.values(oldAssignment));
    for (const hist of history.slice(0, 2)) {
      for (const id of Object.values(hist)) previousIds.add(id);
    }
  }
  return { counts, weeklyDeltas, weeklyConflicts };
}

function printReport(label, counts, weeklyDeltas, weeklyConflicts) {
  const rows = [];
  for (const [id, count] of counts.entries()) {
    const dish = dishesById.get(id);
    rows.push({ id, name: dish ? dish.name : `#${id}`, count });
  }
  // Absteigend nach Count, dann nach Name.
  rows.sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const drawn = rows.filter((r) => r.count > 0);
  const missing = rows.filter((r) => r.count === 0);

  console.log(`\n=== ${label} ===`);
  console.log(`Insgesamt gezogen: ${total} Slots ueber ${ROUNDS} Wochen (${ROUNDS * DAYS.length} = ${ROUNDS} × ${DAYS.length})`);
  console.log(`Verschiedene Rezepte gezogen: ${drawn.length} / ${rows.length}`);
  console.log(`Nicht gezogen: ${missing.length}\n`);

  // Wochen-Abweichung vom Sollwert: min / max / Ø (signiert), Ø |absolut|.
  const target = weeklyDeltas[0].target;
  console.log('Wochen-Abweichung vom Sollwert (signiert: negativ = unter Soll):');
  console.log(`  Soll/Woche: kcal=${target.kcal.toFixed(0)}  P=${target.p.toFixed(0)}  KH=${target.kh.toFixed(0)}  F=${target.f.toFixed(0)}`);
  for (const metric of ['kcal', 'p', 'kh', 'f']) {
    const values = weeklyDeltas.map((d) => d[metric]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const absAvg = values.reduce((a, b) => a + Math.abs(b), 0) / values.length;
    const unit = metric === 'kcal' ? 'kcal' : 'g';
    console.log(
      `  ${metric.padEnd(4)}  min=${min.toFixed(1).padStart(8)}${unit}  max=${max.toFixed(1).padStart(8)}${unit}` +
      `  Ø=${avg.toFixed(1).padStart(8)}${unit}  Ø|Δ|=${absAvg.toFixed(1).padStart(7)}${unit}`,
    );
  }
  const totalConflicts = weeklyConflicts.reduce((a, b) => a + b, 0);
  const maxConflicts = Math.max(...weeklyConflicts);
  console.log(`Nachbarschafts-Konflikte: total ${totalConflicts} ueber ${ROUNDS} Wochen (max in einer Woche: ${maxConflicts}, Ø ${(totalConflicts/ROUNDS).toFixed(1)}/Woche)`);
  console.log('');

  console.log('Gezogene Rezepte (absteigend):');
  for (const r of drawn) {
    const pct = (r.count / total * 100).toFixed(1);
    console.log(`  ${String(r.count).padStart(3)}× (${pct.padStart(4)}%)  #${String(r.id).padStart(2)}  ${r.name}`);
  }

  if (missing.length > 0) {
    console.log('\nNie gezogen:');
    for (const r of missing) {
      console.log(`   0×          #${String(r.id).padStart(2)}  ${r.name}`);
    }
  }
}

console.log(`Ziel-Reroll Vielfalt-Analyse — ${ROUNDS} sequenzielle Rerolls pro Profil.`);
console.log(`Pool-Groesse: ${allDishIds.length} Rezepte.`);

for (const p of PROFILES) {
  const profile = buildProfile(p.daily, p.preset);
  const { counts, weeklyDeltas, weeklyConflicts } = simulate(profile);
  printReport(p.label, counts, weeklyDeltas, weeklyConflicts);
}
