# Handoff — Mahlzeit-App Rebuild, Session 2

## Kontext in einem Satz

Du übernimmst einen laufenden Rebuild einer Meal-Planner-App (Capacitor + Vanilla JS + Vite). Session 1 (Vite-Setup + eine statische Dashboard-Card) ist abgeschlossen. Jetzt steht Session 2 an: **Dashboard komplett — 7 Tage dynamisch mit echten Dish-Bildern**.

## Wo du dich orientieren solltest — pflichtlektüre

Alles Wichtige ist im Repo, du musst nur die richtigen Files kennen:

1. **`CLAUDE.md`** — projekt-übergreifender Kontext: was ist die App, wer ist der Nutzer, wie kollaboriert er, Landkarte des Codes, die 7 Guardrails. **Wird beim Session-Start automatisch geladen.**
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — vollständige Rebuild-Spec (Ziele, Tech-Stack, Ordner-Struktur, Design-Tokens, 7-Session-Roadmap, Guardrails). Session 2 ist Zeile in der Roadmap-Tabelle: *"Dashboard komplett — 7 Tage dynamisch, echte Dish-Bilder, Layout final"*.
3. **`docs/redesign/2026-07-25-session-1-plan.md`** — Session-1-Plan mit exakter Datei-Struktur die jetzt existiert.

Nicht duplizieren was in diesen Docs steht — lies sie, dann beginne.

## Aktueller Repo-Zustand

- **Branch:** `redesign` (nicht `main`!) — auf GitHub gepusht
- **10 Commits** ontop of main: siehe `git log --oneline main..redesign`
- **Working Tree:** sauber, `www/` ist gelöscht (gitignored — Vite generiert neu)
- **Dev-Server:** läuft NICHT (in Session 1 gestoppt) — start bei Bedarf mit `npm run dev`

## Was in Session 1 gebaut wurde

Zu sparen deiner Zeit: schau nicht die einzelnen Commits an, statt dessen `find . -not -path './node_modules/*' -not -path './android/*' -not -path './.git/*' -type f | sort`. Kurzfassung der neuen Files:

- `src/main.js`, `src/dashboard/render.js`, `src/dashboard/card.js` (~15 LOC Dashboard-Rendering)
- `styles/tokens.css` (Material 3 Design Tokens), `styles/base.css`, `styles/components/card.css`
- `index.html` (Vite-Entry mit favicon), `vite.config.js`
- `public/logo.png`, `public/icons/*.png` (5 Dateien), `public/dishes/dish-*.jpg` (17 Dateien)
- `package.json` mit Vite 8.1.5 als devDependency, `type: "module"`, Scripts `dev`/`build`/`preview`

Aktuell zeigt der Dashboard nur EINE hardcoded Sample-Card ("Wildlachs-Bowl" für Montag).

## Was für Session 2 zu tun ist

Aus dem Session-1-Plan Section "Was ist bewusst NICHT Teil dieser Session" — Session 2 muss:

1. **DATA aus `main`-Branch nach `src/data/dishes.json` extrahieren.**
   Auf `main` liegt die alte `www/index.html` mit `const DATA = {...}` (17 Gerichte mit Name, Cuisine, Cooktime, Makros kcal/p/kh/f, Ingredients-Array, Steps-Array, plus `img` als Base64). Für den Rebuild:
   - `img`-Feld beim Extrahieren droppen (Bilder sind bereits als `public/dishes/dish-{id}.jpg` da, referenziert über die dish-`id`)
   - Rest als JSON serialisieren nach `src/data/dishes.json`
   - Kommando-Skizze: `git show main:www/index.html | python3` mit einem kleinen Extraktions-Script (Regex auf `const DATA = ` bis `;`)

2. **`src/dashboard/render.js` umbauen:** statt hardcoded `SAMPLE_DAY` eine Zuordnung von 7 Tagen zu 7 Dish-IDs (initial zufällig aus den 17 Dishes gezogen ohne Wiederholung), pro Tag Card rendern.

3. **`src/dashboard/card.js`:** kleinere Anpassung — `imageSrc` wird jetzt aus `dish.id` gebaut (`/dishes/dish-${id}.jpg`) statt hardcoded übergeben. Card zeigt die realen Werte (Cuisine, Cooktime aus Data).

4. **State-Grundgerüst in `src/state.js`:** die 5 State-Variablen aus Design-Doc Section 6 anlegen (`assignment`, `selected`, `portions`, `globalPortions`, `checkedShopping`) — aber noch keine Interaktionen (kommt Session 3), nur Init und Export. Persistenz-Anbindung ebenfalls erst Session 6.

## Constraints (aus dem Design-Doc / CLAUDE.md, hier nur zur Erinnerung)

- **Kein Framework** einbauen (Vue/React/etc.) ohne Rückfrage
- **Vanilla JS mit ES Modules**, kein TypeScript, keine Tests
- **Deutsche UI-Strings**
- **Nach Änderungen an HTML/JS/CSS:** kein `npx cap sync` in dieser Session nötig (kein APK-Test in Session 2), aber vor Session 7
- **State-Storage-Key ist für Session 6 als `mahlzeit-state-v2` reserviert** — Session 2 macht noch keine Persistenz

## Bekannte Environment-Constraints

- **Subagent-Dispatch schlägt fehl:** Der Sandbox verweigert `Agent`-Aufrufe mit "Cannot create agent worktree: not in a git repository and no WorktreeCreate hooks are configured". In Session 1 habe ich deshalb auf **Direktausführung** umgeschwenkt — genauso weitermachen, es sei denn du bekommst Worktree-Hooks konfiguriert.
- Der `superpowers:subagent-driven-development` Skill ist daher praktisch **nicht nutzbar** in diesem Setup. Der User weiß das und hat es akzeptiert.

## Zwei sinnvolle Skill-Sequenzen für Session 2

**Option A (empfohlen) — Direkter Weg mit writing-plans:**
1. `writing-plans` invoken, den Session-2-Plan schreiben (Analog zu Session-1-Plan, ablegen unter `docs/redesign/2026-07-25-session-2-plan.md`)
2. Den User Plan approven lassen
3. **Wegen Worktree-Constraint:** `executing-plans` NICHT strikt, sondern direkte Bash/Read/Write/Edit-Ausführung wie in Session 1 (adaptiv, mit User-Interaktion bei visuellen Checkpoints)

**Option B — Falls User schnell vorwärts will ohne separaten Plan:**
1. `test-driven-development` wäre theoretisch der nächste Skill, aber es gibt keine Tests im Projekt (bewusst, siehe Design-Doc Section 8). Also **überspringen**.
2. Direkt in die Implementierung, dabei den Session-1-Plan als Vorlage nehmen für Task-Granularität und Commit-Frequenz.

## Bewusst-Entscheidungen aus Session 1 die für Session 2 relevant sind

- `package.json` wurde in Task 3 auf `type: "module"` und `name: "mahlzeit-app"` umgestellt (vom Legacy-`type: "commonjs"` und `name: "www"`). Falls Session 2 native ESM-Imports macht, ist das schon eingerichtet.
- Vite ist auf Version **8.1.5** installiert (Design-Doc sagte "5+"). Kein Fix nötig, Verhalten identisch.
- Assets liegen in `public/` (nicht `src/assets/`) — Vite kopiert sie beim Build direkt und macht sie unter Root-Pfaden verfügbar (`/dishes/dish-1.jpg`, nicht `/public/dishes/...`).
- `www/` ist gitignored — jeder `npm run build` regeneriert es, kein Commit nötig.

## Erster empfohlener Move

```bash
git status                                # sicherstellen: on redesign, clean
git log --oneline main..redesign          # 10 commits inspizieren
cat docs/redesign/2026-07-25-rebuild-design.md    # spec verinnerlichen
```

Dann `writing-plans` invoken und dem User erklären dass du in Session 2 einsteigst.
