// Formatiert eine Gramm-Menge, skaliert mit den Portionen, für die Detail-Ansicht.
// Rundet auf ganze Gramm — Rezept-Präzision reicht, kein Pseudo-Komma.
// Beispiel: formatGrams(220, 3) → "660 g"
export function formatGrams(baseGrams, portions) {
  return `${Math.round(baseGrams * portions)} g`;
}

// Formatiert eine konsolidierte Einkaufslisten-Zutat einheiten-aware.
// item: { key, label, unit, size, note, sum } — sum ist die aggregierte Gramm-Menge
// (portions-skaliert und über alle ausgewählten Tage aufsummiert), außer bei unit='vorrat'.
// Aufrundung so, dass der User im Laden praktikable Mengen kauft (10 g, ganze Stück etc.).
export function formatQuantity(item) {
  if (item.unit === 'vorrat') return 'Vorrat prüfen';
  if (item.unit === 'g') {
    const g = Math.ceil(item.sum / 10) * 10;
    return `${g} g` + (item.note ? ` — ${item.note}` : '');
  }
  if (item.unit === 'stueck') {
    const n = Math.max(1, Math.ceil(item.sum / item.size));
    return `${n} Stück` + (item.note ? ` — ${item.note}` : '');
  }
  if (item.unit === 'bund') {
    const n = Math.max(1, Math.ceil(item.sum / item.size));
    return `${n} Bund`;
  }
  if (item.unit === 'zehe') {
    const n = Math.max(1, Math.ceil(item.sum / item.size));
    return `${n} Zehe(n)`;
  }
  if (item.unit === 'ei') {
    const n = Math.max(1, Math.round(item.sum / item.size));
    return `${n} Stück`;
  }
  return '';
}
