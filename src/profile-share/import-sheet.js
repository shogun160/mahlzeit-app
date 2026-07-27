import { addProfile } from '../state.js';
import { decodeProfile } from './payload.js';
import { allDishes } from '../data/dishes.js';
import { showToast } from '../util/toast.js';
import { isScannerAvailable, requestPermission, scanOnce } from './scanner.js';

let rootEl = null;
let onDone = null;
const TRANSITION_MS = 200;

export function mountProfileImportSheet(el) {
  rootEl = el;
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export function openProfileImportSheet({ onImported } = {}) {
  if (!rootEl) throw new Error('Import-Sheet nicht gemountet.');
  onDone = onImported || (() => {});
  renderChoice();
  rootEl.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      rootEl.querySelector('.import-sheet-overlay')?.classList.add('is-open');
    });
  });
}

export function closeProfileImportSheet() {
  if (!rootEl || rootEl.hidden) return;
  rootEl.querySelector('.import-sheet-overlay')?.classList.remove('is-open');
  setTimeout(() => {
    if (rootEl && !rootEl.querySelector('.import-sheet-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
    }
  }, TRANSITION_MS);
}

function renderChoice() {
  const scannerHint = isScannerAvailable() ? '' : `<p class="import-sheet__hint">Kamera-Scan nur in der App verfügbar — im Browser bitte Text-Paste nutzen.</p>`;
  rootEl.innerHTML = `
    <div class="import-sheet-overlay" data-role="backdrop">
      <div class="import-sheet" role="dialog" aria-modal="true" aria-labelledby="import-sheet-title">
        <div class="import-sheet__handle" aria-hidden="true"></div>
        <div class="import-sheet__header">
          <h2 class="import-sheet__title" id="import-sheet-title">Profil importieren</h2>
          <button class="import-sheet__close" type="button" data-action="close" aria-label="Schließen">✕</button>
        </div>
        <div class="import-sheet__body">
          <p class="import-sheet__desc">QR-Code eines anderen Mahlzeit-Profils scannen oder den geteilten Text einfügen.</p>
          ${scannerHint}
          <div class="import-sheet__actions">
            <button class="btn btn--primary import-sheet__btn" type="button" data-action="scan"${isScannerAvailable() ? '' : ' disabled'}>QR-Code scannen</button>
            <button class="btn btn--secondary import-sheet__btn" type="button" data-action="paste">Text einfügen</button>
          </div>
        </div>
      </div>
    </div>
  `;
  attachChoiceHandlers();
}

function attachChoiceHandlers() {
  rootEl.querySelector('[data-action="close"]')?.addEventListener('click', closeProfileImportSheet);
  rootEl.querySelector('[data-role="backdrop"]')?.addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) closeProfileImportSheet();
  });
  rootEl.querySelector('[data-action="scan"]')?.addEventListener('click', handleScanFlow);
  rootEl.querySelector('[data-action="paste"]')?.addEventListener('click', renderPaste);
}

async function handleScanFlow() {
  const granted = await requestPermission();
  if (!granted) {
    showToast('Kamera-Berechtigung nötig — bitte in Systemeinstellungen erlauben oder Text einfügen.', { tone: 'error', duration: 4000 });
    return;
  }
  const scanned = await scanOnce();
  if (!scanned) return;
  const result = tryImport(scanned);
  if (!result.ok) {
    showToast(result.message, { tone: 'error', duration: 3500 });
    return;
  }
  finishImport(result.profile, result.meta);
}

function renderPaste() {
  const canPaste = typeof navigator !== 'undefined' && navigator.clipboard?.readText;
  rootEl.querySelector('.import-sheet__body').innerHTML = `
    <p class="import-sheet__desc">Text aus Chat/Mail hier einfügen:</p>
    <textarea class="import-sheet__textarea" data-role="paste" rows="5" placeholder="hier einfügen…"></textarea>
    <p class="import-sheet__error" data-role="paste-error" hidden></p>
    <div class="import-sheet__actions">
      ${canPaste ? `<button class="btn btn--secondary import-sheet__btn" type="button" data-action="paste-clipboard">Aus Zwischenablage einfügen</button>` : ''}
      <button class="btn btn--primary import-sheet__btn" type="button" data-action="do-import" disabled>Importieren</button>
      <button class="btn btn--text import-sheet__btn" type="button" data-action="back">Zurück</button>
    </div>
  `;
  const ta = rootEl.querySelector('[data-role="paste"]');
  const doBtn = rootEl.querySelector('[data-action="do-import"]');
  ta.addEventListener('input', () => {
    doBtn.disabled = ta.value.trim().length === 0;
    rootEl.querySelector('[data-role="paste-error"]').hidden = true;
  });
  rootEl.querySelector('[data-action="paste-clipboard"]')?.addEventListener('click', async () => {
    try {
      const t = await navigator.clipboard.readText();
      ta.value = t;
      doBtn.disabled = t.trim().length === 0;
    } catch { /* ignore */ }
  });
  rootEl.querySelector('[data-action="do-import"]').addEventListener('click', () => {
    const result = tryImport(ta.value.trim());
    if (!result.ok) {
      const err = rootEl.querySelector('[data-role="paste-error"]');
      err.textContent = result.message;
      err.hidden = false;
      return;
    }
    finishImport(result.profile, result.meta);
  });
  rootEl.querySelector('[data-action="back"]').addEventListener('click', renderChoice);
}

function tryImport(text) {
  const knownDishIds = allDishes.map((d) => d.id);
  const decoded = decodeProfile(text, { knownDishIds });
  if (decoded.error) {
    return { ok: false, message: messageForError(decoded.error) };
  }
  return { ok: true, profile: decoded.profile, meta: decoded.meta };
}

function messageForError(code) {
  switch (code) {
    case 'PARSE_ERROR': return 'Konnte den Text nicht lesen — sicher der richtige aus Mahlzeit?';
    case 'BAD_TYPE': return 'Das ist kein Mahlzeit-Profil.';
    case 'BAD_VERSION': return 'Diese Profil-Version wird von deiner App nicht unterstützt — bitte aktualisieren.';
    case 'INVALID_FIELD': return 'Profil hat ein ungültiges Feld — Import abgebrochen.';
    case 'TOO_LARGE': return 'Datei zu groß — vermutlich kein Mahlzeit-Profil.';
    default: return 'Import fehlgeschlagen.';
  }
}

function finishImport(profile, meta) {
  const added = addProfile(profile);
  const name = added.name || null;
  const skipped = meta?.favoritesSkipped || 0;
  const nameStr = name ? `Profil von ${name} hinzugefügt` : 'Profil hinzugefügt';
  const suffix = skipped > 0 ? ` (${skipped} Favoriten übersprungen)` : '';
  showToast(nameStr + suffix);
  closeProfileImportSheet();
  onDone(added);
}
