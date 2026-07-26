# Session 9 Implementation Plan — Iteration 3: Küchen-Präferenzen (Weighted Reroll)

> **Environment note aus Sessions 1-8:** Subagent-Worktree-Dispatch ist im Sandbox nicht verfügbar. Direktausführung in der Haupt-Session, siehe `docs/redesign/handoffs/session-8-to-9.md`.

**Goal:** Der User kann im Settings-Sheet eine oder mehrere Küchen-Regionen als Präferenz markieren. Beim Reroll bekommen Gerichte aus diesen Regionen ein höheres Gewicht im Auslos-Pool (Faktor 3×). Kein Hard-Filter — bevorzugte Küchen tauchen häufiger auf, andere Küchen bleiben möglich (verhindert leere Pools bei kleinen Buckets). Für die Konsistenz mit Iteration 2 (Diät-Präferenzen) hat die neue Section identische UI-Sprache: Chips mit positiver OR-Semantik.

**Architecture:**

- **Datenmodell:** Jedes Gericht in `src/data/dishes.json` bekommt ein neues Feld `cuisineGroup: "asian" | "mediterranean" | "middleEast" | "americas"`. Feld `cuisine` bleibt unverändert (wird auf Card/Detail-Sheet weiter angezeigt). `cuisineGroup` ist ausschließlich fürs Präferenz-Filtering und wird beim Enrichment in `src/data/dishes.js` mit durchgereicht.
- **State:** Neuer Slot `state.settings.cuisines: { asian: bool, mediterranean: bool, middleEast: bool, americas: bool }`. Alle Defaults `false` (= neutral, kein Bias). `loadState()` mergt fehlende Keys mit `?? false`, damit Alt-Sessions ohne `cuisines`-Feld nicht crashen.
- **Reroll-Gewichtung:** Neue Funktion `weightedShuffle(ids, weightFn)` in `src/data/dishes.js` (bewusst dort, weil das existierende `shuffled()` auch dort lebt). Fisher-Yates-Variante mit gewichteter Zufalls-Selektion: statt gleicher Wahrscheinlichkeit pro Kandidat wird nach `weight`-Summe gewichtet gezogen. `reroll.js` ruft `weightedShuffle(pool, id => cuisinePreferenceWeight(id))` statt `shuffled(pool)` an zwei Stellen (`refillBag`, `rerollAll`). `cuisinePreferenceWeight` gibt 3 zurück, wenn `dish.cuisineGroup` einer aktiven Präferenz entspricht, sonst 1. Wenn keine Präferenz aktiv ist, gibt sie für alle 1 zurück → Verhalten identisch zu `shuffled()`.
- **Filter-Compat:** `eligibleDishIds()` bleibt komplett unangetastet. Cuisine ist orthogonal zum Diät-Filter — kein Hard-Filter, nur Gewichtung im nachgelagerten Shuffle.
- **Settings-UI:** `src/settings/render.js` — Section `kuechen` verliert den "Kommt bald"-Placeholder und die `settings-section--soon`-Klasse. Bekommt 4 Chips mit identischem Muster wie `praeferenzen` (klickbar, `aria-pressed`, togglet State + ruft `onExternalChange`).
- **Kein Picker-Filter** in dieser Iteration. Der Picker ist bewusst manueller Override — wenn der User bewusst umwählt, sind Empfehlungen weniger relevant. Nachrüstbar in einer späteren Iteration (dann als 3. Filter-Zeile analog "Diät" / "Attribute").

**Tech Stack:** unverändert. Vite 8.1.5, Vanilla JS (ES Modules), CSS Custom Properties. Keine neuen Packages.

---

## Design-Entscheidungen (mit reasonable defaults getroffen, im "keine Rückfragen"-Modus)

| Frage | Entscheidung | Begründung |
|---|---|---|
| Wie viele Küchen-Gruppen? | **4 Gruppen** (Asiatisch, Mediterran, Nahost, Amerika) | Balance zwischen Granularität und Nutzen. 28 Cuisine-Strings auf 4 Buckets abbilden ist überschaubar; mehr Buckets würden Chip-Reihe sprengen. |
| Bucket-Zuordnung | Asiatisch (16), Mediterran (11), Nahost (3), Amerika (2) — Summe 32 | Deckt alle 32 aktuellen Gerichte ab. Levantinisch → Nahost, Marokkanisch → Nahost (Nordafrika kulturell nah), Deutsch-Balkan → Mediterran (nächste Nachbarschaft), Skandinavisch → Mediterran (europäisch, kein eigener Bucket sinnvoll bei 1 Rezept). |
| Semantik | **Weighted, kein Hard-Filter** | Amerika hat nur 2 Rezepte — Hard-Filter würde 7-Tage-Plan sprengen. Weighted skaliert graceful und lässt Vielfalt zu. |
| Gewichtungsfaktor | **3×** | 2× ist zu weich (kaum spürbar), 5× killt Vielfalt. 3× ist spürbare Bevorzugung ohne Monotonie. |
| Feld-Namen (Bucket-Keys) | `asian`, `mediterranean`, `middleEast`, `americas` (englisch, camelCase) | Konsistent mit bestehenden preferences-Keys (`meat`, `fish`, `vegetarian`). UI-Labels bleiben deutsch. |
| `cuisine` vs `cuisineGroup` | Beide behalten | `cuisine` bleibt sichtbar (Card/Detail zeigen weiter "Nordindisch mild"), `cuisineGroup` ist internes Filter-Feld. Trennung der Zuständigkeiten. |
| Picker-Filter für Küche? | **Nicht in dieser Iteration** | Picker hat schon 2 Filter-Zeilen. Wenn User bewusst umwählt, ist Präferenz-Empfehlung nicht mehr relevant. Kann später als 3. Zeile ergänzt werden. |
| UI-Position | Section `kuechen` im Settings-Sheet (aktuell Placeholder) | Handoff-Vorgabe. Zwischen `praeferenzen` und `profil` bereits vorgesehen. |
| Storage-Migration | Nur Default-Merge in `loadState()` | Keine Nutzer außer Solo-Entwickler. Alt-State ohne `cuisines`-Feld bekommt Defaults, Storage-Key bleibt `mahlzeit-state-v2`. |
| Reroll bei Präferenz-Wechsel | **Nein** | Setting-Chip togglet nur den State — nächster Reroll nutzt die neue Gewichtung. Kein automatisches Neu-Auslosen der Woche (wäre destruktiv). Konsistent mit Verhalten der Diät-Chips. |

---

## Voraussetzungen

- Working Directory: `/Users/oliverwosnitza/Documents/Mahlzeit-App`
- Branch: `redesign` (`git branch --show-current` → `redesign`)
- Working Tree: sauber
- Session 8 abgeschlossen (Commits bis `5ecebdd`)

## Datei-Struktur nach dieser Session

```
Mahlzeit-App/
├── src/
│   ├── state.js                             ← geändert (settings.cuisines + loadState-Merge)
│   ├── data/
│   │   ├── dishes.json                      ← geändert (cuisineGroup pro Gericht)
│   │   └── dishes.js                        ← geändert (weightedShuffle export + cuisineGroup durchreichen)
│   ├── dashboard/
│   │   └── reroll.js                        ← geändert (weightedShuffle statt shuffled, cuisinePreferenceWeight)
│   └── settings/
│       └── render.js                        ← geändert (Kuechen-Section aktiviert, 4 Chips + Handler)
└── docs/redesign/
    └── 2026-07-26-session-9-plan.md         ← DIESES DOKUMENT
```

Keine neuen Dateien, keine neuen CSS-Regeln (Chips reusen `.pref-chip` bzw. bekommen einen zweiten `settings-prefs`-Container).

## Schritte

### 1. Plan-Dokument (DIESES) — DONE beim Schreiben

### 2. Cuisine-Gruppen-Mapping in dishes.json
- Jedes der 32 Gerichte bekommt `cuisineGroup`. Vollständige Zuordnung:
  - **`asian`** (16): "Asiatisch-Fusion", "Indisch", "Indisch-vegetarisch" (×2), "Koreanisch", "Asiatisch-French", "Thailändisch", "Japanisch", "Nordindisch", "Südindisch", "Asiatisch (Bowl)", "Asiatisch-vegetarisch", "Chinesisch", "Nordindisch mild", "Asiatisch (Tataki)", "Indonesisch"
  - **`mediterranean`** (11): "Griechisch" (×2), "Mediterran" (×2), "Italienisch-mediterran", "Sizilianisch", "Spanisch", "Skandinavisch", "Deutsch-Balkan", "Italienisch (Toskana)", "Sizilianisch (Caesar)"
  - **`middleEast`** (3): "Levantinisch" (×2), "Marokkanisch"
  - **`americas`** (2): "Argentinisch", "Mexikanisch"
- Summe: 16 + 11 + 3 + 2 = 32 (deckt alle Gerichte ab). Neue Rezepte in späteren Sessions müssen `cuisineGroup` explizit setzen; im Zweifel `mediterranean` als Default für europäische Cuisines.

### 3. dishes.js — cuisineGroup durchreichen + weightedShuffle exportieren
- In `enrichDish()` (oder wo auch immer die Enrichment-Struktur zusammengebaut wird): `cuisineGroup` mit übernehmen.
- Neue Export-Funktion `weightedShuffle(ids, weightFn)`:
  ```js
  // Gewichteter Fisher-Yates: statt uniform aus dem verbleibenden Suffix zu
  // ziehen, wird ein Kandidat proportional zu seinem Gewicht ausgelost.
  // weightFn(id) muss > 0 sein; 1 = neutral, 3 = bevorzugt.
  export function weightedShuffle(ids, weightFn) {
    const pool = ids.slice();
    const result = [];
    while (pool.length > 0) {
      const weights = pool.map((id) => Math.max(0.0001, weightFn(id)));
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < weights.length; idx++) {
        r -= weights[idx];
        if (r <= 0) break;
      }
      if (idx >= pool.length) idx = pool.length - 1;
      result.push(pool.splice(idx, 1)[0]);
    }
    return result;
  }
  ```

### 4. reroll.js — Weighted Reroll verdrahten
- `import { ..., weightedShuffle } from '../data/dishes.js'`
- Neue lokale Funktion:
  ```js
  function cuisineWeight(id) {
    const dish = dishesById.get(id);
    if (!dish) return 1;
    const prefs = state.settings.cuisines || {};
    const anyActive = Object.values(prefs).some(Boolean);
    if (!anyActive) return 1;
    return prefs[dish.cuisineGroup] ? 3 : 1;
  }
  ```
- `refillBag(day)`: `shuffled(eligibleDishIds())` → `weightedShuffle(eligibleDishIds(), cuisineWeight)`.
- `rerollAll()`: gleiche Ersetzung an beiden `shuffled(pool)`-Stellen.
- **Wichtig:** `shuffled` bleibt weiter importiert und genutzt für den Fallback-Path (`shuffled(pool)` wenn `< DAYS.length` Kandidaten übrig sind). Der Fallback ist ohnehin ein Notfall-Pfad; Gewichtung dort ist irrelevant.

### 5. state.js — settings.cuisines + loadState-Merge
- Default-State erweitern:
  ```js
  cuisines: {
    asian: false,
    mediterranean: false,
    middleEast: false,
    americas: false,
  },
  ```
- In `loadState()` innerhalb des `state.settings = { ... }`-Merge-Blocks:
  ```js
  cuisines: {
    asian: loadedSettings.cuisines?.asian ?? false,
    mediterranean: loadedSettings.cuisines?.mediterranean ?? false,
    middleEast: loadedSettings.cuisines?.middleEast ?? false,
    americas: loadedSettings.cuisines?.americas ?? false,
  },
  ```

### 6. settings/render.js — Kuechen-Section aktivieren
- Section `kuechen`: Placeholder-`<p>` und `settings-section--soon` entfernen, ersetzen durch:
  ```html
  <div class="settings-prefs" role="group" aria-label="Küchen-Präferenzen">
    ${renderCuisineChip('asian',         'Asiatisch')}
    ${renderCuisineChip('mediterranean', 'Mediterran')}
    ${renderCuisineChip('middleEast',    'Nahost')}
    ${renderCuisineChip('americas',      'Amerika')}
  </div>
  ```
- Neuer Helper `renderCuisineChip(key, label)` analog zu `renderPrefChip` — liest `state.settings.cuisines?.[key]`, setzt `data-cuisine="${key}"`.
- In `attachHandlers()` neuer Block analog zu den `.pref-chip[data-pref]`-Handlern:
  ```js
  rootEl.querySelectorAll('.pref-chip[data-cuisine]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.cuisine;
      const next = !state.settings.cuisines[key];
      state.settings.cuisines[key] = next;
      btn.setAttribute('aria-pressed', String(next));
      onExternalChange();
    });
  });
  ```

### 7. End-to-End Test im Browser
- `npm run dev`, Port 5173 öffnen, DevTools Mobile Mode.
- Test-Matrix:
  - **Settings-Sheet öffnen** → Section "Küchen-Präferenzen" zeigt 4 Chips, alle inaktiv.
  - **Chip togglen** → visuelle State-Änderung (aria-pressed), Sheet bleibt offen.
  - **Reroll ohne Präferenz** → Verhalten identisch zu Session 8 (Diät-Filter wirkt weiter).
  - **Nur "Asiatisch" aktiv, mehrfach rerollAll** → deutliche Überrepräsentation asiatischer Gerichte, aber nicht 100 % (statistische Bevorzugung, keine harte Filterung).
  - **Nur "Amerika" (2 Rezepte)** → keine Crash, kein leerer Plan; die 2 amerikanischen Gerichte tauchen häufiger auf, Rest wird aufgefüllt.
  - **Mehrere Präferenzen kombiniert** ("Asiatisch" + "Mediterran") → beide Buckets überrepräsentiert, gemeinsam ~90 % des Plans.
  - **Persistenz** → Chips setzen, App refreshen, State bleibt (localStorage-Persistenz kickt via `onExternalChange → refresh → saveState`).
  - **Regression Diät-Filter** → Vegetarisch + Asiatisch aktiv → Reroll liefert asiatisch-vegetarische Gerichte bevorzugt, andere vegetarische seltener, keine fleischhaltigen.
  - **Card-Anzeige unverändert** → Cuisine-Text auf Card/Detail zeigt weiter granulare Bezeichnung ("Nordindisch mild"), nicht die Gruppe.

---

## Nicht-Ziele für diese Session

- **Picker-Filter für Küche** — bewusst nicht in Session 9. Wenn nachgezogen, dann als 3. Filter-Zeile im Picker mit OR-Semantik (positive Selektion) analog Diät.
- **Automatisches Reroll bei Chip-Klick** — würde geplante Woche zerstören; User rerolled bewusst manuell wenn er die Änderung wirken sehen will.
- **UI für "welche Gerichte gehören zu welcher Gruppe"** — kein Explorer im Settings; die Gruppe steht nur im JSON und implizit als Filter-Semantik.
- **Migration von `cuisine` zu `cuisineGroup`** — `cuisine` bleibt als anzuzeigendes Feld erhalten, keine Umbenennung.
- **Icon oder Emoji auf den Küchen-Chips** — reine Text-Chips wie Diät-Präferenzen, keine Sonderrolle.
