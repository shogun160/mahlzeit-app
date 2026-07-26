import { state, saveState } from '../state.js';
import { AGE_MIN, AGE_MAX } from '../nutrition/target.js';
import { renderStep1, DEFAULTS } from './steps.js';

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
    // Steps 2–5 folgen in Tasks 6–9
    default: return `<p class="onboarding-placeholder">Step ${currentStep} — Content folgt.</p>`;
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
  // Steps 2–5 folgen in Tasks 6–9
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
