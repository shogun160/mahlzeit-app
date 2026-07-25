# Session 2 Implementation Plan — Dashboard komplett (7 Tage dynamisch)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Environment note aus Session 1:** Subagent-Worktree-Dispatch ist im Sandbox nicht verfügbar (fehlende Hooks). Bitte in dieser Umgebung direkt in der Haupt-Session ausführen (User weiß das, siehe `docs/redesign/handoffs/session-1-to-2.md`).

**Goal:** Das Dashboard zeigt sieben Tageskarten (Montag–Sonntag). Jeder Tag ist zufällig einem der 17 Dishes zugeordnet, ohne Wiederholung. Die realen Werte (Name, Küche, Kochzeit, Bild) kommen aus einer neu extrahierten `src/data/dishes.json`.

**Architecture:**
- **Datenquelle:** `src/data/dishes.json` — enthält die komplette `DATA`-Struktur aus dem alten `main:www/index.html` (`meta`- + `dishes`-Objekt). Vite kann `.json` direkt importieren, keine extra Config nötig.
- **State-Grundgerüst:** `src/state.js` deklariert die fünf im Design-Doc definierten State-Slots plus die `DAYS`-Konstante. Keine Interaktionen, keine Persistenz — kommt Session 3/6.
- **Dashboard-Modul:** `render.js` würfelt eine erste Zuordnung (Fisher-Yates → erste sieben), initialisiert State und rendert pro Tag eine Card. `card.js` bekommt jetzt das ganze `dish`-Objekt und baut die Bild-URL aus `dish.id`.

**Tech Stack:** Vite 8.1.5 (ESM + JSON-Import), Vanilla JS (ES Modules), CSS Custom Properties. Kein neues Package.

---

## Voraussetzungen

- Working Directory: `/Users/oliverwosnitza/Documents/Mahlzeit-App`
- Branch: `redesign` (`git branch --show-current` → `redesign`)
- Working Tree: sauber
- `node_modules/` vorhanden (Vite installiert)
- **Wichtige Beobachtung aus der Sondierung:** Alle 17 Dishes in `main:www/index.html` haben **kein** `img`-Feld mehr (kein Base64-Blob mehr in DATA). Die Extraktion nach JSON braucht daher kein Feld-Droppen — einfach `JSON.parse` → `JSON.stringify`. Bilder werden weiterhin über die `id` geladen (`/dishes/dish-${id}.jpg`).

## Datei-Struktur nach dieser Session

```
Mahlzeit-App/
├── src/
│   ├── main.js                        ← unverändert
│   ├── state.js                       ← NEU (State-Skeleton + DAYS)
│   ├── data/
│   │   └── dishes.json                ← NEU (extrahiert aus main)
│   └── dashboard/
│       ├── render.js                  ← geändert (7 Tage dynamisch)
│       └── card.js                    ← geändert (imageSrc aus dish.id)
├── styles/                            ← unverändert
├── public/                            ← unverändert
├── index.html                         ← unverändert
├── vite.config.js                     ← unverändert
├── package.json                       ← unverändert
└── docs/redesign/
    ├── 2026-07-25-session-2-plan.md   ← dieses Doc
    └── handoffs/
        └── session-2-to-3.md          ← NEU am Ende (Handoff für Session 3)
```

---

## Task 1: DATA aus `main` nach `src/data/dishes.json` extrahieren

**Warum:** Auf `main` liegt die alte `www/index.html` mit `const DATA = { meta: {...}, dishes: [...] };` als JS-Literal (~30 KB). Für den Rebuild wandeln wir das einmalig in echtes JSON um und legen es als importierbares Modul unter `src/data/`.

**Warum als ein File `dishes.json` mit `meta` + `dishes` (statt zwei Dateien):** Der Design-Doc Section 3 sieht genau eine Datei `src/data/dishes.json` vor. `meta` ist die Zutaten-Lookup-Tabelle (63 Einträge), gebraucht erst ab Session 5 (Einkaufsliste). Wir belassen die Datei-Struktur wie in der Spec — kann später umbenannt werden falls unpassend.

**Warum Fisher-Yates (kommt in Task 4 zum Einsatz):** In-place-Shuffle-Algorithmus. Für unsere 17-Element-Liste völlig ausreichend, `Math.random()` als Quelle reicht (keine Krypto).

**Files:**
- Create: `src/data/dishes.json`

- [ ] **Step 1: Verzeichnis anlegen**

```bash
mkdir -p src/data
```

- [ ] **Step 2: Extraktions-Script inline ausführen**

Das Script liest die HTML aus `main`, extrahiert den `DATA`-Literal-String zwischen `const DATA = ` und `;`, parst ihn als JSON und schreibt pretty-printed (2 Spaces Einrückung) UTF-8 ohne ASCII-Escapes.

```bash
git show main:www/index.html > /tmp/main-index.html
python3 << 'PY'
import re, json
with open("/tmp/main-index.html") as f:
    html = f.read()
m = re.search(r"const DATA = (\{.*?\});", html, re.DOTALL)
if not m:
    raise SystemExit("DATA literal not found")
data = json.loads(m.group(1))
assert set(data.keys()) == {"meta", "dishes"}, f"unexpected keys: {list(data.keys())}"
assert len(data["dishes"]) == 17, f"expected 17 dishes, got {len(data['dishes'])}"
with open("src/data/dishes.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"Wrote src/data/dishes.json: {len(data['dishes'])} dishes, {len(data['meta'])} meta entries")
PY
rm /tmp/main-index.html
```

Expected output: `Wrote src/data/dishes.json: 17 dishes, 63 meta entries`

- [ ] **Step 3: Verify — Datei existiert und ist valides JSON**

```bash
python3 -c "import json; d = json.load(open('src/data/dishes.json')); print(len(d['dishes']), 'dishes,', len(d['meta']), 'meta'); print('first dish id:', d['dishes'][0]['id'], '-', d['dishes'][0]['name'])"
```

Expected: `17 dishes, 63 meta` und `first dish id: 1 - Wildlachs-Bowl`

- [ ] **Step 4: Verify — kein `img`-Feld drin (sicherheitshalber, falls sich DATA doch geändert hat)**

```bash
python3 -c "import json; d = json.load(open('src/data/dishes.json')); print([di for di in d['dishes'] if 'img' in di] or 'no img fields — clean')"
```

Expected: `no img fields — clean`

- [ ] **Step 5: Commit**

```bash
git add src/data/dishes.json
git commit -m "feat(data): extract dishes from main into src/data/dishes.json"
```

---

## Task 2: State-Modul-Skeleton (`src/state.js`)

**Warum:** Vor der ersten Interaktion (Session 3) brauchen wir einen zentralen State-Store, damit Dashboard, Detail-Sheet und Einkaufsliste denselben Assignment-Zustand lesen. Wir legen jetzt die Struktur an, die im Design-Doc Section 6 spezifiziert ist, und exportieren eine `initState`-Funktion, die Defaults für Selected/Portions setzt sobald ein Assignment vorliegt.

**Was noch NICHT reinkommt:**
- `saveState`/`loadState` (localStorage) — Session 6
- Reactive updates / Change-Events — Session 3 nach Bedarf (aktuell reicht direktes Re-Render nach Aktion)

**Files:**
- Create: `src/state.js`

- [ ] **Step 1: `src/state.js` erstellen**

```js
// Zentraler In-Memory-State.
// Persistenz (localStorage-Key "mahlzeit-state-v2") kommt in Session 6.
// Interaktionen (Reroll, Portions, Auswahl, Shopping-Checks) kommen ab Session 3.

export const DAYS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];

// Struktur laut Design-Doc Section 6:
//   assignment       { [day: string]: number }   // Tag → dishId
//   selected         { [day: string]: boolean }  // Tag ausgewählt für Einkaufsliste?
//   portions         { [day: string]: number }   // Portionen pro Tag
//   globalPortions   number                      // Portionen-Regler im Header
//   checkedShopping  Set<string>                 // abgehakte Zutaten-Keys
export const state = {
  assignment: {},
  selected: {},
  portions: {},
  globalPortions: 1,
  checkedShopping: new Set(),
};

// Initialisiert selected/portions passend zu einem frischen Assignment.
// Default: alle Tage ausgewählt, jeweils 1 Portion.
export function initState(assignment) {
  state.assignment = assignment;
  state.selected = {};
  state.portions = {};
  for (const day of DAYS) {
    state.selected[day] = true;
    state.portions[day] = 1;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/state.js
git commit -m "feat(state): add state module skeleton (5 slots + DAYS + initState)"
```

---

## Task 3: `card.js` — Dish-Objekt statt vor-gerechnetem `imageSrc`

**Warum:** Bisher bekam die Card ein flaches `dish`-Objekt mit vor-gerechnetem `imageSrc`. Jetzt bekommt sie das echte Dish-Objekt aus `dishes.json` (mit `id`, `name`, `cuisine`, `cooktime` u.a.) und baut die Bild-URL selbst aus `dish.id`. Das entkoppelt den Renderer von der Datenquelle.

**Files:**
- Modify: `src/dashboard/card.js` (Komplettersatz)

- [ ] **Step 1: `src/dashboard/card.js` ersetzen**

```js
// Rendert eine einzelne Day-Card als <article>-Element.
// Erwartet: { day: string, dish: { id, name, cuisine, cooktime, ... } }
export function createDayCard({ day, dish }) {
  const article = document.createElement('article');
  article.className = 'day-card';
  const imageSrc = `/dishes/dish-${dish.id}.jpg`;
  article.innerHTML = `
    <img class="day-card__image" src="${imageSrc}" alt="${dish.name}" loading="lazy" />
    <div class="day-card__body">
      <div class="day-card__day">${day}</div>
      <h2 class="day-card__title">${dish.name}</h2>
      <div class="day-card__meta">~${dish.cooktime} Min. · ${dish.cuisine}</div>
    </div>
  `;
  return article;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/card.js
git commit -m "refactor(dashboard): card takes dish object, builds image src from id"
```

---

## Task 4: `render.js` — 7 Tage dynamisch mit zufälligem Assignment

**Warum:** Das Dashboard soll nach dem Start sofort einen kompletten Wochenplan zeigen. Beim ersten Render prüfen wir, ob es schon ein Assignment gibt (State leer bei jedem Reload, weil noch keine Persistenz). Falls nicht: sieben unterschiedliche Dish-IDs ziehen (Fisher-Yates auf allen 17 IDs, erste sieben nehmen), State initialisieren, dann pro Tag Card rendern.

**Warum kein "echter" Shuffle-Bag hier:** Die volle Shuffle-Bag-Logik (bereits gezogene IDs merken, bis alle 17 durch sind → dann Bag zurücksetzen) ist für **Reroll** relevant und kommt Session 3. Für Session 2 reicht "sieben Distinct-IDs am Start".

**Files:**
- Modify: `src/dashboard/render.js` (Komplettersatz)

- [ ] **Step 1: `src/dashboard/render.js` ersetzen**

```js
import { createDayCard } from './card.js';
import { state, DAYS, initState } from '../state.js';
import dishesData from '../data/dishes.json';

// Schneller ID → Dish-Lookup
const dishesById = new Map(dishesData.dishes.map((d) => [d.id, d]));

// Fisher-Yates: mischt Array in-place. Wir arbeiten auf einer Kopie.
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickInitialAssignment() {
  const allIds = dishesData.dishes.map((d) => d.id);
  const picks = shuffled(allIds).slice(0, DAYS.length);
  const assignment = {};
  DAYS.forEach((day, i) => {
    assignment[day] = picks[i];
  });
  return assignment;
}

export function renderDashboard(root) {
  // Erst-Initialisierung: falls noch kein Assignment vorliegt, würfeln.
  // (Sobald Persistenz in Session 6 kommt, wird ein geladenes Assignment vorrangig sein.)
  if (Object.keys(state.assignment).length === 0) {
    initState(pickInitialAssignment());
  }

  root.innerHTML = '';
  for (const day of DAYS) {
    const dish = dishesById.get(state.assignment[day]);
    root.appendChild(createDayCard({ day, dish }));
  }
}
```

- [ ] **Step 2: Verify — kein `main.js`-Change nötig**

`src/main.js` importiert schon `renderDashboard` und ruft es mit dem `#app`-Element auf. Kein Edit.

```bash
grep -n "renderDashboard" src/main.js
```

Expected: `1:import { renderDashboard } from './dashboard/render.js';` und `4:renderDashboard(app);`

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/render.js
git commit -m "feat(dashboard): render 7 days with random dish assignment"
```

---

## Task 5: Dev-Server visuell prüfen

**Files:** — (nur Verifikation)

- [ ] **Step 1: Dev-Server starten**

```bash
npm run dev
```

Expected: Vite meldet
```
  VITE v8.1.5  ready in NNN ms
  ➜  Local:   http://localhost:5173/
```

Der Browser öffnet automatisch (wegen `open: true` in `vite.config.js`).

- [ ] **Step 2: Visuelle Prüfung im Browser**

Sichtbar sein muss:

- Sieben Karten untereinander (Montag → Sonntag von oben nach unten)
- Auf jeder Karte:
  - Ein Dish-Bild (180 px hoch, gecropped)
  - Türkisfarbenes Wochentag-Label (uppercase, letter-spacing)
  - Dish-Name als Titel
  - Meta-Zeile `~<cooktime> Min. · <cuisine>` mit realen Werten
- **Keine zwei Karten zeigen dasselbe Gericht.**
- Bei mehrfachem Browser-Reload: das Assignment **ändert sich jedes Mal** (frischer Zufall, weil noch keine Persistenz).

Wenn ein Bild fehlt (grauer Placeholder statt Bild): prüfen ob die `dish.id` in `public/dishes/dish-${id}.jpg` existiert (IDs 1–17 sind alle da).

- [ ] **Step 3: DevTools-Check**

Browser-DevTools öffnen (F12 oder ⌘+Opt+I):

- **Console:** keine roten Errors, insbesondere keine `Failed to fetch` für `dishes.json`.
- **Network:** `dish-1.jpg` … `dish-17.jpg` je nach Zuordnung mit Status 200. `dishes.json` erscheint **nicht** als separater Request — Vite bundelt es beim Dev-Modus als JS-Modul (das ist erwartet, siehe [Vite JSON-Import](https://vitejs.dev/guide/features.html#json)).

- [ ] **Step 4: Dev-Server beenden**

Im Terminal: `Ctrl+C`.

- [ ] **Step 5: User-Checkpoint**

Screenshot vom Browser mit dem User teilen (oder mündliche Bestätigung einholen). Falls Layout- oder Farbwünsche aufkommen, hier klären, **bevor** Task 6.

---

## Task 6: Production-Build testen

**Warum:** Bestätigt, dass die neue JSON-Datei und der neue Dashboard-Code auch im Prod-Bundle korrekt landen (JSON wird von Vite in JS gebundelt, Assets kommen aus `public/`).

- [ ] **Step 1: Build ausführen**

```bash
npm run build
```

Expected:
```
vite v8.1.5 building for production...
✓ NN modules transformed.
www/index.html            X.XX kB
www/assets/index-HASH.css X.XX kB
www/assets/index-HASH.js  X.XX kB  (größer als Session 1 wegen JSON-Bundling)
✓ built in NNNms
```

- [ ] **Step 2: Build-Output verifizieren**

```bash
ls www/ && du -sh www/
```

Expected: `assets/`, `dishes/`, `icons/`, `index.html`, `logo.png` — Gesamtgröße unter 2 MB.

- [ ] **Step 3: Preview testen**

```bash
npm run preview
```

Expected: Preview-Server auf `http://localhost:4173`. Im Browser dieselben sieben Karten wie im Dev-Modus. Danach `Ctrl+C`.

- [ ] **Step 4: `www/` löschen (Cleanup, gitignored)**

```bash
rm -rf www/
```

---

## Task 7: Handoff für Session 3 schreiben und pushen

**Files:**
- Create: `docs/redesign/handoffs/session-2-to-3.md`

- [ ] **Step 1: Handoff-Doc anlegen**

Analog zu `session-1-to-2.md` strukturiert. Inhalt sollte umfassen:

- Kontext-Satz: was Session 2 gebaut hat (7 Tage dynamisch, State-Skeleton, dishes.json extrahiert)
- Pflichtlektüre: `CLAUDE.md`, `docs/redesign/2026-07-25-rebuild-design.md`, dieser Session-2-Plan
- Aktueller Repo-Zustand (Branch, Commit-Count seit main, working tree sauber)
- Was Session 3 tun muss (aus Roadmap Session 3 = "Interaktionen"):
  - Reroll pro Karte (Shuffle-Bag-Logik: bereits gezogene IDs merken bis alle 17 durch, dann Bag reset)
  - "Reroll all" (Header-Button)
  - Portion-Stepper pro Tag (Card-lokale +/− Buttons)
  - Global-Portions (Header-Regler, überschreibt alle Tage bei Change)
  - Auswahl pro Tag für Einkaufsliste (Checkbox/Toggle auf der Card)
- Constraints (aus Design-Doc + CLAUDE.md, kurz wiederholt)
- Environment-Constraint (kein Subagent-Worktree-Dispatch, direkt in Session ausführen)
- Empfohlener Skill-Flow für Session 3 (writing-plans → direkte Ausführung wie in Session 1 & 2)
- Bewusste Entscheidungen aus Session 2, die für Session 3 relevant sind:
  - `state.js` exportiert bereits `selected`, `portions`, `globalPortions` — Session 3 verdrahtet nur noch Interaktion + Re-Render
  - Zufalls-Assignment beim ersten Render — Reroll-Logik muss darauf aufbauen (nicht "einmal ziehen, dann Random neu")
  - `dishesData.dishes` ist die Quelle für Reroll — Shuffle-Bag darauf implementieren

- [ ] **Step 2: Commit**

```bash
git add docs/redesign/handoffs/session-2-to-3.md
git commit -m "docs(handoff): session 2 -> 3 handoff for fresh claude session"
```

- [ ] **Step 3: Working Tree sauber?**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

- [ ] **Step 4: Push auf `origin/redesign`**

```bash
git push
```

Expected: Push erfolgreich (`redesign` trackt schon `origin/redesign`, kein `-u` nötig).

- [ ] **Step 5: Commit-Log der Session ansehen**

```bash
git log --oneline main..redesign
```

Expected: fünf neue Commits ontop von Session 1:
- `docs(handoff): session 2 -> 3 handoff for fresh claude session`
- `feat(dashboard): render 7 days with random dish assignment`
- `refactor(dashboard): card takes dish object, builds image src from id`
- `feat(state): add state module skeleton (5 slots + DAYS + initState)`
- `feat(data): extract dishes from main into src/data/dishes.json`

---

## Definition of Done

- ✅ `src/data/dishes.json` existiert, enthält 17 Dishes + 63 Meta-Einträge, valides JSON
- ✅ `src/state.js` exportiert `state`, `DAYS`, `initState`
- ✅ `src/dashboard/card.js` akzeptiert `dish`-Objekt, baut `imageSrc` aus `dish.id`
- ✅ `src/dashboard/render.js` rendert sieben Cards mit distinkten zufälligen Dishes
- ✅ Browser zeigt sieben Karten Mo–So mit realen Werten und Bildern
- ✅ Reload wechselt das Assignment (Zufall, noch keine Persistenz)
- ✅ `npm run build` läuft ohne Errors
- ✅ Handoff-Doc `docs/redesign/handoffs/session-2-to-3.md` erstellt
- ✅ Alles auf `origin/redesign` gepusht

## Was ist bewusst NICHT Teil dieser Session

- Reroll pro Karte + "Reroll all" → Session 3
- Portion-Stepper (lokal + global) → Session 3
- Auswahl-Toggle pro Card für Einkaufsliste → Session 3
- Header-UI mit Global-Portions und Reroll-All-Button → Session 3
- Detail-Sheet (Zutaten + Rezept) → Session 4
- Einkaufsliste (Kategorien-Rendering, Check-Interaktion) → Session 5
- Persistenz (localStorage `mahlzeit-state-v2`) → Session 6
- APK-Build, `npx cap sync`, Merge nach `main` → Session 7
