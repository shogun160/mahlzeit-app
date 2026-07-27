// Sanity-Simulation fuer den Remote-Merger + Cleanup + Missing-Ingredient-Filter.
// Testet die reine Logik ueber die exportierte Funktion mergeRemote(),
// nicht die Modul-Load-Reihenfolge selbst.
// Aufruf: `node src/data/dishes.test.mjs`.

import { mergeRemote } from './dishes.js';

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  OK  ', name);
  else { failures++; console.error('  FAIL', name, detail ? `-> ${detail}` : ''); }
}

// Testfixtures.
const bundled = [
  { id: 1, name: 'Bundle-1', ingredients: [{ key: 'karotte', grams: 100 }] },
  { id: 2, name: 'Bundle-2', ingredients: [{ key: 'reis_basmati', grams: 80 }] },
];
const bundledIngredients = {
  karotte:      { label: 'Karotte',       cat: 'frisch', unit: 'g', per100g: { kcal: 41, p: 0.9, kh: 9.6, f: 0.2 } },
  reis_basmati: { label: 'Basmati-Reis',  cat: 'trocken', unit: 'g', per100g: { kcal: 350, p: 7.0, kh: 78,  f: 0.9 } },
};

// -- Fall 1: Remote hat neues Rezept, das nicht in Bundled ist --
{
  const remote = [
    { id: 99, name: 'Remote-99', ingredients: [{ key: 'karotte', grams: 50 }] },
  ];
  const result = mergeRemote({
    bundled, bundledIngredients,
    remoteDishes: remote,
    remoteIngredients: {},
  });
  check('Fall 1: dishes hat 3 Eintraege', result.dishes.length === 3);
  check('Fall 1: Remote-99 im Ergebnis', result.dishes.some((d) => d.id === 99));
  check('Fall 1: keine Warnungen', result.warnings.length === 0);
  check('Fall 1: keine ID zum Cleanup', result.staleRemoteIds.length === 0);
}

// -- Fall 2: Remote-Rezept mit ID die inzwischen bundled ist --
{
  const remote = [
    { id: 2, name: 'REMOTE-Doublet', ingredients: [{ key: 'karotte', grams: 50 }] },
    { id: 99, name: 'Remote-99', ingredients: [{ key: 'karotte', grams: 50 }] },
  ];
  const result = mergeRemote({
    bundled, bundledIngredients,
    remoteDishes: remote,
    remoteIngredients: {},
  });
  check('Fall 2: Bundle-2 (nicht REMOTE-Doublet) im Ergebnis', result.dishes.find((d) => d.id === 2)?.name === 'Bundle-2');
  check('Fall 2: Remote-99 trotzdem drin', result.dishes.some((d) => d.id === 99));
  check('Fall 2: staleRemoteIds enthaelt 2', result.staleRemoteIds.includes(2));
  check('Fall 2: staleRemoteIds enthaelt NICHT 99', !result.staleRemoteIds.includes(99));
}

// -- Fall 3: Remote-Rezept referenziert unbekannten Ingredient-Key --
{
  const remote = [
    { id: 99, name: 'Kaputt', ingredients: [{ key: 'butter_ghee', grams: 20 }] },
    { id: 100, name: 'Sauber', ingredients: [{ key: 'karotte', grams: 50 }] },
  ];
  const result = mergeRemote({
    bundled, bundledIngredients,
    remoteDishes: remote,
    remoteIngredients: {},
  });
  check('Fall 3: Sauber (id=100) im Ergebnis', result.dishes.some((d) => d.id === 100));
  check('Fall 3: Kaputt (id=99) NICHT im Ergebnis', !result.dishes.some((d) => d.id === 99));
  check('Fall 3: Warnung fuer id=99 vorhanden', result.warnings.some((w) => w.id === 99 && w.missingKey === 'butter_ghee'));
}

// -- Fall 4: Remote-Ingredient wird respektiert (fuer neuen Ingredient-Key) --
{
  const remote = [
    { id: 99, name: 'Neu', ingredients: [{ key: 'butter_ghee', grams: 20 }] },
  ];
  const remoteIngredients = {
    butter_ghee: { label: 'Butterschmalz', cat: 'kuehlung', unit: 'g', per100g: { kcal: 900, p: 0, kh: 0, f: 100 } },
  };
  const result = mergeRemote({
    bundled, bundledIngredients,
    remoteDishes: remote,
    remoteIngredients,
  });
  check('Fall 4: Neu (id=99) im Ergebnis', result.dishes.some((d) => d.id === 99));
  check('Fall 4: butter_ghee Ingredient im gemergten Ingredients', result.ingredients.butter_ghee?.label === 'Butterschmalz');
  check('Fall 4: bundled karotte hat Vorrang (nicht ueberschrieben)', result.ingredients.karotte?.label === 'Karotte');
}

// -- Fall 5: Bundled Ingredient hat Vorrang, Remote-Doppelung wird ignoriert --
{
  const remote = [];
  const remoteIngredients = {
    karotte: { label: 'FAKE-KAROTTE', cat: 'x', unit: 'g', per100g: { kcal: 999, p: 0, kh: 0, f: 0 } },
  };
  const result = mergeRemote({
    bundled, bundledIngredients,
    remoteDishes: remote,
    remoteIngredients,
  });
  check('Fall 5: karotte-Label ist bundled-Wert', result.ingredients.karotte.label === 'Karotte');
}

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log('\nAlle Checks OK.');
