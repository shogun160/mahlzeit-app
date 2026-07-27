// Serialisierung / Deserialisierung Profil <-> Wire-Format fuer Teilen/Import.
// Details: docs/redesign/2026-07-27-profil-teilen-import-design.md

const WIRE_TYPE = 'mahlzeit-profile';
const WIRE_VERSION = 1;
const FAVORITES_CAP = 15;
const MAX_PAYLOAD_BYTES = 20 * 1024;

const VALID_GENDER = new Set(['male', 'female']);
const VALID_ACTIVITY = new Set([1, 2, 3, 4, 5]);
const VALID_GOAL = new Set(['maintain', 'lose', 'gain']);
const VALID_MACRO_PRESET = new Set(['balanced', 'protein', 'lowcarb', 'lowfat']);

// Base64 isomorph (Browser: btoa/atob; Node fuer Tests: Buffer).
function toBase64(str) {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
  return Buffer.from(str, 'utf8').toString('base64');
}
function fromBase64(str) {
  if (typeof atob === 'function') return decodeURIComponent(escape(atob(str)));
  return Buffer.from(str, 'base64').toString('utf8');
}

export function encodeProfile(profile) {
  const favEntries = Object.entries(profile.favorites || {}).filter(([, v]) => v === true);
  const favoritesTotal = favEntries.length;
  const shared = favEntries.slice(0, FAVORITES_CAP);
  const favorites = Object.fromEntries(shared);
  const wire = {
    type: WIRE_TYPE,
    version: WIRE_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      name: profile.name ?? null,
      gender: profile.gender ?? null,
      age: profile.age ?? null,
      heightCm: profile.heightCm ?? null,
      weightKg: profile.weightKg ?? null,
      activityLevel: profile.activityLevel ?? null,
      goal: profile.goal ?? null,
      dailyTargetOverride: profile.dailyTargetOverride ?? null,
      breakfastKcal: profile.breakfastKcal ?? null,
      lunchKcal: profile.lunchKcal ?? null,
      showCalorieBar: profile.showCalorieBar !== false,
      macroPreset: profile.macroPreset ?? 'balanced',
      macroTargets: profile.macroTargets ?? null,
      preferences: {
        meat: !!profile.preferences?.meat,
        fish: !!profile.preferences?.fish,
        vegetarian: !!profile.preferences?.vegetarian,
      },
      cuisines: {
        asian: !!profile.cuisines?.asian,
        mediterranean: !!profile.cuisines?.mediterranean,
        middleEast: !!profile.cuisines?.middleEast,
        americas: !!profile.cuisines?.americas,
      },
      favorites,
    },
  };
  const text = toBase64(JSON.stringify(wire));
  return { text, meta: { favoritesTotal, favoritesShared: shared.length } };
}

export function decodeProfile(input, { knownDishIds } = {}) {
  if (typeof input !== 'string') return { error: 'PARSE_ERROR', detail: 'input not string' };
  if (input.length > MAX_PAYLOAD_BYTES) return { error: 'TOO_LARGE', detail: `${input.length} bytes` };
  let json;
  try {
    const trimmed = input.trim();
    const raw = trimmed.startsWith('{') ? trimmed : fromBase64(trimmed);
    json = JSON.parse(raw);
  } catch (e) {
    return { error: 'PARSE_ERROR', detail: String(e && e.message || e) };
  }
  if (!json || json.type !== WIRE_TYPE) return { error: 'BAD_TYPE', detail: `type=${json?.type}` };
  if (json.version !== WIRE_VERSION) return { error: 'BAD_VERSION', detail: `version=${json.version}` };
  const p = json.profile;
  if (!p || typeof p !== 'object') return { error: 'INVALID_FIELD', detail: 'profile missing' };

  const enumErr = validateEnums(p);
  if (enumErr) return { error: 'INVALID_FIELD', detail: enumErr };

  const filteredFavorites = {};
  let skipped = 0;
  const knownSet = knownDishIds ? new Set(knownDishIds.map(String)) : null;
  for (const [dishId, on] of Object.entries(p.favorites || {})) {
    if (on !== true) continue;
    if (knownSet && !knownSet.has(String(dishId))) { skipped++; continue; }
    filteredFavorites[dishId] = true;
  }

  const sanitized = {
    name: typeof p.name === 'string' ? p.name : null,
    gender: p.gender ?? null,
    age: typeof p.age === 'number' ? p.age : null,
    heightCm: typeof p.heightCm === 'number' ? p.heightCm : null,
    weightKg: typeof p.weightKg === 'number' ? p.weightKg : null,
    activityLevel: typeof p.activityLevel === 'number' ? p.activityLevel : null,
    goal: p.goal ?? null,
    dailyTargetOverride: typeof p.dailyTargetOverride === 'number' ? p.dailyTargetOverride : null,
    breakfastKcal: typeof p.breakfastKcal === 'number' ? p.breakfastKcal : null,
    lunchKcal: typeof p.lunchKcal === 'number' ? p.lunchKcal : null,
    showCalorieBar: p.showCalorieBar !== false,
    macroPreset: p.macroPreset ?? 'balanced',
    macroTargets: p.macroTargets && typeof p.macroTargets === 'object' ? p.macroTargets : null,
    preferences: {
      meat: !!p.preferences?.meat,
      fish: !!p.preferences?.fish,
      vegetarian: !!p.preferences?.vegetarian,
    },
    cuisines: {
      asian: !!p.cuisines?.asian,
      mediterranean: !!p.cuisines?.mediterranean,
      middleEast: !!p.cuisines?.middleEast,
      americas: !!p.cuisines?.americas,
    },
    favorites: filteredFavorites,
  };
  return { profile: sanitized, meta: { favoritesSkipped: skipped } };
}

function validateEnums(p) {
  if (p.gender != null && !VALID_GENDER.has(p.gender)) return `gender=${p.gender}`;
  if (p.activityLevel != null && !VALID_ACTIVITY.has(p.activityLevel)) return `activityLevel=${p.activityLevel}`;
  if (p.goal != null && !VALID_GOAL.has(p.goal)) return `goal=${p.goal}`;
  if (p.macroPreset != null && !VALID_MACRO_PRESET.has(p.macroPreset)) return `macroPreset=${p.macroPreset}`;
  return null;
}
