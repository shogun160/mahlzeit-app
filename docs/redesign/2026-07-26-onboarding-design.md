# Onboarding-Wizard — Design

**Datum:** 2026-07-26
**Session:** 13
**Branch:** `redesign`
**Status:** Design, noch nicht implementiert

## Kontext

Die App startet bisher ohne Ersteinrichtung: der User sieht sofort das Dashboard mit 7 Tag-Karten und keine Bedarfs-Pille (weil `hasProfile()` bei `gender === null` false liefert). Um überhaupt Kalorien-Feedback zu bekommen, muss er selbst ins Settings-Sheet, die Profil-Section aufklappen und sechs Slider/Chips durchgehen — ohne Erklärung, wofür.

Session 13 baut einen geführten Wizard, der beim allerersten App-Start automatisch aufgeht und den User durch Name, Biometrie, Aktivität, Ziel und Mahlzeiten-Aufteilung führt. Am Ende sieht er sein berechnetes Tagesziel plus Makro-Verteilung und kann letzteres direkt feintunen.

## Ziel

- **Erster Start:** User wird einmal (nicht wiederholt) durch die 5 Wizard-Screens geführt.
- **Kein Zwang:** "Später" schließt den Wizard jederzeit, App bleibt nutzbar.
- **Wiedereinstieg:** Placeholder-Pille im Dashboard und Button in der Daten-Section öffnen den Wizard bei Bedarf erneut.
- **Beta-Reset:** Alle bereits installierten Sessions verlieren einmalig ihre Profil-Werte und laufen durch den Wizard (Beta-Test-Charakter).

## User Flow

```
Frisch installierte App
  → loadState() lädt (leer)
  → main.js sieht onboardingSeen === false
  → Wizard öffnet automatisch als Bottom-Sheet
  → onboardingSeen wird auf true gesetzt, saveState()

Step 1: Über dich      (Name + Geschlecht + Alter)
Step 2: Körper         (Größe + Gewicht)
Step 3: Alltag         (Aktivität + Ziel)
Step 4: Mahlzeiten     (Frühstück-kcal + Mittag-kcal)
Step 5: Ergebnis       (Tagesziel + Slider + Abendessen + Makros + "Fertig")

Fertig  → Draft nach state.settings.profile, saveState(), Sheet schließt
Später  → Draft (nur touched Felder) nach state.settings.profile, Sheet schließt
```

Nach "Später" bei unvollständigem Profil rendert die Bedarfs-Pille im Dashboard als **Placeholder-Pille** ("Einrichtung starten"). Klick öffnet den Wizard erneut, pre-fillt aus aktuellen State-Werten.

Der Button "Einrichtung starten" in der Daten-Section des Settings-Sheets ist **immer** sichtbar (auch nach vollständigem Profil), sodass der User bei Änderung von Zielen jederzeit neu durch den Wizard gehen kann.

## State-Modell

### `state.settings.profile` — Slots auf `null`

```js
profile: {
  name: null,             // NEU: string | null — für persönliche Copy
  gender: null,           // unverändert (war schon null)
  age: null,              // war: 40
  heightCm: null,         // war: 180
  weightKg: null,         // war: 80
  activityLevel: null,    // war: 3
  goal: null,             // war: 'maintain'
  dailyTargetOverride: null,  // unverändert
  breakfastKcal: null,    // war: 400
  lunchKcal: null,        // war: 700
  showCalorieBar: true,   // unverändert
  macroPreset: 'balanced',// unverändert
  macroTargets: null,     // unverändert
}
```

### `state.settings.onboardingSeen: boolean`

Neuer Slot. `true` sobald der Wizard einmal geöffnet wurde (auch bei "Später" — verhindert Re-Auto-Trigger bei jedem App-Start).

### `hasProfile()` und `isProfileComplete()`

- `hasProfile(profile)` bleibt **unverändert** — prüft nur biometrische Vollständigkeit (Gender + Age + Height + Weight). Wird von `bmr()`/`dailyTarget()` genutzt.
- `isProfileComplete(profile)` **neu** in `nutrition/target.js`:
  ```js
  export function isProfileComplete(profile) {
    return (
      hasProfile(profile) &&
      typeof profile.activityLevel === 'number' &&
      (profile.goal === 'maintain' || profile.goal === 'lose' || profile.goal === 'gain') &&
      typeof profile.breakfastKcal === 'number' &&
      typeof profile.lunchKcal === 'number'
    );
  }
  ```
  Name ist **nicht Teil** von `isProfileComplete` — Name ist optional, Placeholder-Pille wird nicht wegen fehlendem Namen gezeigt.

## Migration (Beta-Reset)

Storage-Key bleibt `mahlzeit-state-v2`. `loadState()` bekommt eine Migration:

```js
const isLegacyPreOnboarding = !('onboardingSeen' in loadedSettings);
if (isLegacyPreOnboarding) {
  // Beta-Reset: alle Wizard-Felder auf null, damit Wizard alle User einmal durchführt.
  state.settings.profile.name = null;
  state.settings.profile.gender = null;
  state.settings.profile.age = null;
  state.settings.profile.heightCm = null;
  state.settings.profile.weightKg = null;
  state.settings.profile.activityLevel = null;
  state.settings.profile.goal = null;
  state.settings.profile.breakfastKcal = null;
  state.settings.profile.lunchKcal = null;
}
state.settings.onboardingSeen = loadedSettings.onboardingSeen ?? false;
```

Nach dem ersten `saveState()` mit neuer Version ist `onboardingSeen: true` gesetzt und die Migration läuft nicht mehr. Alles außerhalb der Wizard-Felder bleibt persistiert (Assignment, Präferenzen, Küchen, Portions, dishBag, checkedShopping, view, defaultPortions, maxCookTime, dailyTargetOverride, showCalorieBar, macroPreset, macroTargets, theme).

## Wizard-Sheet

### Grundgerüst

- Bottom-Sheet analog zu Detail-/Settings-/Makro-Sheet
- **Höhe: `88vh`** (identisch zum Settings-Sheet, `styles/components/settings-sheet.css:27`)
- **z-index: 1300** (über Settings-Sheet, weil aus der Daten-Section aufrufbar)
- Slide-up-Animation beim Öffnen, Slide-down beim Schließen
- **Kein Swipe-to-Close** (Fortschritt könnte verloren gehen). Schließen nur über:
  - "Später"-Button im Header (persistiert Draft, setzt `onboardingSeen: true`)
  - Backdrop-Klick (verhält sich identisch zu "Später")

### Header

```
[Später]         Einrichtung
─────░░░░░░░░░░  Schritt 2 von 5
```

- **Zeile 1:** "Später" links (surface-variant-Farbe, kein Border) + Titel "Einrichtung" mittig. Kein X/Y-Zähler rechts.
- **Zeile 2:** Progress-Bar über volle Breite, darüber links das Label "Schritt X von 5".
- Progress-Bar nutzt das bestehende Muster aus `.shop-progress__track` / `.shop-progress__fill` (6 px hoch, `--primary-track` als Basis, `--primary` als Fill, `border-radius: 999px`, `transition: width 250ms cubic-bezier(0.2, 0, 0, 1)`).
- Fill-Berechnung: `currentStep / 5 × 100%` — Betreten Step 1 = 20 %, Ergebnis-Step = 100 %.

### Steps 1–4 (Eingabe)

**Layout pro Step:**

- Große Überschrift (analog Detail-Sheet-Titel)
- Kurze Erklärung (1 Satz, warum brauchen wir das) in on-surface-variant
- Die 2–3 Felder untereinander mit reichlich Whitespace
- Alle Copy-Texte in Du-Ansprache

**Step 1 — Über dich**

- **Name** (Text-Input) — als erstes Feld direkt unter dem Titel
  - Label: "Wie sollen wir dich nennen?"
  - Optional (kann leer bleiben) — Weiter ist nicht blockiert
  - Speichert nach `profile.name` als String, `null` wenn leer
- **Geschlecht** (2 exklusive Chips: Männlich / Weiblich)
  - Stiller Default: keiner vorselektiert bei leerem Draft; pre-fillt aus State bei Re-Öffnen
  - Kein "divers" — Mifflin-St-Jeor kennt nur diese zwei Formeln
- **Alter** (Stepper −/+ wie in Settings)
  - Stiller Default: 40 (Range: 15–100)

**Step 2 — Körper**

- **Größe** (Slider) — Range 140–220 cm, Step 1, stiller Default 180
- **Gewicht** (Slider) — Range 40–200 kg, Step 1, stiller Default 80

**Step 3 — Alltag**

- **Aktivität** (5-Chip-Reihe analog `--nowrap` Filter im Picker) — Levels 1–5 mit den Labels aus `ACTIVITY_LEVELS` (`nutrition/target.js:13`): Sitzend / Wenig aktiv / Moderat aktiv / Aktiv / Sehr aktiv. Stiller Default: 3 (Moderat aktiv)
- **Ziel** (3 exklusive Chips, Labels aus `GOALS` in `nutrition/target.js:22`): Abnehmen / Halten / Aufbauen. Stiller Default: Halten

**Step 4 — Mahlzeiten**

- **Frühstück** (Slider) — Range 100–1000 kcal, Step 50, stiller Default 400
- **Mittag** (Slider) — Range 100–1000 kcal, Step 50, stiller Default 700

### Step 5 — Ergebnis

Reine Anzeige plus einen Slider für Feintuning des Tagesziels.

**Content:**

- Überschrift: "Fertig, {Name}." — fallback auf "Fertig." wenn Name leer
- Sub-Text: "Dein Bedarf ist bereit."
- **Karte 1 — Tages-Bedarf:**
  - Große Zahl (primary-farben, fett): `dailyTarget(profile)` in kcal
  - Refresh-Icon (nur sichtbar wenn Override aktiv), setzt Draft-Override auf `null`
  - Slider (Range 1000–4000 kcal, Step 50) — Startwert = berechneter Vorschlag oder Override
  - Vorschlag-Zeile "Vorschlag: X kcal" (nur sichtbar wenn Override ≠ Vorschlag)
- **Karten-Row — Frühstück | Mittag** (klein, on-surface-variant): geladene Draft-Werte
- **Karte 3 — Abendessen** (betont, primary-farben): `tagesbedarf − frühstück − mittag`
- **Makro-Row:** 4 Pillen (P/KH/F/kcal) analog zum Makro-Popup, basierend auf `balanced`-Preset skaliert auf Abendessen-Wert
- Footer-Hinweis: "Du kannst alle Werte später in den Einstellungen anpassen."

**Live-Update:** Slider-Bewegung ändert Draft-`dailyTargetOverride`, alle abhängigen Zeilen (Abendessen, Makro-Pillen, Vorschlag-Label) rerendern sofort.

### Footer

Fixer Bereich unten mit gleicher Höhe wie andere Sheet-Footer:

- **Step 1:** rechts primary-Button "Weiter"
- **Steps 2–4:** links tertiary "Zurück" + rechts primary "Weiter"
- **Step 5:** links tertiary "Zurück" + rechts primary "Fertig"

## Draft-Persistenz

Das Wizard-Modul hält einen lokalen Draft:

```js
const draft = { name, gender, age, heightCm, weightKg, activityLevel, goal, breakfastKcal, lunchKcal, dailyTargetOverride };
const touched = { name: false, gender: false, /* ... */ };
```

**Regeln:**

- Beim Öffnen: Draft wird aus `state.settings.profile` pre-fillt (bei First-Run = alles `null`).
- **Nur `touched === true`-Felder** landen beim Persistieren im State — Slider, die den stillen Default zeigen aber nicht angefasst wurden, bleiben `null`. Damit greift `isProfileComplete()` weiterhin sauber und die Placeholder-Pille bleibt sichtbar, wenn der User "Später" klickt ohne echte Eingabe.
- **Text-Input `name`:** touched sobald das Feld einen Wert bekommt (auch nach Leeren wieder `null` — dann wird `null` persistiert).
- **Chip-Auswahl:** touched sobald der User aktiv einen Chip klickt (auch wenn dieser Chip bereits als stiller Default vorselektiert war — die aktive Bestätigung zählt). Wenn User weiterklickt ohne Chip-Klick: nicht touched.
- **Stepper/Slider:** touched sobald ein Change-Event feuert (User tippt +/− oder zieht Slider). Reines Weiterklicken ohne Berührung zählt nicht als touched, auch wenn Slider einen Wert anzeigt.

**Speicherpunkte:**

- **"Fertig" (Step 5):** touched-Felder werden nach `state.settings.profile` gemergt, `saveState()`, Sheet schließt mit Slide-down-Animation.
- **"Später" (jeder Step):** identisch zu "Fertig" — touched-Felder werden persistiert, Sheet schließt. Kein Alert, kein "bist du sicher".
- **Backdrop-Klick:** identisch zu "Später".
- `onboardingSeen` wird an keinem dieser Punkte gesetzt — das passiert bereits beim Öffnen (siehe *Auto-Open-Logik* unten), damit auch Crashes während des Wizards kein Re-Trigger sind.

## Auto-Open-Logik

In `main.js` nach `loadState()`:

```js
if (state.settings.onboardingSeen === false) {
  openOnboardingWizard();
}
```

Nach dem Öffnen setzt der Wizard sofort `state.settings.onboardingSeen = true` und ruft `saveState()` — bevor der User irgendetwas tut. Damit ist auch ein App-Crash oder Force-Kill während des Wizards kein Wiederholungs-Trigger.

## Placeholder-Pille (Dashboard)

`renderCalorieBar()` in `src/dashboard/calorie-bar.js` bekommt drei Pfade:

1. **`showCalorieBar === false`** → return `''` (heutiges Verhalten, User hat Pille bewusst versteckt)
2. **`isProfileComplete(profile) === true`** → normale Bedarfs-Pille (heutiges Verhalten)
3. **`isProfileComplete(profile) === false`** → Placeholder-Pille:
   ```html
   <button class="calorie-bar calorie-bar--empty" type="button" data-action="open-onboarding" aria-label="Einrichtung starten — Bedarfs-Anzeige aktivieren">
     <span class="calorie-bar__label">Bedarf</span>
     <span class="calorie-bar__values">
       <span class="calorie-bar__cta">Einrichtung starten</span>
     </span>
   </button>
   ```

**Styling:** `.calorie-bar--empty` erbt die Basis-Geometrie (Frosted-Glass, Radius, Höhe). Text zentriert, dezent primary-farben. Kein Ø-Wert, kein Zielkorridor.

**Handler:** `data-action="open-onboarding"` löst `openOnboardingWizard()` aus.

## Settings-Button (Daten-Section)

Die bereits existierende `daten`-Section in `src/settings/render.js:188` wird aktiviert:

- CSS-Klasse `settings-section-body--soon` wird für die erste Row entfernt (Onboarding-Trigger ist die erste echte Aktion)
- Row zeigt Button "Einrichtung starten" (immer sichtbar, egal ob Profil komplett)
- Klick löst `openOnboardingWizard()` aus
- Darunter bleibt "Kommt bald — Backup exportieren/importieren, Alle Daten zurücksetzen" als Placeholder für Iteration 7

## Code-Struktur

Neue/geänderte Dateien:

```
src/
  onboarding/
    wizard.js              ← NEU: Sheet-Mount, Step-Navigation, Draft-State
    steps.js               ← NEU: Step-Definitionen + Field-Renderer
    result.js              ← NEU: Ergebnis-Screen mit Slider-Live-Update
  dashboard/
    calorie-bar.js         ← + calorie-bar--empty Pfad
  settings/
    render.js              ← Daten-Section: "Einrichtung starten"-Button
    handlers.js            ← + Handler für Wizard-Trigger
  main.js                  ← + mountOnboardingWizard + Auto-Open beim First-Run
  state.js                 ← profile.name + Beta-Reset-Migration + onboardingSeen
  nutrition/
    target.js              ← + isProfileComplete()

styles/
  components/
    onboarding-wizard.css  ← NEU: Sheet + Steps + Progress + Field-Layout
    calorie-bar.css        ← + .calorie-bar--empty + .calorie-bar__cta
    settings-sheet.css     ← + .settings-row__action-btn (Wizard-Trigger)

index.html                 ← + onboarding-wizard CSS-link + <div id="onboarding-root">
```

## Beta-Branding

Parallel-Änderung außerhalb des Onboarding-Codes (nur auf `redesign`, vor Merge auf `main` zurückbauen):

- `android/app/src/main/res/values/strings.xml` — `app_name` auf `"Mahlzeit Beta"`
- `capacitor.config.json` — `"appName": "Mahlzeit Beta"`
- Package-ID bleibt `com.mahlzeit.myapp.dev` (existiert bereits via `applicationIdSuffix`) → Beta-App landet neben Prod-App im Android-Drawer, kein Konflikt

## Guardrails (aus CLAUDE.md)

- Storage-Key `mahlzeit-state-v2` bleibt — Beta-Reset läuft als Migration innerhalb v2, kein Bump nötig
- Package-ID `com.mahlzeit.myapp.dev` auf `redesign` unverändert
- Touch-Targets ≥ 48 px für alle Chips, Buttons, Stepper
- UI-Strings deutsch, Du-Ansprache
- Kein Framework — Vanilla JS + ES Modules
- Bilder als externe Dateien (nicht anwendbar — Wizard hat keine Bilder)

## Accessibility

- Sheet: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` verweist auf Step-Titel
- Progress-Bar: `role="progressbar"` mit `aria-valuenow` (currentStep) und `aria-valuemax` (5)
- Focus-Trap innerhalb des Sheets, initial fokussiert das erste interaktive Element pro Step
- "Später" und Backdrop-Klick haben identisches Verhalten (dokumentiert im Code-Kommentar)

## Testing

- **Node-Simulation** für Rand-Cases:
  - `isProfileComplete()` mit gemischt-`null`-Profil
  - Migration mit legacy Storage (`onboardingSeen` fehlt, alte Defaults werden genullt)
  - Draft-Persistenz mit teilweise `touched`-Feldern (nicht-touched Felder bleiben `null`)
- **Browser-Test:**
  - 5 Screens durchklicken, Progress-Bar-Animation prüfen
  - Ergebnis-Screen-Rechnung gegen `dailyTarget()` verifizieren
  - Slider-Live-Update in Ergebnis (Abendessen + Makros updaten)
  - Placeholder-Pille erscheint nach "Später" bei leerem Draft
  - Placeholder-Pille verschwindet nach "Fertig" mit vollständigem Draft
- **APK-Build erst auf Anfrage** (Präferenz aus Memory).

## Out-of-Scope

Bewusst nicht Teil dieses Wizards, gehört in andere Iterationen:

- **Makro-Preset-Picker im Wizard** — Makros starten auf `'balanced'`, Feintuning bleibt im Makro-Popup (Session 12)
- **Multi-User** (Backlog)
- **Export/Import + kompletter Daten-Reset** (Iteration 7)
- **Dark Mode** (Iteration 5)
- **Wizard-Skip mit Bestätigungs-Dialog** — "Später" schließt sofort, kein "bist du sicher"

## Erster Implementierungsschritt

`writing-plans`-Skill baut daraus einen Session-13-Plan mit Reihenfolge:

1. State + Migration + `isProfileComplete()`
2. Wizard-Sheet-Gerüst (Header, Progress, Footer, Navigation ohne Content)
3. Steps 1–4 (Field-Renderer + Draft + `touched`)
4. Step 5 (Ergebnis + Slider-Live-Update)
5. Placeholder-Pille + Daten-Section-Button
6. Auto-Open-Logik in `main.js`
7. Beta-Branding-Config
