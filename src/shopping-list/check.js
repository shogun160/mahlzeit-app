import { state, DAYS } from '../state.js';
import { dishesById } from '../data/dishes.js';

// Togglet den Check-Zustand einer Zutat. Set-Semantik: identischer key wird
// hinzugefügt oder entfernt. Kein Nebeneffekt sonst — Rendering ist Aufrufer-Sache.
export function toggleChecked(key) {
  if (state.checkedShopping.has(key)) {
    state.checkedShopping.delete(key);
  } else {
    state.checkedShopping.add(key);
  }
}

// Räumt checkedShopping auf, wenn ein Tag ein neues Gericht bekommt: alle
// Zutaten des ALTEN Gerichts, die in keinem anderen Tag mehr benötigt werden,
// werden aus dem abgehakten-Set gelöscht. Damit verschwinden sie beim Wechsel
// auch aus der Einkaufsliste (kein Leftover-Rest mehr).
// Aufrufen VOR `state.assignment[day] = newDishId` — die Funktion liest die
// aktuelle Zuweisung als "alte".
export function forgetCheckedForOldDish(day) {
  const oldDishId = state.assignment[day];
  if (oldDishId == null) return;
  const oldDish = dishesById.get(oldDishId);
  if (!oldDish) return;
  const stillNeeded = new Set();
  for (const otherDay of DAYS) {
    if (otherDay === day) continue;
    const otherDish = dishesById.get(state.assignment[otherDay]);
    if (otherDish) otherDish.ingredients.forEach((i) => stillNeeded.add(i.key));
  }
  oldDish.ingredients.forEach((ing) => {
    if (!stillNeeded.has(ing.key)) state.checkedShopping.delete(ing.key);
  });
}

// Setzt alle Häkchen zurück. Wird vom Reset-Button im Shopping-Header genutzt.
// Beim Reset auch die eingeklappten Kategorien wieder öffnen — sonst würden
// Kategorien, die durch Auto-Collapse zugeklappt wurden, dauerhaft eingeklappt
// bleiben, obwohl alle ihre Zutaten wieder offen sind.
export function resetChecked() {
  state.checkedShopping.clear();
  state.collapsedCategories.clear();
}
