import { state } from '../state.js';

// Material Symbol "unfold_more" — Doppelpfeil auseinander, für Expand-All.
const ICON_UNFOLD_MORE = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-120 300-300l56-56 124 124 124-124 56 56-180 180Zm-124-504-56-56 180-180 180 180-56 56-124-124-124 124Z"/></svg>`;
// Material Symbol "unfold_less" — Doppelpfeil zueinander, für Collapse-All.
const ICON_UNFOLD_LESS = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m296-88-56-56 240-240 240 240-56 56-184-183L296-88Zm184-544L240-872l56-56 184 183 184-183 56 56-240 240Z"/></svg>`;

// Baut die Progress-Zeile für die Einkaufsliste als HTML-String.
// items: Array<{ key, ... }> aus buildConsolidatedList → Object.values(...).
// Zeigt "N von M offen", zwei optionale Icon-Buttons (Expand-All / Collapse-All,
// nur wenn sie tatsächlich etwas bewirken würden) und eine gefüllte Bar mit
// prozentualem Fortschritt (done/total).
//
// Warum die Buttons hier statt im App-Header: Der Header ist für globale
// Aktionen (Reset, Settings, Selection-Chip) reserviert. Expand/Collapse
// bezieht sich auf DIE Liste, nicht auf App-Zustand — direkt an der Progress-
// Bar der Liste ist der offensichtlichere Ort.
export function renderProgress(items) {
  const total = items.length;
  const openCount = items.filter((i) => !state.checkedShopping.has(i.key)).length;
  const doneCount = total - openCount;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const { hasCollapsedWithOpen, hasExpanded } = summarizeCategories(items);

  return `
    <div class="shop-progress">
      <div class="shop-progress__row">
        <div class="shop-progress__label">
          <span class="shop-progress__open">${openCount}</span>
          <span class="shop-progress__of">von ${total} offen</span>
        </div>
        <div class="shop-progress__actions">
          ${hasCollapsedWithOpen ? `
            <button class="shop-progress__action"
                    type="button"
                    data-action="expand-all-shopping"
                    aria-label="Alle offenen Kategorien aufklappen"
                    title="Alle aufklappen">
              ${ICON_UNFOLD_MORE}
            </button>
          ` : hasExpanded ? `
            <button class="shop-progress__action"
                    type="button"
                    data-action="collapse-all-shopping"
                    aria-label="Alle Kategorien zuklappen"
                    title="Alle zuklappen">
              ${ICON_UNFOLD_LESS}
            </button>
          ` : ''}
        </div>
      </div>
      <div class="shop-progress__track">
        <div class="shop-progress__fill" style="width: ${pct}%;"></div>
      </div>
    </div>
  `;
}

// Aggregiert für die gerenderten Kategorien, ob Expand/Collapse aktuell etwas
// bewirken würden. Expand: mind. eine gerenderte Kategorie ist collapsed UND
// hat noch offene Zutaten (vollständig erledigte lassen wir zu). Collapse:
// mind. eine gerenderte Kategorie ist derzeit expanded.
function summarizeCategories(items) {
  const catsInList = new Map();
  for (const it of items) {
    const open = state.checkedShopping.has(it.key) ? 0 : 1;
    const entry = catsInList.get(it.cat) || { open: 0 };
    entry.open += open;
    catsInList.set(it.cat, entry);
  }
  let hasCollapsedWithOpen = false;
  let hasExpanded = false;
  for (const [cat, info] of catsInList) {
    const collapsed = state.collapsedCategories.has(cat);
    if (collapsed && info.open > 0) hasCollapsedWithOpen = true;
    if (!collapsed) hasExpanded = true;
  }
  return { hasCollapsedWithOpen, hasExpanded };
}
