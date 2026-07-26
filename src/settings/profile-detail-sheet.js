// Bottom-Sheet fuer Profil-Bearbeitung. Rendert die Wizard-Slots als
// scrollbare Single-Page-Form fuer ein konkretes profiles[x]-Objekt. Loeschen-
// Button unten (deaktiviert fuer profiles[0] = User 1). Aenderungen mutieren
// das uebergebene Profil direkt und triggern den externen onChange (der im
// main.js refresh() + saveState() feuert).
//
// Muster orientiert an settings/render.js (Handler + Slider), aber
// parameterisiert auf ein Profil statt getActiveProfile(). Bewusste Copy
// statt shared Helper — die Fields sind stabil, die Semantik-Doppelung ist
// akzeptabel; ein spaetere Konsolidierung waere ein Refactor eigener Session.

import { state, removeProfile, setActiveProfileId } from '../state.js';
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
const ICON_REFRESH = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;

let rootEl = null;
let onExternalChange = () => {};
let currentProfile = null;

export function mountProfileDetailSheet(el, { onChange } = {}) {
  rootEl = el;
  onExternalChange = onChange || (() => {});
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export function openProfileDetailSheet(profileId) {
  if (!rootEl) throw new Error('Profile-Detail-Sheet nicht gemountet.');
  const profile = state.settings.profiles.find((p) => p.id === profileId);
  if (!profile) return;
  currentProfile = profile;
  renderShell();
  rootEl.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => rootEl.querySelector('.profile-detail-overlay').classList.add('is-open'));
  });
  document.addEventListener('keydown', handleEsc);
}

export function closeProfileDetailSheet() {
  if (!rootEl || rootEl.hidden) return;
  const overlay = rootEl.querySelector('.profile-detail-overlay');
  if (overlay) overlay.classList.remove('is-open');
  document.removeEventListener('keydown', handleEsc);
  setTimeout(() => {
    if (rootEl && !rootEl.querySelector('.profile-detail-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
    }
  }, TRANSITION_MS);
}

function handleEsc(ev) {
  if (ev.key === 'Escape') closeProfileDetailSheet();
}

function renderShell() {
  const isFirst = state.settings.profiles[0]?.id === currentProfile.id;
  const isActive = isFirst; // aktives Profil = profiles[0]
  const isOnlyProfile = state.settings.profiles.length <= 1;
  const title = currentProfile.name ? currentProfile.name : (isActive ? 'Profil' : 'Weiteres Profil');

  rootEl.innerHTML = `
    <div class="profile-detail-overlay" data-role="backdrop">
      <div class="profile-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-detail-title">
        <div class="profile-detail-handle" aria-hidden="true"></div>
        <div class="profile-detail-header">
          <h2 class="profile-detail-title" id="profile-detail-title">${escapeHtml(title)}</h2>
          <button class="profile-detail-close" data-action="close" aria-label="Schließen">✕</button>
        </div>
        <div class="profile-detail-body">
          ${renderActiveRow(isActive)}
          ${renderNameRow()}
          ${renderGenderRow()}
          ${renderAgeRow()}
          ${renderSliderRow('height', 'Größe', currentProfile.heightCm, HEIGHT_MIN, HEIGHT_MAX, HEIGHT_DEFAULT, 'cm', 'Größe in Zentimetern')}
          ${renderSliderRow('weight', 'Gewicht', currentProfile.weightKg, WEIGHT_MIN, WEIGHT_MAX, WEIGHT_DEFAULT, 'kg', 'Gewicht in Kilogramm')}
          ${renderActivityRow()}
          ${renderGoalRow()}
          ${renderPreferencesRow()}
          ${renderDailyTargetRow()}
          ${renderMealRow('breakfast', 'Frühstück', currentProfile.breakfastKcal, BREAKFAST_MAX)}
          ${renderMealRow('lunch', 'Mittag', currentProfile.lunchKcal, LUNCH_MAX)}
          ${renderDinnerRow()}
          ${renderShowBarRow()}
          ${renderDeleteRow(isOnlyProfile)}
        </div>
      </div>
    </div>
  `;

  attachHandlers();
}

// Aktiv-Zeile: aktives Profil ist immer profiles[0]. Fuer nicht-aktive Profile
// ein Shortcut-Button "Als aktiv setzen" — schiebt das Profil an Position 0
// und macht es damit zum aktiven (Bedarfs-Anzeige folgt). Alternativ kann in
// der Settings-Liste per Drag&Drop umsortiert werden. Fuer bereits aktive
// Profile: Info-Zeile "Aktuell aktiv" statt Button.
function renderActiveRow(isActive) {
  if (isActive) {
    return `
      <div class="settings-row">
        <div class="settings-row__label">
          <div class="settings-row__label-primary">Aktuell aktives Profil</div>
          <div class="settings-row__label-secondary">Bedarfs-Anzeige im Dashboard folgt diesem User</div>
        </div>
      </div>
    `;
  }
  return `
    <div class="settings-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Nicht aktiv</div>
        <div class="settings-row__label-secondary">Bedarfs-Anzeige folgt aktuell einem anderen User</div>
      </div>
      <button class="settings-action-btn"
              type="button"
              data-action="set-active">
        Als aktiv setzen
      </button>
    </div>
  `;
}

function renderNameRow() {
  const nameVal = currentProfile.name ?? '';
  return `
    <div class="settings-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Name</div>
      </div>
      <input class="profile-detail-input"
             type="text"
             maxlength="30"
             value="${escapeAttr(nameVal)}"
             placeholder="Name (optional)"
             data-action="name-change" />
    </div>
  `;
}

function renderGenderRow() {
  const chip = (key, label) => `
    <button class="pref-chip" type="button" data-gender="${key}" aria-pressed="${currentProfile.gender === key}">${label}</button>
  `;
  return `
    <div class="settings-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Geschlecht</div>
      </div>
      <div class="settings-prefs" role="group" aria-label="Geschlecht">
        ${chip('female', 'Weiblich')}
        ${chip('male', 'Männlich')}
      </div>
    </div>
  `;
}

function renderAgeRow() {
  const age = currentProfile.age;
  const ageStr = age == null ? '—' : String(age);
  const minusDis = age == null || age <= AGE_MIN;
  const plusDis = age != null && age >= AGE_MAX;
  return `
    <div class="settings-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Alter</div>
      </div>
      <div class="stepper stepper--compact" role="group" aria-label="Alter in Jahren">
        <button class="stepper__btn" data-action="age-minus" aria-label="Weniger" ${minusDis ? 'disabled' : ''}>−</button>
        <span class="stepper__value" data-role="age-value">${ageStr}</span>
        <button class="stepper__btn" data-action="age-plus" aria-label="Mehr" ${plusDis ? 'disabled' : ''}>+</button>
      </div>
    </div>
  `;
}

function renderSliderRow(actionKey, label, value, min, max, def, unit, ariaLabel) {
  const displayValue = value == null ? '—' : `${value} ${unit}`;
  const sliderVal = value ?? def;
  return `
    <div class="settings-field">
      <div class="settings-row">
        <div class="settings-row__label">
          <div class="settings-row__label-primary">${label}</div>
        </div>
        <div class="settings-row__value" data-role="${actionKey}-value">${displayValue}</div>
      </div>
      <input type="range" class="settings-slider"
             data-action="${actionKey}-change"
             min="${min}" max="${max}" step="1" value="${sliderVal}"
             aria-label="${ariaLabel}" />
    </div>
  `;
}

function renderActivityRow() {
  const activity = ACTIVITY_LEVELS.find((a) => a.level === currentProfile.activityLevel) ?? ACTIVITY_LEVELS[2];
  return `
    <div class="settings-field">
      <div class="settings-row">
        <div class="settings-row__label">
          <div class="settings-row__label-primary">Aktivitätslevel</div>
        </div>
        <div class="settings-row__value" data-role="activity-value">${activity.label}</div>
      </div>
      <input type="range" class="settings-slider"
             data-action="activity-change"
             min="1" max="5" step="1" value="${activity.level}"
             aria-label="Aktivitätslevel" />
    </div>
  `;
}

function renderGoalRow() {
  const chip = (key, label) => `
    <button class="pref-chip" type="button" data-goal="${key}" aria-pressed="${currentProfile.goal === key}">${label}</button>
  `;
  return `
    <div class="settings-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Ziel</div>
      </div>
      <div class="settings-prefs settings-prefs--inline" role="group" aria-label="Ziel">
        ${GOALS.map((g) => chip(g.key, g.label)).join('')}
      </div>
    </div>
  `;
}

// Diaet-Praeferenzen pro Profil: Toggle-Chips (Fleisch/Fisch/Vegetarisch).
// Im Dish-Picker + Reroll wird die Schnittmenge aller mitkochenden Profile
// als Vorauswahl genutzt (Fallback: aktiver User bei leerem Schnitt).
function renderPreferencesRow() {
  const prefs = currentProfile.preferences ?? {};
  const chip = (key, label) => `
    <button class="pref-chip" type="button" data-pref-toggle="${key}" aria-pressed="${!!prefs[key]}">${label}</button>
  `;
  return `
    <div class="settings-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Ernährungspräferenz</div>
        <div class="settings-row__label-secondary">Was darf auf deinem Teller?</div>
      </div>
      <div class="settings-prefs" role="group" aria-label="Ernährungspräferenz">
        ${chip('meat', 'Fleisch')}
        ${chip('fish', 'Fisch')}
        ${chip('vegetarian', 'Vegetarisch')}
      </div>
    </div>
  `;
}

function renderDailyTargetRow() {
  const effective = effectiveDailyTarget(currentProfile);
  const suggestion = dailyTarget(currentProfile);
  const val = effective ?? suggestion ?? Math.round((DAILY_TARGET_MIN + DAILY_TARGET_MAX) / 2);
  const overridden = currentProfile.dailyTargetOverride != null;
  const hint = overridden
    ? 'Manuell überschrieben'
    : (suggestion != null ? `Vorschlag: ${format(suggestion)} kcal` : 'Profil unvollständig');
  return `
    <div class="settings-field">
      <div class="settings-row">
        <div class="settings-row__label settings-row__label--inline">
          <span class="settings-row__label-primary">Tagesziel</span>
          <span class="settings-row__label-secondary" data-role="daily-hint">${hint}</span>
        </div>
        <button class="settings-refresh" type="button"
                data-action="daily-reset" data-role="daily-reset"
                ${overridden ? '' : 'hidden'}
                aria-label="Tagesziel-Vorschlag wiederherstellen"
                title="Vorschlag wiederherstellen">${ICON_REFRESH}</button>
        <div class="settings-row__value" data-role="daily-value">${formatRange(val)}</div>
      </div>
      <input type="range" class="settings-slider"
             data-action="daily-change"
             min="${DAILY_TARGET_MIN}" max="${DAILY_TARGET_MAX}" step="${DAILY_TARGET_STEP}"
             value="${val}"
             aria-label="Tagesziel in Kilokalorien" />
    </div>
  `;
}

function renderMealRow(key, label, value, max) {
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
      <input type="range" class="settings-slider"
             data-action="${key}-change"
             min="0" max="${max}" step="${MEAL_KCAL_STEP}" value="${sliderVal}"
             aria-label="${label} in Kilokalorien" />
    </div>
  `;
}

function renderDinnerRow() {
  const dinner = dinnerTarget(currentProfile);
  const display = dinner == null ? '—' : formatRange(dinner);
  return `
    <div class="settings-row">
      <div class="settings-row__label settings-row__label--inline">
        <span class="settings-row__label-primary">Abendessen</span>
      </div>
      <div class="settings-row__value settings-row__value--pill" data-role="dinner-value">${display}</div>
    </div>
  `;
}

function renderShowBarRow() {
  const pressed = currentProfile.showCalorieBar !== false;
  return `
    <div class="settings-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Bedarfs-Anzeige im Dashboard</div>
        <div class="settings-row__label-secondary">Nur aktiv wenn dieses Profil aktiv ist</div>
      </div>
      <button class="m3-switch" type="button" role="switch" data-action="toggle-calorie-bar"
              aria-checked="${pressed}"
              aria-label="Bedarfs-Anzeige">
        <span class="m3-switch__thumb" aria-hidden="true"></span>
      </button>
    </div>
  `;
}

// Loeschen-Button ganz unten. Verweigert wenn nur ein einziges Profil uebrig
// waere. Sonst: rot, mit Confirm-Popup. Beim Loeschen des aktuell aktiven
// Profils rueckt das naechste in profiles[] auf und wird aktiv.
function renderDeleteRow(isOnlyProfile) {
  const disabled = isOnlyProfile;
  const hint = isOnlyProfile
    ? 'Mindestens ein Profil muss bestehen bleiben.'
    : 'Das Profil wird entfernt. Favoriten und individuelle Werte gehen verloren.';
  return `
    <div class="profile-detail-delete">
      <button class="profile-detail-delete__btn"
              type="button"
              data-action="delete"
              ${disabled ? 'disabled' : ''}>
        Profil löschen
      </button>
      <p class="profile-detail-delete__hint">${hint}</p>
    </div>
  `;
}

function attachHandlers() {
  const overlay = rootEl.querySelector('[data-role="backdrop"]');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) closeProfileDetailSheet();
  });
  rootEl.querySelector('[data-action="close"]').addEventListener('click', closeProfileDetailSheet);

  // Als-aktiv-setzen-Button: verschiebt das Profil an profiles[0]. Damit ist
  // es aktiv (Bedarfs-Anzeige folgt). Re-render, damit die Info-Zeile
  // "Aktuell aktives Profil" erscheint.
  const activeBtn = rootEl.querySelector('[data-action="set-active"]');
  if (activeBtn) activeBtn.addEventListener('click', () => {
    setActiveProfileId(currentProfile.id);
    onExternalChange();
    renderShell();
  });

  // Name
  const nameInput = rootEl.querySelector('[data-action="name-change"]');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const v = nameInput.value.trim();
      currentProfile.name = v === '' ? null : v;
    });
    nameInput.addEventListener('change', () => onExternalChange());
  }

  // Gender-Chips
  rootEl.querySelectorAll('[data-gender]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.gender;
      if (currentProfile.gender === key) return;
      currentProfile.gender = key;
      rootEl.querySelectorAll('[data-gender]').forEach((o) => o.setAttribute('aria-pressed', String(o.dataset.gender === key)));
      updateDailyTargetFromProfile();
      updateDinnerDisplay();
      onExternalChange();
    });
  });

  // Pref-Chips (Diaet pro Profil)
  rootEl.querySelectorAll('[data-pref-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.prefToggle;
      if (!currentProfile.preferences) currentProfile.preferences = { meat: false, fish: false, vegetarian: false };
      currentProfile.preferences[key] = !currentProfile.preferences[key];
      btn.setAttribute('aria-pressed', String(!!currentProfile.preferences[key]));
      onExternalChange();
    });
  });

  // Goal-Chips
  rootEl.querySelectorAll('[data-goal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.goal;
      if (currentProfile.goal === key) return;
      currentProfile.goal = key;
      rootEl.querySelectorAll('[data-goal]').forEach((o) => o.setAttribute('aria-pressed', String(o.dataset.goal === key)));
      updateDailyTargetFromProfile();
      updateDinnerDisplay();
      onExternalChange();
    });
  });

  // Alter-Stepper
  const ageMinus = rootEl.querySelector('[data-action="age-minus"]');
  const agePlus = rootEl.querySelector('[data-action="age-plus"]');
  const ageValEl = rootEl.querySelector('[data-role="age-value"]');
  const applyAge = (delta) => {
    const cur = currentProfile.age ?? AGE_DEFAULT;
    const next = Math.max(AGE_MIN, Math.min(AGE_MAX, cur + delta));
    currentProfile.age = next;
    ageValEl.textContent = String(next);
    if (ageMinus) ageMinus.disabled = next <= AGE_MIN;
    if (agePlus) agePlus.disabled = next >= AGE_MAX;
    updateDailyTargetFromProfile();
    updateDinnerDisplay();
    onExternalChange();
  };
  if (ageMinus) ageMinus.addEventListener('click', () => applyAge(-1));
  if (agePlus) agePlus.addEventListener('click', () => applyAge(1));

  // Sliders (height, weight, activity)
  bindProfileSlider('height', 'heightCm', (v) => `${v} cm`, updateDailyTargetFromProfile);
  bindProfileSlider('weight', 'weightKg', (v) => `${v} kg`, updateDailyTargetFromProfile);
  bindProfileSlider('activity', 'activityLevel', (v) => (ACTIVITY_LEVELS.find((a) => a.level === v) ?? ACTIVITY_LEVELS[2]).label, updateDailyTargetFromProfile);

  // Tagesziel
  const dailySlider = rootEl.querySelector('[data-action="daily-change"]');
  const dailyValEl = rootEl.querySelector('[data-role="daily-value"]');
  const dailyHintEl = rootEl.querySelector('[data-role="daily-hint"]');
  const dailyResetBtn = rootEl.querySelector('[data-role="daily-reset"]');
  if (dailySlider) {
    dailySlider.addEventListener('input', () => {
      const v = parseInt(dailySlider.value, 10);
      currentProfile.dailyTargetOverride = v;
      dailyValEl.innerHTML = formatRange(v);
      if (dailyHintEl) dailyHintEl.textContent = 'Manuell überschrieben';
      if (dailyResetBtn) dailyResetBtn.hidden = false;
      updateDinnerDisplay();
    });
    dailySlider.addEventListener('change', () => onExternalChange());
  }
  if (dailyResetBtn) {
    dailyResetBtn.addEventListener('click', () => {
      currentProfile.dailyTargetOverride = null;
      updateDailyTargetFromProfile();
      updateDinnerDisplay();
      onExternalChange();
    });
  }

  // Meal-Slider (breakfast, lunch)
  bindMealSlider('breakfast', 'breakfastKcal');
  bindMealSlider('lunch', 'lunchKcal');

  // Show-Bar-Switch
  const barBtn = rootEl.querySelector('[data-action="toggle-calorie-bar"]');
  if (barBtn) {
    barBtn.addEventListener('click', () => {
      const next = currentProfile.showCalorieBar === false;
      currentProfile.showCalorieBar = next;
      barBtn.setAttribute('aria-checked', String(next));
      onExternalChange();
    });
  }

  // Delete-Button — mit Confirm, dann Sheet schliessen + refresh
  const deleteBtn = rootEl.querySelector('[data-action="delete"]');
  if (deleteBtn && !deleteBtn.disabled) {
    deleteBtn.addEventListener('click', () => {
      const label = currentProfile.name ? `„${currentProfile.name}"` : 'dieses Profil';
      if (!confirm(`${label} wirklich löschen?`)) return;
      removeProfile(currentProfile.id);
      onExternalChange();
      closeProfileDetailSheet();
    });
  }
}

function bindProfileSlider(action, stateKey, formatter, onFinalChange) {
  const slider = rootEl.querySelector(`[data-action="${action}-change"]`);
  const valEl = rootEl.querySelector(`[data-role="${action}-value"]`);
  if (!slider) return;
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value, 10);
    currentProfile[stateKey] = v;
    if (valEl) valEl.textContent = formatter(v);
    if (onFinalChange) onFinalChange();
    updateDinnerDisplay();
  });
  slider.addEventListener('change', () => onExternalChange());
}

function bindMealSlider(action, stateKey) {
  const slider = rootEl.querySelector(`[data-action="${action}-change"]`);
  const valEl = rootEl.querySelector(`[data-role="${action}-value"]`);
  if (!slider) return;
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value, 10);
    currentProfile[stateKey] = v;
    if (valEl) valEl.textContent = `${v.toLocaleString('de-DE')} kcal`;
    updateDinnerDisplay();
  });
  slider.addEventListener('change', () => onExternalChange());
}

function updateDinnerDisplay() {
  const el = rootEl?.querySelector('[data-role="dinner-value"]');
  if (!el) return;
  const val = dinnerTarget(currentProfile);
  el.innerHTML = val == null ? '—' : formatRange(val);
}

// Wenn Biometrie / Ziel geaendert: Override aufheben, Vorschlag neu rechnen,
// Slider auf Vorschlag ziehen. Analog zu updateDailyTargetFromProfile in
// settings/render.js.
function updateDailyTargetFromProfile() {
  currentProfile.dailyTargetOverride = null;
  const suggestion = dailyTarget(currentProfile);
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

function format(n) {
  return n.toLocaleString('de-DE');
}
function formatRange(val) {
  const range = kcalRange(val);
  if (!range) return '—';
  const [lo, hi] = range;
  return `${format(lo)}&thinsp;–&thinsp;${format(hi)} kcal`;
}
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
