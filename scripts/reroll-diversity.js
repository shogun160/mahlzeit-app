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

function simulate(profile) {
  const counts = new Map();
  for (const id of allDishIds) counts.set(id, 0);
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
    const optimized = optimizeAssignment(start, optimizePool, profile);

    for (const day of DAYS) {
      const id = optimized[day];
      counts.set(id, counts.get(id) + 1);
    }

    // History-Logic wie in rerollAll: letztes Assignment in History schieben,
    // previousIds aus aktuellem + alle History-Assignments aufbauen.
    history.unshift({ ...optimized });
    while (history.length > 2) history.pop();
    const oldAssignment = optimized;
    previousIds = new Set(Object.values(oldAssignment));
    for (const hist of history) {
      for (const id of Object.values(hist)) previousIds.add(id);
    }
  }
  return counts;
}

function printReport(label, counts) {
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
  const counts = simulate(profile);
  printReport(p.label, counts);
}
