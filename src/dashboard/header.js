import { state, DAYS } from '../state.js';
import { renderProgressRing } from './selection-toolbar.js';

// Material Symbol "menu" (Burger) für den Settings-Öffner.
const ICON_MENU = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg>`;

// Kleiner Dot-Badge fuer "neue Rezepte verfuegbar". Wird ueber den Burger
// gelegt und per CSS positioniert.
function menuBtnHtml(hasBadge) {
  const badgeHtml = hasBadge
    ? '<span class="icon-btn__dot" aria-hidden="true"></span>'
    : '';
  const ariaLabel = hasBadge
    ? 'Einstellungen öffnen (neue Rezepte verfügbar)'
    : 'Einstellungen öffnen';
  return `<button class="icon-btn icon-btn--relative" data-action="open-settings" aria-label="${ariaLabel}" title="Einstellungen">
    ${ICON_MENU}${badgeHtml}
  </button>`;
}
// Material Symbol "refresh" — Kreispfeil mit Pfeilkopf oben, für Reroll-All.
// Exportiert, damit andere Views (Settings-Rezepte-Section) exakt dasselbe Icon
// wiederverwenden — vermeidet Path-Drifts durch Copy-Paste-Varianten.
export const ICON_REFRESH = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;
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
export function renderHeader(root, { view, onResetChecked, onCheckAll, onOpenSettings, onToggleAllSelected, onGoDashboard }) {
  if (view === 'shopping') {
    renderShoppingHeader(root, { onResetChecked, onCheckAll, onOpenSettings, onGoDashboard });
  } else {
    renderDashboardHeader(root, { onOpenSettings, onToggleAllSelected });
  }
}

function renderDashboardHeader(root, { onOpenSettings, onToggleAllSelected }) {
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
      ${menuBtnHtml(state.remoteHasUpdates)}
    </div>
  `;

  root.querySelector('[data-action="toggle-all"]').addEventListener('click', () => onToggleAllSelected());
  root.querySelector('[data-action="open-settings"]').addEventListener('click', () => onOpenSettings());
}

function renderShoppingHeader(root, { onOpenSettings, onGoDashboard }) {
  // Chip zeigt die gleiche Wochenauswahl wie im Dashboard-Header — nur
  // read-only + klickbar als Shortcut zurueck aufs Dashboard. Reset/Check-All
  // sitzen inzwischen in der Progress-Bar (shop-progress__actions), damit sie
  // naeher an der Liste sind, auf die sie sich beziehen.
  const selectedCount = DAYS.filter((day) => state.selected[day]).length;
  const total = DAYS.length;

  const chipHtml = `
    <button type="button"
            class="app-header__selection app-header__selection--link"
            data-action="go-dashboard"
            aria-label="Zum Dashboard wechseln (${selectedCount} von ${total} Tagen ausgewählt)">
      <span class="app-header__selection-ring" aria-hidden="true">
        ${renderProgressRing(selectedCount, total)}
      </span>
      <span class="app-header__selection-count">${selectedCount}/${total} Tage</span>
    </button>
  `;

  root.innerHTML = `
    <div class="app-header__logo-wrap">
      <img class="app-header__logo" src="/logo.png" alt="Mahlzeit" />
    </div>
    <div class="app-header__center">
      ${chipHtml}
    </div>
    <div class="app-header__actions">
      ${menuBtnHtml(state.remoteHasUpdates)}
    </div>
  `;

  const goDashBtn = root.querySelector('[data-action="go-dashboard"]');
  if (goDashBtn && onGoDashboard) goDashBtn.addEventListener('click', () => onGoDashboard());
  root.querySelector('[data-action="open-settings"]').addEventListener('click', () => onOpenSettings());
}
