# Handoff — Mahlzeit-App Rebuild, Session 14

## Kontext in einem Satz

Session 13 hat den **Onboarding-Wizard** gebaut (5-Step Bottom-Sheet: Über dich / Körper / Alltag / Mahlzeiten / Ergebnis mit Live-Slider), inklusive Auto-Open beim First-Run, Placeholder-Pille im Dashboard, Settings-Trigger in der Daten-Section und Beta-Reset für alle bereits installierten Sessions.

## Pflichtlektüre (in dieser Reihenfolge)

1. **`CLAUDE.md`** — projekt-übergreifender Kontext + Guardrails
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — Rebuild-Spec + Roadmap-Tabelle
3. **`docs/redesign/2026-07-26-onboarding-design.md`** — Session-13-Design (frisch)
4. **`docs/redesign/2026-07-26-session-13-plan.md`** — Session-13-Plan (14 Tasks, alle abgehakt)
5. **`docs/redesign/backlog.md`** — offene Ideen: Multi-Profile (jetzt aktueller weil Name-Feld gebaut ist)
6. **`docs/redesign/handoffs/session-11-to-12.md`** — Vor-Vorgänger (Makro-Popup)

## Aktueller Repo-Zustand

- **Branch:** `redesign` (lokal, alle Session-13-Commits vorhanden — noch **nicht** gepusht)
- **Session-13 Commits (neueste zuerst):**
  - `fix(onboarding): fertig committet stille defaults, später bleibt null-safe`
  - `feat(nutrition): mahlzeiten-slider in 10-kcal-schritten`
  - `fix(settings): renderMealRow null-safe für frühstück/mittag ohne wert`
  - `fix(onboarding): sheet slidet nicht mehr weg beim step-wechsel`
  - `feat(onboarding): auto-open beim allerersten app-start`
  - `feat(settings): einrichtung-starten-button in daten-section`
  - `feat(dashboard): placeholder-pille als wizard-trigger bei unvollständigem profil`
  - `feat(onboarding): step 5 (ergebnis) mit live-slider`
  - `feat(onboarding): step 4 (mahlzeiten) — frühstück/mittag slider`
  - `feat(onboarding): step 3 (alltag) — aktivität/ziel chips`
  - `feat(onboarding): step 2 (körper) — größe/gewicht slider`
  - `feat(onboarding): step 1 (über dich) — name/gender/alter`
  - `feat(onboarding): step-navigation mit zurück/weiter/fertig`
  - `feat(onboarding): sheet-gerüst mit header/progress/footer-slot`
  - `chore(branding): app-name auf 'Mahlzeit Beta' (nur redesign)`
  - `feat(state): profile-slots nullen + isProfileComplete + beta-reset migration`
  - `docs(redesign): session 13 implementation plan (onboarding wizard)`
  - `docs(redesign): onboarding wizard design (session 13)`
- **Working Tree:** sauber
- **Dev-Server:** `npm run dev` (Port 5173)

## Was in Session 13 gebaut wurde

### Onboarding-Wizard (`src/onboarding/`, NEU)

Bottom-Sheet-Komponente analog zu Detail-/Settings-/Makro-Sheet (88vh, z-index 1300), aber ohne Swipe-to-Close (Fortschritt könnte verloren gehen).

**Trigger:**

1. **Auto-Open beim allerersten App-Start** — Prüfung in `main.js` nach `loadState()`: wenn `state.settings.onboardingSeen === false`, öffnet der Wizard automatisch. Das Flag wird beim Öffnen sofort auf `true` gesetzt + persistiert (kein Re-Trigger bei Crash).
2. **Placeholder-Pille im Dashboard** — statt leerer Bedarfs-Zeile rendert `calorie-bar.js` bei unvollständigem Profil eine CTA-Pille "Einrichtung starten". Klick öffnet Wizard.
3. **Button "Einrichtung starten" in Settings > Daten** — immer sichtbar, auch nach ausgefülltem Profil. Für spätere Anpassungen von Zielen etc.

**5 Steps (Progress-Bar zeigt "Schritt X von 5"):**

- Step 1 *Über dich* — Name (optional Text-Input) + Geschlecht (2 Chips) + Alter (Stepper)
- Step 2 *Körper* — Größe + Gewicht (Slider 140–220 cm / 40–200 kg)
- Step 3 *Alltag* — Aktivität (5-Chip-Reihe scrollbar) + Ziel (3 Chips: Abnehmen/Halten/Aufbauen)
- Step 4 *Mahlzeiten* — Frühstück + Mittag (Slider 100–1000 kcal, Step 10)
- Step 5 *Ergebnis* — Tagesbedarf (mit Slider zum Feintunen 1000–4000 kcal Step 50), Frühstück/Mittag (Anzeige), Abendessen (berechnet), 4-Pillen-Makro (P/KH/F/kcal aus `balanced`-Preset)

**Draft-Persistenz-Regeln:**

- Wizard hält lokalen `draft` + `touched`-Object, pre-fillt aus `state.settings.profile`
- **"Fertig" (Step 5) → `finishAndClose`**: schreibt ALLE Draft-Werte + fällt bei null-Slots auf `DEFAULTS` zurück (außer `name` und `dailyTargetOverride` — die bleiben optional). Damit ist das Profil garantiert vollständig, `isProfileComplete()` = true, Placeholder-Pille verschwindet
- **"Später" / Backdrop → `persistAndClose`**: schreibt nur `touched === true` Felder. Nicht-touched bleiben null → Placeholder-Pille bleibt (User weiß dass er noch nicht durch ist)
- Diese Trennung war ein Fix während E2E-Test (User klickte "Fertig" ohne Slider zu bewegen → Pille blieb; Design-Regel angepasst)

### State-Änderungen (`src/state.js`)

- `profile.name: null` — NEU, string | null, für persönliche Copy ("Fertig, Oliver.") und Multi-User-Vorbereitung
- `profile.gender/age/heightCm/weightKg/activityLevel/goal/breakfastKcal/lunchKcal` — alle auf `null` gezogen (waren vorher pragmatische Defaults 40/180/80/3/'maintain'/400/700). Der Wizard ist die einzige Eingabequelle.
- `settings.onboardingSeen: false` — NEU, boolean, verhindert Auto-Re-Trigger
- `MEAL_KCAL_STEP` in `nutrition/target.js` von 25 auf 10 gezogen (für feinere Frühstück/Mittag-Anpassung im Settings + Wizard)

### Beta-Reset-Migration

`loadState()` erkennt alte Sessions am fehlenden `onboardingSeen`-Key im geladenen Storage. Bei Treffer werden alle 8 Wizard-Slots auf null gezogen — unabhängig davon was drin steht. Nach dem ersten `saveState()` mit neuer App-Version ist `onboardingSeen: true` gesetzt, Migration greift nicht mehr. Andere State-Teile (Assignment, Präferenzen, Küchen, `showCalorieBar`, `macroPreset` etc.) bleiben erhalten.

### `isProfileComplete()` (`nutrition/target.js`)

Neue Guard-Funktion neben dem bestehenden `hasProfile()`:

- `hasProfile()` bleibt biometrisch (Gender + Age + Height + Weight) — wird von `bmr()`/`dailyTarget()` genutzt
- `isProfileComplete()` ergänzt um `activityLevel + goal + breakfastKcal + lunchKcal` — steuert Placeholder-Pille im Dashboard
- Name ist **nicht** Teil beider Checks — Name ist optional

### Beta-Branding

- `capacitor.config.json` `appName` von `"Mahlzeit Neu"` auf `"Mahlzeit Beta"`
- `android/app/src/main/res/values/strings.xml` `app_name` + `title_activity_main` auf `"Mahlzeit Beta"`
- Package-ID unverändert `com.mahlzeit.myapp.dev` (Suffix `.dev` existiert schon in `android/app/build.gradle:12`)
- **Vor Merge auf `main`:** Beta-Branding + Suffix zurückbauen

### Settings-Sheet Änderungen

- **Daten-Section aktiviert** — vorher komplett "Kommt bald", jetzt erste Row mit Button "Einrichtung starten" (immer sichtbar). "Kommt bald — Backup exportieren/importieren, Alle Daten zurücksetzen" bleibt als soft-note darunter für Iteration 7
- **`renderMealRow` null-safe** — Frühstück/Mittag zeigen "—" wenn null, Slider fällt auf Range-Mitte als visuelle Position zurück (kein State-Berühren)

## Aktueller State-Snapshot

```js
state = {
  // ... unverändert
  settings: {
    // ...
    onboardingSeen: true,           // NEU, false = Auto-Open beim nächsten Start
    profile: {
      name: null | string,          // NEU, optional
      gender: null | 'male'|'female',
      age: null | number,           // war: 40
      heightCm: null | number,      // war: 180
      weightKg: null | number,      // war: 80
      activityLevel: null | 1..5,   // war: 3
      goal: null | 'maintain'|'lose'|'gain', // war: 'maintain'
      dailyTargetOverride: null | number,
      breakfastKcal: null | number, // war: 400
      lunchKcal: null | number,     // war: 700
      showCalorieBar: true,
      macroPreset: 'balanced',
      macroTargets: null,
    },
  },
}
```

`STORAGE_KEY = 'mahlzeit-state-v2'` unverändert.

## Code-Struktur (Deltas Session 13)

```
src/
  onboarding/                       ← NEU (ganzer Ordner)
    wizard.js                       ← Sheet-Mount + Navigation + Draft + finishAndClose/persistAndClose
    steps.js                        ← DEFAULTS-Konstante + renderStep1..4 + Field-Renderer
    result.js                       ← Step 5 mit resolvedProfile + macrosForKcal + refreshResultDynamic
  dashboard/
    calorie-bar.js                  ← + dritter Pfad für Placeholder-Pille
    render.js                       ← Signatur erweitert um onOpenOnboarding-Callback
  settings/
    render.js                       ← Daten-Section aktiviert + renderMealRow null-safe
  main.js                           ← mountOnboardingWizard + Auto-Open + Callback-Wiring
  state.js                          ← profile.name + onboardingSeen + Beta-Reset in loadState
  nutrition/
    target.js                       ← isProfileComplete + MEAL_KCAL_STEP 25→10

styles/
  components/
    onboarding-wizard.css           ← NEU (Sheet + Progress + Steps + Buttons + Result-Cards)
    calorie-bar.css                 ← + .calorie-bar--empty + .calorie-bar__cta
    settings-sheet.css              ← + .settings-action-btn + .settings-section__note--soft

index.html                          ← + onboarding-wizard CSS-link + <div id="onboarding-root">
capacitor.config.json               ← appName = "Mahlzeit Beta"
android/app/src/main/res/values/strings.xml ← app_name + title_activity_main = "Mahlzeit Beta"

docs/redesign/
  2026-07-26-onboarding-design.md   ← Session-13-Spec (Commit 0efd1ea)
  2026-07-26-session-13-plan.md     ← Session-13-Plan (Commit 8726cbb)
  handoffs/session-13-to-14.md      ← DIESER HANDOFF
```

## Verifikation

- **Vite-Build:** sauber (14× während Session, plus finaler Sync)
- **npx cap sync:** sauber
- **Node-Sanity-Check `isProfileComplete()`:** 3/3 richtig (empty=false, nur hasProfile=false, komplett=true)
- **Browser-E2E-Test durch User:** durchgelaufen mit 4 Bugfix-Iterationen während des Tests:
  1. `sheet-slide`: renderShell() setzt `.is-open`-Klasse jetzt direkt ins HTML wenn Sheet schon offen ist (verhindert Weg-Sliden bei Weiter/Zurück)
  2. `meal-null`: `renderMealRow` in Settings ist null-safe (zeigt "—" statt Crash)
  3. `meal-step`: Slider auf 10-kcal-Schritte (statt 50) — feinere Steuerung
  4. `fertig-defaults`: "Fertig" committet auch stille Defaults für nicht-touched Slider (sonst blieb Placeholder-Pille trotz "Fertig")

## Wo weitermachen — Session 14

Am Ende von Session 13 wurde kein spezifisches nächstes Ziel abgestimmt — der Backlog aus dem Handoff Session 12→13 hat mehrere Optionen. In Prio-Reihenfolge:

### Iteration 5 — Dark Mode

- M3 Dark Palette in `tokens.css` — alle `--md-sys-color-*` bekommen Dark-Varianten
- `@media (prefers-color-scheme: dark)` als Auto-Modus + Manual-Override in Settings (Auto/Hell/Dunkel)
- `state.settings.theme` steuert den Modus (existiert schon als 'auto', noch nicht funktional)
- **Neue Herausforderung:** Chart-Farben (`--chart-color-*`) müssen auch im Dark Mode gut aussehen. Frosted-Glass-Pillen (rgba weiß) brechen im Dark Mode — brauchen dunkle Variante
- **Beachten:** MainActivity.java setzt `setAppearanceLightStatusBars(true)` hart — muss dynamisch werden
- **Onboarding-Wizard**: nutzt bereits `--md-sys-color-surface` etc., sollte Dark-Palette mitziehen

### Iteration 6 — Akzentfarbe / Dynamic Color

- Prüfen ob `capacitor-android-dynamic-color` (Community Plugin) wartungsstabil ist
- Falls ja: `WallpaperColors.primaryColor` als CSS-Var für alle primary-basierten Tokens
- Fallback: manueller Farbwähler in Settings (5–6 Presets)

### Iteration 7 — Datenverwaltung

- Export: `state` als JSON zum Download / Clipboard
- Import: JSON parsen, in `state` schreiben, `saveState()`, `refresh()`
- "Alle Daten zurücksetzen" mit Bestätigungs-Dialog
- Passt in Settings > Daten-Section (dort sitzt schon der Onboarding-Trigger, plus soft-note "Kommt bald")

### Multi-Profile (Backlog, größer)

- Größere Umstellung: `state.settings.profiles: [...]`, per-Tag Diner-Assignment
- Rezept-Skalierung pro Person → Aggregat für Einkaufsliste
- Wochen-Bar + Makro-Popup pro aktivem Profil oder Umschalter
- **Vorbereitet durch Session 13:** `profile.name` existiert bereits, kann als Anker für die erste Person dienen. Wizard-Struktur (5 Steps) läuft dann pro Profil

### Persönliche Copy (Follow-Up zu Namensfeld)

Session 13 hat `profile.name` eingeführt, aber genutzt wird er nur im Ergebnis-Screen ("Fertig, {Name}.") und den Wizard-Titeln. Mögliche Erweiterungen:

- Shopping-List Success-Message: "Alles eingekauft, {Name}."
- Bedarfs-Pille im Dashboard: Ø-Label kann personalisiert werden
- Detail-Sheet-Empty-State-Meldungen

Klein, aber sichtbar — könnte als Aufwärm-Tag vor einer größeren Iteration passen.

## Constraints (aus CLAUDE.md, aktuell)

- **Kein Framework** ohne Rückfrage — Vanilla JS + ES Modules
- **Keine Tests** (Solo-Projekt) — Node-Simulation für Randfälle
- **Deutsche UI-Strings, Du-Ansprache**
- **Touch-Targets ≥ 48 px** (Ausnahme: Card-Overlay-Pillen 26 dp, edit-pill 40 dp, Refresh-Icon-Btn 32 dp, Chart-Bars 9 dp)
- **Storage-Key `mahlzeit-state-v2`** unveränderlich ohne Migration
- **Package-ID mit `applicationIdSuffix ".dev"`** auf `redesign` — vor Merge auf main zurücknehmen
- **App-Name `"Mahlzeit Beta"`** auf `redesign` — vor Merge auf main zurück auf `"Mahlzeit"`
- **Zutaten-Wiederverwendung (Guardrail #8)** — beim Rezept-Anlegen immer prüfen ob key existiert

## User-Preferences (Feedback-Memories)

- **APK-Build nur auf Anfrage** — kein automatisches Gradle nach jedem Build
- **Progress-Framing** — Zähler in "erledigt/gesamt" statt "offen/gesamt" (positive Framing)

## Bekannte Environment-Constraints

- **Subagent-Worktree-Dispatch schlägt fehl:** Sandbox verweigert `Agent`-Aufrufe. Direktausführung
- **`curl` im Bash-Sandbox** braucht absoluten Pfad (`/usr/bin/curl`)
- **Gradle** braucht JDK 11+ — nutze `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`

## Erster empfohlener Move für Session 14

```bash
git status                                        # sauber, on redesign
git log --oneline -5                              # Session 13 Commits ansehen
cat docs/redesign/handoffs/session-13-to-14.md    # diesen Handoff (Session 13 → 14 Übergang)
```

Session 14 hat keine feste Vorwahl — mit dem User abklären ob **Dark Mode** (naheliegend, weil Onboarding-Sheet neu dazu und Dark-Migration mit anpacken), **Datenverwaltung** (kleinere Iteration, Daten-Section wartet schon) oder **Persönliche Copy** (Aufwärm-Tag). Multi-Profile ist die größte Iteration und braucht eigenes Design.
