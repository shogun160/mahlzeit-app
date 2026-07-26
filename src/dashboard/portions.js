import { state, DAYS, PORTIONS_MIN, PORTIONS_MAX } from '../state.js';

function clamp(n) {
  return Math.min(PORTIONS_MAX, Math.max(PORTIONS_MIN, n));
}

export function changePortion(day, delta) {
  state.portions[day] = clamp(state.portions[day] + delta);
}

// Settings-Sheet: setzt den globalen Standard und überschreibt ALLE Card-Werte.
// Semantik analog zur alten App: die per-Card-Stepper sind Overrides, die bis
// zum nächsten Standard-Change (oder rerollAll) gelten. Wer den Standard von
// 2 auf 3 dreht, will 3 Portionen für die ganze Woche — nicht nur für zukünftige.
export function changeDefaultPortions(delta) {
  state.settings.defaultPortions = clamp(state.settings.defaultPortions + delta);
  for (const day of DAYS) {
    state.portions[day] = state.settings.defaultPortions;
  }
}
