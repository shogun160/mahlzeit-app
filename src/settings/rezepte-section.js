// Rendert die "Rezepte"-Section im Settings-Sheet.
// Body: Label + Timestamp + Refresh-Icon-Button (statt Text-Button).
// Collapsed-Summary: Kurz-Status (aktuell / Noch nicht geprüft / Neue Rezepte).

import { state } from '../state.js';
import { canManualFetch } from '../data/remote-updates.js';
import { ICON_REFRESH } from '../dashboard/header.js';

// Kurz-Status fuer die collapsed Summary rechts im Section-Header.
export function buildRezepteSummary() {
  if (state.remoteHasUpdates) return 'Neue Rezepte';
  if (!state.remoteUpdatedAt) return 'Noch nicht geprüft';
  return 'aktuell';
}

// HTML-Body der Section: Primary-Label + Secondary (Timestamp), rechts Status + Icon-Button.
// Wenn ein Update ansteht (state.remoteHasUpdates), wird der Status als
// klickbarer Button gerendert — der User kann direkt in den Import-Flow
// springen ohne den Refresh-Icon-Umweg.
export function renderRezepteSectionBody() {
  const secondary = state.remoteUpdatedAt
    ? `Zuletzt geprüft: ${formatDateTime(state.remoteUpdatedAt)}`
    : 'Noch nicht geprüft';
  const status = buildStatusLabel();
  let statusHtml = '';
  if (status) {
    if (state.remoteHasUpdates) {
      statusHtml = `<button type="button"
                            class="rezepte-import__status rezepte-import__status--updates rezepte-import__status--action"
                            data-action="rezepte-open-update">${status}</button>`;
    } else {
      statusHtml = `<span class="rezepte-import__status">${status}</span>`;
    }
  }
  return `
    <div class="settings-row rezepte-import-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Rezepte importieren</div>
        <div class="settings-row__label-secondary">${secondary}</div>
      </div>
      <span class="settings-row__value rezepte-import__actions">
        ${statusHtml}
        <button type="button"
                class="icon-btn"
                data-action="rezepte-check"
                aria-label="Nach neuen Rezepten suchen"
                title="Nach neuen Rezepten suchen">
          ${ICON_REFRESH}
        </button>
      </span>
    </div>
  `;
}

// Status rechts neben dem Icon: leer bei Fresh-Install (kein Datum bekannt),
// sonst 'aktuell' oder 'Update verfügbar'.
function buildStatusLabel() {
  if (!state.remoteUpdatedAt) return '';
  return state.remoteHasUpdates ? 'Update verfügbar' : 'aktuell';
}

// Callbacks werden gemerkt, damit refreshRezepteRow() den Button nach dem
// DOM-Replace wieder verdrahten kann (der alte Listener ist mit dem alten
// Element gestorben).
let lastWireCallbacks = null;

// Wird nach dem Sheet-Rendering aufgerufen; verdrahtet Refresh-Icon und
// (falls sichtbar) den "Update verfügbar"-Status-Button.
export function wireRezepteSection(root, callbacks = {}) {
  lastWireCallbacks = { root, ...callbacks };
  const { onOpenUpdateSheet, onToast } = callbacks;

  const refreshBtn = root.querySelector('[data-action="rezepte-check"]');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      // Rate-Limit-Bypass wenn schon ein Update bekannt ist — der Fetch
      // laeuft trotzdem (und findet die neuen Rezepte auch beim zweiten
      // Klick), aber der Toast "keine neuen Rezepte" waere hier falsch.
      if (!canManualFetch() && !state.remoteHasUpdates) {
        onToast?.('Bereits gerade geprüft, keine neuen Rezepte.');
        return;
      }
      onOpenUpdateSheet?.();
    });
  }

  // "Update verfügbar" als Status-Button: kein Rate-Limit-Check noetig,
  // wir wissen ja bereits dass ein Update wartet.
  const statusBtn = root.querySelector('[data-action="rezepte-open-update"]');
  if (statusBtn) {
    statusBtn.addEventListener('click', () => {
      onOpenUpdateSheet?.();
    });
  }
}

// Aktualisiert die Row-DOM im offenen Settings-Sheet ohne renderShell().
// Wird vom Update-Sheet nach jedem Fetch aufgerufen, damit Timestamp + Status
// aktuell sind, ohne dass der User das Sheet schliessen und neu oeffnen muss.
// No-op wenn die Row nicht (mehr) im DOM ist.
export function refreshRezepteRow() {
  if (!lastWireCallbacks?.root) return;
  const oldRow = lastWireCallbacks.root.querySelector('.rezepte-import-row');
  if (!oldRow) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderRezepteSectionBody().trim();
  const newRow = wrapper.firstElementChild;
  if (!newRow) return;
  oldRow.replaceWith(newRow);
  wireRezepteSection(lastWireCallbacks.root, {
    onOpenUpdateSheet: lastWireCallbacks.onOpenUpdateSheet,
    onToast: lastWireCallbacks.onToast,
  });
}

// -- Helper -------------------------------------------------------------

function formatDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'unbekannt';
  // Deutsches Kompakt-Format: DD.MM.YY HH:MM
  const pad = (n) => String(n).padStart(2, '0');
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yy = pad(d.getFullYear() % 100);
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${dd}.${mm}.${yy} ${hh}:${mi}`;
}
