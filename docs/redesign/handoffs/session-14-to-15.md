# Handoff — Mahlzeit-App Rebuild, Session 15

## Kontext in einem Satz

Session 14 hat **Dark Mode** komplett umgesetzt (Auto/Hell/Dunkel-Toggle in Settings, System-`prefers-color-scheme`-Support, dedizierte Dark-Palette mit WCAG-geprüften Kontrasten, On-Glass-Tokens für Foto-Overlays), plus als Folge-Politur alle Cards von Outlined- auf **M3-Filled-Style** umgestellt und die Surface-Palette auf neutrales Anthrazit gezogen.

## Pflichtlektüre (in dieser Reihenfolge)

1. **`CLAUDE.md`** — projekt-übergreifender Kontext + Guardrails
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — Rebuild-Spec + Roadmap-Tabelle
3. **`docs/redesign/2026-07-26-session-14-plan.md`** — Session-14-Plan (Dark Mode)
4. **`docs/redesign/backlog.md`** — offene Ideen (Favoriten, Kalender-Integration, Multi-Profile)
5. **`docs/redesign/handoffs/session-13-to-14.md`** — Vor-Vorgänger (Onboarding-Wizard)

## Aktueller Repo-Zustand

- **Branch:** `redesign` (lokal, alle Session-14-Commits vorhanden — noch **nicht** gepusht)
- **Session-14 Commits (neueste zuerst):**
  - `fix(onboarding): abendessenkontingent-vorschau doch wieder live`
  - `docs(backlog): google health / health connect sync`
  - `style(onboarding): abendessen-vorschau nicht live + makros als schlichte pills`
  - `feat(onboarding): makro-verteilung-vorschau auf filter-step`
  - `feat: mehrere ux-verbesserungen` (Slider readonly, Theme-Pills, Alltag-Vorschau)
  - `feat(onboarding): x-button oben rechts speichert als entwurf`
  - `fix(macro-popup): slider disabled + handle-swipe wie detail/settings`
  - `docs(redesign): handoff session 14 → 15` (initiale Version)
  - `docs(backlog): favoriten-gerichte als spätere personalisierung`
  - `style(cards): filled-style statt outlined (m3-standard)`
  - `style(dark-mode): surface-palette auf neutral-anthrazit`
  - `fix(dark-mode): foto-overlay-pills anthrazit im dark, weiß im light`
  - `feat(android): statusbar-icons je nach system-dark-mode dynamisch`
  - `feat(settings): theme-toggle in darstellung-section (auto/hell/dunkel)`
  - `feat(theme): applyTheme setzt data-theme am html-element beim start`
  - `feat(header): logo weiß im dark mode via brightness+invert filter`
  - `refactor(styles): foto-overlays nutzen on-glass token (theme-stabil)`
  - `refactor(styles): frosted-pillen + backdrops + warn auf tokens`
  - `feat(tokens): dark-palette + frosted-glass + semantic + on-glass tokens`
  - `docs(backlog): kalender-integration (ics-export oder direkter eintrag)`
  - `docs(redesign): session 14 plan aktualisiert (on-glass + fundierte farben)`
  - `docs(redesign): session 14 implementation plan (dark mode)`
- **Working Tree:** sauber
- **Dev-Server:** `npm run dev` (Port 5173)

## Was in Session 14 gebaut wurde

### Token-Setup in `tokens.css`

Neue Tokens im `:root`:

- **Frosted-Glass** — `--frosted-glass` (0.78 Weiß), `--frosted-glass-strong` (0.88 Weiß). Im Dark: `rgba(0,0,0,0.4)` bzw. `0.55`
- **Overlay-Backdrop** — `--overlay-backdrop: rgba(15,23,42,0.42)` für Modal-Backdrops. Im Dark: `rgba(0,0,0,0.6)`
- **Semantic-Warn** — `--semantic-warn: #b3541e` (Kalorien-über-Zustand). Im Dark: `#FB923C`
- **On-Glass** — `--md-sys-color-on-glass: #0F766E` (permanent-teal für Text auf weißen Foto-Overlays im Light). Im Dark: `var(--md-sys-color-on-surface)` (hell, damit auf anthrazitem Glas lesbar)
- **Chart-Colors-On-Glass** — `--chart-color-kh-on-glass` etc. — permanent Light-Chart-Farben (falls Chart-Farben je in Foto-Overlays landen; aktuell nicht genutzt)

Dark-Palette WCAG-geprüft (via Zweit-Analyse aus Claude App):

- Primary #2DD4BF (9.9:1 auf Surface), on-primary-container #99F6E4
- Surface neutral-anthrazit #1B1D1F (kein Grünstich mehr, wie initial), Skala bis #3A3E42
- On-surface #E3E6E4 (14.7:1), on-surface-variant #A9B0AC
- Chart-Colors heller: kh #FBBF24, p #F87171, f #60A5FA, ok #4ADE80

Zwei Aktivierungs-Pfade: `@media (prefers-color-scheme: dark)` für Auto, `[data-theme="dark"]` für User-Override.

### `state.settings.theme` aktiviert + Toggle-UI

- `applyTheme()` in `main.js`: liest `state.settings.theme` (`'auto' | 'light' | 'dark'`), setzt/entfernt `data-theme` am `<html>`
- Wird beim Start gerufen + nach jedem Theme-Toggle in Settings (via `onThemeChange`-Callback)
- **Toggle-UI** in Settings > `darstellung`-Section: 3 exklusive Chips (Auto / Hell / Dunkel) mit Material-Symbols-Icons (contrast / light_mode / dark_mode), 72dp-Höhe
- Chip-Styling analog M3-Segmented-Button (aktiv = primary-container Background)

### Custom-Farben tokenisiert

Alle relevanten Custom-Farben aus `card.css`, `calorie-bar.css`, `macro-popup.css`, `dish-picker.css`, `sheet.css`, `settings-sheet.css` wandern auf Tokens. Differenzierte Behandlung:

- **Frosted-Pillen** (auf Card-/Sheet-Ground: `.calorie-bar`, `.macro-avg`) → `--frosted-glass`, wechseln im Dark auf schwarz-frosted
- **Foto-Overlays** (auf Dish-Bildern: `.edit-pill`, `.stepper--pill`, `.makro-pill`, `.picker-tile__day-badge`, `.picker-tile__shop`) → auch `--frosted-glass*`-Tokens, damit sie im Dark anthrazit werden statt weiß zu leuchten. Text auf `--md-sys-color-on-glass`
- **Backdrops** (Modal-Overlays) → `--overlay-backdrop`
- **Warnfarbe** → `--semantic-warn`

### Logo im Dark Mode

CSS-Filter statt zweitem PNG-Asset: `filter: brightness(0) invert(1)` → PNG wird schwarz normalisiert und dann invertiert = weiß. Nur im Dark aktiv.

### Android StatusBar dynamisch

`MainActivity.java` liest `Configuration.UI_MODE_NIGHT_YES` und setzt Status-/Navigation-Bar-Icons entsprechend hell/dunkel. `onConfigurationChanged()` fängt System-Wechsel zur Laufzeit ab (`uiMode` ist in `AndroidManifest.xml` bereits in `configChanges` gelistet).

**Trade-off dokumentiert:** Bar-Icons folgen dem System, nicht dem App-Theme-Toggle. Bei App-Override mit gegensätzlichem System-Modus (App hell + System dunkel oder umgekehrt) mismatched die Bar leicht. Für sauberen Sync bräuchte es ein neues `@capacitor/status-bar` Plugin — Kandidat für Session 15.

### Follow-Up-Fixes aus E2E-Test (im Dark Mode getestet)

1. **Foto-Overlay-Pills im Dark anthrazit**: initial waren die weißen Pills auf Dish-Bildern zu grell — auf `--frosted-glass*`-Tokens umgestellt, `on-glass` im Dark auf `on-surface` umgeleitet. Im Light unverändert.
2. **Surface-Palette auf neutral-Anthrazit**: initial mit dezent grünem Stich (`#121412` etc.), umgezogen auf neutrales Anthrazit (`#1B1D1F`) mit kalt-grauem Kohle-Ton.
3. **Cards auf M3-Filled-Style**: statt Outlined (`1px outline-variant`) jetzt Filled (`surface-container-low` Background, kein Border). Betroffen: `.day-card` im Dashboard, `.onboarding-result__card` im Wizard.

### Zusätzlich (nicht Dark Mode)

- **Makro-Presets ausgeschrieben** (`MACRO_PRESETS.label` in `nutrition/target.js`): P-reich → Proteinreich, KH-arm → Kohlenhydratarm, F-arm → Fettarm. Wirkt automatisch im Makro-Popup, Dish-Picker-Filter mitgezogen
- **Filter-Step im Wizard** ergänzt: Ernährungspräferenzen + Küchen + Makro-Verteilung als 4 exklusive Chips (Step 3, vor Ergebnis)
- **Details-Link in Settings** hinter Abendessen umbenannt zu **Makros**

### Follow-Ups nach dem initialen Handoff-Commit

- **Makro-Popup-Slider read-only** — P/KH/F-Slider im Ziel-Verteilung-Bereich sind jetzt read-only (pointer-events:none + tabindex=-1 + aria-disabled statt HTML-`disabled`, damit die Chart-Farbcodierung in voller Intensität sichtbar bleibt). Preset-Wechsel ist der einzige Änderungsweg
- **Makro-Popup Swipe-to-Close** angeglichen an Detail-/Settings-Sheet — Handle-Zone auf 28dp mit grab-Cursor, Body + Slider aus Pointerdown-Handler ausgeschlossen
- **Onboarding-Wizard X-Button oben rechts** — global auf allen Steps, speichert nur touched-Felder als Draft; `isProfileComplete()` bleibt entsprechend false wenn nicht alles gesetzt (Placeholder-Pille bleibt)
- **Theme-Toggle-Buttons als Pills** statt 72dp-Chip-Karten — kompaktere Row mit Icon + Label horizontal
- **Wizard Step 2 (Alltag): Live-Vorschau "Dein Abendessenkontingent"** — ausgegraut mit Abstand am Ende des Steps, rechnet bei jeder Slider-/Chip-Änderung mit
- **Wizard Step 3 (Filter): Makro-Verteilung-Vorschau als Pills** — 3 kompakte F/P/KH-Pills nach den Preset-Chips, aktualisieren sich beim Preset-Wechsel. Kein Donut (kommt erst im Ergebnis-Screen)

- **Kein Framework** ohne Rückfrage — Vanilla JS + ES Modules
- **Keine Tests** (Solo-Projekt) — Node-Simulation für Randfälle
- **Deutsche UI-Strings, Du-Ansprache** (bewusst bei deutsch geblieben statt "High Protein" etc.)
- **Touch-Targets ≥ 48 px**
- **Storage-Key `mahlzeit-state-v2`** unveränderlich ohne Migration
- **Package-ID mit `applicationIdSuffix ".dev"`** auf `redesign` — vor Merge auf main zurücknehmen
- **App-Name `"Mahlzeit Beta"`** auf `redesign` — vor Merge auf main zurück auf `"Mahlzeit"`
- **Zutaten-Wiederverwendung (Guardrail #8)** — beim Rezept-Anlegen immer prüfen ob key existiert

## User-Preferences (Feedback-Memories)

- **APK-Build nur auf Anfrage** — kein automatisches Gradle nach jedem Build
- **Progress-Framing** — Zähler in "erledigt/gesamt" statt "offen/gesamt"

## Bekannte Environment-Constraints

- **Subagent-Worktree-Dispatch schlägt fehl:** Sandbox verweigert `Agent`-Aufrufe. Direktausführung
- **`curl` im Bash-Sandbox** braucht absoluten Pfad (`/usr/bin/curl`)
- **Gradle** braucht JDK 11+ — nutze `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`

---

## Wo weitermachen — Session 15

### Empfohlenes Hauptthema: **Zubereitungs-Schritte in dishes.json angleichen**

Die 32 Rezepte in `www/dishes.json` haben stark unterschiedliche Zubereitungs-Anleitungen — manche 3 knappe Sätze, andere 10+ ausführliche Schritte. Für konsistente UX im Detail-Sheet sollten sie angeglichen werden.

**Offene Design-Fragen für Session-Start:**

1. **Ziel-Anzahl Schritte pro Rezept** — 5–7 als Bandbreite, oder feste 5? Oder je nach Komplexität 4–8?
2. **Detailtiefe** — knapp (Stichwort-artig, imperativ: "Fenchel in Streifen schneiden") oder ausführlich (Kochtechnik-Hinweise, Temperatur, Timing)?
3. **Umfang** — alle 32 Rezepte in einem Rutsch, oder erstmal 5–10 als Muster/Referenz und Rest inkrementell?
4. **Format** — bleiben die Schritte als Array of Strings, oder erweitern zu Objekten mit `{step, timing, technique}` für zukünftige Features (Timer-Integration, Meal-Prep-Reihenfolge)?

**Vorschlag zum Einstieg:**

- Session 15 startet mit einem Brainstorming zu Punkten 1–4
- 5 Referenz-Rezepte auswählen und muster-schreiben, dann Rest inkrementell nachziehen
- Optional: Node-Skript zum Zählen aktueller Schritte/Wörter pro Rezept, um Datenbasis zu sehen

### Andere Kandidaten (falls Priorität wechselt)

**Kleinere Sessions (~½–1 Session):**

- **Persönliche Copy** (~30 min) — `profile.name` außerhalb Wizard nutzen (Shopping-List Success, Dashboard-Header-Grüßung)
- **StatusBar-Plugin für Theme-Sync** (~30–60 min) — löst den Session-14-Trade-off, Bar-Icons folgen App-Toggle statt System
- **Datenverwaltung / Iteration 7** (~1 Session) — Export/Import JSON + "Alle Daten zurücksetzen" mit Bestätigung. Daten-Section wartet schon (soft-note steht drin)
- **Kalender-Integration** (frisch im Backlog) — ICS-Export oder Direkt-Eintrag via Capacitor-Plugin

**Größere Sessions (mehrere ~1 Session):**

- **Akzentfarbe / Dynamic Color** (Iteration 6) — Follow-up zu Dark Mode, Community-Plugin oder manueller Farbwähler
- **Favoriten-Gerichte** (frisch im Backlog) — Herz-Markierung + Weighted-Reroll-Integration
- **Multi-Profile** (Backlog, groß) — mehrere Nutzer, per-Tag-Diner-Assignment, Skalierung pro Person. Braucht eigenes Design-Doc

**Follow-ups aus Session 14 (evtl. inline):**

- Chart-Farb-Feintuning falls in Praxis Kontrast-Feedback kommt
- Splash-Screen Dark-Mode (`styles.xml`)

## Erster empfohlener Move für Session 15

```bash
git status                                        # sauber, on redesign
git log --oneline -5                              # Session 14 Commits ansehen
cat docs/redesign/handoffs/session-14-to-15.md    # diesen Handoff
```

Wenn Zubereitungs-Schritte-Angleichung: als erstes ein Node-Snippet um aktuellen Umfang zu erfassen:

```bash
node -e "
const d = require('./www/dishes.json');
d.dishes.forEach((r) => {
  const stepCount = r.steps?.length ?? 0;
  const wordCount = (r.steps ?? []).join(' ').split(/\s+/).length;
  console.log(String(stepCount).padStart(2), String(wordCount).padStart(4), '—', r.name);
});
"
```

Dann Design-Fragen klären, Muster definieren, Session mit 5 Referenz-Rezepten starten.
