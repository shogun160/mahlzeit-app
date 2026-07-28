# Design — Ziel-orientierter Reroll

**Datum:** 2026-07-28
**Branch:** `ziel-reroll`
**Basis:** `beta` (1.5.0-beta, versionCode 20)
**Backlog-Referenz:** [`backlog.md`](backlog.md) — Abschnitt „Ziel-orientierter Reroll".

## Problem

`rerollAll` in `src/dashboard/reroll.js` wählt aktuell 7 Rezepte per `weightedShuffle` aus dem eligible Pool — reiner Zufall mit Cuisine-Gewichtung. Ergebnis:

- **kcal-Summe** matcht das Wochenziel nur grob (0.25-Snap in `dishScale` produziert Streuung ±100 kcal/Tag).
- **Makro-Summe** (P/KH/F) über die Woche ist zufällig. Ein User mit Preset „Proteinreich" (40 % P) bekommt Rezepte deren Makro-Inhalt in der Woche z. B. bei 32 % P landet — sichtbar im Nährstoff-Sheet als Delta Soll vs Ist.

`rerollDay(day)` hat dasselbe Problem in kleinerem Umfang: die Bag ist rein cuisine-gewichtet, das neu gerollte Rezept orientiert sich nicht am aktuellen Wochen-Kontext.

## Ziel

Die 7 Rezepte einer Woche werden so gewählt, dass am Wochenende gilt:

- `Σ (dish.kcal × scale)` liegt im User-Sollwert-Bereich `kcalRange(dinnerTarget) × 7`
- `Σ (dish.p × scale)`, `Σ (dish.kh × scale)`, `Σ (dish.f × scale)` liegen nah an den User-Makro-Zielen (Preset oder Custom `macroTargets` × 7)

Beim Einzel-Reroll (Karte → Neu würfeln) orientiert sich der Kandidat am aktuellen Ø-Kontext der markierten Tage — genau dem Ø den der User im Nährstoff-Sheet sieht.

## Ansatz

Aus den drei diskutierten Ansätzen (A Greedy Swap, B Constraint-Search, C Balanced Bucketing) wurde **A Greedy Swap** gewählt:

- Deterministisch nach dem Random-Start (reproduzierbar für Sanity-Script).
- Wenig invasiv: bestehende `eligibleDishIds()` und `cuisineWeight` bleiben unverändert. Cuisine-Präferenz bleibt Hard-Filter im Pool, plus Weight im Start-Shuffle.
- Schnell: bei ~15-35 eligible Rezepten × 7 Slots × ~50 Iterationen ≈ 12k Fitness-Checks. Terminiert früh, wenn kein Swap mehr verbessert.
- Kein neues Datenmodell (B/C bräuchten Bucket-Tags oder Kombinations-Sampling-Framework).

## Architektur

Neue Datei `src/dashboard/optimizer.js` — reine Funktionen ohne DOM-Bezug:

- `weekFitness(assignment, profile)` — Wochen-Fitness gegen 7×Ziel
- `dayScopeFitness(assignment, dayCount, profile)` — Fitness gegen `dayCount`×Ziel (für rerollDay)
- `optimizeAssignment(assignment, pool, profile, maxRounds)` — Greedy-Swap-Loop

Bestehende `src/dashboard/reroll.js` nutzt die neuen Funktionen. `src/nutrition/target.js` bekommt einen neuen Helper `getTargetProfile()` und die Konstante `SCALE_STEP` wird auf `0.125` gesenkt.

## Fitness-Funktion

Squared, normalisierter Delta-Score über 4 Metriken. Kleiner = besser.

```
macros        = effectiveMacroTargets(profile)   // { p, kh, f } in Gramm/Tag
target.kcal   = dinnerTarget(profile) × dayCount
target.p      = macros.p × dayCount
target.kh     = macros.kh × dayCount
target.f      = macros.f × dayCount

actual.kcal   = Σ dish.kcal × scale
actual.{p,kh,f} = Σ dish.{p,kh,f} × scale
  wobei scale = dishScale(dish.kcal, dinnerTarget(profile))

score = (Δkcal/target.kcal)² + (Δp/target.p)² + (Δkh/target.kh)² + (Δf/target.f)²
```

Normalisierung durch Ziel-Wert macht die 4 Deltas vergleichbar (20 g P-Abweichung ≈ 200 kcal-Abweichung in Score-Größe). Alle 4 gleichgewichtet — keine Extra-Priorität für kcal oder einzelnes Makro.

`weekFitness` = `dayScopeFitness` mit `dayCount = 7`.

## Greedy-Swap-Algorithmus

```
current = { ...assignment }
bestScore = weekFitness(current, profile)

for round in 1..maxRounds:
  improvedThisRound = false
  for day in DAYS:
    for candidateId in pool:
      if candidateId == current[day]: continue
      if candidateId in used(current, exceptDay=day): continue  // keine Duplikate
      trial = { ...current, [day]: candidateId }
      trialScore = weekFitness(trial, profile)
      if trialScore < bestScore:
        current = trial
        bestScore = trialScore
        improvedThisRound = true
  if not improvedThisRound: break

return current
```

- Deterministisch pro Start-Assignment (nur Random-Shuffle beim Init bringt Zufall).
- Terminiert früh bei „kein Swap mehr besser". Empirische Erwartung: 3-8 Runden bei üblichem Pool.
- `maxRounds = 50` als Sicherheitsobergrenze — sollte in der Praxis nicht greifen.
- „Keine Duplikate" bleibt Constraint (wie im bestehenden `rerollAll`).

## Integration in `rerollAll`

```js
export function rerollAll() {
  const previousIds = new Set(Object.values(state.assignment));
  const pool = eligibleDishIds();
  let shuffled = weightedShuffle(pool, cuisineWeight).filter(id => !previousIds.has(id));
  if (shuffled.length < DAYS.length) shuffled = weightedShuffle(pool, cuisineWeight);

  // Random-Start (Cuisine-gewichtet, previousIds gemieden)
  const startAssignment = {};
  DAYS.forEach((day, i) => { startAssignment[day] = shuffled[i]; });

  // Ziel-orientierte Optimierung
  const profile = getTargetProfile();
  const optimized = optimizeAssignment(startAssignment, pool, profile);

  DAYS.forEach(day => {
    state.assignment[day] = optimized[day];
    state.selected[day] = false;
    state.portions[day] = state.settings.defaultPortions;
  });
  state.dishBag = {};
}
```

Cuisine-Präferenz bleibt im Random-Start als weighted-Reihenfolge — bevorzugte Küchen landen tendenziell zuerst im Assignment. Der Swap-Loop darf danach auch über Cuisine-Grenzen tauschen, wenn das die Fitness verbessert.

## `rerollDay(day)` mit Fitness-Boost

Die Bag wird nicht mehr rein cuisine-gewichtet befüllt, sondern kombiniert Cuisine-Weight × Fitness-Boost. Fitness bezieht sich auf **die aktuell markierten Tage + den zu rerollenden Tag** — der Kandidat soll den Ø der markierten Gerichte in Richtung Sollwert bewegen.

```js
function refillBag(day) {
  const currentId = state.assignment[day];
  const profile = getTargetProfile();
  const pool = eligibleDishIds().filter(id => id !== currentId);

  // Scope-Days = alle selected Tage + der Reroll-Tag. So orientiert sich
  // der Kandidat am Ø-Kontext den der User im Nährstoff-Sheet sieht.
  const selectedDays = DAYS.filter(d => d !== day && state.selected[d]);
  const scopeDays = [...selectedDays, day];

  const scores = new Map();
  for (const id of pool) {
    const trial = {};
    for (const d of scopeDays) trial[d] = (d === day) ? id : state.assignment[d];
    scores.set(id, dayScopeFitness(trial, scopeDays.length, profile));
  }
  const minScore = Math.min(...scores.values());

  // Combined-Weight: (a) Cuisine-Bonus, (b) exp-Fitness-Boost.
  // TAU = 0.02 empirisch: Kandidaten mit doppelt so hohem Delta bekommen
  // ~1/e = 37% Gewicht. Klein genug damit Fitness dominiert, groß genug
  // damit Zufall drin bleibt (User kann mehrfach rollen bis was gefällt).
  const TAU = 0.02;
  const combined = (id) => {
    const boost = Math.exp(-(scores.get(id) - minScore) / TAU);
    return cuisineWeight(id) * boost;
  };
  state.dishBag[day] = weightedShuffle(pool, combined);
}
```

**Edge-Cases:**
- 0 selected Tage: `scopeDays = [day]` → Einzel-Rezept-Match gegen `dinnerTarget × 1`.
- Alle 7 selected: `dayScopeFitness = weekFitness`.
- Profil unvollständig: `getTargetProfile()` liefert Standard-Profil → Boost läuft mit DGE-Werten (kein Skip).

## Kollateral: `SCALE_STEP` 0.25 → 0.125

Eine Zeile in `src/nutrition/target.js`:

```js
export const SCALE_STEP = 0.125;
```

**Auswirkungen:**
- Card-kcal streuen enger um `dinnerTarget` (±50 statt ±100 kcal). Karten kollabieren nicht auf identische Werte, weil unterschiedliche Basis-Kcal weiter zu unterschiedlichen `scale × dish.kcal` führen.
- `scaledGrams` läuft unverändert (Halfable- und Whole-Rundung sind eigenständig, orientieren sich an `size` nicht an `SCALE_STEP`).
- Reroll-Optimizer bekommt feinere kcal-Justierung → besseres Fitness-Optimum erreichbar.

## Profil-Fallback

Neuer Helper in `src/nutrition/target.js`. Importiert `getActiveProfile` und `getStandardProfile` aus `src/state.js`:

```js
import { getActiveProfile, getStandardProfile } from '../state.js';

export function getTargetProfile() {
  const active = getActiveProfile();
  if (isProfileComplete(active)) return active;
  return getStandardProfile();
}
```

`optimizeAssignment` und `refillBag` nutzen diesen Helper. Bei unvollständigem Profil (Wizzard nicht durchgelaufen) fällt die Ziel-Rechnung auf das Standard-Profil (35 % DGE, Ausgewogen-Preset) zurück — Optimizer läuft immer, kein Skip-Zweig.

## Sanity-Script

Neues Node-Script `scripts/reroll-sanity.js` — kein Test-Framework (Guardrail 10), reine Log-Ausgabe.

**Vorgehen:**
1. Lade `dishes.json` + `ingredients.json` direkt.
2. Für 3-4 Profil-Konstellationen (z. B. Ausgewogen@2000, Proteinreich@2400, KH-arm@1800):
   - Simuliere 100× Random-Start (aktuelles Verhalten).
   - Simuliere 100× Random-Start + Greedy-Swap.
   - Print Vorher/Nachher-Delta-Statistik pro Metrik (kcal, P, KH, F): Mittelwert, Median, Max-Delta.
3. Zielaussage: „Nach Swap-Optimierung sinkt der Ø-Delta bei kcal um X %, bei Makros um Y %".

Aufruf: `node scripts/reroll-sanity.js`. Nur bei Bedarf (wenn App-Ergebnis nicht überzeugt) — der Live-Test auf'm Handy ist die primäre Verifikation.

## Nicht-Ziele / bewusst weggelassen

- **UI-Feedback** („Wochenplan auf Zielwerte optimiert"-Toast): Reroll ist Auto-Trigger, Toast wäre störend.
- **Neu-Rezept-Bias**: aktuell hat `isNewDish` keinen Reroll-Einfluss. Wird auch mit diesem Design nicht eingeführt. Neue Rezepte tauchen ohnehin per Cuisine-Weight auf, wenn sie eligible sind.
- **Cuisine als Weichfaktor**: bleibt Hard-Filter im eligible Pool. Falls das Ziel-Konflikt bringt (bevorzugter Pool zu klein für Makro-Optimum), greifen die bestehenden Fallback-Kaskaden in `eligibleDishIds()`.
- **Wiederholungen erlaubt**: nein. Ein Rezept darf pro Woche nur einmal.
- **rerollDay-Test im Sanity-Script**: bewusst weggelassen. Handy-Test reicht als primäre Verifikation.

## Task-Aufteilung (grob)

1. Neue Datei `src/dashboard/optimizer.js` mit `weekFitness`, `dayScopeFitness`, `optimizeAssignment`.
2. `src/nutrition/target.js`: `SCALE_STEP = 0.125`, neuer Helper `getTargetProfile()`.
3. `src/dashboard/reroll.js`: `rerollAll` ruft `optimizeAssignment`, `refillBag` nutzt Fitness-Boost.
4. `scripts/reroll-sanity.js` — Delta-Statistik-Script.
5. Live-Test auf'm Handy: mehrere Reroll-Runden mit verschiedenen Presets, Makro-Popup-Delta prüfen.

Konkreter Implementierungsplan folgt via `writing-plans`-Skill nach Spec-Approval.
