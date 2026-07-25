# Handoff — Mahlzeit-App Rebuild, Session 5

## Kontext in einem Satz

Du übernimmst einen laufenden Rebuild einer Meal-Planner-App (Capacitor + Vanilla JS + Vite). Session 4 (Detail-Sheet mit zwei Tabs — Zutaten skaliert mit Portionen, Rezept-Schritte mit nummerierten Badges — horizontaler Swipe zwischen Tabs, Portion-Stepper floating unten rechts, Klick auf Card-Bild/Content oder neuen Zutaten-Button öffnet den Sheet) ist abgeschlossen. Jetzt steht Session 5 an: **Einkaufsliste — Kategorien-Rendering, Check-Interaktion, Progress-Bar**.

## Wo du dich orientieren solltest — Pflichtlektüre

Alles im Repo, du musst nur die richtigen Files kennen:

1. **`CLAUDE.md`** — projekt-übergreifender Kontext (was ist die App, wer ist der Nutzer, wie kollaboriert er, Landkarte, 7 Guardrails). **Wird beim Session-Start automatisch geladen.**
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — vollständige Rebuild-Spec. Session 5 ist Zeile in der Roadmap-Tabelle: *"Einkaufsliste — Kategorien-Rendering, Check-Interaktion, Progress-Bar"*.
3. **`docs/redesign/2026-07-25-session-4-plan.md`** — Session-4-Plan mit dem Sheet-Modul, das jetzt existiert, den Design-Entscheidungen (85vh Sheet, nur Fade, gramm-basiertes Formatting) und den Modul-Signaturen (`mountDetailSheet`, `openDetailSheet(dishId, tab, day)`, `renderIngredients(dish, portions)`).
4. **`docs/redesign/handoffs/session-3-to-4.md`** — voriger Handoff (falls du die Card-Layout-Historie nachlesen willst).

Nicht duplizieren was in diesen Docs steht — lies sie, dann beginne.

## Aktueller Repo-Zustand

- **Branch:** `redesign` (nicht `main`!) — bei Session-Ende auf GitHub gepusht
- **Commits seit main:** `git log --oneline main..redesign` (Session 4 hat 11 Commits addiert)
- **Working Tree:** sauber, `www/` gelöscht (gitignored — Vite generiert neu)
- **Dev-Server:** läuft NICHT — start bei Bedarf mit `npm run dev` (Port 5173, öffnet Browser automatisch)

## Was in Session 4 gebaut wurde

Kurz halten: `find . -not -path './node_modules/*' -not -path './android/*' -not -path './.git/*' -not -path './public/*' -type f | sort` zeigt den aktuellen Baum.

**Neue Files:**
- `src/util/format.js` — `formatGrams(baseGrams, portions)` → `"220 g"` (rundet auf ganze Gramm, keine Einheiten-aware Logik)
- `src/detail-sheet/ingredients.js` — `renderIngredients(dish, portions)` → HTML-String mit `<ul class="ingredient-list">`, jede Zutat als `<li class="ingredient">` mit Label + Menge
- `src/detail-sheet/recipe.js` — `renderRecipe(dish)` → HTML-String mit `<ol class="recipe-list">`, Nummern via CSS-Counter (kein explizites `<span>`)
- `src/detail-sheet/render.js` — Sheet-Component. Exportiert `mountDetailSheet(el, { onChange })`, `openDetailSheet(dishId, tab, day)`, `closeDetailSheet()`. Interner State: `rootEl`, `onExternalChange`, `currentContext`. Tab-Switch via `translateX` auf `.sheet-tabs__track`, Swipe-Detection auf `.sheet-body` (Threshold 55 px + Richtungs-Ratio 1.4), Escape/Backdrop/✕ schließen.
- `styles/components/sheet.css` — Overlay (fade), Sheet (85vh, translateY-Slide-In), Handle, Header, Tabs (unterstrichener Active), Track (200 % breit, translateX), Panel (eigener Scroll), Ingredient- und Recipe-Styles, **floating Portion-Pille unten rechts** (`.sheet-portion-row` + `.stepper--floating`)

**Geänderte Files:**
- `src/dashboard/card.js` — dritter Action-Button "Zutaten" als erster (Reihenfolge Zutaten | Wechseln | Liste), `<img>` bekommt `data-action="open-recipe"`, Body-Klick-Handler ruft `handlers.onOpenDetail('rezept')` (Filter `closest('.stepper, .day-card__actions')` ignoriert Stepper- und Action-Klicks). Neue Handler-Signatur: `handlers.onOpenDetail(tab)`.
- `src/dashboard/render.js` — dritter Parameter `onOpenDetail(dishId, tab, day)`, wird pro Card zu `handlers.onOpenDetail(tab)` gewrappt.
- `src/main.js` — importiert `mountDetailSheet` und `openDetailSheet`, mountet den Sheet einmalig mit `{ onChange: refresh }`, gibt `openDetailSheet` als dritten Parameter an `renderDashboard` weiter.
- `styles/components/card.css` — Cursor-Regeln: `.day-card__image` und `.day-card__body` sind `cursor:pointer`, interaktive Kinder (Stepper + Action-Button) sind `cursor:default` bzw. `cursor:pointer`.
- `index.html` — neuer `<link>` für `sheet.css`, neuer `<div id="detail-sheet-root">` vor dem `<script>`.

Sichtbares Resultat: Klick auf Card-Bild oder Meta-Text öffnet den Sheet auf dem Rezept-Tab, Klick auf den neuen "Zutaten"-Button öffnet auf dem Zutaten-Tab. Sheet-Header zeigt Wochentag + Dish-Namen groß (Portion-Pille liegt jetzt als floating Element unten rechts — nicht mehr im Header, damit der Titel volle Breite bekommt). Portion-Stepper im Sheet ändert Zutaten-Mengen live und aktualisiert im Hintergrund die Card. Backdrop/✕/Escape schließen alle. Prod-Build: 2.4 MB (JS ~39 KB, CSS ~10 KB).

## Was für Session 5 zu tun ist

Aus Design-Doc Section 1 und Roadmap-Zeile Session 5:

> "Einkaufsliste — Kategorien-Rendering, Check-Interaktion, Progress-Bar"

Feature-Parität siehe alte App auf `main`, konkret:

1. **Konsolidierte Liste bauen**: aus `DAYS.filter(d => state.selected[d])` alle Zutaten sammeln, pro `ing.key` aggregieren (`grams` mit `state.portions[day]` multiplizieren und summieren). Referenz: `buildConsolidatedList()` in `/tmp/mahlzeit-main.html` (existiert nach `git show main:www/index.html > /tmp/mahlzeit-main.html`).

2. **Nach Kategorien gruppieren**: `ing.cat` kann `frisch`, `trocken`, `oel`, `gewuerze`, `sonstig` sein. Deutsche Labels (siehe alte App):
   - `frisch` → "Frische"
   - `trocken` → "Trocken"
   - `oel` → "Öl / Fett"
   - `gewuerze` → "Gewürze"
   - `sonstig` → "Sonstiges"

3. **Einheiten-aware Anzeige**: `formatGrams` reicht nicht. Neue Funktion `formatQuantity(item)` in `src/util/format.js` — Cases (siehe `displayQty()` in `/tmp/mahlzeit-main.html`):
   - `unit === 'vorrat'` → "Vorrat prüfen" (keine Menge)
   - `unit === 'g'` → `Math.ceil(sum/10)*10 + " g"` + optionale Note
   - `unit === 'stueck'` → `Math.max(1, Math.ceil(sum/size)) + " Stück"` + optionale Note
   - `unit === 'bund'` → `Math.max(1, Math.ceil(sum/size)) + " Bund"`
   - `unit === 'zehe'` → `Math.max(1, Math.ceil(sum/size)) + " Zehe(n)"`
   - `unit === 'ei'` → `Math.max(1, Math.round(sum/size)) + " Stück"`

4. **Check-Interaktion pro Zutat**: Klick auf eine Zutat toggelt `state.checkedShopping` (bereits als `Set` in `state.js` vorhanden, wird bisher nicht befüllt). Abgehakte Zutaten visuell durchgestrichen / grau / mit Check-Icon. Reihenfolge unverändert (checked bleibt an gleicher Position, nicht ans Ende sortieren).

5. **Progress-Bar** oben: "X von Y erledigt" plus visueller Progress-Track. Reset-Button (alle abhaken zurücksetzen) optional.

6. **Screen-Wechsel**: Session 5 hat noch kein Bottom-Nav (kommt Session 6). Provisorischer Umschalter — Empfehlung: ein Icon-Button in der `app-header__actions`, der einen Shopping-Screen als eigenes Root anzeigt und `main#app` versteckt (oder umgekehrt). Sheet-Component ist NICHT die richtige Antwort — die Einkaufsliste ist ein voller Screen, kein Modal.

**Modul-Vorschlag** (analog zu Session 4):

```
src/
  shopping-list/
    render.js         ← renderShoppingList(root), Konsolidierung + Rendering
    categories.js     ← Category-Labels, Gruppierungs-Helfer
    progress.js       ← "X von Y erledigt" + Progress-Track
    check.js          ← toggleChecked(key), State-Mutation
  util/
    format.js         ← formatQuantity(item) hinzufügen (neben formatGrams)
styles/
  components/
    shopping-list.css ← NEU
```

## Referenz-Semantik in `main`

Für Format-Details und Kategorie-Rendering:

```bash
git show main:www/index.html > /tmp/mahlzeit-main.html
grep -n "buildConsolidatedList\|displayQty\|renderShopping\|categoryOrder\|CATEGORIES\|toggleChecked\|checkedShopping\|shopping-item" /tmp/mahlzeit-main.html | head -30
```

Insbesondere:
- **Konsolidierung**: `buildConsolidatedList()` (Zeile ~941 in main) — aggregiert `grams`, hält `size`/`unit`/`note` bei
- **Rendering**: sucht nach `renderShopping` — zeigt Category-Header, Zeilen mit Check-Circle + Label + Menge
- **Progress**: sucht nach `#shop-progress` / `Progress`

## Constraints (aus Design-Doc / CLAUDE.md, hier zur Erinnerung)

- **Kein Framework** ohne Rückfrage
- **Vanilla JS + ES Modules**, kein TypeScript, keine Tests
- **Deutsche UI-Strings**
- **Touch-Targets ≥ 48 px** — Check-Circle beachten
- **Persistenz erst Session 6** — `checkedShopping` bleibt In-Memory
- **`refresh()` in `main.js`** rendert bisher nur Header + Dashboard. Wenn Shopping-Screen dazukommt, entweder in `refresh()` mit-orchestrieren (via View-Toggle) oder eigenes Screen-Rendering-Modul, das bei Umschalten separat rendert.

## Bekannte Environment-Constraints

- **Subagent-Worktree-Dispatch schlägt fehl:** Der Sandbox verweigert `Agent`-Aufrufe. Sessions 1–4 wurden in Direktausführung in der Haupt-Session gefahren — genauso weitermachen.
- **`curl` im Bash-Sandbox braucht absoluten Pfad** (`/usr/bin/curl`) innerhalb von for-Loops / Command-Substitutions. `which curl` funktioniert normal.

## Empfohlener Skill-Flow

1. `writing-plans` invoken, Session-5-Plan schreiben (analog zu Session-4-Plan, ablegen unter `docs/redesign/2026-07-25-session-5-plan.md`)
2. Plan vom User approven lassen — insbesondere Design-Fragen zum **Shopping-Screen-Toggle** (Header-Icon-Button? Sheet? Volltausch von `<main>`?) und zur **Check-Interaktion** (durchgestrichen bleiben-oder-ausblenden, Reset-Button ja/nein).
3. `executing-plans` direkt in Haupt-Session. Nach jeder größeren Interaktion (Screen-Toggle, Check-Interaktion, Kategorie-Rendering) HTTP-Smoke-Test + visueller Checkpoint mit User (Screenshot).

## Nach-Session-4-Feinschliff (kleine UI-Iterationen mit dem User)

Diese Änderungen kamen nach dem ursprünglichen Session-4-Abschluss durch visuellen Test und User-Feedback dazu:

- **Portion-Pille im Sheet-Header wurde entfernt.** Ursprünglicher Plan hatte den Stepper im `sheet-header__actions` neben dem Close-Button. Der Titel wurde dadurch mit `text-overflow: ellipsis` abgeschnitten bei längeren Namen.
- **Portion-Pille sitzt jetzt floating unten rechts im Sheet** (`.sheet-portion-row` + `.stepper--floating`-Modifier). Absolute-positioniert, `bottom: 16px + safe-area-inset-bottom`, `right: 16px`, `z-index: 3`, mit Elevation-Shadow und 1 px Outline, damit sie klar über den Zutaten/Rezept-Zeilen schwebt.
- **`.sheet-tabs__panel` hat `padding-bottom: 72px + safe-area`** damit letzte Zutaten/Schritte nicht unter der floating Pille verschwinden. Sheet mit vielen Zutaten scrollt sauber durch, Pille bleibt visuell verankert.
- **`.sheet-portion-row` hat `pointer-events: none`, der Stepper darin `pointer-events: auto`** — damit Klicks auf den transparenten Bereich um die Pille herum den darunterliegenden Content erreichen (nur die Pille selbst nimmt Klicks).
- **Card-Layout bleibt unverändert** aus Session 3 (Portion-Pille floated rechts oben im Body). Der User hat einen Versuch, die Card-Pille auch nach unten zu verschieben, verworfen — die Card-Struktur bleibt wie in Session 3 beschrieben.

## Bewusste Entscheidungen aus Session 4, die für Session 5 relevant sind

- **`src/util/format.js`** existiert mit `formatGrams(baseGrams, portions)`. Session 5 sollte `formatQuantity(item)` daneben stellen — die Sheet-Ingredients weiterhin `formatGrams` nutzen (Rezept-Kontext = Gramm), die Einkaufsliste ausschließlich `formatQuantity` (Einkaufs-Kontext = Stück/Bund/Zehe/Ei/Gramm mit Aufrundung auf 10 g).
- **`state.checkedShopping`** ist ein `Set<string>` in `state.js` (seit Session 3), bisher leer. Session 5 befüllt und liest.
- **`state.selected[day]`** bestimmt Days-in-Shopping — Card-"Liste"-Button ist die Auswahl-Quelle, bleibt Card-Aktion.
- **Sheet-Component ist auf Detail-Sheet zugeschnitten** (Zutaten/Rezept-Tabs, Portion-Stepper). Die Einkaufsliste sollte NICHT im selben Sheet-Modul leben — eigener Screen, eigenes Modul.
- **`refresh()` in `main.js`** rendert Header + Dashboard. Wenn Session 5 einen Shopping-Screen ergänzt, kann `refresh()` erweitert werden um View-State (`state.view: 'dashboard' | 'shopping'`) und rendert je nach View unterschiedlich. Sheet bleibt außerhalb wie bisher.
- **`dishesById.get(dishId)`** liefert `dish.ingredients` mit vollen Feldern (`key, label, grams, kcal, p, kh, f, cat, unit, size, note`) — Session 5 braucht `cat, unit, size, note` zusätzlich zu `key, label, grams`.
- **`ingredientMeta`** wird aus `src/data/dishes.js` exportiert — enthält pro `key` `[label, cat, unit, size, note]`. Aktuell nicht genutzt; für Session 5 evtl. relevant wenn Note-Konsolidierung über mehrere Dishes hinweg gebraucht wird.

## Erster empfohlener Move

```bash
git status                                # sicherstellen: on redesign, clean
git log --oneline main..redesign          # ~31 commits inspizieren
git show main:www/index.html > /tmp/mahlzeit-main.html
grep -n "buildConsolidatedList\|displayQty\|renderShopping\|categoryOrder\|CATEGORIES\|toggleChecked\|shopping-item\|shop-progress" /tmp/mahlzeit-main.html | head -40
```

Dann `writing-plans` invoken und dem User erklären dass du in Session 5 einsteigst. Kurze Vorab-Klärung: **Screen-Toggle-Design** (Icon im Header vs. Sheet vs. Volltausch), **Check-Interaktion** (durchgestrichen bleiben oder verschwinden), **Progress-Bar-Position** (fixiert oben oder scrollt mit).
