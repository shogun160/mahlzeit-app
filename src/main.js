import { renderHeader } from './dashboard/header.js';
import { renderDashboard } from './dashboard/render.js';
import { rerollAll } from './dashboard/reroll.js';
import { changeGlobalPortion } from './dashboard/portions.js';
import { mountDetailSheet, openDetailSheet } from './detail-sheet/render.js';

const headerRoot = document.getElementById('app-header');
const dashboardRoot = document.getElementById('app');
const sheetRoot = document.getElementById('detail-sheet-root');

function refresh() {
  renderHeader(headerRoot, {
    onGlobalPortionChange: (delta) => {
      changeGlobalPortion(delta);
      refresh();
    },
    onRerollAll: () => {
      rerollAll();
      refresh();
    },
  });
  renderDashboard(dashboardRoot, refresh, openDetailSheet);
}

// Sheet einmalig mounten; interne Portion-Änderungen triggern refresh() damit Cards
// mitgezogen werden.
mountDetailSheet(sheetRoot, { onChange: refresh });

refresh();
