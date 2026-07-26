import { AGE_MIN, AGE_MAX } from '../nutrition/target.js';

// Stille Defaults — werden im Wizard angezeigt wenn Draft-Wert null ist. Der
// User sieht sinnvolle Startwerte, muss aber aktiv klicken/ziehen, damit das
// Feld als touched zählt und persistiert wird. Sonst bleibt isProfileComplete()
// nach "Später" false und die Placeholder-Pille sichtbar.
export const DEFAULTS = {
  gender: 'male',
  age: 40,
  heightCm: 180,
  weightKg: 80,
  activityLevel: 3,
  goal: 'maintain',
  breakfastKcal: 400,
  lunchKcal: 700,
};

// Step 1: Über dich — Name (optional Text-Input) + Geschlecht (2 Chips) + Alter
// (Stepper). Draft-Werte aus dem übergebenen draft-Object; Chip-Aktive-States
// über aria-pressed. Handler in wizard.js/attachStep1Handlers.
export function renderStep1(draft) {
  const nameVal = draft.name ?? '';
  const genderVal = draft.gender ?? DEFAULTS.gender;
  const ageVal = draft.age ?? DEFAULTS.age;
  const ageMinusDisabled = ageVal <= AGE_MIN;
  const agePlusDisabled = ageVal >= AGE_MAX;
  return `
    <h3 class="onboarding-step__title">Über dich</h3>
    <p class="onboarding-step__desc">Damit wir deinen täglichen Kalorienbedarf berechnen können.</p>

    <div class="onboarding-field">
      <label class="onboarding-field__label" for="onb-name">Wie sollen wir dich nennen?</label>
      <input class="onboarding-input"
             id="onb-name"
             type="text"
             maxlength="30"
             value="${escapeAttr(nameVal)}"
             placeholder="Dein Name (optional)"
             data-action="name-change" />
    </div>

    <div class="onboarding-field">
      <div class="onboarding-field__label">Geschlecht</div>
      <div class="onboarding-chips" role="group" aria-label="Geschlecht">
        <button class="pref-chip" type="button" data-action="gender-pick" data-value="female" aria-pressed="${genderVal === 'female'}">Weiblich</button>
        <button class="pref-chip" type="button" data-action="gender-pick" data-value="male" aria-pressed="${genderVal === 'male'}">Männlich</button>
      </div>
    </div>

    <div class="onboarding-field">
      <div class="onboarding-field__row">
        <div class="onboarding-field__label">Alter</div>
        <div class="stepper stepper--compact" role="group" aria-label="Alter">
          <button class="stepper__btn" type="button" data-action="age-minus" aria-label="Weniger" ${ageMinusDisabled ? 'disabled' : ''}>−</button>
          <span class="stepper__value" data-role="age-value">${ageVal}</span>
          <button class="stepper__btn" type="button" data-action="age-plus" aria-label="Mehr" ${agePlusDisabled ? 'disabled' : ''}>+</button>
        </div>
      </div>
    </div>
  `;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
