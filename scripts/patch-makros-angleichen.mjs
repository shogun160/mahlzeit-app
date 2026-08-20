// Zieht die deklarierten Rezept-Makros (kcal/p/kh/f in dishes.json) auf die
// Summe der Zutaten-Naehrwerte aus ingredients.json.
//
// Hintergrund: die vier Werte waren handgepflegt und konnten von den Zutaten
// abweichen — der CI-Validator prueft nur Atwater-Konsistenz (kcal gegen
// p*4 + kh*4 + f*9), nicht die Zutatensumme. Weil dishScale() aus dish.kcal
// den Portionsfaktor ableitet, portionierte die App bei driftenden Rezepten
// am tatsaechlichen Gericht vorbei.
//
// Aufruf: node scripts/patch-makros-angleichen.mjs [--dry]

import { readFile, writeFile } from 'node:fs/promises';

const DRY = process.argv.includes('--dry');
const ING_PATH = 'src/data/ingredients.json';
const DISH_PATH = 'src/data/dishes.json';
const MAKROS = ['kcal', 'p', 'kh', 'f'];
// Ab dieser kcal-Differenz wird die Zeile einzeln ausgewiesen.
const MELDE_AB = 20;

const reg = JSON.parse(await readFile(ING_PATH, 'utf8')).ingredients;
const dishRaw = JSON.parse(await readFile(DISH_PATH, 'utf8'));

const geaendert = [];
for (const d of dishRaw.dishes) {
  const summe = { kcal: 0, p: 0, kh: 0, f: 0 };
  for (const ing of d.ingredients) {
    const eintrag = reg[ing.key];
    if (!eintrag) throw new Error(`id ${d.id}: unbekannter Key ${ing.key}`);
    for (const k of MAKROS) summe[k] += (eintrag.per100g[k] * ing.grams) / 100;
  }
  const vorher = MAKROS.map((k) => d[k]);
  // p/kh/f auf eine Nachkommastelle wie in der Registry, kcal ganzzahlig.
  d.kcal = Math.round(summe.kcal);
  for (const k of ['p', 'kh', 'f']) d[k] = Math.round(summe[k]);
  const nachher = MAKROS.map((k) => d[k]);
  const diff = d.kcal - vorher[0];
  if (vorher.join() !== nachher.join()) {
    geaendert.push({ id: d.id, name: d.name, vorher, nachher, diff });
  }
}

geaendert.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
console.log(`${geaendert.length} von ${dishRaw.dishes.length} Rezepten angepasst.\n`);
console.log('Groessere Verschiebungen (>= ' + MELDE_AB + ' kcal):');
for (const g of geaendert.filter((x) => Math.abs(x.diff) >= MELDE_AB)) {
  console.log(
    `  id ${String(g.id).padEnd(3)} ${(g.diff > 0 ? '+' : '') + String(g.diff).padEnd(5)} ` +
    `${g.vorher.join('/').padEnd(18)} -> ${g.nachher.join('/').padEnd(18)} ${g.name.slice(0, 38)}`
  );
}

// Atwater-Gegenprobe: der CI-Validator laesst max. 100 kcal Abweichung zu.
console.log('\n=== Atwater-Gegenprobe ===');
let schlimmste = 0;
let problem = 0;
for (const d of dishRaw.dishes) {
  const atwater = d.p * 4 + d.kh * 4 + d.f * 9;
  const abw = Math.abs(d.kcal - atwater);
  if (abw > schlimmste) schlimmste = abw;
  if (abw >= 100) {
    console.log(`  FEHLER id ${d.id}: ${Math.round(abw)} kcal Abweichung`);
    problem += 1;
  }
}
console.log(`groesste Abweichung ${Math.round(schlimmste)} kcal, ${problem} ueber der Grenze.`);

// kcal-Spanne im Blick behalten: die Gerichte sind als Abendessen gedacht.
const werte = dishRaw.dishes.map((d) => d.kcal).sort((a, b) => a - b);
console.log(`\nkcal-Spanne jetzt: ${werte[0]} bis ${werte[werte.length - 1]} (median ${werte[Math.floor(werte.length / 2)]})`);

if (DRY) {
  console.log('\n--dry: nichts geschrieben.');
} else if (problem === 0) {
  await writeFile(DISH_PATH, JSON.stringify(dishRaw, null, 2) + '\n');
  console.log('\ngeschrieben.');
} else {
  console.log('\nNICHT geschrieben wegen Atwater-Fehlern.');
  process.exit(1);
}
