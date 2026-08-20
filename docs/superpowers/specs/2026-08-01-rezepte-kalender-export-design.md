# Design-Doc: Rezepte in Google Kalender exportieren

**Status:** Approved — Umsetzung ausstehend
**Datum:** 2026-08-01
**Vorgaengerdoc:** [`docs/redesign/2026-07-26-kalender-export-design.md`](../../redesign/2026-07-26-kalender-export-design.md) (`.ics`-Share-Ansatz, hier nicht umgesetzt)

## 1. Ziel

Der User exportiert die aktuell markierten Rezepte per Klick als JSON in die Zwischenablage, fuegt sie in eine Claude-Session ein, und Claude legt sie via Google-Calendar-MCP als Kalender-Events an — mit Duplikat-Pruefung. Kein OAuth in der App, kein Cloud-Console-Setup, kein neuer Build fuer die Kalender-Anbindung selbst.

## 2. Scope-Abgrenzung zum Vorgaengerdoc

Das bestehende Kalender-Export-Design (`2026-07-26`) plante `.ics`-Share via Capacitor Share Plugin. Dieses Doc ersetzt den Weg fuer den MVP:

- **Weg neu:** JSON in Zwischenablage → Claude via MCP
- **Weg alt (nicht umgesetzt):** `.ics`-Datei → System-Share-Sheet
- **Datenmodell (Titel/Body/Cuisine-Emojis/Datums-Zuordnung/Zeit-Default):** groesstenteils uebernommen aus dem Vorgaengerdoc, ergaenzt um `cuisineGroup`-basierte Icon-Zuordnung
- **Vorgaengerdoc bleibt archiviert** — kein loeschen, dokumentiert die Entscheidungshistorie

## 3. UX-Flow

**Trigger:** Neue Zeile in Settings → Section „Rezepte" (`src/settings/rezepte-section.js`), direkt unter „Rezepte importieren":

- **Label:** „Rezepte exportieren"
- **Sub-Label / Hint:** dynamisch, z. B. „5 Rezepte ausgewaehlt" oder bei leerer Auswahl „Keine Rezepte markiert"
- **Button-State:** disabled wenn keine Rezepte markiert sind (kein Tag mit `state.selected[day] === true` und gesetztem `state.assignment[day]`)

**Klick-Handler:**

1. JSON aus State bauen (siehe §4)
2. In Zwischenablage kopieren (siehe §6)
3. Toast: „N Rezepte kopiert — ab in den Claude-Chat"

**Kein Confirm-Sheet, kein Zeitraum-Picker.** Ein Klick, fertig — bewusst schlank, weil der Datums-Kontext ohnehin erst beim Claude-Insert festgezurrt wird.

## 4. JSON-Format

Struktur des Clipboard-Payloads:

```json
{
  "exportedAt": "2026-08-01T14:23:00+02:00",
  "timezone": "Europe/Berlin",
  "meals": [
    {
      "day": "Montag",
      "portions": 2,
      "dishId": 1,
      "name": "Wildlachs-Bowl",
      "cuisine": "Asiatisch-Fusion",
      "cuisineGroup": "asian",
      "cooktime": 35,
      "ingredients": [
        { "label": "Lachs (Sockeye)", "quantity": "440 g",     "grams": 440 },
        { "label": "Salatgurke",      "quantity": "½ Stück",   "grams": 150 },
        { "label": "Sojasauce",       "quantity": "2 EL",      "grams": 30 }
      ],
      "steps": [
        "Reis nach Packungsanweisung kochen.",
        "..."
      ]
    }
  ]
}
```

### Feld-Regeln

- **`day`:** Wochentag-Vollname aus `DAYS` in `src/state.js` (`Montag`, `Dienstag`, `Mittwoch`, `Donnerstag`, `Freitag`, `Samstag`, `Sonntag`) — kein konkretes Datum. Zuordnung zum Kalenderdatum passiert erst beim Claude-Insert (siehe §7).
- **`portions`:** aus `state.portions[day]` (Multi-Diner-Faktor bereits eingerechnet, wie in `consolidate.js` per `totalFactorForDish`).
- **`ingredients[].quantity`:** vorformatierter String via `formatIngredientQuantity()` auf `scaledGramsForDay()` — also exakt die Menge, die im Rezept-Sheet steht. Kein Doppel-Formatieren in der Claude-Session.

  Bewusst **nicht** `formatQuantity()`: das ist der Einkaufs-Formatierer, der auf ganze Stück aufrundet (`Math.ceil`). Fuer den Einkauf ist das richtig — man kauft keine halbe Gurke —, fuer eine Kochanleitung nicht. Bis 2026-08-20 nutzte der Export ihn trotzdem, wodurch aus 175 g Blumenkohl „1 Stück" (700 g) wurde. Ueber den Katalog gerechnet lag der Export dadurch im Schnitt 172 kcal ueber dem, was die Karte anzeigt, im Extremfall +44 %. Aus demselben Grund tragen Vorrat-Zutaten (Salz, Sesam) jetzt ihre Kochmenge statt `"Vorrat prüfen"`.

- **`ingredients[].grams`:** die exakte Kochmenge als Zahl. Ergaenzt `quantity`, weil die Anzeige Garnitur-Mengen aufs Viertel hebt („¼ Mango" statt 30 g) — wer rechnen will, nimmt `grams`.
- **`cuisineGroup`:** wird von Claude fuer die Icon-Zuordnung genutzt (`asian` → 🍜, `italian` → 🍝, ...). Fallback 🍽 fuer unbekannte oder fehlende Werte.
- **`cuisine`:** Freitext, nur zur Info im Body — nicht fuer Icon-Logik.
- **`dishId`:** mitgeliefert fuer spaetere Erweiterungen (z. B. Deep-Link), im MVP nicht weiter verwendet. Kostet nichts.
- **`exportedAt` + `timezone`:** ermoeglichen Claude, „heute" relativ zum Export-Zeitpunkt zu bestimmen (relevant fuer §7).

### Bewusst NICHT im JSON

- **Keine Makros** (kcal/p/kh/f) — Body soll scannbar bleiben. Kann in v2 ergaenzt werden.
- **Keine Bilder** — nicht relevant fuer Kalender-Events.
- **Keine App-Deep-Links** — v2-Kandidat, wenn Custom-URL-Handler eingebaut wird.
- **Kein konkretes Datum** — Datums-Zuordnung ist zustandslos gegenueber „welche Woche gerade ist".

## 5. Basis der Auswahl

Exportiert werden alle Rezepte, fuer die gilt:

- `state.selected[day] === true`
- `state.assignment[day]` ist gesetzt (also ein Gericht zugewiesen)

Reihenfolge im `meals`-Array: chronologisch aufsteigend nach Wochentag (Montag, Dienstag, ..., Sonntag).

Das entspricht **exakt der Menge, die auch die Einkaufsliste befuellt** (`buildConsolidatedList` in `src/shopping-list/consolidate.js` iteriert ueber dieselbe Menge). Abgehakte Zutaten (`state.checkedShopping`) sind fuer den Export irrelevant — Kalender-Events betreffen das *Kochen*, nicht den Einkauf.

Edge-Case „nichts markiert": Button disabled, kein Klick moeglich (siehe §3).

## 6. Zwischenablage-Handling

Primaer: `navigator.clipboard.writeText(JSON.stringify(payload, null, 2))`.

- In Capacitor-Webview auf Android funktioniert die Web-Clipboard-API direkt, sofern der Aufruf aus einem User-Gesture-Handler (Click) kommt — hier gegeben.
- Fallback bei Fehler oder wenn `navigator.clipboard` nicht verfuegbar: `@capacitor/clipboard`-Plugin installieren und nutzen. Zwei-Zeilen-Aenderung, kein Risiko.

Fehlerbehandlung: bei Ausnahme im `writeText`-Aufruf → Toast „Zwischenablage nicht erreichbar. Nochmal probieren?". Kein weiterer Retry, kein Fallback-UI mit ausgewaehltem Text im Sheet (YAGNI).

## 7. Datums-Zuordnung (Claude-seitig beim Insert)

Regel identisch zum Vorgaengerdoc §5:

1. Berechne den naechsten Sonntag ab `exportedAt` (`endDate`)
2. Berechne den Montag dieser Woche (`endDate - 6 Tage`)
3. Ordne jedem `meal.day`-Namen ein Kalender-Datum in dieser Woche zu
4. Filter: nur Meals mit `date >= exportedAt.dateOnly` werden eingefuegt (Vergangenheit rauswerfen)
5. Reihenfolge chronologisch aufsteigend

**Beispiel:** `exportedAt` = 2026-08-01 (Samstag), `meals = [Montag, Mittwoch, Freitag, Samstag]`
- Naechster Sonntag = 2026-08-02
- Wochenfenster: Mo 27.7. – So 2.8.
- Montag, Mittwoch, Freitag liegen in der Vergangenheit → nur Samstag 1.8. wird eingefuegt
- Claude meldet: „1 Rezept eingefuegt, 3 uebersprungen (in der Vergangenheit)"

## 8. Event-Struktur (Claude-seitig beim Insert)

**Titel:** `<icon> <name>` — z. B. `🍜 Wildlachs-Bowl`. Icon aus `cuisineGroup`-Mapping (Fallback 🍽).

**Zeit:** 19:00–20:00 Uhr (Default aus Vorgaengerdoc §4). Ueberschreibbar per Chat-Ansage vor dem Insert („mach 18:30–19:30"). Keine App-Setting im MVP.

**Zeitzone:** aus JSON-Feld `timezone`. Als `TZID` an Google uebergeben.

**Body (Description):**

```
Zutaten (2 Portionen):
• 440 g Lachs (Sockeye)
• 160 g Reis (schwarz)
• 2 EL Sojasauce
...

Zubereitung:
1. Reis nach Packungsanweisung kochen.
2. ...
```

- Zutaten mit vorformatierten Mengen aus JSON
- Zubereitungs-Schritte vollstaendig, damit im Kalender-Event alles greifbar ist
- Keine App-Deep-Links (v2)
- Keine Makros (v2)

**Reminder:** ohne — im MVP kein VALARM-Aequivalent (der User kann Kalender-Erinnerungen selbst am Kalender einstellen, wenn gewuenscht).

**Location:** leer.

**Wiederholung:** einmalig, kein Recurrence.

## 9. Duplikat-Pruefung (Claude-seitig beim Insert)

Fuer jedes einzufuegende Meal:

1. `list_events` fuer das Zieldatum (Fenster: das Datum, ganzer Tag) mit `q="<name>"`
2. Wenn im Ergebnis ein Event existiert, dessen Titel den JSON-`name` als Substring enthaelt (unabhaengig vom fuehrenden Icon oder anderer Dekoration) → skip, im Report als „bereits vorhanden" auffuehren
3. Sonst `create_event`

Deterministisch genug fuer den Use-Case. Falls Name-Match false-positives produziert (z. B. wenn zwei Rezepte in der App denselben `name` haben), kann Claude im Chat rueckfragen — kein Feature-Debt.

**Zusammenfassung nach Insert:**

```
3 Events angelegt:
  • Mo 3.8. 🍝 Spaghetti Bolognese
  • Mi 5.8. 🍜 Wildlachs-Bowl
  • Fr 7.8. 🌮 Chicken Tacos

1 bereits vorhanden (uebersprungen):
  • Do 6.8. 🍛 Haehnchen-Tikka
```

## 10. Modul-Struktur

Neuer Ordner `src/calendar/`:

- **`src/calendar/export-json.js`** — reine Payload-Erzeugung, keine DOM/Clipboard-Bindings. Testbar per Node-Sim.
  - Import: `state`, `dishesById`, `ingredientRegistry`, `totalFactorForDish`, `formatQuantity`
  - Export: `buildExportPayload(state): { exportedAt, timezone, meals }`
- **`src/calendar/clipboard.js`** — duenner Wrapper um `navigator.clipboard.writeText` mit Fallback auf `@capacitor/clipboard` bei Fehler.

**Aenderungen an bestehenden Files:**

- **`src/settings/rezepte-section.js`** — neue Zeile „Rezepte exportieren" mit Sub-Label + Handler. Handler ruft `buildExportPayload` + Clipboard-Wrapper + Toast.
- **`src/state.js`** — keine Aenderung (keine neue Persistenz noetig).

## 11. Cuisine → Icon Mapping (Claude-seitig, dokumentiert)

Nicht im App-Code — Claude nutzt es beim Insert. In diesem Doc dokumentiert fuer Transparenz und v2-Migration.

**Tatsaechliche `cuisineGroup`-Werte in `src/data/dishes.json` (Stand 2026-08-01, verifiziert im Browser-Test):**

| `cuisineGroup` | Emoji | Notizen                                              |
| -------------- | ----- | ---------------------------------------------------- |
| `asian`        | 🍜    | Nudeln als Sammelsymbol (Asiatisch, Indisch, ...)    |
| `mediterranean`| 🥗    | Salat / Bowl-Symbolik (Mediterran, Deutsch-Balkan)   |
| `middleEast`   | 🥙    | Pita / Kebab (Tuerkisch, Nahost)                     |
| `americas`     | 🌮    | Taco als generisches Symbol (Mexikanisch, Argentinisch, US) |
| (fehlt/unbekannt) | 🍽 | Fallback fuer neue Gruppen ohne Mapping             |

Bei kuenftigen neuen Gruppen die Liste hier ergaenzen und `grep '"cuisineGroup"' src/data/dishes.json | sort -u` als Sanity-Check verwenden.

## 12. MVP-Scope

**Drin:**

- Zeile „Rezepte exportieren" in Settings → Rezepte
- JSON-Payload wie in §4 spezifiziert
- Zwischenablage via `navigator.clipboard` mit `@capacitor/clipboard` Fallback
- Disabled-State + Hint wenn nichts markiert
- Toast nach erfolgreichem Kopieren

**Bewusst NICHT im MVP:**

- Direct-Insert via In-App Google-Calendar-Integration (OAuth) — bei Bedarf spaetere v2
- App-Deep-Link im Body
- Makros im Body
- Einstellbare Abendessens-Zeit (Setting)
- Einstellbare Reminder / VALARM
- `.ics`-Share-Pfad aus Vorgaengerdoc
- Cuisine-Emoji-Anzeige in der App-UI (nur im Kalender-Titel)
- Rezept-Update-Sync (wenn Rezept in App geaendert → Kalender nicht automatisch mit)

## 13. Guardrails-Check

- **UI-Strings deutsch** ✓ („Rezepte exportieren", Toast, Hints)
- **State-Storage-Key unveraendert** ✓ (keine neue Persistenz)
- **Zutaten-Wiederverwendung** N/A (keine neuen Zutaten)
- **Package-ID unveraendert** ✓
- **Nach Aenderungen syncen** ✓ (`npm run build` + `npx cap sync` nach Feature-Fertigstellung)
- **Kein Framework-Umbau** ✓ (Vanilla-Module, wie Rest der App)
- **Touch-Target ≥ 48 px** ✓ (Settings-Row-Pattern erfuellt das ohnehin)

## 14. Aufwand-Schaetzung

Kleine Session, weil kein OAuth, kein neues Plugin (Fallback nur bei Bedarf):

1. `src/calendar/export-json.js` inkl. Node-Sim gegen ein paar Sample-States (~45 min)
2. `src/calendar/clipboard.js` mit Fallback-Pfad (~20 min)
3. Settings-Zeile in `rezepte-section.js` + Handler + Disabled-State + Toast (~40 min)
4. Manuelles Testen im Browser (`npm run dev`) und auf dem Handy nach Sync (~30 min)
5. Feinschliff, Edge-Cases (leere Auswahl, Ingredient ohne Registry-Meta) (~20 min)

**Gesamt:** ca. 2–3 Stunden konzentriert, machbar in einer kleinen Session.

## 15. Offene Punkte (fuer v2, nicht MVP-blocking)

- Direct-Insert via In-App OAuth (siehe Weg B aus dem Brainstorm-Chat)
- Setting fuer Abendessens-Zeit + Reminder-Zeit
- Makros im Body
- Deep-Link zurueck in die App
- Zeitraum-Picker („diese Woche" vs. „naechste Woche") — solange die Regel „naechster Sonntag = Endpunkt" reicht, unnoetig
