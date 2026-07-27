import { addProfile } from '../state.js';
import { decodeProfile } from './payload.js';
import { allDishes } from '../data/dishes.js';
import { showToast } from '../util/toast.js';
import { isScannerAvailable, scanOnce } from './scanner.js';

let rootEl = null;
let onDone = null;
const TRANSITION_MS = 200;

export function mountProfileImportSheet(el) {
  rootEl = el;
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

// mode: 'scan' oeffnet direkt Kamera-Scanner; 'paste' zeigt Textarea.
// Kein Choice-Screen dazwischen — der Aufrufer (Add-Choice-Sheet oder
// Wizard-Welcome) hat schon eine Auswahl getroffen. Fallback bei Scan
// ohne Native: paste (defensiv, sollte im Web nicht getriggert werden,
// weil die Aufrufer den Scan-Button dort disabled zeigen).
export function openProfileImportSheet({ onImported, mode } = {}) {
  if (!rootEl) throw new Error('Import-Sheet nicht gemountet.');
  onDone = onImported || (() => {});
  const effective = (mode === 'scan' && !isScannerAvailable()) ? 'paste' : mode;

  if (effective === 'scan') {
    renderScan();
  } else {
    renderPaste();
  }

  rootEl.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      rootEl.querySelector('.import-sheet-overlay')?.classList.add('is-open');
    });
  });

  if (effective === 'scan') {
    // Kurz warten damit Sheet erst gerendert ist, dann Scanner triggern.
    setTimeout(handleScanFlow, 80);
  }
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

function renderScan() {
  rootEl.innerHTML = `
    <div class="import-sheet-overlay" data-role="backdrop">
      <div class="import-sheet" role="dialog" aria-modal="true" aria-labelledby="import-sheet-title">
        <div class="import-sheet__handle" aria-hidden="true"></div>
        <div class="import-sheet__header">
          <h2 class="import-sheet__title" id="import-sheet-title">QR-Code scannen</h2>
          <button class="import-sheet__close" type="button" data-action="close" aria-label="Schließen">✕</button>
        </div>
        <div class="import-sheet__body">
          <p class="import-sheet__desc">Kamera wird geöffnet…</p>
        </div>
      </div>
    </div>
  `;
  attachCloseHandlers();
}

function renderPaste() {
  const canPaste = typeof navigator !== 'undefined' && navigator.clipboard?.readText;
  rootEl.innerHTML = `
    <div class="import-sheet-overlay" data-role="backdrop">
      <div class="import-sheet" role="dialog" aria-modal="true" aria-labelledby="import-sheet-title">
        <div class="import-sheet__handle" aria-hidden="true"></div>
        <div class="import-sheet__header">
          <h2 class="import-sheet__title" id="import-sheet-title">Profil-Text einfügen</h2>
          <button class="import-sheet__close" type="button" data-action="close" aria-label="Schließen">✕</button>
        </div>
        <div class="import-sheet__body">
          <p class="import-sheet__desc">Text aus Chat/Mail hier einfügen:</p>
          <textarea class="import-sheet__textarea" data-role="paste" rows="5" placeholder="hier einfügen…"></textarea>
          <p class="import-sheet__error" data-role="paste-error" hidden></p>
          <div class="import-sheet__actions">
            ${canPaste ? `<button class="btn btn--secondary import-sheet__btn" type="button" data-action="paste-clipboard">Aus Zwischenablage einfügen</button>` : ''}
            <button class="btn btn--primary import-sheet__btn" type="button" data-action="do-import" disabled>Importieren</button>
          </div>
        </div>
      </div>
    </div>
  `;
  attachCloseHandlers();
  attachPasteHandlers();
}

function attachCloseHandlers() {
  rootEl.querySelector('[data-action="close"]')?.addEventListener('click', closeProfileImportSheet);
  rootEl.querySelector('[data-role="backdrop"]')?.addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) closeProfileImportSheet();
  });
}

function attachPasteHandlers() {
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
}

async function handleScanFlow() {
  // scan() nutzt das Google-Barcode-Scanner-Modul (Play Services). Kein
  // Kamera-Permission-Prompt noetig — statt dessen laedt das Modul beim
  // ersten Aufruf ggf. asynchron nach. Wir zeigen Progress im Sheet-Body.
  const onProgress = (state) => {
    const bodyEl = rootEl.querySelector('.import-sheet__body');
    if (!bodyEl) return;
    const label = state === 'downloading'
      ? 'Barcode-Scanner wird geladen…'
      : 'Barcode-Scanner wird installiert…';
    bodyEl.innerHTML = `<p class="import-sheet__desc">${label}</p>`;
  };

  const scan = await scanOnce({ onProgress });

  if (scan.error === 'install_failed') {
    showToast('Barcode-Scanner konnte nicht installiert werden — bitte Text-Weg nutzen.', { tone: 'error', duration: 4500 });
    closeProfileImportSheet();
    return;
  }
  if (scan.canceled || !scan.rawValue) {
    closeProfileImportSheet();
    return;
  }
  if (scan.error) {
    showToast('Scan-Fehler: ' + scan.error, { tone: 'error', duration: 4000 });
    closeProfileImportSheet();
    return;
  }
  const result = tryImport(scan.rawValue);
  if (!result.ok) {
    showToast(result.message, { tone: 'error', duration: 3500 });
    closeProfileImportSheet();
    return;
  }
  finishImport(result.profile, result.meta);
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
