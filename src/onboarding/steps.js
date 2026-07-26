import { AGE_MIN, AGE_MAX, ACTIVITY_LEVELS, GOALS } from '../nutrition/target.js';
import { PORTIONS_MIN, PORTIONS_MAX, getActiveProfile } from '../state.js';

// Stille Defaults — werden im Wizard angezeigt wenn Draft-Wert null ist. Der
// User sieht sinnvolle Startwerte, muss aber aktiv klicken/ziehen, damit das
// Feld als touched zählt und persistiert wird. Sonst bleibt isProfileComplete()
// nach "Später" false und die Placeholder-Pille sichtbar.
export const DEFAULTS = {
  gender: 'male',
  age: 40,
  heightCm: 180,
  weightKg: 80,
  defaultPortions: 1,
  activityLevel: 3,
  goal: 'maintain',
  breakfastKcal: 400,
  lunchKcal: 700,
};

// Step 1: Über dich — Name (optional) + Geschlecht (Chips) + Alter (Stepper) +
// Größe + Gewicht (Slider). Handler in wizard.js/attachStep1Handlers nutzen
// bindSlider-Helper für die zwei Slider am Ende.
//
// options.isSubProfile blendet den Personen-Slider aus (defaultPortions ist
// globales Setting, nicht per Profil — im 2..N-Wizard sinnlos).
export function renderStep1(draft, { isSubProfile = false } = {}) {
  const nameVal = draft.name ?? '';
  const genderVal = draft.gender ?? DEFAULTS.gender;
  const ageVal = draft.age ?? DEFAULTS.age;
  const ageMinusDisabled = ageVal <= AGE_MIN;
  const agePlusDisabled = ageVal >= AGE_MAX;
  const heightVal = draft.heightCm ?? DEFAULTS.heightCm;
  const weightVal = draft.weightKg ?? DEFAULTS.weightKg;
  const portionsVal = draft.defaultPortions ?? DEFAULTS.defaultPortions;
  const portionsLabel = `${portionsVal} ${portionsVal === 1 ? 'Person' : 'Personen'}`;
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

    ${isSubProfile ? '' : `
    <div class="onboarding-field">
      <div class="onboarding-field__row">
        <div class="onboarding-field__label">Für wie viele kochst du?</div>
        <div class="onboarding-field__value" data-role="portions-value">${portionsLabel}</div>
      </div>
      <input class="settings-slider"
             type="range"
             min="${PORTIONS_MIN}"
             max="${PORTIONS_MAX}"
             step="1"
             value="${portionsVal}"
             data-action="portions-change"
             aria-label="Anzahl Personen im Haushalt" />
    </div>
    `}
  `;
}

// Step 2: Alltag — Aktivität (Chips) + Ziel (Chips) + Frühstück + Mittag (Slider).
// Handler in wizard.js/attachStep2Handlers nutzen bindChipGroup + bindSlider.
export function renderStep2(draft) {
  const activityVal = draft.activityLevel ?? DEFAULTS.activityLevel;
  const activityLabel = ACTIVITY_LEVELS.find((a) => a.level === activityVal)?.label ?? '—';
  const goalVal = draft.goal ?? DEFAULTS.goal;
  const breakfastVal = draft.breakfastKcal ?? DEFAULTS.breakfastKcal;
  const lunchVal = draft.lunchKcal ?? DEFAULTS.lunchKcal;
  return `
    <h3 class="onboarding-step__title">Alltag</h3>
    <p class="onboarding-step__desc">Wie aktiv bist du und wie verteilst du deine Mahlzeiten?</p>

    <div class="onboarding-field">
      <div class="onboarding-field__row">
        <div class="onboarding-field__label">Aktivität</div>
        <div class="onboarding-field__value" data-role="activity-value">${activityLabel}</div>
      </div>
      <input class="settings-slider"
             type="range"
             min="1"
             max="${ACTIVITY_LEVELS.length}"
             step="1"
             value="${activityVal}"
             data-action="activity-change"
             aria-label="Aktivitätslevel" />
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

    <div class="onboarding-preview" data-role="dinner-preview">
      Dein Abendessenkontingent: <span data-role="dinner-preview-value">—</span>
    </div>
  `;
}

// Step 3: Filter — Ernährungspräferenzen (Fleisch/Fisch/Vegetarisch) +
// Küchen-Präferenzen (Asiatisch/Mediterran/Nahost/Amerikanisch) + Makro-
// Verteilung (Ausgewogen/Proteinreich/Kohlenhydratarm/Fettarm). Toggle-Chips
// analog Settings-Sheet. Anders als profile-Slots kein Draft — Booleans und
// macroPreset ändern sich direkt im State beim Klick.
export function renderStep3(profile) {
  // Prefs + Cuisines liegen jetzt pro Profil. Der Wizard uebergibt das
  // gerade editierte Profil — bei User 1 = getActiveProfile(), bei
  // Sub-Wizards = das jeweils neu angelegte Profil.
  const p = profile ?? getActiveProfile();
  const prefs = p?.preferences ?? {};
  const cuisines = p?.cuisines ?? {};
  const macroPreset = p?.macroPreset ?? 'balanced';
  const isCustomMacros = p?.macroTargets != null;
  // Presets exklusiv im Wizard; wenn User im Makro-Popup einen Custom-Override
  // gesetzt hat, ist kein Chip aktiv (aria-pressed=false auf allen).
  const activePreset = isCustomMacros ? null : macroPreset;
  const macroChip = (key, label) => `
    <button class="pref-chip" type="button" data-action="macro-preset" data-value="${key}" aria-pressed="${activePreset === key}">${label}</button>
  `;
  return `
    <h3 class="onboarding-step__title">Filter</h3>
    <p class="onboarding-step__desc">Optional — was soll bei den Vorschlägen berücksichtigt werden?</p>

    <div class="onboarding-field">
      <div class="onboarding-field__label">Ernährungspräferenzen</div>
      <div class="onboarding-chips" role="group" aria-label="Ernährungspräferenzen">
        <button class="pref-chip" type="button" data-action="pref-toggle" data-value="meat" aria-pressed="${!!prefs.meat}">Fleisch</button>
        <button class="pref-chip" type="button" data-action="pref-toggle" data-value="fish" aria-pressed="${!!prefs.fish}">Fisch</button>
        <button class="pref-chip" type="button" data-action="pref-toggle" data-value="vegetarian" aria-pressed="${!!prefs.vegetarian}">Vegetarisch</button>
      </div>
    </div>

    <div class="onboarding-field">
      <div class="onboarding-field__label">Küchen-Präferenzen</div>
      <div class="onboarding-chips" role="group" aria-label="Küchen-Präferenzen">
        <button class="pref-chip" type="button" data-action="cuisine-toggle" data-value="asian" aria-pressed="${!!cuisines.asian}">Asiatisch</button>
        <button class="pref-chip" type="button" data-action="cuisine-toggle" data-value="mediterranean" aria-pressed="${!!cuisines.mediterranean}">Mediterran</button>
        <button class="pref-chip" type="button" data-action="cuisine-toggle" data-value="middleEast" aria-pressed="${!!cuisines.middleEast}">Nahost</button>
        <button class="pref-chip" type="button" data-action="cuisine-toggle" data-value="americas" aria-pressed="${!!cuisines.americas}">Amerikanisch</button>
      </div>
    </div>

    <div class="onboarding-field">
      <div class="onboarding-field__label">Makro-Verteilung</div>
      <div class="onboarding-chips" role="group" aria-label="Makro-Verteilung">
        ${macroChip('balanced', 'Ausgewogen')}
        ${macroChip('protein',  'Proteinreich')}
        ${macroChip('lowcarb',  'Kohlenhydratarm')}
        ${macroChip('lowfat',   'Fettarm')}
      </div>
      <div data-role="macro-preview-slot"></div>
    </div>
  `;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
