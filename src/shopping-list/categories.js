// Kategorie-Reihenfolge in der Einkaufsliste — folgt dem typischen Einkaufsweg:
// Obst/Gemüse zuerst, danach Kühlung, dann Fleisch/Fisch (kühlkette-sensitiv,
// spät greifen), danach Trocken/Konserven, am Ende Gewürze/Öl/Sonstiges.
export const CAT_ORDER = [
  'fleisch_fisch',
  'frisch',
  'kuehlung',
  'trocken',
  'gewuerze',
  'oel',
  'sonstig',
];

export const CAT_LABELS = {
  frisch: 'Obst & Gemüse',
  kuehlung: 'Kühlung',
  fleisch_fisch: 'Fleisch & Fisch',
  trocken: 'Trocken / Konserven',
  gewuerze: 'Gewürze',
  oel: 'Öl / Fett',
  sonstig: 'Sonstiges',
};
