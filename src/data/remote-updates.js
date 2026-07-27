// Remote-Rezept-Import: Fetcher, Schema-Version-Check, Diff, Orchestrierung.
// Wird von main.js (Auto-Check beim Start) und von der Settings-Rezepte-Section
// (manueller Button) aufgerufen.
//
// Design-Doc: docs/redesign/2026-07-27-rezept-import-design.md

import {
  dishesUrl, ingredientsUrl, dishImageUrl,
  SCHEMA_VERSION_DISHES, SCHEMA_VERSION_INGREDIENTS,
  AUTO_CHECK_INTERVAL_MS, MANUAL_RATE_LIMIT_MS,
  IMPORT_ENABLED,
} from './remote-config.js';
import { state, saveState } from '../state.js';
import { imageCache } from '../util/image-cache.js';
import { mergeRemote, rebuildDishes } from './dishes.js';
import dishesData from './dishes.json' with { type: 'json' };
import ingredientsData from './ingredients.json' with { type: 'json' };

const bundledDishes = dishesData.dishes;
const bundledIngredients = ingredientsData.ingredients;

export const SCHEMA_ERROR = Object.freeze({
  TOO_NEW: 'SCHEMA_TOO_NEW',
  TOO_OLD: 'SCHEMA_TOO_OLD',
  MISSING: 'SCHEMA_MISSING',
});

// Prueft schemaVersion-Feld im remote-JSON gegen die lokal erwartete Version.
// Rueckgabe: null bei Match, sonst ein SCHEMA_ERROR-Code.
export function checkSchemaVersion(remoteJson, expectedVersion) {
  const v = remoteJson?.schemaVersion;
  if (typeof v !== 'number') return SCHEMA_ERROR.MISSING;
  if (v > expectedVersion) return SCHEMA_ERROR.TOO_NEW;
  if (v < expectedVersion) return SCHEMA_ERROR.TOO_OLD;
  return null;
}

// Fetcher fuer beide JSON-Dateien parallel. Nutzt native fetch() (in Node 20+
// verfuegbar, in Browsern eh Standard, in Capacitor-WebViews ebenfalls).
//
// Rueckgabe im Erfolgsfall:
//   { ok: true, dishes: <parsedJson>, ingredients: <parsedJson> }
// Im Fehlerfall:
//   { ok: false, error: 'NETWORK' | 'PARSE' | 'SCHEMA_TOO_NEW' | 'SCHEMA_TOO_OLD' | 'SCHEMA_MISSING' }
//
// Der Aufrufer entscheidet, wie das UX auf die Fehler reagiert.
export async function fetchRemoteJsons() {
  let dishesJson;
  let ingredientsJson;

  try {
    // Cache-Buster: Android WebView (Capacitor) ignoriert `cache: 'no-store'`
    // teils, und GitHub raw hat einen 5-min CDN-Cache mit inkonsistenten
    // Fastly-Nodes. Query-Parameter zwingt frischen Fetch bei allen Layern.
    const bust = `?_=${Date.now()}`;
    const [dishesRes, ingredientsRes] = await Promise.all([
      fetch(dishesUrl + bust, { cache: 'no-store' }),
      fetch(ingredientsUrl + bust, { cache: 'no-store' }),
    ]);
    if (!dishesRes.ok || !ingredientsRes.ok) return { ok: false, error: 'NETWORK' };
    dishesJson = await dishesRes.json();
    ingredientsJson = await ingredientsRes.json();
  } catch (_) {
    return { ok: false, error: 'NETWORK' };
  }

  // Schema-Checks.
  const dishesErr = checkSchemaVersion(dishesJson, SCHEMA_VERSION_DISHES);
  const ingredientsErr = checkSchemaVersion(ingredientsJson, SCHEMA_VERSION_INGREDIENTS);
  const err = dishesErr || ingredientsErr;
  if (err) return { ok: false, error: err };

  return { ok: true, dishes: dishesJson, ingredients: ingredientsJson };
}

// Ermittelt welche Remote-Dishes wirklich neu sind — also weder bundled noch
// bereits in state.remoteDishes vorhanden.
export function diffRemoteAgainstLocal({ bundled, alreadyImported, remote }) {
  const known = new Set([
    ...bundled.map((d) => d.id),
    ...alreadyImported.map((d) => d.id),
  ]);
  const newIds = remote.filter((d) => !known.has(d.id)).map((d) => d.id);
  return { newIds };
}

// Orchestriert einen kompletten Import-Vorgang:
// 1. Fetch JSONs (mit Schema-Check)
// 2. Diff gegen bundled + bereits importierte → newIds
// 3. Wenn keine neuen IDs: return { ok: true, imported: [], warnings: [] }
// 4. Sonst: neue Rezepte + ihre neuen Ingredients ins State schreiben (via Merger)
// 5. Bilder sequentiell nachladen (Progress-Callback ruft Consumer alle Sekunden mit
//    { current, total }-Objekt)
// 6. State speichern, remoteNewIds ersetzen
//
// Signatur:
//   performImport({ onProgress? }) → Promise<{ ok, imported, warnings, error? }>
//
// onProgress erhaelt { phase: 'metadata' | 'images', current, total, currentName? }
export async function performImport({ onProgress } = {}) {
  if (!IMPORT_ENABLED) return { ok: false, error: 'DISABLED' };

  onProgress?.({ phase: 'metadata', current: 0, total: 1 });

  const fetched = await fetchRemoteJsons();
  if (!fetched.ok) return { ok: false, error: fetched.error };

  state.remoteLastFetchAt = new Date().toISOString();

  // Diff: welche IDs sind wirklich neu?
  const alreadyImported = state.remoteDishes;
  const { newIds } = diffRemoteAgainstLocal({
    bundled: bundledDishes,
    alreadyImported,
    remote: fetched.dishes.dishes,
  });

  if (newIds.length === 0) {
    state.remoteUpdatedAt = state.remoteLastFetchAt;
    state.remoteHasUpdates = false;
    saveState();
    return { ok: true, imported: [], warnings: [] };
  }

  // Neue Dishes rausziehen aus dem Remote-JSON.
  const newDishes = fetched.dishes.dishes.filter((d) => newIds.includes(d.id));

  // Neue Ingredients auch mitnehmen (alle die noch nicht bekannt sind).
  const knownKeys = new Set([
    ...Object.keys(bundledIngredients),
    ...Object.keys(state.remoteIngredients),
  ]);
  const newIngredients = {};
  for (const [key, ing] of Object.entries(fetched.ingredients.ingredients)) {
    if (!knownKeys.has(key)) newIngredients[key] = ing;
  }

  // Merger laufen lassen (Cleanup + Missing-Ingredient-Filter).
  const merged = mergeRemote({
    bundled: bundledDishes,
    bundledIngredients,
    remoteDishes: [...state.remoteDishes, ...newDishes],
    remoteIngredients: { ...state.remoteIngredients, ...newIngredients },
  });

  // Cleanup fuer stale-IDs aus dem Bild-Cache.
  for (const staleId of merged.staleRemoteIds) {
    imageCache.remove(staleId).catch(() => { /* fire-and-forget */ });
  }

  // Alle Dishes die den Missing-Ingredient-Filter ueberlebt haben.
  const survived = merged.dishes
    .filter((d) => newIds.includes(d.id))
    .map((d) => d.id);

  // State schreiben (aber nur die Remote-Anteile — die bundled bleiben in dishesData).
  state.remoteDishes = merged.dishes.filter((d) => !bundledDishes.some((b) => b.id === d.id));
  state.remoteIngredients = {};
  for (const [key, ing] of Object.entries(merged.ingredients)) {
    if (!(key in bundledIngredients)) state.remoteIngredients[key] = ing;
  }
  state.remoteNewIds = new Set(survived);

  // Live-Bindings aktualisieren: allDishes/dishesById/allDishIds sehen erst
  // nach diesem Call die neu importierten Rezepte. Ohne rebuildDishes()
  // wuerden Picker, Reroll, Detail-Sheet den Import ignorieren.
  rebuildDishes();

  // Bilder sequentiell downloaden.
  onProgress?.({ phase: 'images', current: 0, total: survived.length });
  let done = 0;
  for (const id of survived) {
    const dish = newDishes.find((d) => d.id === id);
    try {
      const res = await fetch(dishImageUrl(id));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      await imageCache.put(id, blob);
    } catch (_) {
      // Erst Retry nach 2s, dann Failure notieren.
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res2 = await fetch(dishImageUrl(id));
        if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
        const blob = await res2.blob();
        await imageCache.put(id, blob);
      } catch (_) {
        state.remoteImageFailures.add(id);
      }
    }
    done++;
    onProgress?.({ phase: 'images', current: done, total: survived.length, currentName: dish?.name });
  }

  state.remoteUpdatedAt = state.remoteLastFetchAt;
  state.remoteHasUpdates = false;
  saveState();

  return {
    ok: true,
    imported: survived,
    warnings: merged.warnings,
  };
}

// Silent Check ohne Import: fetched nur die JSONs und ermittelt newIds.
// Setzt state.remoteHasUpdates entsprechend. Kein Bild-Download, kein
// Sheet, kein Toast — laueft im Hintergrund beim App-Start.
//
// Bedingungen: IMPORT_ENABLED true, und (remoteUpdatedAt fehlt oder aelter
// als AUTO_CHECK_INTERVAL_MS).
export async function performAutoCheck() {
  if (!IMPORT_ENABLED) return;

  const now = Date.now();
  if (state.remoteUpdatedAt) {
    const last = new Date(state.remoteUpdatedAt).getTime();
    if (!isNaN(last) && (now - last) < AUTO_CHECK_INTERVAL_MS) return;
  }

  const fetched = await fetchRemoteJsons();
  state.remoteLastFetchAt = new Date().toISOString();
  if (!fetched.ok) {
    // Silent — auch bei Schema-Mismatch: kein Badge, weil User nichts tun kann.
    state.remoteHasUpdates = false;
    saveState();
    return;
  }

  const { newIds } = diffRemoteAgainstLocal({
    bundled: bundledDishes,
    alreadyImported: state.remoteDishes,
    remote: fetched.dishes.dishes,
  });

  state.remoteHasUpdates = newIds.length > 0;
  state.remoteUpdatedAt = state.remoteLastFetchAt;
  saveState();
}

// Prueft ob der 60s-Soft-Rate-Limit greift. true = Fetch erlaubt.
export function canManualFetch() {
  if (!state.remoteLastFetchAt) return true;
  const last = new Date(state.remoteLastFetchAt).getTime();
  if (isNaN(last)) return true;
  return (Date.now() - last) >= MANUAL_RATE_LIMIT_MS;
}
