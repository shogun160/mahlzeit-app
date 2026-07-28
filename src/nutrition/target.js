// Berechnungslogik für persönliches Tageskalorien-Ziel und Wochen-Ist.
// Die meisten Funktionen sind ohne State- oder DOM-Abhängigkeit — bewusst
// isoliert, damit sich Formeln ohne UI-Kopplung testen lassen. Ausnahme:
// getTargetProfile() greift auf state.js zu (Convenience-Shim für Consumer).

import { getActiveProfile, getStandardProfile } from '../state.js';

// Tagesziel und Abendessen-Ziel werden nicht als Punkt, sondern als Range mit
// diesem Fenster (±) rund um den berechneten Wert dargestellt. 125 kcal ≈ ein
// mittleres Extra (Apfel, Handvoll Nüsse), stellt aber trotzdem eine sichtbare
// Grenze dar. Fensterbreite gesamt = 2 × TARGET_WINDOW_KCAL = 250 kcal.
export const TARGET_WINDOW_KCAL = 125;

// PAL-Faktoren (Physical Activity Level) — klassische 5-Stufen-Tabelle.
// Index 1..5 entspricht Sitzend, Wenig, Moderat, Aktiv, Sehr aktiv.
export const ACTIVITY_LEVELS = [
  { level: 1, pal: 1.2,   label: 'Sitzend' },
  { level: 2, pal: 1.375, label: 'Wenig aktiv' },
  { level: 3, pal: 1.55,  label: 'Moderat aktiv' },
  { level: 4, pal: 1.725, label: 'Aktiv' },
  { level: 5, pal: 1.9,   label: 'Sehr aktiv' },
];

// Ziel-Modi mit kcal-Adjustment. −500/+500 entspricht ~0.5 kg/Woche Ab-/Aufbau.
export const GOALS = [
  { key: 'lose',     label: 'Abnehmen', delta: -500 },
  { key: 'maintain', label: 'Halten',   delta: 0 },
  { key: 'gain',     label: 'Aufbauen', delta: 500 },
];

// Bereichs-Konstanten für Slider/Stepper in der Profil-Section.
// Defaults sind pragmatisch gewählt (Erwachsener, mitteleuropäisches Mittel),
// damit das Profil beim ersten Öffnen sinnvolle Startwerte hat statt "—".
// Geschlecht bleibt bewusst leer — User muss bewusst wählen (Mifflin-St Jeor
// unterscheidet die Formel).
export const AGE_MIN = 16;
export const AGE_MAX = 100;
export const AGE_DEFAULT = 40;
export const HEIGHT_MIN = 140;
export const HEIGHT_MAX = 210;
export const HEIGHT_DEFAULT = 180;
export const WEIGHT_MIN = 40;
export const WEIGHT_MAX = 150;
export const WEIGHT_DEFAULT = 80;
// Slider-Ranges für Tagesziel-Override und Mahlzeit-Aufteilung. Bewusst weite
// Ranges, damit auch untypische Profile (Leistungssport, Diät) passen.
export const DAILY_TARGET_MIN = 1000;
export const DAILY_TARGET_MAX = 4500;
export const DAILY_TARGET_STEP = 50;
export const MEAL_KCAL_STEP = 10;
export const BREAKFAST_MAX = 1500;
export const LUNCH_MAX = 2000;

// True, wenn das Profil vollständig genug für eine BMR-Berechnung ist.
// activityLevel und goal haben immer Defaults (3 / maintain); es fehlt nur,
// wenn eines der biometrischen Felder null ist.
export function hasProfile(profile) {
  if (!profile) return false;
  return (
    (profile.gender === 'male' || profile.gender === 'female') &&
    typeof profile.age === 'number' &&
    typeof profile.heightCm === 'number' &&
    typeof profile.weightKg === 'number'
  );
}

// True, wenn ALLE Pflicht-Wizzard-Felder gesetzt sind (Biometrie + Alltag).
// Ergänzt hasProfile() um activityLevel und goal. breakfastKcal/lunchKcal
// sind seit Session 26 optionale Overrides (im Profi-Modus) — bei null
// greift die 35 %-Regel via dinnerTarget, das Profil bleibt trotzdem
// vollständig. Name ist nicht Teil — er ist optional (leerer Name → Copy
// fällt auf unpersönlichen Ton zurück). Steuert die Placeholder-Pille-
// Entscheidung im Dashboard.
export function isProfileComplete(profile) {
  if (!hasProfile(profile)) return false;
  return (
    typeof profile.activityLevel === 'number' &&
    (profile.goal === 'maintain' || profile.goal === 'lose' || profile.goal === 'gain')
  );
}

// Mifflin-St Jeor Grundumsatz (BMR, 1990). Genauer als Harris-Benedict für
// die heutige Bevölkerung, Standard in Ernährungsberatung.
//   Männlich: 10×kg + 6.25×cm − 5×Alter + 5
//   Weiblich: 10×kg + 6.25×cm − 5×Alter − 161
export function bmr(profile) {
  if (!hasProfile(profile)) return null;
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.gender === 'male' ? base + 5 : base - 161;
}

// Tageskalorien-Ziel = BMR × PAL + Ziel-Adjustment.
// Ohne vollständiges Profil: null.
export function dailyTarget(profile) {
  const b = bmr(profile);
  if (b == null) return null;
  const pal = ACTIVITY_LEVELS.find((a) => a.level === profile.activityLevel)?.pal ?? 1.55;
  const delta = GOALS.find((g) => g.key === profile.goal)?.delta ?? 0;
  return Math.round(b * pal + delta);
}

// Ist-Kalorien der Woche = Summe dish.kcal über alle 7 Tage mit Assignment.
// Bewusst OHNE portions-Faktor: portions beschreibt die gekochte Menge für
// die Einkaufsliste (Haushalt), nicht was der User selbst isst. Der User
// isst pro Tag eine Portion — Card-/Detail-Anzeige bleibt Rezept-Total.
export function weeklyIntake(assignment, dishesById) {
  let sum = 0;
  for (const day in assignment) {
    const dish = dishesById.get(assignment[day]);
    if (dish) sum += dish.kcal;
  }
  return sum;
}

// Tatsächliches Tagesziel: manueller Override wenn gesetzt, sonst berechnet.
// Damit kann der User den Vorschlag aus Profil per Slider übersteuern, ohne
// dass eine Profil-Änderung seinen manuellen Wert überschreibt.
export function effectiveDailyTarget(profile) {
  if (profile?.dailyTargetOverride != null) return profile.dailyTargetOverride;
  return dailyTarget(profile);
}

// Prozentualer Standard-Anteil am Tagesbedarf, wenn keine Profi-Aufteilung
// (Fr/Mi) gesetzt ist. 35 % entspricht dem oberen Rand der DGE-Empfehlung
// (Abendessen ~25-35 % des Tagesbedarfs) — der User plant hier bewusst, also
// tendenziell die reichere Mahlzeit.
export const DINNER_STANDARD_SHARE = 0.35;

// Untergrenze fuer das Abendessen im Profi-Modus. Wenn Fr+Mi so hoch sind,
// dass weniger als das uebrig bliebe, greift der Clamp — Slider-Handler
// sollten das aufgreifen (Toast + Wert clampen), damit der User nicht
// verwirrt ist warum sein Fr/Mi-Wert nicht "wirkt".
export const DINNER_MIN_KCAL = 500;

// Abendessen-Ziel-Ableitung. Prioritaet:
//  1. dinnerKcalOverride (manueller Slider im Profil-Sheet) — gewinnt immer.
//  2. Profi-Modus: mindestens einer von Fr/Mi gesetzt → daily-bf-lu (min 500).
//  3. Standard-Modus: 35 % des Tagesbedarfs (DGE-orientiert, skaliert mit
//     BMR und Aktivitaet automatisch mit).
// Rueckgabe null wenn Profil unvollstaendig (kein Daily).
export function dinnerTarget(profile) {
  if (profile?.dinnerKcalOverride != null) return profile.dinnerKcalOverride;
  const daily = effectiveDailyTarget(profile);
  if (daily == null) return null;
  const bf = profile.breakfastKcal ?? 0;
  const lu = profile.lunchKcal ?? 0;
  if (bf > 0 || lu > 0) {
    return Math.max(DINNER_MIN_KCAL, daily - bf - lu);
  }
  return Math.round(daily * DINNER_STANDARD_SHARE);
}

// Slider-Range fuer den Abendessen-Override im Profil-Sheet.
export const DINNER_KCAL_MIN = 300;
export const DINNER_KCAL_MAX = 2500;

// [low, high]-Range um einen kcal-Wert mit TARGET_WINDOW_KCAL als Halbfenster.
// Wird für Tages-, Abendessen- und Wochen-Anzeige verwendet — überall dieselbe
// Semantik: der "Zielkorridor" liegt zwischen den beiden Werten.
export function kcalRange(value, factor = 1) {
  if (value == null) return null;
  const window = TARGET_WINDOW_KCAL * factor;
  return [Math.max(0, value - window), value + window];
}

// Same as kcalRange, aber auf 10 kcal gerundet fuer UI-Anzeige. Damit die
// Range-Werte ueberall gleich formatiert erscheinen (Profil-Card, Bedarfs-
// Pille, Detail-Sheet, Wizard-Preview) — keine "797 vs 800"-Inkonsistenz.
export function kcalRangeRounded(value, factor = 1) {
  const r = kcalRange(value, factor);
  if (!r) return null;
  const round10 = (n) => Math.round(n / 10) * 10;
  return [round10(r[0]), round10(r[1])];
}

// Makro-Presets — Verteilung der Tageskalorien auf P/KH/F in Prozent.
// Werte evidenzbasiert (AMDR: KH 45-65%, P 10-35%, F 20-35%). Bewusst so
// gewählt, dass P in 3 von 4 Presets bei 30% liegt — nur P-reich bewegt es.
// Damit ist jeder Preset-Name = das, was sich verändert.
//   Ausgewogen — 30/40/30, klassisches Zone-Balanced-Setup.
//   P-reich    — 40/30/30, High-Protein — Muskelaufbau/Sattheit.
//   KH-arm     — 30/25/45, moderate Low-Carb (nicht Keto).
//   F-arm      — 30/50/20, F an AMDR-Untergrenze — Ausdauer-lastig.
export const MACRO_PRESETS = [
  { key: 'balanced', label: 'Ausgewogen',      p: 30, kh: 40, f: 30 },
  { key: 'protein',  label: 'Proteinreich',    p: 40, kh: 30, f: 30 },
  { key: 'lowcarb',  label: 'Kohlenhydratarm', p: 30, kh: 25, f: 45 },
  { key: 'lowfat',   label: 'Fettarm',         p: 30, kh: 50, f: 20 },
];
export const MACRO_PRESET_DEFAULT = 'balanced';

// Slider-Ranges für die Makro-Slider (Gramm/Tag). Ranges sind großzügig
// bemessen, damit auch untypische Verteilungen (extrem Low-Carb, hoch P)
// erreichbar sind. Step 5 g ist fein genug für spürbare Änderungen und
// grob genug, um klickbar zu bleiben.
export const MACRO_MIN = 0;
export const MACRO_MAX = 400;
export const MACRO_STEP = 5;

// Wandelt ein Preset in Gramm-Werte bei gegebenem Tages-kcal-Ziel.
// Basiert auf den Kalorien-Faktoren P/KH = 4 kcal/g, F = 9 kcal/g.
// Runde auf MACRO_STEP damit Slider-Rasterung sauber greift.
export function macroTargetsFromPreset(kcalTarget, presetKey) {
  if (!kcalTarget || kcalTarget <= 0) return null;
  const preset = MACRO_PRESETS.find((p) => p.key === presetKey) ?? MACRO_PRESETS[0];
  const p = Math.round((kcalTarget * preset.p / 100 / 4) / MACRO_STEP) * MACRO_STEP;
  const kh = Math.round((kcalTarget * preset.kh / 100 / 4) / MACRO_STEP) * MACRO_STEP;
  const f = Math.round((kcalTarget * preset.f / 100 / 9) / MACRO_STEP) * MACRO_STEP;
  return { p, kh, f };
}

// Effektive Makro-Ziele: expliziter Override (macroTargets) sticht Preset.
// Ohne beides → Preset-Default. Damit hat der User drei Interaktions-Ebenen:
//   1) Preset-Chip klicken       → macroPreset gesetzt, macroTargets = null
//   2) Slider ziehen             → macroTargets = {p,kh,f}, macroPreset = null
//   3) Refresh-Button klicken    → macroTargets = null, macroPreset = 'balanced'
export function effectiveMacroTargets(profile) {
  if (!profile) return null;
  if (profile.macroTargets && typeof profile.macroTargets === 'object') {
    return profile.macroTargets;
  }
  const kcal = effectiveDailyTarget(profile);
  if (kcal == null) return null;
  const preset = profile.macroPreset ?? MACRO_PRESET_DEFAULT;
  return macroTargetsFromPreset(kcal, preset);
}

// Skalierungs-Grenzen und -Stufen für die automatische Rezept-Anpassung.
// 0.125-Stufen erhalten die Rezept-Vielfalt: unterschiedliche Basis-Gerichte
// landen bei unterschiedlichen kcal-Werten (fliessend wuerde alle exakt aufs
// Ziel bringen — Card-Werte waeren identisch). Feineres Raster als 0.25 gibt
// dem Ziel-Reroll-Optimizer mehr Spielraum ohne Card-Kollaps. SCALE_MAX bei
// 2.5, damit auch kleine Basis-Gerichte (~700 kcal) hohe Ziele (1700+)
// erreichen.
export const SCALE_MIN = 0.5;
export const SCALE_MAX = 2.5;
export const SCALE_STEP = 0.125;

// Einheiten, deren Menge nach dem Skalieren auf ganze Stück gerundet werden
// muss (typisch: Eier — halbes Ei macht in Rezepten keinen Sinn).
const WHOLE_UNITS = new Set(['ei']);
// Einheiten, deren Menge auf halbe Stück gerundet werden darf (typisch: Bund
// Petersilie, Zehe Knoblauch, Kartoffel-Stück — halbe Portionen sind praktikabel).
const HALFABLE_UNITS = new Set(['bund', 'zehe', 'stueck']);

export function isHalfableUnit(unit) {
  return HALFABLE_UNITS.has(unit);
}

export function isWholeUnit(unit) {
  return WHOLE_UNITS.has(unit);
}

// Berechnet den Skalierungsfaktor, mit dem ein Gericht auf sein Abendessen-Ziel
// gebracht wird. Faktor gerundet auf SCALE_STEP (0.125) — hält Rezept-Vielfalt
// aufrecht statt jedes Gericht exakt aufs Ziel zu snappen. Geklemmt auf
// [SCALE_MIN, SCALE_MAX].
export function dishScale(dishKcal, targetKcal) {
  if (!dishKcal || !targetKcal) return 1;
  const raw = targetKcal / dishKcal;
  const stepped = Math.round(raw / SCALE_STEP) * SCALE_STEP;
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, stepped));
}

// Gramm-Menge einer Zutat, skaliert mit multiplier (portions × userScale).
// Diskrete Einheiten werden über size auf sinnvolle Portionsgrößen gerundet:
// - "ei" auf ganze Stück (halbes Ei nutzlos)
// - "bund" / "zehe" / "stueck" auf halbe Stück (½ Bund Petersilie ist normal)
// Alles andere (g, ml, vorrat) läuft ungerundet durch — Anzeige rundet separat.
// Rundung + Anzeige (formatIngredientQuantity) nutzen identische Logik, damit
// die interne kcal-Rechnung mit dem übereinstimmt was der User im Rezept liest.
export function scaledGrams(ing, multiplier) {
  const raw = ing.grams * multiplier;
  if (!ing.size) return raw;
  if (WHOLE_UNITS.has(ing.unit)) {
    const count = Math.max(1, Math.round(raw / ing.size));
    return count * ing.size;
  }
  if (HALFABLE_UNITS.has(ing.unit)) {
    // 0.25-Stufen erlauben ¼/½/¾-Portionen — praktikabel bei Gemüsen wie
    // Gurke oder Zwiebel, wo man selten ganze Stück braucht.
    const count = Math.max(0.25, Math.round((raw / ing.size) * 4) / 4);
    return count * ing.size;
  }
  return raw;
}

// Liefert das Profil fuer Ziel-Berechnungen. Wenn das aktive Profil
// unvollstaendig ist (Wizzard nicht durchgelaufen), faellt es auf das
// Standard-Profil zurueck, damit Optimizer + Fitness-Boost trotzdem
// mit sinnvollen DGE-Werten arbeiten statt zu skippen.
export function getTargetProfile() {
  const active = getActiveProfile();
  if (isProfileComplete(active)) return active;
  return getStandardProfile();
}

// Abendessen-Makro-Ziele fuer ein einzelnes Profil. Rechnung: Tages-Makros
// (aus effectiveMacroTargets) skaliert mit dem Anteil dinner/daily. Damit
// vergleicht der Ziel-Reroll-Optimizer skalierte Rezept-Makros gegen die
// tatsaechlichen Abendessen-Sollwerte statt gegen die Tages-Sollwerte —
// sonst ist die Referenz zu hoch und die Fitness dominiert die
// Optimierung nicht sinnvoll.
export function dinnerMacroTargets(profile) {
  const dinner = dinnerTarget(profile);
  const daily = effectiveDailyTarget(profile);
  const macros = effectiveMacroTargets(profile);
  if (!dinner || !daily || !macros) return null;
  const share = dinner / daily;
  return {
    p: macros.p * share,
    kh: macros.kh * share,
    f: macros.f * share,
  };
}
