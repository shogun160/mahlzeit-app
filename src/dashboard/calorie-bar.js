import { state, DAYS, getActiveProfile } from '../state.js';
import { dishesById } from '../data/dishes.js';
import { hasProfile, isProfileComplete, dinnerTarget, kcalRangeRounded } from '../nutrition/target.js';
import { getScaleForDish } from '../nutrition/scale.js';

// Material Symbol autorenew — Reset-Icon in der Reroll-Pille links neben
// der Bedarfs-Pille. Gleiche Metapher wie die Card-Wechseln-Buttons.
const ICON_REROLL = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;

// Kompakte Bedarfs-Bar zwischen Header und Card-Grid im Dashboard.
// Layout:  [Reset-Icon-Pille]  [Bedarfs-Pille: Bedarf | Zielkorridor | Ø X kcal]
// - Reset-Icon-Pille = rerollAll (mit Confirm-Popup)
// - Bedarf = Label / Kontext
// - Zielkorridor = dinnerTarget ± TARGET_WINDOW_KCAL (pro Tag)
// - Ø X kcal = Wochen-Durchschnitt ueber alle 7 Tage
// Ohne vollständiges Profil: leerer String (kein DOM-Element).
export function renderCalorieBar() {
  const profile = getActiveProfile();
  if (state.settings.showDashboardCalorieBar === false) return '';
  if (!profile || profile.showCalorieBar === false) return '';

  // Unvollständiges Profil: Placeholder-Pille als Wizard-Trigger. Ohne
  // Reset-Pille daneben — vor der Einrichtung macht rerollAll wenig Sinn.
  if (!isProfileComplete(profile)) {
    return `
      <div class="calorie-bar-row">
        <button class="calorie-bar calorie-bar--empty" type="button" data-action="open-onboarding" aria-label="Einrichtung starten — Bedarfs-Anzeige aktivieren">
          <span class="calorie-bar__label">Bedarf</span>
          <span class="calorie-bar__values">
            <span class="calorie-bar__cta">Einrichtung starten</span>
          </span>
        </button>
      </div>
    `;
  }

  const target = dinnerTarget(profile);
  if (target == null || target <= 0) return '';
  const [low, high] = kcalRangeRounded(target);

  // Ø ueber ALLE 7 Tage — unabhaengig von state.selected. Die Pille zeigt
  // damit immer den Wochen-Ø des aktuellen Plans, auch wenn nichts in der
  // Einkaufsliste markiert ist. Selected-Kontext bleibt dem Naehrstoff-Sheet
  // vorbehalten (dort ist die Ø-Semantik feiner steuerbar).
  const intakeSum = DAYS.reduce((sum, day) => {
    const dish = dishesById.get(state.assignment[day]);
    if (!dish) return sum;
    return sum + dish.kcal * getScaleForDish(dish);
  }, 0);
  const avg = Math.round(intakeSum / DAYS.length);

  // Farbcodierung: neutral wenn Ø im Zielkorridor, over/under außerhalb.
  let modifier = '';
  if (avg > high) modifier = 'calorie-bar--over';
  else if (avg < low) modifier = 'calorie-bar--under';

  const avgText = `Ø ${format(avg)} kcal`;

  // Zwei Pillen nebeneinander: links Reset (Reroll All mit Confirm), rechts
  // Bedarf. Beide sind eigene Buttons — Klicks propagieren nicht in den anderen.
  return `
    <div class="calorie-bar-row">
      <button class="calorie-bar-reset" type="button" data-action="reroll-all-confirm" aria-label="Alle Gerichte wechseln" title="Alle Gerichte wechseln">
        ${ICON_REROLL}
      </button>
      <button class="calorie-bar ${modifier}" type="button" data-action="open-macro-popup" aria-label="Bedarf pro Tag: Zielkorridor ${format(low)} bis ${format(high)} Kilokalorien, Wochen-Durchschnitt ${format(avg)} Kilokalorien — Details öffnen">
        <span class="calorie-bar__label">Bedarf</span>
        <span class="calorie-bar__values">
          <span class="calorie-bar__target">${format(low)}&thinsp;–&thinsp;${format(high)} kcal</span>
        </span>
        <span class="calorie-bar__avg">
          <span class="calorie-bar__intake">${avgText}</span>
        </span>
      </button>
    </div>
  `;
}

function format(n) {
  return n.toLocaleString('de-DE');
}
