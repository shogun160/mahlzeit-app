// Sim: Weicht der Kalender-Export von der Rezept-Anzeige ab?
//
// Hypothese: export-json.js baut sum = ing.grams * dayFactor (ungerundet) und
// formatiert mit formatQuantity — dem EINKAUFS-Formatierer, der auf ganze
// Stueck aufrundet. Das Detail-Sheet nimmt dagegen scaledGrams (0.25-Raster,
// Kleinmengen exakt) plus formatIngredientQuantity. Bei Stueck-Zutaten laufen
// beide auseinander: aus einer halben Gurke wird im Export "1 Stueck".
//
// Diese Sim rechnet beide Pfade fuer alle Rezepte nach und beziffert, wieviel
// kcal der Export gegenueber der Karte zusaetzlich auf den Teller bringt.
//
// Aufruf: node scripts/sim-export-mengen.mjs        (Stand nach dem Fix)
//         node scripts/sim-export-mengen.mjs --alt  (alter Pfad, zum Vergleich)

import { allDishes } from '../src/data/dishes.js';
import { scaledGrams, dishScale } from '../src/nutrition/target.js';
import { formatIngredientQuantity, formatQuantity } from '../src/util/format.js';

// Faktoren, die in der Praxis vorkommen: dishScale rastert auf 0.125-Stufen.
// 1000 kcal ist das typische Abendessen-Ziel eines Standard-Profils.
const ZIEL_KCAL = 1000;
const ALT = process.argv.includes('--alt');

// Gramm-Menge, die eine formatQuantity-Ausgabe impliziert — also das, was der
// User nach dem Export tatsaechlich in die Pfanne legt.
function impliedGramsExport(item) {
  if (item.unit === 'vorrat' && !item.displayUnit) return 0;
  if (item.displayUnit && item.gramsPerUnit) {
    return Math.max(1, Math.ceil(item.sum / item.gramsPerUnit)) * item.gramsPerUnit;
  }
  if (item.unit === 'g' || item.unit === 'ml') return Math.ceil(item.sum / 10) * 10;
  if (item.unit === 'ei') return Math.max(1, Math.round(item.sum / item.size)) * item.size;
  if (item.size) return Math.max(1, Math.ceil(item.sum / item.size)) * item.size;
  return item.sum;
}

// Gramm-Menge, die die Rezept-Anzeige impliziert. formatIngredientQuantity
// hebt Kleinmengen aufs Viertel — sonst deckungsgleich mit scaledGrams.
function impliedGramsSheet(ing, grams) {
  if (ing.displayUnit && ing.gramsPerUnit) {
    return Math.max(0.5, Math.round((grams / ing.gramsPerUnit) * 2) / 2) * ing.gramsPerUnit;
  }
  if (ing.unit === 'ei' && ing.size) return Math.max(1, Math.round(grams / ing.size)) * ing.size;
  if (ing.size && (ing.unit === 'bund' || ing.unit === 'zehe' || ing.unit === 'stueck')) {
    return Math.max(0.25, Math.round((grams / ing.size) * 4) / 4) * ing.size;
  }
  return grams;
}

function kcalOf(ing, grams) {
  if (!ing.grams) return 0;
  return (ing.kcal / ing.grams) * grams;
}

const zeilen = [];
for (const dish of allDishes) {
  const factor = dishScale(dish.kcal, ZIEL_KCAL);
  let kcalSheet = 0;
  let kcalExport = 0;
  const diffs = [];

  for (const ing of dish.ingredients) {
    const sheetGrams = scaledGrams(ing, factor);
    const sheetText = formatIngredientQuantity(ing, sheetGrams);

    // Der ALTE Export-Pfad: ungerundete Summe durch den Einkaufs-Formatierer.
    const contributesSum = ing.unit !== 'vorrat' || ing.displayUnit;
    const item = { ...ing, sum: contributesSum ? ing.grams * factor : 0 };
    const exportText = ALT ? formatQuantity(item) : formatIngredientQuantity(ing, sheetGrams);

    const gSheet = impliedGramsSheet(ing, sheetGrams);
    const gExport = ALT ? impliedGramsExport(item) : gSheet;
    kcalSheet += kcalOf(ing, gSheet);
    kcalExport += kcalOf(ing, gExport);

    if (sheetText !== exportText) {
      diffs.push({ label: ing.label, sheetText, exportText, gSheet, gExport });
    }
  }

  const dKcal = kcalExport - kcalSheet;
  zeilen.push({ id: dish.id, name: dish.name, factor, kcalSheet, kcalExport, dKcal, diffs });
}

zeilen.sort((a, b) => b.dKcal - a.dKcal);

console.log(`Ziel ${ZIEL_KCAL} kcal, portions=1, ${zeilen.length} Rezepte.\n`);
console.log('Groesste Abweichung Export vs. Rezept-Anzeige:\n');
for (const z of zeilen.slice(0, 10)) {
  const pct = (z.dKcal / z.kcalSheet) * 100;
  console.log(
    `id ${String(z.id).padEnd(3)} x${z.factor.toFixed(3)}  ` +
    `Karte ${Math.round(z.kcalSheet).toString().padStart(4)} kcal  ` +
    `Export ${Math.round(z.kcalExport).toString().padStart(4)} kcal  ` +
    `${(z.dKcal > 0 ? '+' : '') + Math.round(z.dKcal)} (${pct.toFixed(1)} %)  ${z.name.slice(0, 34)}`
  );
  for (const d of z.diffs.slice(0, 4)) {
    console.log(`      ${d.label.padEnd(20)} Rezept "${d.sheetText}" (${Math.round(d.gSheet)} g)  ->  Export "${d.exportText}" (${Math.round(d.gExport)} g)`);
  }
}

const betroffen = zeilen.filter((z) => Math.abs(z.dKcal) / z.kcalSheet > 0.02);
const summe = zeilen.reduce((s, z) => s + z.dKcal, 0);
console.log(`\n${betroffen.length} von ${zeilen.length} Rezepten weichen um mehr als 2 % ab.`);
console.log(`Mittlere Abweichung: ${(summe / zeilen.length).toFixed(0)} kcal pro Rezept.`);
