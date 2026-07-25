// Zentraler In-Memory-State inkl. Persistenz nach localStorage (Session 6).

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

export const VIEWS = ['dashboard', 'shopping'];

// Guardrail (CLAUDE.md): v1 gehört der alten App auf `main`, v2 dem Rebuild.
// Umbenennen dieses Keys braucht bewusste Migration, sonst Datenverlust.
const STORAGE_KEY = 'mahlzeit-state-v2';

// Struktur laut Design-Doc Section 6 (plus dishBag für Reroll-Historie).
//   assignment       { [day: string]: number }   // Tag → dishId
//   selected         { [day: string]: boolean }  // Tag ausgewählt für Einkaufsliste?
//   portions         { [day: string]: number }   // Portionen pro Tag, clamp [MIN,MAX]
//   globalPortions   number                      // Portionen-Regler im Header, clamp [MIN,MAX]
//   checkedShopping  Set<string>                 // abgehakte Zutaten-Keys (Session 5)
//   dishBag          { [day: string]: number[] } // pro Karte: Shuffle-Bag-Queue, wird beim Ziehen konsumiert
//   view             'dashboard' | 'shopping'    // aktive Screen-Ansicht (Session 5)
//   collapsedCategories Set<string>              // eingeklappte Einkaufslisten-Kategorien
export const state = {
  assignment: {},
  selected: {},
  portions: {},
  globalPortions: 1,
  checkedShopping: new Set(),
  dishBag: {},
  view: 'dashboard',
  collapsedCategories: new Set(),
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

// Setzt die aktive Screen-Ansicht. Wird von Swipe-Handler und Bottom-Nav gerufen.
// No-op wenn `next` unbekannt — schützt vor Tippfehlern.
export function setView(next) {
  if (!VIEWS.includes(next)) return;
  state.view = next;
}

// Speichert den gesamten State nach localStorage. Sets werden zu Arrays
// serialisiert; alle anderen Slots sind plain und gehen direkt durch JSON.
// Fehler (Quota, Private-Mode) werden geschluckt — Persistenz ist "best effort".
export function saveState() {
  try {
    const snapshot = {
      assignment: state.assignment,
      selected: state.selected,
      portions: state.portions,
      globalPortions: state.globalPortions,
      checkedShopping: Array.from(state.checkedShopping),
      dishBag: state.dishBag,
      view: state.view,
      collapsedCategories: Array.from(state.collapsedCategories),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (_) {
    // Speicher voll oder deaktiviert — App bleibt trotzdem lauffähig, nur ohne
    // Persistenz. Absichtlich still, kein UI-Feedback.
  }
}

// Lädt persistierten State in den In-Memory-`state` zurück. Gibt `true` zurück,
// wenn erfolgreich geladen — dann überspringt renderDashboard() sein initState-Fallback.
// `false` bei fehlenden/kaputten Daten → renderDashboard() würfelt beim ersten
// Render ein frisches Assignment.
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    // Minimal-Validierung: assignment muss da sein und die 7 Tage abdecken.
    // Ohne assignment ist der State sinnlos → als "leer" behandeln.
    if (!parsed || typeof parsed !== 'object') return false;
    if (!parsed.assignment || typeof parsed.assignment !== 'object') return false;

    state.assignment = parsed.assignment;
    state.selected = parsed.selected || {};
    state.portions = parsed.portions || {};
    state.globalPortions = typeof parsed.globalPortions === 'number' ? parsed.globalPortions : 1;
    state.checkedShopping = new Set(Array.isArray(parsed.checkedShopping) ? parsed.checkedShopping : []);
    state.dishBag = parsed.dishBag || {};
    state.view = VIEWS.includes(parsed.view) ? parsed.view : 'dashboard';
    state.collapsedCategories = new Set(Array.isArray(parsed.collapsedCategories) ? parsed.collapsedCategories : []);
    return true;
  } catch (_) {
    return false;
  }
}
