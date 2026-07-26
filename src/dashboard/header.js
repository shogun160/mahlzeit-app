import { state, DAYS } from '../state.js';
import { renderProgressRing } from './selection-toolbar.js';

// Material Symbol "menu" (Burger) für den Settings-Öffner.
const ICON_MENU = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg>`;
// Material Symbol "refresh" — Kreispfeil mit Pfeilkopf oben, für Reroll-All.
const ICON_REFRESH = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;

// Rendert den Header. Struktur ist auf beiden Views gleich —
// [Logo] [Progress-Chip mit Ring + Count] [Primary-Action] [Burger] —
// nur die Chip-Interaktion und die Primary-Action wechseln pro View.
// Der Chip zeigt in BEIDEN Views die Wochenauswahl (n/7 Tage), damit die
// Info konsistent ist.
//
// - dashboard: Chip klickbar, togglet alle Tage. Primary-Action ist Reroll-All.
// - shopping: Chip read-only (Status), Primary-Action ist Reset (nur wenn
//   checkedShopping nicht leer).
//
// Portion-Pille lebt nicht mehr im Header — Standard-Personenzahl über
// Settings-Sheet, pro-Card-Portionen per Card-Stepper.
export function renderHeader(root, { view, onRerollAll, onResetChecked, onOpenSettings, onToggleAllSelected }) {
  if (view === 'shopping') {
    renderShoppingHeader(root, { onResetChecked, onOpenSettings });
  } else {
    renderDashboardHeader(root, { onRerollAll, onOpenSettings, onToggleAllSelected });
  }
}

function renderDashboardHeader(root, { onRerollAll, onOpenSettings, onToggleAllSelected }) {
  const selectedCount = DAYS.filter((day) => state.selected[day]).length;
  const total = DAYS.length;
  const isEmpty = selectedCount === 0;
  const isFull = selectedCount === total;
  const ariaPressed = isFull ? 'true' : isEmpty ? 'false' : 'mixed';
  const actionLabel = isEmpty ? 'Alle Tage für Einkaufsliste wählen' : 'Alle Tage abwählen';

  root.innerHTML = `
    <div class="app-header__logo-wrap">
      <img class="app-header__logo" src="/logo.png" alt="Mahlzeit" />
    </div>
    <div class="app-header__center">
      <button class="app-header__selection"
              data-action="toggle-all"
              aria-pressed="${ariaPressed}"
              aria-label="${actionLabel}"
              title="${actionLabel}">
        <span class="app-header__selection-ring" aria-hidden="true">
          ${renderProgressRing(selectedCount, total)}
        </span>
        <span class="app-header__selection-count">${selectedCount}/${total} Tage</span>
      </button>
    </div>
    <div class="app-header__actions">
      <button class="icon-btn" data-action="reroll-all" aria-label="Alle Gerichte neu auslosen" title="Alle neu auslosen">
        ${ICON_REFRESH}
      </button>
      <button class="icon-btn" data-action="open-settings" aria-label="Einstellungen öffnen" title="Einstellungen">
        ${ICON_MENU}
      </button>
    </div>
  `;

  root.querySelector('[data-action="toggle-all"]').addEventListener('click', () => onToggleAllSelected());
  root.querySelector('[data-action="reroll-all"]').addEventListener('click', () => onRerollAll());
  root.querySelector('[data-action="open-settings"]').addEventListener('click', () => onOpenSettings());
}

function renderShoppingHeader(root, { onResetChecked, onOpenSettings }) {
  // Chip zeigt die gleiche Wochenauswahl wie im Dashboard-Header — nur
  // read-only. So haben beide Views identische Info-Struktur; ein Toggle
  // hier im Shopping-Kontext wäre gefährlich (leert die Liste), deshalb
  // bewusst kein klickbarer Button.
  const selectedCount = DAYS.filter((day) => state.selected[day]).length;
  const total = DAYS.length;

  const chipHtml = `
    <div class="app-header__selection app-header__selection--readonly"
         role="status"
         aria-label="${selectedCount} von ${total} Tagen ausgewählt">
      <span class="app-header__selection-ring" aria-hidden="true">
        ${renderProgressRing(selectedCount, total)}
      </span>
      <span class="app-header__selection-count">${selectedCount}/${total} Tage</span>
    </div>
  `;

  // Reset-Button dauerhaft im Header (Layout-Konsistenz mit Dashboard-View),
  // aber disabled wenn nichts zum Zurücksetzen da ist. So springt die Header-
  // Breite beim View-Wechsel nicht mehr.
  const hasChecked = state.checkedShopping.size > 0;

  root.innerHTML = `
    <div class="app-header__logo-wrap">
      <img class="app-header__logo" src="/logo.png" alt="Mahlzeit" />
    </div>
    <div class="app-header__center">
      ${chipHtml}
    </div>
    <div class="app-header__actions">
      <button class="icon-btn ${hasChecked ? '' : 'icon-btn--disabled'}"
              data-action="reset-checked"
              ${hasChecked ? '' : 'disabled aria-disabled="true"'}
              aria-label="Alle Häkchen zurücksetzen"
              title="Alle Häkchen zurücksetzen">
        ${ICON_REFRESH}
      </button>
      <button class="icon-btn" data-action="open-settings" aria-label="Einstellungen öffnen" title="Einstellungen">
        ${ICON_MENU}
      </button>
    </div>
  `;

  const resetBtn = root.querySelector('[data-action="reset-checked"]');
  if (resetBtn && hasChecked) resetBtn.addEventListener('click', () => onResetChecked());
  root.querySelector('[data-action="open-settings"]').addEventListener('click', () => onOpenSettings());
}
