// Zentraler In-Memory-State inkl. Persistenz nach localStorage.

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

// Kochzeit-Slider im Settings-Sheet — 120 min ≈ "kein Limit"
// (aktuell haben Gerichte max 70 min in dishes.json).
export const COOKTIME_MIN = 20;
export const COOKTIME_MAX = 120;
export const COOKTIME_STEP = 5;

export const VIEWS = ['dashboard', 'shopping'];

// Guardrail (CLAUDE.md): v1 gehört der alten App auf `main`, v2 dem Rebuild.
// Umbenennen dieses Keys braucht bewusste Migration, sonst Datenverlust.
const STORAGE_KEY = 'mahlzeit-state-v2';

// Struktur:
//   assignment       { [day: string]: number }   // Tag → dishId
//   selected         { [day: string]: boolean }  // Tag ausgewählt für Einkaufsliste?
//   portions         { [day: string]: number }   // Portionen pro Tag, clamp [MIN,MAX]
//   checkedShopping  Set<string>                 // abgehakte Zutaten-Keys
//   dishBag          { [day: string]: number[] } // pro Karte: Shuffle-Bag-Queue
//   view             'dashboard' | 'shopping'    // aktive Screen-Ansicht
//   collapsedCategories Set<string>              // eingeklappte Einkaufslisten-Kategorien
//   settings         { ... }                     // User-Settings (Sheet)
export const state = {
  assignment: {},
  selected: {},
  portions: {},
  checkedShopping: new Set(),
  dishBag: {},
  view: 'dashboard',
  collapsedCategories: new Set(),
  settings: {
    defaultPortions: 1,   // Default für neu ausgeloste Gerichte
    maxCookTime: COOKTIME_MAX, // in Minuten, Filter fürs Reroll
    preferences: {
      // Diät-Gruppe: OR-Verknüpfung wie im Picker. Wenn eine oder mehrere
      // aktiv sind, muss ein Dish mindestens eine erfüllen. Alle aus =
      // neutral (kein Filter).
      meat: false,
      fish: false,
      vegetarian: false,
    },
    theme: 'auto',        // 'auto' | 'light' | 'dark' — noch nicht funktional
  },
};

// Initialisiert selected/portions passend zu einem frischen Assignment.
// Portionen starten mit settings.defaultPortions (User's Standard).
export function initState(assignment) {
  state.assignment = assignment;
  state.selected = {};
  state.portions = {};
  state.dishBag = {};
  for (const day of DAYS) {
    state.selected[day] = false;
    state.portions[day] = state.settings.defaultPortions;
  }
}

// Setzt die aktive Screen-Ansicht. Wird von Swipe-Handler und Bottom-Nav gerufen.
export function setView(next) {
  if (!VIEWS.includes(next)) return;
  state.view = next;
}

// Speichert den gesamten State nach localStorage. Sets werden zu Arrays
// serialisiert; alle anderen Slots sind plain und gehen direkt durch JSON.
export function saveState() {
  try {
    const snapshot = {
      assignment: state.assignment,
      selected: state.selected,
      portions: state.portions,
      checkedShopping: Array.from(state.checkedShopping),
      dishBag: state.dishBag,
      view: state.view,
      collapsedCategories: Array.from(state.collapsedCategories),
      settings: state.settings,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (_) {
    // Speicher voll oder deaktiviert — App bleibt lauffähig, ohne Persistenz.
  }
}

// Lädt persistierten State zurück. Migriert Alt-Format (globalPortions)
// zu settings.defaultPortions, damit alte Sessions nach dem Rebuild sauber
// weitergehen.
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return false;
    if (!parsed.assignment || typeof parsed.assignment !== 'object') return false;

    state.assignment = parsed.assignment;
    state.selected = parsed.selected || {};
    state.portions = parsed.portions || {};
    state.checkedShopping = new Set(Array.isArray(parsed.checkedShopping) ? parsed.checkedShopping : []);
    state.dishBag = parsed.dishBag || {};
    state.view = VIEWS.includes(parsed.view) ? parsed.view : 'dashboard';
    state.collapsedCategories = new Set(Array.isArray(parsed.collapsedCategories) ? parsed.collapsedCategories : []);

    // Settings: mergen mit Defaults, damit neue Slots beim Migrate nicht undefined sind.
    const loadedSettings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {};
    const legacyGlobalPortions = typeof parsed.globalPortions === 'number' ? parsed.globalPortions : undefined;
    state.settings = {
      defaultPortions: loadedSettings.defaultPortions ?? legacyGlobalPortions ?? 1,
      maxCookTime: loadedSettings.maxCookTime ?? COOKTIME_MAX,
      preferences: {
        meat: loadedSettings.preferences?.meat ?? false,
        fish: loadedSettings.preferences?.fish ?? false,
        vegetarian: loadedSettings.preferences?.vegetarian ?? false,
      },
      theme: loadedSettings.theme ?? 'auto',
    };
    return true;
  } catch (_) {
    return false;
  }
}
