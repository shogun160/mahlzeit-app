# Handoff — Mahlzeit-App Rebuild, Session 13

## Kontext in einem Satz

Session 12 hat das **Makro-Popup** aus der Bedarfs-Pille gebaut (Bar-Chart mit Wochen-Verlauf + Ø + Soll-Säule + 4-Pillen-Anzeige P/KH/F/kcal + Preset-Einstellungen im Popup selbst) und die **Makro-Ziele** ins State-Modell integriert (Presets: Ausgewogen / P-reich / KH-arm / F-arm nach AMDR-Konvention).

## Pflichtlektüre (in dieser Reihenfolge)

1. **`CLAUDE.md`** — projekt-übergreifender Kontext + Guardrails
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — Rebuild-Spec + Roadmap-Tabelle
3. **`docs/redesign/backlog.md`** — offene Ideen: Onboarding + Multi-Profile
4. **`docs/redesign/handoffs/session-10-to-11.md`** — Vor-Vorgänger (Iteration 4 + Picker-Ausbau)

## Aktueller Repo-Zustand

- **Branch:** `redesign` (lokal, gepusht bis inkl. Session-12-Commits)
- **Session-12 Commits (neueste zuerst):**
  - `docs(redesign): handoff session 11 → 12`
  - `feat(macro-popup): chart mit ø + soll-säule, 4 pills, presets im popup`
- **Working Tree:** sauber
- **Dev-Server:** `npm run dev`

## Was in Session 12 gebaut wurde

### Nutrition-Foundation: Makro-Presets + State-Slot

- **4 Presets** in `src/nutrition/target.js` — evidenzbasiert nach AMDR (Acceptable Macronutrient Distribution Range) und Fitness-App-Konvention:
  - **Ausgewogen** — 30/40/30 (P/KH/F) — Zone-Diet Style, Default
  - **P-reich** — 40/30/30 — High-Protein für Muskelaufbau/Sattheit
  - **KH-arm** — 30/25/45 — moderate Low-Carb
  - **F-arm** — 30/50/20 — F an AMDR-Untergrenze, KH-lastig
- **State:** `settings.profile.macroPreset` (`'balanced' | 'protein' | 'lowcarb' | 'lowfat' | null`) + `settings.profile.macroTargets` (`{p, kh, f} in Gramm | null` — Custom-Override sticht Preset).
- **`effectiveMacroTargets(profile)`**: Custom-Override → Preset → Fallback "balanced". Nutzt `effectiveDailyTarget` als kcal-Basis.
- **`macroTargetsFromPreset(kcalTarget, presetKey)`**: rechnet Preset-Prozente in Gramm um, gerundet auf 5g-Rasterung.
- **Migration:** `loadState()` ergänzt die neuen Slots mit sinnvollen Defaults, alte Sessions laufen weiter.

### Settings-Sheet Refactor

- **Refresh-Button** neben Tagesziel-Slider — setzt `dailyTargetOverride` auf `null` → Vorschlag aus Profil greift wieder. Icon nur sichtbar wenn Override aktiv. Position analog zum X im Picker-Filter.
- **"Details"-Link** neben Abendessen (gleiche Optik wie "Vorschlag" beim Tagesziel: `on-surface-variant` Farbe, kein Unterstrich). Klick öffnet das Makro-Popup.
- **Makro-Section wieder entfernt** — die Preset-Chips + Slider + Refresh sind jetzt IM Popup, nicht in Settings. So bleibt die Profil-Section übersichtlich, und der User steuert die Verteilung im Kontext der visuellen Anzeige.

### Dish-Picker: F-arm-Chip + Filter-Umbenennungen

- **F-arm-Chip** neu im Makro-Filter — `macroPct(d).f < 25` (8/32 Gerichte, analog zu Proteinreich 9/32 und KH-arm 10/32).
- **Umbenennung** "Proteinreich" → **"P-reich"** (konsistent mit den Preset-Namen im Popup).
- **Makro-Filter-Reihe** ist `--nowrap` (wie Küchen-Reihe) — Font-Fitter shrinkt jetzt auf `querySelectorAll` alle nowrap-Rows, kleinster Fit gewinnt für alle Chips.
- **Filter-Reihenfolge im Panel** umgestellt: `diet → cuisine → macro → kcal → attr` (schnell/wenig zutaten ganz unten, kalorien-Filter direkt darüber).

### Makro-Popup (`src/dashboard/macro-popup.js`, NEU)

Bottom-Sheet-Komponente analog Detail-/Settings-Sheet (Slide-up, Swipe-to-close, z-index 1200 über Settings).

**Trigger:**
1. Tap auf die Bedarfs-Pille im Dashboard (`.calorie-bar` ist jetzt `<button>` statt `<div>`)
2. Tap auf "Details" neben Abendessen in Settings

**Chart (SVG, viewBox 400×240):**
- **9 Balken:** Mo–So + Ø + Soll. Ein großer Gap vor Ø (`AVG_SEPARATOR_GAP = 12`), Soll direkt neben Ø.
- **Bar-Layout:** feste Breite 9 px ("dicker Strich"), zentriert im Slot, Radius = 4.5 (Halbkreis-Krone oben nur am obersten sichtbaren Segment via `topRoundedRectPath`).
- **Stack-Reihenfolge:** KH unten → P mitte → F oben (F oben wirkt als Krone).
- **Farben (Chart-Tokens in `tokens.css`):**
  - `--chart-color-kh: #D97706` (Amber, Getreide)
  - `--chart-color-p: #B91C1C` (Rot, Muskel/Fleisch)
  - `--chart-color-f: #2563EB` (Blau, Öl)
  - `--chart-color-ok: #15803D` (Grün für Zielband + Ø-Delta-ok)
- **Zielband:** dezent grün (`8% Fill, kein Stroke`), rendert HINTER den Bars.
- **Nicht-selektierte Tage:** voller Stack aber `opacity: 0.35` — sichtbar, aber klar sekundär.
- **Ø-Balken:** Mittelwert der SELECTED Tage (identisch zur kcal-Pille-Semantik im Dashboard).
- **Soll-Balken:** Preset-Verteilung skaliert auf **Range-Mittelwert** (`(rangeLow + rangeHigh) / 2`, in Standard-Fällen = `dinnerTarget`, aber robust bei clamped rangeLow). Volle Farbe, keine Dämpfung — Unterschied zu Ø nur über das Label ("Ø" vs "Soll").
- **Y-Achse:** nur 3 Werte beschriftet — `0` (Boden) + die zwei Zielkorridor-Grenzen (`rangeLow`, `rangeHigh`). Keine Mitte/Max.
- **Tap auf Tages-Balken** → schließt Popup + öffnet Rezept-Detail-Sheet für den Tag.

**Vier separate Pillen unter dem Chart** (Frosted-Glass Weiß + Pill-Radius, identisch zur Bedarfs-Pille):
- Pille P · Pille KH · Pille F · Pille kcal
- **Layout je Makro-Pille:** Buchstabe links (mittig vertikal, in Chart-Farbe, `1.05em`), rechts daneben zweizeilig — g oben, % darunter. Gap 10 px zwischen Buchstabe und Werten.
- **kcal-Pille:** einzeilig, `flex: 0 0 auto`, primary-farben, fett.
- **Font-Fitter:** JS shrinkt von 14 → 10 px in 0.5-Schritten bis alle 4 Pillen in ihre Container-Breite passen. `--macro-avg-font` als CSS-Var auf der Row.
- **Delta-Klasse:** grün wenn ±10% zum Ziel (`.macro-avg__grams--ok`), sonst dezent grau (`--off`). Bewusst kein Warn-Rot — würde mit der roten Protein-Bar kollidieren.

**Controls-Section unten im Popup (`renderControls`):**
- **Header:** Titel "Ziel-Verteilung" + Preset-Hinweis + Refresh-Button (sichtbar wenn Custom-Override aktiv).
- **4 Preset-Chips** (Ausgewogen/P-reich/KH-arm/F-arm) — exklusive Auswahl.
- **3 Slider** (P/KH/F in Gramm, Range 0–400 g, Step 5). Slider-Zug schaltet in Custom-Mode (`macroPreset = null`, `macroTargets = {p,kh,f}`), alle Presets deselektiert.
- **Refresh-Button** setzt zurück auf `preset='balanced'`, `macroTargets=null`.
- **Live-Refresh:** nach jeder Änderung wird Chart + Ø-Anzeige neu gerendert (Delta-Farben ziehen nach). Bar-Hit-Handler werden neu gebunden.

**Nicht (mehr) drin — bewusst rausgenommen nach User-Feedback:**
- **Trendlinie** über die Bar-Tops (war unpassend, hat visuell mit den Segmenten geknabbelt)
- **Ausgewogen-Zone am Ø-Balken** (gestrichelter Rahmen, "was bedeutet der?" — nicht selbsterklärend)
- **%-Verteilung unter den Bars** (zu klein bei 9-px Bar-Breite, kein Platz daneben)
- **Legende** (überflüssig weil P/KH/F-Buchstaben in den Pillen selbst die Farben tragen)

## Aktueller State-Snapshot

```js
state = {
  // ... unverändert bis auf profile
  settings: {
    // ...
    profile: {
      // ... alle bisherigen Felder
      macroPreset: 'balanced',    // 'balanced' | 'protein' | 'lowcarb' | 'lowfat' | null
      macroTargets: null,         // { p, kh, f } in Gramm | null (Custom-Override)
    },
  },
}
```

`STORAGE_KEY = 'mahlzeit-state-v2'` unverändert. `loadState()` migriert alte Sessions defensiv (macroPreset default `'balanced'`, macroTargets default `null`).

## Code-Struktur (Deltas Session 12)

```
src/
  dashboard/
    calorie-bar.js              ← .calorie-bar ist jetzt <button>, Klick öffnet Popup
    macro-popup.js              ← NEU: Bottom-Sheet mit Chart + 4 Pillen + Controls
    render.js                   ← onOpenMacroPopup Parameter durchreichen
  detail-sheet/
    ingredients.js              ← P/KH/F-Anteile bekommen Chart-Farb-Klassen
  dish-picker/
    render.js                   ← macro_lowfat Chip + P-reich Umbenennung +
                                   Filter-Reihenfolge (macro/kcal/attr) +
                                   Font-Fitter auf querySelectorAll
  nutrition/
    target.js                   ← MACRO_PRESETS + macroTargetsFromPreset +
                                   effectiveMacroTargets + MACRO_MIN/MAX/STEP
  settings/
    render.js                   ← Refresh-Btn Tagesziel + "Details"-Link,
                                   alte Makro-Section wieder entfernt (Umzug)
  main.js                       ← mountMacroPopup + Wiring (onOpenMacro Callback)
  state.js                      ← profile.macroPreset + profile.macroTargets

styles/
  components/
    calorie-bar.css             ← <button>-Reset (border/cursor/text-align)
    macro-popup.css             ← NEU: Sheet + Chart + 4 Pillen + Controls
    settings-sheet.css          ← .settings-refresh (Icon-Btn) + .settings-row__label-link
    sheet.css                   ← .ingredient-sum__macro--p/kh/f in Chart-Farben
  tokens.css                    ← --chart-color-kh/p/f + --chart-color-ok

index.html                      ← macro-popup CSS-link + <div id="macro-popup-root">

docs/redesign/
  handoffs/session-11-to-12.md  ← DIESER HANDOFF
```

## Verifikation

- **Vite-Build:** sauber, alle Module laden
- **APK-Build:** funktioniert (auf Anfrage vom User getriggert am Ende der Session)
- **Manueller Browser-Test durch User:** viele Iterationen (Farben, Bar-Breite, Rundung, Pill-Layout, Font-Fitter, %-Labels drin/wieder raus, Soll-Säule ausgegraut/wieder voll) — jede Runde einzeln validiert.

## Wo weitermachen — Session 13

**Am Ende von Session 12 mit User abgestimmt: Session 13 = Onboarding / Ersteinrichtung.**

- **First-Run-Wizard** oder **On-Screen-Anleitung** fürs Profil, jetzt wo die Profil-Struktur inkl. Makros stabil ist. Ansatzvarianten siehe `backlog.md`.
- Trigger-Kriterium überlegen (leerer `profile.gender` als "noch nicht ausgefüllt"?).
- Wizard-UX: modaler Slide-Sheet mit Steps oder direktes Auffordern via Bedarfs-Pille-Placeholder ("Profil ausfüllen — Bedarf anzeigen")?

### Danach — Weitere Optionen

### Iteration 5 — Dark Mode

- M3 Dark Palette in `tokens.css` — alle `--md-sys-color-*` bekommen Dark-Varianten
- `@media (prefers-color-scheme: dark)` als Auto-Modus + Manual-Override in Settings (Auto/Hell/Dunkel)
- `state.settings.theme` steuert den Modus
- **Neue Herausforderung:** Chart-Farben (`--chart-color-*`) müssen auch im Dark Mode gut aussehen. Amber/Rot/Blau bleiben vermutlich, Ziel-Grün muss anpassen. Frosted-Glass-Pillen (rgba weiß) brechen im Dark Mode — brauchen dunkle Variante.
- **Beachten:** MainActivity.java setzt `setAppearanceLightStatusBars(true)` hart — muss dynamisch werden

### Iteration 6 — Akzentfarbe / Dynamic Color

- Prüfen ob `capacitor-android-dynamic-color` (Community Plugin) wartungsstabil ist
- Falls ja: `WallpaperColors.primaryColor` als CSS-Var für alle primary-basierten Tokens
- Fallback: manueller Farbwähler in Settings (5–6 Presets)

### Iteration 7 — Datenverwaltung

- Export: `state` als JSON zum Download / Clipboard
- Import: JSON parsen, in `state` schreiben, `saveState()`, `refresh()`
- "Alle Daten zurücksetzen" mit Bestätigungs-Dialog

### Multi-Profile (Backlog, größer)

- Größere Umstellung: `state.settings.profiles: [...]`, per-Tag Diner-Assignment
- Rezept-Skalierung pro Person → Aggregat für Einkaufsliste
- Wochen-Bar + Makro-Popup pro aktivem Profil oder Umschalter

### Iteration ∞ — Gerichte-Import

- Neue "Meine Gerichte"-Section im Settings-Sheet: Formular oder JSON-Paste
- Bild-Handling: Upload → `public/dishes/` (via Capacitor Filesystem Plugin)
- Zutaten-Wiederverwendung erzwingen (Guardrail #8): existierende Keys anbieten statt neu anlegen

## Constraints (aus CLAUDE.md, aktuell)

- **Kein Framework** ohne Rückfrage — Vanilla JS + ES Modules
- **Keine Tests** (Solo-Projekt) — Node-Simulation für Randfälle
- **Deutsche UI-Strings**
- **Touch-Targets ≥ 48 px** (Ausnahme: Card-Overlay-Pillen 26 dp, edit-pill 40 dp, Refresh-Icon-Btn 32 dp, Chart-Bars 9 dp)
- **Storage-Key `mahlzeit-state-v2`** unveränderlich ohne Migration
- **Package-ID mit `applicationIdSuffix ".dev"`** auf `redesign` — vor Merge auf main zurücknehmen
- **Zutaten-Wiederverwendung (Guardrail #8)** — beim Rezept-Anlegen immer prüfen ob key existiert

## User-Preferences (Feedback-Memories)

- **APK-Build nur auf Anfrage** — kein automatisches Gradle nach jedem Build
- **Progress-Framing** — Zähler in "erledigt/gesamt" statt "offen/gesamt" (positive Framing)

## Bekannte Environment-Constraints

- **Subagent-Worktree-Dispatch schlägt fehl:** Sandbox verweigert `Agent`-Aufrufe. Direktausführung
- **`curl` im Bash-Sandbox** braucht absoluten Pfad (`/usr/bin/curl`)
- **Gradle** braucht JDK 11+ — nutze `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`

## Erster empfohlener Move für Session 13

```bash
git status                                        # sauber, on redesign
git log --oneline -5                              # Session 12 Commits ansehen
cat docs/redesign/handoffs/session-11-to-12.md    # diesen Handoff (Session 12 → 13 Übergang)
```

Session 13 startet mit **Onboarding** (siehe oben). Danach frei aus den anderen Iterationen.
