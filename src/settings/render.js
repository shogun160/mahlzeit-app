import {
  state,
  PORTIONS_MIN,
  PORTIONS_MAX,
  COOKTIME_MIN,
  COOKTIME_MAX,
  COOKTIME_STEP,
} from '../state.js';
import { changeDefaultPortions } from '../dashboard/portions.js';
import {
  ACTIVITY_LEVELS,
  GOALS,
  AGE_MIN,
  AGE_MAX,
  HEIGHT_MIN,
  HEIGHT_MAX,
  WEIGHT_MIN,
  WEIGHT_MAX,
  AGE_DEFAULT,
  HEIGHT_DEFAULT,
  WEIGHT_DEFAULT,
  DAILY_TARGET_MIN,
  DAILY_TARGET_MAX,
  DAILY_TARGET_STEP,
  MEAL_KCAL_STEP,
  BREAKFAST_MAX,
  LUNCH_MAX,
  dailyTarget,
  effectiveDailyTarget,
  dinnerTarget,
  kcalRange,
} from '../nutrition/target.js';

const TRANSITION_MS = 250;
const SWIPE_THRESHOLD_PX = 55;
const SWIPE_DIRECTIONAL_RATIO = 1.4; // |dy| muss 1.4x größer als |dx| sein

// Material Symbol refresh — Reset-Icon für Override-Zurücksetzen (Tagesziel-
// Slider, Makro-Slider). Platzierung analog zum X-Icon im Dish-Picker: links
// vom Wert-Label, klein (20 px), nur sichtbar wenn Override aktiv ist.
const ICON_REFRESH = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;

let rootEl = null;
let onExternalChange = () => {};
let onExternalOpenMacro = () => {};
let onExternalOpenOnboarding = () => {};
// Zugeklappte Sections (transient — verliert sich beim App-Restart, überlebt
// aber Sheet-Close/Reopen weil das Modul lebt).
const collapsedSections = new Set();
// Zähler für sticky-Stack-Position der Section-Header. Wird bei jedem
// renderShell() zurückgesetzt und pro section()-Aufruf inkrementiert.
// Analog zu stackIdx in shopping-list/render.js — jeder Header klebt gestaffelt
// unter den vorigen (stack-idx * header-height als top-Offset).
let sectionStackIdx = 0;

// --- Mount / Lifecycle ---

export function mountSettingsSheet(el, { onChange, onOpenMacro, onOpenOnboarding } = {}) {
  rootEl = el;
  onExternalChange = onChange || (() => {});
  onExternalOpenMacro = onOpenMacro || (() => {});
  onExternalOpenOnboarding = onOpenOnboarding || (() => {});
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
                    aria-label="Alle Sections aufklappen"
                    title="Alle aufklappen"
                    hidden>
              <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-120 300-300l56-56 124 124 124-124 56 56-180 180Zm-124-504-56-56 180-180 180 180-56 56-124-124-124 124Z"/></svg>
            </button>
            <button class="settings-header__action"
                    data-action="collapse-all"
                    aria-label="Alle Sections zuklappen"
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

          ${section('profil', 'Profil &amp; Kalorien', renderProfileSection())}

          ${section('darstellung', 'Darstellung', `
            <p class="settings-section__note">Kommt bald — Dark Mode, Akzentfarbe</p>
          `, 'settings-section-body--soon')}

          ${section('daten', 'Daten', `
            <div class="settings-row">
              <div class="settings-row__label">
                <div class="settings-row__label-primary">Einrichtung</div>
                <div class="settings-row__label-secondary">Profil-Werte über den Wizard neu setzen</div>
              </div>
              <button class="settings-action-btn" type="button" data-action="open-onboarding">Starten</button>
            </div>
            <p class="settings-section__note settings-section__note--soft">Kommt bald — Backup exportieren/importieren, Alle Daten zurücksetzen</p>
          `)}

          ${section('ueber', 'Über', `
            <div class="settings-row">
              <div class="settings-row__label">
                <div class="settings-row__label-primary">Mahlzeit — Meal-Planner</div>
              </div>
            </div>
            <a class="settings-link"
               href="https://github.com/shogun160/mahlzeit-app"
               target="_blank"
               rel="noopener noreferrer">
              <span>Quellcode auf GitHub</span>
              <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
                <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z"/>
              </svg>
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
  if (key === 'profil') {
    // Abendessen-Zielkorridor als kompakte Zusammenfassung (nicht Tagesziel),
    // weil das der Wert ist gegen den die Wochen-Bar rechnet. Ohne vollständiges
    // Profil oder mit ungültigem Rest: leere Summary.
    const target = dinnerTarget(s.profile);
    if (target == null || target <= 0) return '';
    const r = kcalRange(target);
    return `${r[0].toLocaleString('de-DE')}–${r[1].toLocaleString('de-DE')} kcal`;
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

// Profil-Section: Gender-Chips, Alter-Stepper, Größe/Gewicht/Aktivität-Slider,
// Ziel-Chips. Werte kommen aus state.settings.profile; leere Felder (null)
// zeigen "—" statt einer Zahl. Nach jeder Änderung updateSectionSummary('profil')
// + onExternalChange() (letzteres nur bei change, nicht bei input während Ziehen).
function renderProfileSection() {
  const p = state.settings.profile;
  const ageStr = p.age == null ? '—' : String(p.age);
  const ageMinusDis = p.age == null || p.age <= AGE_MIN;
  const agePlusDis = p.age != null && p.age >= AGE_MAX;
  const heightVal = p.heightCm ?? HEIGHT_DEFAULT;
  const weightVal = p.weightKg ?? WEIGHT_DEFAULT;
  const activity = ACTIVITY_LEVELS.find((a) => a.level === p.activityLevel) ?? ACTIVITY_LEVELS[2];

  return `
    <div class="settings-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Geschlecht</div>
      </div>
      <div class="settings-prefs" role="group" aria-label="Geschlecht">
        ${renderGenderChip('female', 'Weiblich')}
        ${renderGenderChip('male',   'Männlich')}
      </div>
    </div>

    <div class="settings-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Alter</div>
      </div>
      <div class="stepper stepper--compact" role="group" aria-label="Alter in Jahren">
        <button class="stepper__btn" data-action="age-minus" aria-label="Weniger" ${ageMinusDis ? 'disabled' : ''}>−</button>
        <span class="stepper__value" data-role="age-value">${ageStr}</span>
        <button class="stepper__btn" data-action="age-plus" aria-label="Mehr" ${agePlusDis ? 'disabled' : ''}>+</button>
      </div>
    </div>

    <div class="settings-field">
      <div class="settings-row">
        <div class="settings-row__label">
          <div class="settings-row__label-primary">Größe</div>
        </div>
        <div class="settings-row__value" data-role="height-value">${p.heightCm == null ? '—' : `${p.heightCm} cm`}</div>
      </div>
      <input type="range"
             class="settings-slider"
             data-action="height-change"
             min="${HEIGHT_MIN}"
             max="${HEIGHT_MAX}"
             step="1"
             value="${heightVal}"
             aria-label="Größe in Zentimetern" />
    </div>

    <div class="settings-field">
      <div class="settings-row">
        <div class="settings-row__label">
          <div class="settings-row__label-primary">Gewicht</div>
        </div>
        <div class="settings-row__value" data-role="weight-value">${p.weightKg == null ? '—' : `${p.weightKg} kg`}</div>
      </div>
      <input type="range"
             class="settings-slider"
             data-action="weight-change"
             min="${WEIGHT_MIN}"
             max="${WEIGHT_MAX}"
             step="1"
             value="${weightVal}"
             aria-label="Gewicht in Kilogramm" />
    </div>

    <div class="settings-field">
      <div class="settings-row">
        <div class="settings-row__label">
          <div class="settings-row__label-primary">Aktivitätslevel</div>
        </div>
        <div class="settings-row__value" data-role="activity-value">${activity.label}</div>
      </div>
      <input type="range"
             class="settings-slider"
             data-action="activity-change"
             min="1"
             max="5"
             step="1"
             value="${activity.level}"
             aria-label="Aktivitätslevel" />
    </div>

    <div class="settings-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Ziel</div>
      </div>
      <div class="settings-prefs settings-prefs--inline" role="group" aria-label="Ziel">
        ${GOALS.map((g) => renderGoalChip(g.key, g.label)).join('')}
      </div>
    </div>

    ${renderDailyTargetRow()}
    ${renderMealRow('breakfast', 'Frühstück', p.breakfastKcal, BREAKFAST_MAX)}
    ${renderMealRow('lunch', 'Mittagessen', p.lunchKcal, LUNCH_MAX)}
    ${renderDinnerTargetRow()}
    ${renderShowBarRow(p.showCalorieBar !== false)}
  `;
}

// Material-3-Switch für die Sichtbarkeit der Bedarfs-Pille im Dashboard.
// Nutzt role="switch" + aria-checked (statt Chip mit aria-pressed) — semantisch
// korrekter Widget-Typ für an/aus-Umschaltungen und die Standard-Optik der
// Android-Einstellungen.
function renderShowBarRow(pressed) {
  return `
    <div class="settings-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Bedarfs-Anzeige im Dashboard</div>
        <div class="settings-row__label-secondary">Zielkorridor + Ø der ausgewählten Gerichte</div>
      </div>
      <button class="m3-switch" type="button" role="switch" data-action="toggle-calorie-bar"
              aria-checked="${pressed}"
              aria-label="Bedarfs-Anzeige">
        <span class="m3-switch__thumb" aria-hidden="true"></span>
      </button>
    </div>
  `;
}

// Tagesziel-Slider: startet beim berechneten Vorschlag aus Profil. Wenn User
// den Slider zieht, wird der Wert als Override gespeichert — Profil-Änderungen
// überschreiben den Wert dann nicht mehr. Sichtbar-Label zeigt "Vorschlag: X"
// wenn kein Override, "Manuell" wenn Override — damit klar ist, was greift.
function renderDailyTargetRow() {
  const p = state.settings.profile;
  const effective = effectiveDailyTarget(p);
  const suggestion = dailyTarget(p);
  const val = effective ?? suggestion ?? Math.round((DAILY_TARGET_MIN + DAILY_TARGET_MAX) / 2);
  const overridden = p.dailyTargetOverride != null;
  const hint = overridden
    ? 'Manuell überschrieben'
    : (suggestion != null ? `Vorschlag: ${format(suggestion)} kcal` : 'Profil unvollständig');
  // Refresh-Button setzt den Override zurück auf null → Auto-Vorschlag aus
  // Profil greift wieder. Analog zum X im Dish-Picker: nur sichtbar wenn was
  // zurückzusetzen ist. hidden statt Remove damit der Handler stehen bleibt.
  return `
    <div class="settings-field">
      <div class="settings-row">
        <div class="settings-row__label settings-row__label--inline">
          <span class="settings-row__label-primary">Tagesziel</span>
          <span class="settings-row__label-secondary" data-role="daily-hint">${hint}</span>
        </div>
        <button class="settings-refresh"
                type="button"
                data-action="daily-reset"
                data-role="daily-reset"
                ${overridden ? '' : 'hidden'}
                aria-label="Tagesziel-Vorschlag wiederherstellen"
                title="Vorschlag wiederherstellen">
          ${ICON_REFRESH}
        </button>
        <div class="settings-row__value" data-role="daily-value">${formatRange(val)}</div>
      </div>
      <input type="range"
             class="settings-slider"
             data-action="daily-change"
             min="${DAILY_TARGET_MIN}"
             max="${DAILY_TARGET_MAX}"
             step="${DAILY_TARGET_STEP}"
             value="${val}"
             aria-label="Tagesziel in Kilokalorien" />
    </div>
  `;
}

function renderMealRow(key, label, value, max) {
  // Nach Task 1 (Session 13) kann breakfastKcal/lunchKcal null sein, wenn der
  // User im Wizard "Später" geklickt hat ohne diese Felder anzufassen. Anzeige
  // dann "—"; der Slider bekommt einen Range-Mitte-Fallback als visuelle
  // Startposition, ohne den State zu berühren.
  const isEmpty = value == null;
  const displayValue = isEmpty ? '—' : `${format(value)} kcal`;
  const sliderVal = value ?? Math.round(max / 2);
  return `
    <div class="settings-field">
      <div class="settings-row">
        <div class="settings-row__label">
          <div class="settings-row__label-primary">${label}</div>
        </div>
        <div class="settings-row__value" data-role="${key}-value">${displayValue}</div>
      </div>
      <input type="range"
             class="settings-slider"
             data-action="${key}-change"
             min="0"
             max="${max}"
             step="${MEAL_KCAL_STEP}"
             value="${sliderVal}"
             aria-label="${label} in Kilokalorien" />
    </div>
  `;
}

// Abendessen-Ziel = Tagesziel − Frühstück − Mittag. Read-only (kein Slider),
// weil es sich aus den anderen dreien ergibt. Zeigt "0 kcal" wenn Frühstück+
// Mittag das Tagesziel überschreiten — kein Alarm, User sieht das Problem selbst.
function renderDinnerTargetRow() {
  const p = state.settings.profile;
  const dinner = dinnerTarget(p);
  const display = dinner == null ? '—' : formatRange(dinner);
  // "Details"-Link analog zu "Vorschlag" bei Tagesziel — inline neben dem
  // Label. Klick öffnet das Makro-Popup (Chart + Ø + Preset-/Slider-Einstellungen).
  // Dort sitzen alle Makro-Verteilungs-Einstellungen; die Bedarfs-Anzeige lässt
  // sich zusätzlich unten in dieser Section deaktivieren.
  return `
    <div class="settings-row">
      <div class="settings-row__label settings-row__label--inline">
        <span class="settings-row__label-primary">Abendessen</span>
        <button class="settings-row__label-link"
                type="button"
                data-action="open-macro-details">Details</button>
      </div>
      <div class="settings-row__value settings-row__value--pill" data-role="dinner-value">${display}</div>
    </div>
  `;
}

function format(n) {
  return n.toLocaleString('de-DE');
}

// Ausgabe eines Zielkorridors "1.375 – 1.625 kcal". En-dash ohne Punkte, damit
// die Zeile schmal bleibt. Basis-Wert (val) ist die Mitte des Korridors.
function formatRange(val) {
  const range = kcalRange(val);
  if (!range) return '—';
  const [lo, hi] = range;
  return `${format(lo)}&thinsp;–&thinsp;${format(hi)} kcal`;
}

function renderGenderChip(key, label) {
  const pressed = state.settings.profile.gender === key;
  return `
    <button class="pref-chip"
            type="button"
            data-gender="${key}"
            aria-pressed="${pressed}">
      ${label}
    </button>
  `;
}

function renderGoalChip(key, label) {
  const pressed = state.settings.profile.goal === key;
  return `
    <button class="pref-chip"
            type="button"
            data-goal="${key}"
            aria-pressed="${pressed}">
      ${label}
    </button>
  `;
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

  attachProfileHandlers();

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

// Alle Inputs der Profil-Section verdrahten. Chips togglen exklusiv innerhalb
// ihrer Gruppe (Gender/Goal — anders als Diät/Küche wo Mehrfach-Auswahl gilt).
// Slider updaten den Wert live bei "input" (kein onExternalChange), speichern
// dann bei "change" (Loslassen) und triggern refresh.
function attachProfileHandlers() {
  // Gender-Chips: exklusive Auswahl, kein Toggle-Off — Geschlecht ist für die
  // Berechnung binär notwendig, Ausschalten wäre semantisch leer.
  rootEl.querySelectorAll('.pref-chip[data-gender]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.gender;
      if (state.settings.profile.gender === key) return;
      state.settings.profile.gender = key;
      rootEl.querySelectorAll('.pref-chip[data-gender]').forEach((other) => {
        other.setAttribute('aria-pressed', String(other.dataset.gender === key));
      });
      updateDailyTargetFromProfile();
      updateDinnerDisplay();
      updateSectionSummary('profil');
      onExternalChange();
    });
  });

  // Goal-Chips: exklusive Auswahl, kein Toggle-Off — Standard bleibt "maintain".
  rootEl.querySelectorAll('.pref-chip[data-goal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.goal;
      if (state.settings.profile.goal === key) return;
      state.settings.profile.goal = key;
      rootEl.querySelectorAll('.pref-chip[data-goal]').forEach((other) => {
        other.setAttribute('aria-pressed', String(other.dataset.goal === key));
      });
      updateDailyTargetFromProfile();
      updateDinnerDisplay();
      updateSectionSummary('profil');
      onExternalChange();
    });
  });

  // Alter-Stepper: Erstklick auf ±  aus null-State startet bei Mitte des Bereichs,
  // damit der User nicht 50-mal drücken muss. Danach normales Inkrementieren.
  const ageMinusBtn = rootEl.querySelector('[data-action="age-minus"]');
  const agePlusBtn = rootEl.querySelector('[data-action="age-plus"]');
  const ageValueEl = rootEl.querySelector('[data-role="age-value"]');
  const applyAge = (delta) => {
    const p = state.settings.profile;
    const current = p.age ?? AGE_DEFAULT;
    const next = Math.max(AGE_MIN, Math.min(AGE_MAX, current + delta));
    p.age = next;
    ageValueEl.textContent = String(next);
    if (ageMinusBtn) ageMinusBtn.disabled = next <= AGE_MIN;
    if (agePlusBtn) agePlusBtn.disabled = next >= AGE_MAX;
    updateDailyTargetFromProfile();
    updateDinnerDisplay();
    updateSectionSummary('profil');
    onExternalChange();
  };
  if (ageMinusBtn) ageMinusBtn.addEventListener('click', () => applyAge(-1));
  if (agePlusBtn) agePlusBtn.addEventListener('click', () => applyAge(1));

  // Größe-Slider
  const heightSlider = rootEl.querySelector('[data-action="height-change"]');
  const heightValEl = rootEl.querySelector('[data-role="height-value"]');
  if (heightSlider) {
    heightSlider.addEventListener('input', () => {
      const v = parseInt(heightSlider.value, 10);
      state.settings.profile.heightCm = v;
      heightValEl.textContent = `${v} cm`;
      updateDailyTargetFromProfile();
      updateDinnerDisplay();
      updateSectionSummary('profil');
    });
    heightSlider.addEventListener('change', () => onExternalChange());
  }

  // Gewicht-Slider
  const weightSlider = rootEl.querySelector('[data-action="weight-change"]');
  const weightValEl = rootEl.querySelector('[data-role="weight-value"]');
  if (weightSlider) {
    weightSlider.addEventListener('input', () => {
      const v = parseInt(weightSlider.value, 10);
      state.settings.profile.weightKg = v;
      weightValEl.textContent = `${v} kg`;
      updateDailyTargetFromProfile();
      updateDinnerDisplay();
      updateSectionSummary('profil');
    });
    weightSlider.addEventListener('change', () => onExternalChange());
  }

  // Aktivitätslevel-Slider — 5 Rastern, Label zeigt aktuelle Stufe.
  const activitySlider = rootEl.querySelector('[data-action="activity-change"]');
  const activityValEl = rootEl.querySelector('[data-role="activity-value"]');
  if (activitySlider) {
    activitySlider.addEventListener('input', () => {
      const v = parseInt(activitySlider.value, 10);
      state.settings.profile.activityLevel = v;
      const stage = ACTIVITY_LEVELS.find((a) => a.level === v) ?? ACTIVITY_LEVELS[2];
      activityValEl.textContent = stage.label;
      updateDailyTargetFromProfile();
      updateDinnerDisplay();
      updateSectionSummary('profil');
    });
    activitySlider.addEventListener('change', () => onExternalChange());
  }

  // Tagesziel-Slider: jeder Zug setzt Override. Damit übersteuert der User den
  // Profil-Vorschlag dauerhaft, spätere Profil-Änderungen ändern den Wert nicht.
  const dailySlider = rootEl.querySelector('[data-action="daily-change"]');
  const dailyValEl = rootEl.querySelector('[data-role="daily-value"]');
  const dailyHintEl = rootEl.querySelector('[data-role="daily-hint"]');
  const dailyResetBtn = rootEl.querySelector('[data-role="daily-reset"]');
  if (dailySlider) {
    dailySlider.addEventListener('input', () => {
      const v = parseInt(dailySlider.value, 10);
      state.settings.profile.dailyTargetOverride = v;
      dailyValEl.innerHTML = formatRange(v);
      if (dailyHintEl) dailyHintEl.textContent = 'Manuell überschrieben';
      if (dailyResetBtn) dailyResetBtn.hidden = false;
      updateSectionSummary('profil');
      updateDinnerDisplay();
    });
    dailySlider.addEventListener('change', () => onExternalChange());
  }

  // Refresh-Button beim Tagesziel: Override zurücksetzen → Vorschlag greift.
  if (dailyResetBtn) {
    dailyResetBtn.addEventListener('click', () => {
      state.settings.profile.dailyTargetOverride = null;
      updateDailyTargetFromProfile();
      updateDinnerDisplay();
      updateSectionSummary('profil');
      onExternalChange();
    });
  }

  attachMealSlider('breakfast', 'breakfastKcal');
  attachMealSlider('lunch', 'lunchKcal');

  // "Details"-Link neben Abendessen öffnet das Makro-Popup. Dort sitzen alle
  // Makro-Verteilungs-Einstellungen (Preset-Chips + Slider). Settings-Sheet
  // bleibt offen darunter — Popup ist z-index-lastig eine Ebene drüber.
  const macroLinkBtn = rootEl.querySelector('[data-action="open-macro-details"]');
  if (macroLinkBtn) {
    macroLinkBtn.addEventListener('click', () => onExternalOpenMacro());
  }

  // Bedarfs-Anzeige-Toggle: togglet Sichtbarkeit der Wochen-Pille im Dashboard.
  // M3-Switch: aria-checked steuert Anzeige, CSS reagiert per Selector auf den
  // Wert — kein Text/Icon-Update im JS nötig.
  const barToggle = rootEl.querySelector('[data-action="toggle-calorie-bar"]');
  if (barToggle) {
    barToggle.addEventListener('click', () => {
      const next = state.settings.profile.showCalorieBar === false;
      state.settings.profile.showCalorieBar = next;
      barToggle.setAttribute('aria-checked', String(next));
      onExternalChange();
    });
  }
}

// Frühstück/Mittag-Slider — beide teilen dasselbe Muster (Live-Update + Dinner-
// Rest neu berechnen + externes Save bei change). Als Helper extrahiert damit
// die Deklaration im Handler-Setup einzeilig bleibt.
function attachMealSlider(action, stateKey) {
  const slider = rootEl.querySelector(`[data-action="${action}-change"]`);
  const valEl = rootEl.querySelector(`[data-role="${action}-value"]`);
  if (!slider) return;
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value, 10);
    state.settings.profile[stateKey] = v;
    valEl.textContent = `${v.toLocaleString('de-DE')} kcal`;
    updateDinnerDisplay();
  });
  slider.addEventListener('change', () => onExternalChange());
}

// Aktualisiert die Read-only-Anzeige des Abendessen-Rests live, ohne die ganze
// Section neu zu rendern (Slider-Position würde sonst beim Zug springen).
function updateDinnerDisplay() {
  const el = rootEl?.querySelector('[data-role="dinner-value"]');
  if (!el) return;
  const val = dinnerTarget(state.settings.profile);
  el.innerHTML = val == null ? '—' : formatRange(val);
}

// Nach Änderung eines Profil-Feldes: Override aufheben (damit Aktivität/Alter/
// etc. wieder durchschlagen), Vorschlag-Hint aktualisieren, Slider-Position und
// Value-Anzeige des Tagesziels auf den neuen Vorschlag setzen. Bewusstes
// Overriden funktioniert weiter — aber nur solange der User keine Profil-Werte
// mehr anfasst (Semantik: "Profil = Vorschlag, Slider = Feinjustierung
// solange Profil unverändert").
function updateDailyTargetFromProfile() {
  const p = state.settings.profile;
  p.dailyTargetOverride = null;
  const suggestion = dailyTarget(p);
  const slider = rootEl?.querySelector('[data-action="daily-change"]');
  const valEl = rootEl?.querySelector('[data-role="daily-value"]');
  const hintEl = rootEl?.querySelector('[data-role="daily-hint"]');
  const resetBtn = rootEl?.querySelector('[data-role="daily-reset"]');
  if (hintEl) {
    hintEl.textContent = suggestion != null
      ? `Vorschlag: ${suggestion.toLocaleString('de-DE')} kcal`
      : 'Profil unvollständig';
  }
  if (suggestion != null) {
    if (slider) slider.value = String(suggestion);
    if (valEl) valEl.innerHTML = formatRange(suggestion);
  }
  if (resetBtn) resetBtn.hidden = true;
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
