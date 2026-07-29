import {
  state,
  moveProfileToIndex,
  PORTIONS_MIN,
  PORTIONS_MAX,
  COOKTIME_MIN,
  COOKTIME_MAX,
  COOKTIME_STEP,
} from '../state.js';
import { changeDefaultPortions } from '../dashboard/portions.js';
import { dinnerTarget, kcalRangeRounded } from '../nutrition/target.js';
import { rerollAll } from '../dashboard/reroll.js';
import { showToast } from '../util/toast.js';
import { renderRezepteSectionBody, buildRezepteSummary, wireRezepteSection } from './rezepte-section.js';
import { openUpdateSheet } from './update-sheet.js';

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
// aber Sheet-Close/Reopen weil das Modul lebt). Beim ersten Oeffnen ist nur
// "profile" auf — die taeglich relevante Section. Darstellung, Daten,
// Rezepte und Ueber sind default zu und muessen bewusst ausgeklappt werden.
const collapsedSections = new Set(['darstellung', 'daten', 'rezepte', 'ueber']);
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
            <div class="settings-row">
              <div class="settings-row__label">
                <div class="settings-row__label-primary">Bedarfs-Pille im Dashboard</div>
                <div class="settings-row__label-secondary">Wochen-Übersicht + Zugang zu Nährstoff-Details</div>
              </div>
              <button class="m3-switch" type="button" role="switch"
                      data-action="toggle-dashboard-caloriebar"
                      aria-checked="${state.settings.showDashboardCalorieBar !== false}"
                      aria-label="Bedarfs-Pille im Dashboard anzeigen">
                <span class="m3-switch__thumb" aria-hidden="true"></span>
              </button>
            </div>
            <div class="settings-row">
              <div class="settings-row__label">
                <div class="settings-row__label-primary">Makros im Dashboard</div>
                <div class="settings-row__label-secondary">kcal- und P/KH/F-Pillen unter jedem Gericht</div>
              </div>
              <button class="m3-switch" type="button" role="switch"
                      data-action="toggle-dashboard-makros"
                      aria-checked="${state.settings.showDashboardMakros !== false}"
                      aria-label="Makros im Dashboard anzeigen">
                <span class="m3-switch__thumb" aria-hidden="true"></span>
              </button>
            </div>
          `)}

          ${section('daten', 'Daten', `
            <div class="settings-row">
              <div class="settings-row__label">
                <div class="settings-row__label-primary">Einrichtung</div>
                <div class="settings-row__label-secondary">Profil-Werte über den Wizard neu setzen</div>
              </div>
              <button class="settings-action-btn" type="button" data-action="open-onboarding">Starten</button>
            </div>
          `)}

          ${section('rezepte', 'Rezepte', renderRezepteSectionBody())}

          ${section('ueber', 'Über', `
            <a class="settings-link settings-link--compact"
               href="https://github.com/shogun160/mahlzeit-app"
               target="_blank"
               rel="noopener noreferrer">
              <svg class="settings-link__icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              <span class="settings-link__label">GitHub</span>
              <svg class="settings-link__external" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z"/></svg>
            </a>
          `)}
        </div>
      </div>
      <dialog class="settings-info-dialog" data-role="portions-info-dialog" aria-labelledby="portions-info-title">
        <h3 class="settings-info-dialog__title" id="portions-info-title">Kochmengen bei mehreren Personen</h3>
        <div class="settings-info-dialog__body">
          <p>Jedes Profil hat ein eigenes Abendessen-Ziel (aus Alter, Gewicht, Aktivität und Ziel berechnet). Beim Kochen für <strong>N Personen</strong> summiert die App die Bedarfe der beteiligten Profile:</p>
          <ul>
            <li><strong>1 Person</strong> → nur das aktive Profil zählt. Rezept wird auf dessen Ziel skaliert.</li>
            <li><strong>2+ Personen</strong> → die ersten N Profile aus deiner Liste kochen mit. Für jedes wird ein individueller Anteil berechnet und aufsummiert.</li>
            <li><strong>N &gt; Anzahl Profile</strong> → für jede fehlende Person wird das <strong>Standard-Profil</strong> aus deinen Einstellungen benutzt.</li>
          </ul>
          <p>Die <strong>Bedarfs-Anzeige</strong> im Dashboard folgt immer nur dem aktiven Profil (dem ersten in der Liste) — sie zeigt, was <em>du persönlich</em> von dem Gericht bekommst.</p>
        </div>
        <div class="settings-info-dialog__actions">
          <button class="settings-info-dialog__ok" type="button" data-action="close-portions-info">Verstanden</button>
        </div>
      </dialog>
    </div>
  `;

  attachHandlers();
  // Initial-Sync jetzt, wo die Sections im DOM sind. Sonst wären die Header-
  // Buttons falsch versteckt beim Sheet-Reopen mit persistierten collapsedSections.
  syncHeaderActions();
  // updateStickyState braucht ein stabiles Layout — direkt nach innerHTML sind
  // die getBoundingClientRect-Werte noch nicht final (Slide-in-Animation, Font
  // Load). Doppelte rAF verschiebt die Messung auf den ersten stabilen Frame,
  // damit --sticky nicht faelschlich auf expanded Sections gesetzt wird.
  requestAnimationFrame(() => requestAnimationFrame(updateStickyState));
}

function formatCookTime(min) {
  return min >= COOKTIME_MAX ? 'unbegrenzt' : `${min} Min`;
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
  if (key === 'kochzeit')  return formatCookTime(s.maxCookTime);
  if (key === 'darstellung') {
    const t = s.theme || 'auto';
    if (t === 'light') return 'Hell';
    if (t === 'dark')  return 'Dunkel';
    return 'System';
  }
  if (key === 'profile') {
    // Summary zeigt den Namen des aktiven Profils (profiles[0]) — sichtbar
    // im Sticky-Header + bei eingeklappter Section. Bei mehreren Profilen
    // die Gesamt-Zahl dahinter. Fallback wenn Name nicht gesetzt: "Aktives
    // Profil".
    const profiles = state.settings.profiles ?? [];
    const count = profiles.length;
    const activeName = profiles[0]?.name || 'Aktives Profil';
    let label = activeName;
    if (count > 1) label += ` · ${count} Profile`;
    return label;
  }
  if (key === 'rezepte') return buildRezepteSummary();
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
  const defaultPortions = state.settings.defaultPortions;
  const minusDisabled = defaultPortions <= PORTIONS_MIN;
  const plusDisabled = defaultPortions >= PORTIONS_MAX;
  // Hinweis-Text: informiert wenn portions > profiles.length ist, damit klar
  // ist dass die fehlenden Personen ueber das Standard-Profil gerechnet werden.
  const hint = 'Für wieviele kochst du normalerweise?';
  // Standard-Profil-Row: separater Marker, nicht loeschbar. Editierbar ueber
  // dasselbe Detail-Sheet (id '_default' erkennt der Sheet). Optisch abgesetzt
  // via .settings-profile-row--default (dashed border in primary).
  const std = state.settings.standardProfile;
  const stdRowHtml = std ? renderStandardProfileRow(std) : '';
  return `
    <div class="settings-profile-list">
      ${rows}
      ${stdRowHtml}
      <button class="settings-profile-add"
              type="button"
              data-action="add-profile">
        <span class="settings-profile-add__icon" aria-hidden="true">+</span>
        <span class="settings-profile-add__label">Profil hinzufügen</span>
      </button>
      <div class="settings-row settings-profile-portions">
        <div class="settings-row__label">
          <div class="settings-row__label-primary">Personen</div>
          <div class="settings-row__label-secondary" data-role="portions-hint">${hint}</div>
        </div>
        <div class="stepper stepper--compact" role="group" aria-label="Personen">
          <button class="stepper__btn" data-action="portions-minus" aria-label="Weniger" ${minusDisabled ? 'disabled' : ''}>−</button>
          <span class="stepper__value" data-role="portions-value">${defaultPortions}</span>
          <button class="stepper__btn" data-action="portions-plus" aria-label="Mehr" ${plusDisabled ? 'disabled' : ''}>+</button>
        </div>
      </div>
      <button class="settings-profile-info"
              type="button"
              data-action="show-portions-info"
              aria-label="Wie werden Kochmengen berechnet?">
        <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>
        <span>Wie werden Kochmengen berechnet?</span>
      </button>
    </div>
  `;
}

function renderStandardProfileRow(profile) {
  // Standard-Profil zeigt statt Alter/Groesse/Gewicht/Ziel nur den Abendessen-
  // kcal-Bereich — ein Standard-Diner ist definiert durch seinen Bedarf, nicht
  // durch demografische Daten. Berechnung identisch zum Rest der App
  // (dinnerTarget + kcalRange). Layout matcht die normalen User-Rows inkl.
  // Drag-Handle-Slot (visuell da, ohne Funktion — Standard-Profil laesst sich
  // nicht umsortieren, sitzt immer als Fallback am Ende).
  const kcalLabel = profileKcalLine(profile) ?? 'Noch nicht eingerichtet';
  return `
    <div class="settings-profile-row settings-profile-row--default"
         role="button"
         tabindex="0"
         data-action="open-profile-detail"
         data-profile-id="${profile.id}">
      <button class="settings-profile-row__drag"
              type="button"
              disabled
              aria-hidden="true"
              tabindex="-1">
        <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"/></svg>
      </button>
      <span class="settings-profile-row__label">
        <span class="settings-profile-row__name">Standard-Profil</span>
        <span class="settings-profile-row__meta">${escapeHtml(kcalLabel)}</span>
      </span>
      <svg class="settings-profile-row__chevron" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/></svg>
    </div>
  `;
}

function renderProfileRow(profile, isActive) {
  const name = profile.name || (isActive ? 'Aktives Profil' : 'Weiteres Profil');
  const activeBadge = isActive
    ? `<span class="settings-profile-row__badge" aria-label="Aktives Profil">Aktiv</span>`
    : '';
  // Row als DIV (nicht button), damit der Drag-Handle-Button innen HTML-valid
  // ist. Klick auf DIV oeffnet Detail (Handler mit role=button + tabindex).
  return `
    <div class="settings-profile-row"
         role="button"
         tabindex="0"
         data-action="open-profile-detail"
         data-profile-id="${profile.id}">
      <button class="settings-profile-row__drag"
              type="button"
              data-action="drag-handle"
              data-profile-id="${profile.id}"
              aria-label="Reihenfolge ändern"
              title="Ziehen zum Umsortieren">
        <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"/></svg>
      </button>
      <span class="settings-profile-row__label">
        <span class="settings-profile-row__name">${escapeHtml(name)}</span>
        <span class="settings-profile-row__meta">${escapeHtml(profileKcalLine(profile) ?? 'Noch nicht eingerichtet')}</span>
      </span>
      ${activeBadge}
      <svg class="settings-profile-row__chevron" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/></svg>
    </div>
  `;
}

// Meta-Zeile fuer die Profil-Row: kompakte Zusammenfassung der wichtigsten
// Kennzahlen. Bei leerem Profil (frisch angelegt, noch nicht editiert):
// dezenter Hinweis-Text statt eine Reihe von "—".
// Abendessen-kcal-Bereich fuer die Profil-Row. Gleiche Berechnung wie bei
// der Standard-Profil-Row + Bedarfs-Pillen im Dashboard.
function profileKcalLine(profile) {
  const dinner = dinnerTarget(profile);
  const range = dinner != null ? kcalRangeRounded(dinner) : null;
  if (!range) return null;
  return `${range[0]}–${range[1]} kcal`;
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
      updateSectionSummary('darstellung');
      onExternalThemeChange();
    });
  });

  // Dashboard-Makros-Switch: schaltet die kcal+P/KH/F-Pillen unter jedem
  // Gericht ein/aus. onExternalChange feuert refresh(), sodass die Cards
  // sofort ohne Sheet-Schliessen aktualisiert werden.
  const makrosBtn = rootEl.querySelector('[data-action="toggle-dashboard-makros"]');
  if (makrosBtn) {
    makrosBtn.addEventListener('click', () => {
      const next = state.settings.showDashboardMakros === false;
      state.settings.showDashboardMakros = next;
      makrosBtn.setAttribute('aria-checked', String(next));
      onExternalChange();
    });
  }

  // Bedarfs-Pille-Switch: schaltet die Wochen-Bedarfs-Pille oben im Dashboard
  // (Trigger fuer Nährstoff-Detail-Popup) ein/aus. Global — unabhaengig vom
  // per-Profil showCalorieBar; beide muessen aktiv sein damit die Pille zeigt.
  const barBtn = rootEl.querySelector('[data-action="toggle-dashboard-caloriebar"]');
  if (barBtn) {
    barBtn.addEventListener('click', () => {
      const next = state.settings.showDashboardCalorieBar === false;
      state.settings.showDashboardCalorieBar = next;
      barBtn.setAttribute('aria-checked', String(next));
      onExternalChange();
    });
  }

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

  // Portions-Stepper-Handler leben in attachProfileListHandlers, weil der
  // Stepper jetzt in der Profile-Section sitzt und mit ihr neu-gebunden werden
  // muss (Detail-Sheet-Refresh re-rendert die Section).

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
    rerollAll();
    onExternalChange();
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

  wireRezepteSection(rootEl, {
    onOpenUpdateSheet: () => openUpdateSheet(),
    onToast: (msg) => showToast(msg),
  });

  attachCloseSwipe();
}

// Handler fuer die Profil-Liste (Etappe 3): jede Row oeffnet das Detail-Sheet,
// der Add-Button startet den Wizard im add-Modus. Alle detaillierten Slider-/
// Chip-Handler leben jetzt im Detail-Sheet — die Liste ist nur Uebersicht.
function attachProfileListHandlers() {
  rootEl.querySelectorAll('[data-action="open-profile-detail"]').forEach((row) => {
    row.addEventListener('click', (ev) => {
      // Klick auf Drag-Handle darf NICHT das Detail oeffnen.
      if (ev.target.closest('[data-action="drag-handle"]')) return;
      const id = row.dataset.profileId;
      if (id) onExternalOpenProfileDetail(id);
    });
    // Keyboard-Support (weil Row ein DIV mit role=button ist).
    row.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      const id = row.dataset.profileId;
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
  // Portions-Stepper: muss hier gebunden werden, weil die Section per
  // refreshProfileListInOpenSheet neu gerendert werden kann (z. B. nach
  // Aktiv-Wechsel im Detail-Sheet). Alte Handler waeren dann verloren.
  const minusBtn = rootEl.querySelector('[data-action="portions-minus"]');
  const plusBtn = rootEl.querySelector('[data-action="portions-plus"]');
  if (minusBtn) minusBtn.addEventListener('click', () => handlePortions(-1));
  if (plusBtn) plusBtn.addEventListener('click', () => handlePortions(1));

  // Info-Dialog: Klick auf "Wie werden Kochmengen berechnet?" oeffnet ein
  // Modal-Dialog mit Erklaerung. Native <dialog>-API — showModal() macht den
  // Rest inkl. Backdrop + Focus-Trap. close per Button oder ESC.
  const infoBtn = rootEl.querySelector('[data-action="show-portions-info"]');
  const infoDialog = rootEl.querySelector('[data-role="portions-info-dialog"]');
  if (infoBtn && infoDialog) {
    infoBtn.addEventListener('click', () => {
      if (typeof infoDialog.showModal === 'function') infoDialog.showModal();
      else infoDialog.setAttribute('open', ''); // Fallback
    });
    infoDialog.addEventListener('click', (ev) => {
      if (ev.target === infoDialog) infoDialog.close();
    });
    const closeBtn = infoDialog.querySelector('[data-action="close-portions-info"]');
    if (closeBtn) closeBtn.addEventListener('click', () => infoDialog.close());
  }

  attachProfileDragHandlers();
}

// Drag&Drop-Reordering per pointer-events (funktioniert Maus + Touch), nach
// Material-3-Guidelines fuer "Reorder-Handle":
// - Long-Press (500ms) auf dem Drag-Handle startet den Drag — vor Ablauf
//   kann der User frei scrollen oder loslassen ohne dass etwas passiert.
// - Bei Bewegung vor Timer-Ablauf wird der Timer abgebrochen (User scrollt).
// - Haptic feedback (Vibration) beim Drag-Start wenn verfuegbar.
// - Waehrend Drag: Row wird visuell "gehoben" (elevation shadow), am Ziel-
//   Slot erscheint eine dezente Highlight-Kante.
// - pointerup commited via moveProfileToIndex.
const DRAG_HOLD_MS = 500;
const DRAG_CANCEL_PX = 8;
function attachProfileDragHandlers() {
  const listEl = rootEl.querySelector('.settings-profile-list');
  if (!listEl) return;
  const handles = rootEl.querySelectorAll('[data-action="drag-handle"]');
  let drag = null; // { id, startX, startY, sourceRow, active, holdTimer }

  const clearIndicators = () => {
    listEl.querySelectorAll('.settings-profile-row').forEach((r) => {
      r.classList.remove('is-drop-above', 'is-drop-below', 'is-dragging');
    });
  };

  const findTargetRow = (clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY);
    return el?.closest?.('.settings-profile-row');
  };

  const cancelHold = () => {
    if (drag?.holdTimer) {
      clearTimeout(drag.holdTimer);
      drag.holdTimer = null;
    }
  };

  handles.forEach((handle) => {
    handle.addEventListener('pointerdown', (ev) => {
      if (ev.button != null && ev.button !== 0) return;
      const row = handle.closest('.settings-profile-row');
      const id = handle.dataset.profileId;
      if (!row || !id) return;
      // Kein preventDefault hier — User soll waehrend der 500ms Long-Press-
      // Wartezeit noch scrollen koennen. Erst wenn drag aktiv wird,
      // verhindern wir die Standard-Interaktion.
      drag = { id, startX: ev.clientX, startY: ev.clientY, sourceRow: row, active: false, holdTimer: null };
      drag.holdTimer = setTimeout(() => {
        if (!drag) return;
        drag.active = true;
        drag.holdTimer = null;
        drag.sourceRow.classList.add('is-dragging');
        try { handle.setPointerCapture(ev.pointerId); } catch (_) {}
        // Haptic feedback (nur Android/Chromium unterstuetzt navigator.vibrate).
        try { navigator.vibrate?.(10); } catch (_) {}
      }, DRAG_HOLD_MS);
    });

    handle.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      const dist = Math.hypot(dx, dy);
      if (!drag.active) {
        // Vor Long-Press-Ablauf: nur wenn User deutlich bewegt, brechen wir
        // den Hold ab (User will scrollen, kein Drag).
        if (dist > DRAG_CANCEL_PX) {
          cancelHold();
          drag = null;
        }
        return;
      }
      // Drag ist aktiv — Bewegung verfolgen + Ziel-Slot markieren.
      ev.preventDefault();
      clearIndicators();
      drag.sourceRow.classList.add('is-dragging');
      const target = findTargetRow(ev.clientX, ev.clientY);
      if (!target || target === drag.sourceRow) return;
      const rect = target.getBoundingClientRect();
      const isAbove = ev.clientY < rect.top + rect.height / 2;
      target.classList.add(isAbove ? 'is-drop-above' : 'is-drop-below');
    });

    const finish = (ev) => {
      if (!drag) return;
      const wasActive = drag.active;
      const sourceId = drag.id;
      cancelHold();
      if (!wasActive) {
        drag = null;
        return;
      }
      try { handle.releasePointerCapture(ev.pointerId); } catch (_) {}
      const target = findTargetRow(ev.clientX, ev.clientY);
      clearIndicators();
      drag = null;
      if (!target || target.dataset.profileId === sourceId) return;
      const profiles = state.settings.profiles;
      const targetIdx = profiles.findIndex((p) => p.id === target.dataset.profileId);
      const rect = target.getBoundingClientRect();
      const isAbove = ev.clientY < rect.top + rect.height / 2;
      const newIdx = isAbove ? targetIdx : targetIdx + 1;
      // Wenn source vor target lag, verschiebt der splice-remove den target-
      // index um 1 nach vorne — Kompensation:
      const sourceIdx = profiles.findIndex((p) => p.id === sourceId);
      let finalIdx = newIdx;
      if (sourceIdx < newIdx) finalIdx = newIdx - 1;
      moveProfileToIndex(sourceId, finalIdx);
      onExternalChange();
      refreshProfileListInOpenSheet();
    };

    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', (ev) => {
      if (!drag) return;
      cancelHold();
      try { handle.releasePointerCapture(ev.pointerId); } catch (_) {}
      clearIndicators();
      drag = null;
    });
    // Beim Verlassen der Handle-Region (z. B. Scroll auslösend) den Timer
    // ebenfalls abbrechen — sonst startet Drag auch wenn der Finger schon weg ist.
    handle.addEventListener('pointerleave', () => {
      if (drag && !drag.active) {
        cancelHold();
        drag = null;
      }
    });
  });
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
  const hintEl = rootEl.querySelector('[data-role="portions-hint"]');
  if (valueEl) valueEl.textContent = defaultPortions;
  if (minusBtn) minusBtn.disabled = defaultPortions <= PORTIONS_MIN;
  if (plusBtn) plusBtn.disabled = defaultPortions >= PORTIONS_MAX;
  if (hintEl) hintEl.textContent = 'Für wieviele kochst du normalerweise?';
  updateSectionSummary('profile');
  onExternalChange();
}
