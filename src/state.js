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
    onboardingSeen: false,  // true sobald Onboarding-Wizard einmal geöffnet wurde
    preferences: {
      // Diät-Gruppe: OR-Verknüpfung wie im Picker. Wenn eine oder mehrere
      // aktiv sind, muss ein Dish mindestens eine erfüllen. Alle aus =
      // neutral (kein Filter).
      meat: false,
      fish: false,
      vegetarian: false,
    },
    cuisines: {
      // Küchen-Präferenzen: kein Hard-Filter, sondern Weighted-Reroll.
      // Bevorzugte Buckets bekommen Faktor 3 im Auslos-Pool. Alle aus =
      // neutral (gleichverteilt).
      asian: false,
      mediterranean: false,
      middleEast: false,
      americas: false,
    },
    profile: {
      // Alle Wizard-Slots starten null. Der Onboarding-Wizard ist die einzige
      // Eingabequelle beim First-Run. hasProfile() bleibt der biometrische
      // Check (Gender+Age+Height+Weight), isProfileComplete() ergänzt um
      // activityLevel/goal/breakfastKcal/lunchKcal für die Placeholder-Pille-
      // Entscheidung. Name ist optional und in beiden Checks nicht enthalten.
      name: null,
      gender: null,
      age: null,
      heightCm: null,
      weightKg: null,
      activityLevel: null,
      goal: null,
      // Abendessen-Zielrechnung: Vorschlag aus Profil kann per Override gebrochen
      // werden. Frühstück/Mittag werden vom Tagesziel abgezogen — der Rest ist
      // das Abendessen-Ziel gegen das die Wochen-Bar rechnet.
      dailyTargetOverride: null,
      breakfastKcal: null,
      lunchKcal: null,
      showCalorieBar: true,
      // Makro-Verteilung: entweder Preset (Ausgewogen/Proteinreich/Kohlenhydratarm/Fettarm)
      // ODER expliziter Gramm-Override via macroTargets. Slider ziehen setzt
      // macroTargets und macroPreset = null (Custom). Refresh setzt beides
      // zurück auf {'balanced', null}. Siehe effectiveMacroTargets in target.js.
      macroPreset: 'balanced',
      macroTargets: null,
      // Lieblingsgerichte: { [dishId]: true }. Bewusst als Map (nicht Array),
      // damit Toggle O(1) ist und keine Reihenfolge suggeriert wird. Nested im
      // profile-Slot vorbereitet fuer Multi-User: spaeter zieht ein aeusserer
      // profiles-Layer die Struktur nach oben, favorites wandert 1:1 mit.
      favorites: {},
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

// Favoriten-Helper. isFavorite ist ein reiner Getter (auch fuer Filter/Sort im
// Picker), toggleFavorite mutiert und muss vom Caller via saveState persistiert
// werden (refresh() in main.js triggert das ohnehin nach jedem UI-Event).
export function isFavorite(dishId) {
  return !!state.settings.profile.favorites?.[dishId];
}

export function toggleFavorite(dishId) {
  const favs = state.settings.profile.favorites;
  if (favs[dishId]) delete favs[dishId];
  else favs[dishId] = true;
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
    // Beta-Reset (Session 13): alte Sessions ohne onboardingSeen-Flag werden
    // komplett durch den neuen Wizard geführt. Alle Wizard-Slots werden auf null
    // gezogen, unabhängig davon was drin steht. Nach dem ersten saveState() ist
    // onboardingSeen: true und diese Migration greift nicht mehr.
    const isLegacyPreOnboarding = !('onboardingSeen' in loadedSettings);
    const loadedProfile = loadedSettings.profile ?? {};
    state.settings = {
      defaultPortions: loadedSettings.defaultPortions ?? legacyGlobalPortions ?? 1,
      maxCookTime: loadedSettings.maxCookTime ?? COOKTIME_MAX,
      onboardingSeen: loadedSettings.onboardingSeen ?? false,
      preferences: {
        meat: loadedSettings.preferences?.meat ?? false,
        fish: loadedSettings.preferences?.fish ?? false,
        vegetarian: loadedSettings.preferences?.vegetarian ?? false,
      },
      cuisines: {
        asian: loadedSettings.cuisines?.asian ?? false,
        mediterranean: loadedSettings.cuisines?.mediterranean ?? false,
        middleEast: loadedSettings.cuisines?.middleEast ?? false,
        americas: loadedSettings.cuisines?.americas ?? false,
      },
      profile: {
        name:                 isLegacyPreOnboarding ? null : (loadedProfile.name ?? null),
        gender:               isLegacyPreOnboarding ? null : (loadedProfile.gender ?? null),
        age:                  isLegacyPreOnboarding ? null : (loadedProfile.age ?? null),
        heightCm:             isLegacyPreOnboarding ? null : (loadedProfile.heightCm ?? null),
        weightKg:             isLegacyPreOnboarding ? null : (loadedProfile.weightKg ?? null),
        activityLevel:        isLegacyPreOnboarding ? null : (loadedProfile.activityLevel ?? null),
        goal:                 isLegacyPreOnboarding ? null : (loadedProfile.goal ?? null),
        dailyTargetOverride:  loadedProfile.dailyTargetOverride ?? null,
        breakfastKcal:        isLegacyPreOnboarding ? null : (loadedProfile.breakfastKcal ?? null),
        lunchKcal:            isLegacyPreOnboarding ? null : (loadedProfile.lunchKcal ?? null),
        showCalorieBar:       loadedProfile.showCalorieBar ?? true,
        macroPreset:          loadedProfile.macroPreset ?? 'balanced',
        macroTargets:         loadedProfile.macroTargets ?? null,
        favorites:            (loadedProfile.favorites && typeof loadedProfile.favorites === 'object')
                                ? loadedProfile.favorites
                                : {},
      },
      theme: loadedSettings.theme ?? 'auto',
    };
    return true;
  } catch (_) {
    return false;
  }
}
