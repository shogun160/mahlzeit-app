# Rebuild-Design: Mahlzeit-App

**Status:** Approved – Umsetzung ausstehend
**Datum:** 2026-07-25
**Branch für Umsetzung:** `redesign`

## 1. Ziel & Scope

Kompletter Rebuild der Mahlzeit-App mit zwei Hauptzielen:

1. **Look & Feel** — Material 3 Design-Sprache statt aufgehübschtes HTML
2. **Code-Qualität** — Modulare Struktur statt 1300-Zeilen-Monolith-`index.html`

Zusätzlich cross-platform-tauglich designed (Web-Standards), damit iOS später ohne Redesign aktivierbar ist.

**Feature-Parität** zur aktuellen App:

- 7-Tage-Dashboard mit zufälliger Dish-Zuordnung
- Reroll pro Karte (mit "Shuffle-Bag"-Logik, keine Wiederholungen bis alle durch) und "Reroll all"
- Portion-Stepper pro Tag und global über Header
- Detail-Sheet mit zwei Tabs (Zutaten + Rezept), Swipe zwischen Tabs
- Einkaufsliste mit Kategorien (Frische, Trocken, Gewürze, Öl, Sonstiges) und Check-Interaktion
- Persistenz im localStorage (assignments, selections, portions, checked ingredients)
- Bottom-Navigation Dashboard ↔ Einkaufsliste mit Swipe-Geste

**Keine neuen Features im Rebuild.** Feature-Erweiterungen kommen als separate Projekte nach dem Merge auf `main`.

## 2. Technisches Setup

- **Build-Tool:** Vite
- **Sprache:** Vanilla JavaScript (ES Modules), kein Framework
- **Styling:** CSS Custom Properties (Material 3 Design Tokens)
- **UI-Sprache:** Deutsch durchgehend
- **Build-Ziel:** Statische Files nach `www/`, dann via Capacitor als APK
- **iOS:** Design berücksichtigt Cross-Platform, aber keine native iOS-Plattform initialisiert

## 3. Projekt-Struktur

```
Mahlzeit-App/
├── src/                          ← Rebuild-Source
│   ├── main.js                   ← Einstiegspunkt, Init
│   ├── state.js                  ← State-Variablen + saveState/loadState
│   ├── data/
│   │   └── dishes.json           ← DATA als JSON extrahiert
│   ├── dashboard/
│   │   ├── render.js
│   │   └── card.js
│   ├── detail-sheet/
│   │   ├── render.js
│   │   ├── ingredients.js
│   │   └── recipe.js
│   ├── shopping-list/
│   │   ├── render.js
│   │   └── categories.js
│   ├── nav/
│   │   ├── bottom-nav.js
│   │   └── swipe.js
│   └── util/
│       ├── icons.js
│       └── format.js
├── styles/
│   ├── tokens.css                ← Material 3 Design Tokens
│   ├── base.css                  ← Reset, Body, Typography
│   └── components/
│       ├── card.css
│       ├── sheet.css
│       ├── button.css
│       ├── chip.css
│       └── nav.css
├── public/                       ← Statische Assets (unverändert übernommen)
│   ├── logo.png
│   ├── icons/*.png               ← 5 UI-Icons
│   └── dishes/dish-*.jpg         ← 17 Gerichte-Bilder
├── index.html                    ← Vite-Einstiegspunkt (dünn)
├── vite.config.js                ← Build-Output nach www/
├── android/                      ← Unverändert (Capacitor)
├── capacitor.config.json         ← webDir bleibt "www"
└── package.json                  ← Vite-Scripts + bestehende Capacitor-Deps
```

**Vite baut nach `www/`**, überschreibt die alte App auf `redesign`-Branch. `main` bleibt unangetastet und weiter buildbar.

## 4. Design-System (Material 3 Tokens)

Farb-Palette basiert auf der aktuellen App-Palette (`--accent: #0f766e`, `--bg: #f7f8f7`) – ist bereits Material-3-nah, wird nur formal in M3-Token-Namen überführt.

```css
:root {
  /* Primary */
  --md-sys-color-primary: #0F766E;
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-primary-container: #CCFBF1;
  --md-sys-color-on-primary-container: #115E59;

  /* Surface (matcht Statusbar-Farbe des Wrappers) */
  --md-sys-color-surface: #F7F8F7;
  --md-sys-color-surface-container-low: #F2F4F3;
  --md-sys-color-surface-container-lowest: #FFFFFF;

  /* Text */
  --md-sys-color-on-surface: #1F2937;
  --md-sys-color-on-surface-variant: #6B7280;
  --md-sys-color-outline-variant: #E1E3E2;

  /* Elevation */
  --md-elevation-1: 0 1px 3px 1px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.08);
  --md-elevation-2: 0 4px 12px rgba(0,0,0,0.08);

  /* Ergonomie */
  --radius-card: 16px;
  --radius-pill: 9999px;
  --touch-target-min: 48px;
  --bottom-nav-height: 64px;
}
```

**Ergonomie-Regeln als harte Standards:**

- Interaktive Elemente ≥ 48dp Touch-Target
- Safe-Area-Insets nutzen: `env(safe-area-inset-*)`
- Semantische HTML5-Tags: `<main>`, `<nav>`, `<article>`, ARIA-Attribute
- Bottom-Navigation in Thumb-Zone

## 5. Wiederverwendete Assets

Aus der aktuellen App unverändert übernommen (bereits extrahiert und optimiert):

- **17 Dish-Bilder** (`www/assets/dishes/*.jpg`, ~80 KB pro Bild) → `public/dishes/`
- **5 UI-Icons** (`www/assets/icons/*.png`) → `public/icons/`
- **Logo** (`www/assets/logo.png`, 76 KB) → `public/logo.png`

Icons und Bilder werden per `<img>` referenziert, nicht inline embedded (siehe Guardrails).

## 6. Data & State

- **DATA** wird nach `src/data/dishes.json` extrahiert (statt in JS eingebettet). Import via `import dishes from './data/dishes.json'`
- **State-Struktur bleibt** kompatibel:
  - `assignment` (day → dishId)
  - `selected` (day → bool)
  - `portions` (day → number)
  - `globalPortions` (number)
  - `checkedShopping` (Set → als Array serialisiert)
- **State-Storage-Key:** neuer Key `mahlzeit-state-v2` — sauberer Start, alte Daten der aktuellen App werden ignoriert (Solo-User, kein echter Datenverlust)
- **Migration von v1:** nicht nötig

## 7. Roadmap (Session-Plan)

| Session | Ziel | Deliverable |
|---|---|---|
| 1 | Setup + Skeleton | Vite läuft, Dashboard-Screen mit einer statischen Card, Design Tokens aktiv |
| 2 | Dashboard komplett | 7 Tage dynamisch, echte Dish-Bilder, Layout final |
| 3 | Interaktionen | Reroll (single + all), Portion-Stepper (lokal + global), Auswahl für Einkaufsliste |
| 4 | Detail-Sheet | Sheet-Component, Zutaten-View, Rezept-View, Swipe zwischen Tabs |
| 5 | Einkaufsliste | Kategorien-Rendering, Check-Interaktion, Progress-Bar |
| 6 | Navigation + Persistenz | Bottom-Nav, Swipe-Nav zwischen Screens, saveState/loadState |
| 7 | APK-Build + Merge | Auf Handy testen, Feinschliff, Merge nach `main` |

Realistische Dauer bei parallelen Sessions: **6-8 Wochen**.

## 8. Bewusste Nicht-Ziele

- **Testing-Framework** — für Solo-Dev auf dieser App-Größe Overkill. Manuelles Testen auf dem Gerät reicht
- **TypeScript** — Vanilla JS bleibt, kein zusätzliches Konzept
- **CSS-Preprocessor** (Sass, PostCSS) — Custom Properties reichen; PostCSS kann später dazu
- **Feature-Erweiterungen** — z. B. eigene Rezepte hinzufügen, Wochenplan-Templates: nach dem Rebuild als eigene Projekte
- **iOS-Build** — vorbereitet aber nicht aktiviert

## 9. Guardrails (übergreifend)

Gelten für den Rebuild und alle zukünftigen Änderungen:

1. **UI-Strings deutsch** — keine englischen Labels in der App-Oberfläche
2. **State-Storage-Key nur mit Migration umbenennen** — sonst Datenverlust bei bestehenden Nutzern (`mahlzeit-state-v2` ab Rebuild)
3. **Bilder als externe Dateien** — kein Base64-Inline (macht `index.html` fett)
4. **Package-ID `com.mahlzeit.myapp` unverändert** — Änderung = Neuinstallation für alle Nutzer
5. **Kein Framework-Umbau** (Vue/React/etc.) ohne Rückfrage
6. **Statusbar-Farbe `#F7F8F7` = `--md-sys-color-surface`** — immer synchron ändern
7. **Nach HTML/Asset-Änderungen zwingend `npm run build` → `npx cap sync`** — sonst landet's nicht im Android-Projekt
