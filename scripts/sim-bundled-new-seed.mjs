// Node-Sim fuer den BUNDLED_NEW_IDS-Seed in state.js loadState().
// Prueft:
//  1. Fresh-Install (kein localStorage) → remoteNewIds enthaelt alle BUNDLED_NEW_IDS
//  2. Legacy-State ohne Remote-Check (remoteUpdatedAt=null) → Seed greift auch
//  3. User mit Remote-Check (remoteUpdatedAt=ISO-String) → Seed greift NICHT
//  4. User mit non-leerem remoteNewIds → Seed greift NICHT (safety-belt)
//
// Ausfuehren: node scripts/sim-bundled-new-seed.mjs

// localStorage-Stub, MUSS vor dem state.js-Import stehen weil state.js
// beim Module-Load noch nichts lokal aufruft, aber loadState() greift zu.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { state, loadState, initState } = await import('../src/state.js');
const { BUNDLED_NEW_IDS } = await import('../src/data/bundled-new-ids.js');

function assertEq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) {
    console.log('  actual:  ', JSON.stringify(actual));
    console.log('  expected:', JSON.stringify(expected));
    process.exitCode = 1;
  }
}

// --- Case 1: Fresh-Install (kein localStorage) ---------------------------
store.clear();
{
  const loaded = loadState();
  assertEq(loaded, false, 'Case 1: loadState() = false (fresh install)');
  assertEq(state.remoteUpdatedAt, null, 'Case 1: remoteUpdatedAt = null');
  assertEq(Array.from(state.remoteNewIds).sort((a, b) => a - b), [...BUNDLED_NEW_IDS].sort((a, b) => a - b), 'Case 1: remoteNewIds geseedet mit BUNDLED_NEW_IDS');
}

// --- Case 2: Legacy-State ohne Remote-Check ------------------------------
store.clear();
{
  // Minimal-gueltiger State: assignment als Objekt, alles andere null/leer.
  const legacy = {
    assignment: { Montag: 1 },
    remoteUpdatedAt: null,       // NIE Remote geprueft
    remoteNewIds: [],            // leer
  };
  store.set('mahlzeit-state-v2', JSON.stringify(legacy));
  const loaded = loadState();
  assertEq(loaded, true, 'Case 2: loadState() = true (valid legacy state)');
  assertEq(state.remoteUpdatedAt, null, 'Case 2: remoteUpdatedAt = null (nie geprueft)');
  assertEq(Array.from(state.remoteNewIds).sort((a, b) => a - b), [...BUNDLED_NEW_IDS].sort((a, b) => a - b), 'Case 2: remoteNewIds geseedet mit BUNDLED_NEW_IDS');
}

// --- Case 3: User mit Remote-Check ---------------------------------------
store.clear();
{
  const withCheck = {
    assignment: { Montag: 1 },
    remoteUpdatedAt: '2026-08-01T10:00:00Z',  // hat geprueft
    remoteNewIds: [42, 43],                    // aus einem frueheren Fetch
  };
  store.set('mahlzeit-state-v2', JSON.stringify(withCheck));
  const loaded = loadState();
  assertEq(loaded, true, 'Case 3: loadState() = true');
  assertEq(state.remoteUpdatedAt, '2026-08-01T10:00:00Z', 'Case 3: remoteUpdatedAt bleibt geladen');
  assertEq(Array.from(state.remoteNewIds).sort((a, b) => a - b), [42, 43], 'Case 3: remoteNewIds bleibt geladen (kein Seed)');
}

// --- Case 4: User ohne Remote-Check aber mit non-leerem remoteNewIds -----
store.clear();
{
  const partial = {
    assignment: { Montag: 1 },
    remoteUpdatedAt: null,        // nie geprueft
    remoteNewIds: [100, 101],     // aber schon Info drin (edge case)
  };
  store.set('mahlzeit-state-v2', JSON.stringify(partial));
  const loaded = loadState();
  assertEq(loaded, true, 'Case 4: loadState() = true');
  assertEq(Array.from(state.remoteNewIds).sort((a, b) => a - b), [100, 101], 'Case 4: existing remoteNewIds nicht ueberschrieben (safety-belt)');
}

console.log('\nSim beendet.');
