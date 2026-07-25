// Zentraler In-Memory-State.
// Persistenz (localStorage-Key "mahlzeit-state-v2") kommt in Session 6.
// Interaktionen (Reroll, Portions, Auswahl, Shopping-Checks) kommen ab Session 3.

export const DAYS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];

// Struktur laut Design-Doc Section 6:
//   assignment       { [day: string]: number }   // Tag → dishId
//   selected         { [day: string]: boolean }  // Tag ausgewählt für Einkaufsliste?
//   portions         { [day: string]: number }   // Portionen pro Tag
//   globalPortions   number                      // Portionen-Regler im Header
//   checkedShopping  Set<string>                 // abgehakte Zutaten-Keys
export const state = {
  assignment: {},
  selected: {},
  portions: {},
  globalPortions: 1,
  checkedShopping: new Set(),
};

// Initialisiert selected/portions passend zu einem frischen Assignment.
// Default: alle Tage ausgewählt, jeweils 1 Portion.
export function initState(assignment) {
  state.assignment = assignment;
  state.selected = {};
  state.portions = {};
  for (const day of DAYS) {
    state.selected[day] = true;
    state.portions[day] = 1;
  }
}
