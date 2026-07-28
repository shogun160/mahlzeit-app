# Handoff — Session 27 → 28 (Mahlzeit-App)

## Fokus Session 27: Ziel-orientierter Reroll + Vielfalt-Fixes + Content-Filter-Fix + Zutaten-Katalog

Kompletter Feature-Umbau am Reroll: Woche wird jetzt gegen die kcal- und Makro-Sollwerte optimiert, mit Toleranz-Random und History-Memory für Vielfalt, plus Wildcard-Einstreu jede Woche, plus Protein-Nachbarschafts-Constraint (zyklisch). Content-Filter wurden von OR- auf AND-Exclude-Semantik umgestellt (harte Diät-Ausschlüsse). Zutaten-Katalog als auto-generierte Übersicht dazu.

**APKs unter `releases/` (gitignored):**
- `mahlzeit-1.5.0-stable.apk` — main, versionCode 21
- `mahlzeit-1.5.1-beta.apk` — beta, versionCode 22 (mit Dämpfung + Picker-Fix)

## Branch-State beim Session-Ende

- **main** = `d7e8599` — 1.5.0-Stable + Katalog + CONTRIBUTING-Update
- **beta** = `a633eb5` — main + 4 unmerged Fixes obendrauf (Dämpfung, Picker-Fix, 1.5.1, gitignore)
- Beta ist 5 Commits ahead of main.

## Was passierte

### 1. Ziel-orientierter Reroll (Kern-Feature)

**Design:** [`docs/redesign/2026-07-28-ziel-reroll-design.md`](../2026-07-28-ziel-reroll-design.md), Plan: [`docs/redesign/2026-07-28-ziel-reroll-plan.md`](../2026-07-28-ziel-reroll-plan.md)

- **Neue Datei `src/dashboard/optimizer.js`:** `weekFitness`, `dayScopeFitness`, `optimizeAssignment` (Greedy-Swap mit `SWAP_TOLERANCE = 0.15` Random-Auswahl).
- **`weekFitness`**: Summe quadrierter, normalisierter Deltas über kcal + P + KH + F, plus Nachbarschafts-Penalty (siehe unten).
- **`dayScopeFitness`**: Fitness gegen `dayCount × Ziel` — für rerollDay-Boost mit dem Scope aus selected-Tagen + Reroll-Tag.
- **`optimizeAssignment`**: Greedy-Swap-Loop mit Toleranz-Random. Optionaler `lockedDays`-Parameter für Wildcard-Einstreu.
- **`rerollAll`** in `src/dashboard/reroll.js`: Random-Start → Optimizer → Wildcard-Einstreu → Optimizer nochmal mit gelockter Wildcard.
- **`refillBag`** für `rerollDay`: Bag-Weighting kombiniert `cuisineWeight × exp(-fitness/TAU)`, wobei fitness gegen den Scope „selected + Reroll-Tag" berechnet wird. TAU = 0.02 als Modul-Konstante.

### 2. Vielfalt-Fixes (mehrfach nachjustiert)

- **`previousIds`-Filter im Optimizer-Pool**: aktuelle Woche wird nicht mehr als Kandidat für Swaps aufgenommen (sonst tauscht der Optimizer sie wieder rein).
- **`state.rerollHistory`** (neuer State-Slot, in `mahlzeit-state-v2` persistiert): Array der letzten 6 Assignments. Die ersten 2 fließen als `previousIds` in den Filter, alle 6 dienen dem Wildcard-Recency-Check.
- **Wildcard-Einstreu**: nach dem ersten Optimizer-Lauf wird 1 Rezept eingestreut, das in den letzten 6 Wochen nie dran war. Optimizer-Zweitlauf mit `lockedDays` = Wildcard-Slot normalisiert die anderen 6.
- **`SWAP_TOLERANCE = 0.15`** (5 % → 15 %) — Toleranz-Random unter Top-Kandidaten.

**Ergebnis nach 10 sequenziellen Rerolls je Preset (Diversity-Script):**
- Ausgewogen @ 2000: 24-29/35 verschiedene, max 4× je Rezept
- Proteinreich @ 2400: 23-31/35, max 4×
- KH-arm @ 1800: 21-28/35, max 4×
- Fettarm @ 2200: 21-28/35, max 4×

### 3. Protein-Nachbarschafts-Constraint

- **Neues Feld `proteinCategory` in `src/data/dishes.json`** für alle 35 Rezepte: `poultry` (10), `beef` (5), `pork` (1), `fish` (8), `shellfish` (6), `legume` (4), `tofu` (1). Keine `mixed`-Kategorie.
- **`NEIGHBOR_PENALTY = 0.1`** in `weekFitness` — zyklische Woche (So↔Mo als Paar), 7 Paare max, max +0.7 Score-Delta.
- **`refillBag`** boostet Kandidaten die weder mit Vortag noch mit Nachtag kollidieren.
- **Sanity**: 0 Konflikte über alle 40 simulierten Wochen (10 × 4 Presets).

### 4. Diät-Prefs als HARTER Ausschluss (Bug-Fix Live-Test)

**Alter Bug:** OR-Semantik in `matchesPreferences` — Rezept mit `contains-meat` + `contains-fish` matcht über meat=true, ignoriert fish=false → Fisch-Rezepte kamen trotz Ausschluss durch.

**Fix in `src/dashboard/reroll.js`:**
- `matchesPreferences`: Wenn min. eine Diät-Pref aktiv, gelten die INAKTIVEN als harte Ausschlüsse. Analoge Fix in `src/sheet/picker-body.js` (Picker-Filter).
- `eligibleDishIds` fällt NIE mehr auf `allDishIds` zurück — Diät-Filter bleibt hart, auch bei knappem Pool (Duplikate erlaubt, aber kein Fisch wenn ausgeschlossen).

**Content-Fix**: `#20 Rinderfilet Toskana` und `#22 Hähnchen-Power-Bowl` hatten `contains-fish` wegen Sardellen — Tag entfernt (Sardellen = Umami, keine Fisch-Portion).

### 5. UI-Fixes aus Live-Test

- **Bedarfs-Pille**: `isProfileComplete` prüft nicht mehr `breakfastKcal`/`lunchKcal` als Pflicht — die sind seit Session 26 optional (35 %-Regel). Vorher zeigte die Pille „Einrichtung starten" auch nach Wizzard-Fertig.
- **Dashboard-Scroll-Top nach `rerollAll`**: scrollt auf `#view-dashboard` (nicht `window`, weil body/main `overflow: hidden`).
- **Bedarfs-Pille zeigt IMMER Wochen-Ø** aller 7 Tage — egal ob selected. „Ø Woche" statt „Ø N/7".

### 6. Multi-Person Skalierung — Aromageber-Dämpfung (nur auf beta, nicht auf main)

- **In `src/nutrition/scale.js`:** neuer Helper `shouldDampPortions(ing)` — bei `unit === 'bund'` oder `displayUnit === 'el'/'tl'` wird die Personen-Skalierung mit `sqrt` gedämpft.
- **Formel:** `damping = shouldDamp && portions > 1 ? sqrt(portions) / portions : 1`; multiplier wird als `totalFactor × damping` an `scaledGrams` gegeben. Bei 1 Person keine Änderung.
- **Wirkung Test-Rezept Falafel-Bowl**: Öl 1→8 Pers: 13g → 37g (statt linear 105g); Petersilie: 15g → 53g (statt 120g).
- **Betroffene Zutaten**: 32 Stück (fruehlingszwiebel, petersilie mit unit=bund + 30 mit displayUnit=el/tl). Ohne Content-Änderung — Trigger allein aus der Einheit.

### 7. Zutaten-Katalog

- **`docs/zutaten-katalog.md`** — auto-generiert aus `ingredients.json` (134 Zutaten, 7 Kategorien, Werte pro 100g).
- **`scripts/zutaten-katalog.js`** — regeneriert bei jeder Änderung an ingredients.json.
- **CLAUDE.md Guardrail 8** erweitert: Katalog als erste Anlaufstelle vor neuer Zutat.
- **CONTRIBUTING.md Schritt 4** erweitert: Katalog-Lookup im PR-Workflow.

## Sanity-Script

`scripts/reroll-sanity.js` — 100 Simulationen je Profil, Vorher/Nachher-Delta bei kcal + Makros.

Nach allen Fixes:
- Ausgewogen: kcal +50%, P/KH/F +94-97%
- Proteinreich: kcal +64%, P/KH/F +94-97%
- KH-arm: kcal -128% (Optimizer opfert kcal für Makro-Fit — Delta ~26 kcal/Tag im ±125-Fenster), P/KH/F +73-91%
- Fettarm: kcal +93%, P/KH/F +80-99%

## Diversity-Script

`scripts/reroll-diversity.js` — 10 sequenzielle Rerolls je Profil, Rezept-Häufigkeit + Wochen-Abweichungs-Stats + Nachbarschafts-Konflikte.

## Offen für Session 28

### Test-Bedarf für 1.5.1-Beta-APK

- **Dämpfung Live**: bei Multi-Person-Kochen (Portions > 1) prüfen ob Kräuter/Öle sinnvoll runter skalieren. Erwartung: bei 4 Personen ca. 2× Basis-Menge statt 4×.
- **Picker-Filter**: Fisch-Chip inaktiv → keine Fisch-Rezepte im Picker (auch keine mit contains-meat + contains-fish).
- **Wildcard-Einstreu**: nach mehreren Rerolls sollten „vergessene" Rezepte auftauchen.

### Nach Freigabe

- **Beta → Main mergen** (nach expliziter Ansage). Bringt Dämpfung + Picker-Fix in stable.
- Neuer Version-Bump für Stable (1.5.1 wie beta, oder 1.6.0 wenn semantische Zäsur).

### Backlog-Kandidaten aus dieser Session

- **Wildcard-UI-Hinweis** — User sieht nicht warum ein bestimmtes Rezept „off-topic" ist.
- **Optimizer-Lock-In** bei sehr biased Presets (KH-arm) — Delta ~26 kcal/Tag drüber Ziel.
- **`eligibleDishIds` bei Pool < 7** — aktuell Duplikate erlaubt, aber keine User-Warnung.
- **Chili/Aromageber ohne bund/el/tl** — z. B. `chili_frisch` (stück) — soll das auch gedämpft werden? User hat's bewusst nur für Einheiten bund/el/tl umgesetzt.
- **#23 Linsen-Tempeh-Curry** — als `legume` klassifiziert, aber Tempeh auch drin. Bei Interesse: Tempeh-Kategorie oder Mixed einführen.

### Backlog-Prio (aus `docs/redesign/backlog.md`)

- **Rezept-Suche (Text) im Picker** — ab 50+ Rezepten wichtig
- **Rezepte als separate Files + Auto-ID beim Merge** — vermeidet Community-PR-Konflikte
- **Kochmodus mit Wake-Lock** + **Timer im Rezept**
- **Einkaufsliste: Mengen manuell anpassen** + **Custom-Produkte**

## Skill-Empfehlungen für Session 28

- Bei UI-Feature-Arbeit: `superpowers:brainstorming` vor der Umsetzung.
- Bei Bug-Reports aus Live-Test: `superpowers:systematic-debugging`.
- Vor merge beta → main: die 3 Test-Bedarf-Punkte oben durchgehen und Bugs sammeln.

## Version-History Session 27

| Version | versionCode | Was |
|---|---:|---|
| 1.5.0 (stable) | 21 | main — Ziel-Reroll-Core, Katalog, CONTRIBUTING |
| 1.5.1 (beta) | 22 | beta — Kern + Dämpfung + Picker-Fix |
