import { state, VIEWS } from '../state.js';
import { buildConsolidatedList } from '../shopping-list/consolidate.js';

// Rendert die Bottom-Nav mit zwei Tabs (Dashboard, Einkaufsliste).
// Wird bei jedem refresh() neu gerendert, weil Aktiv-Zustand und Badge state-abhängig sind.
// onNavigate(next) wird gerufen — main.js macht daraus setView + refresh (identisch wie Swipe).
export function renderBottomNav(root, { onNavigate }) {
  const activeView = state.view;
  const openCount = countOpenShoppingItems();

  const tabs = [
    {
      view: 'dashboard',
      label: 'Dashboard',
      iconActive: '/icons/icon-dashboard.png',
      iconInactive: '/icons/icon-dashboard.png',
      badge: 0,
    },
    {
      view: 'shopping',
      label: 'Einkaufsliste',
      iconActive: '/icons/icon-einkaufsliste-aktiv.png',
      iconInactive: '/icons/icon-einkaufsliste-inaktiv.png',
      badge: openCount,
    },
  ];

  root.innerHTML = tabs.map((tab) => renderTab(tab, activeView)).join('');

  root.querySelectorAll('.bottom-nav__tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.view;
      if (!VIEWS.includes(next)) return;
      if (next === state.view) return; // No-op wenn schon aktiv → kein unnötiger Re-render.
      onNavigate(next);
    });
  });
}

function renderTab(tab, activeView) {
  const isActive = tab.view === activeView;
  const iconSrc = isActive ? tab.iconActive : tab.iconInactive;
  const cls = ['bottom-nav__tab'];
  if (isActive) cls.push('bottom-nav__tab--active');
  const badgeHtml =
    tab.badge > 0
      ? `<span class="bottom-nav__badge" aria-label="${tab.badge} offene Zutaten">${tab.badge}</span>`
      : '';
  return `
    <button type="button"
            class="${cls.join(' ')}"
            data-view="${tab.view}"
            aria-label="${tab.label}"
            aria-current="${isActive ? 'page' : 'false'}">
      <span class="bottom-nav__icon-wrap">
        <img class="bottom-nav__icon" src="${iconSrc}" alt="" />
        ${badgeHtml}
      </span>
      <span class="bottom-nav__label">${tab.label}</span>
    </button>
  `;
}

// Anzahl der offenen (nicht abgehakten) Zutaten in der Einkaufsliste — identische
// Zählweise wie in progress.js: alle Items der konsolidierten Liste minus die
// abgehakten. Leftover-Items zählen als abgehakt (sie stehen in checkedShopping).
function countOpenShoppingItems() {
  const items = Object.values(buildConsolidatedList());
  return items.filter((i) => !state.checkedShopping.has(i.key)).length;
}
