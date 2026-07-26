import { state } from '../state.js';

// Ein-/ausklappbarer Zustand pro Kategorie. Set-Semantik: Anwesenheit = eingeklappt.
export function isCollapsed(cat) {
  return state.collapsedCategories.has(cat);
}

export function toggleCollapsed(cat) {
  if (state.collapsedCategories.has(cat)) {
    state.collapsedCategories.delete(cat);
  } else {
    state.collapsedCategories.add(cat);
  }
}

export function expandCategory(cat) {
  state.collapsedCategories.delete(cat);
}
