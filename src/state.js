// Zentraler In-Memory-State.
// Persistenz (localStorage-Key "mahlzeit-state-v2") kommt in Session 6.

export const DAYS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];

export const PORTIONS_MIN = 1;
export const PORTIONS_MAX = 6;

// Struktur laut Design-Doc Section 6 (plus dishBag für Reroll-Historie).
//   assignment       { [day: string]: number }   // Tag → dishId
//   selected         { [day: string]: boolean }  // Tag ausgewählt für Einkaufsliste?
//   portions         { [day: string]: number }   // Portionen pro Tag, clamp [MIN,MAX]
//   globalPortions   number                      // Portionen-Regler im Header, clamp [MIN,MAX]
//   checkedShopping  Set<string>                 // abgehakte Zutaten-Keys (Session 5)
//   dishBag          { [day: string]: number[] } // pro Karte: Shuffle-Bag-Queue, wird beim Ziehen konsumiert
export const state = {
  assignment: {},
  selected: {},
  portions: {},
  globalPortions: 1,
  checkedShopping: new Set(),
  dishBag: {},
};

// Initialisiert selected/portions passend zu einem frischen Assignment.
// Default: alle Tage abgewählt, jeweils 1 Portion (analog zur alten App auf main).
export function initState(assignment) {
  state.assignment = assignment;
  state.selected = {};
  state.portions = {};
  state.dishBag = {};
  for (const day of DAYS) {
    state.selected[day] = false;
    state.portions[day] = 1;
  }
}
