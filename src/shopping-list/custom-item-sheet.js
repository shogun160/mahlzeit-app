// Sheet zum Anlegen und Bearbeiten eigener Einkaufslisten-Zutaten.
//
// Zwei Modi im selben Formular:
//   openCustomItemSheet()          → neu anlegen (mit MRU-Vorschlaegen)
//   openCustomItemSheet(item)      → bestehende bearbeiten (mit Loeschen-Button)
//
// Die Vorschlags-Chips fuellen nur das Formular, sie legen nichts direkt an —
// so kann der User einen Vorschlag antippen und die Menge noch anpassen.

import {
  addCustomItem,
  updateCustomItem,
  removeCustomItem,
  recentSuggestions,
  DEFAULT_CUSTOM_CAT,
} from './custom-items.js';
import { CAT_ORDER, CAT_LABELS } from './categories.js';
import { escapeHtml } from '../util/escape.js';

let mountRoot = null;
let onChangeFn = null;
// Das gerade bearbeitete Item (null = Anlege-Modus).
let editing = null;
// Kategorie-Auswahl lebt im Modul, nicht im DOM — Chips werden bei jedem
// Wechsel neu gezeichnet.
let selectedCat = DEFAULT_CUSTOM_CAT;

export function mountCustomItemSheet(root, { onChange }) {
  mountRoot = root;
  onChangeFn = onChange;
}

export function openCustomItemSheet(item = null) {
  if (!mountRoot) return;
  editing = item;
  selectedCat = item?.cat || DEFAULT_CUSTOM_CAT;
  render();
}

function render() {
  const isEdit = !!editing;
  const suggestions = isEdit ? [] : recentSuggestions();

  mountRoot.innerHTML = `
    <div class="custom-item-overlay" data-role="backdrop">
      <div class="custom-item-sheet" role="dialog" aria-modal="true" aria-label="${isEdit ? 'Zutat bearbeiten' : 'Eigene Zutat hinzufügen'}">
        <div class="custom-item-sheet__handle" aria-hidden="true"></div>
        <h2 class="custom-item-sheet__title">${isEdit ? 'Zutat bearbeiten' : 'Eigene Zutat'}</h2>

        ${suggestions.length > 0 ? `
          <p class="custom-item-sheet__hint">Zuletzt genutzt</p>
          <div class="custom-item-sheet__chips" role="group" aria-label="Zuletzt genutzte Zutaten">
            ${suggestions.map((s, i) => `
              <button type="button" class="custom-item-chip" data-suggestion="${i}">
                ${escapeHtml(s.label)}
              </button>
            `).join('')}
          </div>
        ` : ''}

        <label class="custom-item-sheet__label" for="custom-item-label">Zutat</label>
        <input class="custom-item-sheet__input"
               id="custom-item-label"
               type="text"
               maxlength="60"
               autocomplete="off"
               placeholder="z. B. Klopapier"
               value="${escapeHtml(editing?.label || '')}" />

        <label class="custom-item-sheet__label" for="custom-item-qty">Menge <span class="custom-item-sheet__optional">(optional)</span></label>
        <input class="custom-item-sheet__input"
               id="custom-item-qty"
               type="text"
               maxlength="30"
               autocomplete="off"
               placeholder="z. B. 2 Rollen"
               value="${escapeHtml(editing?.qty || '')}" />

        <p class="custom-item-sheet__label">Kategorie</p>
        <div class="custom-item-sheet__chips" role="group" aria-label="Kategorie">
          ${CAT_ORDER.map((cat) => `
            <button type="button"
                    class="custom-item-chip ${cat === selectedCat ? 'custom-item-chip--active' : ''}"
                    data-cat="${cat}"
                    aria-pressed="${cat === selectedCat}">
              ${CAT_LABELS[cat]}
            </button>
          `).join('')}
        </div>

        <div class="custom-item-sheet__actions">
          <button type="button" class="btn btn--primary" data-action="save">
            ${isEdit ? 'Speichern' : 'Hinzufügen'}
          </button>
          ${isEdit ? `
            <button type="button" class="btn btn--danger" data-action="delete">Löschen</button>
          ` : ''}
          <button type="button" class="btn btn--text" data-action="cancel">Abbrechen</button>
        </div>
      </div>
    </div>
  `;

  wire();

  // Slide-in im naechsten Frame, sonst greift die CSS-Transition nicht.
  requestAnimationFrame(() => {
    mountRoot.querySelector('.custom-item-overlay')?.classList.add('is-open');
  });

  // Fokus nur beim Anlegen — beim Bearbeiten wuerde die Tastatur den Blick auf
  // den Loeschen-Button verdecken.
  if (!editing) {
    mountRoot.querySelector('#custom-item-label')?.focus();
  }
}

function wire() {
  const labelInput = mountRoot.querySelector('#custom-item-label');
  const qtyInput = mountRoot.querySelector('#custom-item-qty');

  const readForm = () => ({
    label: labelInput?.value || '',
    qty: qtyInput?.value || '',
    cat: selectedCat,
  });

  // Kategorie-Auswahl schaltet nur die Chip-Klassen um, ohne Re-render — sonst
  // muessten die bereits getippten Feldwerte jedes Mal von Hand gerettet werden.
  const applyCat = (cat) => {
    selectedCat = cat;
    mountRoot.querySelectorAll('[data-cat]').forEach((el) => {
      const active = el.dataset.cat === cat;
      el.classList.toggle('custom-item-chip--active', active);
      el.setAttribute('aria-pressed', String(active));
    });
  };

  mountRoot.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => applyCat(btn.dataset.cat));
  });

  // Vorschlags-Chip fuellt das Formular, statt direkt anzulegen — der User
  // soll die Menge noch anpassen koennen.
  const suggestions = recentSuggestions();
  mountRoot.querySelectorAll('[data-suggestion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = suggestions[Number(btn.dataset.suggestion)];
      if (!s) return;
      if (labelInput) labelInput.value = s.label;
      if (qtyInput) qtyInput.value = s.qty || '';
      applyCat(s.cat || DEFAULT_CUSTOM_CAT);
      labelInput?.focus();
    });
  });

  const save = () => {
    const fields = readForm();
    if (!fields.label.trim()) {
      labelInput?.focus();
      return;
    }
    if (editing) updateCustomItem(editing.id, fields);
    else addCustomItem(fields);
    close();
    onChangeFn?.();
  };

  mountRoot.querySelector('[data-action="save"]')?.addEventListener('click', save);

  // Enter im Namensfeld springt in die Menge, Enter in der Menge speichert —
  // eine Tastatur-Bedienung ohne Griff zum Button.
  labelInput?.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    qtyInput?.focus();
  });
  qtyInput?.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    save();
  });

  mountRoot.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    if (!editing) return;
    removeCustomItem(editing.id);
    close();
    onChangeFn?.();
  });

  mountRoot.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

  const backdrop = mountRoot.querySelector('[data-role="backdrop"]');
  backdrop?.addEventListener('click', (ev) => {
    if (ev.target === backdrop) close();
  });

  // Erst entfernen, dann setzen: ein zweites Oeffnen ohne sauberes Close
  // wuerde sonst einen zweiten Listener hinterlassen.
  document.removeEventListener('keydown', handleEsc);
  document.addEventListener('keydown', handleEsc);
}

function handleEsc(ev) {
  if (ev.key === 'Escape') close();
}

function close() {
  document.removeEventListener('keydown', handleEsc);
  editing = null;
  // is-open sofort entfernen, damit der Overlay-Blur wegkippt, bevor die
  // Slide-Down-Animation durch ist (siehe util/overlay-blur.js).
  const overlay = mountRoot?.querySelector('.custom-item-overlay');
  overlay?.classList.remove('is-open');
  setTimeout(() => {
    if (mountRoot && !mountRoot.querySelector('.custom-item-overlay.is-open')) {
      mountRoot.innerHTML = '';
    }
  }, 220);
}
