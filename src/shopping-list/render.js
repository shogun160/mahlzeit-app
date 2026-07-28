import { state, getActiveProfile } from '../state.js';
import { buildConsolidatedList } from './consolidate.js';
import { toggleChecked } from './check.js';
import { toggleCollapsed, expandCategory, isCollapsed, isCheckedExpanded, toggleCheckedExpanded } from './collapse.js';
import { renderProgress } from './progress.js';
import { CAT_ORDER, CAT_LABELS } from './categories.js';
import { formatQuantity } from '../util/format.js';

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

  // Sub-Divider innerhalb einer Kategorie (>=4 abgehakt): klappt den abgehakten
  // Teil auf/zu. Keyboard-Toggle wie Kategorie-Header.
  root.querySelectorAll('.shop-checked-divider').forEach((el) => {
    const handler = () => {
      toggleCheckedExpanded(el.dataset.checkedDividerCat);
      onChange();
    };
    el.addEventListener('click', handler);
    el.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      handler();
    });
  });

  // Expand-All: alle gerenderten Kategorien aufklappen — auch die vollstaendig
  // erledigten. Der Button erscheint auch im Done-State (alles abgehakt +
  // collapsed) und muss dort tatsaechlich alles wieder oeffnen koennen.
  const expandAllBtn = root.querySelector('[data-action="expand-all-shopping"]');
  if (expandAllBtn) {
    expandAllBtn.addEventListener('click', () => {
      for (const it of items) state.collapsedCategories.delete(it.cat);
      // Sub-Collapse der erledigten Bereiche bleibt bewusst auf Default —
      // Expand-All klappt nur die KATEGORIEN auf, nicht die erledigten Items
      // in ihnen. Falls der User zuvor "N erledigt" in einer Kat manuell
      // ausgeklappt hatte, wird das hier zurueckgesetzt.
      state.expandedCheckedCategories.clear();
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

  root.querySelectorAll('.shop-group__header').forEach((btn) => {
    // Keyboard-Toggle fuer div[role=button] (Enter/Space).
    btn.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      btn.click();
    });
    btn.addEventListener('click', () => {
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
  // Zählung im positiven Framing "erledigt/gesamt". Leftover-Zutaten (Gericht
  // abgewählt, Zeile "Nicht mehr im Plan") zählen NICHT im Soll — Soll = nur
  // aktuelle Zutaten mit Gerichtszuordnung. Haben-Zähler:
  //  - Fall 1: mindestens eine aktuelle Zutat noch offen → nur die abgehakten
  //    aktuellen zählen (Leftover werden ignoriert).
  //  - Fall 2: keine aktuelle offen → alle abgehakten zählen (inkl. Leftover),
  //    damit auch "was ich losgeworden bin" sichtbar bleibt. Ergibt z. B. 4/0
  //    für eine Kategorie mit ausschließlich Leftover-Zeilen.
  const currentItems = groupItems.filter((i) => !i.isLeftover);
  const total = currentItems.length;
  const currentOpen = currentItems.filter((i) => !state.checkedShopping.has(i.key)).length;
  const doneCount = currentOpen > 0
    ? currentItems.length - currentOpen
    : groupItems.filter((i) => state.checkedShopping.has(i.key)).length;
  const collapsed = isCollapsed(cat);
  const sorted = sortItems(groupItems);

  // Sub-Collapse fuer den "abgehakt"-Bereich innerhalb einer Kategorie: sobald
  // >=4 Zutaten abgehakt sind UND noch mindestens eine offen ist, wird der
  // abgehakte Teil unter einen klickbaren "N erledigt"-Divider geklappt.
  // Edge-Case openCount==0 laeuft ueber syncAutoCollapse — dann greift bereits
  // das Auto-Collapse der GANZEN Kategorie, kein zweiter Divider noetig.
  const checkedCount = groupItems.filter((i) => state.checkedShopping.has(i.key)).length;
  const openCountGrp = groupItems.length - checkedCount;
  const subCollapseActive = checkedCount >= 4 && openCountGrp > 0;
  const showChecked = !subCollapseActive || isCheckedExpanded(cat);

  // Rows-Aufbau: offene zuerst, dann optional Divider, dann abgehakte (wenn
  // ausgeklappt) oder leer (wenn eingeklappt). sortItems liefert bereits die
  // Reihenfolge offen→abgehakt, wir splitten am ersten abgehakten Item.
  const rowsParts = [];
  let dividerInserted = false;
  for (const item of sorted) {
    const isChecked = state.checkedShopping.has(item.key);
    if (subCollapseActive && isChecked && !dividerInserted) {
      rowsParts.push(renderCheckedDivider(cat, checkedCount, showChecked));
      dividerInserted = true;
    }
    if (subCollapseActive && isChecked && !showChecked) continue;
    rowsParts.push(renderRow(item));
  }
  const rows = rowsParts.join('');

  // FLACHE Struktur: Header und Liste liegen als Geschwister direkt im
  // .shop-groups-Container — das ist der Sticky-Scope. Nur so bleiben alle
  // Header sticky, wenn sie hochscrollen, und sammeln sich unter der Progress-
  // Bar. --stack-idx staffelt die top-Position pro Kategorie.
  //
  // Header ist DIV mit role="button" (nicht <button>), damit die Icon-Buttons
  // rechts (Reset + Check-All pro Kategorie) HTML-valid als eigene <button>-
  // Kinder existieren koennen. Icons sind nur sichtbar wenn die Kategorie
  // ausgeklappt ist — bei collapsed keinen zusaetzlichen Content.
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
      <span class="shop-group__count" aria-label="${doneCount} von ${total} erledigt">${doneCount}/${total}</span>
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

// Klickbarer Divider innerhalb einer Kategorie: klappt den abgehakten Teil
// (>=4 Items) auf/zu. Chevron rotiert wie beim Kategorie-Header.
function renderCheckedDivider(cat, checkedCount, expanded) {
  const label = `${checkedCount} erledigt`;
  return `
    <li class="shop-checked-divider ${expanded ? 'shop-checked-divider--expanded' : ''}"
        role="button"
        tabindex="0"
        data-checked-divider-cat="${cat}"
        aria-expanded="${expanded}">
      <span class="shop-checked-divider__chevron" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 8 10 12 14 8"></polyline>
        </svg>
      </span>
      <span class="shop-checked-divider__label">${label}</span>
    </li>
  `;
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
  const greeting = name ? `Sauber ${name}, du hast` : 'Sauber du hast';
  return `
    <div class="shop-done-banner" role="status">
      ${greeting} alles besorgt <img class="shop-done-banner__logo" src="/logo.png" alt="Mahlzeit" />
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
