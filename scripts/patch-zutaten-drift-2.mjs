// Zweiter Einmal-Patch, Folge-Session zu patch-zutaten-drift.mjs.
//
// 1. Kochzeiten der auf Vollkorn-Basmati umgestellten Rezepte anheben —
//    Vollkorn braucht 40-60 Min statt 10-12.
// 2. Paella (id 14) zurueck auf Bomba-Rundkorn: Rundkorn bindet die Bruehe,
//    Vollkorn-Basmati macht daraus keine Paella mehr.
// 3. Verwaiste Reis-Keys loeschen (reis_rundkorn BLEIBT — Paella braucht ihn).
// 4. limette_saft in limette mergen: gekauft wird die Frucht, im Rezept steht
//    der Saft als Bruchteil ("1/2 Limette"). Dafuer muss displayUnit=el weg —
//    displayUnit hat in formatIngredientQuantity UND formatQuantity Vorrang
//    vor der Stueck-Logik und wuerde sonst "1 EL" erzwingen.
//
// Aufruf: node scripts/patch-zutaten-drift-2.mjs [--dry]

import { readFile, writeFile } from 'node:fs/promises';

const DRY = process.argv.includes('--dry');
const ING_PATH = 'src/data/ingredients.json';
const DISH_PATH = 'src/data/dishes.json';
const MAKROS = ['kcal', 'p', 'kh', 'f'];

// --- 1. Kochzeiten (id -> neue Minuten) ---
const COOKTIME = { 1: 40, 13: 40, 16: 40, 25: 40, 40: 40 };

// --- 2. Paella zurueck auf Rundkorn. Makros werden explizit auf die Werte
// vor dem Reis-Patch gesetzt statt per Delta — so entsteht keine
// Rundungsdrift durch Hin- und Zurueckrechnen.
const PAELLA = { id: 14, key: 'reis_basmati_vollkorn', zurueck: 'reis_rundkorn', makros: { kcal: 901, p: 72, kh: 97, f: 24 } };

// --- 3. Zu loeschende Zutaten-Keys ---
const LOESCHEN = ['reis_basmati', 'reis_jasmin', 'reis_schwarz'];

// --- 4. Limette-Merge ---
const LIMETTE_MERGE = {
  von: 'limette_saft',
  nach: 'limette',
  // Saft-Naehrwerte gewinnen: die grams-Angaben in den Rezepten meinen Saft,
  // nicht Fruchtfleisch. size=25 = Saftausbeute einer Limette.
  ziel: {
    label: 'Limette, Saft',
    cat: 'frisch',
    unit: 'stueck',
    size: 25,
    per100g: { kcal: 25, p: 0.4, kh: 8.4, f: 0.1 },
  },
};

const ingRaw = JSON.parse(await readFile(ING_PATH, 'utf8'));
const dishRaw = JSON.parse(await readFile(DISH_PATH, 'utf8'));
const reg = ingRaw.ingredients;
const dishById = (id) => dishRaw.dishes.find((d) => d.id === id);

// ---- 1. Kochzeiten ----
for (const [id, min] of Object.entries(COOKTIME)) {
  const d = dishById(Number(id));
  if (!d) throw new Error(`Rezept fehlt: ${id}`);
  console.log(`cooktime id ${String(id).padEnd(3)} ${d.cooktime} -> ${min}  ${d.name.slice(0, 40)}`);
  d.cooktime = min;
}

// ---- 2. Paella ----
{
  const d = dishById(PAELLA.id);
  const ing = d.ingredients.find((i) => i.key === PAELLA.key);
  if (!ing) throw new Error('Paella: Reis-Zutat nicht gefunden');
  ing.key = PAELLA.zurueck;
  const vorher = MAKROS.map((k) => d[k]).join('/');
  for (const k of MAKROS) d[k] = PAELLA.makros[k];
  console.log(`\npaella  ${PAELLA.key} -> ${PAELLA.zurueck}, makros ${vorher} -> ${MAKROS.map((k) => d[k]).join('/')}`);
}

// ---- 4. Limette-Merge (vor dem Loeschen, damit die Referenzen sauber sind) ----
{
  const alt = reg[LIMETTE_MERGE.von];
  const neu = reg[LIMETTE_MERGE.nach];
  if (!alt || !neu) throw new Error('Limette-Keys fehlen');
  const altP100 = alt.per100g;
  const neuP100 = LIMETTE_MERGE.ziel.per100g;

  // Bestehende limette-Nutzer bekommen ein Makro-Delta, weil sich deren
  // per100g aendert (Frucht -> Saft-Werte).
  for (const d of dishRaw.dishes) {
    const ing = d.ingredients.find((i) => i.key === LIMETTE_MERGE.nach);
    if (!ing) continue;
    for (const k of MAKROS) {
      d[k] = Math.round(d[k] + ((neuP100[k] - neu.per100g[k]) * ing.grams) / 100);
    }
  }
  // limette_saft-Nutzer umbiegen. Kein Delta: die Zielwerte SIND die
  // bisherigen Saft-Werte.
  let umgebogen = 0;
  for (const d of dishRaw.dishes) {
    for (const ing of d.ingredients) {
      if (ing.key !== LIMETTE_MERGE.von) continue;
      ing.key = LIMETTE_MERGE.nach;
      umgebogen += 1;
      for (const k of MAKROS) {
        d[k] = Math.round(d[k] + ((neuP100[k] - altP100[k]) * ing.grams) / 100);
      }
    }
  }
  reg[LIMETTE_MERGE.nach] = { ...LIMETTE_MERGE.ziel };
  delete reg[LIMETTE_MERGE.von];
  console.log(`\nlimette: ${umgebogen} Rezepte von limette_saft umgebogen, displayUnit entfernt`);
}

// ---- 3. Verwaiste Keys loeschen ----
console.log('');
for (const key of LOESCHEN) {
  const nutzer = dishRaw.dishes.filter((d) => d.ingredients.some((i) => i.key === key));
  if (nutzer.length) {
    throw new Error(`${key} wird noch benutzt von: ${nutzer.map((d) => d.id).join(', ')}`);
  }
  delete reg[key];
  console.log(`geloescht  ${key}`);
}

// ---- Gegenproben ----
console.log('\n=== Gegenproben ===');
let fehler = 0;
for (const d of dishRaw.dishes) {
  for (const i of d.ingredients) {
    if (!reg[i.key]) {
      console.log(`FEHLER id ${d.id}: unbekannter Key ${i.key}`);
      fehler += 1;
    }
  }
  const atwater = d.p * 4 + d.kh * 4 + d.f * 9;
  if (Math.abs(d.kcal - atwater) >= 100) {
    console.log(`FEHLER id ${d.id}: Atwater-Abweichung ${Math.round(Math.abs(d.kcal - atwater))}`);
    fehler += 1;
  }
}
console.log(fehler === 0 ? 'alle Keys aufloesbar, alle Rezepte Atwater-konform.' : `${fehler} Problem(e)!`);

if (DRY) {
  console.log('\n--dry: nichts geschrieben.');
} else if (fehler === 0) {
  await writeFile(ING_PATH, JSON.stringify(ingRaw, null, 2) + '\n');
  await writeFile(DISH_PATH, JSON.stringify(dishRaw, null, 2) + '\n');
  console.log('\ngeschrieben.');
} else {
  console.log('\nNICHT geschrieben wegen Fehlern.');
  process.exit(1);
}
