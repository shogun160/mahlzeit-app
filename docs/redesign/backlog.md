# Mahlzeit-App — Ideen-Backlog

Ideen, die nicht direkt in einer Iteration umgesetzt werden, aber nicht verloren gehen sollen. Reihenfolge = grobe Priorität, nicht bindend.

## Ersteinrichtung / Onboarding

**Idee:** Beim ersten App-Start (oder wenn Profil noch nicht ausgefüllt) einen geführten Ablauf zeigen, der den User Schritt-für-Schritt durch die Kern-Setup-Werte führt. Zwei Varianten denkbar:

- **First-Run-Wizard:** modaler Flow mit Steps (Geschlecht → Alter → Größe → Gewicht → Aktivität → Ziel → Fertig). Am Ende ist Profil vollständig, Bedarfs-Pille sichtbar.
- **On-Screen-Anleitung:** dezente Hinweise ("Klicke hier für dein Profil") die auf die Settings-Section zeigen, ohne die App zu blockieren.

**Warum später:** Erst müssen die manuellen Einstellungen alle sauber funktionieren (Iteration 4 abgeschlossen). Onboarding ist Politur, kein Kern-Feature.

## Google Health / Health Connect Sync

**Idee:** Kalorien-Ist und Makros an Google Health Connect (Android) synchronisieren, damit die Werte auch in anderen Health-/Fitness-Apps auftauchen. Optional Rückrichtung: Aktivitätslevel oder verbrannte Kalorien aus Health Connect lesen und im Tagesziel-Adjustment berücksichtigen.

**Warum später:** Braucht Capacitor-Plugin (`@capacitor-community/health` oder custom) plus User-Consent-Flow für Health Connect Permissions. Nur Android — iOS würde eigenes HealthKit-Handling brauchen. Klärung nötig ob Push (App → Health) reicht oder Bidirektional gewünscht ist.

## Favoriten-Gerichte

**Idee:** User markiert Lieblingsgerichte als Favorit (Herz-Icon o. ä.). Auswirkung z. B.:

- Beim Auslosen bevorzugt einbinden (Weighted-Reroll analog Küchen-Präferenzen)
- Eigene Filter-Kategorie "Favoriten" im Dish-Picker
- Optional eine dedizierte "Favoriten"-Ansicht

**State-Skizze:** `state.settings.favorites: Set<number>` (Dish-IDs) oder als Property am Dish selbst.

**Warum später:** Kein Kern-Feature, aber sinnvolle Personalisierung. Wechselwirkung mit dem bestehenden Weighted-Reroll (Küchen-Präferenzen) muss durchdacht werden — Doppelt-Weighting oder Prioritäts-Reihenfolge.

## Kalender-Integration

**Idee:** Wochenplan als Kalender-Einträge oder ICS-Datei exportieren. Zwei Varianten denkbar:

- **Kalender-Datei-Export:** `.ics` mit einem Event pro Tag ("Montag: Chili sin Carne"), Zeit z. B. 18:30. User kann ins eigene Kalender-App importieren
- **Direkter Kalender-Eintrag:** via Capacitor Calendar Plugin oder Web Share API — der User bestätigt einmal, App legt Events in Standard-Kalender an

**Warum später:** Kein Kern-Feature, aber sehr nutzbringend für Meal-Prep-orientierte User. Braucht UX-Klärung (welcher Zeit-Slot, wiederkehrend, Wochen-Bündel oder pro Gericht) und ggf. neues Capacitor-Plugin.

## Einkaufsliste: Mengen manuell anpassen

**Idee:** Zutaten-Mengen direkt in der Einkaufsliste editierbar machen — z. B. wenn der Vorrat zuhause noch reicht (Reis nur halbe Menge kaufen), eine Zutat auf Vorrat kaufen (doppelte Menge) oder Packungsgroessen abbilden (250 g statt 200 g weil so verkauft). Aktuell wird die Menge starr aus Rezept × Portionen berechnet.

**UX-Skizze:** Long-Press oder Edit-Icon an der Zutaten-Zeile öffnet einen Mini-Editor (Number-Input + Einheit). Manueller Override wird gespeichert und visuell markiert (z. B. Kursiv oder kleines Edit-Icon dahinter), damit klar ist: „diese Menge ist nicht mehr die aus dem Rezept berechnete". Reset auf Rezept-Menge per Klick auf's Icon.

**State-Skizze:** `state.shoppingOverrides: { [ingredientKey]: { quantity, unit } }` — pro Ingredient-Key. Bei Neuberechnung der Einkaufsliste (buildConsolidatedList) wird der Override anstelle des Rezept-Werts eingesetzt.

**Warum später:** Braucht saubere UX-Klärung: Was passiert wenn das Gericht rausgeworfen wird — Override löschen oder halten? Was wenn die Portionen sich ändern — Override respektieren oder neu berechnen? Beim Woche-Reset auch löschen?

## Einkaufsliste: Custom Produkte hinzufügen

**Idee:** Zutaten hinzufuegen, die nicht aus einem Rezept kommen — z. B. Klopapier, Milch, Katzenfutter. Die Einkaufsliste wird damit vom reinen Rezept-Abfall zur echten Einkaufsliste.

**UX-Skizze:** „+"-Button unten in der Einkaufsliste (oder pro Kategorie), oeffnet ein kleines Sheet mit Name-Input, optionaler Menge + Einheit, Kategorie-Picker. Custom-Items werden mit einem kleinen Symbol markiert (Home-Icon o. ae.), damit sie sich von Rezept-Items unterscheiden. Beim Woche-Reset: bleiben stehen (sind ja nicht vom Wochenplan abhaengig) — mit Option „Auch Custom loeschen".

**State-Skizze:** `state.customShoppingItems: [{ id, name, quantity, unit, category, checked }]`. Rendering merged mit den Rezept-Items in `buildConsolidatedList` unter derselben Kategorie-Sortierung.

**Warum später:** Erweitert das Datenmodell der Einkaufsliste um eine parallele Source. Wechselwirkung mit den Ingredient-Overrides oben muss geklaert werden — sind das dieselben oder getrennte Konzepte. Ideal in einer eigenen Session zusammen mit der Mengen-Anpassung.

## Multi-Profile

**Idee:** Mehrere Nutzer-Profile hinterlegen (z. B. für Partner:in, Kinder). Beim Planen einer Woche wählt man, wer isst — die Rezept-Skalierung berücksichtigt die individuellen Ziele. Standardfall bleibt Solo (Portion = 1 = User 1).

**Auslöser:** Aus Session 10 (Iteration 4/5 — Profil + Rezept-Skalierung). User bekocht meist allein, aber die Semantik „userScale wirkt auf gesamte Kochmenge" bricht sobald mehrere Personen unterschiedliche Ziele haben.

### Onboarding-Integration

- Im bestehenden Wizard (Step 1 „Personen") wird schon `defaultPortions` gesetzt (1–6). Wenn dieser Wert > 1 ist, nach dem letzten Wizard-Step **Follow-up-Screen**: „Du kochst für mehr als eine Person. Willst du Profile für die anderen anlegen?" mit zwei Optionen:
  - **Ja, jetzt anlegen** → Wizard wird für User 2 nochmal durchlaufen (Step 1 nur Name/Alter/Größe/Gewicht, Aktivität/Ziel wie Wizard 1). Am Ende wieder Follow-up „Noch eine Person?" bis alle N Personen angelegt sind ODER User abbricht.
  - **Später** → keine weiteren Profile, Multi-User-Sessions nutzen Default-User (siehe unten) bis User über Settings selber ein Profil anlegt.
- Wizard-2..N zeigt oben eine kleine Progress-Pille „Person 2 von 3", damit klar ist wo im Flow.
- Speicherung: Der erste Wizard-Durchlauf befüllt `profiles[0]` (aktueller Slot). Folge-Durchläufe hängen an `profiles[1]`, `profiles[2]`, ...

### Settings-Ansicht

Neue Section in Settings-Sheet: **„Profile"**. Statt der aktuellen Profil-Section (Solo) zeigt eine Liste:

- Profil-Reihen untereinander, jede mit Name + kleine Meta-Zeile („28 J., 175 cm, Halten"), rechts kleines Chevron.
- Klick auf eine Reihe öffnet ein **Profil-Detail-Sheet** (analog Dish-Detail-Sheet): dort alle Wizard-Felder editierbar (Name, Alter, Größe, Gewicht, Aktivität, Ziel, Kalorien-Verteilung, Makros).
- Am Ende der Liste ein primärer Button: **„+ Profil hinzufügen"** — öffnet Wizard-Sequenz für neuen User (Step 1–N wie Onboarding, aber ohne Follow-up-Prompt).
- Löschen: im Profil-Detail-Sheet gibt es ganz unten „Profil löschen". User 1 kann nicht gelöscht werden (mindestens ein Profil muss bleiben).

### Portion-Semantik

Portion beim Kochen ist gleich der Anzahl teilnehmender Personen. Zuordnung nach Reihenfolge in `profiles[]`:

- **Portion = 1** → nur `profiles[0]` (User 1)
- **Portion = 2** → `profiles[0]` + `profiles[1]`
- **Portion = 3** → `profiles[0]` + `profiles[1]` + `profiles[2]`
- **Portion = N > profiles.length** → alle vorhandenen Profile + `(N − profiles.length)` × Default-User

**Berechnung pro Gericht:**

- **Kochmenge (Zutaten in Einkaufsliste):** Summe der individuellen Portions-Bedarfe der teilnehmenden Personen. Ein Bedarfs-Faktor pro User ergibt sich aus `abendessenKcal / referenzAbendessenKcal` (typisch 900 kcal), analog zum aktuellen `userScale`. Aggregat = Σ Faktoren × Rezept-Basismenge.
- **Anzeige der Nährwerte im Detail-Sheet:** pro Person separat als kleine Zeile („Du: 620 kcal, Partner: 780 kcal") ODER als Summe mit Aufklapp-Detail. UX-Entscheidung bei Umsetzung.
- **Fortschritts-Balken (Tagesziel):** individuell pro User 1 (der aktive Profil-Slot), andere Profile beeinflussen den Balken nicht — Multi-User verändert die Kochmenge, nicht die persönliche Bedarfs-Anzeige.

### Default-User

Wenn `portions > profiles.length`, wird für jede zusätzliche Person ein **Default-Erwachsener** angenommen. Referenz: DGE-Empfehlungen für Erwachsene mit mittlerer körperlicher Aktivität (PAL ≈ 1.6), gemittelt über Geschlecht (2400 kcal Ø aus 2200 Frau + 2600 Mann bei 30–50 J.). Für die App-Semantik reicht eine grobe Näherung:

- **Tagesziel:** 2200 kcal (leicht unter DGE-Mittel, weil PAL für Alltagsnutzer eher 1.4–1.6 als 1.6+ ist — konservative Untergrenze vermeidet Überkochen bei Gästen).
- **Makro-Verteilung:** Ausgewogen 30/40/30 (Protein/KH/Fett), analog zum bestehenden „Ausgewogen"-Preset. → **P** 165 g, **KH** 220 g, **F** 73 g pro Tag.
- **Kalorien-Verteilung auf Mahlzeiten:** analog zum Wizard-Default: Frühstück ~25 %, Mittag ~35 %, Abendessen ~40 % → Frühstück 550, Mittag 770, **Abendessen 880 kcal** (die für die Rezept-Skalierung relevante Zahl).

Quellen für Umsetzung nachzuschlagen: DGE-Referenzwerte für Nährstoffzufuhr ([dge.de](https://www.dge.de/wissenschaft/referenzwerte/)), EFSA Dietary Reference Values. Beim Bauen: Zahlen final gegen aktuelle Quelle prüfen, nicht diesen Backlog-Eintrag als Wahrheit nehmen.

### State-Skizze

```js
state.settings.profiles = [
  {
    id: "u1",              // stabil, für Assignment-Referenzen
    name: "Oliver",
    age: 38,
    height: 180,
    weight: 78,
    sex: "m",              // "m" | "f" | "d"
    activity: 1.4,         // PAL-Wert wie bisher
    goal: "hold",          // "hold" | "lose" | "gain"
    dailyKcal: 2200,       // berechnet oder manuell überschrieben
    macros: { p: 165, kh: 220, f: 73 },
    breakfastKcal: 550,
    lunchKcal: 770,
    // Abendessen = daily − breakfast − lunch (aktuelles Verhalten bleibt)
    favorites: { [dishId]: true },   // pro User separate Favoriten
  },
  // profiles[1], profiles[2], ...
];

state.settings.activeProfileId = "u1";   // Basis für Dashboard-Bedarfs-Pille und Nährwert-Balken
```

**Portion → Diner-Liste (Ableitung, kein State-Slot):**

```js
function dinersForPortion(portions, profiles) {
  const actual = profiles.slice(0, portions);
  const missing = Math.max(0, portions - profiles.length);
  return [...actual, ...Array(missing).fill(DEFAULT_USER)];
}
```

`DEFAULT_USER` ist konstant in `src/nutrition/defaults.js` gepflegt, damit ein späterer Change an DGE-Werten an einer Stelle passiert.

### Migration bestehender States

Alter State hat `state.settings.profile` (Single). Migration beim Laden:

- `profile` → `profiles[0]`, mit generierter `id: "u1"`
- `activeProfileId: "u1"`
- Keine Storage-Key-Änderung (Guardrail 2 bleibt) — nur Feld-Umstrukturierung mit Fallback beim Read.

### Warum später

- Große Refactor-Fläche: Dashboard-Bedarfs-Pille, Nährwert-Balken, Detail-Sheet-Nährwerte, Einkaufslisten-Aggregation, Reroll-Logik greifen alle auf `settings.profile` zu. Multi-User braucht Ersatz durch `profiles[activeProfileId]`.
- UX-Klärungen offen: Nährwert-Anzeige pro Person vs. Summe, Detail-Sheet-Layout mit N Zeilen, Handling wenn User 1 gelöscht wird (welcher wird active).
- Braucht sauberes Default-User-Fundament (siehe DGE-Recherche oben), damit „6 Portionen ohne 6 Profile" nicht zu Müllzahlen führt.

Ideal in derselben Iterations-Sequenz wie **Rezept-Import** — beide erweitern das State-Modell fundamental und lohnen sich gemeinsam zu designen (State-Migration nur einmal).

## Rezept-Import

**Idee:** Rezepte per File-Import hinzufügen, statt manuell in `src/data/dishes.json` zu editieren. User füllt ein Template aus (JSON), generiert Bild per Prompt-Vorlage, importiert beides in der App über Settings > Daten. Wächst zur Grundlage für „Rezept-Community" oder eigenen Kochkatalog.

**UX-Skizze:** Neuer Button in Settings > Daten: „Rezept importieren". File-Picker akzeptiert eine `.json`-Datei (Rezept-Template) + eine Bild-Datei (JPG). App validiert das JSON gegen Pflichtfelder und prüft dass alle referenzierten `ingredients.key`-Werte existieren. Bei Erfolg: Rezept landet in Custom-Rezept-Liste (parallel zu `dishes.json`), Bild wird ins App-Verzeichnis kopiert. Bei Validierungsfehler: klare Fehlermeldung („Zutat 'foo' ist unbekannt — bitte im Template mit `newIngredients:` deklarieren").

**Format:** JSON, weil `dishes.json` schon JSON ist und die Struktur bekannt. Template unter [`docs/redesign/recipe-import-template.md`](recipe-import-template.md) — enthält Rezept-Schema + Bildgenerierungs-Prompt-Vorlage.

**Pflichtfelder** (aus `dishes.json` abgeleitet):
- `name` (String)
- `cuisine` (String, z. B. „Italienisch")
- `cuisineGroup` (String — Enum: mediterranean, asian, indian, middleEast, americas, european, german)
- `cooktime` (Number, Minuten)
- `kcal`, `p`, `kh`, `f` (Number, Nährwerte)
- `tags` (String[], z. B. `["contains-meat", "contains-gluten"]`)
- `ingredients` (Array von `{ key, grams, note? }`)
- `steps` (String[])
- `image` (relative File-Referenz, z. B. `./mein-rezept.jpg`)

**Optional:**
- `id` — wird beim Import automatisch vergeben (ab z. B. 1000 für Custom, damit keine Kollision mit `dishes.json`)
- `newIngredients` — Array neuer Zutaten die noch nicht in `ingredients.json` existieren. Struktur wie `ingredients.json`-Einträge (label, cat, unit, per100g, optional displayUnit/gramsPerUnit).

**State-Skizze:**
- `state.customDishes: Dish[]` — parallele Liste zu Build-Time-`dishes.json`
- `state.customIngredients: { [key]: Ingredient }` — parallele Registry für neue Zutaten
- Loader: mergt `dishes.json` + `customDishes` und `ingredients.json` + `customIngredients` beim App-Start

**Bild-Handling:** Guardrail 3 sagt „Bilder als externe Dateien". Für Import:
- **Web / Dev:** Bild wird als Blob URL im State gehalten (`URL.createObjectURL`) und wieder freigegeben beim Rezept-Löschen. Persistenz per IndexedDB (localStorage ist zu klein).
- **Android:** Capacitor Filesystem API → speichert unter `Directory.Data/dishes/dish-<id>.jpg`. State hält nur die relative Pfad-Referenz.

**Validation beim Import:**
1. JSON parsen — bei Fehler: Zeilenangabe zurückgeben
2. Alle Pflichtfelder vorhanden — sonst Liste der fehlenden Felder
3. Nährwerte-Sanity-Check (kcal > 0, p/kh/f ≥ 0)
4. `cuisineGroup` gegen Enum prüfen
5. Alle `ingredients[].key` müssen in `ingredients.json` ODER in `newIngredients` existieren — sonst Liste der unbekannten Keys mit Hint auf `newIngredients`
6. `tags` gegen bekannte Tag-Liste prüfen (Warnung, kein Error — unbekannte Tags werden gespeichert aber ohne Filter-Effekt)
7. Bild-Datei: Format (JPG/PNG), Größe (< 2 MB), Ratio (empfohlen 1:1)

**Warum später:** Braucht:
- Neuen State-Slot + Loader-Merge-Logik
- File-Picker + Bild-Handling (Capacitor Filesystem oder IndexedDB)
- Solide Validation mit User-lesbaren Fehlermeldungen
- UX-Entscheidung ob Custom-Rezepte visuell markiert werden (klein „eigenes Rezept"-Badge auf Dish-Card?)
- Bild-Prompt-Template-Pflege (bei neuen Rezepten von Custom-Import: passt der Foodblog-Stil noch, oder darf der User frei stylen?)

Ideal in derselben Session wie **Datenverwaltung / Iteration 7** (Export/Import JSON + Reset) — der Import-Flow überschneidet sich am Datei-Handling und Validation-Framework.
