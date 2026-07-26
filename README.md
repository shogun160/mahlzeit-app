# Mahlzeit

Ein Wochen-Meal-Planner für Android. Verteilt Gerichte auf 7 Tage, zeigt Rezepte und Nährwerte, führt automatisch eine Einkaufsliste.

Solo-Hobbyprojekt, in Vanilla JS mit Vite gebaut und per Capacitor als Android-APK verpackt.

## Features

- **Wochenplan** — Gerichte per Reroll auf sieben Tage verteilen, einzelne Tage abwählen, per Portion skalieren
- **Rezepte** — Detail-Sheet mit Zutaten, Nährwerten und Zubereitungs-Schritten
- **Favoriten** — Lieblingsgerichte markieren, Filter im Dish-Picker, priorisiert bei der Sortierung
- **Einkaufsliste** — automatisch aus den ausgewählten Rezepten, mit Progress-Ring und Abhak-Funktion
- **Onboarding-Wizard** — Kalorien-Ziel berechnen aus Größe, Gewicht, Aktivität und Wunsch (halten/abnehmen/zunehmen)
- **Nährwert-Balken** — tagesbezogen und pro Mahlzeit (Frühstück, Mittag, Abendessen)
- **Dark Mode** — folgt System-Einstellung oder manuell auswählbar
- **State-Persistenz** — alles lokal in localStorage, keine Cloud, kein Account

## Tech-Stack

- **Frontend:** Vanilla JavaScript (ES-Module), Material-3-inspiriertes CSS
- **Build:** [Vite](https://vitejs.dev/) 8
- **Native Bridge:** [Capacitor](https://capacitorjs.com/) 8 mit [`@capawesome/capacitor-android-edge-to-edge-support`](https://github.com/capawesome-team/capacitor-plugins)
- **Target:** Android 16 (SDK 36), min SDK per Capacitor-Default

Bewusst ohne Framework (Vue/React/Angular). Der Vanilla-Ansatz hält den Codebase klein und die Build-Kette einfach.

## Entwicklung

Voraussetzungen: Node.js 20+, Android Studio (für APK-Build).

```bash
# Dependencies
npm install

# Dev-Server mit Hot Reload (im Browser)
npm run dev

# Production-Build (nach www/)
npm run build

# Assets in Android-Projekt syncen
npx cap sync
```

### Debug-APK bauen

```bash
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  ./gradlew assembleDebug

# Ergebnis: android/app/build/outputs/apk/debug/app-debug.apk
```

Alternativ per Android Studio: **Build → Generate App Bundles or APKs → Generate APKs**.

## Struktur

```
src/                Module (ES-Modules, kein Framework)
  main.js           Bootstrap
  state.js          State + localStorage-Persistenz
  data/             dishes.json + ingredients.json (Rezepte + Zutaten-Registry)
  dashboard/        Wochen-Übersicht
  dish-picker/      Gericht-Auswahl mit Filtern
  detail-sheet/     Rezept-Sheet
  shopping-list/    Einkaufsliste
  onboarding/       Wizard
  settings/         Settings-Sheet
  nutrition/        Makro-Berechnung
  native/           Capacitor-Bridges
  util/             Icons, DOM-Helper

styles/             CSS (Palette, Themen, Komponenten)
public/             Statische Assets (Icons, Logo, Dish-Bilder)
android/            Capacitor-generiertes Android-Projekt
www/                Vite-Build-Output
```

## Rezepte hinzufügen

1. Zutaten prüfen: existiert die Zutat schon in [`src/data/ingredients.json`](src/data/ingredients.json)? Wenn ja, den vorhandenen Key wiederverwenden — keine Duplikate anlegen.
2. Neues Gericht in [`src/data/dishes.json`](src/data/dishes.json) ergänzen: ID, Name, Küche, Nährwerte, Zutaten-Liste mit `key` + `grams`, Zubereitungs-Schritte.
3. Bild als JPG unter `public/assets/dishes/dish-<id>.jpg` ablegen (empfohlen ~1200×800).
4. `npm run build && npx cap sync`, dann APK neu bauen.

## Dokumentation

- [`CLAUDE.md`](CLAUDE.md) — Kontext für Coding-Agents (Guardrails, Workflow, Landkarte)
- [`docs/redesign/`](docs/redesign/) — Design-Docs für Rebuild, Feature-Konzepte, Backlog
- [`docs/redesign/handoffs/`](docs/redesign/handoffs/) — Session-Handoffs aus der Rebuild-Phase

## Lizenz

Privates Hobby-Projekt, keine Lizenz vergeben.
