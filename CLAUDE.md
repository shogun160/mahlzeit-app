# Mahlzeit-App — Claude Context

## Was ist die App

Meal-Planner für die Woche: verteilt Gerichte auf 7 Tage, zeigt Rezepte/Zutaten, führt eine Einkaufsliste. Umgesetzt als Web-App, per Capacitor 8 als Android-APK verpackt. Solo-Projekt, primär für Android (iOS technisch möglich, aktuell nicht gebaut).

**Aktueller Status:** Rebuild geplant. Details siehe [`docs/redesign/2026-07-25-rebuild-design.md`](docs/redesign/2026-07-25-rebuild-design.md). Umsetzung auf Branch `redesign`, `main` bleibt bis zum Merge auf dem aktuellen (funktionierenden) Stand.

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

### Aktueller Code (`main`)

```
www/                        ← Web-Sourcen (Single Source of Truth)
  index.html                ← komplette App (HTML + CSS + JS), ~88 KB
  assets/logo.png
  assets/icons/*.png        ← 5 UI-Icons
  assets/dishes/dish-*.jpg  ← 17 Gerichte-Bilder
android/                    ← Capacitor-generiert, meist nicht direkt editieren
  app/src/main/res/         ← Icons, Splash, styles.xml
capacitor.config.json       ← App-ID, Plugins-Config, Statusbar-Farbe
```

**Kernkonzepte im aktuellen Code:**

- `DATA.dishes` + `dishesById` — Gerichte-Datenbank, ID-Lookup
- Icons via `iconSrc(name)` → liest aus `assets/icons/`
- State-Variablen: `assignment` (day → dishId), `selected`, `portions`, `globalPortions`, `checkedShopping`
- Persistenz: `saveState()` / `loadState()` mit localStorage-Key `mahlzeit-state-v1`, Auto-Save via Function-Wrapper und `visibilitychange`-Event

### Neuer Code (`redesign`)

Modulare Struktur mit Vite als Build-Tool. Detaillierte Ordner-Layout siehe Design-Doc, Section 3.

## Standard-Workflow

### Aktuelle App (`main`)

```
HTML in www/index.html ändern
  → npx cap sync
  → Android Studio: Build → Generate App Bundles or APKs → Generate APKs
  → alte APK vom Handy runter (sonst Signatur-Mismatch)
  → neue APK drauf
```

**Config-Änderungen:**
- App-Name: `android/app/src/main/res/values/strings.xml` + `capacitor.config.json`
- Statusbar-Farbe, Plugins: `capacitor.config.json`
- Splash / Theme: `android/app/src/main/res/values/styles.xml`

### Nach Rebuild (`redesign`)

```
Code in src/ oder styles/ ändern
  → npm run build (Vite baut nach www/)
  → npx cap sync
  → Android Studio: Build APK
  → deinstallieren + neu installieren
```

Beim Entwickeln im Browser: `npm run dev` startet Vite-Dev-Server mit Hot Reload.

## Guardrails

Diese Regeln gelten übergreifend — nicht ändern ohne bewusste Rückfrage:

1. **UI-Strings deutsch** — keine englischen Labels in der App-Oberfläche
2. **State-Storage-Key nur mit Migration umbenennen** — sonst Datenverlust. Aktuell `mahlzeit-state-v1` (main), ab Rebuild `mahlzeit-state-v2` (redesign)
3. **Bilder als externe Dateien** — kein Base64-Inline in HTML/JS. Alte App hatte 2 MB inline Base64, ist rausgezogen
4. **Package-ID `com.mahlzeit.myapp` unverändert** — Änderung = komplette Neuinstallation für Nutzer
5. **Kein Framework-Umbau** (Vue/React/Angular) ohne Rückfrage. Vanilla JS + Vite ist bewusste Wahl
6. **Statusbar-Farbe `#F7F8F7` = `--md-sys-color-surface`** (bzw. aktuell `--bg`) — immer synchron ändern in `capacitor.config.json` und CSS
7. **Nach Änderungen zwingend syncen** — `npx cap sync` (bzw. `npm run build && npx cap sync` nach Rebuild), sonst landet nichts im Android-Projekt
8. **Zutaten-Wiederverwendung, keine Duplikate** — beim Anlegen/Ändern von Rezepten (`dishes.json`) IMMER prüfen, ob die Zutat bereits in `ingredients.json` existiert (auch unter leicht anderem Namen). Nur neuen Key anlegen, wenn es wirklich eine neue Zutat ist. Verhindert Drifts wie zwei Petersilie-Einträge (Bund vs. g), die die Einkaufsliste doppelt zeigt.

## Referenz

- **Design-Doc (Rebuild):** [`docs/redesign/2026-07-25-rebuild-design.md`](docs/redesign/2026-07-25-rebuild-design.md)
- **GitHub-Repo:** https://github.com/shogun160/mahlzeit-app
- **Capacitor-Version:** 8.4.2 mit `@capawesome/capacitor-android-edge-to-edge-support@8.0.8`
- **Android target SDK:** 36 (Android 16)
