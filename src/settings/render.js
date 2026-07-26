import {
  state,
  PORTIONS_MIN,
  PORTIONS_MAX,
  COOKTIME_MIN,
  COOKTIME_MAX,
  COOKTIME_STEP,
} from '../state.js';
import { changeDefaultPortions } from '../dashboard/portions.js';
import { GOALS } from '../nutrition/target.js';

const TRANSITION_MS = 250;
const SWIPE_THRESHOLD_PX = 55;
const SWIPE_DIRECTIONAL_RATIO = 1.4; // |dy| muss 1.4x größer als |dx| sein

// Material Symbols für Theme-Toggle. Alle im viewBox 0 -960 960 960.
// contrast: Kreis halb hell/halb dunkel (Auto-Modus).
// light_mode: Sonne mit Strahlen. dark_mode: Sichel-Mond.
const ICON_CONTRAST   = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm40-82q100-15 170-92.5T760-480q0-108-70-185.5T520-758v596Z"/></svg>`;
const ICON_LIGHT_MODE = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0 80q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280ZM200-440H40v-80h160v80Zm720 0H760v-80h160v80ZM440-760v-160h80v160h-80Zm0 720v-160h80v160h-80ZM256-650l-101-97 57-59 96 100-52 56Zm492 496-97-101 53-55 101 97-57 59Zm-98-550 97-101 59 57-100 96-56-52ZM154-212l101-97 55 53-97 101-59-57Z"/></svg>`;
const ICON_DARK_MODE  = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q55 0 101-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120Z"/></svg>`;

let rootEl = null;
let onExternalChange = () => {};
let onExternalOpenOnboarding = () => {};
let onExternalThemeChange = () => {};
// Zugeklappte Sections (transient — verliert sich beim App-Restart, überlebt
// aber Sheet-Close/Reopen weil das Modul lebt).
const collapsedSections = new Set();
// Zähler für sticky-Stack-Position der Section-Header. Wird bei jedem
// renderShell() zurückgesetzt und pro section()-Aufruf inkrementiert.
// Analog zu stackIdx in shopping-list/render.js — jeder Header klebt gestaffelt
// unter den vorigen (stack-idx * header-height als top-Offset).
let sectionStackIdx = 0;

// --- Mount / Lifecycle ---

let onExternalOpenProfileDetail = () => {};
let onExternalAddProfile = () => {};

export function mountSettingsSheet(el, { onChange, onOpenOnboarding, onOpenProfileDetail, onAddProfile, onThemeChange } = {}) {
  rootEl = el;
  onExternalChange = onChange || (() => {});
  onExternalOpenOnboarding = onOpenOnboarding || (() => {});
  onExternalOpenProfileDetail = onOpenProfileDetail || (() => {});
  onExternalAddProfile = onAddProfile || (() => {});
  onExternalThemeChange = onThemeChange || (() => {});
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export function openSettingsSheet() {
  if (!rootEl) throw new Error('Settings-Sheet nicht gemountet.');
  renderShell();
  rootEl.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => rootEl.querySelector('.settings-overlay').classList.add('is-open'));
  });
  document.addEventListener('keydown', handleEscape);
}

export function closeSettingsSheet() {
  if (!rootEl || rootEl.hidden) return;
  const overlay = rootEl.querySelector('.settings-overlay');
  if (overlay) overlay.classList.remove('is-open');
  document.removeEventListener('keydown', handleEscape);
  setTimeout(() => {
    if (rootEl && !rootEl.querySelector('.settings-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
    }
  }, TRANSITION_MS);
}

function handleEscape(ev) {
  if (ev.key === 'Escape') closeSettingsSheet();
}

// --- Rendering ---

function renderShell() {
  const { defaultPortions, maxCookTime } = state.settings;
  const minusDisabled = defaultPortions <= PORTIONS_MIN;
  const plusDisabled = defaultPortions >= PORTIONS_MAX;
  // Stack-Idx pro Render-Zyklus zurücksetzen. Jeder section()-Aufruf zählt hoch.
  sectionStackIdx = 0;

  // Expand/Collapse-Buttons sind IMMER im DOM. Sichtbarkeit wird direkt nach
  // dem innerHTML-Set via syncHeaderActions() gesetzt — beim ersten Render sind
  // die Sections noch nicht im DOM, deshalb können wir die Zählung nicht schon
  // hier machen.

  rootEl.innerHTML = `
    <div class="settings-overlay" data-role="backdrop">
      <div class="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="settings-handle" aria-hidden="true"></div>
        <div class="settings-header">
          <h2 class="settings-header__title" id="settings-title">Einstellungen</h2>
          <div class="settings-header__actions">
            <button class="settings-header__action"
                    data-action="expand-all"
                    aria-label="Alle Abschnitte aufklappen"
                    title="Alle aufklappen"
                    hidden>
              <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-120 300-300l56-56 124 124 124-124 56 56-180 180Zm-124-504-56-56 180-180 180 180-56 56-124-124-124 124Z"/></svg>
            </button>
            <button class="settings-header__action"
                    data-action="collapse-all"
                    aria-label="Alle Abschnitte zuklappen"
                    title="Alle zuklappen"
                    hidden>
              <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m296-88-56-56 240-240 240 240-56 56-184-183L296-88Zm184-544L240-872l56-56 184 183 184-183 56 56-240 240Z"/></svg>
            </button>
            <button class="settings-close" data-action="close" aria-label="Schließen">✕</button>
          </div>
        </div>
        <div class="settings-body">
          ${section('portionen', 'Portionen', `
            <div class="settings-row">
              <div class="settings-row__label">
                <div class="settings-row__label-primary">Standard-Personenzahl</div>
                <div class="settings-row__label-secondary">Wird sofort auf alle Tage angewendet</div>
              </div>
              <div class="stepper stepper--compact" role="group" aria-label="Standard-Personenzahl">
                <button class="stepper__btn" data-action="portions-minus" aria-label="Weniger" ${minusDisabled ? 'disabled' : ''}>−</button>
                <span class="stepper__value" data-role="portions-value">${defaultPortions}</span>
                <button class="stepper__btn" data-action="portions-plus" aria-label="Mehr" ${plusDisabled ? 'disabled' : ''}>+</button>
              </div>
            </div>
          `)}

          ${section('kochzeit', 'Kochzeit', `
            <div class="settings-field">
              <div class="settings-row">
                <div class="settings-row__label">
                  <div class="settings-row__label-primary">Maximale Kochzeit</div>
                  <div class="settings-row__label-secondary">Gerichte darüber werden nicht ausgelost</div>
                </div>
                <div class="settings-row__value" data-role="cooktime-value">${formatCookTime(maxCookTime)}</div>
              </div>
              <input type="range"
                     class="settings-slider"
                     data-action="cooktime-change"
                     min="${COOKTIME_MIN}"
                     max="${COOKTIME_MAX}"
                     step="${COOKTIME_STEP}"
                     value="${maxCookTime}"
                     aria-label="Maximale Kochzeit in Minuten" />
            </div>
          `)}

          ${section('praeferenzen', 'Ernährungspräferenzen', `
            <div class="settings-prefs" role="group" aria-label="Ernährungspräferenzen">
              ${renderPrefChip('meat', 'Fleisch')}
              ${renderPrefChip('fish', 'Fisch')}
              ${renderPrefChip('vegetarian', 'Vegetarisch')}
            </div>
          `)}

          ${section('kuechen', 'Küchen-Präferenzen', `
            <div class="settings-prefs" role="group" aria-label="Küchen-Präferenzen">
              ${renderCuisineChip('asian',         'Asiatisch')}
              ${renderCuisineChip('mediterranean', 'Mediterran')}
              ${renderCuisineChip('middleEast',    'Nahost')}
              ${renderCuisineChip('americas',      'Amerikanisch')}
            </div>
          `)}

          ${section('profile', 'Profile', renderProfileList())}

          ${section('darstellung', 'Darstellung', `
            <div class="settings-row">
              <div class="settings-row__label">
                <div class="settings-row__label-primary">Erscheinungsbild</div>
              </div>
              <div class="theme-toggle" role="group" aria-label="Erscheinungsbild">
                <button class="theme-toggle__chip" type="button" data-action="theme-pick" data-value="auto"  aria-pressed="${state.settings.theme === 'auto'}"  aria-label="System">
                  ${ICON_CONTRAST}<span>System</span>
                </button>
                <button class="theme-toggle__chip" type="button" data-action="theme-pick" data-value="light" aria-pressed="${state.settings.theme === 'light'}" aria-label="Hell">
                  ${ICON_LIGHT_MODE}<span>Hell</span>
                </button>
                <button class="theme-toggle__chip" type="button" data-action="theme-pick" data-value="dark"  aria-pressed="${state.settings.theme === 'dark'}"  aria-label="Dunkel">
                  ${ICON_DARK_MODE}<span>Dunkel</span>
                </button>
              </div>
            </div>
            <p class="settings-section__note settings-section__note--soft">Akzentfarbe kommt in einer späteren Iteration</p>
          `)}

          ${section('daten', 'Daten', `
            <div class="settings-row">
              <div class="settings-row__label">
                <div class="settings-row__label-primary">Einrichtung</div>
                <div class="settings-row__label-secondary">Profil-Werte über den Wizard neu setzen</div>
              </div>
              <button class="settings-action-btn" type="button" data-action="open-onboarding">Starten</button>
            </div>
            <p class="settings-section__note settings-section__note--soft">Kommt bald: Gerichte importieren und erstellen</p>
          `)}

          ${section('ueber', 'Über', `
            <a class="settings-link settings-link--compact"
               href="https://github.com/shogun160/mahlzeit-app"
               target="_blank"
               rel="noopener noreferrer">
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              <span>GitHub</span>
            </a>
          `)}
        </div>
      </div>
    </div>
  `;

  attachHandlers();
  // Initial-Sync jetzt, wo die Sections im DOM sind. Sonst wären die Header-
  // Buttons falsch versteckt beim Sheet-Reopen mit persistierten collapsedSections.
  syncHeaderActions();
  updateStickyState();
}

function formatCookTime(min) {
  return min >= COOKTIME_MAX ? 'egal' : `${min} Min`;
}

// Header + Body als FLACHE Geschwister direkt im .settings-body — kein
// <section>-Wrapper. Nur so bleibt der sticky-Header sichtbar, wenn er weit
// hochgescrollt ist; ein Wrapper würde den Header mit rausschieben, sobald
// seine section über den Body-Rand rutscht (siehe shopping-list.css Kommentar
// zur gleichen Falle). --stack-idx staffelt die top-Position pro Section,
// sodass sich bereits weggescrollte Header oben stapeln.
// extraCls wird auf den Body angewendet (nicht auf einen Wrapper) — z. B.
// "settings-section-body--soon" für die dimmed "Kommt bald"-Sections.
function section(key, title, contentHtml, extraCls = '') {
  const collapsed = collapsedSections.has(key);
  const stackIdx = sectionStackIdx++;
  const chevron = `<svg class="settings-section__chevron" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z"/></svg>`;
  const summary = summaryFor(key);
  return `
    <button class="settings-section__toggle ${collapsed ? 'settings-section__toggle--collapsed' : ''}"
            type="button"
            data-section-toggle="${key}"
            data-stack-idx="${stackIdx}"
            aria-expanded="${!collapsed}"
            style="--stack-idx: ${stackIdx};">
      <span class="settings-section__title">${title}</span>
      <span class="settings-section__summary" data-section-summary="${key}">${summary}</span>
      ${chevron}
    </button>
    <div class="settings-section__body ${extraCls}"
         data-section-body="${key}"
         style="--stack-idx: ${stackIdx};"
         ${collapsed ? 'hidden' : ''}>
      ${contentHtml}
    </div>
  `;
}

// Kurzfassung der wichtigsten Info pro Section — wird im Toggle-Header rechts
// angezeigt (nur bei collapsed sichtbar via CSS), damit der User beim eingeklappten
// Sheet auf einen Blick den aktuellen Wert sieht ohne aufklappen zu müssen.
// Filter-Sections: positives Framing "aktiv/gesamt" wie in der Einkaufsliste.
function summaryFor(key) {
  const s = state.settings;
  if (key === 'portionen') return String(s.defaultPortions);
  if (key === 'kochzeit')  return formatCookTime(s.maxCookTime);
  if (key === 'praeferenzen') {
    const total = 3;
    const active = ['meat', 'fish', 'vegetarian'].filter((k) => s.preferences?.[k]).length;
    return `${active}/${total}`;
  }
  if (key === 'kuechen') {
    const total = 4;
    const active = ['asian', 'mediterranean', 'middleEast', 'americas'].filter((k) => s.cuisines?.[k]).length;
    return `${active}/${total}`;
  }
  if (key === 'profile') {
    // Anzahl Profile — kompakte Zusammenfassung. Detailwerte pro Profil sind
    // im Detail-Sheet.
    const count = state.settings.profiles?.length ?? 0;
    return count <= 1 ? '1 Profil' : `${count} Profile`;
  }
  return '';
}

// Aktualisiert die Summary im Section-Header, ohne den Section neu zu rendern.
// Wird nach jeder State-Änderung aufgerufen, die die Summary betrifft.
function updateSectionSummary(key) {
  const el = rootEl?.querySelector(`[data-section-summary="${key}"]`);
  if (!el) return;
  el.textContent = summaryFor(key);
}

// Setzt/entfernt die --sticky-Modifier-Klasse pro Section-Toggle. Die CSS-Regel
// zeigt die Summary nur wenn --sticky aktiv ist. Wird beim Scrollen der
// Settings-Body und nach Layout-Änderungen (Toggle, Expand/Collapse-All) gerufen.
//
// Bedingung ist identisch zum smart Klick-Handler: sticky UND Body nicht mehr
// unter dem Header sichtbar. Damit erscheint die Summary erst, wenn der Body
// echt rausgescrollt ist — solange der Body noch (mind. teilweise) unter dem
// Header hängt, zeigt der Body die Info selbst, Summary wäre redundant.
function updateStickyState() {
  if (!rootEl) return;
  const scrollRoot = rootEl.querySelector('.settings-body');
  if (!scrollRoot) return;
  rootEl.querySelectorAll('[data-section-toggle]').forEach((btn) => {
    const key = btn.dataset.sectionToggle;
    const body = rootEl.querySelector(`[data-section-body="${key}"]`);
    const sticky = isHeaderSticky(btn, scrollRoot);
    const bodyVisible = body && !body.hidden && isBodyVisibleBelow(body, btn);
    btn.classList.toggle('settings-section__toggle--sticky', sticky && !bodyVisible);
  });
}

function renderPrefChip(key, label) {
  const pressed = !!state.settings.preferences?.[key];
  return `
    <button class="pref-chip"
            type="button"
            data-pref="${key}"
            aria-pressed="${pressed}">
      ${label}
    </button>
  `;
}

function renderCuisineChip(key, label) {
  const pressed = !!state.settings.cuisines?.[key];
  return `
    <button class="pref-chip"
            type="button"
            data-cuisine="${key}"
            aria-pressed="${pressed}">
      ${label}
    </button>
  `;
}

// Profile-Section: Liste aller Profile mit Meta + Aktiv-Marker, plus
// "+ Profil hinzufuegen"-Button am Ende. Klick auf eine Zeile oeffnet das
// Profile-Detail-Sheet fuer diese id (via onExternalOpenProfileDetail);
// Klick auf den Add-Button startet den Onboarding-Wizard im add-Modus (via
// onExternalAddProfile). Die eigentliche Editierbarkeit lebt im Detail-Sheet;
// diese Section ist nur Uebersicht.
function renderProfileList() {
  const profiles = state.settings.profiles ?? [];
  const activeId = state.settings.activeProfileId;
  const rows = profiles.map((p) => renderProfileRow(p, p.id === activeId)).join('');
  return `
    <div class="settings-profile-list">
      ${rows}
      <button class="settings-profile-add"
              type="button"
              data-action="add-profile">
        <span class="settings-profile-add__icon" aria-hidden="true">+</span>
        <span class="settings-profile-add__label">Profil hinzufügen</span>
      </button>
    </div>
  `;
}

function renderProfileRow(profile, isActive) {
  const name = profile.name || (isActive ? 'Aktives Profil' : 'Weiteres Profil');
  const activeBadge = isActive
    ? `<span class="settings-profile-row__badge" aria-label="Aktives Profil">Aktiv</span>`
    : '';
  return `
    <button class="settings-profile-row"
            type="button"
            data-action="open-profile-detail"
            data-profile-id="${profile.id}">
      <span class="settings-profile-row__label">
        <span class="settings-profile-row__name">${escapeHtml(name)}</span>
        <span class="settings-profile-row__meta">${escapeHtml(profileMetaLine(profile))}</span>
      </span>
      ${activeBadge}
      <svg class="settings-profile-row__chevron" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/></svg>
    </button>
  `;
}

// Meta-Zeile fuer die Profil-Row: kompakte Zusammenfassung der wichtigsten
// Kennzahlen. Bei leerem Profil (frisch angelegt, noch nicht editiert):
// dezenter Hinweis-Text statt eine Reihe von "—".
function profileMetaLine(p) {
  const parts = [];
  if (p.age != null) parts.push(`${p.age} J.`);
  if (p.heightCm != null) parts.push(`${p.heightCm} cm`);
  if (p.weightKg != null) parts.push(`${p.weightKg} kg`);
  const goal = GOALS.find((g) => g.key === p.goal);
  if (goal) parts.push(goal.label);
  if (parts.length === 0) return 'Noch nicht eingerichtet';
  return parts.join(' · ');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Aktualisiert die Profil-Liste in der offenen Section, ohne das ganze Sheet
// neu zu rendern (was das Overlay-DOM ersetzen und die is-open-Klasse
// verlieren wuerde). Wird aufgerufen wenn das Detail-Sheet ein Profil
// aendert/loescht und das Settings-Sheet noch offen darunter liegt. Handler
// werden re-attached, damit die neuen Row-Buttons klickbar sind.
export function refreshProfileListInOpenSheet() {
  if (!rootEl || rootEl.hidden) return;
  const body = rootEl.querySelector('[data-section-body="profile"]');
  if (!body) return;
  body.innerHTML = renderProfileList();
  updateSectionSummary('profile');
  attachProfileListHandlers();
}

function attachHandlers() {
  const overlay = rootEl.querySelector('[data-role="backdrop"]');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) closeSettingsSheet();
  });
  rootEl.querySelector('[data-action="close"]').addEventListener('click', closeSettingsSheet);

  // Onboarding-Trigger in der Daten-Section — schließt Settings-Sheet und
  // öffnet den Wizard direkt danach (kurze Verzögerung für die Slide-out-
  // Animation, damit die Sheets nicht übereinander stapeln).
  rootEl.querySelectorAll('[data-action="open-onboarding"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeSettingsSheet();
      setTimeout(() => onExternalOpenOnboarding(), TRANSITION_MS);
    });
  });

  // Theme-Toggle — 3 exklusive Chips. Klick setzt state.settings.theme,
  // ruft onExternalThemeChange (das applyTheme + saveState triggert),
  // aktualisiert aria-pressed. Kein Sheet-Rerender nötig.
  rootEl.querySelectorAll('[data-action="theme-pick"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value;
      state.settings.theme = val;
      rootEl.querySelectorAll('[data-action="theme-pick"]').forEach((other) => {
        other.setAttribute('aria-pressed', String(other.dataset.value === val));
      });
      onExternalThemeChange();
    });
  });

  // Scroll-Listener am Body: aktualisiert die --sticky-Klasse an allen
  // Section-Toggles. Die Summary-Pille wird per CSS nur bei --sticky sichtbar,
  // sodass die Wichtigste-Info-Anzeige erst greift, wenn der Header oben
  // festgeklebt ist (Body oben rausgescrollt).
  const bodyEl = rootEl.querySelector('.settings-body');
  if (bodyEl) {
    bodyEl.addEventListener('scroll', updateStickyState, { passive: true });
  }

  // Expand-All / Collapse-All: inline mutieren (kein renderShell(), weil das
  // den Overlay-DOM ersetzen würde inkl. .is-open-Klasse → Slide-out).
  const expandAllBtn = rootEl.querySelector('[data-action="expand-all"]');
  if (expandAllBtn) {
    expandAllBtn.addEventListener('click', () => {
      collapsedSections.clear();
      rootEl.querySelectorAll('[data-section-toggle]').forEach((toggleBtn) => {
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.classList.remove('settings-section__toggle--collapsed');
      });
      rootEl.querySelectorAll('[data-section-body]').forEach((body) => {
        body.hidden = false;
      });
      syncHeaderActions();
      updateStickyState();
    });
  }
  const collapseAllBtn = rootEl.querySelector('[data-action="collapse-all"]');
  if (collapseAllBtn) {
    collapseAllBtn.addEventListener('click', () => {
      rootEl.querySelectorAll('[data-section-toggle]').forEach((toggleBtn) => {
        const key = toggleBtn.dataset.sectionToggle;
        collapsedSections.add(key);
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.classList.add('settings-section__toggle--collapsed');
      });
      rootEl.querySelectorAll('[data-section-body]').forEach((body) => {
        body.hidden = true;
      });
      // Nach dem Zuklappen: an den Sheet-Anfang scrollen, sonst könnte die
      // Sicht plötzlich weit unterhalb der Sections landen (wenn User weit
      // unten war).
      const bodyEl = rootEl.querySelector('.settings-body');
      if (bodyEl) bodyEl.scrollTop = 0;
      syncHeaderActions();
      updateStickyState();
    });
  }

  rootEl.querySelector('[data-action="portions-minus"]').addEventListener('click', () => handlePortions(-1));
  rootEl.querySelector('[data-action="portions-plus"]').addEventListener('click', () => handlePortions(1));

  const slider = rootEl.querySelector('[data-action="cooktime-change"]');
  const valueEl = rootEl.querySelector('[data-role="cooktime-value"]');
  // input: live-Update der Anzeige, kein Save (sonst Flut an refresh-Calls beim Ziehen).
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value, 10);
    state.settings.maxCookTime = v;
    valueEl.textContent = formatCookTime(v);
    updateSectionSummary('kochzeit');
  });
  // change: nach Loslassen — jetzt persistieren + externes Refresh triggern.
  // Kochzeit ändert eligible pool → Bag invalidieren, damit nächster Reroll
  // frisch mit neuer Grenze zieht.
  slider.addEventListener('change', () => {
    state.dishBag = {};
    onExternalChange();
  });

  // Ernährungs-Chips togglen ihren State + triggern refresh (Reroll-Pool ändert sich).
  // Bag invalidieren, damit die neue Präferenz sofort beim nächsten Reroll wirkt
  // (sonst würde der bereits vor-geshuffelte Bag noch alte Kandidaten liefern).
  rootEl.querySelectorAll('.pref-chip[data-pref]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.pref;
      const next = !state.settings.preferences[key];
      state.settings.preferences[key] = next;
      btn.setAttribute('aria-pressed', String(next));
      state.dishBag = {};
      updateSectionSummary('praeferenzen');
      onExternalChange();
    });
  });

  // Küchen-Chips: Hard-Filter (mit Fallback bei zu wenig Kandidaten) — bewusst
  // sichtbare Wirkung, siehe eligibleDishIds() in reroll.js. Bag invalidieren
  // aus dem gleichen Grund wie bei Diät-Chips.
  rootEl.querySelectorAll('.pref-chip[data-cuisine]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.cuisine;
      const next = !state.settings.cuisines[key];
      state.settings.cuisines[key] = next;
      btn.setAttribute('aria-pressed', String(next));
      state.dishBag = {};
      updateSectionSummary('kuechen');
      onExternalChange();
    });
  });

  attachProfileListHandlers();

  // Section-Header-Klick — identisches Muster wie Einkaufslisten-Kategorien:
  //   - Header sticky UND Body nicht mehr sichtbar unter ihm → expand + Scroll
  //     zur Body-Position (statt "aus dem Nichts eingeklappt zu werden").
  //   - Sonst → togglen, mit scrollTop-Kompensation nach dem Einklappen, damit
  //     die Sicht des Users stabil bleibt (der Content unterhalb rutscht nicht
  //     plötzlich nach oben, wenn eine oben rausgescrollte Section einklappt).
  const bodyScroll = rootEl.querySelector('.settings-body');
  rootEl.querySelectorAll('[data-section-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sectionToggle;
      const body = rootEl.querySelector(`[data-section-body="${key}"]`);
      const wasCollapsed = collapsedSections.has(key);
      const sticky = isHeaderSticky(btn, bodyScroll);
      const bodyVisible = body && !body.hidden && isBodyVisibleBelow(body, btn);

      // Sticky UND unsichtbar → expand + scroll (auch wenn schon expanded, wenn
      // wir weit weg gescrollt sind ist es UX-freundlicher zur Section zu springen).
      if (sticky && !bodyVisible) {
        collapsedSections.delete(key);
        btn.setAttribute('aria-expanded', 'true');
        btn.classList.remove('settings-section__toggle--collapsed');
        if (body) body.hidden = false;
        syncHeaderActions();
        updateStickyState();
        requestAnimationFrame(() => {
          const target = rootEl.querySelector(`[data-section-body="${key}"]`);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        return;
      }

      // Normal togglen. Wenn wir einklappen, kompensieren wir scrollTop nur um
      // den Anteil des Bodys, der bereits oben rausgescrollt ist.
      let compensation = 0;
      if (!wasCollapsed && body && bodyScroll) {
        const bodyRectSpace = measureBodySpace(body);
        const rootTop = bodyScroll.getBoundingClientRect().top;
        const bodyTop = body.getBoundingClientRect().top;
        const scrolledPast = rootTop - bodyTop;
        compensation = Math.max(0, Math.min(scrolledPast, bodyRectSpace));
      }
      const nextCollapsed = !wasCollapsed;
      if (nextCollapsed) collapsedSections.add(key);
      else collapsedSections.delete(key);
      btn.setAttribute('aria-expanded', String(!nextCollapsed));
      btn.classList.toggle('settings-section__toggle--collapsed', nextCollapsed);
      if (body) body.hidden = nextCollapsed;
      if (compensation > 0 && bodyScroll) {
        bodyScroll.scrollTop = Math.max(0, bodyScroll.scrollTop - compensation);
      }
      syncHeaderActions();
      updateStickyState();
    });
  });

  attachCloseSwipe();
}

// Handler fuer die Profil-Liste (Etappe 3): jede Row oeffnet das Detail-Sheet,
// der Add-Button startet den Wizard im add-Modus. Alle detaillierten Slider-/
// Chip-Handler leben jetzt im Detail-Sheet — die Liste ist nur Uebersicht.
function attachProfileListHandlers() {
  rootEl.querySelectorAll('[data-action="open-profile-detail"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.profileId;
      if (id) onExternalOpenProfileDetail(id);
    });
  });
  const addBtn = rootEl.querySelector('[data-action="add-profile"]');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      // Settings-Sheet vor Wizard schliessen — sonst stapeln sie sich, und der
      // Focus/Backdrop-Fluss ist verwirrend. Delay analog zum Onboarding-
      // Trigger in der Daten-Section.
      closeSettingsSheet();
      setTimeout(() => onExternalAddProfile(), TRANSITION_MS);
    });
  }
}

// Runter-Swipe auf Handle oder Header schließt das Sheet — identisches Muster
// wie im Detail-Sheet. Panel-scrollbarer Body (.settings-body) ist ausgenommen
// (dort will der User scrollen, nicht schließen), ebenso interaktive Elemente
// (Buttons, Stepper, Slider, Link) damit Klicks nicht als Swipe missinterpretiert.
// setPointerCapture bindet Follow-Events ans Sheet — auch bei Drag über den Rand
// landet pointerup garantiert an, und der Browser generiert kein pointercancel.
function attachCloseSwipe() {
  const sheet = rootEl.querySelector('.settings-sheet');
  if (!sheet) return;
  const s = { startX: 0, startY: 0, tracking: false };

  sheet.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (ev.target.closest('button, input, .stepper, .settings-link')) return;
    if (ev.target.closest('.settings-body')) return;
    s.startX = ev.clientX;
    s.startY = ev.clientY;
    s.tracking = true;
    try { sheet.setPointerCapture(ev.pointerId); } catch (_) {}
  });

  sheet.addEventListener('pointerup', (ev) => {
    if (!s.tracking) return;
    s.tracking = false;
    try { sheet.releasePointerCapture(ev.pointerId); } catch (_) {}
    const dx = ev.clientX - s.startX;
    const dy = ev.clientY - s.startY;
    if (dy <= SWIPE_THRESHOLD_PX) return;
    if (dy <= Math.abs(dx) * SWIPE_DIRECTIONAL_RATIO) return;
    closeSettingsSheet();
  });

  sheet.addEventListener('pointercancel', () => { s.tracking = false; });
}

// Zeigt genau EINEN der zwei Header-Buttons an, je nach Zustand:
//   - mind. eine Section eingeklappt → Expand (die Aktion mit dem größten Nutzen)
//   - alle expanded → Collapse
// Nie beide gleichzeitig — konsistent mit der Progress-Zeile in der Einkaufsliste.
function syncHeaderActions() {
  if (!rootEl) return;
  const collapsed = collapsedSections.size;
  const showExpand = collapsed > 0;
  const expandBtn = rootEl.querySelector('[data-action="expand-all"]');
  const collapseBtn = rootEl.querySelector('[data-action="collapse-all"]');
  if (expandBtn) expandBtn.hidden = !showExpand;
  if (collapseBtn) collapseBtn.hidden = showExpand;
}

// Ist der Header aktuell im Sticky-Modus (an seiner berechneten sticky-top-
// Position festgeklebt)? Vergleicht die relative Position mit stackIdx *
// headerHeight (Body scrollt selbst, es gibt keine sticky-Progress-Bar wie in
// der Shopping-View).
function isHeaderSticky(btn, scrollRoot) {
  if (!scrollRoot) return false;
  const stackIdx = parseInt(btn.dataset.stackIdx, 10) || 0;
  const styles = getComputedStyle(scrollRoot);
  const headerH = parseFloat(styles.getPropertyValue('--settings-section-header-height')) || 44;
  const stickyTop = stackIdx * headerH;
  const relTop = btn.getBoundingClientRect().top - scrollRoot.getBoundingClientRect().top;
  return relTop <= stickyTop + 2;
}

// Ist der Body noch (mindestens teilweise) unter seinem sticky Header sichtbar?
// Wenn hidden oder height 0 → false (dann ist der Body ohnehin nicht sichtbar).
function isBodyVisibleBelow(body, btn) {
  const bodyRect = body.getBoundingClientRect();
  if (bodyRect.height === 0) return false;
  const btnRect = btn.getBoundingClientRect();
  return bodyRect.bottom > btnRect.bottom + 2;
}

// Vertikaler Platz des Bodys im Layout (Höhe + margin-bottom). Genutzt für die
// scrollTop-Kompensation beim Einklappen.
function measureBodySpace(body) {
  const h = body.getBoundingClientRect().height;
  const mb = parseFloat(getComputedStyle(body).marginBottom) || 0;
  return h + mb;
}

function handlePortions(delta) {
  changeDefaultPortions(delta);
  const { defaultPortions } = state.settings;
  const valueEl = rootEl.querySelector('[data-role="portions-value"]');
  const minusBtn = rootEl.querySelector('[data-action="portions-minus"]');
  const plusBtn = rootEl.querySelector('[data-action="portions-plus"]');
  if (valueEl) valueEl.textContent = defaultPortions;
  if (minusBtn) minusBtn.disabled = defaultPortions <= PORTIONS_MIN;
  if (plusBtn) plusBtn.disabled = defaultPortions >= PORTIONS_MAX;
  updateSectionSummary('portionen');
  onExternalChange();
}
