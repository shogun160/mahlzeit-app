import {
  dailyTarget,
  effectiveDailyTarget,
  dinnerTarget,
  MACRO_PRESETS,
  MACRO_PRESET_DEFAULT,
} from '../nutrition/target.js';
import { state } from '../state.js';
import { DEFAULTS } from './steps.js';

const ICON_REFRESH = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;

// Baut ein temporäres Profile-Object aus draft (mit Defaults für nicht-touched
// Felder), damit dailyTarget()/dinnerTarget() rechnen können auch wenn der
// User vorherige Steps übersprungen hat. Fallbacks aus DEFAULTS greifen für
// Slots die noch null sind.
function resolvedProfile(draft) {
  const p = state.settings.profile;
  return {
    gender:               draft.gender        ?? p.gender        ?? DEFAULTS.gender,
    age:                  draft.age           ?? p.age           ?? DEFAULTS.age,
    heightCm:             draft.heightCm      ?? p.heightCm      ?? DEFAULTS.heightCm,
    weightKg:             draft.weightKg      ?? p.weightKg      ?? DEFAULTS.weightKg,
    activityLevel:        draft.activityLevel ?? p.activityLevel ?? DEFAULTS.activityLevel,
    goal:                 draft.goal          ?? p.goal          ?? DEFAULTS.goal,
    breakfastKcal:        draft.breakfastKcal ?? p.breakfastKcal ?? DEFAULTS.breakfastKcal,
    lunchKcal:            draft.lunchKcal     ?? p.lunchKcal     ?? DEFAULTS.lunchKcal,
    dailyTargetOverride:  draft.dailyTargetOverride ?? null,
    macroPreset:          p.macroPreset ?? MACRO_PRESET_DEFAULT,
    macroTargets:         null, // Ergebnis nutzt immer das Preset
  };
}

// Skaliert Preset (P/KH/F Prozente) auf gegebene Dinner-kcal. Rundet auf
// ganze Gramm für die Anzeige.
function macrosForKcal(kcalTarget, presetKey) {
  const preset = MACRO_PRESETS.find((m) => m.key === presetKey) ?? MACRO_PRESETS[0];
  return {
    p:  Math.round((kcalTarget * (preset.p  / 100)) / 4),
    kh: Math.round((kcalTarget * (preset.kh / 100)) / 4),
    f:  Math.round((kcalTarget * (preset.f  / 100)) / 9),
    kcal: Math.round(kcalTarget),
  };
}

export function renderStep5(draft) {
  const p = resolvedProfile(draft);
  const suggestion = dailyTarget(p);          // ohne Override — als Referenzwert
  const effective = effectiveDailyTarget(p);  // mit Override falls gesetzt
  const dinner = dinnerTarget(p);
  const isOverride = draft.dailyTargetOverride != null && draft.dailyTargetOverride !== suggestion;
  const macros = dinner != null ? macrosForKcal(dinner, p.macroPreset) : null;
  const nameGreeting = draft.name ? `, ${draft.name}` : '';
  const fmt = (n) => n == null ? '—' : n.toLocaleString('de-DE');
  const sliderVal = effective ?? 2000;
  return `
    <h3 class="onboarding-step__title">Fertig${nameGreeting}.</h3>
    <p class="onboarding-step__desc">Dein Bedarf ist bereit.</p>

    <div class="onboarding-result__card onboarding-result__card--primary">
      <div class="onboarding-result__card-header">
        <span class="onboarding-result__label">Tages-Bedarf</span>
        <button class="settings-refresh"
                type="button"
                data-action="target-reset"
                data-role="target-reset"
                ${isOverride ? '' : 'hidden'}
                aria-label="Vorschlag wiederherstellen">
          ${ICON_REFRESH}
        </button>
      </div>
      <div class="onboarding-result__value onboarding-result__value--big" data-role="target-value">${fmt(effective)} kcal</div>
      <input class="settings-slider"
             type="range"
             min="1000"
             max="4000"
             step="50"
             value="${sliderVal}"
             data-action="target-change"
             aria-label="Tageskalorien-Ziel" />
      <div class="onboarding-result__suggestion" data-role="target-suggestion" ${isOverride ? '' : 'hidden'}>
        Vorschlag: ${fmt(suggestion)} kcal
      </div>
    </div>

    <div class="onboarding-result__row">
      <div class="onboarding-result__card">
        <div class="onboarding-result__label">Frühstück</div>
        <div class="onboarding-result__value">${fmt(draft.breakfastKcal ?? DEFAULTS.breakfastKcal)} kcal</div>
      </div>
      <div class="onboarding-result__card">
        <div class="onboarding-result__label">Mittag</div>
        <div class="onboarding-result__value">${fmt(draft.lunchKcal ?? DEFAULTS.lunchKcal)} kcal</div>
      </div>
    </div>

    <div class="onboarding-result__card onboarding-result__card--accent">
      <div class="onboarding-result__label">Abendessen</div>
      <div class="onboarding-result__value onboarding-result__value--big" data-role="dinner-value">${fmt(dinner)} kcal</div>
    </div>

    ${macros ? `
      <div class="onboarding-result__macros" data-role="macros-slot">
        ${renderMacros(macros)}
      </div>
    ` : ''}

    <p class="onboarding-result__note">Du kannst alle Werte später in den Einstellungen anpassen.</p>
  `;
}

function renderMacros(macros) {
  return `
    <div class="onboarding-macro"><span class="onboarding-macro__key onboarding-macro__key--p">P</span><span>${macros.p} g</span></div>
    <div class="onboarding-macro"><span class="onboarding-macro__key onboarding-macro__key--kh">KH</span><span>${macros.kh} g</span></div>
    <div class="onboarding-macro"><span class="onboarding-macro__key onboarding-macro__key--f">F</span><span>${macros.f} g</span></div>
    <div class="onboarding-macro onboarding-macro--kcal">${macros.kcal.toLocaleString('de-DE')} kcal</div>
  `;
}

// Live-Refresh nach Slider-Bewegung oder Reset: aktualisiert die betroffenen
// Slots (Zahl, Abendessen, Makros, Vorschlag-Zeile, Refresh-Button). Der Slider-
// DOM-Node bleibt bestehen — deswegen kein voller re-render.
export function refreshResultDynamic(rootEl, draft) {
  const p = resolvedProfile(draft);
  const suggestion = dailyTarget(p);
  const effective = effectiveDailyTarget(p);
  const dinner = dinnerTarget(p);
  const isOverride = draft.dailyTargetOverride != null && draft.dailyTargetOverride !== suggestion;
  const macros = dinner != null ? macrosForKcal(dinner, p.macroPreset) : null;
  const fmt = (n) => n == null ? '—' : n.toLocaleString('de-DE');

  const targetValEl = rootEl.querySelector('[data-role="target-value"]');
  if (targetValEl) targetValEl.textContent = `${fmt(effective)} kcal`;

  const dinnerValEl = rootEl.querySelector('[data-role="dinner-value"]');
  if (dinnerValEl) dinnerValEl.textContent = `${fmt(dinner)} kcal`;

  const suggestionEl = rootEl.querySelector('[data-role="target-suggestion"]');
  if (suggestionEl) {
    suggestionEl.textContent = `Vorschlag: ${fmt(suggestion)} kcal`;
    suggestionEl.hidden = !isOverride;
  }

  const resetBtn = rootEl.querySelector('[data-role="target-reset"]');
  if (resetBtn) resetBtn.hidden = !isOverride;

  const macrosSlot = rootEl.querySelector('[data-role="macros-slot"]');
  if (macrosSlot && macros) macrosSlot.innerHTML = renderMacros(macros);
}
