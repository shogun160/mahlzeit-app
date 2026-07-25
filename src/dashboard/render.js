import { createDayCard } from './card.js';
import { state, DAYS, initState } from '../state.js';
import { dishesById, allDishIds, shuffled } from '../data/dishes.js';
import { rerollDay } from './reroll.js';
import { changePortion } from './portions.js';
import { toggleSelected } from './selection.js';

function pickInitialAssignment() {
  const picks = shuffled(allDishIds).slice(0, DAYS.length);
  const assignment = {};
  DAYS.forEach((day, i) => {
    assignment[day] = picks[i];
  });
  return assignment;
}

export function renderDashboard(root, onChange, onOpenDetail) {
  // Erst-Initialisierung: falls noch kein Assignment vorliegt, würfeln.
  if (Object.keys(state.assignment).length === 0) {
    initState(pickInitialAssignment());
  }

  root.innerHTML = '';
  for (const day of DAYS) {
    const dishId = state.assignment[day];
    const dish = dishesById.get(dishId);
    const card = createDayCard({
      day,
      dish,
      portions: state.portions[day],
      isSelected: state.selected[day],
      handlers: {
        onPortionChange: (delta) => {
          changePortion(day, delta);
          onChange();
        },
        onReroll: () => {
          rerollDay(day);
          onChange();
        },
        onToggleSelected: () => {
          toggleSelected(day);
          onChange();
        },
        onOpenDetail: (tab) => {
          onOpenDetail(dishId, tab, day);
        },
      },
    });
    root.appendChild(card);
  }
}
