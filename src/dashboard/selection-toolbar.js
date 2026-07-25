import { state, DAYS } from '../state.js';
import { toggleAllSelected } from './selection.js';

// Rendert die Selection-Toolbar über der ersten Dashboard-Card:
//   [◐] 3 von 7 Tagen           Alle wählen
// Master-Indicator links zeigt drei Zustände (empty / mixed / full),
// Textlabel in der Mitte den aktuellen Count, rechts ein Action-Label,
// das kontextabhängig "Alle wählen" oder "Alle abwählen" lautet.
// Ganze Row ist ein einziger Button (aria-pressed: false | mixed | true).
export function renderSelectionToolbar(root, { onChange }) {
  const selectedCount = DAYS.filter((day) => state.selected[day]).length;
  const total = DAYS.length;
  const isEmpty = selectedCount === 0;
  const isFull = selectedCount === total;
  const isMixed = !isEmpty && !isFull;

  const stateMod = isFull ? 'full' : isMixed ? 'mixed' : 'empty';
  const ariaPressed = isFull ? 'true' : isMixed ? 'mixed' : 'false';
  // Sobald irgendwas selektiert ist, ist die Master-Action "clear" — analog
  // zum Verhalten in Gmail/Files. Nur im leeren Zustand ist sie "select all".
  const actionLabel = isEmpty ? 'Alle wählen' : 'Alle abwählen';
  const countLabel = isEmpty
    ? `Keiner von ${total} Tagen`
    : isFull
      ? 'Ganze Woche'
      : `${selectedCount} von ${total} Tagen`;

  root.innerHTML = `
    <button type="button"
            class="selection-toolbar"
            data-action="toggle-all"
            aria-pressed="${ariaPressed}"
            aria-label="${actionLabel}">
      <span class="selection-toolbar__checkbox selection-toolbar__checkbox--${stateMod}" aria-hidden="true">
        ${renderProgressRing(selectedCount, total)}
      </span>
      <span class="selection-toolbar__label">${countLabel}</span>
      <span class="selection-toolbar__action">${actionLabel}</span>
    </button>
  `;

  root.querySelector('.selection-toolbar').addEventListener('click', () => {
    toggleAllSelected();
    onChange();
  });
}

// Segmentierter Fortschrittsring: n von total Segmenten in primary, restliche
// als dezenter Outline. Deckt alle drei Zustände (0 / mixed / voll) mit einer
// einzigen konsistenten Darstellung ab — bei n=0 nur der Base-Ring (7 leere
// Segmente), bei n=total überdeckt der Overlay den Base komplett (7 volle
// Segmente in primary).
//
// Umgesetzt mit zwei überlagerten <circle>-Elementen und stroke-dasharray.
// Der Overlay hat n Segmente + einen "closing gap", der den Rest des Umfangs
// komplett überspringt — dadurch bleibt die Segmentierung sauber synchron
// mit dem Base-Ring.
function renderProgressRing(n, total) {
  const R = 8;
  const circumference = 2 * Math.PI * R; // ≈ 50.265
  const gap = 2;
  const segLen = (circumference - gap * total) / total;

  const baseDash = `${segLen.toFixed(3)} ${gap}`;

  let overlayHtml = '';
  if (n > 0) {
    const parts = [];
    for (let i = 0; i < n; i++) {
      parts.push(segLen);
      if (i < n - 1) parts.push(gap);
    }
    const usedDash = n * segLen;
    const usedGap = (n - 1) * gap;
    const closingGap = circumference - usedDash - usedGap;
    parts.push(closingGap);
    const overlayDash = parts.map((x) => x.toFixed(3)).join(' ');

    overlayHtml = `
      <circle cx="10" cy="10" r="${R}" fill="none"
              stroke="var(--md-sys-color-primary)" stroke-width="3"
              stroke-linecap="butt"
              stroke-dasharray="${overlayDash}"
              transform="rotate(-90 10 10)" />
    `;
  }

  return `
    <svg viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="${R}" fill="none"
              stroke="var(--md-sys-color-on-surface-variant)" stroke-width="3"
              stroke-linecap="butt"
              stroke-dasharray="${baseDash}"
              opacity="0.35"
              transform="rotate(-90 10 10)" />
      ${overlayHtml}
    </svg>
  `;
}
