# Session 10 Implementation Plan — Iteration 4: Profil + Tageskalorien

> **Environment note aus Sessions 1-9:** Subagent-Worktree-Dispatch nicht verfügbar. Direktausführung in der Haupt-Session, siehe `docs/redesign/handoffs/session-9-to-10.md`.

**Goal:** Der User füllt in Settings sein Profil aus (Geschlecht, Alter, Größe, Gewicht, Aktivitätslevel, Ziel-Modus). Die App berechnet daraus per Mifflin-St Jeor Formel × PAL-Faktor ± Ziel-Adjustment das persönliche Tageskalorien-Ziel. Im Dashboard erscheint über den Cards eine kompakte Wochen-Bar mit Ist-vs-Ziel-Vergleich (kcal). Ohne ausgefülltes Profil bleibt alles wie vorher — keine Bar, kein Zwang.

**Architecture:**

- **Datenmodell:** Kein Dish-JSON-Update. Ist-Kalorien = `dish.kcal` (immer 1 Portion für den User selbst), unabhängig vom `portions`-Setting. Das aktuelle Card- und Detail-Sheet-Verhalten (skaliert mit portions = Rezept-Total für den Haushalt) bleibt unverändert.
- **State:** Neuer Slot `state.settings.profile: { gender, age, heightCm, weightKg, activityLevel, goal }`. Alle `null` bzw. Defaults bedeuten "nicht ausgefüllt" → keine Wochen-Bar. `loadState()` merged mit sicheren Defaults.
- **Berechnung:** Neues Modul `src/nutrition/target.js` — reine Funktionen ohne State-Abhängigkeit. `bmr(profile)`, `dailyTarget(profile)`, `hasProfile(profile)`. Testbar isoliert (Node-Simulation für Randfälle wenn nötig).
- **Settings-UI:** `src/settings/render.js` — Section `profil` verliert "Kommt bald"-Placeholder, bekommt Profile-Formular (Gender-Chips, Alter-Number-Input, Größe/Gewicht/Aktivität-Slider, Goal-Chips). Handler analog zu Diät/Küchen-Chips (togglet State, ruft `onExternalChange`). Section-Summary zeigt Tagesziel oder "—" bei unvollständigem Profil.
- **Dashboard-UI:** `src/dashboard/calorie-bar.js` — neue Komponente, gerendert von `render.js` zwischen Header und Card-Grid. Zeigt nur, wenn `hasProfile()`. Renderloop läuft mit dem existierenden `refresh()`.
- **Makros:** Bewusst ausgelassen. YAGNI — kcal-Vergleich liefert 90% des Werts, Makro-Slider würde Settings-Komplexität verdoppeln. Eigene Iteration 4b später falls gewünscht.

**Tech Stack:** unverändert. Vite 8.1.5, Vanilla JS (ES Modules), CSS Custom Properties. Keine neuen Packages.

---

## Design-Entscheidungen

| Frage | Entscheidung | Begründung |
|---|---|---|
| Portion-Semantik für Ist-Kalorien | **Immer `dish.kcal × 1`**, unabhängig von `state.portions[day]` | User isst nur seinen eigenen Teller. `portions` beschreibt die Kochmenge für die Einkaufsliste (Haushalt), nicht die persönliche Essmenge. Bei `portions=1` sind Card-Zahl und User-Ist identisch → häufigster Fall. |
| Formel | **Mifflin-St Jeor** (Standard 1990, medizinisch am besten validiert) | Genauer als Harris-Benedict für die heutige Bevölkerung. Standard in Ernährungsberatung. |
| Aktivitätslevel-Skala | 5 Stufen: 1.2 / 1.375 / 1.55 / 1.725 / 1.9 (Sitzend / Wenig / Moderat / Aktiv / Sehr aktiv) | Klassische PAL-Tabelle. Slider mit 5 Rastern besser als Freitext. |
| Ziel-Adjustment | 3 Modi: Halten (±0) / Abnehmen (−500) / Aufbauen (+500) kcal | Standard-Werte für sichere ±0.5 kg/Woche. Kein Custom-Adjustment im MVP. |
| Makro-Ziel | **Nicht in dieser Iteration** | YAGNI. Reine kcal-Anzeige liefert den Kern-Nutzen. |
| Anzeige-Ort | **Wochen-Bar zwischen Header und Card-Grid** im Dashboard | Header ist bereits vollgestopft (Logo, Progress-Chip, Reroll, Burger). Eigene Zeile darunter ist prominent, aber nicht dominant. Nur sichtbar bei ausgefülltem Profil. |
| Anzeige-Inhalt | "Woche: 12.400 / 12.950 kcal · Ø 1.771/Tag" | Ist / Ziel absolut + Tagesdurchschnitt (Ist). Ohne Ist-Details pro Tag (steht schon auf Cards). Ohne Prozent (Bruchzahl ist konkreter). |
| Farbcodierung | Neutral bei ±5% Abweichung, orange bei größerer Über-/Unterdeckung | Dezent, nicht alarmistisch. Health-Feature soll informieren, nicht drängeln. |
| Detail-Sheet Anpassung? | **Nein** | Detail-Sheet zeigt weiterhin `dish.kcal × portions` (Rezept-Total). Wochen-Bar hat andere Semantik (User-Portion). Keine Vermischung. |
| Auf welche Tage bezieht sich "Woche"? | **Alle 7 Tage mit Assignment** — unabhängig von `state.selected` | `selected` ist Einkaufslisten-Kontext ("was koche ich diese Woche"), Ernährung läuft alle 7 Tage. Wenn Tag kein Assignment hat (theoretisch möglich, aktuell nicht): zählt 0. |
| Wo lebt die Berechnungslogik? | Neues Modul `src/nutrition/target.js` | Isoliert testbar, wiederverwendbar. Kein Kopplung an DOM/State. |
| Wo lebt die UI-Komponente? | `src/dashboard/calorie-bar.js` (neu) | Dashboard-spezifisch, analog zu `header.js` / `selection-toolbar.js`. |
| CSS-Datei | `styles/components/calorie-bar.css` (neu) | Ein File pro Component, konsistent mit bestehendem Muster. |
| Persistierung | Merge in `loadState()` mit `null`-Defaults | Alt-Sessions ohne `profile` starten leer → keine Bar. Kein Zwang zum Ausfüllen. |
| Number-Input vs Slider für Alter/Größe/Gewicht | **Slider für Größe/Gewicht/Aktivität**, **Stepper für Alter** | Slider gut für kontinuierliche Werte mit Range. Alter ist kleinerer Range und wird selten geändert → Stepper analog Portionen. |
| Custom PAL-Adjustment (freies Ziel) | **Nicht** | 3 Standard-Modi decken den Kern ab. Custom-Wert = eigene Iteration. |

---

## Voraussetzungen

- Working Directory: `/Users/oliverwosnitza/Documents/Mahlzeit-App`
- Branch: `redesign` (`git branch --show-current` → `redesign`)
- Working Tree: sauber
- Session 9 abgeschlossen (Commits bis `e548938`, plus Session-9-Follow-Ups: Detail-Sheet-Zutaten-Sortierung, Edit-Pill Icon-Button-Style, Picker-Bug "Wenig Zutaten"-Sort)

## Datei-Struktur nach dieser Session

```
Mahlzeit-App/
├── src/
│   ├── state.js                             ← geändert (settings.profile-Slot + loadState-Merge)
│   ├── nutrition/
│   │   └── target.js                        ← NEU (bmr, dailyTarget, hasProfile, weeklyIntake)
│   ├── dashboard/
│   │   ├── render.js                        ← geändert (Calorie-Bar mounten + refreshen)
│   │   └── calorie-bar.js                   ← NEU (Renderer für die Wochen-Bar)
│   └── settings/
│       └── render.js                        ← geändert (Profil-Section aktiviert + Handler)
├── styles/
│   └── components/
│       └── calorie-bar.css                  ← NEU
└── docs/redesign/
    └── 2026-07-26-session-10-plan.md        ← DIESES DOKUMENT
```

## Schritte

### 1. Plan-Dokument (dieses) — DONE beim Schreiben

### 2. `src/nutrition/target.js` anlegen

Reine Berechnungslogik, keine State- oder DOM-Abhängigkeit.

```js
// Mifflin-St Jeor BMR (1990) — Standard-Formel für Grundumsatz.
//   Männlich: 10×kg + 6.25×cm − 5×Alter + 5
//   Weiblich: 10×kg + 6.25×cm − 5×Alter − 161
export function bmr(profile) { ... }

// Tageskalorien-Ziel = BMR × PAL ± Adjustment.
// PAL-Tabelle: 1.2 / 1.375 / 1.55 / 1.725 / 1.9 (Index 1..5).
// Adjustment: maintain 0, lose −500, gain +500.
export function dailyTarget(profile) { ... }

// True wenn Profil vollständig genug für Berechnung.
export function hasProfile(profile) { ... }

// Ist-Kalorien der Woche = Summe dish.kcal über alle 7 Tage mit Assignment.
// Kein portions-Faktor — User isst 1 Portion (siehe Design-Entscheidung).
export function weeklyIntake(assignment, dishesById) { ... }
```

### 3. `state.js` — Profile-Slot ergänzen

```js
settings.profile: {
  gender: null,           // 'male' | 'female' | null
  age: null,              // 16..100 | null
  heightCm: null,         // 140..210 | null
  weightKg: null,         // 40..150 | null
  activityLevel: 3,       // Index 1..5, Default 3 (Moderat)
  goal: 'maintain',       // 'maintain' | 'lose' | 'gain'
}
```

`loadState()` merged mit sicheren Defaults (`gender ?? null`, etc.).

### 4. `src/settings/render.js` — Profil-Section aktivieren

- Placeholder "Kommt bald" + `settings-section-body--soon` entfernen
- Neue Chips/Slider/Stepper einbauen:
  - Gender: 2 Chips (`.pref-chip`) "Weiblich" / "Männlich"
  - Alter: Stepper (analog Standard-Portionen) mit Bereich 16..100, Step 1
  - Größe (cm): Slider 140..210, Step 1
  - Gewicht (kg): Slider 40..150, Step 1
  - Aktivität: Slider 1..5 mit Textlabel unter dem Slider (aktuell aktivStufe)
  - Ziel: 3 Chips (`.pref-chip`) "Halten" / "Abnehmen" / "Aufbauen"
- Handler-Muster analog Cuisines: State setzen, `updateSectionSummary('profil')`, `onExternalChange()` — für Slider erst bei `change`-Event (nicht bei jedem `input`)
- Section-Summary: bei `hasProfile()` → `"1.850 kcal"`, sonst → `""` (leer, konsistent mit anderen leeren Summaries)

### 5. `src/dashboard/calorie-bar.js` anlegen

Renderer-Modul analog zu `header.js`. Exportiert `renderCalorieBar(root, { assignment, dishesById, profile })`.

- Wenn `!hasProfile(profile)` → `root.innerHTML = ''; root.hidden = true;` — Bar unsichtbar
- Sonst: HTML mit Ist / Ziel-kcal, Tagesdurchschnitt
- CSS-Klasse `.calorie-bar--over` / `.calorie-bar--under` bei Abweichung > 5% (für Farbcodierung)

### 6. `src/dashboard/render.js` — Bar mounten

- Neuer DOM-Slot vor dem Card-Grid (existiert vermutlich noch nicht → neuer `<div id="calorie-bar-root">` in `index.html` oder dynamisch injiziert)
- Bei jedem `renderDashboard()`: `renderCalorieBar(root, ...)` mit aktuellen Werten
- Layout-Check: Bar liegt zwischen Header und erstem Card, nicht sticky (scrollt mit)

### 7. `styles/components/calorie-bar.css`

- Zwei Zeilen Layout: Titel "Woche" + Werte "12.400 / 12.950 kcal" · Ø 1.771/Tag
- Padding, background `--md-sys-color-surface-container-lowest`, border-radius `--radius-card`
- Farb-Modifier: neutral, `--over` (leicht warmer Ton), `--under` (leicht kühler Ton)
- Import in `styles/base.css` (oder wo die anderen Component-CSS eingebunden werden)

### 8. Manueller Browser-Test

- Profil leer → keine Bar
- Profil vollständig ausgefüllt → Bar erscheint, Zahlen plausibel
- Profil bearbeiten → Bar aktualisiert live nach `refresh()`
- Reroll → Ist-Wert ändert sich, Ziel bleibt
- App neu laden → Profil persistiert, Bar korrekt

### 9. Vite/APK-Build

- `npm run build && npx cap sync`
- APK-Build via Gradle (Handoff Zeile 183: `JAVA_HOME` setzen)
- Testen auf Android

---

## Nicht im Scope

- Makro-Ziel (P/KH/F-Verteilung) — separate Iteration
- Wochenrückblick / Historie
- Auto-Import (Google Fit / Apple Health)
- Custom-Adjustment (freier kcal-Wert statt ±500)
- Warnung bei extremen Zielen (z. B. Ziel < BMR)
- Anpassung des Detail-Sheets für User-Portion vs Rezept-Portion

## Guardrails (aus CLAUDE.md)

- UI-Strings deutsch
- Storage-Key `mahlzeit-state-v2` unverändert (nur Merge in loadState)
- Kein Framework
- Nach Änderungen: `npm run build && npx cap sync`
