// Audit: weichen die deklarierten Rezept-Makros (kcal/p/kh/f in dishes.json)
// von der Summe ihrer Zutaten (ingredients.json) ab?
//
// Die Rechnung selbst steht in lib/makro-drift.mjs — dieselbe Funktion nutzt
// der CI-Validator. Dieses Script ist der lokale Report-Lauf ueber den
// gesamten Katalog.
//
// Aufruf: node scripts/audit-makros.mjs
// Exit 1, sobald ein Rezept ueber der Toleranz liegt.

import { readFile } from 'node:fs/promises';
import { findMakroDrift, TOL_KCAL, TOL_MAKRO } from './lib/makro-drift.mjs';

const registry = JSON.parse(await readFile('src/data/ingredients.json', 'utf8')).ingredients;
const dishes = JSON.parse(await readFile('src/data/dishes.json', 'utf8')).dishes;

const treffer = findMakroDrift(dishes, registry);

console.log(`${dishes.length} Rezepte geprueft (Toleranz: kcal ${TOL_KCAL} %, p/kh/f ${TOL_MAKRO} %).\n`);

const fehlendeKeys = treffer.flatMap((t) => t.missing);
if (fehlendeKeys.length) {
  console.log(`Zutaten-Keys ohne Registry-Eintrag: ${[...new Set(fehlendeKeys)].join(', ')}\n`);
}

if (!treffer.length) {
  console.log('Keine Abweichung ueber der Toleranz.');
} else {
  for (const t of treffer) {
    console.log(`id ${String(t.id).padEnd(3)} ${t.name}`);
    for (const a of t.abweichungen) {
      console.log(
        `    ${a.makro.padEnd(4)} deklariert ${String(a.ist).padStart(6)}` +
        `   gerechnet ${a.soll.toFixed(1).padStart(7)}` +
        `   ${(a.pct > 0 ? '+' : '') + a.pct.toFixed(1)} %`
      );
    }
  }
  console.log(`\n${treffer.length} von ${dishes.length} Rezepten ueber der Toleranz.`);
  process.exitCode = 1;
}
