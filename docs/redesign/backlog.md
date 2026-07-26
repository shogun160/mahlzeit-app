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

**Idee:** Mehrere Nutzer-Profile hinterlegen (z. B. für Partner:in, Kinder). Beim Planen einer Woche wählt man, wer isst — die Rezept-Skalierung berücksichtigt die individuellen Ziele.

**Warum später:** Große State-Erweiterung (Profil-Liste statt Single-Profile), pro-Tag/Person-Assignment nötig. Erst Solo-Case sauber implementieren, dann Multi.

**Auslöser:** Aus Session 10 (Iteration 4/5 — Profil + Rezept-Skalierung). User bekocht meist allein, aber die Semantik "userScale wirkt auf gesamte Kochmenge" bricht sobald mehrere Personen unterschiedliche Ziele haben.

**Skizze für später:**
- `state.settings.profiles: [{ id, name, ...profileFields }]`
- `state.assignment[day].dishId` bleibt, dazu `state.assignment[day].diners: [profileId]`
- Rezept-Skalierung: Faktor pro Person, dann Aggregat für Einkaufsliste
- Wochen-Bar: eine pro aktivem Profil oder Umschalter

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
