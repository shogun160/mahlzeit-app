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

// Wird in spaeteren Tasks um fetchRemoteJsons + performImport erweitert.
