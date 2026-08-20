// Sim: Weicht die Einkaufslisten-Menge von der Rezept-Anzeige ab?
//
// Hypothese: das Detail-Sheet rundet Stueck-Zutaten ueber scaledGrams() auf
// 0.25-Schritte, die Einkaufsliste summiert dagegen die ungerundeten Gramm
// (consolidate.js: ing.grams * dayFactor) und rundet erst am Ende mit
// Math.ceil auf ganze Stueck auf. Dadurch kann ein Rezept "1/2 Gurke" zeigen,
// waehrend die Liste fuer zwei solcher Gerichte 2 Gurken verlangt.
//
// Diese Sim rechnet beide Pfade nach — ohne DOM, ohne State — und listet die
// Faelle, in denen sie auseinanderlaufen.
//
// Aufruf: node scripts/sim-mengen-drift.mjs

import { scaledGrams } from '../src/nutrition/target.js';
import { formatIngredientQuantity, formatQuantity } from '../src/util/format.js';

// Zutat wie sie nach enrichIngredient() aussieht (Auszug der relevanten Felder).
const GURKE = { key: 'gurke', label: 'Salatgurke', grams: 150, unit: 'stueck', size: 300 };
const PAK_CHOI = { key: 'pak_choi', label: 'Pak Choi', grams: 100, unit: 'stueck', size: 200 };
const AUBERGINE = { key: 'aubergine', label: 'Aubergine', grams: 70, unit: 'g', size: null };

// Rezept-Anzeige: exakt der Pfad aus detail-sheet/ingredients.js
function sheetLabel(ing, factor) {
  return formatIngredientQuantity(ing, scaledGrams(ing, factor));
}

// Einkaufsliste heute: consolidate.js summiert ing.grams * dayFactor ungerundet.
function listLabelIst(ing, factor, tage) {
  const sum = ing.grams * factor * tage;
  return formatQuantity({ ...ing, sum });
}

// Einkaufsliste nach dem Fix: pro Tag dieselbe gerundete Menge wie im Sheet.
function listLabelSoll(ing, factor, tage) {
  const sum = scaledGrams(ing, factor) * tage;
  return formatQuantity({ ...ing, sum });
}

const FAKTOREN = [0.875, 1, 1.125, 1.25, 1.375, 1.5, 1.75, 2];
const TAGE = [1, 2, 3];

let drift = 0;
for (const ing of [GURKE, PAK_CHOI, AUBERGINE]) {
  console.log(`\n=== ${ing.label} (${ing.grams} g Basis, unit=${ing.unit}, size=${ing.size})`);
  for (const f of FAKTOREN) {
    for (const t of TAGE) {
      const sheet = sheetLabel(ing, f);
      const ist = listLabelIst(ing, f, t);
      const soll = listLabelSoll(ing, f, t);
      const abweichung = ist !== soll;
      if (abweichung) drift += 1;
      const marker = abweichung ? '  <-- DRIFT' : '';
      console.log(
        `  scale ${String(f).padEnd(5)} x ${t} Tag(e): ` +
        `Rezept "${sheet}" | Liste-ist "${ist}" | Liste-soll "${soll}"${marker}`
      );
    }
  }
}

console.log(`\nFaelle mit Abweichung ist/soll: ${drift}`);
