// Node-Sim fuer src/calendar/export-json.js.
// Fuettert das Modul mit gefakten Modul-States via direkter Mutation der
// State-Referenz aus src/state.js. Prueft:
//  1. leere Auswahl → meals = []
//  2. ein selected Day mit Rezept → 1 Meal mit korrekten Feldern
//  3. mehrere Tage inkl. nicht selected → nur selected im Output
//  4. Rezept mit Vorrat-Zutat ohne displayUnit → quantity = "Vorrat prüfen"
//  5. countExportableMeals stimmt mit meals.length ueberein
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
// Wir brauchen ein Rezept mit einer Vorrat-Zutat ohne displayUnit. Die
// meisten Vorrat-Zutaten (Salz, Pfeffer, Sesam) erfuellen das. Statt ein
// spezifisches Rezept zu suchen, iterieren wir alle dishes und suchen einen
// Kandidaten. Wenn keiner existiert: Test skippen mit Hinweis.
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
    const payload = buildExportPayload();
    const meal = payload.meals[0];
    const vorratItem = meal.ingredients.find((i) => i.quantity === 'Vorrat prüfen');
    assertEq(vorratItem != null, true, `Case 4: Rezept ${meal.name} sollte "Vorrat pruefen" enthalten`);
  }
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
