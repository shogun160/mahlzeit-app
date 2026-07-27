// Manuelle Sanity-Simulation fuer payload.js. Guardrail 10: keine Framework-
// Tests, nur ausfuehrbares Node-Script. Aufruf: `node src/profile-share/payload.test.mjs`.
// Exit-Code != 0 bei Fehler.

import { encodeProfile, decodeProfile } from './payload.js';

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log('  OK  ', name);
  } else {
    failures++;
    console.error('  FAIL', name, detail ? `-> ${detail}` : '');
  }
}

// -- Round-Trip mit voll ausgefuelltem Profil --
const source = {
  id: 'u1',
  name: 'Oliver',
  gender: 'male',
  age: 38,
  heightCm: 180,
  weightKg: 78,
  activityLevel: 3,
  goal: 'maintain',
  dailyTargetOverride: 2200,
  breakfastKcal: 550,
  lunchKcal: 770,
  showCalorieBar: true,
  macroPreset: 'balanced',
  macroTargets: null,
  preferences: { meat: true, fish: true, vegetarian: false },
  cuisines: { asian: true, mediterranean: false, middleEast: false, americas: false },
  favorites: { '3': true, '12': true },
};

const { text, meta } = encodeProfile(source);
check('encode: text vorhanden', typeof text === 'string' && text.length > 0);
check('encode: favoritesShared = 2', meta.favoritesShared === 2);
check('encode: favoritesTotal = 2', meta.favoritesTotal === 2);

const decoded = decodeProfile(text, { knownDishIds: [3, 12, 99] });
check('decode: kein Fehler', !decoded.error, decoded.error);
check('decode: name uebernommen', decoded.profile?.name === 'Oliver');
check('decode: id NICHT drin', !('id' in (decoded.profile || {})));
check('decode: gender male', decoded.profile?.gender === 'male');
check('decode: favorites 2 vorhanden', Object.keys(decoded.profile?.favorites || {}).length === 2);
check('decode: skipped = 0', decoded.meta?.favoritesSkipped === 0);

// -- Favoriten-Filter (unbekannte IDs) --
const decodedFiltered = decodeProfile(text, { knownDishIds: [3] });
check('filter: nur bekannte Favoriten', Object.keys(decodedFiltered.profile.favorites).length === 1);
check('filter: skipped = 1', decodedFiltered.meta.favoritesSkipped === 1);

// -- Favoriten-Cap 15 --
const many = {};
for (let i = 1; i <= 30; i++) many[String(i)] = true;
const bigSource = { ...source, favorites: many };
const bigEnc = encodeProfile(bigSource);
check('cap: shared = 15', bigEnc.meta.favoritesShared === 15);
check('cap: total = 30', bigEnc.meta.favoritesTotal === 30);
const bigDec = decodeProfile(bigEnc.text);
check('cap: decoded hat 15 Favoriten', Object.keys(bigDec.profile.favorites).length === 15);

// -- Fehlerfaelle --
const err1 = decodeProfile('not-base64-@@@');
check('err: PARSE_ERROR bei Muell', err1.error === 'PARSE_ERROR', err1.error);

const err2 = decodeProfile(Buffer.from(JSON.stringify({ type: 'foo', version: 1, profile: {} }), 'utf8').toString('base64'));
check('err: BAD_TYPE bei falschem Typ', err2.error === 'BAD_TYPE', err2.error);

const err3 = decodeProfile(Buffer.from(JSON.stringify({ type: 'mahlzeit-profile', version: 99, profile: {} }), 'utf8').toString('base64'));
check('err: BAD_VERSION bei alter/neuer Version', err3.error === 'BAD_VERSION', err3.error);

const err4 = decodeProfile(Buffer.from(JSON.stringify({
  type: 'mahlzeit-profile', version: 1,
  profile: { gender: 'martian' },
}), 'utf8').toString('base64'));
check('err: INVALID_FIELD bei ungueltigem gender', err4.error === 'INVALID_FIELD', err4.error);

const err5 = decodeProfile('A'.repeat(21 * 1024));
check('err: TOO_LARGE bei > 20 KB', err5.error === 'TOO_LARGE', err5.error);

// -- Legacy: JSON direkt statt Base64 (Debug-Modus) --
const jsonInput = JSON.stringify({
  type: 'mahlzeit-profile', version: 1, exportedAt: 'x',
  profile: { ...source, id: undefined },
});
const jsonDec = decodeProfile(jsonInput);
check('legacy: JSON direkt akzeptiert', !jsonDec.error, jsonDec.error);

// -- Payload ohne Name --
const nameless = { ...source, name: null };
const namelessEnc = encodeProfile(nameless);
const namelessDec = decodeProfile(namelessEnc.text);
check('null-name: decoded name = null', namelessDec.profile.name === null);

if (failures > 0) {
  console.error(`\n${failures} Test(s) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle Payload-Tests OK.');
