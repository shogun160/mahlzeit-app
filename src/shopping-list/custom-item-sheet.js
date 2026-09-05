// Sheet zum Anlegen und Bearbeiten eigener Einkaufslisten-Zutaten.
//
// Zwei Modi im selben Formular:
//   openCustomItemSheet()          → neu anlegen (mit MRU-Vorschlaegen)
//   openCustomItemSheet(item)      → bestehende bearbeiten (mit Loeschen-Button)
//
// Die Vorschlags-Chips fuellen nur das Formular, sie legen nichts direkt an —
// so kann der User einen Vorschlag antippen und die Menge noch anpassen.
//
// Waehrend des Tippens blendet sich unter dem Namensfeld die Zutaten-Suche ein
// (ingredient-search.js): App-Datenbank plus eigene Historie. Sie ersetzt die
// Chips nicht, sondern ergaenzt sie — die Chips sind der Leerzustand, das
// Dropdown die Reaktion auf Eingabe. In beiden Modi aktiv: der typische Edit
// ist die Tippfehler-Korrektur, und genau da hilft die Vervollstaendigung.

import {
  addCustomItem,
  updateCustomItem,
  removeCustomItem,
  recentSuggestions,
  DEFAULT_CUSTOM_CAT,
} from './custom-items.js';
import { searchIngredients } from './ingredient-search.js';
import { CAT_ORDER, CAT_LABELS } from './categories.js';
import { escapeHtml } from '../util/escape.js';
import { showToast } from '../util/toast.js';

// Fallback-Platzhalter im Mengenfeld: bewusst ein Nicht-Lebensmittel, damit
// klar ist, dass hier Freitext erlaubt ist und nicht nur Gramm.
const QTY_PLACEHOLDER = 'z. B. 2 Rollen';

// Nach Auswahl einer DB-Zutat zeigt der Platzhalter deren Einheit — das ist
// der beste Hinweis darauf, in welcher Groessenordnung der User denken soll.
// 'vorrat' und 'ei' bleiben beim Default: fuer die gibt es keine sinnvolle
// Einkaufsmenge, die man vorschlagen koennte.
function qtyPlaceholderFor(unit) {
  switch (unit) {
    case 'g': return 'z. B. 500 g';
    case 'ml': return 'z. B. 250 ml';
    case 'stueck': return 'z. B. 2 Stück';
    case 'bund': return 'z. B. 1 Bund';
    case 'zehe': return 'z. B. 2 Zehen';
    default: return QTY_PLACEHOLDER;
  }
}

let mountRoot = null;
let onChangeFn = null;
// Das gerade bearbeitete Item (null = Anlege-Modus).
let editing = null;
// Kategorie-Auswahl lebt im Modul, nicht im DOM — Chips werden bei jedem
// Wechsel neu gezeichnet.
let selectedCat = DEFAULT_CUSTOM_CAT;
// Aktueller Stand des Suchdropdowns. hits ist leer, solange nichts getippt
// wurde; activeIdx ist -1, solange der User nicht mit den Pfeiltasten
// navigiert hat (dann faengt Enter das Dropdown nicht ab).
let hits = [];
let activeIdx = -1;

export function mountCustomItemSheet(root, { onChange }) {
  mountRoot = root;
  onChangeFn = onChange;
}

export function openCustomItemSheet(item = null) {
  if (!mountRoot) return;
  editing = item;
  selectedCat = item?.cat || DEFAULT_CUSTOM_CAT;
  hits = [];
  activeIdx = -1;
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
        <div class="custom-item-sheet__field">
          <input class="custom-item-sheet__input"
                 id="custom-item-label"
                 type="text"
                 maxlength="60"
                 autocomplete="off"
                 role="combobox"
                 aria-expanded="false"
                 aria-autocomplete="list"
                 aria-controls="custom-item-suggest"
                 placeholder="z. B. Klopapier"
                 value="${escapeHtml(editing?.label || '')}" />
          <ul class="custom-item-suggest"
              id="custom-item-suggest"
              role="listbox"
              aria-label="Zutaten-Vorschläge"
              hidden></ul>
        </div>

        <label class="custom-item-sheet__label" for="custom-item-qty">Menge <span class="custom-item-sheet__optional">(optional)</span></label>
        <input class="custom-item-sheet__input"
               id="custom-item-qty"
               type="text"
               maxlength="30"
               autocomplete="off"
               placeholder="${QTY_PLACEHOLDER}"
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
  const suggestBox = mountRoot.querySelector('#custom-item-suggest');

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

  // ---- Zutaten-Suche unter dem Namensfeld ----

  const suggestOpen = () => !!suggestBox && !suggestBox.hidden;

  const closeSuggest = () => {
    hits = [];
    activeIdx = -1;
    if (!suggestBox) return;
    suggestBox.hidden = true;
    suggestBox.innerHTML = '';
    labelInput?.setAttribute('aria-expanded', 'false');
  };

  // Zeichnet nur die Liste neu — das Namensfeld bleibt unangetastet, sonst
  // verlaere der User bei jedem Tastendruck seine Cursor-Position.
  const paintSuggest = () => {
    if (!suggestBox) return;
    if (hits.length === 0) {
      closeSuggest();
      return;
    }
    suggestBox.innerHTML = hits.map((hit, i) => `
      <li class="custom-item-suggest__option ${i === activeIdx ? 'is-active' : ''}"
          role="option"
          aria-selected="${i === activeIdx}"
          data-hit="${i}">
        <span class="custom-item-suggest__label">${escapeHtml(hit.label)}</span>
        <span class="custom-item-suggest__meta">${
          hit.source === 'recent' ? 'zuletzt genutzt' : escapeHtml(CAT_LABELS[hit.cat] || '')
        }</span>
      </li>
    `).join('');
    suggestBox.hidden = false;
    labelInput?.setAttribute('aria-expanded', 'true');
  };

  // Uebernimmt einen Treffer ins Formular. Fokus geht in die MENGE, nicht
  // zurueck ins Namensfeld: die Zutat steht ja, offen ist nur noch wieviel.
  const applyHit = (hit) => {
    if (!hit) return;
    if (labelInput) labelInput.value = hit.label;
    applyCat(hit.cat || DEFAULT_CUSTOM_CAT);
    if (qtyInput) {
      // Historie bringt eine gemerkte Menge mit, die DB nicht — dort hilft
      // stattdessen der Einheiten-Platzhalter.
      if (hit.qty) qtyInput.value = hit.qty;
      qtyInput.placeholder = qtyPlaceholderFor(hit.unit);
    }
    closeSuggest();
    qtyInput?.focus();
  };

  const moveActive = (delta) => {
    if (hits.length === 0) return;
    const next = activeIdx + delta;
    // Ueber den Rand hinaus faellt die Auswahl zurueck auf "keine" — von dort
    // aus fuehrt der naechste Druck wieder an den jeweiligen Rand.
    activeIdx = next < -1 ? hits.length - 1 : next >= hits.length ? -1 : next;
    paintSuggest();
  };

  // Bewusst nur am input-Event, nicht am focus: beim Bearbeiten steht schon ein
  // Name im Feld, und ein Dropdown, das sich beim blossen Antippen ueber die
  // halbe Maske legt, waere im Weg.
  labelInput?.addEventListener('input', () => {
    hits = searchIngredients(labelInput.value);
    activeIdx = -1;
    paintSuggest();
  });

  // pointerdown statt click zum Schliessen verhindern: der Standard-Ablauf
  // waere blur → Liste weg → click landet ins Leere. preventDefault haelt den
  // Fokus im Feld, der click darunter feuert danach normal.
  suggestBox?.addEventListener('pointerdown', (ev) => ev.preventDefault());
  suggestBox?.addEventListener('click', (ev) => {
    const option = ev.target.closest('[data-hit]');
    if (!option) return;
    applyHit(hits[Number(option.dataset.hit)]);
  });

  // Verlaesst der Fokus das Feld anders als ueber einen Treffer (Tab, Tap auf
  // die Kategorie-Chips), soll die Liste nicht stehenbleiben.
  labelInput?.addEventListener('blur', closeSuggest);

  const save = () => {
    const fields = readForm();
    if (!fields.label.trim()) {
      labelInput?.focus();
      return;
    }
    if (editing) {
      const result = updateCustomItem(editing.id, fields);
      // Beim Umbenennen wurde ein gleichnamiger Eintrag geschluckt — ohne
      // Hinweis waere unklar, warum ploetzlich eine Zeile fehlt.
      if (result?.merged) showToast(`Mit vorhandenem Eintrag „${result.item.label}" zusammengefasst.`);
    } else {
      addCustomItem(fields);
    }
    close();
    onChangeFn?.();
  };

  mountRoot.querySelector('[data-action="save"]')?.addEventListener('click', save);

  // Enter im Namensfeld springt in die Menge, Enter in der Menge speichert —
  // eine Tastatur-Bedienung ohne Griff zum Button. Bei offenem Dropdown gehen
  // Pfeiltasten, Enter und Escape zuerst an die Vorschlagsliste.
  labelInput?.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (!suggestOpen()) return;
      ev.preventDefault();
      moveActive(ev.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (ev.key === 'Escape') {
      if (!suggestOpen()) return;
      // Nur die Liste schliessen, nicht das Sheet: stopPropagation haelt das
      // Event vom document-Listener fern, der sonst alles zumachte.
      ev.preventDefault();
      ev.stopPropagation();
      closeSuggest();
      return;
    }
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    // Nur uebernehmen, wenn der User bewusst einen Treffer angesteuert hat.
    // Ohne Navigation bleibt Enter das gewohnte "weiter zur Menge" — sonst
    // ueberschriebe es den gerade getippten Namen mit dem ersten Vorschlag.
    if (suggestOpen() && activeIdx >= 0) {
      applyHit(hits[activeIdx]);
      return;
    }
    closeSuggest();
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
  hits = [];
  activeIdx = -1;
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
