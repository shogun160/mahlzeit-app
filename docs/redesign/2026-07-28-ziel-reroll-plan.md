# Ziel-orientierter Reroll — Implementierungsplan

> **Für den ausführenden Agenten:** Bearbeite diesen Plan Task für Task. Steps in Checkbox-Syntax (`- [ ]`) für Tracking. Keine Test-Frameworks im Projekt (Guardrail 10) — statt TDD nutzen wir das Sanity-Script + Live-Test am Handy als Verifikation. Nach jedem Task committen (Commit-Regel: `type(scope): kurzbeschreibung`, Kleinschreibung, keine Umlaute).

**Goal:** `rerollAll` optimiert die Woche auf Wochen-Sollwerte (kcal + P/KH/F), `rerollDay` bevorzugt Kandidaten die den Ø der markierten Gerichte in Richtung Sollwert bewegen.

**Architektur:** Neue Datei `src/dashboard/optimizer.js` mit reinen Funktionen (Fitness + Greedy-Swap). `src/dashboard/reroll.js` orchestriert. `src/nutrition/target.js` bekommt `SCALE_STEP = 0.125` und `getTargetProfile()`-Helper. Sanity-Script als Node-CLI unter `scripts/`.

**Tech Stack:** Vanilla JS (ES-Module), Node 20+ für Sanity-Script, Vite Dev-Server für Browser-Test.

**Design-Doc:** [`2026-07-28-ziel-reroll-design.md`](2026-07-28-ziel-reroll-design.md) — als Referenz für Fitness-Formel und Algorithmus.

---

## File-Structure

**Neu:**
- `src/dashboard/optimizer.js` — `weekFitness`, `dayScopeFitness`, `optimizeAssignment`. Reine Funktionen, kein Import aus `state.js`.
- `scripts/reroll-sanity.js` — Node-CLI, simuliert 100× Reroll für mehrere Profile, printet Delta-Statistik.

**Modifiziert:**
- `src/nutrition/target.js` — `SCALE_STEP` 0.25 → 0.125, neuer Export `getTargetProfile()`.
- `src/dashboard/reroll.js` — `rerollAll` und `refillBag` nutzen die neuen Funktionen.

**Unverändert:**
- `src/state.js` — Profile-Helper (`getActiveProfile`, `getStandardProfile`) bleiben unangetastet.
- `src/data/dishes.js` — `eligibleDishIds`, `weightedShuffle`, `cuisineWeight` bleiben unangetastet.

---

## Task 1 — `SCALE_STEP` auf 0.125 + `getTargetProfile()`-Helper

**Files:**
- Modify: `src/nutrition/target.js`

**Steps:**

- [ ] **Step 1.1: `SCALE_STEP` von 0.25 auf 0.125 ändern**

In `src/nutrition/target.js` die Konstante ändern:

```js
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
```

- [ ] **Step 1.2: `getTargetProfile()`-Helper hinzufügen**

Am Ende von `src/nutrition/target.js` ergänzen (Import oben anpassen):

Import-Zeile prüfen — falls noch nicht vorhanden, `getActiveProfile` und `getStandardProfile` importieren:

```js
import { getActiveProfile, getStandardProfile } from '../state.js';
```

Am Ende der Datei die Funktion einfügen:

```js
// Liefert das Profil fuer Ziel-Berechnungen. Wenn das aktive Profil
// unvollstaendig ist (Wizzard nicht durchgelaufen), faellt es auf das
// Standard-Profil zurueck, damit Optimizer + Fitness-Boost trotzdem
// mit sinnvollen DGE-Werten arbeiten statt zu skippen.
export function getTargetProfile() {
  const active = getActiveProfile();
  if (isProfileComplete(active)) return active;
  return getStandardProfile();
}
```

- [ ] **Step 1.3: Verifizieren via Node-Snippet**

Kurzer Sanity-Check dass die Konstante durchzieht:

```bash
node -e "import('./src/nutrition/target.js').then(m => { console.log('SCALE_STEP:', m.SCALE_STEP); console.log('dishScale(700, 800):', m.dishScale(700, 800)); console.log('dishScale(900, 800):', m.dishScale(900, 800)); })"
```

Erwartete Ausgabe:
```
SCALE_STEP: 0.125
dishScale(700, 800): 1.125
dishScale(900, 800): 0.875
```

- [ ] **Step 1.4: Commit**

```bash
git add src/nutrition/target.js
git commit -m "feat(target): SCALE_STEP 0.25 auf 0.125 + getTargetProfile helper"
```

---

## Task 2 — Optimizer-Modul (Fitness + Greedy Swap)

**Files:**
- Create: `src/dashboard/optimizer.js`

**Steps:**

- [ ] **Step 2.1: `src/dashboard/optimizer.js` anlegen mit `weekFitness` und `dayScopeFitness`**

```js
// Ziel-orientierter Reroll: reine Funktionen fuer Fitness-Score und
// Greedy-Swap-Optimierung. Kein Import aus state.js — Consumer (reroll.js)
// reichen den aktuellen Assignment-Snapshot und das Ziel-Profil rein.
//
// Fitness ist die Summe quadrierter, normalisierter Deltas ueber vier
// Metriken (kcal, P, KH, F) gegen dayCount × Ziel. Kleiner = besser.

import { DAYS } from '../state.js';
import { dishesById } from '../data/dishes.js';
import { dinnerTarget, effectiveMacroTargets, dishScale } from '../nutrition/target.js';

// Fitness gegen dayCount × Ziel. Verwendet vom rerollDay-Boost mit dem
// aktuellen Selected-Scope, und von weekFitness (dayCount = 7).
export function dayScopeFitness(assignment, dayCount, profile) {
  const dinner = dinnerTarget(profile);
  const macros = effectiveMacroTargets(profile);
  if (!dinner || !macros) return 0;

  const target = {
    kcal: dinner * dayCount,
    p:    macros.p * dayCount,
    kh:   macros.kh * dayCount,
    f:    macros.f * dayCount,
  };

  let actual = { kcal: 0, p: 0, kh: 0, f: 0 };
  for (const day in assignment) {
    const dish = dishesById.get(assignment[day]);
    if (!dish) continue;
    const scale = dishScale(dish.kcal, dinner);
    actual.kcal += dish.kcal * scale;
    actual.p    += dish.p    * scale;
    actual.kh   += dish.kh   * scale;
    actual.f    += dish.f    * scale;
  }

  const deltaSq = (a, t) => {
    if (t === 0) return 0;
    const d = (a - t) / t;
    return d * d;
  };
  return deltaSq(actual.kcal, target.kcal)
       + deltaSq(actual.p,    target.p)
       + deltaSq(actual.kh,   target.kh)
       + deltaSq(actual.f,    target.f);
}

// Wochen-Fitness fuer rerollAll: dayCount = 7.
export function weekFitness(assignment, profile) {
  return dayScopeFitness(assignment, DAYS.length, profile);
}
```

- [ ] **Step 2.2: `optimizeAssignment` mit Greedy Swap ergänzen**

Ans Ende von `src/dashboard/optimizer.js` anhängen:

```js
// Greedy Swap: startet vom aktuellen Assignment, prueft fuer jeden Tag ob
// ein Tausch gegen einen Pool-Kandidaten die Wochen-Fitness verbessert.
// Deterministisch (kein Zufall im Loop, nur im Start-Assignment). Terminiert
// frueh, wenn eine ganze Runde keine Verbesserung mehr bringt.
//
// - assignment: { [day]: dishId } — Start-Assignment, wird nicht mutiert
// - pool: number[] — eligible Dish-IDs (Kochzeit + Diaet + Cuisine gefiltert)
// - profile: Target-Profil (via getTargetProfile im Aufrufer)
// - maxRounds: Sicherheits-Cap, praktisch nach 3-8 Runden fertig
export function optimizeAssignment(assignment, pool, profile, maxRounds = 50) {
  const current = { ...assignment };
  let bestScore = weekFitness(current, profile);
  if (bestScore === 0) return current;

  for (let round = 0; round < maxRounds; round++) {
    let improvedThisRound = false;
    for (const day of DAYS) {
      const currentUsed = new Set(Object.values(current));
      currentUsed.delete(current[day]);
      for (const candidateId of pool) {
        if (candidateId === current[day]) continue;
        if (currentUsed.has(candidateId)) continue;
        const trial = { ...current, [day]: candidateId };
        const trialScore = weekFitness(trial, profile);
        if (trialScore < bestScore) {
          current[day] = candidateId;
          bestScore = trialScore;
          improvedThisRound = true;
        }
      }
    }
    if (!improvedThisRound) break;
  }
  return current;
}
```

- [ ] **Step 2.3: Verifizieren via Node-Snippet**

Testet dass `weekFitness` und `optimizeAssignment` importierbar sind und einen Score zurückgeben:

```bash
node -e "
import('./src/dashboard/optimizer.js').then(async (m) => {
  const dishes = (await import('./src/data/dishes.js')).allDishIds;
  const { getStandardProfile } = await import('./src/state.js');
  const profile = getStandardProfile();
  const assignment = {};
  const days = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
  days.forEach((d, i) => assignment[d] = dishes[i]);
  const startScore = m.weekFitness(assignment, profile);
  const optimized = m.optimizeAssignment(assignment, dishes, profile);
  const endScore = m.weekFitness(optimized, profile);
  console.log('start:', startScore.toFixed(4), 'end:', endScore.toFixed(4));
});
"
```

Erwartete Ausgabe: `end` sollte kleiner oder gleich `start` sein (Optimizer verbessert oder lässt Score gleich). Konkrete Zahlen hängen vom Rezept-Bestand ab.

- [ ] **Step 2.4: Commit**

```bash
git add src/dashboard/optimizer.js
git commit -m "feat(optimizer): fitness und greedy-swap fuer ziel-reroll"
```

---

## Task 3 — `rerollAll` und `refillBag` umbauen

**Files:**
- Modify: `src/dashboard/reroll.js`

**Steps:**

- [ ] **Step 3.1: Imports in `reroll.js` erweitern**

Am Anfang von `src/dashboard/reroll.js` die Imports anpassen. Vorher:

```js
import { state, DAYS } from '../state.js';
import { allDishIds, dishesById, weightedShuffle } from '../data/dishes.js';
import { getEffectivePreferences, getEffectiveCuisines, dishCuisineVoteCount } from '../nutrition/preferences.js';
```

Nachher:

```js
import { state, DAYS } from '../state.js';
import { allDishIds, dishesById, weightedShuffle } from '../data/dishes.js';
import { getEffectivePreferences, getEffectiveCuisines, dishCuisineVoteCount } from '../nutrition/preferences.js';
import { getTargetProfile } from '../nutrition/target.js';
import { optimizeAssignment, dayScopeFitness } from './optimizer.js';
```

- [ ] **Step 3.2: `refillBag` mit Fitness-Boost umbauen**

In `src/dashboard/reroll.js` die Funktion `refillBag` ersetzen. Vorher:

```js
function refillBag(day) {
  const currentId = state.assignment[day];
  state.dishBag[day] = weightedShuffle(eligibleDishIds(), cuisineWeight).filter((id) => id !== currentId);
}
```

Nachher:

```js
// Bag-Refill mit Fitness-Boost: Kandidaten die den Wochen-Kontext naeher
// an die Ziele bringen bekommen exponentielles Extra-Gewicht ontop des
// bestehenden Cuisine-Faktors. Fitness bezieht sich auf die aktuell
// markierten Tage plus den Reroll-Tag — der Ø den der User im
// Naehrstoff-Sheet sieht. Zufall bleibt drin: User kann mehrfach rollen
// bis was gefaellt.
function refillBag(day) {
  const currentId = state.assignment[day];
  const profile = getTargetProfile();
  const pool = eligibleDishIds().filter((id) => id !== currentId);

  // Scope: alle selected Tage + der Reroll-Tag. Bei 0 selected wird nur
  // dieser eine Tag gegen 1x dinnerTarget bewertet (Einzel-Rezept-Match).
  const selectedDays = DAYS.filter((d) => d !== day && state.selected[d]);
  const scopeDays = [...selectedDays, day];
  const dayCount = scopeDays.length;

  // Fitness pro Kandidat: wie gut waere der Wochen-Scope wenn dieser
  // Kandidat am Reroll-Tag landet.
  const scores = new Map();
  for (const id of pool) {
    const trial = {};
    for (const d of scopeDays) trial[d] = (d === day) ? id : state.assignment[d];
    scores.set(id, dayScopeFitness(trial, dayCount, profile));
  }
  const minScore = scores.size > 0 ? Math.min(...scores.values()) : 0;

  // Combined-Weight: (a) Cuisine-Bonus (1 oder 1+3xVoters), (b) Fitness-
  // Boost exp(-(score-minScore)/TAU). TAU steuert wie stark Fitness
  // dominiert. 0.02 empirisch: Kandidaten mit doppelt so hohem Delta
  // bekommen ~1/e = 37% Gewicht — klein genug damit Fitness fuehrt, gross
  // genug damit Zufall drin bleibt.
  const TAU = 0.02;
  const combined = (id) => {
    const cuisine = cuisineWeight(id);
    const s = scores.get(id) ?? 0;
    const boost = Math.exp(-(s - minScore) / TAU);
    return cuisine * boost;
  };

  state.dishBag[day] = weightedShuffle(pool, combined);
}
```

- [ ] **Step 3.3: `rerollAll` mit Optimizer erweitern**

In `src/dashboard/reroll.js` die Funktion `rerollAll` ersetzen. Vorher:

```js
export function rerollAll() {
  const previousIds = new Set(Object.values(state.assignment));
  const pool = eligibleDishIds();
  let shuffledPool = weightedShuffle(pool, cuisineWeight).filter((id) => !previousIds.has(id));
  if (shuffledPool.length < DAYS.length) {
    shuffledPool = weightedShuffle(pool, cuisineWeight);
  }
  DAYS.forEach((day, i) => {
    state.assignment[day] = shuffledPool[i];
    state.selected[day] = false;
    state.portions[day] = state.settings.defaultPortions;
  });
  state.dishBag = {};
}
```

Nachher:

```js
export function rerollAll() {
  const previousIds = new Set(Object.values(state.assignment));
  const pool = eligibleDishIds();
  let shuffledPool = weightedShuffle(pool, cuisineWeight).filter((id) => !previousIds.has(id));
  if (shuffledPool.length < DAYS.length) {
    // Fallback: nimm auch bekannte Gerichte, damit wir 7 zusammenbekommen.
    // Weighted bleibt aktiv — Praeferenzen sollen auch im Fallback wirken.
    shuffledPool = weightedShuffle(pool, cuisineWeight);
  }

  // Random-Start (Cuisine-gewichtet, previousIds gemieden).
  const startAssignment = {};
  DAYS.forEach((day, i) => { startAssignment[day] = shuffledPool[i]; });

  // Ziel-orientierte Optimierung: Greedy-Swap gegen Wochen-Sollwerte.
  // Bei unvollstaendigem Profil greift getTargetProfile auf Standard-
  // Profil zurueck — Optimizer laeuft immer.
  const profile = getTargetProfile();
  const optimized = optimizeAssignment(startAssignment, pool, profile);

  DAYS.forEach((day) => {
    state.assignment[day] = optimized[day];
    state.selected[day] = false;
    // Portionen springen auf den User-Standard (settings.defaultPortions).
    state.portions[day] = state.settings.defaultPortions;
  });
  state.dishBag = {};
  // checkedShopping bleibt unangetastet — bereits gekaufte Artikel bleiben
  // erhalten, auch wenn die neuen Gerichte sie evtl. nicht mehr enthalten
  // (dann als Leftover sichtbar). Fuer einen echten Reset gibt es den
  // separaten Reset-Button in der Einkaufsliste.
}
```

- [ ] **Step 3.4: Build-Check ausführen**

```bash
npm run build
```

Erwartete Ausgabe: `www/` wird gebaut, keine Fehler. Wenn Fehler auftauchen (Import-Pfad, Syntax): fix inline und nochmal.

- [ ] **Step 3.5: Commit**

```bash
git add src/dashboard/reroll.js
git commit -m "feat(reroll): ziel-orientierter rerollAll und refillBag"
```

---

## Task 4 — Sanity-Script

**Files:**
- Create: `scripts/reroll-sanity.js`

**Steps:**

- [ ] **Step 4.1: Ordner-Existenz prüfen**

```bash
ls scripts/ 2>/dev/null || mkdir scripts
```

- [ ] **Step 4.2: `scripts/reroll-sanity.js` anlegen**

```js
// Sanity-Script fuer den Ziel-orientierten Reroll.
//
// Simuliert 100x rerollAll fuer mehrere Profile-Konstellationen und printet
// Vorher/Nachher-Delta-Statistik. "Vorher" = nur Random-Start (aktuelles
// Verhalten pre-Session-27), "Nachher" = Random-Start + Greedy-Swap.
//
// Aufruf: node scripts/reroll-sanity.js

import { allDishes, allDishIds, dishesById, weightedShuffle, shuffled } from '../src/data/dishes.js';
import { dinnerTarget, effectiveMacroTargets, dishScale } from '../src/nutrition/target.js';
import { weekFitness, optimizeAssignment } from '../src/dashboard/optimizer.js';
import { DAYS } from '../src/state.js';

const SIMULATIONS = 100;

// Profile-Konstellationen: verschiedene Presets + Tageskalorien.
// dailyTargetOverride setzt den Wochen-kcal-Bezug fix, macroPreset
// legt die Makro-Verteilung fest.
const PROFILES = [
  { label: 'Ausgewogen @ 2000',    daily: 2000, preset: 'balanced' },
  { label: 'Proteinreich @ 2400',  daily: 2400, preset: 'protein' },
  { label: 'Kohlenhydratarm @ 1800', daily: 1800, preset: 'lowcarb' },
  { label: 'Fettarm @ 2200',       daily: 2200, preset: 'lowfat' },
];

function buildProfile(daily, preset) {
  // Vollstaendiges Profil-Objekt fuer target.js. dinnerKcalOverride wird
  // NICHT gesetzt — dinnerTarget rechnet dann auf DINNER_STANDARD_SHARE
  // (35 %) des daily.
  return {
    gender: 'male',
    age: 40,
    heightCm: 180,
    weightKg: 80,
    activityLevel: 3,
    goal: 'maintain',
    dailyTargetOverride: daily,
    breakfastKcal: null,
    lunchKcal: null,
    dinnerKcalOverride: null,
    macroPreset: preset,
    macroTargets: null,
  };
}

function randomStart(pool) {
  const assignment = {};
  const shuffledPool = shuffled(pool);
  DAYS.forEach((day, i) => { assignment[day] = shuffledPool[i]; });
  return assignment;
}

function assignmentTotals(assignment, profile) {
  const dinner = dinnerTarget(profile);
  let kcal = 0, p = 0, kh = 0, f = 0;
  for (const day in assignment) {
    const dish = dishesById.get(assignment[day]);
    if (!dish) continue;
    const scale = dishScale(dish.kcal, dinner);
    kcal += dish.kcal * scale;
    p    += dish.p    * scale;
    kh   += dish.kh   * scale;
    f    += dish.f    * scale;
  }
  return { kcal, p, kh, f };
}

function targets(profile) {
  const dinner = dinnerTarget(profile);
  const macros = effectiveMacroTargets(profile);
  return {
    kcal: dinner * DAYS.length,
    p:    macros.p * DAYS.length,
    kh:   macros.kh * DAYS.length,
    f:    macros.f * DAYS.length,
  };
}

function absDelta(actual, target) {
  return {
    kcal: Math.abs(actual.kcal - target.kcal),
    p:    Math.abs(actual.p - target.p),
    kh:   Math.abs(actual.kh - target.kh),
    f:    Math.abs(actual.f - target.f),
  };
}

function stat(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    avg: sum / values.length,
    median: sorted[Math.floor(sorted.length / 2)],
    max: sorted[sorted.length - 1],
  };
}

function runSimulation(profile, pool) {
  const t = targets(profile);
  const before = { kcal: [], p: [], kh: [], f: [] };
  const after  = { kcal: [], p: [], kh: [], f: [] };

  for (let i = 0; i < SIMULATIONS; i++) {
    const start = randomStart(pool);
    const startTotals = assignmentTotals(start, profile);
    const startDelta = absDelta(startTotals, t);
    before.kcal.push(startDelta.kcal);
    before.p.push(startDelta.p);
    before.kh.push(startDelta.kh);
    before.f.push(startDelta.f);

    const optimized = optimizeAssignment(start, pool, profile);
    const optTotals = assignmentTotals(optimized, profile);
    const optDelta = absDelta(optTotals, t);
    after.kcal.push(optDelta.kcal);
    after.p.push(optDelta.p);
    after.kh.push(optDelta.kh);
    after.f.push(optDelta.f);
  }

  return { before, after, targets: t };
}

function printReport(label, result) {
  console.log(`\n=== ${label} ===`);
  console.log(`Ziel/Woche: kcal=${result.targets.kcal.toFixed(0)}  P=${result.targets.p.toFixed(0)}  KH=${result.targets.kh.toFixed(0)}  F=${result.targets.f.toFixed(0)}`);
  for (const metric of ['kcal', 'p', 'kh', 'f']) {
    const b = stat(result.before[metric]);
    const a = stat(result.after[metric]);
    const improvement = b.avg > 0 ? ((b.avg - a.avg) / b.avg * 100).toFixed(1) : '0.0';
    console.log(
      `${metric.padEnd(4)}  vorher Ø=${b.avg.toFixed(1)} med=${b.median.toFixed(1)} max=${b.max.toFixed(1)}` +
      `  nachher Ø=${a.avg.toFixed(1)} med=${a.median.toFixed(1)} max=${a.max.toFixed(1)}` +
      `  Verbesserung Ø: ${improvement}%`,
    );
  }
}

// Main
console.log(`Ziel-Reroll Sanity — ${SIMULATIONS} Simulationen pro Profil.`);
console.log(`Pool-Groesse (eligible ohne Filter): ${allDishIds.length} Rezepte.`);

const pool = allDishIds;
for (const p of PROFILES) {
  const profile = buildProfile(p.daily, p.preset);
  const result = runSimulation(profile, pool);
  printReport(p.label, result);
}
```

- [ ] **Step 4.3: Sanity-Script ausführen**

```bash
node scripts/reroll-sanity.js
```

Erwartete Ausgabe: für jedes Profil eine Tabelle mit 4 Zeilen (kcal, p, kh, f), jede mit „vorher"/„nachher"-Statistik und Verbesserungs-Prozentzahl. Positive Prozentzahl = Optimizer reduziert das Delta.

Erwartungshaltung:
- kcal-Verbesserung: mindestens 30-50 % (der Random-Start streut stark, Optimizer sollte hier deutlich helfen)
- Makro-Verbesserung: mindestens 20-40 %

Wenn Verbesserung negativ oder < 10 %: die Fitness-Funktion oder der Pool sind zu klein — nachschauen und ggf. TAU/Formel anpassen.

- [ ] **Step 4.4: Commit**

```bash
git add scripts/reroll-sanity.js
git commit -m "chore(scripts): sanity-script fuer ziel-reroll"
```

---

## Task 5 — Live-Test im Dev-Server

**Files:** keine Änderungen — reine Verifikation.

**Steps:**

- [ ] **Step 5.1: Dev-Server starten**

```bash
npm run dev
```

Vite öffnet den Browser auf `http://localhost:5173`. Wenn nicht: URL aus dem Terminal-Log kopieren.

- [ ] **Step 5.2: Reroll-Verhalten prüfen mit Ausgewogen-Preset**

Im Browser:
1. Settings öffnen → Profil-Sheet → Makro-Preset „Ausgewogen".
2. Dashboard: mehrfach Reroll-All klicken (großer Refresh-Button oben).
3. Nährstoff-Sheet öffnen (Bedarfs-Pille tippen).
4. Delta Soll vs. Ist im Ist-Diagramm prüfen: sollte deutlich enger sein als vor Umbau.

Erwartetes Verhalten: der Ø der 7 Tage liegt kcal-mäßig im Sollbereich (±125 kcal/Tag), Makro-% steht nah am Preset (30/40/30 ± ~5 %).

- [ ] **Step 5.3: Reroll-Verhalten prüfen mit Proteinreich-Preset**

Preset auf „Proteinreich" wechseln, Reroll klicken. Erwartet: P-Anteil ~40 %, sichtbar höher als bei Ausgewogen.

- [ ] **Step 5.4: rerollDay-Verhalten prüfen**

1. Alle 7 Tage in der Einkaufsliste markieren.
2. Einen Tag im Nährstoff-Sheet identifizieren, der stark abweicht (falls einer da ist).
3. Auf die Karte des Tags → Reroll (kleiner Button auf der Karte).
4. Neues Rezept sollte den Wochen-Ø näher ans Ziel bringen (Nährstoff-Sheet erneut öffnen).
5. Mehrfach Reroll auf derselben Karte: Reihenfolge stabil, aber neuer Kandidat mit besserer Fitness kommt tendenziell zuerst.

- [ ] **Step 5.5: rerollDay ohne selected Tage prüfen**

1. Reset der Einkaufsliste (0 Tage selected).
2. Reroll auf einer Karte klicken.
3. Erwartetes Verhalten: der neue Kandidat kommt möglichst nah an 1× dinnerTarget (Einzel-Rezept-Match).

- [ ] **Step 5.6: Fresh-Install-Simulation im Browser**

1. DevTools öffnen → Application → Local Storage → Eintrag `mahlzeit-state-v2` löschen.
2. Seite neu laden. Wizzard startet.
3. Wizzard mit X abbrechen (kein Fertig).
4. Dashboard läuft mit Standard-Profil-Zielen. Reroll klicken.
5. Erwartet: der Wochenplan orientiert sich am 35 %-DGE-Standard (2400 × 0.35 = 840 kcal/Tag), Makros an „Ausgewogen" (Preset-Default des Standard-Profils).

- [ ] **Step 5.7: Wenn alles passt — Merge in beta vorbereiten (nur mit expliziter User-Ansage)**

Kein automatisches Mergen. Nach Live-Test dem User Bescheid geben und auf „merge nach beta" warten.

---

## Task 6 — APK-Bau (nur nach expliziter User-Ansage)

**Files:** `android/app/build.gradle`

**Steps:**

- [ ] **Step 6.1: Version-Bump abstimmen**

Vor Bau mit User klären:
- `versionCode`: aktuell 20 → 21
- `versionName`: aktuell `1.5.0-beta` → z. B. `1.5.1-beta` oder `1.6.0-beta`

- [ ] **Step 6.2: Version in `android/app/build.gradle` setzen**

Zeilen mit `versionCode` und `versionName` finden und aktualisieren.

- [ ] **Step 6.3: `remote-config.js` auf `main` sicherstellen**

```bash
grep -n "GitHub\|raw.githubusercontent" src/remote-config.js
```

Der URL-Slug sollte `main` enthalten, nicht `ziel-reroll`. Wenn er auf einem Feature-Branch zeigt (`⚠️ TEMP FUER LIVE-TEST`), zurücksetzen:

```bash
git checkout -- src/remote-config.js
```

- [ ] **Step 6.4: Build + Sync + APK**

```bash
npm run build
npx cap sync
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
cd ..
ls -lh android/app/build/outputs/apk/debug/app-debug.apk
```

Ergebnis: APK-Größe ≈ 33 MB, Pfad wie oben.

- [ ] **Step 6.5: Version-Commit**

```bash
git add android/app/build.gradle
git commit -m "chore(release): version <NEUE_VERSION> (versionCode <NEUER_CODE>)"
```

---

## Nach Abschluss

Wenn alle Live-Tests grün und User sagt „passt":

1. `ziel-reroll → beta` mergen (Fast-Forward wenn möglich).
2. Beta-APK bauen und testen.
3. Nach Bestätigung: `beta → main` mergen.
4. Stable-APK bauen.

Handoff-Dokument für Session 28 schreiben nach `docs/redesign/handoffs/session-27-to-28.md`.
