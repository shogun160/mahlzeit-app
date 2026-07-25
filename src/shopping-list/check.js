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

// Setzt alle Häkchen zurück. Wird vom Reset-Button im Shopping-Header genutzt.
export function resetChecked() {
  state.checkedShopping.clear();
}
