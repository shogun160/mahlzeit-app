import { state } from '../state.js';

// Material Symbol "unfold_more" — Doppelpfeil auseinander, für Expand-All.
const ICON_UNFOLD_MORE = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-120 300-300l56-56 124 124 124-124 56 56-180 180Zm-124-504-56-56 180-180 180 180-56 56-124-124-124 124Z"/></svg>`;
// Material Symbol "unfold_less" — Doppelpfeil zueinander, für Collapse-All.
const ICON_UNFOLD_LESS = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m296-88-56-56 240-240 240 240-56 56-184-183L296-88Zm184-544L240-872l56-56 184 183 184-183 56 56-240 240Z"/></svg>`;
// Material Symbol "refresh" — Kreispfeil, für Reset-All (alle Haken zuruecksetzen).
const ICON_REFRESH = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;
// Material Symbol "done_all" — Doppel-Haken, fuer Check-All (alle abhaken).
const ICON_DONE_ALL = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m268-240-208-208 51-51 157 157 12 12-51 90Zm198 0L258-448l51-51 158 158 356-356 51 51-407 406Zm-1-199-52-51 205-205 51 51-204 205Z"/></svg>`;

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

  const { hasCollapsed, hasExpanded } = summarizeCategories(items);

  // Zweites Icon links vom Expand/Collapse: entweder Reset (wenn irgendwas
  // abgehakt ist) oder Check-All (wenn nichts abgehakt und noch Items da sind).
  const hasChecked = state.checkedShopping.size > 0;
  const resetOrCheckHtml = hasChecked
    ? `<button class="shop-progress__action" type="button" data-action="reset-checked-shopping" aria-label="Alle Häkchen zurücksetzen" title="Alle Häkchen zurücksetzen">${ICON_REFRESH}</button>`
    : (total > 0
        ? `<button class="shop-progress__action" type="button" data-action="check-all-shopping" aria-label="Alle Zutaten abhaken" title="Alle Zutaten abhaken">${ICON_DONE_ALL}</button>`
        : '');

  return `
    <div class="shop-progress">
      <div class="shop-progress__row">
        <div class="shop-progress__label">
          <span class="shop-progress__open">${openCount}</span>
          <span class="shop-progress__of">von ${total} offen</span>
        </div>
        <div class="shop-progress__actions">
          ${resetOrCheckHtml}
          ${hasCollapsed ? `
            <button class="shop-progress__action"
                    type="button"
                    data-action="expand-all-shopping"
                    aria-label="Alle Kategorien aufklappen"
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

// Fuer die gerenderten Kategorien: ist mindestens eine collapsed bzw. expanded?
// Der Expand-Button erscheint auch im Done-State (alles abgehakt, alles
// collapsed) — der User will die Liste wieder aufklappen koennen.
function summarizeCategories(items) {
  const cats = new Set(items.map((it) => it.cat));
  let hasCollapsed = false;
  let hasExpanded = false;
  for (const cat of cats) {
    if (state.collapsedCategories.has(cat)) hasCollapsed = true;
    else hasExpanded = true;
  }
  return { hasCollapsed, hasExpanded };
}
