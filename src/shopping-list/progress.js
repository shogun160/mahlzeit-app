import { state } from '../state.js';

// Baut die Progress-Zeile für die Einkaufsliste als HTML-String.
// items: Array<{ key, ... }> aus buildConsolidatedList → Object.values(...).
// Zeigt "N von M offen" und eine gefüllte Bar mit prozentualem Fortschritt (done/total).
export function renderProgress(items) {
  const total = items.length;
  const openCount = items.filter((i) => !state.checkedShopping.has(i.key)).length;
  const doneCount = total - openCount;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return `
    <div class="shop-progress">
      <div class="shop-progress__label">
        <span class="shop-progress__open">${openCount}</span>
        <span class="shop-progress__of">von ${total} offen</span>
      </div>
      <div class="shop-progress__track">
        <div class="shop-progress__fill" style="width: ${pct}%;"></div>
      </div>
    </div>
  `;
}
