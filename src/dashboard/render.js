import { createDayCard } from './card.js';
import { state, DAYS, initState } from '../state.js';
import { dishesById, allDishIds, shuffled } from '../data/dishes.js';
import { rerollDay } from './reroll.js';
import { changePortion } from './portions.js';
import { toggleSelected } from './selection.js';
import { renderSelectionToolbar } from './selection-toolbar.js';

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

  // Selection-Toolbar über der ersten Card. Sitzt im Content-Flow und scrollt
  // mit — kein sticky, kein permanenter Platzverlust bei tiefem Scroll.
  const toolbarRoot = document.createElement('div');
  root.appendChild(toolbarRoot);
  renderSelectionToolbar(toolbarRoot, { onChange });

  for (const day of DAYS) {
    const dishId = state.assignment[day];
    const dish = dishesById.get(dishId);
    // Anzahl offener (nicht abgehakter) Zutaten dieses Gerichts.
    // Wandert im Card-Layout zwischen Zutaten-Icon (nicht selected) und Liste-Icon
    // (selected) — Semantik: "so viele Zutaten stehen noch offen".
    const openIngredientsCount = dish.ingredients.filter(
      (ing) => !state.checkedShopping.has(ing.key),
    ).length;
    const card = createDayCard({
      day,
      dish,
      portions: state.portions[day],
      isSelected: state.selected[day],
      openIngredientsCount,
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
