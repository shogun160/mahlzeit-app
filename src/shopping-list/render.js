import { state, getActiveProfile } from '../state.js';
import { buildConsolidatedList } from './consolidate.js';
import { toggleChecked, resetChecked, checkAll } from './check.js';
import { toggleCollapsed, expandCategory, isCollapsed } from './collapse.js';
import { renderProgress } from './progress.js';
import { CAT_ORDER, CAT_LABELS } from './categories.js';
import { formatQuantity } from '../util/format.js';

// Material-Symbols fuer die per-Kategorie-Aktionen im Header:
// - refresh:  Reset (haekchen dieser Kategorie zuruecksetzen)
// - done_all: Check-All (alle offenen Zutaten dieser Kategorie abhaken)
const ICON_CAT_REFRESH = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;
const ICON_CAT_DONE_ALL = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m268-240-208-208 51-51 157 157 12 12-51 90Zm198 0L258-448l51-51 158 158 356-356 51 51-407 406Zm-1-199-52-51 205-205 51 51-204 205Z"/></svg>`;

const FLIP_DURATION_MS = 380;
const FLIP_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

// Rendert die komplette Shopping-View in `root`.
// onChange wird nach jedem Check-Toggle aufgerufen — damit `main.js#refresh()`
// die View + Header (Reset-Button-Sichtbarkeit) neu zeichnet.
export function renderShoppingList(root, { onChange }) {
  const consolidated = buildConsolidatedList();
  const items = Object.values(consolidated);

  if (items.length === 0) {
    root.innerHTML = renderEmptyState();
    return;
  }

  // FLIP-Snapshot vor dem Re-render: für jedes noch existierende Item merken wir
  // die alte Position — nach dem Re-render animieren wir vom alten zum neuen Ort.
  // Das lässt abgehakte Zutaten sichtbar an ihre neue Position (unten) gleiten.
  const oldRects = collectRects(root);

  let stackIdx = 0;
  const groupsHtml = CAT_ORDER.map((cat) => {
    const groupItems = items.filter((i) => i.cat === cat);
    if (groupItems.length === 0) return '';
    const html = renderGroup(cat, groupItems, stackIdx);
    stackIdx += 1;
    return html;
  }).join('');

  // "Alles besorgt"-Banner, wenn nichts mehr offen ist. Leftover-Items (bereits
  // abgehakt, Gericht nicht mehr im Plan) sind in items enthalten und zählen
  // als "abgehakt" — das Banner erscheint also auch, wenn nur noch Leftover-Reste
  // in der Liste stehen. Bewusst so: der User hat sein Einkaufsziel erreicht.
  const openCount = items.filter((i) => !state.checkedShopping.has(i.key)).length;
  const doneBannerHtml = openCount === 0 ? renderDoneBanner() : '';

  root.innerHTML = `
    ${renderProgress(items)}
    ${doneBannerHtml}
    <div class="shop-groups">${groupsHtml}</div>
  `;

  // Höhe der Sticky-Progress-Zeile messen und als CSS-Var setzen — die Kategorie-
  // Header nutzen sie für ihr sticky-top und scroll-margin-top, damit sie sauber
  // unter der Progress-Bar andocken statt darunter zu verschwinden.
  updateProgressHeightVar(root);

  root.querySelectorAll('.shop-item').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      const cat = consolidated[key]?.cat;
      toggleChecked(key);
      syncAutoCollapse(items, cat);
      onChange();
    });
  });

  // Expand-All: nur Kategorien mit noch offenen Zutaten aufklappen — vollständig
  // erledigte bleiben zu (Auto-Collapse ist bewusst dorthin gefahren).
  const expandAllBtn = root.querySelector('[data-action="expand-all-shopping"]');
  if (expandAllBtn) {
    expandAllBtn.addEventListener('click', () => {
      for (const it of items) {
        if (!state.checkedShopping.has(it.key)) state.collapsedCategories.delete(it.cat);
      }
      onChange();
    });
  }

  // Collapse-All: alle gerenderten Kategorien zuklappen (idempotent — bereits
  // eingeklappte bleiben eingeklappt).
  const collapseAllBtn = root.querySelector('[data-action="collapse-all-shopping"]');
  if (collapseAllBtn) {
    collapseAllBtn.addEventListener('click', () => {
      for (const it of items) state.collapsedCategories.add(it.cat);
      onChange();
    });
  }

  // Per-Kategorie-Aktionen: Reset + Check-All. stopPropagation, damit der
  // umschliessende Header-Klick nicht das Collapse-Toggle mit ausfuehrt.
  // Nach Check-All auch die Kategorie collapsen (analog zum manuellen
  // Abhaken der letzten offenen Zutat via syncAutoCollapse).
  root.querySelectorAll('[data-action="cat-reset"]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const cat = btn.dataset.cat;
      const keys = items.filter((i) => i.cat === cat).map((i) => i.key);
      resetChecked(keys);
      state.collapsedCategories.delete(cat);
      onChange();
    });
  });
  root.querySelectorAll('[data-action="cat-check-all"]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const cat = btn.dataset.cat;
      const keys = items.filter((i) => i.cat === cat).map((i) => i.key);
      checkAll(keys);
      state.collapsedCategories.add(cat);
      onChange();
    });
  });

  root.querySelectorAll('.shop-group__header').forEach((btn) => {
    // Keyboard-Toggle fuer div[role=button] (Enter/Space).
    btn.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      btn.click();
    });
    btn.addEventListener('click', (ev) => {
      // Klick auf einen Icon-Button in der Row darf den Toggle nicht triggern.
      if (ev.target.closest('.shop-group__action')) return;
      const cat = btn.dataset.cat;
      const list = root.querySelector(`ul.shop-list[data-cat="${cat}"]`);
      // Springen nur wenn der Header sticky ist UND seine ul nicht mehr sichtbar
      // unter ihm hängt (also die Kategorie tatsächlich weit weg gescrollt ist).
      // Beim untersten sticky-Header sind ihre Zutaten noch darunter zu sehen →
      // togglen wie ein normaler Header.
      const sticky = isHeaderSticky(btn, root);
      const listVisible = list && isListVisibleBelow(list, btn);
      if (sticky && !listVisible) {
        expandCategory(cat);
        onChange();
        requestAnimationFrame(() => {
          const newList = root.querySelector(`ul.shop-list[data-cat="${cat}"]`);
          if (newList) newList.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else {
        // Togglen. Wenn wir einklappen, kompensieren wir den scrollTop nur um
        // den Anteil der ul, den der User schon oben rausgescrollt hat. Damit
        // bleibt seine Sicht stabil:
        // - ul komplett unterhalb Viewport (noch nicht angescrollt) → keine
        //   Kompensation, der Content oberhalb bewegt sich nicht.
        // - ul teilweise/ganz oben rausgescrollt → Kompensation um genau den
        //   Anteil, der oben verschwunden ist (max: gesamte ul-Höhe + margin).
        let compensation = 0;
        if (!isCollapsed(cat) && list) {
          const listSpace = measureListSpace(list);
          const rootTop = root.getBoundingClientRect().top;
          const listTop = list.getBoundingClientRect().top;
          const scrolledPast = rootTop - listTop; // >0 wenn ul über root-top rausgescrollt
          compensation = Math.max(0, Math.min(scrolledPast, listSpace));
        }
        toggleCollapsed(cat);
        onChange();
        if (compensation > 0) {
          root.scrollTop = Math.max(0, root.scrollTop - compensation);
        }
      }
    });
  });

  playFlip(root, oldRects);
}

// Ist der Header aktuell im Sticky-Modus (also von der Scroll-Position an seiner
// berechneten sticky-top-Position festgeklebt), oder rührt er sich im Fluss mit?
// Vergleicht die Position des Headers rel. zum Scroll-Container mit dem
// theoretischen sticky-top (progressHeight + stackIdx * headerHeight).
function isHeaderSticky(btn, root) {
  const stackIdx = parseInt(btn.dataset.stackIdx, 10) || 0;
  const styles = getComputedStyle(root);
  const progressH = parseFloat(styles.getPropertyValue('--shop-progress-height')) || 64;
  const headerH = parseFloat(styles.getPropertyValue('--shop-group-header-height')) || 48;
  const stickyTop = progressH + stackIdx * headerH;
  const relTop = btn.getBoundingClientRect().top - root.getBoundingClientRect().top;
  // 2 px Toleranz für sub-pixel-Rundung.
  return relTop <= stickyTop + 2;
}

// Misst die vertikale Platz-Aufnahme der ul im Layout (Höhe + margin-bottom).
// Wird genutzt, um beim Einklappen den scrollTop entsprechend anzupassen.
function measureListSpace(list) {
  const h = list.getBoundingClientRect().height;
  const mb = parseFloat(getComputedStyle(list).marginBottom) || 0;
  return h + mb;
}

// Sind die Zutaten der Kategorie unter ihrem sticky Header noch (mindestens
// teilweise) sichtbar? "Sichtbar" heißt: die ul reicht weiter runter als das
// untere Ende des Header-Buttons. Bei display:none (collapsed) ist die ul-Höhe
// 0 und die Funktion liefert automatisch false.
function isListVisibleBelow(list, btn) {
  const listRect = list.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  return listRect.bottom > btnRect.bottom + 2;
}

function updateProgressHeightVar(root) {
  const progressEl = root.querySelector('.shop-progress');
  if (!progressEl) return;
  const h = Math.round(progressEl.getBoundingClientRect().height);
  if (h > 0) root.style.setProperty('--shop-progress-height', `${h}px`);
}

// Sobald die letzte offene Zutat einer Kategorie abgehakt wird → Kategorie einklappen.
// Sobald wieder eine offen ist (uncheck) → ausklappen, damit sie sichtbar wird.
// Manueller Klick auf den Header (siehe toggleCollapsed) bleibt unabhängig davon möglich.
function syncAutoCollapse(items, cat) {
  if (!cat) return;
  const groupItems = items.filter((i) => i.cat === cat);
  if (groupItems.length === 0) return;
  const openCount = groupItems.filter((i) => !state.checkedShopping.has(i.key)).length;
  if (openCount === 0) state.collapsedCategories.add(cat);
  else state.collapsedCategories.delete(cat);
}

function collectRects(root) {
  const rects = new Map();
  root.querySelectorAll('.shop-item').forEach((el) => {
    rects.set(el.dataset.key, el.getBoundingClientRect());
  });
  return rects;
}

// FLIP (First-Last-Invert-Play): setzt jedem Item zunächst einen Transform, der
// es optisch an seine alte Position rückt, und animiert diesen Transform in einem
// rAF zurück auf 0 — Ergebnis: sanfter Slide vom alten zum neuen Layout-Ort.
function playFlip(root, oldRects) {
  root.querySelectorAll('.shop-item').forEach((el) => {
    const oldRect = oldRects.get(el.dataset.key);
    if (!oldRect) return;
    const newRect = el.getBoundingClientRect();
    // Beim Ein-/Ausklappen einer Kategorie sind Items in ihr display:none →
    // rects sind 0×0 → FLIP-Translate wäre unsinnig. Skip.
    if (!newRect.width || !newRect.height) return;
    if (!oldRect.width || !oldRect.height) return;
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = `transform ${FLIP_DURATION_MS}ms ${FLIP_EASING}`;
      el.style.transform = '';
    });
  });
}

function renderGroup(cat, groupItems, stackIdx) {
  const total = groupItems.length;
  // Zählung konsistent zur Progress-Bar oben: "N offen von M gesamt".
  // Zeigt auf einen Blick, wieviel noch zu erledigen ist.
  const openCount = groupItems.filter((i) => !state.checkedShopping.has(i.key)).length;
  const collapsed = isCollapsed(cat);
  const sorted = sortItems(groupItems);
  const rows = sorted.map(renderRow).join('');

  // FLACHE Struktur: Header und Liste liegen als Geschwister direkt im
  // .shop-groups-Container — das ist der Sticky-Scope. Nur so bleiben alle
  // Header sticky, wenn sie hochscrollen, und sammeln sich unter der Progress-
  // Bar. --stack-idx staffelt die top-Position pro Kategorie.
  //
  // Header ist DIV mit role="button" (nicht <button>), damit die Icon-Buttons
  // rechts (Reset + Check-All pro Kategorie) HTML-valid als eigene <button>-
  // Kinder existieren koennen. Icons sind nur sichtbar wenn die Kategorie
  // ausgeklappt ist — bei collapsed keinen zusaetzlichen Content.
  const checkedCount = total - openCount;
  const hasChecked = checkedCount > 0;
  const hasOpen = openCount > 0;
  const iconsHtml = collapsed ? '' : `
    <div class="shop-group__actions">
      ${hasChecked ? `<button type="button"
              class="shop-group__action"
              data-action="cat-reset"
              data-cat="${cat}"
              aria-label="${CAT_LABELS[cat]}: Häkchen zurücksetzen"
              title="Häkchen zurücksetzen">${ICON_CAT_REFRESH}</button>` : ''}
      ${hasOpen ? `<button type="button"
              class="shop-group__action"
              data-action="cat-check-all"
              data-cat="${cat}"
              aria-label="${CAT_LABELS[cat]}: alle abhaken"
              title="Alle abhaken">${ICON_CAT_DONE_ALL}</button>` : ''}
    </div>
  `;
  return `
    <div class="shop-group__header ${collapsed ? 'shop-group__header--collapsed' : ''}"
         role="button"
         tabindex="0"
         data-cat="${cat}"
         data-stack-idx="${stackIdx}"
         style="--stack-idx: ${stackIdx};"
         aria-expanded="${!collapsed}">
      <span class="shop-group__chevron" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 8 10 12 14 8"></polyline>
        </svg>
      </span>
      <span class="shop-group__title">${CAT_LABELS[cat]}</span>
      <span class="shop-group__count" aria-label="${openCount} von ${total} offen">${openCount}/${total}</span>
      ${iconsHtml}
    </div>
    <ul class="shop-list ${collapsed ? 'shop-list--collapsed' : ''}" data-cat="${cat}" style="--stack-idx: ${stackIdx};">${rows}</ul>
  `;
}

// Innerhalb einer Kategorie: erst offene alphabetisch, dann abgehakte alphabetisch.
// Abgehakte wandern damit ans Ende der Kategorie.
function sortItems(items) {
  const collator = new Intl.Collator('de');
  return items.slice().sort((a, b) => {
    const aChecked = state.checkedShopping.has(a.key) ? 1 : 0;
    const bChecked = state.checkedShopping.has(b.key) ? 1 : 0;
    if (aChecked !== bChecked) return aChecked - bChecked;
    return collator.compare(a.label, b.label);
  });
}

function renderRow(item) {
  const checked = state.checkedShopping.has(item.key);
  const cls = ['shop-item'];
  if (checked) cls.push('shop-item--checked');
  if (item.isLeftover) cls.push('shop-item--leftover');
  return `
    <li class="${cls.join(' ')}" data-key="${item.key}">
      <span class="shop-item__check" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 10.5 8.5 15 16 6"></polyline>
        </svg>
      </span>
      <span class="shop-item__body">
        <span class="shop-item__label">${item.label}</span>
        <span class="shop-item__qty">${formatQuantity(item)}</span>
      </span>
    </li>
  `;
}

function renderDoneBanner() {
  // Persoenliche Copy wenn der User im Wizard einen Namen gesetzt hat, sonst
  // die neutrale Duz-Variante. escapeHtml() nicht noetig — der Name laeuft
  // schon durch den Wizard-Trim, kein HTML zugelassen.
  const name = getActiveProfile()?.name;
  const greeting = name ? `Sauber, ${name}, du hast` : 'Sauber, du hast';
  return `
    <div class="shop-done-banner" role="status">
      ${greeting} alles besorgt – Mahlzeit!
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="shop-empty">
      <p class="shop-empty__title">Keine Zutaten in der Liste.</p>
      <p class="shop-empty__sub">Wähle Gerichte auf dem Dashboard über den Liste-Button aus.</p>
    </div>
  `;
}
