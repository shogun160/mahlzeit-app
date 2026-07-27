// Sanity-Simulation fuer checkSchemaVersion. Der eigentliche Fetch wird
// separat in Browser/APK getestet — hier nur reine Logik.
// Aufruf: `node src/data/remote-updates.test.mjs`.

import { checkSchemaVersion, SCHEMA_ERROR } from './remote-updates.js';

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  OK  ', name);
  else { failures++; console.error('  FAIL', name, detail ? `-> ${detail}` : ''); }
}

// -- Match --
check(
  'match: version == expected → null (kein Fehler)',
  checkSchemaVersion({ schemaVersion: 1 }, 1) === null,
);

// -- Zu neu --
check(
  'zu neu: remote > local → SCHEMA_TOO_NEW',
  checkSchemaVersion({ schemaVersion: 2 }, 1) === SCHEMA_ERROR.TOO_NEW,
);

// -- Zu alt --
check(
  'zu alt: remote < local → SCHEMA_TOO_OLD',
  checkSchemaVersion({ schemaVersion: 0 }, 1) === SCHEMA_ERROR.TOO_OLD,
);

// -- Fehlend --
check(
  'fehlend: kein schemaVersion → SCHEMA_MISSING',
  checkSchemaVersion({}, 1) === SCHEMA_ERROR.MISSING,
);
check(
  'null: schemaVersion null → SCHEMA_MISSING',
  checkSchemaVersion({ schemaVersion: null }, 1) === SCHEMA_ERROR.MISSING,
);

// -- Nicht-Zahl --
check(
  'string: schemaVersion "1" → SCHEMA_MISSING (nicht number)',
  checkSchemaVersion({ schemaVersion: '1' }, 1) === SCHEMA_ERROR.MISSING,
);

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log('\nAlle Checks OK.');
