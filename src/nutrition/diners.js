import { DEFAULT_USER } from './defaults.js';

// Ermittelt fuer eine gegebene Personenzahl die teilnehmenden Diner-Profile.
// Reihenfolge: erste N Profile aus der Liste, Rest mit DEFAULT_USER aufgefuellt.
// Damit ist bei portions=1 immer nur profiles[0] beteiligt, bei portions>N wird
// fuer jede zusaetzliche Person ein DGE-Standardbedarf angenommen.
//
// Beispiele:
//   dinersForPortion(1, [alice, bob])           -> [alice]
//   dinersForPortion(3, [alice, bob])           -> [alice, bob, DEFAULT_USER]
//   dinersForPortion(2, [])                     -> [DEFAULT_USER, DEFAULT_USER]
//
// Rueckgabe ist eine neue Array-Instanz; DEFAULT_USER selbst ist eingefroren.
export function dinersForPortion(portions, profiles) {
  const n = Math.max(0, portions | 0);
  const list = Array.isArray(profiles) ? profiles : [];
  const actual = list.slice(0, n);
  const missing = Math.max(0, n - actual.length);
  return [...actual, ...Array(missing).fill(DEFAULT_USER)];
}
