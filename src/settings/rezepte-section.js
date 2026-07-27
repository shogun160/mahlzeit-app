// Rendert die "Rezepte"-Section im Settings-Sheet.
// Zeigt eine dynamische Summary + einen Secondary-Button, der den
// Update-Flow triggert (Task A.11).

import { state } from '../state.js';
import { canManualFetch } from '../data/remote-updates.js';

// Baut die Summary-Zeile: nie geprueft / alles aktuell / X neue verfuegbar.
export function buildRezepteSummary() {
  if (!state.remoteUpdatedAt) return 'Noch nicht geprüft';
  const ago = formatAgo(state.remoteUpdatedAt);
  const importedCount = Array.isArray(state.remoteDishes) ? state.remoteDishes.length : 0;
  const parts = [`Zuletzt geprüft: ${ago}`];
  if (state.remoteHasUpdates) parts.unshift('Neue Rezepte verfügbar');
  else if (importedCount > 0) parts.push(`${importedCount} zusätzliche Rezepte geladen`);
  else parts.push('alle Rezepte sind aktuell');
  return parts.join(' · ');
}

// HTML-Body der Section (in section() eingesetzt).
export function renderRezepteSectionBody() {
  return `
    <button type="button" class="btn btn--secondary" data-action="rezepte-check">
      Nach neuen Rezepten suchen
    </button>
  `;
}

// Wird nach dem Sheet-Rendering aufgerufen; verdrahtet den Button.
export function wireRezepteSection(root, { onOpenUpdateSheet, onToast }) {
  const btn = root.querySelector('[data-action="rezepte-check"]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!canManualFetch()) {
      onToast?.('Bereits gerade geprüft, keine neuen Rezepte.');
      return;
    }
    onOpenUpdateSheet();
  });
}

// -- Helper -------------------------------------------------------------

function formatAgo(iso) {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return 'unbekannt';
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return `vor ${d} Tagen`;
}
