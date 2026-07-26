import { state, saveState } from '../state.js';
import { AGE_MIN, AGE_MAX, dailyTarget } from '../nutrition/target.js';
import { renderStep1, renderStep2, renderStep3, DEFAULTS } from './steps.js';
import { renderStep5 as renderStep4, refreshResultDynamic } from './result.js';

const TRANSITION_MS = 250;
const TOTAL_STEPS = 4;

let rootEl = null;
let onExternalChange = () => {};
let currentStep = 1;
// Trackt ob das Sheet gerade offen ist — wichtig, damit renderShell() bei
// Re-Renders (goNext/goBack) die .is-open-Klasse direkt ins HTML nimmt und
// das Sheet nicht kurz weg-slidet.
let isOpen = false;

// Draft hält die Werte, die der User im Wizard eingibt. Beim Öffnen aus dem
// aktuellen state.settings.profile pre-fillt. touched trackt pro Feld, ob der
// User es aktiv angefasst hat — nur touched-Werte werden bei "Überspringen"
// persistiert. "Fertig" committet alles inkl. stiller Defaults.
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
    requestAnimationFrame(() => {
      isOpen = true;
      const overlay = rootEl.querySelector('.onboarding-overlay');
      if (overlay) overlay.classList.add('is-open');
    });
  });
  document.addEventListener('keydown', handleEsc);
}

export function closeOnboardingWizard() {
  if (!rootEl || rootEl.hidden) return;
  isOpen = false;
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

// Persistiert nur touched-Felder in state.settings.profile. Endroutine für
// "Überspringen" und Backdrop-Klick — der User hat den Wizard nicht bewusst
// abgeschlossen, deshalb bleiben stille Defaults null (Placeholder-Pille zeigt
// die unvollständige Einrichtung im Dashboard).
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

// Persistiert alle Draft-Werte. Endroutine für "Fertig" — der User hat den
// Wizard bewusst durchlaufen und die stillen Defaults durch Weiter-Klicken
// bestätigt. Null-Slots werden aus DEFAULTS gefüllt. Name und
// dailyTargetOverride bleiben optional (dürfen null sein).
function finishAndClose() {
  const p = state.settings.profile;
  for (const key of Object.keys(draft)) {
    if (key === 'name' || key === 'dailyTargetOverride') {
      p[key] = draft[key];
    } else {
      p[key] = draft[key] ?? DEFAULTS[key];
    }
  }
  saveState();
  onExternalChange();
  closeOnboardingWizard();
}

function renderShell() {
  const progressPct = (currentStep / TOTAL_STEPS) * 100;
  // isOpen ist true bei Re-Renders aus goNext/goBack — dann die Klasse direkt
  // ins HTML, sonst würde das Sheet zwischen den Steps weg-sliden.
  const openCls = isOpen ? ' is-open' : '';
  rootEl.innerHTML = `
    <div class="onboarding-overlay${openCls}" data-role="backdrop">
      <div class="onboarding-sheet" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div class="onboarding-handle" aria-hidden="true"></div>
        <div class="onboarding-header">
          <h2 class="onboarding-header__title" id="onboarding-title">Einrichtung</h2>
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
    case 3: return renderStep3(state.settings);
    case 4: return renderStep4(draft);
    default: return `<p class="onboarding-placeholder">Step ${currentStep}</p>`;
  }
}

function renderFooter() {
  const isFirst = currentStep === 1;
  const isLast = currentStep === TOTAL_STEPS;
  const primaryLabel = isLast ? 'Fertig' : 'Weiter';
  const primaryAction = isLast ? 'finish' : 'next';
  // Auf Seite 1 statt Zurück ein "Überspringen"-Button (schließt den Wizard mit
  // persistAndClose — nur touched-Felder werden persistiert). Ab Seite 2 der
  // gewöhnliche Zurück-Button.
  const leftBtn = isFirst
    ? `<button class="onboarding-btn onboarding-btn--tertiary" type="button" data-action="skip">Überspringen</button>`
    : `<button class="onboarding-btn onboarding-btn--tertiary" type="button" data-action="back">Zurück</button>`;
  return `
    ${leftBtn}
    <button class="onboarding-btn onboarding-btn--primary" type="button" data-action="${primaryAction}">${primaryLabel}</button>
  `;
}

function attachShellHandlers() {
  const overlay = rootEl.querySelector('[data-role="backdrop"]');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) persistAndClose();
  });

  const skipBtn = rootEl.querySelector('[data-action="skip"]');
  if (skipBtn) skipBtn.addEventListener('click', persistAndClose);
  const nextBtn = rootEl.querySelector('[data-action="next"]');
  if (nextBtn) nextBtn.addEventListener('click', goNext);
  const backBtn = rootEl.querySelector('[data-action="back"]');
  if (backBtn) backBtn.addEventListener('click', goBack);
  const finishBtn = rootEl.querySelector('[data-action="finish"]');
  if (finishBtn) finishBtn.addEventListener('click', finishAndClose);

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
}

// Step 1 (Über dich) — Name + Geschlecht + Alter + Größe + Gewicht.
function attachStep1Handlers() {
  const nameInput = rootEl.querySelector('[data-action="name-change"]');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const v = nameInput.value.trim();
      draft.name = v === '' ? null : v;
      touched.name = true;
    });
  }

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

  bindSlider('height-change', 'height-value', 'heightCm', (v) => `${v} cm`);
  bindSlider('weight-change', 'weight-value', 'weightKg', (v) => `${v} kg`);
}

// Step 2 (Alltag) — Aktivität + Ziel + Frühstück + Mittag.
function attachStep2Handlers() {
  bindChipGroup('activity-pick', 'activityLevel', (v) => parseInt(v, 10));
  bindChipGroup('goal-pick', 'goal', (v) => v);
  const fmt = (v) => `${v.toLocaleString('de-DE')} kcal`;
  bindSlider('breakfast-change', 'breakfast-value', 'breakfastKcal', fmt);
  bindSlider('lunch-change', 'lunch-value', 'lunchKcal', fmt);
}

// Step 3 (Filter) — Ernährungs- + Küchen-Präferenzen als Toggle-Chips.
// Ändern direkt state.settings.preferences/cuisines (kein Draft), analog
// zum Settings-Sheet. saveState wird beim Persistieren am Ende gerufen.
function attachStep3Handlers() {
  bindToggleChips('pref-toggle', 'preferences');
  bindToggleChips('cuisine-toggle', 'cuisines');
}

function bindToggleChips(action, bucketKey) {
  rootEl.querySelectorAll(`[data-action="${action}"]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.value;
      const bucket = state.settings[bucketKey];
      if (!bucket) return;
      bucket[key] = !bucket[key];
      btn.setAttribute('aria-pressed', String(!!bucket[key]));
    });
  });
}

// Step 4 (Ergebnis) — Tagesbedarf-Slider + Refresh.
function attachStep4Handlers() {
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

// Chip-Binding-Helper: Klick setzt Draft + touched, aktualisiert aria-pressed.
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

// Slider-Binding-Helper: setzt Draft + touched auf input, aktualisiert Value-
// Label live.
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
