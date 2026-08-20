// Rendert die "Rezepte"-Section im Settings-Sheet.
// Body: Label + Timestamp + Refresh-Icon-Button (statt Text-Button).
// Collapsed-Summary: Kurz-Status (aktuell / Noch nicht geprüft / Neue Rezepte).

import { state } from '../state.js';
import { canManualFetch } from '../data/remote-updates.js';
import { ICON_REFRESH } from '../dashboard/header.js';
import { buildExportPayload, countExportableMeals } from '../calendar/export-json.js';
import { shareExportText } from '../calendar/share.js';

// Android-Teilen-Icon: drei Knoten, verbunden durch zwei Linien. Das System-
// Symbol, das der User aus jeder Android-App kennt.
// Stroke-Style analog zu ICON_REFRESH (currentColor, gleiche Stroke-Width).
const ICON_SHARE = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="18" cy="5" r="3"></circle>
    <circle cx="6" cy="12" r="3"></circle>
    <circle cx="18" cy="19" r="3"></circle>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
  </svg>
`;

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
  const exportCount = countExportableMeals();
  const exportSecondary = exportCount > 0
    ? `${exportCount} ${exportCount === 1 ? 'Rezept' : 'Rezepte'} markiert`
    : 'Keine Rezepte markiert';
  const exportDisabled = exportCount === 0;

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
    <div class="settings-row rezepte-export-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Rezepte exportieren</div>
        <div class="settings-row__label-secondary">${exportSecondary}</div>
      </div>
      <span class="settings-row__value">
        <button type="button"
                class="icon-btn"
                data-action="rezepte-export"
                ${exportDisabled ? 'disabled' : ''}
                aria-label="Markierte Rezepte teilen"
                title="Markierte Rezepte teilen">
          ${ICON_SHARE}
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
      // Refresh-Icon triggert immer einen frischen Fetch (Prufen auf neue
      // Rezepte). 60s-rate-limit greift normal — bekannte updates werden
      // via klick auf den "update verfuegbar"-text geoeffnet (ohne fetch).
      if (!canManualFetch()) {
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

  const exportBtn = root.querySelector('[data-action="rezepte-export"]');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      if (exportBtn.disabled) return; // Safety-Belt fuer den Disabled-State
      const payload = buildExportPayload();
      const count = payload.meals.length;
      if (count === 0) {
        // Sollte durch disabled unerreichbar sein, aber defensiv:
        // falls das disabled-Attribut aus dem Template entfernt wird, bleibt
        // dieser Block als letzte Absicherung.
        onToast?.('Keine Rezepte markiert.');
        return;
      }
      const json = JSON.stringify(payload, null, 2);
      const noun = count === 1 ? 'Rezept' : 'Rezepte';
      const result = await shareExportText(json, {
        title: 'Mahlzeit-Wochenplan',
        dialogTitle: `${count} ${noun} teilen`,
      });
      if (result === 'shared') {
        onToast?.(`${count} ${noun} geteilt.`);
      } else if (result === 'copied') {
        // Kein Share-Ziel verfuegbar (Desktop-Browser) — Clipboard sprang ein.
        onToast?.(`${count} ${noun} kopiert — ab in den Claude-Chat.`);
      } else if (result === 'failed') {
        onToast?.('Teilen hat nicht geklappt. Nochmal probieren?');
      }
      // result === 'canceled' → der User hat abgebrochen, kein Toast noetig.
    });
  }
}

// Aktualisiert die Row-DOM im offenen Settings-Sheet ohne renderShell().
// Wird vom Update-Sheet nach jedem Fetch aufgerufen, damit Timestamp + Status
// aktuell sind, ohne dass der User das Sheet schliessen und neu oeffnen muss.
// No-op wenn die Row nicht (mehr) im DOM ist.
export function refreshRezepteRow() {
  if (!lastWireCallbacks?.root) return;
  const root = lastWireCallbacks.root;
  const oldImport = root.querySelector('.rezepte-import-row');
  const oldExport = root.querySelector('.rezepte-export-row');
  if (!oldImport) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderRezepteSectionBody().trim();
  const newRows = Array.from(wrapper.children);
  const newImport = newRows.find((el) => el.classList.contains('rezepte-import-row'));
  const newExport = newRows.find((el) => el.classList.contains('rezepte-export-row'));
  if (!newImport || !newExport) return;
  oldImport.replaceWith(newImport);
  if (oldExport) {
    oldExport.replaceWith(newExport);
  } else {
    // Migration: erster Refresh nach dem Update — alte DOM hat nur die
    // Import-Row. Danach ist die Export-Row im DOM und der if-Zweig greift.
    newImport.insertAdjacentElement('afterend', newExport);
  }
  wireRezepteSection(root, {
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
