// Validator fuer Community-PRs mit neuen Rezepten.
// Wird von .github/workflows/pr-recipe-check.yml aufgerufen.
//
// Prueft:
// - Bild-Files (Dimension, Groesse, Format) via sharp
// - JSON-Struktur (Pflichtfelder, Enum, ID-Eindeutigkeit, Sanity)
// - Ingredient-Keys existieren, Prefix-Kollision als Warnung
//
// Rueckgabe: 0 bei Success, 1 bei Fehler. Fehler + Warnungen werden
// als GitHub-Actions-Annotationen auf stdout ausgegeben:
//   ::error file=path,line=n::text
//   ::warning file=path::text
// Ausserdem wird ein Kommentar-Body auf stdout unter "---COMMENT---"
// ausgegeben, den die Action als PR-Kommentar posten kann.

import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';

const CUISINE_GROUPS = ['mediterranean', 'asian', 'middleEast', 'americas'];
const REQUIRED_DISH_FIELDS = ['id', 'name', 'cuisine', 'cuisineGroup', 'cooktime', 'kcal', 'p', 'kh', 'f', 'tags', 'ingredients', 'steps'];
const MAX_IMAGE_BYTES = 400 * 1024;
const IMAGE_SIZE = 800;
const IMAGE_SIZE_TOL = 10;
const KCAL_SANITY_TOL = 100;
const PREFIX_LEN = 4;

const errors = [];
const warnings = [];

function err(file, line, msg) {
  errors.push({ file, line, msg });
}

function warn(file, msg) {
  warnings.push({ file, msg });
}

async function main() {
  // Diff gegen Base-Branch ermitteln — welche Files hat der PR angefasst?
  const changed = getChangedFiles();
  const changedDishesJson = changed.includes('src/data/dishes.json');
  const changedIngredientsJson = changed.includes('src/data/ingredients.json');
  const changedImages = changed.filter((f) => f.startsWith('public/dishes/') && f.endsWith('.jpg'));

  // Basis-Files laden (aus dem PR-Checkout — das ist der neue Stand).
  const dishes = await loadJson('src/data/dishes.json');
  const ingredients = await loadJson('src/data/ingredients.json');

  // Base-Version fuer ID-Eindeutigkeits-Check.
  const baseDishes = await loadBaseJson('src/data/dishes.json');
  const baseIds = new Set((baseDishes?.dishes || []).map((d) => d.id));

  // Weitere Validation-Schritte werden in Task B.2/B.3/B.4 hinzugefuegt.

  emitAnnotations();
  printComment();
  process.exit(errors.length > 0 ? 1 : 0);
}

function getChangedFiles() {
  const res = spawnSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { encoding: 'utf-8' });
  if (res.status !== 0) return [];
  return res.stdout.trim().split('\n').filter(Boolean);
}

async function loadJson(relPath) {
  try {
    const raw = await readFile(relPath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    err(relPath, 0, `Konnte Datei nicht lesen oder parsen: ${e.message}`);
    return null;
  }
}

async function loadBaseJson(relPath) {
  const res = spawnSync('git', ['show', `origin/main:${relPath}`], { encoding: 'utf-8' });
  if (res.status !== 0) return null;
  try {
    return JSON.parse(res.stdout);
  } catch (_) {
    return null;
  }
}

function emitAnnotations() {
  for (const e of errors) console.log(`::error file=${e.file},line=${e.line}::${e.msg}`);
  for (const w of warnings) console.log(`::warning file=${w.file}::${w.msg}`);
}

function printComment() {
  if (errors.length === 0 && warnings.length === 0) return;
  const lines = ['---COMMENT---'];
  if (errors.length > 0) {
    lines.push('## ❌ Fehler', '');
    for (const e of errors) lines.push(`- \`${e.file}\`${e.line ? ` Zeile ${e.line}` : ''}: ${e.msg}`);
    lines.push('');
  }
  if (warnings.length > 0) {
    lines.push('## ⚠️ Warnungen', '');
    for (const w of warnings) lines.push(`- \`${w.file}\`: ${w.msg}`);
  }
  console.log(lines.join('\n'));
}

main().catch((e) => {
  console.error('Validator crashed:', e);
  process.exit(2);
});
