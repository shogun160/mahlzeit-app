import { state, saveState } from '../state.js';
import { AGE_MIN, AGE_MAX, dailyTarget } from '../nutrition/target.js';
import { renderStep1, renderStep2, renderStep3, renderStep4, DEFAULTS } from './steps.js';
import { renderStep5, refreshResultDynamic } from './result.js';

const TRANSITION_MS = 250;
const TOTAL_STEPS = 5;

let rootEl = null;
let onExternalChange = () => {};
let currentStep = 1;

// Draft hält die Werte, die der User im Wizard eingibt. Beim Öffnen aus dem
// aktuellen state.settings.profile pre-fillt. touched trackt pro Feld, ob der
// User es aktiv angefasst hat — nur touched-Werte werden bei "Fertig"/"Später"
// persistiert. Damit bleibt isProfileComplete() false wenn der User nur den
// stillen Default gesehen hat.
let draft = {};
let touched = {};

export function mountOnboardingWizard(el, { onChange } = {}) {
  rootEl = el;
  onExternalChange = onChange || (() => {});
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export function openOnboardingWizard() {
  if (!rootEl) throw new Error('Onboarding-Wizard nicht gemountet.');
  const p = state.settings.profile;
  draft = {
    name: p.name,
    gender: p.gender,
    age: p.age,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    activityLevel: p.activityLevel,
    goal: p.goal,
    breakfastKcal: p.breakfastKcal,
    lunchKcal: p.lunchKcal,
    dailyTargetOverride: p.dailyTargetOverride,
  };
  touched = {
    name: false, gender: false, age: false, heightCm: false, weightKg: false,
    activityLevel: false, goal: false, breakfastKcal: false, lunchKcal: false,
    dailyTargetOverride: false,
  };
  currentStep = 1;

  // onboardingSeen SOFORT setzen — auch bei App-Crash während Wizard nicht wieder
  // auto-triggern. saveState() persistiert das direkt.
  state.settings.onboardingSeen = true;
  saveState();

  renderShell();
  rootEl.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => rootEl.querySelector('.onboarding-overlay').classList.add('is-open'));
  });
  document.addEventListener('keydown', handleEsc);
}

export function closeOnboardingWizard() {
  if (!rootEl || rootEl.hidden) return;
  const overlay = rootEl.querySelector('.onboarding-overlay');
  if (overlay) overlay.classList.remove('is-open');
  document.removeEventListener('keydown', handleEsc);
  setTimeout(() => {
    if (rootEl && !rootEl.querySelector('.onboarding-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
    }
  }, TRANSITION_MS);
}

function handleEsc(ev) {
  if (ev.key === 'Escape') persistAndClose();
}

// Persistiert alle touched-Felder in state.settings.profile, ruft saveState() +
// onChange, schließt Sheet. Gemeinsame Endroutine für "Fertig", "Später" und
// Backdrop-Klick.
function persistAndClose() {
  const p = state.settings.profile;
  for (const key of Object.keys(touched)) {
    if (touched[key]) {
      p[key] = draft[key];
    }
  }
  saveState();
  onExternalChange();
  closeOnboardingWizard();
}

function renderShell() {
  const progressPct = (currentStep / TOTAL_STEPS) * 100;
  rootEl.innerHTML = `
    <div class="onboarding-overlay" data-role="backdrop">
      <div class="onboarding-sheet" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div class="onboarding-handle" aria-hidden="true"></div>
        <div class="onboarding-header">
          <div class="onboarding-header__row">
            <button class="onboarding-later" type="button" data-action="later">Später</button>
            <h2 class="onboarding-header__title" id="onboarding-title">Einrichtung</h2>
            <span class="onboarding-header__spacer" aria-hidden="true"></span>
          </div>
          <div class="onboarding-progress">
            <div class="onboarding-progress__label">Schritt ${currentStep} von ${TOTAL_STEPS}</div>
            <div class="onboarding-progress__track"
                 role="progressbar"
                 aria-valuemin="1"
                 aria-valuemax="${TOTAL_STEPS}"
                 aria-valuenow="${currentStep}">
              <div class="onboarding-progress__fill" style="width: ${progressPct}%"></div>
            </div>
          </div>
        </div>
        <div class="onboarding-body" data-role="step-slot">
          ${renderStepContent()}
        </div>
        <div class="onboarding-footer" data-role="footer-slot">
          ${renderFooter()}
        </div>
      </div>
    </div>
  `;
  attachShellHandlers();
}

function renderStepContent() {
  switch (currentStep) {
    case 1: return renderStep1(draft);
    case 2: return renderStep2(draft);
    case 3: return renderStep3(draft);
    case 4: return renderStep4(draft);
    case 5: return renderStep5(draft);
    default: return `<p class="onboarding-placeholder">Step ${currentStep}</p>`;
  }
}

function renderFooter() {
  const isFirst = currentStep === 1;
  const isLast = currentStep === TOTAL_STEPS;
  const primaryLabel = isLast ? 'Fertig' : 'Weiter';
  const primaryAction = isLast ? 'finish' : 'next';
  const back = isFirst
    ? '<span class="onboarding-footer__spacer" aria-hidden="true"></span>'
    : `<button class="onboarding-btn onboarding-btn--tertiary" type="button" data-action="back">Zurück</button>`;
  return `
    ${back}
    <button class="onboarding-btn onboarding-btn--primary" type="button" data-action="${primaryAction}">${primaryLabel}</button>
  `;
}

function attachShellHandlers() {
  const overlay = rootEl.querySelector('[data-role="backdrop"]');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) persistAndClose();
  });
  rootEl.querySelector('[data-action="later"]').addEventListener('click', persistAndClose);

  const nextBtn = rootEl.querySelector('[data-action="next"]');
  if (nextBtn) nextBtn.addEventListener('click', goNext);
  const backBtn = rootEl.querySelector('[data-action="back"]');
  if (backBtn) backBtn.addEventListener('click', goBack);
  const finishBtn = rootEl.querySelector('[data-action="finish"]');
  if (finishBtn) finishBtn.addEventListener('click', persistAndClose);

  attachStepHandlers();
}

function goNext() {
  if (currentStep < TOTAL_STEPS) {
    currentStep++;
    renderShell();
  }
}

function goBack() {
  if (currentStep > 1) {
    currentStep--;
    renderShell();
  }
}

function attachStepHandlers() {
  if (currentStep === 1) attachStep1Handlers();
  if (currentStep === 2) attachStep2Handlers();
  if (currentStep === 3) attachStep3Handlers();
  if (currentStep === 4) attachStep4Handlers();
  if (currentStep === 5) attachStep5Handlers();
}

function attachStep5Handlers() {
  const slider = rootEl.querySelector('[data-action="target-change"]');
  if (slider) {
    slider.addEventListener('input', () => {
      draft.dailyTargetOverride = parseInt(slider.value, 10);
      touched.dailyTargetOverride = true;
      refreshResultDynamic(rootEl, draft);
    });
  }
  const resetBtn = rootEl.querySelector('[data-action="target-reset"]');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      draft.dailyTargetOverride = null;
      touched.dailyTargetOverride = true;
      // Slider zurück auf berechneten Vorschlag setzen — gleiche resolvedProfile-
      // Logik wie in result.js (Draft-Werte oder Fallbacks aus DEFAULTS).
      if (slider) {
        const p = state.settings.profile;
        const fake = {
          gender:        draft.gender        ?? p.gender        ?? DEFAULTS.gender,
          age:           draft.age           ?? p.age           ?? DEFAULTS.age,
          heightCm:      draft.heightCm      ?? p.heightCm      ?? DEFAULTS.heightCm,
          weightKg:      draft.weightKg      ?? p.weightKg      ?? DEFAULTS.weightKg,
          activityLevel: draft.activityLevel ?? p.activityLevel ?? DEFAULTS.activityLevel,
          goal:          draft.goal          ?? p.goal          ?? DEFAULTS.goal,
        };
        const s = dailyTarget(fake);
        if (s != null) slider.value = String(s);
      }
      refreshResultDynamic(rootEl, draft);
    });
  }
}

function attachStep4Handlers() {
  const fmt = (v) => `${v.toLocaleString('de-DE')} kcal`;
  bindSlider('breakfast-change', 'breakfast-value', 'breakfastKcal', fmt);
  bindSlider('lunch-change', 'lunch-value', 'lunchKcal', fmt);
}

function attachStep3Handlers() {
  bindChipGroup('activity-pick', 'activityLevel', (v) => parseInt(v, 10));
  bindChipGroup('goal-pick', 'goal', (v) => v);
}

// Chip-Binding-Helper: Klick setzt Draft + touched, aktualisiert aria-pressed
// aller Chips in der Gruppe. parser konvertiert data-value (String) in den
// Draft-Typ (number für activityLevel, string für goal).
function bindChipGroup(action, draftKey, parser) {
  rootEl.querySelectorAll(`[data-action="${action}"]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = parser(btn.dataset.value);
      draft[draftKey] = val;
      touched[draftKey] = true;
      rootEl.querySelectorAll(`[data-action="${action}"]`).forEach((other) => {
        other.setAttribute('aria-pressed', String(parser(other.dataset.value) === val));
      });
    });
  });
}

function attachStep2Handlers() {
  bindSlider('height-change', 'height-value', 'heightCm', (v) => `${v} cm`);
  bindSlider('weight-change', 'weight-value', 'weightKg', (v) => `${v} kg`);
}

// Slider-Binding-Helper: setzt Draft + touched auf input, aktualisiert Value-
// Label live. Wird auch in Tasks 8 und 9 verwendet.
function bindSlider(action, valueRole, draftKey, formatter) {
  const slider = rootEl.querySelector(`[data-action="${action}"]`);
  const valEl = rootEl.querySelector(`[data-role="${valueRole}"]`);
  if (!slider) return;
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value, 10);
    draft[draftKey] = v;
    touched[draftKey] = true;
    if (valEl) valEl.textContent = formatter(v);
  });
}

function attachStep1Handlers() {
  // Name — touched sobald Input-Event feuert (auch bei leerem String).
  const nameInput = rootEl.querySelector('[data-action="name-change"]');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const v = nameInput.value.trim();
      draft.name = v === '' ? null : v;
      touched.name = true;
    });
  }

  // Geschlecht-Chips — touched sobald aktiver Klick.
  rootEl.querySelectorAll('[data-action="gender-pick"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value;
      draft.gender = val;
      touched.gender = true;
      rootEl.querySelectorAll('[data-action="gender-pick"]').forEach((other) => {
        other.setAttribute('aria-pressed', String(other.dataset.value === val));
      });
    });
  });

  // Alter-Stepper — touched sobald Klick, Draft aus Default seeden falls null.
  const ageMinus = rootEl.querySelector('[data-action="age-minus"]');
  const agePlus = rootEl.querySelector('[data-action="age-plus"]');
  const ageValEl = rootEl.querySelector('[data-role="age-value"]');
  const changeAge = (delta) => {
    const current = draft.age ?? DEFAULTS.age;
    const next = Math.max(AGE_MIN, Math.min(AGE_MAX, current + delta));
    draft.age = next;
    touched.age = true;
    if (ageValEl) ageValEl.textContent = String(next);
    if (ageMinus) ageMinus.disabled = next <= AGE_MIN;
    if (agePlus) agePlus.disabled = next >= AGE_MAX;
  };
  if (ageMinus) ageMinus.addEventListener('click', () => changeAge(-1));
  if (agePlus) agePlus.addEventListener('click', () => changeAge(+1));
}
