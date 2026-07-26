import {
  dailyTarget,
  effectiveDailyTarget,
  dinnerTarget,
  kcalRange,
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
export function resolvedProfile(draft) {
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
export function macrosForKcal(kcalTarget, presetKey) {
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
    <p class="onboarding-step__desc">Mahlzeit, lass es dir schmecken!</p>

    <div class="onboarding-result__card onboarding-result__card--primary">
      <div class="onboarding-result__card-header">
        <span class="onboarding-result__label">
          Tagesbedarf
          <span class="onboarding-result__suggestion" data-role="target-suggestion" ${isOverride ? '' : 'hidden'}>· ${formatKcalRange(suggestion)}</span>
        </span>
        <button class="settings-refresh"
                type="button"
                data-action="target-reset"
                data-role="target-reset"
                style="visibility: ${isOverride ? 'visible' : 'hidden'}"
                aria-label="Vorschlag wiederherstellen">
          ${ICON_REFRESH}
        </button>
      </div>
      <div class="onboarding-result__value onboarding-result__value--big" data-role="target-value">${formatKcalRange(effective)}</div>
      <input class="settings-slider"
             type="range"
             min="1000"
             max="4000"
             step="50"
             value="${sliderVal}"
             data-action="target-change"
             aria-label="Tageskalorien-Ziel" />
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
      <div class="onboarding-result__value onboarding-result__value--big" data-role="dinner-value">${formatKcalRange(dinner)}</div>
    </div>

    ${macros ? `
      <div class="onboarding-result__card" data-role="macros-slot">
        ${renderMacros(macros)}
      </div>
    ` : ''}

    <p class="onboarding-result__note">Du kannst alle Werte später in den Einstellungen anpassen.</p>
  `;
}

// Zeigt einen kcal-Wert als Zielkorridor "890 – 1.140 kcal" — analog zu
// formatRange in settings/render.js und zur Bedarfs-Pille im Dashboard.
// Grenzen werden auf 10 kcal gerundet, damit die Zahl im Ergebnis-Screen
// nicht willkürlich präzise wirkt. Genutzt für Tages-Bedarf und Abendessen.
function formatKcalRange(val) {
  if (val == null) return '—';
  const range = kcalRange(val);
  if (!range) return `${val.toLocaleString('de-DE')} kcal`;
  const [lo, hi] = range;
  const round10 = (n) => Math.round(n / 10) * 10;
  return `${round10(lo).toLocaleString('de-DE')}&thinsp;–&thinsp;${round10(hi).toLocaleString('de-DE')} kcal`;
}

// Voller Donut-Ring für die Makro-Verteilung — M3-Circular-Progress-Style
// mit stroke-linecap=round und kleinen Gaps zwischen den Segmenten. Segmente
// proportional zu den kcal-Anteilen von P/KH/F (nicht Gramm — sonst wäre
// Fett trotz 9 kcal/g visuell zu klein). Reihenfolge KH → P → F, Start oben
// (12 Uhr) via transform rotate(-90 auf gemeinsame Gruppe).
//
// Visuelle Verzerrung: Segmente werden mit dem Quadrat der kcal-Anteile
// dimensioniert (nicht linear). Dadurch werden Unterschiede zwischen den
// Presets deutlicher sichtbar — ein Preset mit KH=50% zieht optisch klarer
// nach vorne als eines mit KH=40%. Die aria-label-Prozente bleiben echt,
// damit Screenreader den korrekten Anteil vorlesen.
function renderHorseshoe(macros) {
  const pKcal = macros.p * 4;
  const khKcal = macros.kh * 4;
  const fKcal = macros.f * 9;
  const total = pKcal + khKcal + fKcal;
  if (total <= 0) return '';
  const pPct = pKcal / total;
  const khPct = khKcal / total;
  const fPct = fKcal / total;

  // Quadrierte Anteile fuer die Segment-Groessen — spreizt Unterschiede.
  const pSq = pPct * pPct;
  const khSq = khPct * khPct;
  const fSq = fPct * fPct;
  const sqTotal = pSq + khSq + fSq;
  const pVis = pSq / sqTotal;
  const khVis = khSq / sqTotal;
  const fVis = fSq / sqTotal;

  const R = 42;
  const CIRC = 2 * Math.PI * R;
  const strokeW = 10;
  // Weiße Unterbrechungen zwischen den Segmenten (~18 units bei CIRC ≈ 264 →
  // ca. 6.8% pro Gap), damit die drei F/P/KH-Segmente klar als separate
  // Blöcke lesbar sind. Segmente-Reihenfolge F → P → KH (matcht Legende).
  const GAP = 18;
  const fLen  = Math.max(0, fVis  * CIRC - GAP);
  const pLen  = Math.max(0, pVis  * CIRC - GAP);
  const khLen = Math.max(0, khVis * CIRC - GAP);
  const fOffset  = 0;
  const pOffset  = -(fVis * CIRC);
  const khOffset = -((fVis + pVis) * CIRC);
  return `
    <svg class="onboarding-macro-ring" viewBox="0 0 100 100" role="img" aria-label="Makro-Verteilung: Fett ${Math.round(fPct*100)}%, Protein ${Math.round(pPct*100)}%, Kohlenhydrate ${Math.round(khPct*100)}%">
      <g transform="rotate(-90 50 50)">
        <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--md-sys-color-surface)" stroke-width="${strokeW}" />
        <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--chart-color-f)"  stroke-width="${strokeW}" stroke-linecap="round" stroke-dasharray="${fLen} ${CIRC - fLen}"   stroke-dashoffset="${fOffset}" />
        <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--chart-color-p)"  stroke-width="${strokeW}" stroke-linecap="round" stroke-dasharray="${pLen} ${CIRC - pLen}"   stroke-dashoffset="${pOffset}" />
        <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--chart-color-kh)" stroke-width="${strokeW}" stroke-linecap="round" stroke-dasharray="${khLen} ${CIRC - khLen}" stroke-dashoffset="${khOffset}" />
      </g>
    </svg>
  `;
}

// Kompakte Pill-Zeile ohne Donut — für die Vorschau auf Step 3 (Filter).
// F/P/KH als 3 flache Pills mit farbigem Buchstabe + Gramm. kcal weglassen
// (kommt erst im Ergebnis-Screen wichtig).
export function renderMacrosPills(macros) {
  return `
    <div class="onboarding-macro-pills">
      <span class="onboarding-macro-pill"><span class="onboarding-macro__key onboarding-macro__key--f">F</span>${macros.f}&thinsp;g</span>
      <span class="onboarding-macro-pill"><span class="onboarding-macro__key onboarding-macro__key--p">P</span>${macros.p}&thinsp;g</span>
      <span class="onboarding-macro-pill"><span class="onboarding-macro__key onboarding-macro__key--kh">KH</span>${macros.kh}&thinsp;g</span>
    </div>
  `;
}

export function renderMacros(macros) {
  return `
    <div class="onboarding-result__label">Makro-Verteilung</div>
    <div class="onboarding-macro-row">
      ${renderHorseshoe(macros)}
      <div class="onboarding-macro-legend">
        <div class="onboarding-macro-legend__row"><span class="onboarding-macro__key onboarding-macro__key--f">Fett</span><span class="onboarding-macro-legend__value">${macros.f}&thinsp;g</span></div>
        <div class="onboarding-macro-legend__row"><span class="onboarding-macro__key onboarding-macro__key--p">Protein</span><span class="onboarding-macro-legend__value">${macros.p}&thinsp;g</span></div>
        <div class="onboarding-macro-legend__row"><span class="onboarding-macro__key onboarding-macro__key--kh">Kohlenhydrate</span><span class="onboarding-macro-legend__value">${macros.kh}&thinsp;g</span></div>
      </div>
    </div>
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

  // innerHTML statt textContent, weil formatKcalRange &thinsp; enthält.
  const targetValEl = rootEl.querySelector('[data-role="target-value"]');
  if (targetValEl) targetValEl.innerHTML = formatKcalRange(effective);

  const dinnerValEl = rootEl.querySelector('[data-role="dinner-value"]');
  if (dinnerValEl) dinnerValEl.innerHTML = formatKcalRange(dinner);

  const suggestionEl = rootEl.querySelector('[data-role="target-suggestion"]');
  if (suggestionEl) {
    // innerHTML statt textContent — formatKcalRange enthält &thinsp;.
    suggestionEl.innerHTML = `· ${formatKcalRange(suggestion)}`;
    suggestionEl.hidden = !isOverride;
  }

  // visibility statt hidden — Button belegt weiter Platz, Card-Höhe konstant.
  const resetBtn = rootEl.querySelector('[data-role="target-reset"]');
  if (resetBtn) resetBtn.style.visibility = isOverride ? 'visible' : 'hidden';

  const macrosSlot = rootEl.querySelector('[data-role="macros-slot"]');
  if (macrosSlot && macros) macrosSlot.innerHTML = renderMacros(macros);
}
