import { renderHeader } from './dashboard/header.js';
import { renderDashboard } from './dashboard/render.js';
import { rerollAll } from './dashboard/reroll.js';
import { changeGlobalPortion } from './dashboard/portions.js';

const headerRoot = document.getElementById('app-header');
const dashboardRoot = document.getElementById('app');

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
  renderDashboard(dashboardRoot, refresh);
}

refresh();
