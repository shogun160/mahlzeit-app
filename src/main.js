import { renderHeader } from './dashboard/header.js';
import { renderDashboard } from './dashboard/render.js';
import { rerollAll } from './dashboard/reroll.js';
import { toggleAllSelected } from './dashboard/selection.js';
import { renderShoppingList } from './shopping-list/render.js';
import { resetChecked } from './shopping-list/check.js';
import { mountDetailSheet, openDetailSheet } from './detail-sheet/render.js';
import { mountSettingsSheet, openSettingsSheet } from './settings/render.js';
import { attachViewSwipe } from './nav/swipe.js';
import { renderBottomNav } from './nav/bottom.js';
import { state, setView, loadState, saveState } from './state.js';

const headerRoot = document.getElementById('app-header');
const mainEl = document.getElementById('app');
const viewTrack = document.getElementById('view-track');
const dashboardRoot = document.getElementById('view-dashboard');
const shoppingRoot = document.getElementById('view-shopping');
const sheetRoot = document.getElementById('detail-sheet-root');
const settingsRoot = document.getElementById('settings-sheet-root');
const bottomNavRoot = document.getElementById('bottom-nav');

// Persistierten State laden. Wenn nichts gespeichert (oder JSON kaputt), würfelt
// renderDashboard() beim ersten Render ein frisches Assignment.
loadState();

function refresh() {
  // Header ist view-abhängig — Dashboard-Actions vs. Shopping-Reset.
  renderHeader(headerRoot, {
    view: state.view,
    onRerollAll: () => {
      rerollAll();
      refresh();
    },
    onToggleAllSelected: () => {
      toggleAllSelected();
      refresh();
    },
    onOpenSettings: () => {
      openSettingsSheet();
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

  // Auto-Save nach jedem Render — zentraler Punkt.
  saveState();
}

// Sheets einmalig mounten. Detail-Sheet triggert bei internen Änderungen ein
// refresh() (Card-Badges, Shopping-Mengen). Settings-Sheet auch — Änderungen
// dort (Standard-Portionen, Kochzeit) sollen mindestens saveState triggern.
mountDetailSheet(sheetRoot, { onChange: refresh });
mountSettingsSheet(settingsRoot, { onChange: refresh });

// Screen-Swipe einmalig mounten — nutzt state.view aus dem Modul.
attachViewSwipe(mainEl, {
  onViewChange: (next) => {
    setView(next);
    refresh();
  },
});

refresh();
