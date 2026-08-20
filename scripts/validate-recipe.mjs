// Validator fuer Community-PRs mit neuen Rezepten.
// Wird von .github/workflows/pr-recipe-check.yml aufgerufen.
//
// Prueft:
// - Bild-Files (Dimension, Groesse, Format) via sharp
// - JSON-Struktur (Pflichtfelder, Enum, ID-Eindeutigkeit, Sanity)
// - Ingredient-Keys existieren, Prefix-Kollision als Warnung
// - Deklarierte Makros gegen die Zutatensumme (Drift-Guard)
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
import { findMakroDrift, TOL_KCAL, TOL_MAKRO } from './lib/makro-drift.mjs';

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

  // Neue Dishes = alle die im aktuellen JSON drin sind, aber nicht in base.
  const newDishes = (dishes?.dishes || []).filter((d) => !baseIds.has(d.id));

  for (const d of newDishes) {
    for (const field of REQUIRED_DISH_FIELDS) {
      if (!(field in d) || d[field] === null || d[field] === undefined) {
        err('src/data/dishes.json', 0, `Rezept "${d.name || '?'}" (id=${d.id ?? '?'}): Pflichtfeld \`${field}\` fehlt.`);
      }
    }

    if (d.cuisineGroup && !CUISINE_GROUPS.includes(d.cuisineGroup)) {
      err('src/data/dishes.json', 0, `Rezept "${d.name}" (id=${d.id}): \`cuisineGroup: "${d.cuisineGroup}"\` ist nicht im Enum. Erlaubt: ${CUISINE_GROUPS.join(', ')}`);
    }
  }

  // ID-Eindeutigkeit im aktuellen JSON.
  const seen = new Set();
  for (const d of dishes?.dishes || []) {
    if (seen.has(d.id)) err('src/data/dishes.json', 0, `Doppelte ID: ${d.id}`);
    seen.add(d.id);
  }

  // Ingredient-Keys existieren + Sanity-Check pro neuem Dish.
  const ingredientKeys = new Set(Object.keys(ingredients?.ingredients || {}));
  for (const d of newDishes) {
    for (const ing of d.ingredients || []) {
      if (!ingredientKeys.has(ing.key)) {
        err('src/data/dishes.json', 0, `Rezept "${d.name}" (id=${d.id}): Zutaten-Key \`${ing.key}\` existiert nicht in ingredients.json.`);
      }
    }

    // Naehrwerte-Sanity: |declared kcal - (p*4 + kh*4 + f*9)| < KCAL_SANITY_TOL
    const calc = (d.p || 0) * 4 + (d.kh || 0) * 4 + (d.f || 0) * 9;
    if (Math.abs((d.kcal || 0) - calc) >= KCAL_SANITY_TOL) {
      err('src/data/dishes.json', 0, `Rezept "${d.name}" (id=${d.id}): kcal (${d.kcal}) weicht zu stark vom Makro-Rechner ab (${Math.round(calc)}).`);
    }
  }

  // Makro-Drift: deklarierte kcal/p/kh/f gegen die Zutatensumme.
  //
  // Bewusst ueber ALLE Rezepte, nicht nur die neuen: eine Aenderung an
  // ingredients.json verschiebt auch bestehende Gerichte, und genau so ist
  // der Drift beim letzten Mal entstanden. Laeuft nur, wenn der PR eines der
  // beiden Daten-Files angefasst hat — sonst kann sich nichts verschoben haben.
  if (changedDishesJson || changedIngredientsJson) {
    const drift = findMakroDrift(dishes?.dishes || [], ingredients?.ingredients || {});
    for (const t of drift) {
      const details = t.abweichungen
        .map((a) => `${a.makro} ${a.ist} deklariert vs. ${a.soll.toFixed(0)} gerechnet (${(a.pct > 0 ? '+' : '') + a.pct.toFixed(1)} %)`)
        .join(', ');
      err(
        'src/data/dishes.json',
        0,
        `Rezept "${t.name}" (id=${t.id}): Makros weichen von der Zutatensumme ab — ${details}. ` +
        `Toleranz: kcal ${TOL_KCAL} %, p/kh/f ${TOL_MAKRO} %. Die App leitet den Portionsfaktor aus kcal ab, ` +
        `ein falsches Feld skaliert die Kochmenge mit.`
      );
    }
  }

  // Prefix-Warnung: neue Ingredient-Keys, die mit denselben 4 Zeichen starten wie existierende.
  const baseIngredients = await loadBaseJson('src/data/ingredients.json');
  const baseKeys = new Set(Object.keys(baseIngredients?.ingredients || {}));
  const newKeys = Object.keys(ingredients?.ingredients || {}).filter((k) => !baseKeys.has(k));
  for (const nk of newKeys) {
    const prefix = nk.slice(0, PREFIX_LEN);
    for (const ek of baseKeys) {
      if (ek.slice(0, PREFIX_LEN) === prefix) {
        warn('src/data/ingredients.json', `Prefix-Kollision: neuer Key \`${nk}\` startet wie bestehender \`${ek}\` — bitte pruefen ob es sich um dieselbe Zutat handelt.`);
        break;
      }
    }
  }

  // Bild-Checks: fuer jedes neue Dish muss public/dishes/dish-<id>.jpg existieren.
  const newImageIds = new Set(newDishes.map((d) => d.id));
  for (const id of newImageIds) {
    const imgPath = `public/dishes/dish-${id}.jpg`;
    let s;
    try {
      s = await stat(imgPath);
    } catch (_) {
      err(imgPath, 0, `Bild fehlt: erwartet ${imgPath} fuer neues Rezept id=${id}.`);
      continue;
    }
    if (s.size > MAX_IMAGE_BYTES) {
      err(imgPath, 0, `Bild zu gross: ${Math.round(s.size / 1024)} kB, erlaubt max. ${Math.round(MAX_IMAGE_BYTES / 1024)} kB.`);
    }
    try {
      const meta = await sharp(imgPath).metadata();
      if (meta.format !== 'jpeg') {
        err(imgPath, 0, `Bild-Format ${meta.format} — erwartet JPEG.`);
      }
      if (Math.abs((meta.width || 0) - IMAGE_SIZE) > IMAGE_SIZE_TOL || Math.abs((meta.height || 0) - IMAGE_SIZE) > IMAGE_SIZE_TOL) {
        err(imgPath, 0, `Bild-Dimension ${meta.width}x${meta.height} — erwartet ${IMAGE_SIZE}x${IMAGE_SIZE} (Toleranz ±${IMAGE_SIZE_TOL}px).`);
      }
    } catch (e) {
      err(imgPath, 0, `Bild konnte nicht gelesen werden: ${e.message}`);
    }
  }

  // Zusaetzliche geaenderte Bilder (nicht zu neuen Dishes gehoerend) auch pruefen.
  for (const imgFile of changedImages) {
    const match = imgFile.match(/dish-(\d+)\.jpg$/);
    if (!match) continue;
    const id = Number(match[1]);
    if (newImageIds.has(id)) continue;   // schon oben geprueft
    // Fuer Update von bestehendem Bild: gleiche Regeln.
    try {
      const s = await stat(imgFile);
      if (s.size > MAX_IMAGE_BYTES) err(imgFile, 0, `Bild zu gross: ${Math.round(s.size / 1024)} kB.`);
      const meta = await sharp(imgFile).metadata();
      if (meta.format !== 'jpeg') err(imgFile, 0, `Bild-Format ${meta.format} — erwartet JPEG.`);
      if (Math.abs((meta.width || 0) - IMAGE_SIZE) > IMAGE_SIZE_TOL || Math.abs((meta.height || 0) - IMAGE_SIZE) > IMAGE_SIZE_TOL) {
        err(imgFile, 0, `Bild-Dimension ${meta.width}x${meta.height} — erwartet ${IMAGE_SIZE}x${IMAGE_SIZE}.`);
      }
    } catch (e) {
      err(imgFile, 0, `Bild konnte nicht gelesen werden: ${e.message}`);
    }
  }

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
