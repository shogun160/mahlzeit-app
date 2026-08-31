// Sanity-Simulation fuer state.js — nur die Remote-Slot-Persistenz.
// Aufruf: `node src/state.test.mjs`. Exit != 0 bei Fehler.
//
// Nutzt einen In-Memory-localStorage-Shim, damit Node-Ausfuehrung ohne
// Browser klappt.

// --- localStorage-Shim ---
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

// Import erst NACH dem Shim.
const { state, saveState, loadState } = await import('./state.js');
const { BUNDLED_NEW_IDS } = await import('./data/bundled-new-ids.js');
const seedSorted = [...BUNDLED_NEW_IDS].sort((a, b) => a - b).join(',');

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  OK  ', name);
  else { failures++; console.error('  FAIL', name, detail ? `-> ${detail}` : ''); }
}

// -- Round-Trip fuer remoteNewIds (Set) --
state.assignment = { Montag: 1 };
state.remoteNewIds = new Set([5, 12, 33]);
state.bundledNewSeed = [...BUNDLED_NEW_IDS];   // schon geseedet — Seed-Logik haelt hier still
state.remoteUpdatedAt = '2026-07-27T10:00:00.000Z';
saveState();

// State zuruecksetzen und neu laden.
state.remoteNewIds = new Set();
state.remoteUpdatedAt = null;
loadState();

check('remoteNewIds als Set nach loadState', state.remoteNewIds instanceof Set);
check('remoteNewIds hat 3 Eintraege', state.remoteNewIds.size === 3);
check('remoteNewIds enthaelt 5', state.remoteNewIds.has(5));
check('remoteNewIds enthaelt 33', state.remoteNewIds.has(33));
check('remoteUpdatedAt persistiert', state.remoteUpdatedAt === '2026-07-27T10:00:00.000Z');

// -- Fresh Install: remoteNewIds wird mit BUNDLED_NEW_IDS geseedet --
delete store['mahlzeit-state-v2'];
state.remoteNewIds = new Set([99]);   // vermuellen
loadState();
check(
  'Fresh Install: remoteNewIds ist der Bundled-Seed',
  Array.from(state.remoteNewIds).sort((a, b) => a - b).join(',') === seedSorted,
  `erwartet ${seedSorted}, war ${Array.from(state.remoteNewIds).join(',')}`
);

// -- APK-Update: geaenderte BUNDLED_NEW_IDS seeden nach, alter Seed faellt weg --
// Simuliert den Storage eines Users, der die vorige APK hatte: Seed [36, 41],
// dazu ein remote importierter Neu-Marker (99), der ueberleben muss.
store['mahlzeit-state-v2'] = JSON.stringify({
  assignment: {},
  remoteNewIds: [36, 41, 99],
  bundledNewSeed: [36, 41],
  remoteUpdatedAt: '2026-08-01T10:00:00.000Z',
});
loadState();
const afterUpdate = Array.from(state.remoteNewIds).sort((a, b) => a - b);
check('APK-Update: neue Bundled-IDs sind markiert', BUNDLED_NEW_IDS.every((id) => state.remoteNewIds.has(id)));
check('APK-Update: alter Seed 36/41 ist weg', !state.remoteNewIds.has(36) && !state.remoteNewIds.has(41));
check('APK-Update: Remote-Marker 99 ueberlebt', state.remoteNewIds.has(99), `war ${afterUpdate.join(',')}`);
check('APK-Update: bundledNewSeed nachgezogen', state.bundledNewSeed.join(',') === seedSorted);

// -- Zweiter Start ohne Listenaenderung: kein erneutes Seeden --
state.remoteNewIds.delete(BUNDLED_NEW_IDS[0]);   // User hat das Rezept gesehen
saveState();
loadState();
check(
  'Kein Re-Seed bei unveraenderter Liste',
  !state.remoteNewIds.has(BUNDLED_NEW_IDS[0]),
  `war ${Array.from(state.remoteNewIds).join(',')}`
);

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log('\nAlle Checks OK.');
