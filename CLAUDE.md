# Mahlzeit-App — Claude Context

## Was ist die App

Meal-Planner für die Woche: verteilt Gerichte auf 7 Tage, zeigt Rezepte/Zutaten, führt eine Einkaufsliste. Umgesetzt als Web-App, per Capacitor 8 als Android-APK verpackt. Solo-Projekt, primär für Android (iOS technisch möglich, aktuell nicht gebaut).

**Aktueller Status:** Rebuild abgeschlossen (PR #1, gemerged am 2026-07-26). `main` läuft auf der modularen Vite-Struktur (v2). Session-Handoffs unter [`docs/redesign/handoffs/`](docs/redesign/handoffs/) dokumentieren den Umbau, das ursprüngliche Rebuild-Design steht in [`docs/redesign/2026-07-25-rebuild-design.md`](docs/redesign/2026-07-25-rebuild-design.md).

## Nutzer

- Solo-Entwickler, kein professioneller Web-Dev
- Hobby-Projekt, keine kommerziellen Zeitdruck-Deadlines
- Web-Grundlagen (HTML/CSS/JS) sicher, aber wenig Erfahrung mit modernen Frameworks (Vue/React/etc.), Build-Tools (Vite/Webpack) und dem npm-Ökosystem
- Bevorzugt Erklärungen mit "Warum" statt nur "Was", vor allem bei neuen Konzepten
- Kommunikation auf Deutsch

## Kollaboration

- **Kurze, direkte Antworten.** Keine Zusammenfassungen dessen was gerade gemacht wurde — der Diff zeigt es
- **Bei mehreren Optionen:** klare Empfehlung + Trade-off in 2-3 Sätzen. Kein ausführlicher Vergleich, außer explizit angefragt
- **Vor destruktiven Aktionen** (git force-push, `rm -rf`, DB-Änderungen, `npm install` von großen Paketen): explizit Zustimmung holen
- **Neue technische Konzepte kurz einordnen** bevor Code kommt — z. B. "Vite ist ein Build-Tool, macht X, ersetzt Y". Nicht voraussetzen, dass alle Dev-Tools bekannt sind
- **Bei Unsicherheit lieber nachfragen** als raten — vor allem bei Architektur-Entscheidungen und Guardrails

## Landkarte

```
src/                        ← ES-Module (Single Source of Truth)
  main.js                   ← Bootstrap, App-Init
  state.js                  ← State + Persistenz (localStorage v2)
  data/                     ← dishes.json, ingredients.json, dishes.js
  dashboard/                ← Wochen-Übersicht, Cards, Selection-Toolbar
  dish-picker/              ← Gericht-Auswahl mit Filter-Chips + FLIP
  detail-sheet/             ← Rezept-Sheet (Zutaten, Makros, Steps)
  shopping-list/            ← Einkaufsliste, Progress, Done-Banner
  onboarding/               ← Wizard (Personen, Aktivität, Ziel, Kalorien, Theme)
  settings/                 ← Sheet mit Sections (Profil, Ziele, Erscheinungsbild…)
  nutrition/                ← Makro-Berechnung, Bedarfs-Balken
  nav/                      ← Header, View-Switch
  native/                   ← Capacitor-Bridges (Statusbar, Theme)
  util/                     ← Icons, DOM-Helper, etc.
styles/                     ← CSS (Material-3-Palette, Themen, Komponenten)
public/                     ← statische Assets (Icons, Logo, Dish-Bilder)
index.html                  ← minimales Skelett, Views werden zur Laufzeit gerendert
vite.config.js
www/                        ← Vite-Build-Output (npm run build)
android/                    ← Capacitor-generiert, meist nicht direkt editieren
  app/src/main/res/         ← Icons, Splash, styles.xml, strings.xml
  app/build.gradle          ← App-ID, Signing, SDK-Versionen
capacitor.config.json       ← App-ID, App-Name, Plugin-Config
```

**Kernkonzepte:**

- **State:** `state.js` hält Assignment (day → dishId), Selection, Portionen, Shopping-Progress, Profile (Kalorien-Ziele, Favoriten, Theme). Persistenz per localStorage-Key `mahlzeit-state-v2`, Auto-Save via Wrapper + `visibilitychange`.
- **Daten:** `data/dishes.json` (Rezepte) + `data/ingredients.json` (Zutaten-Registry). Zutaten werden per Key referenziert — Guardrail 8 zur Duplikat-Vermeidung.
- **Rendering:** Vanilla ES-Module, kein Framework. Views rendern per `render*()`-Funktion in ihren Container-DOMs, `main.js` orchestriert View-Switch.
- **Theming:** Material-3-Palette in `styles/`, Dark/Light via CSS-Variablen, Statusbar-Sync via `native/`.

## Standard-Workflow

```
Code in src/ oder styles/ ändern
  → npm run dev              # lokaler Vite-Dev-Server mit Hot Reload (Browser)
  → npm run build            # Vite baut nach www/
  → npx cap sync             # kopiert www/ in android/app/src/main/assets/public
  → APK bauen (siehe unten)
  → auf Handy deinstallieren + neu installieren
```

**Debug-APK per CLI:**

```bash
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
# Ergebnis: android/app/build/outputs/apk/debug/app-debug.apk
```

Alternativ Android Studio: Build → Generate App Bundles or APKs → Generate APKs.

**Config-Änderungen:**
- App-Name: `android/app/src/main/res/values/strings.xml` + `capacitor.config.json`
- Statusbar/Plugins: `capacitor.config.json`
- Splash / Theme: `android/app/src/main/res/values/styles.xml`
- App-ID / SDK / Signing: `android/app/build.gradle`

## Release- und Git-Workflow

**Branch-Modell:**
- `main` = Stable, produktiv (was als APK-Release rausgeht)
- `beta` = Beta-Test-Kanal, sollte nie hinter `main` sein
- `<feature>` (z. B. `rezept-import`) = aktive Entwicklung
- Alte Feature-Branches (z. B. `multiuser`) = abgeschlossen, nicht mehr wechseln

**Release-Flow (streng in dieser Reihenfolge):**
1. Feature-Branch fertig entwickeln und live testen
2. Falls `beta` hinter `origin/main`: erst `main → beta` fast-forwarden
3. Feature-Branch → `beta` mergen (nur nach expliziter Ansage vom User)
4. Beta-APK bauen, testen
5. `beta → main` mergen (nach explizitem OK)
6. Stable-APK bauen

**Commit- und Push-Regeln:**
- **Nie committen ohne expliziten User-Auftrag.** Auch nicht „defensiv nach dem Fix". Bei größeren Fixes fragen: „Commit + Push?"
- **Push braucht dieselbe explizite Ansage** wie Commit. Ausnahme: wenn der User „commit + push" oder „mergen + pushen" in einem Auftrag sagt.
- **Nie force-push, nie `--no-verify`, nie `--no-edit` bei rebase.**
- **Commit-Style:** `type(scope): kurzbeschreibung` — Kleinschreibung, keine Umlaute im Text der Message (ae/oe/ue), kein Punkt am Ende, Deutsch. Beispiele: `fix(picker): neu-marker sichtbar`, `feat(recipe): adana-koefte (id 33)`.
- **Kleine Commits.** Ein Fix = ein Commit, keine Sammel-Commits mit gemischten Themen.

**Test-only Änderungen im Working-Copy:**
- Änderungen die nur für den Live-Test da sind (z. B. `remote-config.js` mit Feature-Branch-URL statt `main`) werden **nicht committed**. Kommentar mit `⚠️ TEMP FUER LIVE-TEST` markieren.
- Vor Branch-Switch oder APK-Bau: temp-Änderungen mit `git checkout -- <file>` zurücksetzen.

**Rezepte (`dishes.json`) brauchen explizite User-Bestätigung:**
- Bei neuen oder geänderten Rezepten (Zutaten, Portionsgrößen, Steps, Meta) **immer den vollständigen Entwurf vorzeigen** — kein „vermutlich passt schon"-Commit.
- Fragen wie „welcher Cut?", „welcher Reis?", „was kommt in den Dip?" bewusst offen ansprechen statt raten. Kleine Interpretationsspielräume (z. B. Gewürz-Grammatur bei „eine Prise") sind ok, größere Entscheidungen (Zutaten-Kandidaten, Marinaden-Split, Zubereitungs-Reihenfolge) müssen bestätigt werden.
- Erst nach explizitem „passt / commit / PR" wird gepusht — auch wenn der Validator lokal grün ist.

**APK-Bau:**
- **Nur nach expliziter Ansage „APK bauen".** Auch nach abgeschlossenem Test nicht automatisch.
- Vor Bau: Version-Bump in `android/app/build.gradle` mit User abstimmen (versionCode + versionName).
- Beta-APK aus `beta`, Stable-APK aus `main`.
- Vor Bau prüfen: `remote-config.js` zeigt auf `main` (Prod-Content-URL).

## Guardrails

Diese Regeln gelten übergreifend — nicht ändern ohne bewusste Rückfrage:

1. **UI-Strings deutsch, Du-Ansprache** — keine englischen Labels in der App-Oberfläche
2. **State-Storage-Key `mahlzeit-state-v2` unveränderlich ohne Migration** — sonst Datenverlust. Neue Felder einfach ergänzen
3. **Bilder als externe Dateien** — kein Base64-Inline in HTML/JS
4. **Package-ID `com.mahlzeit.myapp` unverändert** — Änderung = komplette Neuinstallation für Nutzer
5. **Kein Framework-Umbau** (Vue/React/Angular) ohne Rückfrage. Vanilla JS + Vite ist bewusste Wahl
6. **Statusbar-Farbe synchron halten** — `capacitor.config.json` (`EdgeToEdge.backgroundColor`) und CSS (`--md-sys-color-surface` bzw. aktives Theme) immer gemeinsam ändern
7. **Nach Änderungen zwingend `npm run build && npx cap sync`** — sonst landet nichts im Android-Projekt
8. **Zutaten-Wiederverwendung, keine Duplikate** — beim Anlegen/Ändern von Rezepten (`dishes.json`) IMMER prüfen, ob die Zutat bereits in `ingredients.json` existiert (auch unter leicht anderem Namen). Nur neuen Key anlegen, wenn es wirklich eine neue Zutat ist. Verhindert Drifts wie zwei Petersilie-Einträge (Bund vs. g), die die Einkaufsliste doppelt zeigt.
9. **Touch-Targets ≥ 48 px** — bei Chip-Reihen über die Breite der ganzen Reihe erfüllt
10. **Keine Tests** (Solo-Projekt) — Node-Simulation für Randfälle wenn nötig

## Referenz

- **Rebuild-Design-Doc:** [`docs/redesign/2026-07-25-rebuild-design.md`](docs/redesign/2026-07-25-rebuild-design.md)
- **Session-Handoffs:** [`docs/redesign/handoffs/`](docs/redesign/handoffs/) — letzter: `session-17-to-18.md`
- **Backlog:** [`docs/redesign/backlog.md`](docs/redesign/backlog.md)
- **Feature-Design-Docs:** [`docs/redesign/2026-07-26-kalender-export-design.md`](docs/redesign/2026-07-26-kalender-export-design.md), [`docs/redesign/2026-07-26-onboarding-design.md`](docs/redesign/2026-07-26-onboarding-design.md)
- **GitHub-Repo:** https://github.com/shogun160/mahlzeit-app
- **Capacitor-Version:** 8.4.2 mit `@capawesome/capacitor-android-edge-to-edge-support@8.0.8`
- **Android target SDK:** 36 (Android 16)
