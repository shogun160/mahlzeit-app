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
    const [dishesRes, ingredientsRes] = await Promise.all([
      fetch(dishesUrl, { cache: 'no-store' }),
      fetch(ingredientsUrl, { cache: 'no-store' }),
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
