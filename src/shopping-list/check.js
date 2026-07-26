import { state } from '../state.js';

// Togglet den Check-Zustand einer Zutat. Set-Semantik: identischer key wird
// hinzugefügt oder entfernt. Kein Nebeneffekt sonst — Rendering ist Aufrufer-Sache.
export function toggleChecked(key) {
  if (state.checkedShopping.has(key)) {
    state.checkedShopping.delete(key);
  } else {
    state.checkedShopping.add(key);
  }
}

// Setzt Häkchen zurück. Ohne keys: alle. Mit keys: nur die genannten (fuer
// die per-Kategorie-Reset-Buttons). Beim globalen Reset zusaetzlich die
// eingeklappten Kategorien oeffnen — sonst blieben Auto-Collapse-Kategorien
// dauerhaft zugeklappt, obwohl alle ihre Zutaten wieder offen sind.
export function resetChecked(keys) {
  if (keys && Array.isArray(keys)) {
    for (const k of keys) state.checkedShopping.delete(k);
  } else {
    state.checkedShopping.clear();
    state.collapsedCategories.clear();
  }
}

// Hakt alle Zutaten der aktuellen Einkaufsliste ab. Wird vom Check-All-
// Button im Shopping-Header genutzt (nur sichtbar wenn nichts abgehakt).
// Nimmt die keys aus der consolidated Liste — die spiegelt die aktuell
// aktive Woche + Leftover-Items.
export function checkAll(itemKeys) {
  for (const key of itemKeys) state.checkedShopping.add(key);
}
