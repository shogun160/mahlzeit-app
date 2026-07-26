// Formatiert eine Gramm-Menge, skaliert mit den Portionen, für die Detail-Ansicht.
// Rundet auf ganze Gramm — Rezept-Präzision reicht, kein Pseudo-Komma.
// Beispiel: formatGrams(220, 3) → "660 g"
export function formatGrams(baseGrams, portions) {
  return `${Math.round(baseGrams * portions)} g`;
}

// Formatiert die Rezept-Menge einer Zutat kontextabhängig:
// - displayUnit "tl"/"el" (Öl/Sauce/Süßes/Paste) → Löffel via gramsPerUnit
// - unit "ei" → ganze Stück ("2 Eier")
// - unit "bund"/"zehe"/"stueck" → halbe erlaubt via size ("½ Bund", "1½ Stück")
// - sonst → Gramm
// Rundung passend zur internen scaledGrams-Rundung, damit was im Rezept steht
// mit der kcal-Rechnung übereinstimmt.
export function formatIngredientQuantity(ing, grams) {
  if (ing.displayUnit && ing.gramsPerUnit) {
    const raw = grams / ing.gramsPerUnit;
    const count = Math.max(0.5, Math.round(raw * 2) / 2);
    const unit = ing.displayUnit === 'el' ? 'EL' : 'TL';
    return `${formatHalfCount(count)} ${unit}`;
  }
  if (ing.unit === 'ei' && ing.size) {
    const count = Math.max(1, Math.round(grams / ing.size));
    return `${count} ${count === 1 ? 'Ei' : 'Eier'}`;
  }
  if (ing.size && (ing.unit === 'bund' || ing.unit === 'zehe' || ing.unit === 'stueck')) {
    const count = Math.max(0.25, Math.round((grams / ing.size) * 4) / 4);
    return `${formatQuarterCount(count)} ${labelForCountedUnit(ing.unit, count)}`;
  }
  return `${Math.round(grams)} g`;
}

// Deutsche Singular-/Plural-Labels für gezählte Einheiten. Bund bleibt Bund
// (unveränderlich), Zehe → Zehen, Stück bleibt Stück (auch bei halben).
function labelForCountedUnit(unit, count) {
  if (unit === 'bund') return 'Bund';
  if (unit === 'zehe') return count === 1 ? 'Zehe' : 'Zehen';
  return 'Stück';
}

// Rendert 0.5-gerundete Zahlen mit typografischer Bruchglyphe (½).
// 0.5 → "½", 1 → "1", 1.5 → "1½", 2 → "2".
function formatHalfCount(n) {
  const whole = Math.floor(n);
  const hasHalf = n - whole >= 0.5;
  if (whole === 0) return '½';
  return hasHalf ? `${whole}½` : String(whole);
}

// Rendert 0.25-gerundete Zahlen mit typografischen Bruchglyphen (¼ ½ ¾).
// 0.25 → "¼", 0.5 → "½", 1 → "1", 1.25 → "1¼", 1.75 → "1¾", 2 → "2".
function formatQuarterCount(n) {
  const whole = Math.floor(n);
  const frac = n - whole;
  let glyph = '';
  if (frac >= 0.75 - 1e-9) glyph = '¾';
  else if (frac >= 0.5 - 1e-9) glyph = '½';
  else if (frac >= 0.25 - 1e-9) glyph = '¼';
  if (whole === 0) return glyph || '¼';
  return `${whole}${glyph}`;
}

// Formatiert eine konsolidierte Einkaufslisten-Zutat einheiten-aware.
// item: { key, label, unit, displayUnit, gramsPerUnit, size, note, sum } —
// sum ist die aggregierte Gramm-Menge (portions × userScale × grams, über alle
// ausgewählten Tage aufsummiert), außer bei unit='vorrat' (sum=0).
// Aufrundung so, dass der User im Laden praktikable Mengen kauft: 10 g,
// ganze Stück, ganze Löffel. displayUnit hat Priorität für nicht-vorrat-
// Zutaten — konsistent zum Detail-Sheet ("3 EL Tahini" statt "45 g").
export function formatQuantity(item) {
  if (item.isLeftover) return 'Nicht mehr im Plan';
  const noteSuffix = item.note ? ` — ${item.note}` : '';
  // Vorrat ohne displayUnit: reines "Vorrat prüfen" (Gewürze, Sesam in Prisen).
  // Vorrat mit displayUnit fällt in den displayUnit-Zweig unten und bekommt
  // Menge + "Vorrat prüfen"-Hinweis (Öl, Sojasauce, Honig).
  if (item.unit === 'vorrat' && !item.displayUnit) return 'Vorrat prüfen';
  if (item.displayUnit && item.gramsPerUnit) {
    const n = Math.max(1, Math.ceil(item.sum / item.gramsPerUnit));
    const unit = item.displayUnit === 'el' ? 'EL' : 'TL';
    // Bei Vorrat-Zutaten (Öl, Sauce, Honig): Menge zeigen damit der User weiß
    // wieviel für die Woche gebraucht wird, Note "Vorrat prüfen" dahinter.
    const suffix = item.unit === 'vorrat' ? ' — Vorrat prüfen' : noteSuffix;
    return `${n} ${unit}${suffix}`;
  }
  if (item.unit === 'g') {
    const g = Math.ceil(item.sum / 10) * 10;
    return `${g} g${noteSuffix}`;
  }
  if (item.unit === 'ml') {
    const ml = Math.ceil(item.sum / 10) * 10;
    return `${ml} ml${noteSuffix}`;
  }
  if (item.unit === 'stueck') {
    const n = Math.max(1, Math.ceil(item.sum / item.size));
    return `${n} Stück${noteSuffix}`;
  }
  if (item.unit === 'bund') {
    const n = Math.max(1, Math.ceil(item.sum / item.size));
    return `${n} Bund${noteSuffix}`;
  }
  if (item.unit === 'zehe') {
    const n = Math.max(1, Math.ceil(item.sum / item.size));
    return `${n} ${n === 1 ? 'Zehe' : 'Zehen'}${noteSuffix}`;
  }
  if (item.unit === 'ei') {
    const n = Math.max(1, Math.round(item.sum / item.size));
    return `${n} ${n === 1 ? 'Ei' : 'Eier'}${noteSuffix}`;
  }
  return '';
}
