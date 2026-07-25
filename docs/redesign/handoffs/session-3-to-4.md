# Handoff — Mahlzeit-App Rebuild, Session 4

## Kontext in einem Satz

Du übernimmst einen laufenden Rebuild einer Meal-Planner-App (Capacitor + Vanilla JS + Vite). Session 3 (Header mit Global-Portion-Stepper + Reroll-All, pro Card Portion-Stepper + Wechseln + Liste-Toggle, Shuffle-Bag im State, `refresh()`-Orchestrierung) ist abgeschlossen. Jetzt steht Session 4 an: **Detail-Sheet — Sheet-Component, Zutaten-View, Rezept-View, Swipe zwischen Tabs**.

## Wo du dich orientieren solltest — Pflichtlektüre

Alles im Repo, du musst nur die richtigen Files kennen:

1. **`CLAUDE.md`** — projekt-übergreifender Kontext (was ist die App, wer ist der Nutzer, wie kollaboriert er, Landkarte, 7 Guardrails). **Wird beim Session-Start automatisch geladen.**
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — vollständige Rebuild-Spec. Session 4 ist Zeile in der Roadmap-Tabelle: *"Detail-Sheet — Sheet-Component, Zutaten-View, Rezept-View, Swipe zwischen Tabs"*.
3. **`docs/redesign/2026-07-25-session-3-plan.md`** — Session-3-Plan mit den Interaktions-Modulen, die jetzt existieren. Zeigt Task-Granularität und Commit-Konventionen.
4. **`docs/redesign/handoffs/session-2-to-3.md`** — voriger Handoff (falls du die Bag-Historie nachlesen willst).

Nicht duplizieren was in diesen Docs steht — lies sie, dann beginne.

## Aktueller Repo-Zustand

- **Branch:** `redesign` (nicht `main`!) — bei Session-Ende auf GitHub gepusht
- **Commits seit main:** `git log --oneline main..redesign` (Session 3 hat ~14 Commits addiert)
- **Working Tree:** sauber, `www/` gelöscht (gitignored — Vite generiert neu)
- **Dev-Server:** läuft NICHT — start bei Bedarf mit `npm run dev` (Port 5173, öffnet Browser automatisch)

## Was in Session 3 gebaut wurde

Kurz halten: `find . -not -path './node_modules/*' -not -path './android/*' -not -path './.git/*' -type f | sort` zeigt den aktuellen Baum.

**Neue Files:**
- `src/data/dishes.js` — importiert `dishes.json`, exportiert `allDishes`, `dishesById`, `allDishIds`, `ingredientMeta`, `shuffled()`
- `src/dashboard/reroll.js` — `rerollDay(day)` mit Shuffle-Bag-Semantik (pro Karte eigene Queue), `rerollAll()` (7 neue Dishes, Bags reset)
- `src/dashboard/portions.js` — `changePortion(day, delta)`, `changeGlobalPortion(delta)` mit Clamp [1, 6]
- `src/dashboard/selection.js` — `toggleSelected(day)`
- `src/dashboard/header.js` — `renderHeader(root, { onGlobalPortionChange, onRerollAll })`
- `styles/components/header.css` — Sticky-Top, Safe-Area-Aware, `.icon-btn`-Basis
- `styles/components/stepper.css` — Shared zwischen Header und Card, `.stepper` + `.stepper--compact`

**Geänderte Files:**
- `src/state.js` — Konstanten `PORTIONS_MIN`, `PORTIONS_MAX`, State-Slot `dishBag`, `initState` setzt `selected` auf `false` (nicht `true` wie in Session 2)
- `src/dashboard/render.js` — nutzt jetzt `data/dishes.js`, verdrahtet Card-Handler an die Interaktions-Module, exportiert `renderDashboard(root, onChange)`
- `src/dashboard/card.js` — Portion-Stepper unten in der Meta-Row, Action-Row mit "Wechseln" und "Liste" darunter, `.day-card--selected`-Modifier für Selected-State
- `src/main.js` — orchestriert Header + Dashboard über eine lokale `refresh()`-Funktion
- `index.html` — zwei neue CSS-Links (`header.css`, `stepper.css`), `<div id="app-header">` vor `<main id="app">`
- `styles/base.css` — `main`-`padding-top` auf 8 px reduziert (Header liefert eigene Top-Padding)
- `styles/components/card.css` — Meta-Row zweispaltig, Action-Row, Selected-Ring in Primary-Farbe

Sichtbares Resultat: alle Interaktionen aus Design-Doc Section 1 sind live. Reload wechselt weiterhin das Assignment (keine Persistenz).

## Was für Session 4 zu tun ist

Aus Design-Doc Section 1 und Roadmap-Zeile Session 4:

1. **Sheet-Component**: Bottom-Sheet, das den Screen von unten überlagert. Backdrop halbtransparent, Sheet oben abgerundet, ~85% der Höhe. Öffnet mit Slide-Up-Animation, schließt per Backdrop-Klick, Swipe-Down oder Escape-Taste.

2. **Trigger**: Klick auf das Card-Image ODER auf eine neue Aktion (z. B. Card-Body-Klick auf den Bereich außerhalb der Buttons). Alte App hat drei Trigger: Klick auf Bild → Rezept-Tab, Klick auf Content-Area → Rezept-Tab, Klick auf "Zutaten"-Action-Button → Zutaten-Tab. Session 3 hat den Zutaten-Button bewusst weggelassen — Session 4 muss ihn hinzufügen (neben "Wechseln" und "Liste" in der Action-Row). Fürs Öffnen also drei Wege: Bild → Rezept, Content → Rezept, Zutaten-Button → Zutaten.

3. **Zwei Tabs im Sheet**: **"Zutaten"** und **"Rezept"**. Tab-Header oben unter dem Titel, Content-Area darunter.

4. **Zutaten-View**: Liste aus `dish.ingredients`. Jede Zutat hat `label` (String, z. B. "Wildlachs (Sockeye), Filet"), `grams` (Basis-Menge bei 1 Portion). Für die Anzeige die Basis-Grammzahl mit `state.portions[day]` multiplizieren. Format der Menge siehe alte App — vermutlich rundet sie auf ganze Gramm bzw. auf "Stück"/"Zehe"/"Bund" bei `unit != 'g'`.

5. **Rezept-View**: nummerierte Liste aus `dish.steps` (Array of Strings, 5–8 Schritte).

6. **Swipe zwischen Tabs**: Horizontales Swipe wechselt zwischen Zutaten und Rezept. Der Track hinter den Tabs animiert horizontal (transform: translateX). Auch Klick auf Tab-Label wechselt.

**Modul-Vorschlag** (analog zu Session 3):
- `src/detail-sheet/render.js` — `openDetailSheet(dishId, tab, day)` und `closeDetailSheet()`, verwaltet ein eigenes Root-Element (nicht Teil von `refresh()` in `main.js`).
- `src/detail-sheet/ingredients.js` — rendert die Zutaten-Liste mit Portionen-Skalierung.
- `src/detail-sheet/recipe.js` — rendert die Rezept-Schritte.
- `src/util/format.js` — evtl. Hilfsfunktion für "220 g" / "1½ Stück" Formatting.
- `styles/components/sheet.css` NEU.
- `index.html` — zusätzliches Root-Element `<div id="detail-sheet"></div>`, weiterer CSS-Link.

## Referenz-Semantik in `main`

Für Menge-Format-Details und Sheet-Animation:
```bash
git show main:www/index.html | grep -n "openDetailSheet\|sheet\|Sheet\|closeSheet\|tab-\|swipe" | head -40
git show main:www/index.html | sed -n '<line-range>'  # gezielt nachlesen
```

Insbesondere:
- Menge-Formatting: wie werden `grams * portions` mit `unit`-Kontext dargestellt?
- Sheet-Öffnungs-Animation: Transition-Dauer, Backdrop-Fade, Swipe-Down-Threshold?
- Tab-Swipe-Logik: pointer-events, translateX, snap-Verhalten?

## Constraints (aus Design-Doc / CLAUDE.md, hier zur Erinnerung)

- **Kein Framework** ohne Rückfrage
- **Vanilla JS + ES Modules**, kein TypeScript, keine Tests
- **Deutsche UI-Strings**
- **Touch-Targets ≥ 48 px** — Tab-Header, Close-Button beachten
- **Persistenz erst Session 6** — Sheet-Zustand (offener Tab pro Sheet-Session) bleibt In-Memory
- **`refresh()` in `main.js` triggert nur Header + Dashboard.** Detail-Sheet rendert sich selbst, öffnet und schließt außerhalb dieses Zyklus.

## Bekannte Environment-Constraints

- **Subagent-Worktree-Dispatch schlägt fehl:** Der Sandbox verweigert `Agent`-Aufrufe. Sessions 1–3 wurden in Direktausführung in der Haupt-Session gefahren — genauso weitermachen.

## Empfohlener Skill-Flow

1. `writing-plans` invoken, Session-4-Plan schreiben (analog zu Session-3-Plan, ablegen unter `docs/redesign/2026-07-25-session-4-plan.md`)
2. Plan vom User approven lassen — insbesondere Design-Fragen zum Sheet (Höhe, Backdrop-Farbe, Tab-Style)
3. `executing-plans` direkt in Haupt-Session. Nach jeder größeren Interaktion (Sheet öffnet, Tabs wechseln, Zutaten skalieren) HTTP-Smoke-Test + visueller Checkpoint mit User (Screenshot).

## Bewusste Entscheidungen aus Session 3, die für Session 4 relevant sind

- **Card öffnet aktuell kein Detail-Sheet.** Card-Body-Klick macht nichts, nur die drei Buttons (Wechseln, Liste) reagieren. Session 4 muss Card-Klicks auf Bild und Content-Bereich an einen `onOpenDetail(dishId, tab)`-Handler weiterreichen. Handler kommt aus `main.js` und ruft `openDetailSheet(...)`.
- **Zutaten-Button fehlt in der aktuellen Card.** Session 4 fügt einen dritten Action-Button hinzu, in der Reihenfolge: **Zutaten | Wechseln | Liste** (analog zur alten App auf `main`).
- **`state.portions[day]` ist die Portionen-Quelle** für die Zutaten-Skalierung. Sheet muss `day` kennen um `state.portions[day]` lesen zu können — deswegen `openDetailSheet(dishId, tab, day)` mit day als Parameter.
- **`dishesById.get(dishId)`** liefert `dish.ingredients` (Array mit `{ key, label, grams, unit, size, note, ... }`) und `dish.steps` (Array Strings). Beides schon in `src/data/dishes.js` erschlossen.
- **`state.dishBag`** ist Karten-spezifisch — beim Sheet nicht relevant, aber falls im Sheet ein "Wechseln"-Trigger sitzt, muss der State-Slot mit versorgt werden. (Empfehlung: kein Wechseln im Sheet — bleibt Card-Aktion.)
- **`refresh()` in main.js** erzeugt neue DOM-Nodes bei jedem Aufruf — Selected-State-Toggle im Sheet ändert `state.selected[day]` und ruft `refresh()` für die Card-Aktualisierung. Sheet selbst rerendert sich unabhängig.

## Erster empfohlener Move

```bash
git status                                # sicherstellen: on redesign, clean
git log --oneline main..redesign          # ~20 commits inspizieren
git show main:www/index.html | grep -n "openDetailSheet\|sheet-\|swipe\|ingredient-line\|step-line" | head -30
```

Dann `writing-plans` invoken und dem User erklären dass du in Session 4 einsteigst. Kurze Vorab-Klärung: **Sheet-Höhe (85% vs. fullscreen), Backdrop-Verhalten (Fade + Blur? nur Fade?), und ob Zutaten-Skalierung `grams * portions` linear oder z. B. bei `stueck`-Unit gerundet sein soll**.
