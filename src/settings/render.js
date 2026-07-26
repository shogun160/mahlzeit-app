import {
  state,
  PORTIONS_MIN,
  PORTIONS_MAX,
  COOKTIME_MIN,
  COOKTIME_MAX,
  COOKTIME_STEP,
} from '../state.js';
import { changeDefaultPortions } from '../dashboard/portions.js';

const TRANSITION_MS = 250;
const SWIPE_THRESHOLD_PX = 55;
const SWIPE_DIRECTIONAL_RATIO = 1.4; // |dy| muss 1.4x größer als |dx| sein

let rootEl = null;
let onExternalChange = () => {};

// --- Mount / Lifecycle ---

export function mountSettingsSheet(el, { onChange } = {}) {
  rootEl = el;
  onExternalChange = onChange || (() => {});
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

  rootEl.innerHTML = `
    <div class="settings-overlay" data-role="backdrop">
      <div class="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="settings-handle" aria-hidden="true"></div>
        <div class="settings-header">
          <h2 class="settings-header__title" id="settings-title">Einstellungen</h2>
          <button class="settings-close" data-action="close" aria-label="Schließen">✕</button>
        </div>
        <div class="settings-body">
          <section class="settings-section">
            <h3 class="settings-section__title">Portionen</h3>
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
          </section>

          <section class="settings-section">
            <h3 class="settings-section__title">Kochzeit</h3>
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
          </section>

          <section class="settings-section">
            <h3 class="settings-section__title">Ernährungspräferenzen</h3>
            <div class="settings-prefs" role="group" aria-label="Ernährungspräferenzen">
              ${renderPrefChip('vegetarian', 'Vegetarisch')}
              ${renderPrefChip('vegan', 'Vegan')}
              ${renderPrefChip('noMeat', 'Kein Fleisch')}
              ${renderPrefChip('noFish', 'Kein Fisch')}
              ${renderPrefChip('lactoseFree', 'Laktosefrei')}
              ${renderPrefChip('glutenFree', 'Glutenfrei')}
            </div>
          </section>

          <section class="settings-section settings-section--soon">
            <h3 class="settings-section__title">Küchen-Präferenzen</h3>
            <p class="settings-section__note">Kommt bald — Lieblingsküchen priorisieren beim Reroll</p>
          </section>

          <section class="settings-section settings-section--soon">
            <h3 class="settings-section__title">Profil &amp; Kalorien</h3>
            <p class="settings-section__note">Kommt bald — Alter, Größe, Gewicht, Aktivität → Tageskalorien-Ziel</p>
          </section>

          <section class="settings-section settings-section--soon">
            <h3 class="settings-section__title">Darstellung</h3>
            <p class="settings-section__note">Kommt bald — Dark Mode, Akzentfarbe</p>
          </section>

          <section class="settings-section settings-section--soon">
            <h3 class="settings-section__title">Daten</h3>
            <p class="settings-section__note">Kommt bald — Backup exportieren/importieren, Alle Daten zurücksetzen</p>
          </section>

          <section class="settings-section">
            <h3 class="settings-section__title">Über</h3>
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
          </section>
        </div>
      </div>
    </div>
  `;

  attachHandlers();
}

function formatCookTime(min) {
  return min >= COOKTIME_MAX ? 'unbegrenzt' : `${min} Min`;
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

function attachHandlers() {
  const overlay = rootEl.querySelector('[data-role="backdrop"]');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) closeSettingsSheet();
  });
  rootEl.querySelector('[data-action="close"]').addEventListener('click', closeSettingsSheet);

  rootEl.querySelector('[data-action="portions-minus"]').addEventListener('click', () => handlePortions(-1));
  rootEl.querySelector('[data-action="portions-plus"]').addEventListener('click', () => handlePortions(1));

  const slider = rootEl.querySelector('[data-action="cooktime-change"]');
  const valueEl = rootEl.querySelector('[data-role="cooktime-value"]');
  // input: live-Update der Anzeige, kein Save (sonst Flut an refresh-Calls beim Ziehen).
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value, 10);
    state.settings.maxCookTime = v;
    valueEl.textContent = formatCookTime(v);
  });
  // change: nach Loslassen — jetzt persistieren + externes Refresh triggern.
  slider.addEventListener('change', () => onExternalChange());

  // Ernährungs-Chips togglen ihren State + triggern refresh (Reroll-Pool ändert sich).
  rootEl.querySelectorAll('.pref-chip[data-pref]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.pref;
      const next = !state.settings.preferences[key];
      state.settings.preferences[key] = next;
      btn.setAttribute('aria-pressed', String(next));
      onExternalChange();
    });
  });

  attachCloseSwipe();
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

function handlePortions(delta) {
  changeDefaultPortions(delta);
  const { defaultPortions } = state.settings;
  const valueEl = rootEl.querySelector('[data-role="portions-value"]');
  const minusBtn = rootEl.querySelector('[data-action="portions-minus"]');
  const plusBtn = rootEl.querySelector('[data-action="portions-plus"]');
  if (valueEl) valueEl.textContent = defaultPortions;
  if (minusBtn) minusBtn.disabled = defaultPortions <= PORTIONS_MIN;
  if (plusBtn) plusBtn.disabled = defaultPortions >= PORTIONS_MAX;
  onExternalChange();
}
