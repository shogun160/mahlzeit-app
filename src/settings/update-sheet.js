// Update-Sheet fuer den Remote-Rezept-Import.
// Rendert je nach Fetch-Ergebnis:
// - Fehler-Sheet (Netz weg / Schema-Mismatch)
// - "Alles aktuell"-Toast (kein Sheet)
// - Preview-Liste mit Bulk-Import-Button
// - Nach Import: Progress + Erfolgs-Zusammenfassung mit Warnungen

import { state, saveState } from '../state.js';
import { performImport, fetchRemoteJsons, diffRemoteAgainstLocal, SCHEMA_ERROR } from '../data/remote-updates.js';
import dishesData from '../data/dishes.json' with { type: 'json' };

let mountRoot = null;
let refreshApp = null;
let showToastFn = null;

export function mountUpdateSheet(root, { onChange, showToast }) {
  mountRoot = root;
  refreshApp = onChange;
  showToastFn = showToast;
}

export async function openUpdateSheet() {
  if (!mountRoot) return;
  renderLoading();

  const fetched = await fetchRemoteJsons();
  if (!fetched.ok) {
    renderError(fetched.error);
    return;
  }

  const { newIds } = diffRemoteAgainstLocal({
    bundled: dishesData.dishes,
    alreadyImported: state.remoteDishes,
    remote: fetched.dishes.dishes,
  });

  if (newIds.length === 0) {
    close();
    showToastFn?.('Deine Rezepte sind aktuell.');
    // remoteUpdatedAt trotzdem updaten damit "vor X min" stimmt.
    state.remoteLastFetchAt = new Date().toISOString();
    state.remoteUpdatedAt = state.remoteLastFetchAt;
    saveState();
    refreshApp?.();
    return;
  }

  const newDishes = fetched.dishes.dishes.filter((d) => newIds.includes(d.id));
  renderPreview(newDishes);
}

function renderLoading() {
  mountRoot.innerHTML = `
    <div class="update-sheet-overlay is-open" data-role="backdrop">
      <div class="update-sheet">
        <div class="update-sheet__handle" aria-hidden="true"></div>
        <div class="update-sheet__body">
          <p>Ich prüfe das Repo…</p>
        </div>
      </div>
    </div>
  `;
  wireBackdrop();
}

function renderError(errorCode) {
  const msg = {
    NETWORK: 'Keine Verbindung — versuch es später erneut.',
    PARSE: 'Rezepte-Datei ist beschädigt — bitte später erneut.',
    [SCHEMA_ERROR.TOO_NEW]: 'Neue Rezepte nutzen ein neueres Datenformat. Bitte die App aktualisieren und dann erneut versuchen.',
    [SCHEMA_ERROR.TOO_OLD]: 'Die Rezept-Quelle ist unerwartet älter als die App. Bitte melde dies auf GitHub.',
    [SCHEMA_ERROR.MISSING]: 'Die Rezept-Quelle hat keine Versions-Angabe. Bitte melde dies auf GitHub.',
  }[errorCode] || 'Unbekannter Fehler beim Update-Check.';

  mountRoot.innerHTML = `
    <div class="update-sheet-overlay is-open" data-role="backdrop">
      <div class="update-sheet">
        <div class="update-sheet__handle" aria-hidden="true"></div>
        <div class="update-sheet__body">
          <h2 class="update-sheet__title">Update fehlgeschlagen</h2>
          <p>${msg}</p>
          <div class="update-sheet__actions">
            <button type="button" class="btn btn--secondary" data-action="close">Schließen</button>
          </div>
        </div>
      </div>
    </div>
  `;
  wireBackdrop();
  mountRoot.querySelector('[data-action="close"]').addEventListener('click', close);
}

function renderPreview(newDishes) {
  const listHtml = newDishes.map((d) => `
    <li class="update-sheet__item">
      <span class="update-sheet__name">${esc(d.name)}</span>
      <span class="update-sheet__cuisine">${esc(d.cuisine || '')}</span>
    </li>
  `).join('');

  mountRoot.innerHTML = `
    <div class="update-sheet-overlay is-open" data-role="backdrop">
      <div class="update-sheet">
        <div class="update-sheet__handle" aria-hidden="true"></div>
        <div class="update-sheet__body">
          <h2 class="update-sheet__title">Neue Rezepte gefunden (${newDishes.length})</h2>
          <ul class="update-sheet__list">${listHtml}</ul>
          <div class="update-sheet__actions">
            <button type="button" class="btn btn--primary" data-action="import">${newDishes.length} Rezept${newDishes.length === 1 ? '' : 'e'} laden</button>
            <button type="button" class="btn btn--text" data-action="cancel">Abbrechen</button>
          </div>
        </div>
      </div>
    </div>
  `;
  wireBackdrop();
  mountRoot.querySelector('[data-action="cancel"]').addEventListener('click', close);
  mountRoot.querySelector('[data-action="import"]').addEventListener('click', () => startImport());
}

async function startImport() {
  const bodyEl = mountRoot.querySelector('.update-sheet__body');
  bodyEl.innerHTML = `
    <h2 class="update-sheet__title">Lade Rezepte…</h2>
    <p data-role="progress">Vorbereitung…</p>
  `;
  const progressEl = bodyEl.querySelector('[data-role="progress"]');

  const result = await performImport({
    onProgress: ({ phase, current, total, currentName }) => {
      if (phase === 'metadata') progressEl.textContent = 'Lese Rezept-Daten…';
      else if (phase === 'images') progressEl.textContent = `${current} von ${total} Bilder geladen${currentName ? ` (${currentName})` : ''}…`;
    },
  });

  if (!result.ok) {
    renderError(result.error);
    return;
  }

  const importedCount = result.imported.length;
  const skippedCount = result.warnings.length;
  const skippedHtml = skippedCount > 0
    ? `<p class="update-sheet__warning">${skippedCount} übersprungen — ${result.warnings.map((w) => `${esc(w.name)} (Zutat \`${esc(w.missingKey)}\` fehlt)`).join(', ')}</p>`
    : '';

  bodyEl.innerHTML = `
    <h2 class="update-sheet__title">Fertig</h2>
    <p>${importedCount} Rezept${importedCount === 1 ? '' : 'e'} geladen.</p>
    ${skippedHtml}
    <div class="update-sheet__actions">
      <button type="button" class="btn btn--primary" data-action="close">OK</button>
    </div>
  `;
  bodyEl.querySelector('[data-action="close"]').addEventListener('click', () => {
    close();
    refreshApp?.();
  });
}

function wireBackdrop() {
  const bd = mountRoot.querySelector('[data-role="backdrop"]');
  bd?.addEventListener('click', (ev) => {
    if (ev.target === bd) close();
  });
}

function close() {
  if (mountRoot) mountRoot.innerHTML = '';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
