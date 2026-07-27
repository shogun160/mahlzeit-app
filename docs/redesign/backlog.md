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

## Rezept-Import (File-Picker) — verworfen zugunsten Repo-Update

**Status:** Bewusst nicht verfolgt. Nach Abwägung mit dem User im Juli 2026: der lokale File-Picker-Import (User bekommt JSON + Bild irgendwoher, importiert in der App) ist als Contribution-Weg für den Solo-Dev-Fall zu umständlich. Die Kombination aus **„Rezepte aus GitHub-Repo aktualisieren"** (Repo-Update-Button in Settings) + **„Community-Rezepte per Pull Request"** (Contribution über GitHub) deckt den gleichen Bedarf ab, ohne dass User sich um File-Handling kümmern müssen.

Die technischen Bausteine (JSON-Validator, Loader-Merger, State-Slot, Bild-Handling via Capacitor Filesystem, Schema-Version-Check) werden im Repo-Update-Feature identisch gebraucht — der File-Picker wäre nur eine dünne UI-Schicht darüber und lohnt sich für den Solo-Use-Case nicht.

Reaktivieren wenn: konkreter Nutzer-Wunsch entsteht, Rezepte offline (ohne Netz und ohne Community-PR-Weg) einzuspielen. Die ursprüngliche Design-Skizze steht in der Git-History dieses Backlogs — bei Bedarf reaktivierbar.

## Profil teilen / importieren

**Status:** Umgesetzt in Session 19 (Branch `multiuser`, in `beta` gemerged). Siehe [Design-Doc](2026-07-27-profil-teilen-import-design.md) und [Implementierungs-Plan](2026-07-27-profil-teilen-import-plan.md). MVP-Scope: Text-Share via `@capacitor/share`, QR (`qrcode` + `@capacitor-mlkit/barcode-scanning`), Copy-Paste; Deep-Link + Datei-Export bewusst nicht enthalten.

**Idee:** Ein Profil (z. B. das eigene) als Datei oder Deep-Link teilen, damit ein anderer Mahlzeit-Nutzer es bei sich importieren kann. Kein Cloud-Sync, sondern manueller Peer-to-Peer-Transport (WhatsApp/Signal/Mail/AirDrop).

**Auslöser:** Multi-Profile (Session 18) macht es reizvoll: „Mein Partner nutzt die App neu — ich schicke ihm mein Profil damit er nicht alles neu einrichten muss." Oder Tausch von Ernährungs-/Küchen-Präferenzen zwischen Freunden.

### Export

**Format:** JSON — dasselbe Schema wie ein Profil-Objekt aus `state.settings.profiles[i]`. Wrapper mit Meta:

```json
{
  "type": "mahlzeit-profile",
  "version": 1,
  "exportedAt": "2026-07-27T…",
  "profile": {
    "name": "Oliver",
    "gender": "male",
    "age": 38,
    "heightCm": 180,
    "weightKg": 78,
    "activityLevel": 3,
    "goal": "maintain",
    "dailyTargetOverride": 2200,
    "breakfastKcal": 400,
    "lunchKcal": 700,
    "macroPreset": "balanced",
    "macroTargets": null,
    "showCalorieBar": true,
    "preferences": { "meat": true, "fish": true, "vegetarian": false },
    "cuisines": { "asian": true, "mediterranean": false, "middleEast": false, "americas": false },
    "favorites": { "3": true, "12": true }
  }
}
```

- `id` NICHT mitschicken (wird beim Import neu vergeben, sonst Kollision mit existierenden `u1`/`u2`).
- `favorites` = Map von dish-IDs. Nur sinnvoll wenn Empfänger dieselbe/neuere `dishes.json` hat — bei fehlender ID ignorieren beim Import.

### Transport-Varianten (in Reihenfolge einfachste zuerst)

1. **Web Share API** (Android via Capacitor): `navigator.share({ text: base64(json) })` oder als Datei-Attachment. User-Flow: „Teilen" → Ziel-App wählen (WhatsApp, Mail, …). Empfänger bekommt Text/File → tippt „In Mahlzeit öffnen".
2. **Copy-to-Clipboard**: JSON als Base64-String kopieren, per Chat schicken. Empfänger paste in ein „Profil importieren"-Feld.
3. **QR-Code**: JSON als QR (funktioniert nur für kleine Profile ohne viele Favoriten — Base64-JSON von ~500 Bytes passt in QR Level M). Empfänger scannt mit Kamera. Braucht QR-Generator + Scanner-Lib.
4. **Deep-Link**: `mahlzeit://profile/import?data=<base64>` → wenn App installiert, öffnet sich Import-Dialog. Braucht Intent-Filter in `AndroidManifest.xml` + `Capacitor.App.addListener('appUrlOpen', …)`.
5. **Datei-Export/Import**: `.mahlzeit-profile.json` als File-Download (Web) bzw. Capacitor-Filesystem-Share (Android).

**Empfehlung MVP:** Kombination aus **1 + 2** — Share-API auf Android (öffnet nativen Share-Sheet), Clipboard-Fallback im Browser. Klein, keine neuen Libs, kein Deep-Link-Setup.

### Import-Flow

- **Trigger:** Settings > Profile > „Profil importieren"-Button (oder Klick auf empfangenen Link/Text).
- **Input:** Textfeld für JSON-Paste ODER Datei-Picker ODER Deep-Link-Handler.
- **Validation:**
  1. `type === "mahlzeit-profile"` und `version === 1`
  2. Pflichtfelder da (name als Fallback, sonst „Import"): gender+age+heightCm+weightKg für die Rechnung
  3. Enum-Checks: goal, macroPreset, gender
  4. `favorites`: unbekannte dish-IDs vor Import filtern + im UI melden („2 Favoriten übersprungen — Rezepte fehlen bei dir")
- **Preview:** Vor dem Anlegen: Ansicht was importiert wird (Name, Bio-Daten, Anzahl Favoriten, Prefs). Buttons „Importieren" / „Abbrechen".
- **Anlegen:** `addProfile(patch)` mit den importierten Feldern. Neues Profil wird ans Ende von `profiles[]` angehängt (nicht aktiv).

### Sicherheit

- Kein Auto-Import ohne Bestätigung — sonst Malware-Potenzial über Deep-Link.
- Import ist nie destruktiv: legt immer NEUES Profil an, überschreibt kein existierendes. Wenn User Duplikate hat, kann er sie manuell im Detail-Sheet löschen.
- Size-Limit auf JSON (~10 KB) um DoS-Attacken über riesige favorites-Maps zu verhindern.

### Warum später

- Braucht Share-API-Integration + Import-Sheet-UI (nicht trivial).
- Deep-Link erfordert Änderungen an Android-Manifest (Intent-Filter).
- Erst wenn Multi-Profile stabil ist und Nutzer echten Bedarf haben („mein Partner will meine Werte übernehmen"). Aktuell reicht: „Werte manuell abtippen" — 5 Slider, in 30 Sekunden gemacht.
- Ideal in einer Session zusammen mit **Rezept-Import** — beide brauchen JSON-Validation-Framework + Share-Sheet-Integration.

## Kochmodus mit Wake-Lock

**Idee:** Beim Kochen ein dedizierter Vollbild-Modus, der die Rezept-Schritte groß darstellt und den Handy-Screen an lässt, damit man nicht mit fettigen Fingern immer wieder aufwecken muss.

**UX-Skizze:**

- Im Detail-Sheet (Tab „Rezept") neuer primärer Button: **„Jetzt kochen"** — öffnet Vollbild-View.
- Vollbild-View zeigt:
  - Aktueller Schritt groß in der Mitte, Fließtext gut lesbar (~20 pt).
  - Kleine Meta oben: Rezept-Name, Schritt X von N.
  - Progress-Bar oder Dots am unteren Rand.
  - Groß-Buttons: „Weiter" / „Zurück" (breit, Daumen-freundlich).
  - Kleiner Beenden-Button (X oben rechts).
- Screen bleibt an: [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) auf modernen Browsern (Chrome/Edge auf Android ab v84). Fallback: Capacitor-Plugin `@capacitor-community/keep-awake` falls WebView-Support unzuverlässig.
- Beim Verlassen (Beenden, App-Wechsel, Schließen): Wake-Lock wird released.

**State-Skizze:**
- Kein persistenter State nötig — Kochmodus ist transient. Aktueller Schritt-Index modul-lokal in `src/cook-mode/`.

**Warum später:** Kein State-Migrations-Risiko, aber neuer UI-Screen + Native-Bridge fürs Wake-Lock (falls Screen-Wake-Lock-API in Capacitor-WebView Probleme macht). Ideal zusammen mit **Timer im Rezept**, weil beide im Kochmodus leben.

## Timer im Rezept (nur im Kochmodus)

**Idee:** Wenn ein Rezept-Schritt eine Zeitangabe enthält („4 Min braten", „25 Min köcheln"), wird beim Schritt im Kochmodus ein Timer-Chip erkannt und tapbar dargestellt. Ein Tap startet den Timer, er läuft im Hintergrund weiter (auch bei Schritt-Wechsel im Kochmodus), Notification + Ton bei Ablauf.

**UX-Skizze:**

- **Parsing der Schritt-Zeit:** Regex im Step-Text sucht Muster wie „X Min", „X Minuten", „X Sek", „X-Y Min" (bei Range: nutze Untergrenze oder Mittelwert). Erster Match wird zum Timer-Kandidaten.
- **Rendering im Kochmodus:** Neben dem Schritt-Text ein Chip mit ⏱ + „4 Min" (Zeit-Wert). Tap → Timer startet, Chip wechselt in Running-State mit Countdown.
- **Running-State-Chip:** Zeigt verbleibende Zeit (mm:ss). Interaktionen per Long-Press oder zusätzliches Menü:
  - **Pausieren** → Chip zeigt „⏸ 2:15", Zeit friert ein
  - **Neustarten** → springt zurück auf Original-Zeit, läuft
  - **Editieren** → Bottom-Sheet mit Number-Input für Minuten/Sekunden, Bestätigen setzt neue Zeit als Rest-Zeit
  - **Stoppen** → Chip zurück in Idle-State (tapbar, Original-Zeit)
- **Ablauf-Notification:** Bei Zeit-Ende Ton (kurz, Notification-Sound) + Vibration + Notification mit Rezept-Name und Schritt-Text („Bratzeit vorbei — 4 Min braten"). Timer-Chip wechselt in „Fertig"-State (grüner Haken, tap → reset).
- **Multi-Timer:** Ein Rezept kann mehrere Zeit-Schritte haben. Beim Schritt-Wechsel im Kochmodus laufen aktive Timer im Hintergrund weiter — sichtbar als kleine Pille oben unter dem Rezept-Namen („🟢 2 Timer laufen"), tap öffnet Timer-Übersicht.
- **Nur im Kochmodus:** Im normalen Detail-Sheet wird der Timer-Chip NICHT gezeigt. Der Timer ist ein Kochhilfe-Feature — außerhalb des Kochens macht er keinen Sinn.

**State-Skizze:**

```js
// Modul-lokal in src/cook-mode/timers.js
const runningTimers = new Map(); // key: `${dishId}-${stepIndex}` → { endsAt, paused, remainingMs, originalMs }
```

- Persistenz zwischen App-Restarts nicht nötig — Kochmodus ist eine kohärente Session.
- Bei App-Suspend (Background): Timer-Endzeit als Timestamp speichern, bei Resume ausrechnen was verbleibt. Sonst würden Timer beim Bildschirmsperren einfrieren.
- Native Notification-Trigger via Capacitor `LocalNotifications` — feuert auch wenn App im Hintergrund oder Screen aus.

**Warum später:** Braucht **Kochmodus als Basis** (Timer lebt darin), Regex-Parsing der Steps (Fallback wenn kein Match: kein Timer-Chip, Schritt bleibt normal), Notification-Permission-Handling, Capacitor `LocalNotifications`-Plugin.

## Rezept-Suche (Text) im Dish-Picker

**Idee:** Textfeld im Dish-Picker unter den Filter-Chips. Sucht in Rezept-Name, Zutaten-Namen und Küche. Bei aktiver Suche werden die Filter-Chips zusätzlich angewandt (Suche AND Filter).

**UX-Skizze:**

- Position: unter der letzten Filter-Reihe (macro), oberhalb der Tile-Grid.
- Kompakt-Design analog Header-Suchfelder: `<input type="search">` mit Lupen-Icon links, Clear-X rechts sobald Text vorhanden.
- Live-Suche (kein Enter nötig): bei jedem Tastendruck neu filtern. Debounce ~150 ms, damit bei schnellem Tippen nicht jeder Frame gerendert wird.
- Case-insensitive, umlauttolerant (`ü` matcht `ue`).
- Match-Prio (für Sortierung bei aktiver Suche): 1. Name-Prefix, 2. Name-Contains, 3. Zutat-Match, 4. Küche-Match. Innerhalb einer Prio: bestehende Fav-/Präferenz-Sortierung.
- Empty-State: wenn nichts passt, Hint „Nichts gefunden — Filter zurücksetzen?" (Button zur Reset-Action).
- **Collapse-State analog Filter-Section:** wenn User scrollt, Suchfeld kollabiert mit den Filtern nach oben (bleibt als schmale Pille sichtbar).

**State-Skizze:**
- Suchbegriff modul-lokal in `src/dish-picker/render.js` (analog `activeFilters`, `filtersCollapsed`).
- Kein persistenter State — Suche verliert sich beim Sheet-Close.

**Warum später:** Kein Blocker für aktuelle Rezept-Anzahl (~30 Gerichte, überschaubar). Wird spürbar sinnvoll ab ~50+ Rezepten. Guter Session-Kandidat wenn parallel Rezept-Import oder eine größere Content-Erweiterung kommt.

## Rezepte aus GitHub-Repo aktualisieren

**Idee:** Auf Knopfdruck aus Settings prüft die App, ob im öffentlichen Repo neue Rezepte veröffentlicht wurden, und laedt sie inklusive Bilder nach — ohne APK-Update. Ermoeglicht Content-Rollout ohne Play-Store-/APK-Roundtrip.

**Datenquelle:** Raw-URLs vom Repo (`main`-Branch):

- `https://raw.githubusercontent.com/shogun160/mahlzeit-app/main/src/data/dishes.json`
- `https://raw.githubusercontent.com/shogun160/mahlzeit-app/main/src/data/ingredients.json`
- Bilder: `https://raw.githubusercontent.com/shogun160/mahlzeit-app/main/public/dishes/dish-<id>.jpg`

Public-Repo, kein CORS-Problem, keine Auth. Fallback: wenn der User irgendwann das Repo umbenennt, ist die Basis-URL eine Config-Konstante.

**UX-Skizze:**

- Settings > „Daten"-Section neuer Button: **„Nach neuen Rezepten suchen"**. Sekundäre Optik.
- Klick zeigt Spinner + „Ich prüfe das Repo..."
- Ergebnis-Sheet:
  - **Neue Rezepte gefunden:** Liste der neuen Rezepte mit Name + Bild-Thumbnail. Primary-Button „X neue Rezepte laden" + Secondary „Abbrechen".
  - **Alles aktuell:** kurzer Toast „Deine Rezepte sind aktuell." + letztes-Check-Timestamp in der Section-Summary.
  - **Fehler (Netz weg, JSON kaputt):** klarer Fehler-Toast, User kann später neu versuchen.
- Nach Bestätigung: Progress-Anzeige während Bilder gefetcht werden („2 von 5 Rezepten geladen..."). Metadata wird sofort eingespielt, Bilder progressiv nachgeholt — Rezepte mit noch fehlenden Bildern zeigen Platzhalter bis Download durch ist.
- **Letztes Update sichtbar:** Section-Summary zeigt „Zuletzt geprueft: vor 3 Tagen" damit User weiss wie aktuell sein Bestand ist.

**Schema-Versioning:**

- `dishes.json` bekommt neues Top-Level-Feld `schemaVersion: 1` (Zahl, incrementell). Analog bei `ingredients.json`. Erst-Migration: App legt `schemaVersion: 1` in bestehende JSON-Dateien beim naechsten APK-Build fest.
- Beim Update-Check vergleicht App die eingebaute `SCHEMA_VERSION_DISHES` / `SCHEMA_VERSION_INGREDIENTS` mit dem Wert der Remote-JSON.
- **Mismatch-Verhalten** (bewusst kein Auto-Migrations-Code):
  - Remote-Version **> lokal**: klare Fehlermeldung im Ergebnis-Sheet — „Neue Rezepte nutzen ein neueres Datenformat. Bitte die App aktualisieren und dann erneut versuchen." Kein Import.
  - Remote-Version **< lokal**: sollte nicht vorkommen (Repo ist immer die aktuellste Wahrheit); wenn doch, gleiche Fehlermeldung mit anderem Text.
  - Remote-Version **== lokal**: Import laeuft.
- Vorteil: Schema-Aenderungen bleiben an APK-Releases gekoppelt (Guardrails bleiben stabil), Content-Aenderungen sind entkoppelt. Kein Migration-Framework im JS-Code noetig.

**Merger-Logik (beim App-Start):**

```js
// src/data/dishes.js (Erweiterung)
import bundledDishes from './dishes.json';
import { state } from '../state.js';

export const allDishes = mergeDishes(bundledDishes, state.remoteDishes || []);

function mergeDishes(bundled, remote) {
  // Bundled hat immer Vorrang (Guarantee: alles was in der APK ist, funktioniert)
  const byId = new Map(bundled.map((d) => [d.id, d]));
  for (const d of remote) {
    if (!byId.has(d.id)) byId.set(d.id, d);
  }
  return Array.from(byId.values());
}
```

Analog fuer `ingredients.json`. Guardrail 8 (keine Duplikat-Zutaten) greift automatisch: der Merger schmeisst Remote-Zutaten weg, deren Key bereits in `bundledIngredients` existiert.

**State-Skizze:**

```js
state.remoteDishes = [/* Dish[]-Objekte, wie in dishes.json */];
state.remoteIngredients = { /* key → Ingredient, wie in ingredients.json */ };
state.remoteUpdatedAt = "2026-08-01T18:32:00.000Z"; // ISO, fuer Section-Summary
```

Persistenz per bestehendem `mahlzeit-state-v2` (Guardrail 2 bleibt intakt — nur neue Felder, keine Key-Aenderung).

**Bild-Handling:**

- Web / Dev (Browser): Bilder als Blob-URL, in IndexedDB persistiert (localStorage zu klein fuer JPGs).
- Android: Capacitor Filesystem API → speichert unter `Directory.Data/remote-dishes/dish-<id>.jpg`. State haelt nur Pfad-Referenz. Loader mappt `dish-<id>.jpg` fuer Bundled vs. Remote-Pfad.
- Bild-URL-Aufloesung im Card-Render (`day-card__image` src): erst Remote-Cache pruefen, sonst Bundled `/dishes/dish-<id>.jpg`.

**Rate-Limiting / Missbrauchsschutz:**

- Client-seitiger Throttle: Update-Check nur einmal pro Stunde. Danach zeigt der Button „Zuletzt gerade geprueft — bitte spaeter erneut versuchen".
- Reine Vorsichtsmassnahme — GitHub Raw hat sowieso grosszuegige Limits fuer unauthenticated Public-Content-Requests.

**Warum später:**

- Braucht Bild-Caching-Infrastruktur (Capacitor Filesystem + State-Slot fuer Remote-Referenzen) — die gleiche Fundament wie **Rezept-Import** (JSON-Rezepte per File-Picker). **Ideal zusammen in einer Session designen**, weil Bild-Handling, Merger-Logik und State-Slot geteilt werden.
- Braucht Schema-Version-Feld in `dishes.json` + `ingredients.json` — im gleichen APK-Release ausrollen.
- Ideal nach Rezept-Import: erst die File-Picker-Variante (unabhaengig vom Netz), dann diese Repo-Variante als Overlay. Beide teilen sich denselben Loader-Merger.

## Community-Rezepte per GitHub Pull Request

**Idee:** Andere User (oder du selbst) reichen neue Rezepte per Pull Request im GitHub-Repo ein. Templates + automatisierte Checks in einer GitHub Action sorgen dafuer, dass nur mergefaehige PRs bei dir landen — du machst nur den Merge-Klick, dann ist das Rezept ueber das **„Rezepte aus GitHub-Repo aktualisieren"**-Feature fuer alle User verfuegbar.

**Wechselwirkung:** Braucht das Repo-Update-Feature als Konsum-Pfad — ohne den bringt ein Community-PR den Endnutzern nichts. Beide Features in derselben Iteration ausrollen.

### Dateien im Repo

- **`.github/pull_request_template.md`** — wird beim Erstellen jedes PRs automatisch als Body vorgeschlagen. Checkliste:
  - JSON-Rezept in `src/data/dishes.json` ergaenzt (Schema siehe [`docs/redesign/recipe-import-template.md`](recipe-import-template.md))
  - Bild als `public/dishes/dish-<id>.jpg` beigelegt (800×800, ≤ 400 kB, JPEG)
  - Neue Zutaten in `src/data/ingredients.json` ergaenzt (nur wenn noetig)
  - Naehrwerte plausibel (kcal ≈ p·4 + kh·4 + f·9)
  - Bild-Generierungs-Prompt aus [`docs/recipe-image-prompt.md`](../recipe-image-prompt.md) verwendet
  - `npm run build` laeuft lokal ohne Fehler
- **`.github/ISSUE_TEMPLATE/recipe-suggestion.yml`** — Formular-Issue-Template fuer User ohne Git-Kenntnisse. Ausfuellbare Felder (Name, Kueche, Zutaten, Steps als Textfelder). Du uebernimmst das manuell in JSON oder mit KI-Assistenz. Nicht selbst-mergbar, aber niedrige Huerde fuer Nicht-Techies.
- **`CONTRIBUTING.md`** — Kurzanleitung „So schlaegst du ein neues Rezept vor": Link auf PR-Template, Bild-Prompt-Datei und JSON-Schema. Wird von GitHub am Contribute-Button angezeigt.
- **`docs/recipe-image-prompt.md`** — der bewaehrte Bild-Generierungs-Prompt-Rahmen (Foodblog-Stil, Vogelperspektive, natuerliches Licht, quadratisch 800×800). Modell-agnostisch formuliert (funktioniert mit ChatGPT/Midjourney/Nano-Banana). Beispiele mit guten/schlechten Ergebnissen zur Orientierung.

### GitHub Action: automatisierte Checks

`.github/workflows/pr-recipe-check.yml` — laeuft bei jedem PR der `public/dishes/*.jpg` oder `src/data/dishes.json` oder `src/data/ingredients.json` anfasst. Prueft:

**Bild-Checks** (`sharp` oder ImageMagick):
- Dimension muss 800×800 sein (± 10 px Toleranz)
- Dateigroesse ≤ 400 kB
- Format JPEG (kein PNG, kein WebP, kein AVIF)
- Kein transparenter Hintergrund (JPEG kann sowieso keins, aber gegen falsche Konvertierung)

**JSON-Checks** (Node-Script gegen `dishes.json` + `ingredients.json`):
- Pflichtfelder vorhanden (name, cuisine, cuisineGroup, cooktime, kcal, p, kh, f, tags, ingredients, steps)
- `cuisineGroup` gegen bekannte Enum (mediterranean, asian, indian, middleEast, americas, european, german)
- `id` ist eindeutig (Kollision mit bestehenden Rezepten oder anderen PRs verhindern — GitHub-Action muss Base-Branch mit vergleichen)
- Bild-Datei `public/dishes/dish-<id>.jpg` existiert im PR
- Alle `ingredients[].key` existieren in `ingredients.json` (oder werden im gleichen PR ergaenzt)
- Guardrail 8: keine Duplikat-Zutaten (neue Ingredient-Keys nicht semantisch identisch mit existierenden — schwer automatisiert, deshalb als Warnung mit „Bitte manuell pruefen: `oregano_g` ergaenzt, es existiert bereits `oregano_tl`")
- Naehrwerte-Sanity: `|declared kcal − (p·4 + kh·4 + f·9)| < 100` (Toleranz weil Ballaststoffe/Alkohol nicht separat gefuehrt werden)

**Bei Fehler:** Roter Check am PR + Kommentar mit konkretem Problem und Fix-Hint. Contributor sieht sofort was zu tun ist, ohne dich zu belaesten.

### Optional: Preview-Deployment

Bei jedem PR koennte die App als Preview auf GitHub Pages oder Vercel gebaut werden — Reviewer sieht das neue Rezept im echten Picker. Nice-to-have, nicht MVP.

### State-/App-Impact

Keiner. Reine Repo-/Prozess-Ebene. Kein Code in der App aendert sich durch dieses Feature — es steht und faellt komplett mit dem separaten „Rezepte aus GitHub-Repo aktualisieren"-Feature.

### Warum später

- Setzt „Rezepte aus GitHub-Repo aktualisieren" voraus — sonst Aufwand ohne Nutzer-Wirkung.
- Braucht bereits abgestimmtes JSON-Schema + Bild-Standard — beide werden mit Rezept-Import ohnehin festgezogen. Deshalb erst nach den beiden Vorstufen sinnvoll.
- Ideal in einer Session zusammen mit dem Konsum-Feature einrichten, damit End-to-End-Flow (PR → Merge → Repo-Update-Button → User bekommt Rezept) in einem Rutsch getestet ist.
