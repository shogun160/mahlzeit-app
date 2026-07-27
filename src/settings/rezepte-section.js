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
export function renderRezepteSectionBody() {
  const secondary = state.remoteUpdatedAt
    ? `Zuletzt geprüft: ${formatDateTime(state.remoteUpdatedAt)}`
    : 'Noch nicht geprüft';
  const status = buildStatusLabel();
  const statusHtml = status
    ? `<span class="rezepte-import__status ${state.remoteHasUpdates ? 'rezepte-import__status--updates' : ''}">${status}</span>`
    : '';
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

// Wird nach dem Sheet-Rendering aufgerufen; verdrahtet den Button.
export function wireRezepteSection(root, callbacks = {}) {
  lastWireCallbacks = { root, ...callbacks };
  const { onOpenUpdateSheet, onToast } = callbacks;
  const btn = root.querySelector('[data-action="rezepte-check"]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!canManualFetch()) {
      onToast?.('Bereits gerade geprüft, keine neuen Rezepte.');
      return;
    }
    onOpenUpdateSheet?.();
  });
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
