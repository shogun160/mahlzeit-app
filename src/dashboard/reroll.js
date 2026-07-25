import { state, DAYS } from '../state.js';
import { allDishIds, shuffled } from '../data/dishes.js';

// Baut den Card-spezifischen Bag neu: alle IDs außer der aktuell auf DIESER Karte gezeigten,
// zufällig geordnet. Wird sowohl bei leerem Bag als auch nach "Alle wechseln" gerufen.
function refillBag(day) {
  const currentId = state.assignment[day];
  state.dishBag[day] = shuffled(allDishIds).filter((id) => id !== currentId);
}

export function rerollDay(day) {
  const usedElsewhere = new Set(
    DAYS.filter((d) => d !== day).map((d) => state.assignment[d]),
  );

  if (!state.dishBag[day] || state.dishBag[day].length === 0) {
    refillBag(day);
  }

  // Max zwei Anläufe: findet der erste keinen freien Kandidaten (weil alle noch
  // in usedElsewhere sind), Bag refillen und nochmal versuchen.
  let pick = null;
  for (let attempt = 0; attempt < 2 && pick === null; attempt++) {
    while (state.dishBag[day].length > 0) {
      const candidate = state.dishBag[day].shift();
      if (!usedElsewhere.has(candidate)) {
        pick = candidate;
        break;
      }
      // candidate wird gerade auf einem anderen Tag gezeigt — verwerfen
    }
    if (pick === null) {
      refillBag(day);
    }
  }
  if (pick === null) return; // wirklich kein Gericht verfügbar (17 Dishes → sollte nie passieren)

  state.assignment[day] = pick;
  state.selected[day] = false; // neue Zutaten → alte Auswahl ungültig
}

export function rerollAll() {
  const previousIds = new Set(Object.values(state.assignment));
  let pool = shuffled(allDishIds).filter((id) => !previousIds.has(id));
  if (pool.length < DAYS.length) {
    // Fallback falls die Dish-Datenbank je unter 2x Anzahl Tage schrumpft
    pool = shuffled(allDishIds);
  }
  DAYS.forEach((day, i) => {
    state.assignment[day] = pool[i];
    state.selected[day] = false;
  });
  state.dishBag = {}; // Karten-spezifische Bags starten nach "Alle wechseln" neu
}
