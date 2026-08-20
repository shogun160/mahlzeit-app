// Gemeinsame Drift-Pruefung: weichen die deklarierten Rezept-Makros
// (kcal/p/kh/f in dishes.json) von der Summe ihrer Zutaten ab?
//
// Warum das zaehlt: dishScale() leitet den Portionsfaktor aus dish.kcal ab.
// Ein zu niedriges Feld laesst die App hochskalieren — der User kocht dann
// mehr als die Karte anzeigt, ohne dass es irgendwo auffaellt. Die
// Atwater-Pruefung des Validators faengt das nicht: sie vergleicht kcal nur
// gegen p*4 + kh*4 + f*9, also die deklarierten Werte untereinander.
//
// Genutzt von scripts/audit-makros.mjs (Report) und scripts/validate-recipe.mjs
// (CI-Guard) — bewusst dieselbe Rechnung, damit CI und lokaler Lauf nicht
// auseinanderdriften.

export const MAKROS = ['kcal', 'p', 'kh', 'f'];

// Toleranz in Prozent. kcal steuert die Skalierung, deshalb streng. p/kh/f
// duerfen etwas mehr driften — sie sind auf ganze Gramm gerundet, bei kleinen
// Absolutwerten (5 g Fett) schlaegt das prozentual stark durch.
export const TOL_KCAL = 2;
export const TOL_MAKRO = 5;

// Unterhalb dieser Gramm-Menge wird die Prozent-Abweichung bei p/kh/f
// ignoriert — Rundungsrauschen, kein Datenfehler.
const MAKRO_MIN_G = 10;

// Unterhalb dieser Zutatensumme wird kcal nicht geprueft. Ein reales Gericht
// liegt immer deutlich darueber; darunter fehlen der Registry schlicht die
// per100g-Werte, und das ist ein anderer Fehler als Drift.
const KCAL_MIN_SUM = 50;

// Summiert die Naehrwerte aller Zutaten eines Gerichts.
// Unbekannte Keys werden uebersprungen und in `missing` zurueckgegeben —
// der Aufrufer meldet die separat (der Validator hat dafuer einen eigenen
// Check mit besserer Fehlermeldung).
export function sumIngredients(dish, registry) {
  const sum = { kcal: 0, p: 0, kh: 0, f: 0 };
  const missing = [];
  for (const ing of dish.ingredients || []) {
    const entry = registry[ing.key];
    if (!entry?.per100g) {
      missing.push(ing.key);
      continue;
    }
    for (const k of MAKROS) sum[k] += ((entry.per100g[k] || 0) * ing.grams) / 100;
  }
  return { sum, missing };
}

// Liefert pro driftendem Gericht einen Treffer:
//   { id, name, missing: string[], abweichungen: [{ makro, ist, soll, pct }] }
// Gerichte ohne Abweichung tauchen nicht auf.
export function findMakroDrift(dishes, registry) {
  const treffer = [];
  for (const d of dishes) {
    const { sum, missing } = sumIngredients(d, registry);
    const abweichungen = [];
    for (const k of MAKROS) {
      const soll = sum[k];
      const ist = d[k] ?? 0;
      if (k === 'kcal' ? soll < KCAL_MIN_SUM : soll < MAKRO_MIN_G) continue;
      const pct = ((ist - soll) / soll) * 100;
      const tol = k === 'kcal' ? TOL_KCAL : TOL_MAKRO;
      if (Math.abs(pct) > tol) abweichungen.push({ makro: k, ist, soll, pct });
    }
    if (abweichungen.length) treffer.push({ id: d.id, name: d.name, missing, abweichungen });
  }
  return treffer;
}
