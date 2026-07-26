import { AGE_MIN, AGE_MAX, ACTIVITY_LEVELS, GOALS } from '../nutrition/target.js';

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

// Step 1: Über dich — Name (optional) + Geschlecht (Chips) + Alter (Stepper) +
// Größe + Gewicht (Slider). Handler in wizard.js/attachStep1Handlers nutzen
// bindSlider-Helper für die zwei Slider am Ende.
export function renderStep1(draft) {
  const nameVal = draft.name ?? '';
  const genderVal = draft.gender ?? DEFAULTS.gender;
  const ageVal = draft.age ?? DEFAULTS.age;
  const ageMinusDisabled = ageVal <= AGE_MIN;
  const agePlusDisabled = ageVal >= AGE_MAX;
  const heightVal = draft.heightCm ?? DEFAULTS.heightCm;
  const weightVal = draft.weightKg ?? DEFAULTS.weightKg;
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

    <div class="onboarding-field">
      <div class="onboarding-field__row">
        <div class="onboarding-field__label">Größe</div>
        <div class="onboarding-field__value" data-role="height-value">${heightVal} cm</div>
      </div>
      <input class="settings-slider"
             type="range"
             min="140"
             max="220"
             step="1"
             value="${heightVal}"
             data-action="height-change"
             aria-label="Größe in Zentimetern" />
    </div>

    <div class="onboarding-field">
      <div class="onboarding-field__row">
        <div class="onboarding-field__label">Gewicht</div>
        <div class="onboarding-field__value" data-role="weight-value">${weightVal} kg</div>
      </div>
      <input class="settings-slider"
             type="range"
             min="40"
             max="200"
             step="1"
             value="${weightVal}"
             data-action="weight-change"
             aria-label="Gewicht in Kilogramm" />
    </div>
  `;
}

// Step 2: Alltag — Aktivität (Chips) + Ziel (Chips) + Frühstück + Mittag (Slider).
// Handler in wizard.js/attachStep2Handlers nutzen bindChipGroup + bindSlider.
export function renderStep2(draft) {
  const activityVal = draft.activityLevel ?? DEFAULTS.activityLevel;
  const goalVal = draft.goal ?? DEFAULTS.goal;
  const breakfastVal = draft.breakfastKcal ?? DEFAULTS.breakfastKcal;
  const lunchVal = draft.lunchKcal ?? DEFAULTS.lunchKcal;
  return `
    <h3 class="onboarding-step__title">Alltag</h3>
    <p class="onboarding-step__desc">Wie aktiv bist du und wie verteilst du deine Mahlzeiten?</p>

    <div class="onboarding-field">
      <div class="onboarding-field__label">Aktivität</div>
      <div class="onboarding-chips onboarding-chips--nowrap" role="group" aria-label="Aktivitätslevel">
        ${ACTIVITY_LEVELS.map((a) => `
          <button class="pref-chip" type="button" data-action="activity-pick" data-value="${a.level}" aria-pressed="${activityVal === a.level}">${a.label}</button>
        `).join('')}
      </div>
    </div>

    <div class="onboarding-field">
      <div class="onboarding-field__label">Ziel</div>
      <div class="onboarding-chips" role="group" aria-label="Ziel">
        ${GOALS.map((g) => `
          <button class="pref-chip" type="button" data-action="goal-pick" data-value="${g.key}" aria-pressed="${goalVal === g.key}">${g.label}</button>
        `).join('')}
      </div>
    </div>

    <div class="onboarding-field">
      <div class="onboarding-field__row">
        <div class="onboarding-field__label">Frühstück</div>
        <div class="onboarding-field__value" data-role="breakfast-value">${breakfastVal.toLocaleString('de-DE')} kcal</div>
      </div>
      <input class="settings-slider"
             type="range"
             min="100"
             max="1000"
             step="10"
             value="${breakfastVal}"
             data-action="breakfast-change"
             aria-label="Frühstück-Kalorien" />
    </div>

    <div class="onboarding-field">
      <div class="onboarding-field__row">
        <div class="onboarding-field__label">Mittag</div>
        <div class="onboarding-field__value" data-role="lunch-value">${lunchVal.toLocaleString('de-DE')} kcal</div>
      </div>
      <input class="settings-slider"
             type="range"
             min="100"
             max="1000"
             step="10"
             value="${lunchVal}"
             data-action="lunch-change"
             aria-label="Mittag-Kalorien" />
    </div>
  `;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
