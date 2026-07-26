import { state, DAYS } from '../state.js';
import { dishesById } from '../data/dishes.js';
import { hasProfile, isProfileComplete, dinnerTarget, kcalRange } from '../nutrition/target.js';
import { getScaleForDish } from '../nutrition/scale.js';

// Kompakte Bedarfs-Bar zwischen Header und Card-Grid im Dashboard.
// Layout:  [Bedarf]  [tägl. Zielkorridor]  [Ø der ausgewählten Gerichte]
// - Bedarf = Label / Kontext
// - Zielkorridor = dinnerTarget ± TARGET_WINDOW_KCAL (pro Tag)
// - Durchschnitt = Σ ist-kcal(ausgewählte Tage) ÷ Anzahl ausgewählte Tage
//   Basis: dish.kcal × userScale (1 Portion für dich). "Ausgewählt" meint
//   state.selected[day] — der User-Kontext für die Einkaufsliste.
// Ohne vollständiges Profil: leerer String (kein DOM-Element).
export function renderCalorieBar() {
  const { profile } = state.settings;
  if (profile.showCalorieBar === false) return '';

  // Unvollständiges Profil: Placeholder-Pille als Wizard-Trigger.
  // Ausnahme: showCalorieBar false (oben) → gar keine Pille.
  if (!isProfileComplete(profile)) {
    return `
      <button class="calorie-bar calorie-bar--empty" type="button" data-action="open-onboarding" aria-label="Einrichtung starten — Bedarfs-Anzeige aktivieren">
        <span class="calorie-bar__label">Bedarf</span>
        <span class="calorie-bar__values">
          <span class="calorie-bar__cta">Einrichtung starten</span>
        </span>
      </button>
    `;
  }

  const target = dinnerTarget(profile);
  if (target == null || target <= 0) return '';
  const [low, high] = kcalRange(target);

  const selectedDays = DAYS.filter((d) => state.selected[d]);
  const selectedCount = selectedDays.length;
  const intakeSum = selectedDays.reduce((sum, day) => {
    const dish = dishesById.get(state.assignment[day]);
    if (!dish) return sum;
    return sum + dish.kcal * getScaleForDish(dish);
  }, 0);
  const avg = selectedCount > 0 ? Math.round(intakeSum / selectedCount) : null;

  // Farbcodierung: neutral wenn Ø im Zielkorridor, over/under außerhalb.
  // Kein Alarm-Ton wenn noch nichts ausgewählt (avg == null) — dann leer.
  let modifier = '';
  if (avg != null) {
    if (avg > high) modifier = 'calorie-bar--over';
    else if (avg < low) modifier = 'calorie-bar--under';
  }

  const avgText = avg == null ? '—' : `${format(avg)} kcal`;

  // Klick auf die Pille öffnet das Makro-Popup (Chart + Ø + Preset-Einstellungen).
  // Die Pille ist ein <button>, damit sie Screenreader-freundlich als
  // interaktives Element angekündigt wird.
  return `
    <button class="calorie-bar ${modifier}" type="button" data-action="open-macro-popup" aria-label="Bedarf pro Tag: Zielkorridor ${format(low)} bis ${format(high)} Kilokalorien, Durchschnitt der ausgewählten Gerichte ${avg == null ? 'nicht verfügbar' : format(avg) + ' Kilokalorien'} — Details öffnen">
      <span class="calorie-bar__label">Bedarf</span>
      <span class="calorie-bar__values">
        <span class="calorie-bar__target">${format(low)}&thinsp;–&thinsp;${format(high)} kcal</span>
      </span>
      <span class="calorie-bar__avg">
        <span class="calorie-bar__avg-label">Ø ${selectedCount}/${DAYS.length}</span>
        <span class="calorie-bar__intake">${avgText}</span>
      </span>
    </button>
  `;
}

function format(n) {
  return n.toLocaleString('de-DE');
}
