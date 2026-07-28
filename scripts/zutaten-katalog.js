// Generiert einen Markdown-Katalog aller Zutaten aus ingredients.json.
// Ziel: Bevor eine neue Zutat in ingredients.json angelegt wird, hier
// nachschauen ob sie schon existiert (Guardrail 8: keine Duplikate).
//
// Aufruf: node scripts/zutaten-katalog.js
// Output: docs/zutaten-katalog.md

import { readFileSync, writeFileSync } from 'node:fs';

const raw = readFileSync('src/data/ingredients.json', 'utf-8');
const data = JSON.parse(raw);
const entries = Object.entries(data.ingredients);

// Kategorie-Labels (aus dem cat-Feld). Reihenfolge = Anzeige-Reihenfolge.
const CAT_LABELS = {
  fleisch_fisch: 'Fleisch & Fisch',
  kuehlung:      'Kühlware (Milchprodukte, Tofu etc.)',
  frisch:        'Frisch (Gemüse, Kräuter, Obst)',
  trocken:       'Trocken (Reis, Pasta, Bohnen, Nüsse)',
  gewuerze:      'Gewürze & Aromate',
  oel:           'Öl, Sauce & Würzmittel',
  sonstig:       'Sonstige',
};

const groups = new Map();
for (const [key, ing] of entries) {
  const cat = ing.cat || 'sonstig';
  if (!groups.has(cat)) groups.set(cat, []);
  groups.get(cat).push({ key, ...ing });
}

// Sortiere innerhalb einer Kategorie alphabetisch nach Label.
for (const arr of groups.values()) {
  arr.sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

const lines = [];
lines.push('# Zutaten-Katalog');
lines.push('');
lines.push(`**Auto-generiert aus \`src/data/ingredients.json\` — nicht manuell editieren.**`);
lines.push(`Neu erzeugen: \`node scripts/zutaten-katalog.js\``);
lines.push('');
lines.push(`**${entries.length} Zutaten** gesamt, sortiert nach Kategorie.`);
lines.push('');
lines.push('## Vor dem Anlegen einer neuen Zutat');
lines.push('');
lines.push('1. In diesem Katalog per **Cmd+F** nach Namen suchen (deutsch UND englisch).');
lines.push('2. Auch verwandte Formen prüfen — z. B. „Petersilie" vs. „Petersilie glatt" vs. „Petersilie kraus".');
lines.push('3. Bei Unit-Abweichung (Bund vs. g) trotzdem die bestehende Zutat nutzen, wenn semantisch dieselbe — Guardrail 8 verhindert Duplikate wie zwei Petersilie-Einträge, die die Einkaufsliste doppelt zeigen.');
lines.push('4. Nur wenn wirklich neu → in `ingredients.json` anlegen, dann `node scripts/zutaten-katalog.js` ausführen.');
lines.push('');

for (const [cat, label] of Object.entries(CAT_LABELS)) {
  const arr = groups.get(cat);
  if (!arr || arr.length === 0) continue;
  lines.push(`## ${label} (${arr.length})`);
  lines.push('');
  lines.push('| Key | Label | Einheit | kcal/100g | P | KH | F |');
  lines.push('|---|---|---|---:|---:|---:|---:|');
  for (const ing of arr) {
    const unit = ing.size ? `${ing.unit} × ${ing.size} g` : ing.unit;
    const displayUnit = ing.displayUnit ? ` (${ing.displayUnit})` : '';
    const p100 = ing.per100g || { kcal: '—', p: '—', kh: '—', f: '—' };
    lines.push(`| \`${ing.key}\` | ${ing.label} | ${unit}${displayUnit} | ${p100.kcal} | ${p100.p} | ${p100.kh} | ${p100.f} |`);
  }
  lines.push('');
}

// Unbekannte Kategorien nachziehen (falls neue eingeführt werden).
for (const [cat, arr] of groups.entries()) {
  if (CAT_LABELS[cat]) continue;
  lines.push(`## ${cat} (${arr.length}) — unbekannte Kategorie`);
  lines.push('');
  lines.push('| Key | Label | Einheit | kcal/100g | P | KH | F |');
  lines.push('|---|---|---|---:|---:|---:|---:|');
  for (const ing of arr) {
    const unit = ing.size ? `${ing.unit} × ${ing.size} g` : ing.unit;
    const p100 = ing.per100g || { kcal: '—', p: '—', kh: '—', f: '—' };
    lines.push(`| \`${ing.key}\` | ${ing.label} | ${unit} | ${p100.kcal} | ${p100.p} | ${p100.kh} | ${p100.f} |`);
  }
  lines.push('');
}

writeFileSync('docs/zutaten-katalog.md', lines.join('\n'));
console.log(`Katalog geschrieben: docs/zutaten-katalog.md (${entries.length} Zutaten)`);
