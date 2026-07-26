import { state, DAYS } from '../state.js';

export function toggleSelected(day) {
  state.selected[day] = !state.selected[day];
}

// Master-Toggle für die Selection-Toolbar. Bulk-Selection-Standard (Gmail,
// Datei-Manager): sobald mindestens ein Tag selektiert ist, räumt ein Klick
// die ganze Auswahl ab. Nur wenn absolut nichts selektiert ist, wählt der
// Klick alle Tage aus. Ergebnis: der User braucht nie einen zweiten Klick,
// um seine Selection zu clearen.
export function toggleAllSelected() {
  const anySelected = DAYS.some((day) => state.selected[day]);
  const target = !anySelected;
  for (const day of DAYS) {
    state.selected[day] = target;
  }
}
