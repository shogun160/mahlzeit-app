// Unified Bottom-Sheet mit zwei Modi: 'detail' und 'picker'.
// Beide teilen Hero (Bild + Overlays + Portion-Stepper) und Info-Section
// (Meta + Titel). Body wechselt in-place per switchMode — kein Close/Open.
// Body-Renderer folgen einem Contract (render/attach/detach/onPortionChange/
// onDishChange), siehe detail-body.js und picker-body.js.

import { state, PORTIONS_MIN, PORTIONS_MAX, DAYS, isFavorite, toggleFavorite, saveState } from '../state.js';
import { dishesById, isNewDish } from '../data/dishes.js';
import { bindDishImage } from '../data/dish-image.js';
import { changePortion } from '../dashboard/portions.js';
import { toggleSelected } from '../dashboard/selection.js';
import { rerollDay } from '../dashboard/reroll.js';
import { getScaleForDish } from '../nutrition/scale.js';
import { detailBody } from './detail-body.js';
import { pickerBody } from './picker-body.js';

// Material Symbol edit — Detail-Mode: oeffnet Picker-Mode fuer den Tag.
const ICON_EDIT = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M200-200h56l345-345-56-56-345 345v56Zm572-403L602-771l56-56q23-23 56.5-23t56.5 23l56 56q23 23 24 55.5T829-660l-57 57Zm-58 59L290-120H120v-170l424-424 170 170Zm-141-29-28-28 56 56-28-28Z"/></svg>`;
// Material Symbol info — Picker-Mode: oeffnet Detail-Mode fuer das aktuelle
// Gericht. Sitzt an derselben Position wie Edit-Pill im Detail-Mode.
const ICON_INFO = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>`;
// Material Symbol refresh — Reroll-Pille neben Edit/Info.
const ICON_REFRESH = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;
// Material Symbol shopping_bag — Liste-Pill (Outline off, Fill on).
const ICON_LIST         = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm0-80h480v-480h-80v80q0 17-11.5 28.5T600-520q-17 0-28.5-11.5T560-560v-80H400v80q0 17-11.5 28.5T360-520q-17 0-28.5-11.5T320-560v-80h-80v480Zm160-560h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-720Z"/></svg>`;
const ICON_LIST_FILLED  = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm160-640h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-720Z"/></svg>`;
// Material Symbols favorite — Outline off, Fill on.
const ICON_FAV_OUTLINE = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m480-121-41-37q-105.77-97.12-174.88-167.56Q195-396 154-451.5T96.5-552Q80-597 80-643q0-90.15 60.5-150.58Q201-854 290-854q57 0 105.5 27t84.5 78q42-54 89-79.5T670-854q89 0 149.5 60.42Q880-733.15 880-643q0 46-16.5 91T806-451.5Q765-396 695.88-325.56 626.77-255.12 521-158l-41 37Zm0-79q101.24-93.15 166.62-159.58Q712-426 750.5-476t54-89.13q15.5-39.13 15.5-77.87 0-65-42.5-107.5T670-793q-51.63 0-95.31 31.5Q531-730 504-660h-49q-26-69-70-101t-95-32q-65 0-107.5 42.5T140-643q0 38.74 15.5 77.87Q171-526 209.5-476t104 116.42Q378.87-293.15 480-200Zm0-296Z"/></svg>`;
const ICON_FAV_FILL    = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m480-121-41-37q-105.77-97.12-174.88-167.56Q195-396 154-451.5T96.5-552Q80-597 80-643q0-90.15 60.5-150.58Q201-854 290-854q52 0 98.5 22t81.5 62q35-40 81.5-62t98.5-22q89 0 149.5 60.42Q880-733.15 880-643q0 46-16.5 91T806-451.5Q765-396 695.88-325.56 626.77-255.12 521-158l-41 37Z"/></svg>`;
// Material Symbol auto_awesome (Sparkles) — Marker fuer neu importierte Rezepte.
const ICON_NEW_STAR = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>`;

const TRANSITION_MS = 250;
const SWIPE_THRESHOLD_PX = 55;
const SWIPE_DIRECTIONAL_RATIO = 1.4;

let rootEl = null;
let onExternalChange = () => {};
let onExternalPick = () => {};
let session = null;
// = { day, mode: 'detail'|'picker', detailTab: 'zutaten'|'rezept',
//     pickerAfterPickCallback: null }

// Body-Modul-Registry — Mode-String → Body-Renderer.
const BODIES = {
  detail: null,
  picker: null,
};

// --- Mount / Lifecycle ---

export function mountSheet(el, { onChange, onPick } = {}) {
  rootEl = el;
  onExternalChange = onChange || (() => {});
  onExternalPick = onPick || (() => {});
  BODIES.detail = detailBody;
  BODIES.picker = pickerBody;
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export function openSheet({ mode, day, tab = 'zutaten', onAfterPick = null } = {}) {
  if (!rootEl) throw new Error('Sheet nicht gemountet — mountSheet zuerst aufrufen.');
  session = {
    day,
    mode,
    detailTab: tab,
    pickerAfterPickCallback: onAfterPick,
  };
  renderShell();
  rootEl.hidden = false;
  // Doppel-rAF garantiert, dass der Browser den initialen translateY(100%)-
  // Zustand ge-paintet hat, bevor .is-open die Slide-up-Animation triggert.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const overlay = rootEl?.querySelector('.sheet-overlay');
      if (overlay) overlay.classList.add('is-open');
    });
  });
  document.addEventListener('keydown', handleEscape);
}

export function closeSheet() {
  if (!rootEl || rootEl.hidden) return;
  document.removeEventListener('keydown', handleEscape);
  if (typeof rootEl.__closeSwipeCleanup === 'function') {
    rootEl.__closeSwipeCleanup();
    rootEl.__closeSwipeCleanup = null;
  }
  // Body-Renderer aufraeumen (Handler-Refs, Timer, etc.).
  const activeBody = session ? BODIES[session.mode] : null;
  if (activeBody && typeof activeBody.detach === 'function') activeBody.detach();
  const overlay = rootEl.querySelector('.sheet-overlay');
  if (overlay) overlay.classList.remove('is-open');
  setTimeout(() => {
    if (rootEl && !rootEl.querySelector('.sheet-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
      session = null;
    }
  }, TRANSITION_MS);
}

function handleEscape(ev) {
  if (ev.key === 'Escape') closeSheet();
}

// --- Body-Router ---

// Wechselt in-place zwischen 'detail' und 'picker'. Hero bleibt stehen —
// nur der Body-Bereich wird ausgetauscht. Kein Close/Open, keine Slide-Anim.
function switchMode(nextMode, { tab } = {}) {
  if (!session || session.mode === nextMode) return;
  const prevBody = BODIES[session.mode];
  if (prevBody && typeof prevBody.detach === 'function') prevBody.detach();
  session.mode = nextMode;
  if (tab && nextMode === 'detail') session.detailTab = tab;
  // Hero-Overlay-Pills muessen mit — Edit-Pill (detail) vs. Info-Pill (picker).
  updateHeroForMode();
  // Body-Bereich neu befuellen.
  const bodySlot = rootEl.querySelector('[data-role="body-slot"]');
  if (!bodySlot) return;
  const nextBody = BODIES[nextMode];
  bodySlot.innerHTML = nextBody.render(session);
  nextBody.attach(bodySlot, session, buildBodyApi());
}

function buildBodyApi() {
  return {
    switchMode,
    close: closeSheet,
    onChange: () => {
      saveState();
      onExternalChange();
    },
    // Nach einem picker-tile-pick wandert state.assignment[day] auf das
    // neue dish. Hero + Info werden in-place upgedatet (Bild, Titel, Meta,
    // kcal-Pill, Fav-Pill, List-Pill) — kein outerHTML-swap, damit die
    // eventhandler auf dem hero intakt bleiben und der noch offene tile-
    // click nicht durch einen ausgetauschten DOM-teil weggerissen wird.
    onPick: (day, dishId) => {
      onExternalPick(day, dishId);
      updateHeroDish();
    },
  };
}

// In-place-Update fuer hero + info nach dish-change (via api.onPick). Nur
// die inhalte werden getauscht (textContent / innerHTML auf inneren nodes),
// keine outerHTML-swaps. Die day-pill bleibt gleich (session.day unveraendert).
function updateHeroDish() {
  if (!session || !rootEl) return;
  const dishId = state.assignment[session.day];
  const dish = dishesById.get(dishId);
  if (!dish) return;
  const heroImg = rootEl.querySelector('[data-role="hero-image"]');
  if (heroImg) bindDishImage(heroImg, dishId);
  const infoTitle = rootEl.querySelector('.sheet-info__title');
  if (infoTitle) infoTitle.textContent = dish.name;
  const infoMeta = rootEl.querySelector('.sheet-info__meta');
  if (infoMeta) infoMeta.textContent = `~${dish.cooktime} Min. · ${dish.cuisine}`;
  const kcalPill = rootEl.querySelector('.sheet-hero__meta-row .makro-pill--kcal');
  if (kcalPill) {
    const kcal = Math.round(dish.kcal * getScaleForDish(dish));
    kcalPill.innerHTML = `${kcal}<span class="unit"> kcal</span>`;
  }
  const favBtn = rootEl.querySelector('[data-action="toggle-fav"]');
  if (favBtn) {
    const favOn = isFavorite(dishId);
    favBtn.classList.toggle('is-on', favOn);
    favBtn.setAttribute('aria-pressed', String(favOn));
    const label = favOn ? 'Favorit entfernen' : 'Als Favorit markieren';
    favBtn.setAttribute('aria-label', label);
    favBtn.setAttribute('title', label);
    favBtn.innerHTML = favOn ? ICON_FAV_FILL : ICON_FAV_OUTLINE;
  }
  const listBtn = rootEl.querySelector('[data-action="toggle-list"]');
  if (listBtn) {
    const isSelected = !!state.selected[session.day];
    listBtn.classList.toggle('is-on', isSelected);
    listBtn.setAttribute('aria-pressed', String(isSelected));
    const label = isSelected ? 'Für Einkaufsliste abwählen' : 'Für Einkaufsliste auswählen';
    listBtn.setAttribute('aria-label', label);
    listBtn.setAttribute('title', label);
    listBtn.innerHTML = isSelected ? ICON_LIST_FILLED : ICON_LIST;
  }
}

// --- Rendering ---

function renderShell() {
  const bodyRenderer = BODIES[session.mode];
  const alreadyOpen = !rootEl.hidden;
  rootEl.innerHTML = `
    <div class="sheet-overlay ${alreadyOpen ? 'is-open' : ''}" data-role="backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        ${renderHero()}
        ${renderInfo()}
        <div class="sheet-body-slot" data-role="body-slot">${bodyRenderer.render(session)}</div>
      </div>
    </div>
  `;
  attachSheetHandlers();
  const bodySlot = rootEl.querySelector('[data-role="body-slot"]');
  bodyRenderer.attach(bodySlot, session, buildBodyApi());
}

function renderHero() {
  const dishId = state.assignment[session.day];
  const dish = dishesById.get(dishId);
  if (!dish) return '';
  const day = session.day;
  const portions = state.portions[day];
  const minusDisabled = portions <= PORTIONS_MIN;
  const plusDisabled = portions >= PORTIONS_MAX;
  const favOn = isFavorite(dish.id);
  const favLabel = favOn ? 'Favorit entfernen' : 'Als Favorit markieren';
  const isSelected = !!state.selected[day];
  const listLabel = isSelected ? 'Für Einkaufsliste abwählen' : 'Für Einkaufsliste auswählen';
  const newBadge = isNewDish(dish.id)
    ? `<span class="sheet-hero__new" aria-label="Neu importiert" title="Neu importiert">${ICON_NEW_STAR}</span>`
    : '';
  const kcal = Math.round(dish.kcal * getScaleForDish(dish));
  return `
    <div class="sheet-hero">
      <img class="sheet-hero__image" alt="" aria-hidden="true" data-role="hero-image" />
      <div class="sheet-handle sheet-hero__handle" aria-hidden="true">
        <div class="sheet-day-indicator">
          ${DAYS.map((_, i) => {
            const dayIdx = DAYS.indexOf(day);
            const isActive = i <= dayIdx;
            const isCurrent = i === dayIdx;
            const cls = ['sheet-day-dot'];
            if (isActive) cls.push('is-active');
            if (isCurrent) cls.push('is-current');
            return `<span class="${cls.join(' ')}"></span>`;
          }).join('')}
        </div>
      </div>
      <div class="day-card__edit-overlay" data-role="hero-mode-pills">
        ${renderModePill(day)}
        <button class="edit-pill" data-action="reroll-day" aria-label="Neues Gericht für ${day} auslosen" title="Neues Gericht auslosen">
          ${ICON_REFRESH}
        </button>
      </div>
      <div class="day-card__portion-overlay">
        ${newBadge}
        <button class="fav-pill ${favOn ? 'is-on' : ''}"
                type="button"
                data-action="toggle-fav"
                aria-pressed="${favOn}"
                aria-label="${favLabel}"
                title="${favLabel}">
          ${favOn ? ICON_FAV_FILL : ICON_FAV_OUTLINE}
        </button>
        <button class="fav-pill ${isSelected ? 'is-on' : ''}"
                type="button"
                data-action="toggle-list"
                aria-pressed="${isSelected}"
                aria-label="${listLabel}"
                title="${listLabel}">
          ${isSelected ? ICON_LIST_FILLED : ICON_LIST}
        </button>
      </div>
      <span class="sheet-hero__day">${day}</span>
      <div class="sheet-hero__meta-row">
        <span class="makro-pill makro-pill--kcal" aria-hidden="true">${kcal}<span class="unit"> kcal</span></span>
        <div class="stepper stepper--pill" role="group" aria-label="Portionen für ${day}">
          <svg class="stepper__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <button class="stepper__btn" data-action="sheet-portion-minus" aria-label="Weniger Personen für ${day}" ${minusDisabled ? 'disabled' : ''}>−</button>
          <span class="stepper__value">${portions}</span>
          <button class="stepper__btn" data-action="sheet-portion-plus" aria-label="Mehr Personen für ${day}" ${plusDisabled ? 'disabled' : ''}>+</button>
        </div>
      </div>
    </div>
  `;
}

// Mode-abhaengige Pill oben-links im Hero: Edit (detail) oder Info (picker).
// Handler ruft switchMode auf — kein Close/Open.
function renderModePill(day) {
  if (session.mode === 'detail') {
    return `<button class="edit-pill" data-action="switch-to-picker" aria-label="Anderes Gericht für ${day} auswählen" title="Anderes Gericht auswählen">${ICON_EDIT}</button>`;
  }
  return `<button class="edit-pill" data-action="switch-to-detail" aria-label="Rezept-Details anzeigen" title="Rezept-Details anzeigen">${ICON_INFO}</button>`;
}

function renderInfo() {
  const dishId = state.assignment[session.day];
  const dish = dishesById.get(dishId);
  if (!dish) return '';
  return `
    <div class="sheet-info">
      <div class="sheet-info__meta">~${dish.cooktime} Min. · ${dish.cuisine}</div>
      <h2 class="sheet-info__title" id="sheet-title">${dish.name}</h2>
    </div>
  `;
}

// Nur die Mode-Pill (Edit/Info) und die Info-Section neu rendern — Bild,
// Meta-Row und die anderen Overlay-Pills bleiben stehen. Wird bei switchMode
// gerufen, damit der Hero die passende Pill zur neuen Mode traegt.
function updateHeroForMode() {
  const heroModePills = rootEl.querySelector('[data-role="hero-mode-pills"]');
  if (heroModePills) {
    const rerollBtn = heroModePills.querySelector('[data-action="reroll-day"]');
    heroModePills.innerHTML = renderModePill(session.day) + (rerollBtn ? rerollBtn.outerHTML : '');
    // Handler fuer die neuen Buttons neu binden (Reroll + Mode-Switch).
    attachHeroModePillHandlers();
  }
}

// --- Sheet-Level-Handlers (Hero) ---

function attachSheetHandlers() {
  const overlay = rootEl.querySelector('[data-role="backdrop"]');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) closeSheet();
  });
  attachHeroHandlers();
  attachCloseSwipe();
}

// Bindet alle Handler die am Hero-DOM (.sheet-hero) haengen. Wird sowohl beim
// initialen Mount als auch nach rerenderHeroAndInfo aufgerufen — der ganze
// Hero-Node wird per outerHTML ersetzt, alle vorherigen Handler dort sind weg.
function attachHeroHandlers() {
  // Hero-Bild async binden — bundled sofort, Cache-URI fuer Remote-Rezepte
  // nach dem naechsten Frame.
  const heroImg = rootEl.querySelector('[data-role="hero-image"]');
  if (heroImg) {
    bindDishImage(heroImg, state.assignment[session.day]);
    // Klick aufs Bild im Detail-Mode schliesst das Sheet — zweite Close-
    // Affordance neben Runter-Swipe und Backdrop-Tap. Im Picker-Mode nicht,
    // dort ist das Bild reine Vorschau.
    heroImg.addEventListener('click', () => {
      if (session && session.mode === 'detail') closeSheet();
    });
  }

  // Portion-Stepper.
  rootEl.querySelector('[data-action="sheet-portion-minus"]').addEventListener('click', () => handleSheetPortion(-1));
  rootEl.querySelector('[data-action="sheet-portion-plus"]').addEventListener('click', () => handleSheetPortion(1));

  attachHeroModePillHandlers();

  // Fav-Pill Toggle — In-place-Update von Klasse + Icon + aria, dann Body
  // informieren (im Picker-Mode aendert sich das current-Tile-Ranking).
  const favBtn = rootEl.querySelector('[data-action="toggle-fav"]');
  if (favBtn) {
    favBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const id = state.assignment[session.day];
      if (id == null) return;
      toggleFavorite(id);
      const on = isFavorite(id);
      favBtn.classList.toggle('is-on', on);
      favBtn.setAttribute('aria-pressed', String(on));
      const label = on ? 'Favorit entfernen' : 'Als Favorit markieren';
      favBtn.setAttribute('aria-label', label);
      favBtn.setAttribute('title', label);
      favBtn.innerHTML = on ? ICON_FAV_FILL : ICON_FAV_OUTLINE;
      saveState();
      onExternalChange();
      notifyBodyDishChange();
    });
  }

  // Liste-Pill Toggle.
  const listBtn = rootEl.querySelector('[data-action="toggle-list"]');
  if (listBtn) {
    listBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleSelected(session.day);
      const on = !!state.selected[session.day];
      listBtn.classList.toggle('is-on', on);
      listBtn.setAttribute('aria-pressed', String(on));
      const label = on ? 'Für Einkaufsliste abwählen' : 'Für Einkaufsliste auswählen';
      listBtn.setAttribute('aria-label', label);
      listBtn.setAttribute('title', label);
      listBtn.innerHTML = on ? ICON_LIST_FILLED : ICON_LIST;
      saveState();
      onExternalChange();
      notifyBodyDishChange();
    });
  }

  attachHeroSwipe();
}

function attachHeroModePillHandlers() {
  // Reroll-Pill: neues Gericht fuer session.day auslosen.
  const rerollBtn = rootEl.querySelector('[data-action="reroll-day"]');
  if (rerollBtn) {
    rerollBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const beforeId = state.assignment[session.day];
      rerollDay(session.day);
      const nextId = state.assignment[session.day];
      if (nextId !== beforeId) {
        saveState();
        onExternalChange();
        // Hero komplett neu rendern (Bild, Meta, Info-Titel aendern sich).
        rerenderHeroAndInfo();
        notifyBodyDishChange();
      }
    });
  }

  // Edit-Pill (Detail-Mode) → in Picker-Mode wechseln.
  const editBtn = rootEl.querySelector('[data-action="switch-to-picker"]');
  if (editBtn) {
    editBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      switchMode('picker');
    });
  }

  // Info-Pill (Picker-Mode) → in Detail-Mode wechseln (Tab: Zutaten).
  const infoBtn = rootEl.querySelector('[data-action="switch-to-detail"]');
  if (infoBtn) {
    infoBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      switchMode('detail', { tab: 'zutaten' });
    });
  }
}

// Rendert Hero + Info neu — genutzt nach Reroll oder Day-Swipe (currentDish
// wechselt komplett). Body wird separat via notifyBodyDishChange informiert.
// Overlay + Close-Swipe leben weiter (haengen an .sheet-overlay / .sheet,
// die durch das outerHTML-Replace des Hero nicht angefasst werden).
function rerenderHeroAndInfo() {
  const sheet = rootEl.querySelector('.sheet');
  if (!sheet) return;
  const oldHero = sheet.querySelector('.sheet-hero');
  const oldInfo = sheet.querySelector('.sheet-info');
  const heroHtml = renderHero();
  const infoHtml = renderInfo();
  if (oldHero) oldHero.outerHTML = heroHtml;
  if (oldInfo) oldInfo.outerHTML = infoHtml;
  attachHeroHandlers();
}

function handleSheetPortion(delta) {
  if (!session) return;
  changePortion(session.day, delta);
  const portions = state.portions[session.day];
  // Stepper-Anzeige aktualisieren.
  rootEl.querySelector('.stepper__value').textContent = portions;
  rootEl.querySelector('[data-action="sheet-portion-minus"]').disabled = portions <= PORTIONS_MIN;
  rootEl.querySelector('[data-action="sheet-portion-plus"]').disabled = portions >= PORTIONS_MAX;
  saveState();
  onExternalChange();
  // Body informieren (Detail: Ingredients + Macro-Footer neu; Picker: no-op).
  const body = BODIES[session.mode];
  if (body && typeof body.onPortionChange === 'function') body.onPortionChange(session);
}

// Body-Renderer informieren, dass der Dish gewechselt hat (Reroll, Day-Swipe,
// Fav-Toggle, List-Toggle). Detail-Body rendert Ingredients+Recipe+Footer neu,
// Picker-Body aktualisiert das current-Tile.
function notifyBodyDishChange() {
  const body = BODIES[session.mode];
  if (body && typeof body.onDishChange === 'function') body.onDishChange(session);
}

// --- Swipes ---

// Hero-Swipe: horizontal → Day-Wechsel (fuer beide Modi), vertikal-runter →
// Close. Buttons + Stepper ausgenommen. StopPropagation im pointerdown haelt
// den .sheet-weiten attachCloseSwipe raus.
//
// setPointerCapture wird ERST gerufen, sobald der Finger sich um mindestens
// SWIPE_CAPTURE_THRESHOLD_PX bewegt hat. Vorher waere ein kurzer Tap auf eine
// Pill (edit, info, refresh, fav, list) — wenn die touch-koordinaten minimal
// neben dem visuellen pill-rand landen — vom hero abgefangen worden und der
// browser haette den click auf die pill verschluckt (pointer war captured am
// hero). Mit dem verzoegerten capture bleibt der klick fuer echte taps immer
// beim button-target.
function attachHeroSwipe() {
  const hero = rootEl.querySelector('.sheet-hero');
  if (!hero) return;
  const track = { startX: 0, startY: 0, tracking: false, captured: false, pointerId: -1 };
  const SWIPE_CAPTURE_THRESHOLD_PX = 8;
  hero.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (ev.target.closest('button, .stepper')) return;
    ev.stopPropagation();
    track.startX = ev.clientX;
    track.startY = ev.clientY;
    track.tracking = true;
    track.captured = false;
    track.pointerId = ev.pointerId;
  });
  hero.addEventListener('pointermove', (ev) => {
    if (!track.tracking || track.captured) return;
    const dx = ev.clientX - track.startX;
    const dy = ev.clientY - track.startY;
    if (Math.abs(dx) < SWIPE_CAPTURE_THRESHOLD_PX && Math.abs(dy) < SWIPE_CAPTURE_THRESHOLD_PX) return;
    track.captured = true;
    try { hero.setPointerCapture(track.pointerId); } catch (e) {}
  });
  hero.addEventListener('pointerup', (ev) => {
    if (!track.tracking) return;
    track.tracking = false;
    if (track.captured) {
      try { hero.releasePointerCapture(track.pointerId); } catch (e) {}
      track.captured = false;
    }
    const dx = ev.clientX - track.startX;
    const dy = ev.clientY - track.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx > SWIPE_THRESHOLD_PX && absDx > absDy * SWIPE_DIRECTIONAL_RATIO) {
      goToNeighborDay(dx < 0 ? +1 : -1);
      return;
    }
    if (dy > SWIPE_THRESHOLD_PX && dy > absDx * SWIPE_DIRECTIONAL_RATIO) {
      closeSheet();
    }
  });
  hero.addEventListener('pointercancel', () => {
    track.tracking = false;
    track.captured = false;
  });
}

function goToNeighborDay(delta) {
  if (!session) return;
  const idx = DAYS.indexOf(session.day);
  if (idx === -1) return;
  const nextIdx = idx + delta;
  if (nextIdx < 0 || nextIdx >= DAYS.length) return;
  const nextDay = DAYS[nextIdx];
  if (state.assignment[nextDay] == null) return;
  session.day = nextDay;
  // Hero + Info neu rendern (Bild, Meta, Titel wechseln), Body informieren.
  rerenderHeroAndInfo();
  notifyBodyDishChange();
}

// Runter-Swipe von ueberall im Sheet (ausser Buttons, Stepper, Body-Slot mit
// eigenem Scroll) schliesst das Sheet. setPointerCapture bindet alle Follow-
// Events an .sheet, damit pointerup garantiert ankommt.
function attachCloseSwipe() {
  const sheet = rootEl.querySelector('.sheet');
  if (!sheet) return;
  const track = { startX: 0, startY: 0, tracking: false };

  sheet.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (ev.target.closest('button, .stepper, .picker-filter-chip, [data-action="toggle-fav"]')) return;
    // Body-Slot hat eigenes Scroll — dort kein Close-Swipe.
    if (ev.target.closest('[data-role="body-slot"] .sheet-tabs__panel')) return;
    if (ev.target.closest('[data-role="body-slot"] .picker-body')) return;
    // Hero hat eigenen Handler (attachHeroSwipe) — hier keinen doppelten
    // Handler drueber laufen lassen, sonst schluckt setPointerCapture den
    // Hero-Handler.
    if (ev.target.closest('.sheet-hero')) return;
    track.startX = ev.clientX;
    track.startY = ev.clientY;
    track.tracking = true;
    try { sheet.setPointerCapture(ev.pointerId); } catch (e) {}
  });

  sheet.addEventListener('pointerup', (ev) => {
    if (!track.tracking) return;
    track.tracking = false;
    try { sheet.releasePointerCapture(ev.pointerId); } catch (e) {}
    const dx = ev.clientX - track.startX;
    const dy = ev.clientY - track.startY;
    if (dy <= SWIPE_THRESHOLD_PX) return;
    if (dy <= Math.abs(dx) * SWIPE_DIRECTIONAL_RATIO) return;
    closeSheet();
  });

  sheet.addEventListener('pointercancel', () => { track.tracking = false; });
}
