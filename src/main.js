import { renderHeader } from './dashboard/header.js';
import { renderDashboard } from './dashboard/render.js';
import { rerollAll } from './dashboard/reroll.js';
import { changeGlobalPortion } from './dashboard/portions.js';
import { renderShoppingList } from './shopping-list/render.js';
import { resetChecked } from './shopping-list/check.js';
import { mountDetailSheet, openDetailSheet } from './detail-sheet/render.js';
import { attachViewSwipe } from './nav/swipe.js';
import { renderBottomNav } from './nav/bottom.js';
import { state, setView, loadState, saveState } from './state.js';

const headerRoot = document.getElementById('app-header');
const mainEl = document.getElementById('app');
const viewTrack = document.getElementById('view-track');
const dashboardRoot = document.getElementById('view-dashboard');
const shoppingRoot = document.getElementById('view-shopping');
const sheetRoot = document.getElementById('detail-sheet-root');
const bottomNavRoot = document.getElementById('bottom-nav');

// Persistierten State laden. Wenn nichts gespeichert (oder JSON kaputt), würfelt
// renderDashboard() beim ersten Render ein frisches Assignment (siehe pickInitialAssignment()).
loadState();

function refresh() {
  // Header ist view-abhängig — Dashboard-Actions vs. Shopping-Reset.
  renderHeader(headerRoot, {
    view: state.view,
    onGlobalPortionChange: (delta) => {
      changeGlobalPortion(delta);
      refresh();
    },
    onRerollAll: () => {
      rerollAll();
      refresh();
    },
    onResetChecked: () => {
      resetChecked();
      refresh();
    },
  });

  // Beide Views immer rendern: der Swipe braucht den Zielinhalt sofort sichtbar.
  renderDashboard(dashboardRoot, refresh, openDetailSheet);
  renderShoppingList(shoppingRoot, { onChange: refresh });

  // Bottom-Nav: aktiver Tab + Badge sind state-abhängig, deshalb pro refresh() neu.
  renderBottomNav(bottomNavRoot, {
    onNavigate: (next) => {
      setView(next);
      refresh();
    },
  });

  // Track slidet per CSS-Attribut-Selektor auf `data-view`.
  viewTrack.dataset.view = state.view;

  // Auto-Save nach jedem Render — zentraler Punkt, kein Streuen von saveState-Aufrufen.
  saveState();
}

// Sheet einmalig mounten; interne Portion-Änderungen triggern refresh() damit Cards
// und Shopping-Mengen mitgezogen werden.
mountDetailSheet(sheetRoot, { onChange: refresh });

// Screen-Swipe einmalig mounten — nutzt state.view aus dem Modul.
attachViewSwipe(mainEl, {
  onViewChange: (next) => {
    setView(next);
    refresh();
  },
});

refresh();
