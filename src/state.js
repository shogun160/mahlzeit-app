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

// Profile-Template mit allen Wizard-Slots auf null. Wird sowohl fuer den
// initialen In-Memory-State (profiles[0] = { id: 'u1', ...blank }) als auch
// fuer neu angelegte User genutzt (Etappe 3 / Settings-Add). Zentrale Wahrheit
// ueber die Felder eines Profils.
function blankProfile(id) {
  return {
    id,
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
    // damit Toggle O(1) ist und keine Reihenfolge suggeriert wird. Pro Profil
    // getrennt, damit Partner-User eigene Favoriten pflegen kann.
    favorites: {},
    // Diaet-Praeferenzen pro Profil (Etappe: Prefs pro User). OR-verknuepft
    // innerhalb eines Profils, Schnittmenge ueber alle mitkochenden Profile
    // beim Dish-Picker (Fallback: Prefs des aktiven Users bei leerem Schnitt).
    preferences: {
      meat: false,
      fish: false,
      vegetarian: false,
    },
    // Kuechen-Praeferenzen pro Profil. Multi-User: Union aller mitkochenden
    // Profile, Reihenfolge im Picker nach Voter-Anzahl absteigend.
    cuisines: {
      asian: false,
      mediterranean: false,
      middleEast: false,
      americas: false,
    },
  };
}

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
  // Remote-Rezept-Import (Session 21). Alle Slots werden in mahlzeit-state-v2
  // persistiert (Guardrail 2 bleibt intakt — nur zusaetzliche Felder, kein
  // Storage-Key-Wechsel). Sets werden wie collapsedCategories als Array
  // serialisiert.
  remoteDishes: [],                // Dish[] wie in dishes.json (ohne enrichment — beim Load wird angereichert)
  remoteIngredients: {},           // { key -> Ingredient } wie in ingredients.json
  remoteUpdatedAt: null,           // ISO-String vom letzten erfolgreichen Fetch
  remoteHasUpdates: false,         // Auto-Check setzt true; cleared nur bei erfolgreichem Import oder wenn der naechste Auto-Check keine neuen mehr findet
  remoteLastFetchAt: null,         // ISO-String fuer 60s-Soft-Rate-Limit
  remoteNewIds: new Set(),         // IDs die aktuell als "Neu" gelten
  remoteImageFailures: new Set(),  // IDs deren Bild-Download failed hat (TTL 24h — beim Start gecleart)
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
    // Multi-Profile: profiles[] ist die primaere Quelle, activeProfileId
    // markiert den aktiven User (Basis fuer Bedarfs-Pille + Naehrwert-Balken).
    // profile bleibt als Rollback-Mirror des aktiven Users im Storage — wird
    // bei jedem saveState() aus getActiveProfile() gespiegelt, damit ein
    // Downgrade zur Vorgaenger-App-Version (die nur `profile` kennt) nicht
    // kaputt geht. In-Memory wird `profile` nicht mehr gelesen — alle
    // Callsites gehen ueber getActiveProfile().
    profiles: [blankProfile('u1')],
    activeProfileId: 'u1',
    profile: blankProfile('u1'),
    // Standard-Profil: globaler Fallback fuer Kochmengen wenn Personenzahl
    // groesser als profiles.length. Editierbar in Settings, nicht loeschbar.
    // Wird beim Load aus DEFAULT_USER initialisiert (siehe defaults.js).
    // Sitzt hier zunaechst als null — loadState() bzw. der Zugriff via
    // getStandardProfile() fuellt aus DEFAULT_USER.
    standardProfile: null,
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

// --- Profile-Helper ------------------------------------------------------

// Liefert das aktive Profil = profiles[0]. Die Reihenfolge in profiles[]
// bestimmt die Aktivierung: erstes Profil ist aktiv. User kann via
// Drag&Drop in der Settings-Liste (oder "Als aktiv setzen" im Detail-Sheet)
// die Reihenfolge aendern. activeProfileId bleibt als State-Slot gemirrort
// auf profiles[0].id fuer Rollback-Kompatibilitaet und Storage-Konsistenz.
// Notfall (leere Liste): Blank-Profil anlegen — sollte praktisch nie passieren.
export function getActiveProfile() {
  const profiles = state.settings.profiles;
  if (Array.isArray(profiles) && profiles.length > 0) return profiles[0];
  console.warn('[state] settings.profiles ist leer — Notfall-Profil u1 angelegt.');
  const fresh = blankProfile('u1');
  state.settings.profiles = [fresh];
  state.settings.activeProfileId = fresh.id;
  return fresh;
}

export function getProfileById(id) {
  const profiles = state.settings.profiles;
  if (!Array.isArray(profiles)) return null;
  return profiles.find((p) => p && p.id === id) ?? null;
}

// Vergibt die naechste freie u<N>-ID (u1, u2, u3, ...). Beim Loeschen bleiben
// IDs bestehen (Guardrail Etappe 5: keine Reindexierung, damit Assignment-
// Referenzen stabil bleiben).
function nextProfileId() {
  const profiles = state.settings.profiles || [];
  let n = 1;
  const used = new Set(profiles.map((p) => p?.id));
  while (used.has(`u${n}`)) n++;
  return `u${n}`;
}

// Legt ein neues Profil an. patch enthaelt die Wizard-Werte; fehlende Felder
// werden aus blankProfile() ergaenzt. ID wird immer generiert (Caller kann
// keine setzen). Neuer Eintrag wird ans Ende von profiles[] angehaengt.
export function addProfile(patch = {}) {
  const id = nextProfileId();
  const p = { ...blankProfile(id), ...patch, id };
  state.settings.profiles.push(p);
  return p;
}

// Loescht ein Profil per ID. Verweigert:
//   - wenn nur ein einziges Profil uebrig waere (Mindestens-ein-Profil-Regel)
//   - wenn es das aktive Profil (profiles[0]) ist — der User muss vorher ein
//     anderes Profil per Drag&Drop oder "Als aktiv setzen" nach vorne bringen
// Rueckgabe true bei Erfolg, false wenn abgelehnt oder unbekannte ID.
export function removeProfile(id) {
  const profiles = state.settings.profiles;
  if (!Array.isArray(profiles) || profiles.length <= 1) return false;
  if (profiles[0]?.id === id) return false; // aktives Profil geschuetzt
  const idx = profiles.findIndex((p) => p && p.id === id);
  if (idx === -1) return false;
  profiles.splice(idx, 1);
  state.settings.activeProfileId = profiles[0].id;
  return true;
}

// Merged patch in ein bestehendes Profil. Gibt das aktualisierte Profil
// zurueck oder null wenn ID unbekannt. ID selbst ist immutable (patch.id wird
// ignoriert).
export function updateProfile(id, patch) {
  const p = getProfileById(id);
  if (!p) return null;
  for (const [k, v] of Object.entries(patch || {})) {
    if (k === 'id') continue;
    p[k] = v;
  }
  return p;
}

// Setzt ein Profil auf Position 0 (= aktiv). Die Reihenfolge der anderen
// Profile bleibt stabil (Insertion an neuer Position ohne shuffle).
// activeProfileId wird gemirrort auf die neue profiles[0].id.
// Liefert das globale Standard-Profil (Fallback-Diner, wenn portions >
// profiles.length). Wird beim ersten Zugriff aus DEFAULT_USER initialisiert.
// Nicht loeschbar, aber editierbar in Settings > Profile.
export function getStandardProfile() {
  if (!state.settings.standardProfile) {
    // Frisches Standard-Profil aus DEFAULT_USER. Lazy weil DEFAULT_USER
    // ein zirkulaerer Import waere — wir initialisieren via loadState oder
    // beim ersten Aufruf.
    state.settings.standardProfile = createStandardProfileDefaults();
  }
  return state.settings.standardProfile;
}

// Baut Default-Werte fuer standardProfile. Wird von loadState() + lazy-
// Getter genutzt. Struktur analog zu Profile, aber id '_default' als Marker
// (UI erkennt daran "nicht loeschbar", "Titel = Standard-Profil").
function createStandardProfileDefaults() {
  return {
    id: '_default',
    name: 'Standard-Profil',
    gender: 'male',
    age: 40,
    heightCm: 175,
    weightKg: 75,
    activityLevel: 3,
    goal: 'maintain',
    dailyTargetOverride: 2200,
    breakfastKcal: 550,
    lunchKcal: 770,
    showCalorieBar: false,
    macroPreset: 'balanced',
    macroTargets: null,
    favorites: {},
    preferences: { meat: false, fish: false, vegetarian: false },
    cuisines: { asian: false, mediterranean: false, middleEast: false, americas: false },
  };
}

export function setActiveProfileId(id) {
  const profiles = state.settings.profiles;
  if (!Array.isArray(profiles) || profiles.length === 0) return;
  const idx = profiles.findIndex((p) => p && p.id === id);
  if (idx <= 0) return; // schon aktiv oder unbekannt
  const [p] = profiles.splice(idx, 1);
  profiles.unshift(p);
  state.settings.activeProfileId = profiles[0].id;
}

// Reordering per Drag&Drop: verschiebt Profil an neuen Index. Sorgt fuer
// stabile Reihenfolge der uebrigen und mirrort activeProfileId.
export function moveProfileToIndex(id, newIndex) {
  const profiles = state.settings.profiles;
  if (!Array.isArray(profiles) || profiles.length === 0) return;
  const idx = profiles.findIndex((p) => p && p.id === id);
  if (idx === -1) return;
  const target = Math.max(0, Math.min(profiles.length - 1, newIndex));
  if (idx === target) return;
  const [p] = profiles.splice(idx, 1);
  profiles.splice(target, 0, p);
  state.settings.activeProfileId = profiles[0].id;
}

// Favoriten-Helper. isFavorite ist ein reiner Getter (auch fuer Filter/Sort im
// Picker), toggleFavorite mutiert und muss vom Caller via saveState persistiert
// werden (refresh() in main.js triggert das ohnehin nach jedem UI-Event).
// Beide beziehen sich immer auf den aktiven User — Multi-User-Favoriten sind
// pro Profil getrennt.
export function isFavorite(dishId) {
  return !!getActiveProfile().favorites?.[dishId];
}

export function toggleFavorite(dishId) {
  const favs = getActiveProfile().favorites;
  if (favs[dishId]) delete favs[dishId];
  else favs[dishId] = true;
}

// Speichert den gesamten State nach localStorage. Sets werden zu Arrays
// serialisiert; alle anderen Slots sind plain und gehen direkt durch JSON.
export function saveState() {
  try {
    // profile-Mirror aktualisieren, damit ein Rollback zur Vorgaenger-App-
    // Version (die profiles[]/activeProfileId nicht kennt) den aktiven User
    // weiterhin unter settings.profile findet. In-App wird der Mirror nicht
    // gelesen — nur getActiveProfile() zaehlt.
    const active = getActiveProfile();
    state.settings.profile = { ...active };
    // Prefs- + Cuisines-Mirror analog: aeltere Versionen lesen sie global.
    state.settings.preferences = { ...active.preferences };
    state.settings.cuisines = { ...active.cuisines };
    const snapshot = {
      assignment: state.assignment,
      selected: state.selected,
      portions: state.portions,
      checkedShopping: Array.from(state.checkedShopping),
      dishBag: state.dishBag,
      view: state.view,
      collapsedCategories: Array.from(state.collapsedCategories),
      remoteDishes: state.remoteDishes,
      remoteIngredients: state.remoteIngredients,
      remoteUpdatedAt: state.remoteUpdatedAt,
      remoteHasUpdates: state.remoteHasUpdates,
      remoteLastFetchAt: state.remoteLastFetchAt,
      remoteNewIds: Array.from(state.remoteNewIds),
      // remoteImageFailures wird bewusst NICHT persistiert (TTL 24h,
      // beim naechsten Start ohnehin cleared).
      settings: state.settings,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (_) {
    // Speicher voll oder deaktiviert — App bleibt lauffähig, ohne Persistenz.
  }
}

// Lädt persistierten State zurück. Migriert Alt-Format (globalPortions)
// zu settings.defaultPortions, damit alte Sessions nach dem Rebuild sauber
// weitergehen. Multi-Profile-Migration: alter settings.profile-Slot wird zu
// profiles[0] mit id "u1"; profiles[]/activeProfileId werden hinzugefuegt.
export function loadState() {
  try {
    // Remote-Slots immer zuruecksetzen, damit Fresh Install (kein Storage)
    // saubere Defaults hat statt veralteter In-Memory-Werte.
    state.remoteDishes = [];
    state.remoteIngredients = {};
    state.remoteUpdatedAt = null;
    state.remoteHasUpdates = false;
    state.remoteLastFetchAt = null;
    state.remoteNewIds = new Set();
    state.remoteImageFailures = new Set();

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
    state.remoteDishes = Array.isArray(parsed.remoteDishes) ? parsed.remoteDishes : [];
    state.remoteIngredients = (parsed.remoteIngredients && typeof parsed.remoteIngredients === 'object') ? parsed.remoteIngredients : {};
    state.remoteUpdatedAt = typeof parsed.remoteUpdatedAt === 'string' ? parsed.remoteUpdatedAt : null;
    state.remoteHasUpdates = parsed.remoteHasUpdates === true;
    state.remoteLastFetchAt = typeof parsed.remoteLastFetchAt === 'string' ? parsed.remoteLastFetchAt : null;
    state.remoteNewIds = new Set(Array.isArray(parsed.remoteNewIds) ? parsed.remoteNewIds : []);
    state.remoteImageFailures = new Set();  // TTL 24h: beim Start immer frisch

    // Settings: mergen mit Defaults, damit neue Slots beim Migrate nicht undefined sind.
    const loadedSettings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {};
    const legacyGlobalPortions = typeof parsed.globalPortions === 'number' ? parsed.globalPortions : undefined;
    // Beta-Reset (Session 13): alte Sessions ohne onboardingSeen-Flag werden
    // komplett durch den neuen Wizard geführt. Alle Wizard-Slots werden auf null
    // gezogen, unabhängig davon was drin steht. Nach dem ersten saveState() ist
    // onboardingSeen: true und diese Migration greift nicht mehr.
    const isLegacyPreOnboarding = !('onboardingSeen' in loadedSettings);
    const loadedProfile = loadedSettings.profile ?? {};

    // Multi-Profile-Migration: wenn profiles[] bereits im Storage steht, ist
    // die Migration schon gelaufen — wir uebernehmen sie 1:1. Sonst bauen wir
    // profiles[0] aus dem alten Single-profile-Slot. loadedProfile wird durch
    // dieselbe Feld-fuer-Feld-Sanierung geschickt wie im Legacy-Pfad.
    const normalizeProfile = (raw, id) => ({
      id,
      name:                 isLegacyPreOnboarding ? null : (raw.name ?? null),
      gender:               isLegacyPreOnboarding ? null : (raw.gender ?? null),
      age:                  isLegacyPreOnboarding ? null : (raw.age ?? null),
      heightCm:             isLegacyPreOnboarding ? null : (raw.heightCm ?? null),
      weightKg:             isLegacyPreOnboarding ? null : (raw.weightKg ?? null),
      activityLevel:        isLegacyPreOnboarding ? null : (raw.activityLevel ?? null),
      goal:                 isLegacyPreOnboarding ? null : (raw.goal ?? null),
      dailyTargetOverride:  raw.dailyTargetOverride ?? null,
      breakfastKcal:        isLegacyPreOnboarding ? null : (raw.breakfastKcal ?? null),
      lunchKcal:            isLegacyPreOnboarding ? null : (raw.lunchKcal ?? null),
      showCalorieBar:       raw.showCalorieBar ?? true,
      macroPreset:          raw.macroPreset ?? 'balanced',
      macroTargets:         raw.macroTargets ?? null,
      favorites:            (raw.favorites && typeof raw.favorites === 'object') ? raw.favorites : {},
      preferences: {
        meat:       raw.preferences?.meat ?? false,
        fish:       raw.preferences?.fish ?? false,
        vegetarian: raw.preferences?.vegetarian ?? false,
      },
      cuisines: {
        asian:         raw.cuisines?.asian ?? false,
        mediterranean: raw.cuisines?.mediterranean ?? false,
        middleEast:    raw.cuisines?.middleEast ?? false,
        americas:      raw.cuisines?.americas ?? false,
      },
    });

    let profiles;
    if (Array.isArray(loadedSettings.profiles) && loadedSettings.profiles.length > 0) {
      // Neuer State — profiles[] direkt uebernehmen, aber jedes Element durch
      // normalizeProfile schicken damit fehlende Felder aufgefuellt sind.
      profiles = loadedSettings.profiles.map((p, i) => normalizeProfile(p || {}, p?.id || `u${i + 1}`));
      // Migration Prefs + Kuechen pro Profil: wenn profiles[i] die neuen
      // Slots nicht deklariert hat, aus globalen settings uebernehmen (nur
      // in profiles[0], andere Profile bleiben leer).
      const legacyGlobalPrefs = loadedSettings.preferences;
      const hasProfilePrefs = profiles.some((p) => p.preferences?.meat || p.preferences?.fish || p.preferences?.vegetarian);
      if (!hasProfilePrefs && legacyGlobalPrefs && (legacyGlobalPrefs.meat || legacyGlobalPrefs.fish || legacyGlobalPrefs.vegetarian)) {
        profiles[0].preferences = {
          meat: !!legacyGlobalPrefs.meat,
          fish: !!legacyGlobalPrefs.fish,
          vegetarian: !!legacyGlobalPrefs.vegetarian,
        };
      }
      const legacyGlobalCuisines = loadedSettings.cuisines;
      const hasProfileCuisines = profiles.some((p) => p.cuisines?.asian || p.cuisines?.mediterranean || p.cuisines?.middleEast || p.cuisines?.americas);
      if (!hasProfileCuisines && legacyGlobalCuisines && (legacyGlobalCuisines.asian || legacyGlobalCuisines.mediterranean || legacyGlobalCuisines.middleEast || legacyGlobalCuisines.americas)) {
        profiles[0].cuisines = {
          asian:         !!legacyGlobalCuisines.asian,
          mediterranean: !!legacyGlobalCuisines.mediterranean,
          middleEast:    !!legacyGlobalCuisines.middleEast,
          americas:      !!legacyGlobalCuisines.americas,
        };
      }
    } else {
      // Legacy oder Fresh Install: aus altem profile-Slot bauen. Bei Fresh
      // Install ist loadedProfile leer -> normalizeProfile liefert Blank u1.
      profiles = [normalizeProfile(loadedProfile, 'u1')];
      const legacyGlobalPrefs = loadedSettings.preferences;
      if (legacyGlobalPrefs) {
        profiles[0].preferences = {
          meat: !!legacyGlobalPrefs.meat,
          fish: !!legacyGlobalPrefs.fish,
          vegetarian: !!legacyGlobalPrefs.vegetarian,
        };
      }
      const legacyGlobalCuisines = loadedSettings.cuisines;
      if (legacyGlobalCuisines) {
        profiles[0].cuisines = {
          asian:         !!legacyGlobalCuisines.asian,
          mediterranean: !!legacyGlobalCuisines.mediterranean,
          middleEast:    !!legacyGlobalCuisines.middleEast,
          americas:      !!legacyGlobalCuisines.americas,
        };
      }
    }
    // Aktives Profil = profiles[0]. Wenn ein alter State activeProfileId auf
    // ein anderes Profil zeigt, verschieben wir dieses an Position 0 damit
    // die neue Reihenfolgen-Semantik konsistent bleibt.
    const legacyActive = loadedSettings.activeProfileId;
    if (legacyActive && profiles[0]?.id !== legacyActive) {
      const idx = profiles.findIndex((p) => p.id === legacyActive);
      if (idx > 0) {
        const [p] = profiles.splice(idx, 1);
        profiles.unshift(p);
      }
    }
    const activeProfileId = profiles[0].id;

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
      profiles,
      activeProfileId,
      // profile-Mirror wird beim naechsten saveState() aus getActiveProfile()
      // gespiegelt. Fuer die aktuelle In-Memory-Session initial gleich der
      // aktive Profil-Eintrag; ein direkter Read (den es nicht mehr geben
      // sollte) wuerde damit dennoch plausible Werte finden.
      profile: profiles.find((p) => p.id === activeProfileId) ?? profiles[0],
      // Standard-Profil: aus Storage laden falls vorhanden (via normalize
      // durchgeschickt damit alle Felder sanitized sind), sonst frische
      // Defaults aus DEFAULT_USER.
      standardProfile: loadedSettings.standardProfile
        ? { ...createStandardProfileDefaults(), ...normalizeProfile(loadedSettings.standardProfile, '_default') }
        : createStandardProfileDefaults(),
      theme: loadedSettings.theme ?? 'auto',
    };
    return true;
  } catch (_) {
    return false;
  }
}
