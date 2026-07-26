# Handoff — Mahlzeit-App Rebuild, Session 8

## Kontext in einem Satz

Du übernimmst einen laufenden Rebuild einer Meal-Planner-App (Capacitor + Vanilla JS + Vite). Session 6 (Bottom-Nav + Persistenz + Selection-Toolbar + Done-Banner) ist gemergt, danach kam eine umfangreiche **Session 7** mit Design-Iterationen und einer neuen Feature-Ebene: **Settings-Sheet mit Burger-Menü** — Standard-Personenzahl + Kochzeit-Filter sind funktional, viele Placeholder-Sections warten auf Iteration 2+.

## Pflichtlektüre (in dieser Reihenfolge)

1. **`CLAUDE.md`** — projekt-übergreifender Kontext (Guardrails, Konventionen). Wird beim Session-Start automatisch geladen.
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — vollständige Rebuild-Spec, die Roadmap-Tabelle.
3. **`docs/backlog.md`** — Feature-Backlog inkl. Dish-Import + AI-Prompt + geplanten Features für spätere Iterationen.
4. **`docs/redesign/handoffs/session-5-to-6.md` und `session-6-to-7.md` (falls angelegt)** — historischer Kontext.

## Aktueller Repo-Zustand

- **Branch:** `redesign` (nicht `main`!) — auf GitHub gepusht (`origin/redesign`)
- **Letzter Commit:** `70f9a1f docs(backlog): dish import + AI image prompt + future feature roadmap`
- **Working Tree:** sauber, `www/` gitignored (Vite generiert)
- **Dev-Server:** läuft NICHT — start bei Bedarf mit `npm run dev` (Port 5173/5174)

## Was seit Session 6 (nach dem Merge-Ready-Punkt) gebaut wurde

Session 7 hatte zwei große Blöcke — **UI-Polish** und **Feature Settings-Sheet**.

### UI-Iterations-Block (Commits `cc52d7f` … `e9389e8`)

- **Bottom-Nav auf Material-Symbols umgestellt** — PNG-Icons raus, inline SVG (`grid_view` + `shopping_bag` outlined-only). Compact 56 dp Höhe, kein Pill mehr (Aktiv-Signal via Filled-Icon + primary Farbe).
- **Cards mit unified Active-State**: alle 3 Action-Buttons wechseln bei selected auf voll primary + weiße Icons/Labels (identische Farbe zur kcal-Pille auf dem Bild). Badge invertiert (weißer Kreis, teal Zahl, Ring in primary). Portion-Pille auf dem Bild wechselt mit auf 88 % primary + weiße Zahlen. Active-Tint der Card auf 25 % primary erhöht.
- **Card-Icons**: PNGs raus (rezept-zutaten, auslosen, einkaufsliste-aktiv/inaktiv), Material Symbols rein (`format_list_bulleted`, `refresh`, `shopping_bag`). 18 dp im Button-Kontext.
- **Detail-Sheet erweitert**:
  - Check-Circles pro Zutat, synchronisiert mit `state.checkedShopping` (gleiche Semantik wie Einkaufsliste — Check anywhere, syncs everywhere).
  - Makro-Sum-Row unter der Zutaten-Liste (Gesamt-kcal + g/% Split für P/KH/F mit Atwater 4/4/9).
  - Rezept-Nummer-Kreise in vollem primary mit weißer Zahl. Rezept-Schritte min 2-zeilig, Divider wie Zutaten.
  - Neuer **Toggle-Button neben der Portion-Pille** (in beiden Tabs sichtbar) — synchronisiert `state.selected[day]`, wechselt zusammen mit der Portion-Pille in den kcal-Look wenn aktiv.
- **Card-Buttons compact**: Divider zum Titel raus, Padding kompakter.
- **Card-Badge bleibt fest** am Zutaten-Button (springt nicht mehr auf Liste bei selected).
- **Makro-Pills 10 % transparenter** (0.78 alpha statt 0.88).
- **Progress-Ring inaktive Segmente** in `primary-container` (matcht die "leere" Seite der Shopping-Progress-Bar).
- **Reset räumt jetzt auch `collapsedCategories`** — vermeidet dass Kategorien nach Reset zugeklappt bleiben.

### Feature Settings-Sheet (Commit `c979c8c`)

- **Neues Modul `src/settings/`** mit `render.js` (analog `detail-sheet/`, mit `mountSettingsSheet` + `openSettingsSheet`).
- **`styles/components/settings-sheet.css`** — Bottom-Sheet-Optik + Sections + Slider + Link + Close-Swipe.
- **Neuer `state.settings`-Slot** mit `defaultPortions`, `maxCookTime`, `preferences`, `theme`. `state.globalPortions` ist ersatzlos gestrichen — `loadState()` migriert alte Storage-Files.
- **`changeDefaultPortions()` in `portions.js`** — setzt den globalen Standard *und* überschreibt sofort alle Card-Portionen (Semantik wie in der alten App).
- **`eligibleDishIds()` in `reroll.js`** — filtert Gerichte nach `state.settings.maxCookTime`, mit Fallback wenn der Filter zu wenige Kandidaten für 7 Tage lässt. Wird von `rerollAll`, `rerollDay` und `pickInitialAssignment` genutzt.
- **Header umgebaut**: Portion-Pille komplett raus, dafür **Burger-Icon** (Material Symbol `menu`) rechts als Settings-Öffner. **Reroll-Icon von PNG auf `refresh` SVG.**
- **Header vereinheitlicht** zwischen Dashboard und Shopping: identische Struktur `[Logo] [Progress-Chip] [Primary-Action] [Burger]`. Chip zeigt in beiden Views `n/7 Tage`. Dashboard-Chip klickbar (togglet alle Tage), Shopping-Chip read-only (Status).
- **Selection-Toolbar aus dem Dashboard-Body entfernt** — deren Rolle ist jetzt der Header-Chip. `renderProgressRing` ist exportiert, weil sowohl `selection-toolbar.js` als auch `header.js` es nutzen.
- **Bottom-Nav Background auf `surface`** (statt `surface-container`) — verschmilzt visuell mit dem App-Hintergrund, keine tonal-Absetzung mehr.
- **Sheet-Close-Swipe für Settings** — identisches Pattern wie im Detail-Sheet, Swipe-down auf Handle/Header schließt, Body + interaktive Elemente sind ausgenommen.

### Placeholder-Sections im Settings-Sheet (noch nicht funktional)

Sichtbar, aber grau/deaktiviert mit "Kommt bald":
- **Ernährungspräferenzen** (vegetarisch, vegan, kein Fisch, kein Fleisch, laktosefrei, glutenfrei)
- **Küchen-Präferenzen** (Lieblingsküchen priorisieren)
- **Profil & Kalorien** (Alter, Größe, Gewicht, Aktivität → Tageskalorien-Ziel)
- **Darstellung** (Dark Mode + Akzentfarbe)
- **Daten** (Backup exportieren/importieren, Alle Daten zurücksetzen)

**Über-Section** ist funktional — Link auf `github.com/shogun160/mahlzeit-app`.

## Aktueller State-Snapshot

```js
state = {
  assignment: { [day]: dishId },
  selected: { [day]: bool },
  portions: { [day]: number },        // 1..6
  checkedShopping: Set<string>,
  dishBag: { [day]: number[] },
  view: 'dashboard' | 'shopping',
  collapsedCategories: Set<string>,
  settings: {
    defaultPortions: 1..6,            // Standard, propagiert auf alle Cards bei Change
    maxCookTime: 20..120,             // Minuten, Filter für Reroll
    preferences: {                    // NOCH NICHT FUNKTIONAL
      vegetarian, vegan, noFish, noMeat, lactoseFree, glutenFree
    },
    theme: 'auto' | 'light' | 'dark', // NOCH NICHT FUNKTIONAL
  },
}
```

`STORAGE_KEY = 'mahlzeit-state-v2'` (Guardrail: v1 = alte App). Auto-Save am Ende von jedem `refresh()` in `main.js`.

## Wo weitermachen — Iteration-Optionen für Session 8

Aus dem Backlog (`docs/backlog.md`) und der Priorisierung, die ich User in Session 7 vorgeschlagen hatte:

### Iteration 2 — Ernährungspräferenzen (empfohlener nächster Schritt)

- Placeholder-Section aktivieren: Checkboxen für die 6 Präferenzen.
- **Vorbedingung:** `dishes.json` braucht Tags pro Gericht (`tags: ["contains-fish", "contains-meat", "contains-lactose", "contains-gluten"]` o. ä.). Aktuell existieren solche Tags nicht. Erste Aufgabe: dishes-JSON migrieren.
- Reroll-Filter in `eligibleDishIds()` erweitern: entferne Dishes, die per aktivem Präferenz-Filter ausgeschlossen sind.
- Fallback wenn zu wenige Kandidaten bleiben — analog zur cook-time-Logik.

### Iteration 3 — Küchen-Präferenzen

- User wählt bevorzugte Küchen aus (`state.settings.preferredCuisines: Set<string>`).
- Reroll gewichtet doppelt: `shuffled()` bekommt weighted pool. Kein harter Filter — vermeidet Monotonie.

### Iteration 4 — Profil + Tageskalorien

- Alter, Größe, Gewicht, Geschlecht, Aktivitätslevel → Mifflin-St Jeor Formel → BMR × PAL.
- Ziel-Modus (Halten / Abnehmen / Aufbauen, ±500 kcal Adjustment).
- Makro-Verteilung: Standard 30/40/30 (P/KH/F) oder Custom Slider.
- **Anzeige:** irgendwo Ziel-vs-Ist Wochensumme — möglicher Platz: Selection-Chip im Header wechselt auf Kalorien-Info wenn Profil ausgefüllt? Design offen.

### Iteration 5 — Dark Mode

- CSS `@media (prefers-color-scheme: dark)` in `tokens.css` — alle `--md-sys-color-*` bekommen dark Varianten (M3 hat definierte Dark-Palette).
- Manual-Override im Settings: Auto / Hell / Dunkel, gespeichert in `state.settings.theme`.
- Body-Klasse setzen (`document.body.dataset.theme = state.settings.theme`) für Override, Media Query bleibt Fallback für "auto".

### Iteration 6 — Akzentfarbe / Dynamic Color

- Prüfe ob `capacitor-android-dynamic-color` (Community Plugin) wartungsstabil ist. Falls ja → integrieren, `WallpaperColors.primaryColor` als CSS-Var für alle primary-basierten Tokens.
- Fallback: manueller Farbwähler in Settings (5–6 Presets).

### Iteration 7 — Datenverwaltung

- Export: `state` als JSON zum Download / Clipboard.
- Import: JSON parsen, in `state` schreiben, `saveState()`, `refresh()`. Validation gegen Schema.
- "Alle Daten zurücksetzen" mit Bestätigungs-Dialog.

### Iteration ∞ — Gerichte-Import (siehe `docs/backlog.md`)

- Neue "Meine Gerichte"-Section im Settings-Sheet: Formular oder JSON-Paste.
- Nutzt das im Backlog dokumentierte JSON-Template + AI-Bild-Prompt.
- Bild-Handling: Upload → in `public/dishes/` speichern (schwer im WebView-Kontext, evtl. via Capacitor Filesystem Plugin).

## Constraints (aus CLAUDE.md)

- **Kein Framework** ohne Rückfrage — Vanilla JS + ES Modules.
- **Keine Tests** (Solo-Projekt).
- **Deutsche UI-Strings**.
- **Touch-Targets ≥ 48 px**.
- **Storage-Key `mahlzeit-state-v2`** unveränderlich ohne Migration (Guardrail).
- **Package-ID mit `applicationIdSuffix ".dev"`** auf `redesign` — parallele Installation zur alten "Mahlzeit" möglich. **Vor Merge auf `main` zurücknehmen**, siehe Commit `683d903` und `capacitor.config.json`.

## Bekannte Environment-Constraints

- **Subagent-Worktree-Dispatch schlägt fehl:** Sandbox verweigert `Agent`-Aufrufe. Alle Sessions liefen in Direktausführung — genauso weitermachen.
- **`curl` im Bash-Sandbox braucht absoluten Pfad** (`/usr/bin/curl`).

## Erster empfohlener Move für Session 8

```bash
git status                                    # sicherstellen: on redesign, clean
git log --oneline main..redesign | head       # inspiziere alle Commits seit main
grep -rn "preferences\|state.settings" src/   # Wie Settings aktuell verdrahtet ist
cat docs/backlog.md                           # welche Features vorgemerkt sind
```

Danach mit User klären: **Iteration 2 (Ernährungspräferenzen)** direkt starten, oder eine andere aus der Liste priorisieren? Meine Empfehlung wäre Iteration 2, weil sie direkt Nutzwert liefert (User kann sofort filtern) und dishes.json-Migration eine gute Grundlage für weitere Features ist.
