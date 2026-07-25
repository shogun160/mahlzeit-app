import { createDayCard } from './card.js';
import { state, DAYS, initState } from '../state.js';
import { dishesById, allDishIds, shuffled } from '../data/dishes.js';

function pickInitialAssignment() {
  const picks = shuffled(allDishIds).slice(0, DAYS.length);
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
