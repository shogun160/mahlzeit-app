import { state, VIEWS } from '../state.js';
import { buildConsolidatedList } from '../shopping-list/consolidate.js';

// Rendert die Bottom-Nav mit zwei Tabs (Dashboard, Einkaufsliste).
// Aktiver Tab: Icon wechselt outlined → filled, Farbe wechselt grau → primary,
// Label wird bold. Keine Pille-Background — M3 "compact Navigation Bar"-Look
// mit Material-Symbols-Icons statt PNG-Bildern.
// Wird bei jedem refresh() neu gerendert, weil Aktiv-Zustand und Badge state-abhängig sind.
export function renderBottomNav(root, { onNavigate }) {
  const activeView = state.view;
  const openCount = countOpenShoppingItems();

  const tabs = [
    {
      view: 'dashboard',
      label: 'Dashboard',
      renderIcon: renderDashboardIcon,
      badge: 0,
    },
    {
      view: 'shopping',
      label: 'Einkaufsliste',
      renderIcon: renderShoppingIcon,
      badge: openCount,
    },
  ];

  root.innerHTML = tabs.map((tab) => renderTab(tab, activeView)).join('');

  root.querySelectorAll('.bottom-nav__tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.view;
      if (!VIEWS.includes(next)) return;
      if (next === state.view) return;
      onNavigate(next);
    });
  });
}

function renderTab(tab, activeView) {
  const isActive = tab.view === activeView;
  const cls = ['bottom-nav__tab'];
  if (isActive) cls.push('bottom-nav__tab--active');
  const badgeHtml =
    tab.badge > 0
      ? `<span class="bottom-nav__badge" aria-label="${tab.badge} offene Zutaten">${tab.badge}</span>`
      : '';
  // Option-C-Test: Labels sind entfernt — nur Icons als Nav-Signal.
  // aria-label bleibt für Screenreader-Zugänglichkeit.
  return `
    <button type="button"
            class="${cls.join(' ')}"
            data-view="${tab.view}"
            aria-label="${tab.label}"
            aria-current="${isActive ? 'page' : 'false'}">
      <span class="bottom-nav__icon-wrap">
        ${tab.renderIcon(isActive)}
        ${badgeHtml}
      </span>
    </button>
  `;
}

// Material Symbol "grid_view" — 4 gleich große Quadranten mit abgerundeten
// Ecken (matches das alte PNG-Icon, nur als SVG). outlined = nur Konturen,
// filled = solide Quadrate.
function renderDashboardIcon(isActive) {
  const d = isActive
    ? 'M120-520v-320h320v320H120Zm0 400v-320h320v320H120Zm400-400v-320h320v320H520Zm0 400v-320h320v320H520Z'
    : 'M120-520v-320h320v320H120Zm0 400v-320h320v320H120Zm400-400v-320h320v320H520Zm0 400v-320h320v320H520ZM200-600h160v-160H200v160Zm400 0h160v-160H600v160Zm0 400h160v-160H600v160Zm-400 0h160v-160H200v160Z';
  return `<svg class="bottom-nav__icon" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
}

// Material Symbol "shopping_bag" — Tasche mit Griff-Bogen oben.
// outlined = Konturen, filled = solide Tasche mit Griff-Cutout.
function renderShoppingIcon(isActive) {
  const d = isActive
    ? 'M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm160-640h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-720Z'
    : 'M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm0-80h480v-480h-80v80q0 17-11.5 28.5T600-520q-17 0-28.5-11.5T560-560v-80H400v80q0 17-11.5 28.5T360-520q-17 0-28.5-11.5T320-560v-80h-80v480Zm160-560h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-720Z';
  return `<svg class="bottom-nav__icon" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
}

// Anzahl der offenen (nicht abgehakten) Zutaten in der Einkaufsliste.
// Zählweise identisch zu progress.js: alle items der konsolidierten Liste minus
// abgehakte. Leftover-Items zählen als abgehakt (sie stehen in checkedShopping).
function countOpenShoppingItems() {
  const items = Object.values(buildConsolidatedList());
  return items.filter((i) => !state.checkedShopping.has(i.key)).length;
}
