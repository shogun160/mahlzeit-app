import { state, DAYS, PORTIONS_MIN, PORTIONS_MAX } from '../state.js';

function clamp(n) {
  return Math.min(PORTIONS_MAX, Math.max(PORTIONS_MIN, n));
}

export function changePortion(day, delta) {
  state.portions[day] = clamp(state.portions[day] + delta);
}

// Setzt den Header-Wert und überschreibt alle Card-Werte auf denselben Wert.
// Analog zur alten App auf main.
export function changeGlobalPortion(delta) {
  state.globalPortions = clamp(state.globalPortions + delta);
  for (const day of DAYS) {
    state.portions[day] = state.globalPortions;
  }
}
