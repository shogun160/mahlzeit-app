# Feature-Backlog

Vorgemerkte Features & Konzepte, die nicht sofort umgesetzt werden. Reihenfolge ist keine Priorisierung — jeder Eintrag steht für sich.

---

## Gerichte-Import

**Ziel:** User kann eigene Rezepte hinzufügen, ohne dishes.json manuell zu editieren.

**UI-Vorschlag:**
- Neuer Abschnitt im **Settings-Sheet** ("Meine Gerichte" oder "Rezepte verwalten")
- Buttons:
  - **Neues Gericht anlegen** → Formular oder JSON-Paste
  - **JSON importieren** → Multi-Dish-Batch aus Datei/Text
  - **Vorhandene bearbeiten** → Liste mit Edit/Delete
  - **Alle exportieren** → JSON zum Backup / Teilen

**JSON-Template für ein einzelnes Gericht:**

```json
{
  "id": 18,
  "name": "Beispielgericht",
  "cuisine": "Italienisch-mediterran",
  "cooktime": 30,
  "kcal": 650,
  "p": 42,
  "kh": 55,
  "f": 22,
  "steps": [
    "Schritt 1 als kurzer, imperativer Satz.",
    "Schritt 2 …",
    "Schritt 3 …"
  ],
  "ingredients": [
    {
      "key": "haehnchenbrust",
      "label": "Hähnchenbrust",
      "grams": 200,
      "kcal": 220,
      "p": 46,
      "kh": 0,
      "f": 4,
      "cat": "fleisch_fisch",
      "unit": "g",
      "size": null,
      "note": null
    }
  ]
}
```

**Feld-Semantik (aus dem bestehenden Datensatz abgeleitet):**
- `id` — number, muss über alle Gerichte unique sein. Auto-Increment beim Import.
- `cuisine` — freier Text, z. B. "Italienisch-mediterran", "Asiatisch-Fusion", "Indisch-vegetarisch". Wird auf Card als Meta-Tag angezeigt.
- `cooktime` — Minuten, integer. Wird vom Kochzeit-Filter in Settings genutzt.
- `kcal / p / kh / f` — Gesamtwerte pro Portion (nicht pro Zutat aufaddiert; werden separat gepflegt weil Rundung/Zubereitungsverlust).
- `steps` — Array<string>, 5–8 Schritte typisch, imperativ formuliert.
- `ingredients[].key` — snake_case String, referenziert `meta`-Tabelle. Neue Zutaten müssen dort ergänzt werden (label, category, unit, size, note).
- `ingredients[].cat` — muss zu `CAT_ORDER` in shopping-list/categories.js passen: `fleisch_fisch`, `frisch`, `kuehlung`, `trocken`, `gewuerze`, `oel`, `sonstig`.
- `ingredients[].unit` — `g`, `stueck`, `bund`, `zehe`, `ei`, `vorrat`. Bestimmt Anzeige-Format in Einkaufsliste (siehe util/format.js).
- `size` — bei stück-Einheiten die Referenz-Größe pro Stück in g (für's Runden auf ganze Stück).

**Bild-Anforderungen:**
- Ablage: `public/dishes/dish-{id}.jpg`
- Auflösung: mindestens 640×640 px (Cards rendern es auf ~340 px hoch mit `object-fit: cover`)
- Format: JPEG, max ~200 KB (Ladezeit auf Mobil)
- Aspect: quadratisch bis 4:3 empfohlen — Card-Bereich ist ~600×180

**AI-Prompt für konsistenten Bildstil:**

Der bestehende Bildstil ist Overhead-Food-Photography mit natürlichem Licht auf hellem Holz. Für neue Gerichte diesen Prompt (oder eine Anpassung) verwenden:

```
Overhead food photography of {DISH DESCRIPTION}, served in a rustic
speckled ceramic bowl on a light wooden tabletop. Soft natural window
light from the upper left, gentle shadows. A folded beige linen napkin
with a silver fork and knife lies to the left of the bowl. Composition
is clean and minimal — bowl slightly off-center, ample negative space
on the wood surface. Colors are natural and appetizing, no oversaturation.
Shot from directly above (~90° angle), shallow depth of field on the
food itself. Photorealistic, magazine-quality, no text or graphics.
Square 1:1 aspect ratio.
```

**Platzhalter `{DISH DESCRIPTION}` konkret formulieren**, z. B.:
- *"a bowl of black rice with a seared salmon fillet, edamame, cucumber slices, julienned carrots, sesame seeds and spring onions"*
- *"a bowl of red lentil dal topped with two sunny-side-up eggs, fresh spinach leaves, a dollop of yogurt, and chili flakes"*

**Wichtig für Konsistenz:**
- Immer Overhead-Perspektive
- Immer die gleichen Props (Serviette + Besteck links, Holzbrett)
- Immer natürliches Licht (nicht Studio-Blitz)
- Keine Marken-Elemente, kein Text
- Keine Hände im Bild
- Bowl statt Teller wo möglich (matches bestehender Look)

**Tools zum Generieren:**
- Midjourney (aktuell konsistenteste Food-Photography)
- DALL-E 3 (ok, aber öfter stylistische Ausreißer)
- Google Imagen (via Gemini)
- Stable Diffusion mit Food-LoRA (lokal, aber mehr Prompt-Engineering)

**Nach dem Generieren:**
- Bild auf 640×640 croppen falls nicht quadratisch
- Als JPEG mit ~80 % Qualität speichern
- Nach `public/dishes/dish-{id}.jpg` legen
- `npm run build && npx cap sync`

---

## Dark Mode

**Umsetzung:** CSS Media Query `@media (prefers-color-scheme: dark)` in tokens.css, alle `--md-sys-color-*` mit Dark-Varianten. Manual-Override im Settings-Sheet (Auto / Hell / Dunkel), gespeichert in `state.settings.theme`.

Aktuell im Settings-Sheet als Placeholder vorhanden ("Kommt bald").

## Akzentfarbe aus Android auslesen

**Material You (dynamic color)** ist Android 12+. Für WebView (Capacitor) braucht es ein Native-Plugin, das `WallpaperManager.getWallpaperColors()` abfragt und als CSS-Variable durchreicht.

**Optionen:**
1. Community-Plugin `capacitor-android-dynamic-color` verwenden (Wartungslage prüfen)
2. Eigenes Micro-Plugin (~30 Zeilen Kotlin) schreiben
3. Nur manueller Farbwähler in Settings (5–6 Presets)

Empfehlung: Manuel als robuste Basis, Dynamic Color als "Auto"-Option optional.

---

## Ernährungspräferenzen (Reroll-Filter)

Checkboxen im Settings-Sheet: Vegetarisch, Vegan, Kein Fisch, Kein Fleisch, Laktosefrei, Glutenfrei. Reroll filtert Gerichte entsprechend.

**Metadaten:** dishes.json müsste um `tags: ["vegetarian", "contains-fish", ...]` pro Dish erweitert werden — aktuelle Struktur hat das nicht.

## Küchen-Präferenzen (Reroll-Gewichtung)

User wählt bevorzugte Küchen (Italienisch, Asiatisch, …). Diese bekommen doppelte Reroll-Wahrscheinlichkeit. Keine harten Filter — vermeidet Monotonie.

## Profil + Tageskalorien-Berechnung

Alter, Größe, Gewicht, Geschlecht, Aktivitätslevel → Mifflin-St Jeor → BMR × PAL = Tageskalorien.

Ziel-Modus (Halten / Abnehmen / Aufbauen) mit ±500 kcal Standard-Adjustment.

Makro-Verteilung: Standard 30/40/30 (P/KH/F) oder Custom Slider (Summe = 100 %).

**Anzeige:** irgendwo Ziel-vs-Ist Wochensumme — z. B. im Settings-Header oder als Overlay auf dem Dashboard.

## Reroll-Cooldown

"Wiederhole ein Gericht frühestens nach X Tagen." Verhindert dass gleiche Gerichte in einer Woche mehrfach auftauchen. Default: 7 Tage (unmöglich in einer Woche zweimal), User kann auf 3–14 stellen.

## Datenverwaltung

Export/Import des kompletten State als JSON. Backup ohne Cloud, Transfer zwischen Geräten. Separater "Alle Daten löschen"-Button mit Bestätigung.
