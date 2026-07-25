import { createDayCard } from './card.js';
import { state, DAYS, initState } from '../state.js';
import dishesData from '../data/dishes.json';

// Schneller ID → Dish-Lookup
const dishesById = new Map(dishesData.dishes.map((d) => [d.id, d]));

// Fisher-Yates: mischt Array in-place. Wir arbeiten auf einer Kopie.
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickInitialAssignment() {
  const allIds = dishesData.dishes.map((d) => d.id);
  const picks = shuffled(allIds).slice(0, DAYS.length);
  const assignment = {};
  DAYS.forEach((day, i) => {
    assignment[day] = picks[i];
  });
  return assignment;
}

export function renderDashboard(root) {
  // Erst-Initialisierung: falls noch kein Assignment vorliegt, würfeln.
  // (Sobald Persistenz in Session 6 kommt, wird ein geladenes Assignment vorrangig sein.)
  if (Object.keys(state.assignment).length === 0) {
    initState(pickInitialAssignment());
  }

  root.innerHTML = '';
  for (const day of DAYS) {
    const dish = dishesById.get(state.assignment[day]);
    root.appendChild(createDayCard({ day, dish }));
  }
}
