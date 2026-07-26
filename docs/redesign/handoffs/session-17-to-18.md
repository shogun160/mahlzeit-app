# Handoff — Mahlzeit-App Rebuild, Session 18

## Kontext in einem Satz

Session 17 hat den **Rechtschreib-Sweep** über Daten (`dishes.json`, `ingredients.json`) und UI-Strings (`src/**/*.js`) gemacht, den **Beta-Suffix entfernt** (App-ID zurück auf `com.mahlzeit.myapp`, Name zurück auf „Mahlzeit"), die Debug-APK gebaut und den **PR #1 von `redesign` nach `main` eröffnet** — der Rebuild ist damit review-ready.

## Pflichtlektüre (in dieser Reihenfolge)

1. **`CLAUDE.md`** — projekt-übergreifender Kontext + Guardrails
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — Rebuild-Spec + Roadmap-Tabelle
3. **PR #1:** https://github.com/shogun160/mahlzeit-app/pull/1 — Rebuild-Merge, aktueller Zustand
4. **`docs/redesign/2026-07-26-kalender-export-design.md`** — Design-Doc, wartet weiter auf Umsetzung
5. **`docs/redesign/backlog.md`** — offene Ideen

## Aktueller Repo-Zustand

- **Branch:** `redesign` (auf `origin/redesign` gepusht)
- **Session-17 Commits (neueste zuerst):**
  - `f71d408 chore(release): beta-suffix entfernt, app auf mahlzeit umbenannt`
  - `caa5957 fix(copy): rechtschreibung-sweep ueber daten und ui-strings`
  - `1d3135d docs(handoff): rechtschreibung-sweep als session-17-kandidat`
- **Working Tree:** sauber (nur `.claude/` untracked)
- **PR:** #1 offen, Base `main`, Head `redesign`, 213 Commits / 148 Files / +27.760 −1.383
- **Debug-APK:** `android/app/build/outputs/apk/debug/app-debug.apk` (10 MB, `com.mahlzeit.myapp` ohne `.dev`)

## Was in Session 17 gebaut wurde

### Rechtschreib-Sweep

Systematisch über 4 parallele general-purpose-Subagents ausgeführt (je einer für `dishes.json`, `ingredients.json`, `src/**/*.js`, `index.html`). Agents liefern Fehlerliste, Fixes im Main-Thread.

**Umfang (38 Fixes gesamt):**

- **`src/data/dishes.json` (28 Fixes):**
  - 16× Zeitangaben-Konsistenz: „min" → „Min.", Bindestrich → Halbgeviert „–" in Zeitspannen
  - 5× Anglizismus „finishen" → „vollenden"
  - 1× „stir-fry" → „im Wok schwenken"
  - 1× Anführungszeichen-Escape: `„Reis\"` → `„Reis"` (typografisch schließend)
  - 3× Namens-`&` → „und" (id 23, 26, 29)
  - 1× „Bok Choy" → „Pak Choi" (id 16, Konsistenz zu ingredients + steps)
  - 1× „Zigeuner-" → „Paprika-" (id 12)
  - 1× „halbzeitig" → „auf halber Backzeit"
  - 1× Komma vor Nebensatz „…, bis sie intensiv duftet"

- **`src/data/ingredients.json` (6 Fixes):**
  - „Joghurt 2%" → „Joghurt 2 %" (Leerzeichen vor %)
  - 5× Komma vor Attribut: „Chili, frisch", „Curryblätter, frisch", „Minze, frisch", „Kurkuma, frisch", „Kurkuma, gemahlen"

- **`src/**/*.js` (4 Fixes):**
  - `shopping-list/render.js`: Anredekomma bei „Sauber, ${name}, du hast" (fehlendes Komma vor Name)
  - `settings/render.js`: 2× „Sections" → „Abschnitte" (aria-labels), „Mittagessen" → „Mittag" (Konsistenz zum Onboarding, wo überall „Mittag" steht)

- **`index.html`:** keine Fehler.

**Bewusst nicht angetastet (Kandidaten für spätere Sessions):**

- **Substantiv-Reihungen in Rezept-Namen** (z. B. „Rinderfilet Bohnensalat Chimichurri", „Wildlachs Fenchel Weiße Bohnen") — Design-Entscheidung, keine Rechtschreibung. Betrifft ~10 Rezepte.
- **Duplikat-Verdacht in ingredients.json:**
  - `tomatenpassata` vs. `tomaten_passiert` (semantisch dasselbe — Guardrail 8: Einkaufsliste könnte doppeln)
  - `bohnen_weiss` vs. `bohnen_weiss_gek` vs. `bohnen_cannellini` (drei Weißbohnen-Varianten)
  - `bohnen_schwarz` vs. `bohnen_schwarz_gek`
  - `karotte` vs. `karotten_bunt` (Singular/Plural inkonsistent)
  - `paprika` vs. `paprika_gelb` vs. `paprika_spitz` (Format uneinheitlich)
- **„Pattys"** in id 31 — Grenzfall, im Kochjargon üblich
- **`Za'atar` Apostroph-Typografie** (ASCII vs. U+2019)
- **Englische Markennamen** wie „Chuan-Nan Chopped Chili" (Produktname belassen)

### Beta-Suffix entfernt (release-Vorbereitung)

Alle drei relevanten Files angepasst:

- `android/app/build.gradle`: `applicationIdSuffix ".dev"` + zugehöriger Kommentar-Block entfernt → App-ID wieder produktiv `com.mahlzeit.myapp`
- `android/app/src/main/res/values/strings.xml`: `app_name` und `title_activity_main` von „Mahlzeit Beta" auf „Mahlzeit"
- `capacitor.config.json`: `appName` von „Mahlzeit Beta" auf „Mahlzeit"

**Konsequenz für den Nutzer:** Die neue APK (`com.mahlzeit.myapp`) erscheint im Launcher **neben** der bestehenden Beta (`com.mahlzeit.myapp.dev`) — Beta muss von Hand deinstalliert werden. State geht dabei weg (localStorage an App-ID gebunden).

### Build + Release-Flow

- `npm run build` (Vite 8, 57 Module, 184 KB JS gzipped 48 KB)
- `npx cap sync` (Assets nach `android/app/src/main/assets/public`)
- `./gradlew assembleDebug` mit `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` → `app-debug.apk` (10 MB)
- `git push origin redesign`
- `gh pr create --base main --head redesign` → **PR #1**

---

## Wo weitermachen — Session 18

### Direkte Follow-ups nach PR-Merge

1. **PR #1 mergen** (durch den User) — `main` wird dann zum Rebuild-Stand. Nach dem Merge:
   - `main`-Branch enthält den kompletten Rebuild
   - `mahlzeit-state-v1` (main-alter Storage-Key) ist obsolet, `mahlzeit-state-v2` ist der neue Standard
   - Debug-APK auf Handy installieren (Beta vorher deinstallieren)
2. **`CLAUDE.md` nachziehen:**
   - „Aktueller Status: Rebuild geplant…" umformulieren zu „Rebuild abgeschlossen, main auf v2-Stand"
   - Der Absatz zur Trennung `main` vs. `redesign` ist danach falsch — `main` IST der Rebuild
   - Standard-Workflow-Abschnitte konsolidieren (nur noch der „nach Rebuild"-Flow)
3. **`redesign`-Branch löschen** (lokal + remote) — Rebuild ist gemerged, Branch nicht mehr nötig. Aber: erst wenn User bestätigt hat, dass die APK auf dem Handy läuft.

### Hauptthema-Kandidaten für Session 18

**Kalender-Export** — das ursprünglich geplante Session-17-Thema. Design-Doc `docs/redesign/2026-07-26-kalender-export-design.md` ist komplett. Aufwand ~5h. Details siehe `session-16-to-17.md` §„Wo weitermachen — Session 17".

**Datenverwaltung / Iteration 7** — Export/Import JSON + „Alle Daten zurücksetzen"-Bestätigung. Nützliches Safety-Net.

**Favoriten Weighted-Reroll** — Favoriten häufiger beim `rerollDay`/`rerollAll` ziehen (analog Cuisine-Weighting). Rundet Session-16-Favoriten-Feature ab.

**Einkaufsliste: Mengen anpassen + Custom Produkte** — die zwei neuen Backlog-Ideen (Session 16 dokumentiert), überschneiden sich am Datenmodell, ideal in einer Session.

**Ingredients-Deduplizierung** — die aus dem Rechtschreib-Sweep aufgefallenen Duplikate (siehe oben „Bewusst nicht angetastet"). Guardrail 8-relevant. Braucht Recipe-Impact-Analyse: welche Rezepte referenzieren die Duplikate?

### Kleiner Wiedereinstiegs-Move für Session 18

```bash
git status                              # ist redesign, sauber
gh pr view 1                            # PR-Status prüfen
git log --oneline main..redesign        # was noch nicht auf main ist
```

Falls PR schon gemerged: `git checkout main && git pull` und in Point 2 (CLAUDE.md aktualisieren) einsteigen.

---

## Guardrails-Recap (nach Merge angepasst nötig)

- **Kein Framework** ohne Rückfrage — Vanilla JS + ES Modules
- **Keine Tests** (Solo-Projekt) — Node-Simulation für Randfälle
- **Deutsche UI-Strings, Du-Ansprache**
- **Touch-Targets ≥ 48 px**
- **Storage-Key `mahlzeit-state-v2`** unveränderlich ohne Migration
- **Package-ID `com.mahlzeit.myapp`** (kein `.dev` mehr, seit `f71d408`)
- **App-Name `„Mahlzeit"`** (kein „Beta" mehr, seit `f71d408`)
- **Zutaten-Wiederverwendung (Guardrail 8)** — beim Rezept-Anlegen prüfen ob Key existiert

## User-Preferences (Feedback-Memories, unverändert)

- **APK-Build nur auf Anfrage** — kein automatisches Gradle
- **Progress-Framing** — Zähler in „erledigt/gesamt"

## Bekannte Environment-Constraints

- **Gradle** braucht JDK 11+ mit `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`
- **`curl` im Bash-Sandbox** braucht absoluten Pfad (`/usr/bin/curl`)

## Skill-Empfehlungen für Session 18

- **`superpowers:brainstorming`** vor jedem größeren neuen Thema (Kalender-Export, Datenverwaltung, Ingredients-Dedup) — Requirements/UX vor Code klären.
- **`superpowers:writing-plans`** falls Kalender-Export gestartet wird — Design-Doc ist da, aber Umsetzungs-Plan mit Modul-Reihenfolge hilft (der Handoff `session-16-to-17.md` skizziert 6 Schritte, davon ausgehen).
- **`superpowers:dispatching-parallel-agents`** falls wieder unabhängige Chunks (z. B. Ingredients-Dedup: ein Agent scannt `dishes.json`-Referenzen, einer den Datenbestand, einer die Einkaufslisten-Logik).
- **`handoff`** am Session-Ende.
