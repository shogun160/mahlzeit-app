# Handoff — Mahlzeit-App Rebuild, Session 3

## Kontext in einem Satz

Du übernimmst einen laufenden Rebuild einer Meal-Planner-App (Capacitor + Vanilla JS + Vite). Session 2 (Dashboard komplett: 7 Tage dynamisch, State-Skeleton, `dishes.json` aus `main` extrahiert) ist abgeschlossen. Jetzt steht Session 3 an: **Interaktionen — Reroll (single + all), Portion-Stepper (lokal + global), Auswahl pro Tag für Einkaufsliste**.

## Wo du dich orientieren solltest — Pflichtlektüre

Alles Wichtige ist im Repo, du musst nur die richtigen Files kennen:

1. **`CLAUDE.md`** — projekt-übergreifender Kontext (was ist die App, wer ist der Nutzer, wie kollaboriert er, Landkarte, 7 Guardrails). **Wird beim Session-Start automatisch geladen.**
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — vollständige Rebuild-Spec (Ziele, Tech-Stack, Ordner-Struktur, Design-Tokens, 7-Session-Roadmap, Guardrails). Session 3 ist Zeile in der Roadmap-Tabelle: *"Interaktionen — Reroll (single + all), Portion-Stepper (lokal + global), Auswahl für Einkaufsliste"*.
3. **`docs/redesign/2026-07-25-session-1-plan.md`** und **`docs/redesign/2026-07-25-session-2-plan.md`** — die zwei bisherigen Session-Pläne. Zeigen die etablierte Task-Granularität, Commit-Konventionen und Doku-Stil.

Nicht duplizieren was in diesen Docs steht — lies sie, dann beginne.

## Aktueller Repo-Zustand

- **Branch:** `redesign` (nicht `main`!) — auf GitHub gepusht
- **15 Commits** ontop of main: `git log --oneline main..redesign`
- **Working Tree:** sauber, `www/` ist gelöscht (gitignored — Vite generiert neu)
- **Dev-Server:** läuft NICHT — start bei Bedarf mit `npm run dev` (Port 5173, öffnet Browser automatisch)

## Was in Session 2 gebaut wurde

Kurz halten: `find . -not -path './node_modules/*' -not -path './android/*' -not -path './.git/*' -type f | sort` zeigt den aktuellen Baum. Kurzfassung der neuen bzw. geänderten Files:

- **NEU:** `src/data/dishes.json` — komplette DATA aus `main:www/index.html` extrahiert (17 Dishes + 63 Meta-Einträge, ~54 KB, JSON pretty-printed, UTF-8 ohne ASCII-Escapes). Alle 17 Dishes hatten in `main` bereits **kein** `img`-Feld — die Bilder werden über `dish.id` geladen (`/dishes/dish-${id}.jpg`).
- **NEU:** `src/state.js` — exportiert `DAYS` (7 dt. Wochentage), `state`-Objekt mit den fünf Slots aus Design-Doc Section 6 (`assignment`, `selected`, `portions`, `globalPortions`, `checkedShopping`) und `initState(assignment)` für Defaults. Keine Persistenz, keine Reaktivität, keine Interaktionen — pure Datenstruktur + Init-Helper.
- **GEÄNDERT:** `src/dashboard/card.js` — nimmt jetzt das ganze `dish`-Objekt entgegen (`{ id, name, cuisine, cooktime, ... }`) und baut `imageSrc` selbst aus `dish.id`.
- **GEÄNDERT:** `src/dashboard/render.js` — importiert `dishes.json` + `state.js`, Fisher-Yates auf allen 17 IDs, erste sieben als initiales Assignment, `initState`, dann pro Tag Card rendern.

Sichtbares Resultat: sieben Karten Mo–So mit realen Dishes und Bildern. Reload wechselt das Assignment (Zufall, noch keine Persistenz).

## Was für Session 3 zu tun ist

Aus dem Design-Doc Section 1 (Feature-Parität) und Roadmap-Zeile Session 3:

1. **Reroll pro Karte** mit **Shuffle-Bag-Logik**: pro Tag ein "würfeln"-Button. Beim Klick wird das Gericht dieses Tages durch ein neues ersetzt, das noch nicht "gezogen" ist. Sobald alle 17 Dishes einmal gezogen wurden, wird der Bag zurückgesetzt. Wichtig: **das aktuell zugeordnete Gericht anderer Tage soll nicht durch ein Reroll überschrieben werden**. Konkret heißt "gezogen" = "in der aktuellen Assignment enthalten" ∪ "in dieser Runde schon per Reroll rausgeflogen". Genaue Semantik ist in der alten App auf `main` implementiert (siehe `git show main:www/index.html` — Suche nach `reroll` und Bag-Logik).

2. **"Reroll all"** (Header-Button): kompletter neuer Wochenplan, resettet den Bag.

3. **Portion-Stepper pro Tag** (Card-lokale +/− Buttons): setzt `state.portions[day]`. Min 1, Max: alte App hatte 8 als Cap — bitte bestätigen. Anzeige an der Card irgendwo (aktuelles Design zeigt Portions nicht — muss designed werden).

4. **Global-Portions** (Header-Regler): setzt `state.globalPortions` und **überschreibt bei Change alle `state.portions[day]`**.

5. **Auswahl pro Tag für Einkaufsliste** (Checkbox/Toggle auf der Card): setzt `state.selected[day]` = true/false. Default (aus `initState`) ist überall true.

Alle Interaktionen brauchen ein **einfaches Re-Render-Muster**: nach jeder State-Mutation `renderDashboard(document.getElementById('app'))` erneut aufrufen. Kein Framework, kein Diffing — bei 7 Cards ist Full-Rerender billig genug. Falls Flicker/Focus-Loss zum Problem wird, kann pro Card ein Element-Update später nachgezogen werden.

**Header-Bereich muss neu gebaut werden** — bisher gibt es keinen. Vorschlag: `src/dashboard/header.js` mit Reroll-All-Button und Global-Portions-Regler, per `renderHeader(root)` ganz oben im `#app` gerendert.

## Constraints (aus Design-Doc / CLAUDE.md, hier zur Erinnerung)

- **Kein Framework** (Vue/React/etc.) ohne Rückfrage — Vanilla JS bleibt
- **Vanilla JS mit ES Modules**, kein TypeScript, keine Tests
- **Deutsche UI-Strings**
- **Nach Änderungen an HTML/JS/CSS:** kein `npx cap sync` in dieser Session nötig (kein APK-Test vor Session 7)
- **Persistenz erst Session 6** — Session 3 mutiert nur In-Memory-State, Reload wirft alles weg (weiterhin OK für diese Phase)
- **Touch-Targets ≥ 48px** (siehe Tokens `--touch-target-min: 48px`) — beim Button-Design beachten

## Bekannte Environment-Constraints

- **Subagent-Worktree-Dispatch schlägt fehl:** Der Sandbox verweigert `Agent`-Aufrufe mit "Cannot create agent worktree: not in a git repository and no WorktreeCreate hooks are configured". In Session 1 und 2 haben wir deshalb auf **Direktausführung** in der Haupt-Session umgeschwenkt — genauso weitermachen, es sei denn du bekommst Worktree-Hooks konfiguriert.
- Der `superpowers:subagent-driven-development`-Skill ist damit praktisch **nicht nutzbar**. User weiß das und hat es akzeptiert.

## Empfohlener Skill-Flow für Session 3

1. `writing-plans` invoken, den Session-3-Plan schreiben (analog zu Session-1-/Session-2-Plan, ablegen unter `docs/redesign/2026-07-25-session-3-plan.md`)
2. Plan vom User approven lassen (visuelle Design-Fragen für Reroll-Button, Portion-Stepper, Selection-Toggle ggf. hier klären)
3. Wegen Worktree-Constraint: `executing-plans` direkt in der Haupt-Session ausführen. Nach jeder Interaktion einen kurzen visuellen Checkpoint mit dem User setzen (der User muss selbst im Browser klicken, du kannst nur den Dev-Server starten und curl'en).

## Bewusste Entscheidungen aus Session 2, die für Session 3 relevant sind

- **`state.js` ist bereits die zentrale State-Quelle.** Session 3 mutiert `state.assignment[day]`, `state.portions[day]`, `state.globalPortions`, `state.selected[day]` direkt und re-rendert. Kein Reducer, kein Event-Bus.
- **`dishesData.dishes` (Array) und `dishesById` (Map) sind in `render.js` privat.** Wenn Reroll-Logik in ein eigenes Modul zieht (z. B. `src/dashboard/reroll.js`), Zugang zu diesen Datenstrukturen wieder aufbauen — oder besser `dishesById` aus `render.js` in ein gemeinsames `src/data/dishes.js` heben, das die JSON importiert, Map baut und beides exportiert. Wäre eine saubere Refaktorierung als Task 0 vor der eigentlichen Reroll-Arbeit.
- **`initState` setzt Portions-Default = 1 und Selected = true für alle Tage.** Wenn Global-Portions initial nicht 1 sein soll (z. B. 2), das in Task 2/3 nachziehen.
- **Bild-URL wird in `card.js` gebaut** (`/dishes/dish-${dish.id}.jpg`). Session 3 muss daran nichts anfassen.
- **Zufalls-Pool ist derzeit alle 17 IDs mit `Math.random()`.** Für Shuffle-Bag musst du einen persistenten Bag-Zustand einführen (z. B. `state.dishBag: number[]` — Array der noch nicht gezogenen IDs). Design-Frage: `dishBag` als State-Slot in `state.js` aufnehmen, oder modul-lokal in `reroll.js` halten. Empfehlung: als State-Slot, damit Session 6 (Persistenz) den Bag automatisch mit serialisiert und Reroll-Historie nach Reload konsistent bleibt.

## Erster empfohlener Move

```bash
git status                                # sicherstellen: on redesign, clean
git log --oneline main..redesign          # 15 commits inspizieren
cat docs/redesign/2026-07-25-session-2-plan.md | tail -40    # DoD von Session 2 prüfen
```

Dann `writing-plans` invoken und dem User erklären dass du in Session 3 einsteigst. Optional vorher kurz `git show main:www/index.html | grep -n "reroll\|bag" | head -20` — die alte Reroll-Implementierung auf `main` als Referenz für die Bag-Semantik.
