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
import { openProfileShareSheet } from '../profile-share/share-sheet.js';
import { openOnboardingWizard } from '../onboarding/wizard.js';
import { showToast } from '../util/toast.js';
import { rerollAll } from '../dashboard/reroll.js';
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
  DINNER_KCAL_MIN,
  DINNER_KCAL_MAX,
  dailyTarget,
  effectiveDailyTarget,
  dinnerTarget,
  kcalRangeRounded,
} from '../nutrition/target.js';

const TRANSITION_MS = 250;
const ICON_REFRESH = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;
const ICON_UNDO = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z"/></svg>`;

let rootEl = null;
let onExternalChange = () => {};
let currentProfile = null;
// Snapshot beim Sheet-Open (fuer Reset) und Undo-Stack (pro Slider-Drag /
// Chip-Klick — pushen VOR der Aenderung).
let initialProfile = null;
let undoStack = [];
// Wird gesetzt, wenn Praeferenz-Slots (Biometrie, Ziel, Aktivitaet, Fr/Mi,
// Dinner, Prefs, Cuisines) sich veraendert haben. Beim Close triggert das
// einen Wochen-Reroll — nicht bei jedem Slider-Move, um Ueberreactions und
// UI-Flackern zu vermeiden.
let hasProfileChanges = false;
function markProfileChanged() { hasProfileChanges = true; }

function snapshotProfile() {
  return currentProfile ? JSON.parse(JSON.stringify(currentProfile)) : null;
}
function pushUndo() {
  if (currentProfile) undoStack.push(snapshotProfile());
  updateUndoBtnState();
}
function updateUndoBtnState() {
  const btn = rootEl?.querySelector('[data-action="undo"]');
  if (btn) btn.disabled = undoStack.length === 0;
}
function restoreProfile(snap) {
  if (!snap || !currentProfile) return;
  for (const key of Object.keys(currentProfile)) delete currentProfile[key];
  Object.assign(currentProfile, JSON.parse(JSON.stringify(snap)));
}

export function mountProfileDetailSheet(el, { onChange } = {}) {
  rootEl = el;
  onExternalChange = onChange || (() => {});
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export function openProfileDetailSheet(profileId) {
  if (!rootEl) throw new Error('Profile-Detail-Sheet nicht gemountet.');
  // Standard-Profil hat id '_default' und sitzt in state.settings.standardProfile,
  // nicht in profiles[]. Fuer alles andere greifen wir in profiles[].
  const profile = profileId === '_default'
    ? state.settings.standardProfile
    : state.settings.profiles.find((p) => p.id === profileId);
  if (!profile) return;
  currentProfile = profile;
  initialProfile = snapshotProfile();
  undoStack = [];
  hasProfileChanges = false;
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
  // Wenn im Sheet Praeferenz-Slots geaendert wurden: die Wochenauswahl
  // spiegelt sie evtl. nicht mehr — neu ausdulesen. Kein Reroll bei reinem
  // User-Wechsel oder Name-Aenderung.
  if (hasProfileChanges) {
    hasProfileChanges = false;
    rerollAll();
    onExternalChange();
  }
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

// Setzt Standard-Profil-Biometrie auf Bevoelkerungs-Median je Geschlecht.
// activityLevel + goal + Meal-Aufteilung bleiben unveraendert — sie sind
// keine Gender-Abhaengigen Werte.
function applyDefaultBiometrics() {
  if (!currentProfile) return;
  if (currentProfile.gender === 'female') {
    currentProfile.heightCm = 165;
    currentProfile.weightKg = 65;
  } else {
    currentProfile.heightCm = 175;
    currentProfile.weightKg = 75;
  }
  if (currentProfile.activityLevel == null) currentProfile.activityLevel = 3;
  if (!currentProfile.goal) currentProfile.goal = 'maintain';
}

function renderShell() {
  const isDefault = currentProfile.id === '_default';
  const isFirst = !isDefault && state.settings.profiles[0]?.id === currentProfile.id;
  const isActive = isFirst; // aktives Profil = profiles[0]; Standard-Profil ist nie aktiv
  const isOnlyProfile = state.settings.profiles.length <= 1;
  const title = isDefault
    ? 'Standard-Profil'
    : (currentProfile.name ? currentProfile.name : (isActive ? 'Profil' : 'Weiteres Profil'));
  // Standard-Profil-Sonder-Layout: kein Aktiv-Row (ist nie aktiv), kein
  // Delete-Row (nicht loeschbar), kein Show-Bar (hat keine Bedarfs-Pille im
  // Dashboard — nur als Kochmengen-Fallback relevant), kein Name-Row (Titel
  // ist fix "Standard-Profil"). Sonst identische Editier-Optik.

  rootEl.innerHTML = `
    <div class="profile-detail-overlay" data-role="backdrop">
      <div class="profile-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-detail-title">
        <div class="profile-detail-handle" aria-hidden="true"></div>
        <div class="profile-detail-header">
          <div class="profile-detail-header__actions">
            <button class="profile-detail-icon-btn" data-action="undo" aria-label="Letzten Schritt rückgängig" title="Letzten Schritt rückgängig">
              ${ICON_UNDO}
            </button>
            <button class="profile-detail-icon-btn" data-action="reset" aria-label="Auf Ausgangswerte zurücksetzen" title="Auf Ausgangswerte zurücksetzen">
              ${ICON_REFRESH}
            </button>
          </div>
          <h2 class="profile-detail-title" id="profile-detail-title">${escapeHtml(title)}</h2>
          <button class="profile-detail-close" data-action="close" aria-label="Schließen">✕</button>
        </div>
        <div class="profile-detail-body">
          ${isDefault ? `
          ${renderDefaultInfoRow()}
          ${renderGenderRow()}
          ${renderAgeRow()}
          ${renderActivityRow()}
          ${renderUserDinnerField()}
          ` : `
          ${renderActiveToggleRow(isActive)}
          ${renderNameRow()}
          ${renderAgeRow()}
          ${renderSliderRow('weight', 'Gewicht', currentProfile.weightKg, WEIGHT_MIN, WEIGHT_MAX, WEIGHT_DEFAULT, 'kg', 'Gewicht in Kilogramm')}
          ${renderActivityRow()}
          ${renderGoalRow()}
          ${renderPreferencesRow()}
          ${renderCuisinesRow()}
          ${renderUserDinnerField()}
          ${renderWizardEditRow()}
          <button class="btn btn--secondary profile-detail__share" type="button" data-action="share-profile">
            Profil teilen
          </button>
          ${renderDeleteRow(isOnlyProfile, isActive)}
          `}
        </div>
      </div>
    </div>
  `;

  attachHandlers();
}

// Info-Zeile ganz oben im Standard-Profil-Detail-Sheet: erklaert Zweck +
// warum kein Loeschen.
function renderDefaultInfoRow() {
  // Wenn noch kein User-Profil eingerichtet ist, ist das Standard-Profil
  // die einzige kcal-Quelle. Andernfalls dient es als Fallback fuer
  // zusaetzliche Personen jenseits der eingerichteten Profile.
  const hasUserProfile = Array.isArray(state.settings.profiles) && state.settings.profiles.length > 0;
  const desc = hasUserProfile
    ? 'Wird für zusätzliche Personen benutzt, wenn kein passendes Profil da ist.'
    : 'Für weitere Einstellungen wird ein Nutzerprofil benötigt.';
  const addBtn = hasUserProfile ? '' : `
    <button class="settings-profile-add" type="button" data-action="add-profile-from-default">
      <span class="settings-profile-add__icon" aria-hidden="true">+</span>
      <span class="settings-profile-add__label">Profil hinzufügen</span>
    </button>
  `;
  return `
    <div class="settings-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Standard-Profil</div>
        <div class="settings-row__label-secondary">${desc}</div>
      </div>
    </div>
    ${addBtn}
  `;
}

// Aktiv-Zeile: aktives Profil ist immer profiles[0]. Fuer nicht-aktive Profile
// ein Shortcut-Button "Als aktiv setzen" — schiebt das Profil an Position 0
// und macht es damit zum aktiven (Bedarfs-Anzeige folgt). Alternativ kann in
// der Settings-Liste per Drag&Drop umsortiert werden. Fuer bereits aktive
// Profile: Info-Zeile "Aktuell aktiv" statt Button.
function renderWizardEditRow() {
  return `
    <div class="settings-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Details</div>
        <div class="settings-row__label-secondary">Weitere Einstellungen im Einrichtungsassistent ändern</div>
      </div>
      <button class="settings-action-btn"
              type="button"
              data-action="edit-in-wizard">
        Ändern
      </button>
    </div>
  `;
}

function renderActiveToggleRow(isActive) {
  return `
    <div class="settings-row">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Aktives Profil</div>
        <div class="settings-row__label-secondary">Bedarfs-Anzeige im Dashboard folgt diesem User</div>
      </div>
      <button class="m3-switch" type="button" role="switch"
              data-action="toggle-active"
              aria-checked="${isActive}"
              aria-label="Als aktives Profil setzen">
        <span class="m3-switch__thumb" aria-hidden="true"></span>
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
    <div class="settings-row settings-row--stacked">
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
    <div class="settings-row settings-row--stacked">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Ernährungspräferenz</div>
      </div>
      <div class="settings-prefs settings-prefs--inline" role="group" aria-label="Ernährungspräferenz">
        ${chip('meat', 'Fleisch')}
        ${chip('fish', 'Fisch')}
        ${chip('vegetarian', 'Vegetarisch')}
      </div>
    </div>
  `;
}

// Kuechen-Praeferenzen pro Profil: Toggle-Chips (Asiatisch/Mediterran/Nahost/
// Amerikanisch). Im Dish-Picker wird die Union aller mitkochenden Profile
// als Vorauswahl genutzt, Reihenfolge nach Voter-Anzahl absteigend.
function renderCuisinesRow() {
  const cuisines = currentProfile.cuisines ?? {};
  const chip = (key, label) => `
    <button class="pref-chip" type="button" data-cuisine-toggle="${key}" aria-pressed="${!!cuisines[key]}">${label}</button>
  `;
  return `
    <div class="settings-row settings-row--stacked">
      <div class="settings-row__label">
        <div class="settings-row__label-primary">Küchen-Präferenz</div>
      </div>
      <div class="settings-prefs settings-prefs--inline" role="group" aria-label="Küchen-Präferenz">
        ${chip('asian', 'Asiatisch')}
        ${chip('mediterranean', 'Mediterran')}
        ${chip('middleEast', 'Nahost')}
        ${chip('americas', 'Amerikanisch')}
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

// Abendessen-Pill mit kcal-Range plus ein wertloser Slider drunter, der
// den Wert direkt uebersteuern kann. Genutzt fuer Standard- und User-Profil.
// Slider-Position folgt beim Rendern dem aktuellen dinnerTarget (Override
// oder berechnet). Sobald der User zieht, uebernimmt dinnerKcalOverride.
function renderUserDinnerField() {
  const dinner = dinnerTarget(currentProfile);
  const sliderVal = dinner ?? Math.round((DINNER_KCAL_MIN + DINNER_KCAL_MAX) / 2);
  return `
    <div class="settings-field">
      ${renderDinnerRow()}
      <input type="range" class="settings-slider"
             data-action="dinner-override-change"
             min="${DINNER_KCAL_MIN}" max="${DINNER_KCAL_MAX}" step="${MEAL_KCAL_STEP}" value="${sliderVal}"
             aria-label="Abendessen in Kilokalorien" />
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

// Loeschen-Button ganz unten. Verweigert:
//   - wenn nur ein einziges Profil uebrig waere
//   - wenn das Profil aktuell aktiv ist (User muss vorher ein anderes aktiv
//     setzen, entweder per D&D in Settings oder "Als aktiv setzen" hier oben)
function renderDeleteRow(isOnlyProfile, isActive) {
  const disabled = isOnlyProfile || isActive;
  let hint;
  if (isOnlyProfile) hint = 'Mindestens ein Profil muss bestehen bleiben.';
  else if (isActive) hint = 'Aktives Profil kann nicht gelöscht werden — vorher ein anderes aktiv setzen.';
  else hint = 'Das Profil wird entfernt. Favoriten und individuelle Werte gehen verloren.';
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

  // Reset-Button: setzt manuell ueberschriebene Werte zurueck auf die
  // Standard-Berechnung. Fuer Standard-Profil: Gender + Age auf Fabrik-Defaults,
  // dazu die abgeleiteten Biometrie-Werte. Fuer normale Profile: nur das
  // Tagesziel-Override (der einzige Slider-Wert der "berechnete Vorschlaege"
  // ueberschreibt) — Wizard-Werte fuer Biometrie/Meal bleiben.
  // Reset: setzt das Profil auf den Snapshot beim Sheet-Open zurueck. Damit
  // sind auch Wizard-Werte inkl. Fr/Mi/Overrides in ihrem Ausgangszustand.
  // Undo-Stack wird geleert (nach Reset kein sinnvolles "rueckgaengig" mehr).
  const resetBtn = rootEl.querySelector('[data-action="reset"]');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    restoreProfile(initialProfile);
    undoStack = [];
    renderShell();
    rootEl.querySelector('.profile-detail-overlay')?.classList.add('is-open');
    onExternalChange();
  });

  // Undo: setzt das Profil auf den letzten Snapshot zurueck (Snapshot vor
  // jeder Slider-/Chip-Aenderung). Bei leerem Stack disabled.
  const undoBtn = rootEl.querySelector('[data-action="undo"]');
  if (undoBtn) {
    undoBtn.disabled = undoStack.length === 0;
    undoBtn.addEventListener('click', () => {
      if (undoStack.length === 0) return;
      restoreProfile(undoStack.pop());
      renderShell();
      rootEl.querySelector('.profile-detail-overlay')?.classList.add('is-open');
      onExternalChange();
    });
  }

  // Aktives-Profil-Toggle: an → dieses Profil aktiv setzen; aus → nur wenn
  // mehr als ein Profil da ist (dann rueckt profiles[1] als neuer Aktiver
  // nach), sonst Toast. Re-render, damit der Aria-Zustand + evtl. weitere
  // Rows synchron sind.
  const activeToggle = rootEl.querySelector('[data-action="toggle-active"]');
  if (activeToggle) activeToggle.addEventListener('click', () => {
    const wasActive = state.settings.profiles[0]?.id === currentProfile.id;
    if (wasActive) {
      if (state.settings.profiles.length <= 1) {
        showToast('Mindestens ein Profil muss aktiv sein.');
        return;
      }
      // Naechstes Profil in der Reihenfolge aktiv setzen.
      const nextId = state.settings.profiles.find((p) => p.id !== currentProfile.id)?.id;
      if (nextId) setActiveProfileId(nextId);
    } else {
      setActiveProfileId(currentProfile.id);
    }
    onExternalChange();
    renderShell();
    rootEl.querySelector('.profile-detail-overlay')?.classList.add('is-open');
  });

  // Edit-in-Wizard: schliesst Detail-Sheet, oeffnet Wizard fuer dieses Profil.
  // Wizard schreibt beim Fertigstellen direkt in profiles[i].
  const editWizardBtn = rootEl.querySelector('[data-action="edit-in-wizard"]');
  if (editWizardBtn) editWizardBtn.addEventListener('click', () => {
    const id = currentProfile.id;
    closeProfileDetailSheet();
    openOnboardingWizard({ editProfileId: id });
  });

  // "Profil anlegen" im Standard-Profil-Sheet (nur sichtbar wenn noch kein
  // User-Profil existiert): schliesst Standard-Sheet, oeffnet Wizzard im
  // addProfile-Modus. Wizzard erstellt bei Fertig das erste User-Profil.
  const addFromDefaultBtn = rootEl.querySelector('[data-action="add-profile-from-default"]');
  if (addFromDefaultBtn) addFromDefaultBtn.addEventListener('click', () => {
    closeProfileDetailSheet();
    openOnboardingWizard({ addProfile: true });
  });

  // Name
  const nameInput = rootEl.querySelector('[data-action="name-change"]');
  if (nameInput) {
    nameInput.addEventListener('focus', pushUndo);
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
      pushUndo();
      markProfileChanged();
      currentProfile.gender = key;
      // Standard-Profil hat keine sichtbaren Height/Weight-Slider — wir setzen
      // sie auf Bevoelkerungs-Median je Geschlecht, damit die kcal-Berechnung
      // konsistente Standard-Werte liefert. Manuellen Dinner-Override clearen,
      // damit der Gender-Wechsel sichtbar wirkt.
      if (currentProfile.id === '_default') {
        applyDefaultBiometrics();
        currentProfile.dinnerKcalOverride = null;
      }
      rootEl.querySelectorAll('[data-gender]').forEach((o) => o.setAttribute('aria-pressed', String(o.dataset.gender === key)));
      updateDailyTargetFromProfile();
      updateDinnerDisplay();
      syncDinnerOverrideSlider();
      onExternalChange();
    });
  });

  // Pref-Chips (Diaet pro Profil)
  rootEl.querySelectorAll('[data-pref-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.prefToggle;
      pushUndo();
      markProfileChanged();
      if (!currentProfile.preferences) currentProfile.preferences = { meat: false, fish: false, vegetarian: false };
      currentProfile.preferences[key] = !currentProfile.preferences[key];
      btn.setAttribute('aria-pressed', String(!!currentProfile.preferences[key]));
      onExternalChange();
    });
  });

  // Cuisine-Chips (Kueche pro Profil)
  rootEl.querySelectorAll('[data-cuisine-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.cuisineToggle;
      pushUndo();
      markProfileChanged();
      if (!currentProfile.cuisines) currentProfile.cuisines = { asian: false, mediterranean: false, middleEast: false, americas: false };
      currentProfile.cuisines[key] = !currentProfile.cuisines[key];
      btn.setAttribute('aria-pressed', String(!!currentProfile.cuisines[key]));
      onExternalChange();
    });
  });

  // Goal-Chips
  rootEl.querySelectorAll('[data-goal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.goal;
      if (currentProfile.goal === key) return;
      pushUndo();
      markProfileChanged();
      currentProfile.goal = key;
      rootEl.querySelectorAll('[data-goal]').forEach((o) => o.setAttribute('aria-pressed', String(o.dataset.goal === key)));
      // Ziel aendert die kcal-Kalkulation — manuellen Dinner-Override clearen,
      // damit der neue Wert sichtbar wird, und Slider zur neuen Position ziehen.
      currentProfile.dinnerKcalOverride = null;
      updateDailyTargetFromProfile();
      updateDinnerDisplay();
      syncDinnerOverrideSlider();
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
    if (next === cur) return;
    pushUndo();
    markProfileChanged();
    currentProfile.age = next;
    ageValEl.textContent = String(next);
    if (ageMinus) ageMinus.disabled = next <= AGE_MIN;
    if (agePlus) agePlus.disabled = next >= AGE_MAX;
    // Standard-Profil: Alterswechsel soll die kcal-Kalkulation neu greifen
    // lassen, deshalb einen ggf. gesetzten Override aufheben.
    if (currentProfile.id === '_default') currentProfile.dinnerKcalOverride = null;
    updateDailyTargetFromProfile();
    updateDinnerDisplay();
    syncDinnerOverrideSlider();
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

  // Standard-Profil-Slider: uebersteuert Abendessen direkt via
  // dinnerKcalOverride. Keine sichtbare Wert-Anzeige — die Pill oben zeigt
  // den daraus abgeleiteten kcalRange.
  const dinnerOverrideSlider = rootEl.querySelector('[data-action="dinner-override-change"]');
  if (dinnerOverrideSlider) {
    dinnerOverrideSlider.addEventListener('pointerdown', pushUndo);
    dinnerOverrideSlider.addEventListener('input', () => {
      const v = parseInt(dinnerOverrideSlider.value, 10);
      currentProfile.dinnerKcalOverride = v;
      updateDinnerDisplay();
    });
    dinnerOverrideSlider.addEventListener('change', () => onExternalChange());
  }

  // Show-Bar-Switch
  const barBtn = rootEl.querySelector('[data-action="toggle-calorie-bar"]');
  if (barBtn) {
    barBtn.addEventListener('click', () => {
      pushUndo();
      const next = currentProfile.showCalorieBar === false;
      currentProfile.showCalorieBar = next;
      barBtn.setAttribute('aria-checked', String(next));
      onExternalChange();
    });
  }

  rootEl.querySelector('[data-action="share-profile"]')?.addEventListener('click', () => {
    openProfileShareSheet(currentProfile);
  });

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
  slider.addEventListener('pointerdown', () => { pushUndo(); markProfileChanged(); });
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value, 10);
    currentProfile[stateKey] = v;
    if (valEl) valEl.textContent = formatter(v);
    if (onFinalChange) onFinalChange();
    // Biometrie/Aktivitaet aendert die kcal-Kalkulation — manuellen
    // Dinner-Override clearen, damit der neue Wert sichtbar wird, und Slider
    // zur neuen Position nachziehen.
    currentProfile.dinnerKcalOverride = null;
    updateDinnerDisplay();
    syncDinnerOverrideSlider();
  });
  slider.addEventListener('change', () => onExternalChange());
}

function bindMealSlider(action, stateKey) {
  const slider = rootEl.querySelector(`[data-action="${action}-change"]`);
  const valEl = rootEl.querySelector(`[data-role="${action}-value"]`);
  if (!slider) return;
  slider.addEventListener('pointerdown', () => { pushUndo(); markProfileChanged(); });
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

// Standard-Profil-Slider auf den aktuellen dinnerTarget setzen. Wird nach
// Gender/Age-Wechsel gerufen, damit der Slider zur neuen Kalkulation
// nachrutscht (statt beim alten Override-Wert stehenzubleiben).
function syncDinnerOverrideSlider() {
  const s = rootEl?.querySelector('[data-action="dinner-override-change"]');
  if (!s) return;
  const val = dinnerTarget(currentProfile);
  if (val != null) s.value = String(val);
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
  const range = kcalRangeRounded(val);
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
