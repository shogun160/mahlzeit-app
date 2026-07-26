import { DEFAULT_USER } from './defaults.js';
import { getStandardProfile } from '../state.js';

// Ermittelt fuer eine gegebene Personenzahl die teilnehmenden Diner-Profile.
// Reihenfolge: erste N Profile aus der Liste, Rest mit dem globalen
// Standard-Profil (state.settings.standardProfile — in Settings editierbar)
// aufgefuellt. Bei portions=1 nur profiles[0], bei portions>N wird fuer
// jede zusaetzliche Person das Standard-Profil angenommen.
//
// Wenn kein state-Zugriff moeglich ist (Node-Tests ohne Setup), faellt der
// Helper auf die eingefrorene DEFAULT_USER-Konstante zurueck.
//
// Beispiele:
//   dinersForPortion(1, [alice, bob])   -> [alice]
//   dinersForPortion(3, [alice, bob])   -> [alice, bob, STANDARD]
//   dinersForPortion(2, [])             -> [STANDARD, STANDARD]
export function dinersForPortion(portions, profiles) {
  const n = Math.max(0, portions | 0);
  const list = Array.isArray(profiles) ? profiles : [];
  const actual = list.slice(0, n);
  const missing = Math.max(0, n - actual.length);
  if (missing === 0) return [...actual];
  let filler;
  try { filler = getStandardProfile(); } catch (_) { filler = DEFAULT_USER; }
  return [...actual, ...Array(missing).fill(filler)];
}
