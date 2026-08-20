// Einmal-Patch fuer die Zutaten-Drifts aus Session vom 2026-08-20.
//
// 1. Frische Zutaten, die als Stueck gekauft werden, von unit=g auf
//    unit=stueck + size umstellen (die Umstellung war nur halb passiert:
//    Gurke/Zucchini/Paprika waren schon Stueck, Aubergine/Rote Zwiebel nicht).
// 2. putenbrust als eigene Zutat anlegen — Rezept 26 zeigte putenhack,
//    obwohl Name, Steps und die deklarierten Makros Putenbrust meinen.
// 3. Alle Reis-Sorten auf reis_basmati_vollkorn vereinheitlichen.
// 4. Deklarierte Rezept-Makros (kcal/p/kh/f in dishes.json) um die Differenz
//    der getauschten Zutat fortschreiben. Die Werte sind handgepflegt, nicht
//    aus den Zutaten berechnet — der Validator prueft nur Atwater-Konsistenz
//    (kcal ~ p*4 + kh*4 + f*9), also muss der Tausch dort sauber ankommen.
//
// Aufruf: node scripts/patch-zutaten-drift.mjs [--dry]

import { readFile, writeFile } from 'node:fs/promises';

const DRY = process.argv.includes('--dry');
const ING_PATH = 'src/data/ingredients.json';
const DISH_PATH = 'src/data/dishes.json';

// --- 1. Stueck-Umstellung (Key -> Stueckgewicht in g) ---
const ZU_STUECK = {
  aubergine: 250,
  rote_zwiebel: 100,
  schalotte: 20,
  tomate: 100,
  orange: 200,
  brokkoli: 400,
  paprika_gelb: 150,
  paprika_spitz: 100,
  daikon: 400,
  // lauch / mango / kopfsalat bewusst NICHT umgestellt: sie kommen nur in
  // Garnitur-Mengen vor (13-33 g). Die 0.25-Mindestrundung aus scaledGrams
  // haette daraus ein Viertel Stueck gemacht — bei Lauch in Rezept 23 waeren
  // aus 13 g satte 50 g geworden (+285 %). Bei Gramm bleibt die Menge exakt.
};

// --- 2. Neue Zutat ---
const PUTENBRUST = {
  label: 'Putenbrust',
  cat: 'fleisch_fisch',
  unit: 'g',
  per100g: { kcal: 105, p: 24, kh: 0, f: 1 },
};

// --- 3. Zutaten-Ersetzungen in Rezepten (alt -> neu) ---
const ERSETZE = {
  reis_basmati: 'reis_basmati_vollkorn',
  reis_jasmin: 'reis_basmati_vollkorn',
  reis_schwarz: 'reis_basmati_vollkorn',
  reis_rundkorn: 'reis_basmati_vollkorn',
  putenhack: 'putenbrust',
};
// putenhack wird NUR in Rezept 26 getauscht — Rezept 5 (Putenbaellchen) ist
// echtes Hack und bleibt.
const NUR_IN_DISH = { putenhack: [26] };

// Tausche, bei denen die deklarierten Rezept-Makros NICHT fortgeschrieben
// werden duerfen: Rezept 26 wurde nachweislich schon mit Putenbrust
// kalkuliert (deklariert 894 kcal, Zutatensumme mit Putenbrust 896, mit
// Putenhack dagegen 984). Dort war nur der Key falsch — die Makros stimmen
// bereits und wuerden durch ein Delta erst kaputtgehen.
const OHNE_MAKRO_DELTA = new Set(['putenhack']);

// --- 6. Textkorrekturen in Steps ---
const STEP_TEXT = [
  { id: 2, von: 'Basmatireis kochen.', nach: 'Vollkorn-Basmati kochen.' },
  { id: 17, von: 'Mit Basmatireis servieren.', nach: 'Mit Vollkorn-Basmati servieren.' },
];

const MAKROS = ['kcal', 'p', 'kh', 'f'];

const ingRaw = JSON.parse(await readFile(ING_PATH, 'utf8'));
const dishRaw = JSON.parse(await readFile(DISH_PATH, 'utf8'));
const reg = ingRaw.ingredients;

// ---- Registry patchen ----
for (const [key, size] of Object.entries(ZU_STUECK)) {
  if (!reg[key]) throw new Error(`Unbekannter Key: ${key}`);
  reg[key].unit = 'stueck';
  reg[key].size = size;
  console.log(`stueck  ${key.padEnd(16)} size=${size}`);
}
if (!reg.putenbrust) {
  reg.putenbrust = PUTENBRUST;
  console.log('neu     putenbrust');
}

// ---- Rezepte patchen ----
const report = [];
for (const dish of dishRaw.dishes) {
  let veraendert = false;
  const delta = { kcal: 0, p: 0, kh: 0, f: 0 };
  const notizen = [];

  for (const ing of dish.ingredients) {
    const neu = ERSETZE[ing.key];
    if (!neu) continue;
    const erlaubt = NUR_IN_DISH[ing.key];
    if (erlaubt && !erlaubt.includes(dish.id)) continue;

    const alt = reg[ing.key];
    const ziel = reg[neu];
    if (!ziel) throw new Error(`Ziel-Key fehlt: ${neu}`);
    const mitDelta = !OHNE_MAKRO_DELTA.has(ing.key);
    if (mitDelta) {
      for (const k of MAKROS) {
        delta[k] += ((ziel.per100g[k] - alt.per100g[k]) * ing.grams) / 100;
      }
    }
    notizen.push(`${ing.key} -> ${neu} (${ing.grams} g)${mitDelta ? '' : ' [Makros unveraendert]'}`);
    ing.key = neu;
    veraendert = true;
  }

  const textPatch = STEP_TEXT.filter((t) => t.id === dish.id);
  for (const t of textPatch) {
    const idx = dish.steps.indexOf(t.von);
    if (idx === -1) {
      console.warn(`WARN id ${dish.id}: Step-Text nicht gefunden: "${t.von}"`);
      continue;
    }
    dish.steps[idx] = t.nach;
    notizen.push(`step "${t.von}" -> "${t.nach}"`);
    veraendert = true;
  }

  if (!veraendert) continue;

  const vorher = MAKROS.map((k) => dish[k]);
  for (const k of MAKROS) dish[k] = Math.round(dish[k] + delta[k]);
  const nachher = MAKROS.map((k) => dish[k]);
  // Atwater-Gegenprobe — der Validator laesst max. 100 kcal Abweichung zu.
  const atwater = dish.p * 4 + dish.kh * 4 + dish.f * 9;
  const abw = Math.abs(dish.kcal - atwater);
  report.push({ id: dish.id, name: dish.name, vorher, nachher, abw, notizen });
}

console.log('\n=== Rezept-Aenderungen ===');
for (const r of report) {
  console.log(`id ${String(r.id).padEnd(3)} ${r.name.slice(0, 46)}`);
  for (const n of r.notizen) console.log(`      ${n}`);
  console.log(`      makros ${r.vorher.join('/')} -> ${r.nachher.join('/')}   atwater-abw ${r.abw}${r.abw >= 100 ? '  <-- ZU HOCH' : ''}`);
}

const kritisch = report.filter((r) => r.abw >= 100);
console.log(`\n${report.length} Rezepte geaendert, ${kritisch.length} mit Atwater-Problem.`);

if (DRY) {
  console.log('\n--dry: nichts geschrieben.');
} else {
  await writeFile(ING_PATH, JSON.stringify(ingRaw, null, 2) + '\n');
  await writeFile(DISH_PATH, JSON.stringify(dishRaw, null, 2) + '\n');
  console.log('\ngeschrieben.');
}
