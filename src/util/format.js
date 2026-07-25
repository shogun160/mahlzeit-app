// Formatiert eine Gramm-Menge, skaliert mit den Portionen, für die Detail-Ansicht.
// Rundet auf ganze Gramm — Rezept-Präzision reicht, kein Pseudo-Komma.
// Beispiel: formatGrams(220, 3) → "660 g"
export function formatGrams(baseGrams, portions) {
  return `${Math.round(baseGrams * portions)} g`;
}
