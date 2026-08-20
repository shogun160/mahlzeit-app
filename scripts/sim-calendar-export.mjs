// Node-Sim fuer src/calendar/export-json.js.
// Fuettert das Modul mit gefakten Modul-States via direkter Mutation der
// State-Referenz aus src/state.js. Prueft:
//  1. leere Auswahl → meals = []
//  2. ein selected Day mit Rezept → 1 Meal mit korrekten Feldern
//  3. mehrere Tage inkl. nicht selected → nur selected im Output
//  4. Rezept mit Vorrat-Zutat ohne displayUnit → konkrete Kochmenge statt
//     "Vorrat prüfen" (der Export ist eine Kochanleitung, keine Einkaufsliste)
//  5. countExportableMeals stimmt mit meals.length ueberein
//  6. quantity/grams sind deckungsgleich mit dem Detail-Sheet-Pfad
//
// Ausfuehren: node scripts/sim-calendar-export.mjs

import { state, DAYS, initState } from '../src/state.js';
import { buildExportPayload, countExportableMeals } from '../src/calendar/export-json.js';

// initState() benoetigt, damit selected/portions/assignment-Dicts mit allen
// Wochentagen vorbelegt sind — in Node startet state.selected als leeres
// Objekt (kein localStorage), und reset() braucht vorhandene Keys.
initState({});

function reset() {
  // state ist eine Live-Referenz aus src/state.js — wir manipulieren die
  // Felder direkt, wie die App auch. Nach jedem Case cleanup, damit die
  // Cases sich nicht gegenseitig verunreinigen.
  for (const d of DAYS) {
    state.selected[d] = false;
    state.assignment[d] = null;
    state.portions[d] = 1;
  }
}

function assertEq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) {
    console.log('  actual:  ', JSON.stringify(actual));
    console.log('  expected:', JSON.stringify(expected));
    process.exitCode = 1;
  }
}

// --- Case 1: leere Auswahl ------------------------------------------------
reset();
{
  const payload = buildExportPayload();
  assertEq(payload.meals.length, 0, 'Case 1: leere Auswahl → meals = []');
  assertEq(countExportableMeals(), 0, 'Case 1: countExportableMeals = 0');
}

// --- Case 2: ein selected Day mit Rezept ---------------------------------
reset();
{
  state.selected['Montag'] = true;
  state.assignment['Montag'] = 1; // dish id 1 = Wildlachs-Bowl (dishes.json)
  state.portions['Montag'] = 2;
  const payload = buildExportPayload();
  console.log('\n--- Case 2 Payload ---');
  console.log(JSON.stringify(payload, null, 2));
  assertEq(payload.meals.length, 1, 'Case 2: 1 meal erwartet');
  assertEq(payload.meals[0].day, 'Montag', 'Case 2: day = Montag');
  assertEq(payload.meals[0].portions, 2, 'Case 2: portions = 2');
  assertEq(payload.meals[0].name, 'Wildlachs-Bowl', 'Case 2: name');
  assertEq(payload.meals[0].ingredients.length > 0, true, 'Case 2: ingredients nicht leer');
  assertEq(payload.meals[0].steps.length > 0, true, 'Case 2: steps nicht leer');
  assertEq(typeof payload.exportedAt === 'string' && payload.exportedAt.includes('T'), true, 'Case 2: exportedAt ISO');
  assertEq(typeof payload.timezone === 'string', true, 'Case 2: timezone gesetzt');
}

// --- Case 3: mehrere Tage, nicht alle selected ---------------------------
reset();
{
  state.selected['Montag'] = true;
  state.selected['Mittwoch'] = true;
  state.assignment['Montag'] = 1;
  state.assignment['Dienstag'] = 2; // Dienstag NICHT selected → soll rausfallen
  state.assignment['Mittwoch'] = 2;
  const payload = buildExportPayload();
  assertEq(payload.meals.map((m) => m.day), ['Montag', 'Mittwoch'], 'Case 3: nur selected Tage, chronologisch');
}

// --- Case 4: Vorrat-Zutat ohne displayUnit -------------------------------
// Vorrat-Zutaten (Salz, Pfeffer, Sesam) tragen im Einkaufs-Formatierer sum=0
// und werden dort zu "Vorrat prüfen". Im Export ist das falsch: er ist eine
// Kochanleitung, dort gehoert die konkrete Menge hin — genau wie im Rezept.
reset();
{
  const { dishesById } = await import('../src/data/dishes.js');
  let candidateId = null;
  for (const [id, dish] of dishesById) {
    if (dish.ingredients.some((i) => i.unit === 'vorrat' && !i.displayUnit)) {
      candidateId = id;
      break;
    }
  }
  if (candidateId == null) {
    console.log('⚠ Case 4: kein Rezept mit Vorrat-Zutat ohne displayUnit — skip');
  } else {
    state.selected['Montag'] = true;
    state.assignment['Montag'] = candidateId;
    const dish = dishesById.get(candidateId);
    const vorratKeys = dish.ingredients.filter((i) => i.unit === 'vorrat' && !i.displayUnit);
    const payload = buildExportPayload();
    const meal = payload.meals[0];
    const items = vorratKeys.map((ing) => meal.ingredients.find((i) => i.label === ing.label));
    assertEq(
      items.every((i) => i && i.quantity !== 'Vorrat prüfen' && i.grams > 0),
      true,
      `Case 4: Vorrat-Zutaten in ${meal.name} tragen eine Kochmenge`
    );
  }
}

// --- Case 6: Mengen deckungsgleich mit dem Detail-Sheet -------------------
// Der Export hat frueher formatQuantity benutzt — den Einkaufs-Formatierer,
// der auf ganze Stueck aufrundet. Bei Faktor 1.125 wurde aus einer halben
// Gurke "1 Stück", also die doppelte Menge. Hier gegen den Sheet-Pfad
// (scaledGramsForDay + formatIngredientQuantity) gegenpruefen, ueber ALLE
// Rezepte und mit portions > 1 (dort greift zusaetzlich die sqrt-Daempfung
// fuer Aromageber).
reset();
{
  const { dishesById } = await import('../src/data/dishes.js');
  const { scaledGramsForDay } = await import('../src/nutrition/scale.js');
  const { formatIngredientQuantity } = await import('../src/util/format.js');

  const abweichungen = [];
  for (const [id, dish] of dishesById) {
    for (const portions of [1, 3]) {
      state.selected['Montag'] = true;
      state.assignment['Montag'] = id;
      state.portions['Montag'] = portions;
      const meal = buildExportPayload().meals[0];
      dish.ingredients.forEach((ing, idx) => {
        const grams = scaledGramsForDay(ing, portions, dish);
        const soll = formatIngredientQuantity(ing, grams);
        const ist = meal.ingredients[idx];
        if (ist.quantity !== soll || ist.grams !== Math.round(grams)) {
          abweichungen.push(`id ${id} p${portions} ${ing.label}: "${ist.quantity}" statt "${soll}"`);
        }
      });
    }
  }
  assertEq(abweichungen.slice(0, 5), [], `Case 6: Export == Rezept-Anzeige (${dishesById.size} Rezepte)`);
}

// --- Case 5: countExportableMeals konsistent -----------------------------
reset();
{
  state.selected['Montag'] = true;
  state.selected['Donnerstag'] = true;
  state.selected['Freitag'] = true;
  state.assignment['Montag'] = 1;
  state.assignment['Donnerstag'] = 2;
  state.assignment['Freitag'] = 99999; // existiert nicht → soll aus Payload UND count fallen
  const payload = buildExportPayload();
  assertEq(payload.meals.length, countExportableMeals(), 'Case 5: count = payload.meals.length');
  assertEq(payload.meals.length, 2, 'Case 5: unbekanntes dishId ignoriert');
}

console.log('\nSim beendet.');
