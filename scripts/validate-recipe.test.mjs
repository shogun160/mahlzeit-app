// Node-Test fuer validate-recipe.mjs.
// Baut fuer jeden Test-Fall ein temporaeres Git-Repo unter /tmp,
// legt Fixture-Files ab, macht einen Commit, dann einen "PR-Branch"
// mit dem Test-Content, ruft den Validator und pruefte Exit + Output.
//
// Aufruf: `node scripts/validate-recipe.test.mjs`.

import { mkdtempSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const validatorPath = path.resolve(new URL('.', import.meta.url).pathname, 'validate-recipe.mjs');

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('  OK  ', name);
  else { failures++; console.error('  FAIL', name, detail ? `-> ${detail}` : ''); }
}

// Baut ein temporaeres Repo mit Basis-Files auf main und Test-Files auf PR-Branch.
function makeRepo({ mainDishes, mainIngredients, prDishes, prIngredients, prImageIds = [] }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'validator-test-'));

  const runGit = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });

  runGit('init', '-b', 'main');
  runGit('config', 'user.email', 'test@example.com');
  runGit('config', 'user.name', 'Test');

  mkdirSync(path.join(dir, 'src/data'), { recursive: true });
  mkdirSync(path.join(dir, 'public/dishes'), { recursive: true });

  writeFileSync(path.join(dir, 'src/data/dishes.json'), JSON.stringify(mainDishes, null, 2));
  writeFileSync(path.join(dir, 'src/data/ingredients.json'), JSON.stringify(mainIngredients, null, 2));

  runGit('add', '.');
  runGit('commit', '-m', 'main');

  // "origin/main" simulieren durch remote add zu sich selbst — dann fetch.
  runGit('remote', 'add', 'origin', dir);
  runGit('fetch', 'origin', 'main');

  // PR-Branch
  runGit('checkout', '-b', 'pr');
  writeFileSync(path.join(dir, 'src/data/dishes.json'), JSON.stringify(prDishes, null, 2));
  writeFileSync(path.join(dir, 'src/data/ingredients.json'), JSON.stringify(prIngredients, null, 2));
  for (const id of prImageIds) {
    // 1x1 pixel jpeg (base64). Nicht 800x800, aber existiert - wird in B.4
    // von sharp geprueft, hier reicht Existenz fuer Pflichtfeld-Check.
    const jpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AH//Z', 'base64');
    writeFileSync(path.join(dir, `public/dishes/dish-${id}.jpg`), jpg);
  }
  runGit('add', '.');
  runGit('commit', '-m', 'pr');

  return dir;
}

function runValidator(cwd) {
  return spawnSync('node', [validatorPath], { cwd, encoding: 'utf-8' });
}

// -- Fall 1: sauberes neues Rezept -> exit 0
{
  const dir = makeRepo({
    mainDishes: { schemaVersion: 1, dishes: [{ id: 1, name: 'Basis', cuisine: 'X', cuisineGroup: 'asian', cooktime: 10, kcal: 500, p: 20, kh: 60, f: 15, tags: [], ingredients: [{ key: 'karotte', grams: 100 }], steps: ['Kochen.'] }] },
    mainIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'Karotte', cat: 'frisch', unit: 'g', per100g: { kcal: 41, p: 0.9, kh: 9.6, f: 0.2 } } } },
    prDishes: {
      schemaVersion: 1,
      dishes: [
        { id: 1, name: 'Basis', cuisine: 'X', cuisineGroup: 'asian', cooktime: 10, kcal: 500, p: 20, kh: 60, f: 15, tags: [], ingredients: [{ key: 'karotte', grams: 100 }], steps: ['Kochen.'] },
        { id: 2, name: 'Neu', cuisine: 'Y', cuisineGroup: 'mediterranean', cooktime: 20, kcal: 600, p: 30, kh: 50, f: 20, tags: [], ingredients: [{ key: 'karotte', grams: 200 }], steps: ['Braten.'] },
      ],
    },
    prIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'Karotte', cat: 'frisch', unit: 'g', per100g: { kcal: 41, p: 0.9, kh: 9.6, f: 0.2 } } } },
    prImageIds: [2],
  });
  const res = runValidator(dir);
  check('Fall 1: sauberes Rezept -> exit 0', res.status === 0, res.stdout + res.stderr);
}

// -- Fall 2: fehlendes Pflichtfeld -> exit 1
{
  const dir = makeRepo({
    mainDishes: { schemaVersion: 1, dishes: [] },
    mainIngredients: { schemaVersion: 1, ingredients: {} },
    prDishes: { schemaVersion: 1, dishes: [{ id: 5, name: 'Ohne cuisine' /* fehlt */ }] },
    prIngredients: { schemaVersion: 1, ingredients: {} },
  });
  const res = runValidator(dir);
  check('Fall 2: fehlende Felder -> exit 1', res.status === 1);
  check('Fall 2: Fehler-Text erwaehnt cuisine', res.stdout.includes('cuisine'), res.stdout);
}

// -- Fall 3: ungueltige cuisineGroup -> exit 1
{
  const dir = makeRepo({
    mainDishes: { schemaVersion: 1, dishes: [] },
    mainIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'K', cat: 'x', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } } } },
    prDishes: { schemaVersion: 1, dishes: [{ id: 5, name: 'X', cuisine: 'Y', cuisineGroup: 'martian', cooktime: 10, kcal: 500, p: 20, kh: 60, f: 15, tags: [], ingredients: [{ key: 'karotte', grams: 100 }], steps: ['Kochen.'] }] },
    prIngredients: { schemaVersion: 1, ingredients: { karotte: { label: 'K', cat: 'x', unit: 'g', per100g: { kcal: 0, p: 0, kh: 0, f: 0 } } } },
    prImageIds: [5],
  });
  const res = runValidator(dir);
  check('Fall 3: falsche cuisineGroup -> exit 1', res.status === 1);
  check('Fall 3: Enum-Text im Output', res.stdout.includes('cuisineGroup'), res.stdout);
}

if (failures > 0) { console.error(`\n${failures} FAILURES`); process.exit(1); }
console.log('\nAlle Checks OK.');
