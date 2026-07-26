import { state, saveState } from '../state.js';

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
          <p class="onboarding-placeholder">Step ${currentStep}</p>
        </div>
        <div class="onboarding-footer" data-role="footer-slot">
        </div>
      </div>
    </div>
  `;
  attachShellHandlers();
}

function attachShellHandlers() {
  const overlay = rootEl.querySelector('[data-role="backdrop"]');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) persistAndClose();
  });
  rootEl.querySelector('[data-action="later"]').addEventListener('click', persistAndClose);
}
