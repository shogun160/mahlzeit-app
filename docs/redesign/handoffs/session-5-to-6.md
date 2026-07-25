# Handoff — Mahlzeit-App Rebuild, Session 6

## Kontext in einem Satz

Du übernimmst einen laufenden Rebuild einer Meal-Planner-App (Capacitor + Vanilla JS + Vite). Session 5 (Einkaufsliste — Konsolidierung, Kategorien, Progress, Swipe-Nav) ist abgeschlossen, dann kam eine "Session 5.5" mit umfangreichen UX-Verbesserungen an der Einkaufsliste (7 Kategorien statt 5, Leftover-Sichtbarkeit, einklappbare Sticky-Stack-Header, Scroll-Kompensation). Jetzt steht Session 6 an: **Bottom-Navigation + localStorage-Persistenz** — plus zwei kleine Nachzügler (Toggle-All-Button im Dashboard-Header, Done-Banner in der Einkaufsliste), die ich empfohlen habe hier mit reinzunehmen.

## Wo du dich orientieren solltest — Pflichtlektüre

Alles im Repo:

1. **`CLAUDE.md`** — projekt-übergreifender Kontext (7 Guardrails). **Wird beim Session-Start automatisch geladen.**
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — vollständige Rebuild-Spec. Session 6 ist in der Roadmap-Tabelle als *"Bottom-Navigation + localStorage-Persistenz"* gelistet.
3. **`docs/redesign/2026-07-25-session-5-plan.md`** — Session-5-Plan mit den Modulen die entstanden sind und den Design-Entscheidungen (Swipe-Nav, Check-stays, sticky Progress).
4. **`docs/redesign/handoffs/session-4-to-5.md`** — voriger Handoff (Detail-Sheet + Card-Layout), historischer Kontext.

Nicht duplizieren — lies sie, dann beginne.

## Aktueller Repo-Zustand

- **Branch:** `redesign` (nicht `main`!) — auf GitHub gepusht
- **Letzter Commit:** `07f61ca feat(shopping): 7 categories, leftover-items, collapsible sticky-stack headers`
- **Commits seit main:** Session 5 (~25 Commits) + Session 5.5 (1 zusammengefasster Commit)
- **Working Tree:** sauber, `www/` gelöscht (gitignored — Vite generiert neu)
- **Dev-Server:** läuft NICHT — start bei Bedarf mit `npm run dev` (Port 5173)

## Was in Session 5 gebaut wurde (Zusammenfassung)

Kern-Feature Einkaufsliste (Konsolidierung + Rendering) plus umfangreicher Card-Feinschliff:
- Makros-Overlay unten rechts auf Bild, kcal als Primary-Chip, P/KH/F als frosted-white Pills.
- Portion-Stepper aufs Bild als frosted-glass Pill.
- Zutaten-Anzahl-Badge wandert zwischen Zutaten-Icon (nicht selected) und Liste-Icon (selected).
- Header-Row mit Wochentag links + Meta rechts, Titel einzeilig.
- Global Primary-Tint als Token für Aktiv-Zustände.
- Screen-Wechsel Dashboard ↔ Shopping via horizontalem Swipe.
- Detail-Sheet: Close-Swipe (Handle + Header), Rezept-Nummern zentriert.
- Reroll-Bug: `rerollAll()` setzt `state.portions[day] = state.globalPortions` für alle Tage.

Details siehe frühere Version dieses Handoffs im Git-History (`git show 061219f -- docs/redesign/handoffs/session-5-to-6.md`) oder in den entsprechenden Commit-Messages `git log --oneline 848d915..061219f`.

## Was in Session 5.5 gebaut wurde (nach Session-5-Handoff, Commit `07f61ca`)

Alles rund um die Einkaufsliste — als Reaktion auf UX-Testing des Users am Handy.

### Neue Kategorien (7 statt 5)

- **Reihenfolge:** `fleisch_fisch, frisch, kuehlung, trocken, gewuerze, oel, sonstig`
- **Labels:** *Fleisch & Fisch, Obst & Gemüse, Kühlung, Trocken / Konserven, Gewürze, Öl / Fett, Sonstiges*
- `src/shopping-list/categories.js` entsprechend erweitert.
- `src/data/dishes.json` per Migrations-Skript umgemappt:
  - 11 Zutaten → `fleisch_fisch` (lachs_sockeye, lachs_keta, kabeljau, garnelen, haehnchenbrust, putenhack, rinderfilet, rind_sirloin, entenbrust, schweinefilet, lammkeule; ohne `rindergulasch`, weil das nicht im meta ist)
  - 7 Zutaten → `kuehlung` (ei, feta, joghurt_griech, skyr, kimchi, edamame, erbsen_tk)
  - Rest unverändert.

### Leftover-Sichtbarkeit

- **Neue Registry:** `src/data/ingredient-registry.js` — baut ein Lookup `{ [key]: { label, cat, unit, size, note } }` aus allen `dish.ingredients` (nicht aus `meta`, weil `meta` unvollständig ist, siehe `rindergulasch`).
- `consolidate.js` fügt für jeden abgehakten Key ohne aktives Gericht einen `isLeftover: true`-Eintrag ein, mit Meta aus der Registry.
- `formatQuantity` in `src/util/format.js` zeigt `"Nicht mehr im Plan"` für `isLeftover`-Items.
- Beim Unhaken verschwindet das Leftover-Item automatisch (nicht mehr in `checkedShopping` → wird beim nächsten Render nicht mehr rekonstruiert).

### Einklappbare Kategorien + Sort + FLIP-Animation

- **Neuer State:** `state.collapsedCategories: Set<string>` in `src/state.js`.
- **Neues Modul:** `src/shopping-list/collapse.js` (`isCollapsed`, `toggleCollapsed`, `expandCategory`).
- Kategorie-Header ist ein voll klickbarer Button mit Chevron (rotiert -90° wenn eingeklappt), Titel und **Zähler-Anzeige** im Format `gekauft/gesamt` (z. B. `2/5`).
- **Sortierung pro Kategorie:** offene alphabetisch zuerst, abgehakte alphabetisch ans Ende.
- **FLIP-Animation** (380 ms) beim Umsortieren via `playFlip()` in `render.js` — Guard gegen 0×0-Rects damit Collapse-Toggle nichts wildes animiert.
- **Auto-Collapse:** wenn die letzte offene Zutat einer Kategorie abgehakt wird → einklappen. Beim Unhaken → wieder ausklappen. Läuft in `syncAutoCollapse()` im Item-Klick-Handler.

### Sticky-Stack-Header (das kniffligste)

**Ziel:** alle sichtbaren Kategorie-Header sammeln sich unter der Progress-Bar an, wenn der User weiter runter scrollt (Google-Contacts-Style).

- **Flache DOM-Struktur** in `.shop-groups`: Header + ul liegen als direkte Geschwister, kein `<section>`-Wrapper mehr. **Grund:** sticky bindet an den nearest scrolling ancestor, aber "verlässt" sticky sobald der Container-Ende überschritten wird. Ohne gemeinsamen langen Container würde jeder Header verschwinden, sobald seine Section oben rausscrollt. Flache Struktur = alle Header teilen sich `.shop-groups` als Container, alle bleiben sticky.
- **`--stack-idx`** wird pro Header inline gesetzt: `top: calc(var(--shop-progress-height) + var(--stack-idx) * var(--shop-group-header-height))` — jede Kategorie klebt unter der vorigen.
- **`--shop-progress-height`** wird zur Laufzeit gemessen (`updateProgressHeightVar()` in `render.js`) und als CSS-Var auf `root` gesetzt.
- **Progress + Header sind opak** (statt frosted-glass) — sonst schimmern wegscrollende Header durch die transparente Progress-Bar durch.
- **Full-Width-Fix:** `width: calc(100% + 32px)` in Kombination mit `margin: 0 -16px` — negatives margin alleine verbreitert nicht, nur die width tut es.
- **Abstand zwischen Kategorien** liegt bewusst auf `ul.margin-bottom: 22px` (nicht auf Header) — bei collapsed ul (display:none) entfällt der margin, Header liegen dicht aneinander wie im Sticky-Stack.

### Kontextabhängiger Header-Klick

- **Header nicht sticky (natürliche Position):** Klick togglet ein/aus.
- **Header ist sticky UND ul nicht mehr sichtbar unter ihm** (Kategorie weit weg gescrollt): Klick expandiert + scrollt zur ul.
- **Header ist sticky UND ul teilweise sichtbar** (der unterste sichtbare Header): Klick togglet (einklappen).
- Detektion via `isHeaderSticky()` (relative Position vs. berechnete sticky-top) und `isListVisibleBelow()` (ul.bottom > header.bottom).
- **Scroll-Target:** die `ul` (nicht der sticky Header selbst, der bewegt sich ja nicht). `scroll-margin-top` auf ul sorgt dafür, dass sie unter dem Sticky-Stack andockt.

### Scroll-Kompensation beim manuellen Einklappen

Damit beim Einklappen einer Kategorie die Sicht des Users nicht springt:
- Berechnung: `scrolledPast = rootRect.top - listRect.top` — wie viel der ul schon oben rausgescrollt ist.
- Kompensation: `Math.max(0, Math.min(scrolledPast, listSpace))` — max: gesamte ul-Höhe + margin.
- Wird nach `onChange()` (also nach Re-Render) auf `root.scrollTop` angewandt.
- Effekt: wenn User in Kat 1 ist und Kat 2 einklappt (die weit unten liegt), keine Kompensation (`scrolledPast <= 0`) → seine Sicht bleibt stabil.

### Layout-Tweaks

- `.view--shopping { padding-top: 0; gap: 0; }` — erste Kategorie klebt in beiden Zuständen (natürlich + sticky) direkt unter der Progress-Bar (identische Position).
- `.shop-progress { margin-bottom: 0; }` — dito.

## Was für Session 6 zu tun ist

### 1. Bottom-Navigation (Kern-Feature)

- Fixed am unteren Rand, `--bottom-nav-height: 64px` bereits in tokens.css reserviert
- Zwei Tabs: **Dashboard** (Icon `/icons/icon-dashboard.png`, bereits vorhanden) und **Einkaufsliste** (Icons `/icons/icon-einkaufsliste-aktiv.png` + `/icons/icon-einkaufsliste-inaktiv.png`, bereits vorhanden)
- Tab-Click ruft dasselbe `setView(next) + refresh()`-Paar wie der Swipe (Session 5, `src/nav/swipe.js`). Kein zweiter State-Slot — Bottom-Nav und Swipe schreiben auf identischen `state.view`.
- Aktiver Tab visuell hervorheben (z. B. mit `--md-sys-color-primary-tint` — passt zur globalen Aktiv-Farbe)
- Safe-Area unten respektieren: `padding-bottom: env(safe-area-inset-bottom)`
- Views bekommen `padding-bottom: var(--bottom-nav-height) + safe-area` damit letzter Content nicht unter der Nav verschwindet (aktuell nur `safe-area + 20px`)
- Sheet + Backdrop müssen visuell ÜBER der Bottom-Nav liegen (z-index: view < bottom-nav < sheet-overlay)

**Modul-Vorschlag:**
```
src/nav/
  bottom.js         ← NEU: renderBottomNav(root, { onNavigate })
  swipe.js          ← existiert, unverändert
styles/components/
  bottom-nav.css    ← NEU
index.html          ← <nav id="bottom-nav" class="bottom-nav"></nav> nach <main>
```

### 2. localStorage-Persistenz (Kern-Feature)

- **Storage-Key:** `mahlzeit-state-v2` (Guardrail in CLAUDE.md — v1 = alte App auf `main`, v2 = Rebuild)
- Serialisieren nach jedem `refresh()` in `main.js`
- **Set-Konvertierung:**
  - `state.checkedShopping` ist `Set<string>` → `Array.from()` beim Serialisieren, `new Set(...)` beim Laden
  - `state.collapsedCategories` ist `Set<string>` → dito (NEU seit Session 5.5)
- Plain Objects (`assignment`, `selected`, `portions`, `dishBag`) gehen direkt durch JSON
- `state.view` mit persistieren → User startet auf letzter Ansicht
- `state.globalPortions` mit persistieren
- Beim App-Start: `loadState()` in `state.js`, fällt auf Init-Defaults zurück wenn nichts gespeichert oder JSON-Parse fehlschlägt
- Auto-Save via Wrapper um `refresh()` oder als eigener `persistState()`-Aufruf nach jedem Mutator

**Modul-Vorschlag:** direkt in `src/state.js` erweitern — Overhead ist klein, kein extra Modul nötig für ~30 LOC.

### 3. Nachzügler (aus dem Session-5.5-Abgleich)

Zwei kleine Features, die aus dem alten `main`-Code noch fehlen und thematisch gut in Session 6 passen:

**a) Toggle-All-Button im Dashboard-Header** (~20 LOC)
- Zweiter `icon-btn` im Dashboard-Header, neben Reroll-All.
- Alte App: `toggle-all-btn` in `www/index.html` (main-Branch).
- Klick togglet alle 7 Tage in/aus `state.selected` (wenn irgendein Tag deselected → alle auf true, sonst alle auf false).
- Icon: es gibt schon `/icons/icon-einkaufsliste-aktiv.png` und `-inaktiv.png` — passendes verwenden oder ein eigenes reinlegen. Vielleicht auch das Reset-Icon-Pattern (Material Symbol).

**b) "Alles besorgt"-Banner in der Einkaufsliste** (~15 LOC)
- Erscheint wenn alle sichtbaren Items abgehakt sind (`openCount === 0` in der Progress).
- Alte App: `<div class="shop-done-banner">Sauber, alles besorgt - Mahlzeit!</div>` in `www/index.html`.
- Kann direkt unter der Progress-Bar oder über den Kategorien angezeigt werden.
- Sollte respektieren, dass es Leftover-Items geben kann (die zählen bereits als abgehakt in der Progress).

### NICHT für Session 6

**Zutaten-Check-Circles im Detail-Sheet** — bewusst NICHT hier. Ist konzeptionell größer (Semantik "check im Sheet = check in Einkaufsliste?" — ja, aber UX-Fragen wenn Gericht nicht in `selected` ist). Braucht kurze Design-Runde vor dem Bau. Empfohlen für eigene Session 7.

## Constraints (aus Design-Doc / CLAUDE.md)

- **Kein Framework** ohne Rückfrage
- **Vanilla JS + ES Modules**, kein TypeScript, keine Tests
- **Deutsche UI-Strings**
- **Touch-Targets ≥ 48 px** — Bottom-Nav-Tabs beachten
- **Storage-Key `mahlzeit-state-v2`** unveränderlich ohne Migration (Guardrail)
- **Persistenz-Trigger:** nach jedem `refresh()` in `main.js` — konsistent mit dem View-Rendering-Zyklus

## Bekannte Environment-Constraints

- **Subagent-Worktree-Dispatch schlägt fehl:** Sandbox verweigert `Agent`-Aufrufe. Sessions 1–5.5 wurden alle in Direktausführung in der Haupt-Session gefahren — genauso weitermachen.
- **`curl` im Bash-Sandbox braucht absoluten Pfad** (`/usr/bin/curl`) innerhalb von for-Loops.
- **Touch-Events feuern nicht mit Maus im Browser** — DevTools Device Mode simuliert touch für Test. Pointer-Events funktionieren mit beiden. Der Close-Swipe im Sheet nutzt Pointer-Events + `setPointerCapture`, funktioniert daher im Browser (falls Sheet-Element gefunden wird) und am Handy.

## Design-Entscheidungen für Session 6 (mit User zu klären)

1. **Bottom-Nav-Style:** Icons mit oder ohne Labels? Nur Icons ist Material-mäßig kompakter, mit Labels klarer für Nutzer. Alte App hatte Labels + Badge für offene Artikel.
2. **Persistenz-Umfang:** `state.view`, `state.globalPortions`, `state.collapsedCategories`, `state.dishBag` mit-persistieren? (Empfehlung: alle ja, für konsistentes App-Erlebnis nach Neustart.)
3. **`dishBag` (Reroll-Historie):** persistieren oder pro Session neu? Wenn ja: mehr Continuity bei Reroll. Wenn nein: fresh start jedes App-Öffnen.
4. **Badge auf Bottom-Nav-Tab:** wie in der alten App die Anzahl offener Artikel als Badge auf dem Einkaufsliste-Tab? Nützlich für schnellen Überblick.

## Bewusste Entscheidungen aus Session 5.5, die für Session 6 relevant sind

- **`state.view`, `state.collapsedCategories`** sind neu im State. Beide sollten mit-persistiert werden.
- **`setView(next)` in `state.js`** ist der zentrale View-Setter — Bottom-Nav ruft ihn identisch wie Swipe.
- **`state.checkedShopping` und `state.collapsedCategories` sind beide `Set<string>`** — Serialisierung braucht `Array.from()` und `new Set()`.
- **`state.dishBag`** ist plain Object mit Arrays (`{ [day: string]: number[] }`), geht direkt durch JSON.
- **`refresh()`** ist der zentrale Render-Trigger — Auto-Save Aufruf am Ende von `refresh()` ist der einfachste Persistenz-Hook.
- **`.view` (in view-track.css)** hat aktuell `padding-bottom: calc(safe-area + 20px)`. Session 6 muss das auf `calc(var(--bottom-nav-height) + safe-area + 20px)` erweitern, damit Content nicht unter Bottom-Nav verschwindet.
- **`.view--shopping`** hat zusätzlich `padding-top: 0; gap: 0;` — nicht anfassen, das ist der Fix für die konsistente Sticky-Header-Position.
- **z-index-Reihenfolge derzeit:**
  - `.view` — kein z-index (default 0)
  - `.shop-group__header` — z-index 4 (sticky in shop-groups)
  - `.shop-progress` — z-index 5 (sticky in view)
  - `.app-header` — z-index 10 (sticky in body flex)
  - `.sheet-overlay` — z-index 100
- **Bottom-Nav sollte z-index zwischen ~50 und 100 haben** — über view + progress + header, aber unter sheet-overlay.
- **Progress-Bar-Höhe wird dynamisch gemessen** und als `--shop-progress-height` auf `#view-shopping` gesetzt (nach jedem Render). Wenn du an Progress oder Header-Höhe schraubst, teste dass die Sticky-Positionen mitziehen.

## Fürs Merging: Nachzügler bewusst nicht heute erledigt

Ich habe bewusst NICHT gemacht in Session 5.5:
- Toggle-All-Button (kommt in Session 6, siehe oben)
- Done-Banner (kommt in Session 6, siehe oben)
- Zutaten-Check-Circles im Sheet (später, eigene Session)

Wenn der User es sich anders überlegt und diese Sachen doch früher will, sind sie alle klein genug (< 30 LOC pro Feature).

## Empfohlener Skill-Flow

1. `writing-plans` invoken, Session-6-Plan schreiben (`docs/redesign/2026-07-25-session-6-plan.md`). Vor dem Plan die 4 offenen Design-Fragen mit User klären.
2. `executing-plans` direkt in Haupt-Session. Nach Bottom-Nav-Rendering visueller Checkpoint mit User (Screenshot). Nach Persistenz: Regressionstest — App komplett neu laden, Zustand sollte identisch sein.
3. Nachzügler (Toggle-All, Done-Banner) am Ende der Session, wenn die Kern-Features stabil sind.

## Erster empfohlener Move

```bash
git status                                    # sicherstellen: on redesign, clean
git log --oneline main..redesign | head       # inspiziere alle Commits
grep -n "bottom-nav\|--bottom-nav-height" styles/tokens.css styles/base.css
grep -rn "state.view\|setView\|VIEWS\|checkedShopping\|collapsedCategories" src/
```

Dann die 4 Design-Fragen mit User klären, `writing-plans` invoken.
