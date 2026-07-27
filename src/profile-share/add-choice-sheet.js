// Zwischen-Sheet zwischen "+ Profil hinzufuegen" und Wizard/Import.
// Zeigt drei Optionen. Auswahl fuehrt in Wizard (addProfile-Modus) oder
// Import-Sheet.

import { isScannerAvailable } from './scanner.js';

let rootEl = null;
let onManual = null;
let onImport = null;
const TRANSITION_MS = 200;

export function mountAddChoiceSheet(el) {
  rootEl = el;
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export function openAddChoiceSheet({ onManualChoice, onImportChoice }) {
  if (!rootEl) throw new Error('Add-Choice-Sheet nicht gemountet.');
  onManual = onManualChoice;
  onImport = onImportChoice;
  const scanEnabled = isScannerAvailable();
  const scanLabel = scanEnabled ? 'Profil-QR scannen' : 'Profil-QR scannen (nur in der App)';
  rootEl.innerHTML = `
    <div class="add-choice-overlay" data-role="backdrop">
      <div class="add-choice-sheet" role="dialog" aria-modal="true" aria-labelledby="add-choice-title">
        <div class="add-choice-sheet__handle" aria-hidden="true"></div>
        <div class="add-choice-sheet__header">
          <h2 class="add-choice-sheet__title" id="add-choice-title">Profil hinzufügen</h2>
          <button class="add-choice-sheet__close" type="button" data-action="close" aria-label="Schließen">✕</button>
        </div>
        <div class="add-choice-sheet__body">
          <p class="add-choice-sheet__desc">Wie möchtest du das neue Profil anlegen?</p>
          <div class="add-choice-sheet__actions">
            <button class="btn btn--primary add-choice-sheet__btn" type="button" data-action="manual">Manuell einrichten</button>
            <button class="btn btn--secondary add-choice-sheet__btn" type="button" data-action="scan"${scanEnabled ? '' : ' disabled'}>${scanLabel}</button>
            <button class="btn btn--text add-choice-sheet__btn" type="button" data-action="paste">Text einfügen</button>
          </div>
        </div>
      </div>
    </div>
  `;
  rootEl.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => rootEl.querySelector('.add-choice-overlay')?.classList.add('is-open'));
  });
  attach();
}

function attach() {
  rootEl.querySelector('[data-action="close"]')?.addEventListener('click', close);
  rootEl.querySelector('[data-role="backdrop"]')?.addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) close();
  });
  rootEl.querySelector('[data-action="manual"]')?.addEventListener('click', () => {
    close();
    onManual && onManual();
  });
  const importFn = () => {
    close();
    onImport && onImport();
  };
  rootEl.querySelector('[data-action="scan"]')?.addEventListener('click', importFn);
  rootEl.querySelector('[data-action="paste"]')?.addEventListener('click', importFn);
}

function close() {
  if (!rootEl || rootEl.hidden) return;
  rootEl.querySelector('.add-choice-overlay')?.classList.remove('is-open');
  setTimeout(() => {
    if (rootEl && !rootEl.querySelector('.add-choice-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
    }
  }, TRANSITION_MS);
}
