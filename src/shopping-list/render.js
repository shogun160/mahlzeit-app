import { state } from '../state.js';
import { buildConsolidatedList } from './consolidate.js';
import { toggleChecked } from './check.js';
import { renderProgress } from './progress.js';
import { CAT_ORDER, CAT_LABELS } from './categories.js';
import { formatQuantity } from '../util/format.js';

// Rendert die komplette Shopping-View in `root`.
// onChange wird nach jedem Check-Toggle aufgerufen — damit `main.js#refresh()`
// die View + Header (Reset-Button-Sichtbarkeit) neu zeichnet.
export function renderShoppingList(root, { onChange }) {
  const consolidated = buildConsolidatedList();
  const items = Object.values(consolidated);

  if (items.length === 0) {
    root.innerHTML = renderEmptyState();
    return;
  }

  const groupsHtml = CAT_ORDER.map((cat) => {
    const groupItems = items
      .filter((i) => i.cat === cat)
      .sort((a, b) => a.label.localeCompare(b.label, 'de'));
    if (groupItems.length === 0) return '';
    return renderGroup(cat, groupItems);
  }).join('');

  root.innerHTML = `
    ${renderProgress(items)}
    <div class="shop-groups">${groupsHtml}</div>
  `;

  root.querySelectorAll('.shop-item').forEach((el) => {
    el.addEventListener('click', () => {
      toggleChecked(el.dataset.key);
      onChange();
    });
  });
}

function renderGroup(cat, groupItems) {
  const rows = groupItems.map(renderRow).join('');
  return `
    <section class="shop-group">
      <h2 class="shop-group__title">${CAT_LABELS[cat]} <span class="shop-group__count">· ${groupItems.length}</span></h2>
      <ul class="shop-list">${rows}</ul>
    </section>
  `;
}

function renderRow(item) {
  const checked = state.checkedShopping.has(item.key);
  return `
    <li class="shop-item ${checked ? 'shop-item--checked' : ''}" data-key="${item.key}">
      <span class="shop-item__check" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 10.5 8.5 15 16 6"></polyline>
        </svg>
      </span>
      <span class="shop-item__body">
        <span class="shop-item__label">${item.label}</span>
        <span class="shop-item__qty">${formatQuantity(item)}</span>
      </span>
    </li>
  `;
}

function renderEmptyState() {
  return `
    <div class="shop-empty">
      <p class="shop-empty__title">Keine Zutaten in der Liste.</p>
      <p class="shop-empty__sub">Wähle Gerichte auf dem Dashboard über den Liste-Button aus.</p>
    </div>
  `;
}
