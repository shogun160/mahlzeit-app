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

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  OK  ', name);
  else { failures++; console.error('  FAIL', name, detail ? `-> ${detail}` : ''); }
}

// -- Round-Trip fuer remoteNewIds (Set) --
state.assignment = { Montag: 1 };
state.remoteNewIds = new Set([5, 12, 33]);
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

// -- Fresh Install: remoteNewIds als leeres Set --
delete store['mahlzeit-state-v2'];
state.remoteNewIds = new Set([99]);   // vermuellen
loadState();
check('Fresh Install: remoteNewIds ist leeres Set', state.remoteNewIds instanceof Set && state.remoteNewIds.size === 0);

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log('\nAlle Checks OK.');
