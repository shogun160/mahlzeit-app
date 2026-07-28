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

// Sub-Collapse innerhalb einer Kategorie: abgehakte Zutaten. Standard = collapsed
// sobald >=4 abgehakt sind und noch mindestens eine offen ist. Anwesenheit im
// Set = "User hat expliziert 'anzeigen' gedrueckt".
export function isCheckedExpanded(cat) {
  return state.expandedCheckedCategories.has(cat);
}

export function toggleCheckedExpanded(cat) {
  if (state.expandedCheckedCategories.has(cat)) {
    state.expandedCheckedCategories.delete(cat);
  } else {
    state.expandedCheckedCategories.add(cat);
  }
}
