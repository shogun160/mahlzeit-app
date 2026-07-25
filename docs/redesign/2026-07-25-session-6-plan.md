# Session 6 Implementation Plan — Bottom-Navigation + localStorage-Persistenz (+ zwei Nachzügler)

> **Environment note aus Sessions 1-5.5:** Subagent-Worktree-Dispatch ist im Sandbox nicht verfügbar. Direktausführung in der Haupt-Session, siehe `docs/redesign/handoffs/session-5-to-6.md`.

**Goal:** Zweiter Navigations-Weg neben dem Swipe (Bottom-Nav) und Persistenz aller State-Slots über App-Neustarts hinweg. Dazu zwei kleine, thematisch passende Features aus dem alten `main`-Code: "Alle Tage auf/aus"-Button im Dashboard-Header und "Alles besorgt"-Banner in der Einkaufsliste, wenn alle Zutaten abgehakt sind.

**Architecture:**

- **Neues `src/nav/bottom.js`** — `renderBottomNav(root, { onNavigate })`. Rendert zwei Tabs (Dashboard, Einkaufsliste) als Buttons mit Icon + Label. Aktiver Tab via `--md-sys-color-primary-tint`. Badge auf Einkaufsliste-Tab zeigt Anzahl offener Zutaten (nur wenn > 0). Ruft `onNavigate('dashboard' | 'shopping')` bei Klick. Liest `state.view` und den Badge-Count selbst aus dem Modul-scope.
- **Neues `styles/components/bottom-nav.css`** — fixed am unteren Rand, safe-area unten, z-index 50 (über Header (10), unter Sheet (100)).
- **Persistenz in `src/state.js` erweitert** — `saveState()` und `loadState()` als weitere Exports. Storage-Key `mahlzeit-state-v2` (Guardrail: `-v1` bleibt der alten App auf `main` reserviert). Sets (`checkedShopping`, `collapsedCategories`) werden via `Array.from(...)` serialisiert und via `new Set(...)` deserialisiert.
- **`main.js`** — Bottom-Nav wird bei jedem `refresh()` neu gerendert (aktiver Tab + Badge sind state-abhängig). `saveState()` am Ende von `refresh()` als einfacher Auto-Save-Hook — konsistent mit dem Render-Zyklus. Beim App-Start `loadState()`; nur wenn nichts geladen wird → `initState(freshAssignment())`.
- **`.view` in `view-track.css`** — `padding-bottom` wird um `var(--bottom-nav-height)` erweitert, damit letzter Content nicht unter der Bottom-Nav verschwindet.
- **Toggle-All in `dashboard/header.js`** — zweiter `icon-btn` links vom Reroll-All-Button. Klick togglet alle 7 Tage in/aus `state.selected` (mixed → alle true, alle true → alle false).
- **Done-Banner in `shopping-list/render.js`** — HTML wird konditional zwischen Progress und Groups eingesetzt (`if openCount === 0 && items.length > 0`). Kein neues Modul, nur ein `renderDoneBanner()`-Helper.

**Tech Stack:** unverändert. Vite 8.1.5, Vanilla JS (ES Modules), CSS Custom Properties. Keine neuen Packages.

---

## Design-Entscheidungen (mit reasonable defaults getroffen, im "keine Rückfragen"-Modus)

| Frage | Entscheidung | Begründung |
|---|---|---|
| Bottom-Nav-Style: Icon-only oder mit Label? | **Icon + Label** unter dem Icon, klein (11 px) | Zwei Tabs → viel Platz. Label macht die Funktion explizit klar. Konsistent mit der alten App. |
| Aktiver Tab visuell | Icon-Container bekommt `--md-sys-color-primary-tint` als Pill-Hintergrund; Label wird `primary` in Bold; inaktiver Tab: PNG "einkaufsliste-inaktiv", Label neutral | Setzt auf die globale primary-tint-Aktiv-Sprache (Session 5-Tokens) und die vorhandenen Icon-Assets (`icon-einkaufsliste-aktiv/inaktiv.png`). |
| Persistenz-Umfang | **Alle Slots** persistieren: `assignment, selected, portions, globalPortions, checkedShopping, dishBag, view, collapsedCategories` | User erwartet nach App-Neustart exakt denselben Zustand. Kein Slot ist "flüchtig". |
| `dishBag` persistieren? | **Ja** | Sonst würde ein direkt vor App-Schließen abgelehntes Gericht beim nächsten Öffnen wieder auftauchen — irritierend. Reroll-Kontinuität ist wichtiger als Frische. |
| Badge auf Einkaufsliste-Tab? | **Ja**, zeigt `openCount` (nicht abgehakte, nicht-Leftover-Zutaten). Nur wenn `> 0`. | Fortschritts-Signal ohne Tab-Wechsel. Alte App hatte das auch. Zählweise identisch zu Progress-Bar. |
| Auto-Save-Trigger | Am Ende von `refresh()` in `main.js` | Ein zentraler Punkt (`refresh()` läuft nach jeder State-Mutation), keine Streuung von `saveState()`-Aufrufen im Code. Overhead ist minimal, State ist klein. |
| Toggle-All-Icon | Material Symbols "playlist_add_check" als inline SVG (analog zum Reset-Icon in Session 5) | Passt zur icon-btn-Familie, klar in der Bedeutung, kein zusätzliches Asset nötig. |
| Toggle-All-Logik | Wenn mindestens ein Tag `false` → alle auf `true` setzen. Wenn alle `true` → alle auf `false`. | Gängiges Toggle-All-Verhalten (E-Mail-Client, Datei-Manager). |
| Toggle-All-Sichtbarkeit | Immer sichtbar im Dashboard-Header (kein hide-when-empty) | Konstante UI-Position, User weiß wo der Button lebt. |
| Done-Banner-Position | Direkt unter der Progress-Bar (kein sticky) | Erscheint nur wenn alles abgehakt ist — dann ist Progress = 100 %, Banner reiht sich natürlich unterhalb ein. Kein zusätzlicher sticky-Layer. |
| Done-Banner-Text | "Sauber, alles besorgt – Mahlzeit!" | Identisch zur alten App auf `main`. Freundlicher Ton, deutscher Gedankenstrich. |
| z-index-Reihenfolge | view (0) < progress (5) < group-header (4, aber im view scope) < app-header (10) < **bottom-nav (50)** < sheet-overlay (100) | Bottom-Nav über der Progress-Bar (visuell darüber liegend), aber unter dem Sheet (Sheet öffnet ja über allem). |

---

## Voraussetzungen

- Working Directory: `/Users/oliverwosnitza/Documents/Mahlzeit-App`
- Branch: `redesign` (`git branch --show-current` → `redesign`)
- Working Tree: sauber (`www/` gitignored — wird von Vite generiert)
- Session 5.5 abgeschlossen (Commits bis `07f61ca`, Handoff-Update `1adce3a`)

## Datei-Struktur nach dieser Session

```
Mahlzeit-App/
├── src/
│   ├── main.js                            ← geändert (loadState + Bottom-Nav-Mount + saveState in refresh)
│   ├── state.js                           ← geändert (saveState/loadState + STORAGE_KEY)
│   ├── nav/
│   │   ├── swipe.js                       ← unverändert
│   │   └── bottom.js                      ← NEU
│   ├── dashboard/
│   │   └── header.js                      ← geändert (Toggle-All-Button)
│   └── shopping-list/
│       └── render.js                      ← geändert (Done-Banner-Insert)
├── styles/
│   └── components/
│       └── bottom-nav.css                 ← NEU
├── index.html                             ← geändert (bottom-nav slot + link)
└── docs/redesign/
    └── 2026-07-25-session-6-plan.md       ← DIESES DOKUMENT
```

## Schritte

### 1. Plan-Dokument (DIESES) — DONE beim Schreiben

### 2. Bottom-Nav-Komponente
- `src/nav/bottom.js` schreiben: `renderBottomNav(root, { onNavigate })`. Liest `state.view` und `getOpenShoppingCount()` (Helper lokal, nutzt `buildConsolidatedList` + `state.checkedShopping`).
- `styles/components/bottom-nav.css` schreiben: fixed, `height: var(--bottom-nav-height)`, safe-area-inset-bottom, z-index 50, zwei flex-Tabs, aktiver Tab mit primary-tint, Badge oben-rechts über dem Icon.
- `index.html`: `<nav id="bottom-nav" class="bottom-nav"></nav>` nach `</main>`, CSS-Link.

### 3. Bottom-Nav mounten + View-Padding
- `main.js`: `bottomNavRoot = document.getElementById('bottom-nav')`. In `refresh()`: `renderBottomNav(bottomNavRoot, { onNavigate: (next) => { setView(next); refresh(); } })`.
- `view-track.css`: `.view` `padding-bottom` erweitern um `var(--bottom-nav-height)`.

### 4. localStorage-Persistenz
- `src/state.js`:
  - `const STORAGE_KEY = 'mahlzeit-state-v2';`
  - `saveState()`: baut Snapshot mit `Array.from()` für die zwei Sets, `try { localStorage.setItem(...) } catch {}` (Quota-Fehler ignorieren).
  - `loadState()`: `try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return false; const parsed = JSON.parse(raw); ... state.checkedShopping = new Set(parsed.checkedShopping || []); ... return true; } catch { return false; }`.
  - Rückgabe-`boolean` erlaubt `main.js` den Fresh-Init-Fallback zu machen.
- `src/main.js`:
  - Vor dem ersten `refresh()`: `if (!loadState()) initState(freshAssignment())` (aktuell wird `initState` mit Assignment gerufen — der Startpunkt wird angepasst).
  - Am Ende von `refresh()`: `saveState()`.

### 5. Toggle-All im Dashboard-Header
- `src/dashboard/header.js` — `renderDashboardHeader` bekommt zweiten Icon-Button links vom Reroll-All (`data-action="toggle-all-selected"`), Icon als inline SVG (Material "playlist_add_check").
- Handler ruft `toggleAllSelected()` — Helper aus `src/dashboard/reroll.js` oder neu in `src/dashboard/select.js` (kleines Modul mit dieser einen Funktion).
- Handler danach `refresh()`.
- Button-Signatur: `renderHeader(root, { view, onGlobalPortionChange, onRerollAll, onResetChecked, onToggleAll })` — `main.js` wired.

### 6. Done-Banner in der Shopping-View
- `src/shopping-list/render.js` — `renderDoneBanner()` als kleiner Helper, wird zwischen `renderProgress(items)` und `<div class="shop-groups">` eingesetzt wenn `openCount === 0 && items.length > 0`. `openCount` wird via helper aus `items` + `state.checkedShopping` berechnet (identisch zu progress.js — kurzer inline-Filter, kein neuer Export nötig).
- CSS in `shopping-list.css` ergänzen: `.shop-done-banner` mit dezentem primary-tinted-Look, gerundet, zentrierter Text.

### 7. End-to-End Test im Browser
- `npm run dev`, Port 5173 öffnen, DevTools Mobile Mode.
- Test-Matrix:
  - **Bottom-Nav-Wechsel** → aktiver Tab tint, Screen wechselt animiert (identisch zum Swipe).
  - **Swipe funktioniert weiter** → keine Regression durch Bottom-Nav-Mount.
  - **Badge** → auf Einkaufsliste-Tab erscheint Zahl, wenn Zutaten offen sind; verschwindet auf 0.
  - **Persistenz** → Zutaten abhaken, Kategorie einklappen, auf Shopping-View → Full-Reload → alles noch da inkl. View.
  - **Toggle-All** → mixed → alle Cards selektiert; nochmal klicken → keine selektiert.
  - **Done-Banner** → alle abhaken → Banner erscheint unter Progress; ein Uncheck → Banner weg.
  - **Kein Content unter Bottom-Nav** → in Dashboard und Shopping ganz nach unten scrollen, letzte Karte / letztes Item bleibt vollständig sichtbar über der Bottom-Nav.
  - **Sheet über Bottom-Nav** → Karte öffnen, Sheet muss über Bottom-Nav liegen (nichts der Bottom-Nav lugt oben rein).

---

## Nicht-Ziele für diese Session

- **Zutaten-Check-Circles im Detail-Sheet** — bewusst nicht in Session 6, siehe Handoff (semantische UX-Frage offen, eigene Session).
- **Migration von `-v1` zu `-v2`** — es gibt keine Nutzer der Rebuild-App außer dem Solo-Entwickler; ein leerer Start beim ersten Öffnen des Rebuilds ist akzeptabel. Keine Import-Logik nötig.
- **Landscape-Layout** oder **Tablet-Breakpoints** für die Bottom-Nav — der Zielmarkt ist Android-Phone-Portrait.
