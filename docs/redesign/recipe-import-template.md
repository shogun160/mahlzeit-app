> ⚠️ **Verworfen** — dieses Template war für den File-Picker-Import-Ansatz gedacht (siehe [`backlog.md`](backlog.md) → „Rezept-Import (File-Picker) — verworfen").
>
> Für aktuelle Contribution:
> - Schema-Referenz: [`docs/recipe-schema.md`](../recipe-schema.md)
> - Bild-Prompt: [`docs/recipe-image-prompt.md`](../recipe-image-prompt.md)
> - Contribution-Guide: [`CONTRIBUTING.md`](../../CONTRIBUTING.md)

---

# Rezept-Import-Template

Vorlage für die im Backlog geplante Rezept-Import-Funktion (siehe [`backlog.md`](backlog.md#rezept-import)). Zwei Bausteine:

1. **JSON-Template** — das eigentliche Rezept-Format
2. **Bildgenerierungs-Prompt** — für ChatGPT/Midjourney/etc., damit das Bild zum bestehenden Foodblog-Stil passt

---

## 1. JSON-Template

Datei-Vorschlag: `<rezeptname>.mahlzeit.json`

```json
{
  "name": "Rezeptname (Pflicht)",
  "cuisine": "Küche (Pflicht, z. B. \"Italienisch\", \"Thai\", \"Mediterran\")",
  "cuisineGroup": "mediterranean",
  "cooktime": 30,
  "kcal": 600,
  "p": 40,
  "kh": 55,
  "f": 20,
  "tags": [
    "contains-meat",
    "contains-gluten"
  ],
  "ingredients": [
    {
      "key": "haehnchenbrust",
      "grams": 180
    },
    {
      "key": "reis_basmati",
      "grams": 80,
      "note": "trocken abwiegen"
    }
  ],
  "steps": [
    "Schritt 1: kurz und präzise, mit Zeit- und Temperaturangaben wo sinnvoll.",
    "Schritt 2: einheitlich „Min." (nicht „min"), Zeitspannen mit Halbgeviert „–" (nicht „-").",
    "Schritt 3: Du-Ansprache, aktive Form."
  ],
  "image": "./mein-rezept.jpg",

  "newIngredients": {
    "beispiel_neue_zutat": {
      "label": "Beispiel-Zutat",
      "cat": "frisch",
      "unit": "g",
      "per100g": {
        "kcal": 42,
        "p": 3.5,
        "kh": 6.2,
        "f": 0.8
      }
    }
  }
}
```

### Feld-Referenz

| Feld | Typ | Pflicht | Erklärung |
|------|-----|---------|-----------|
| `name` | String | ✓ | Rezept-Titel, wie er in der App erscheint. |
| `cuisine` | String | ✓ | Küche als Klartext (z. B. „Italienisch"). Wird als Filter-Chip angezeigt. |
| `cuisineGroup` | Enum | ✓ | Einer von: `mediterranean`, `asian`, `indian`, `middleEast`, `americas`, `european`, `german`. Steuert die Küchen-Filter-Gruppierung. |
| `cooktime` | Number | ✓ | Kochzeit in Minuten (inkl. Vorbereitung). |
| `kcal` | Number | ✓ | Kalorien pro Portion (nicht pro 100 g). |
| `p` | Number | ✓ | Protein in Gramm pro Portion. |
| `kh` | Number | ✓ | Kohlenhydrate in Gramm pro Portion. |
| `f` | Number | ✓ | Fett in Gramm pro Portion. |
| `tags` | String[] | ✓ | Attribute für Filter und Warnhinweise. Bekannte Tags: `contains-meat`, `contains-fish`, `contains-lactose`, `contains-gluten`, `vegetarian`, `vegan`, `low-carb`, `high-protein`, `quick` (< 20 min), `few-ingredients` (≤ 7). Unbekannte Tags werden akzeptiert, wirken aber nicht auf Filter. |
| `ingredients` | Array | ✓ | Jede Zutat: `{ key, grams, note? }`. `key` muss in `src/data/ingredients.json` existieren ODER unter `newIngredients` deklariert sein. |
| `ingredients[].note` | String | – | Optionaler Zusatz, z. B. „TK-Packung à 400 g" oder „trocken abwiegen". |
| `steps` | String[] | ✓ | Zubereitungs-Schritte, Reihenfolge = Ausführungsreihenfolge. |
| `image` | String | ✓ | Relative Pfad-Referenz zur Bild-Datei, die zusammen mit dem JSON importiert wird. |
| `newIngredients` | Objekt | – | Nur nötig wenn das Rezept Zutaten enthält, die noch nicht in `ingredients.json` existieren. Struktur pro Eintrag siehe unten. |

### Struktur `newIngredients[key]`

| Feld | Typ | Pflicht | Erklärung |
|------|-----|---------|-----------|
| `label` | String | ✓ | User-sichtbarer Name, deutsch. Konvention: Substantiv im Singular („Karotte"), Attribute mit Komma („Chili, frisch"). |
| `cat` | Enum | ✓ | Kategorie für Einkaufslisten-Sortierung. Werte: `frisch`, `kuehlung`, `tk`, `trocken`, `konserve`, `gewuerze`, `bakery`, `getraenke`, `sonstiges`. |
| `unit` | Enum | ✓ | Basis-Einheit für Kalkulation: `g`, `ml`, `stueck`, `bund`. |
| `per100g` | Objekt | ✓ | Nährwerte pro 100 g / 100 ml / pro Stück (je nach `unit`): `{ kcal, p, kh, f }`. |
| `displayUnit` | String | – | Anzeige-Einheit wenn abweichend von `unit`, z. B. `el`, `tl`, `prise`. |
| `gramsPerUnit` | Number | – | Umrechnungsfaktor bei `displayUnit`: wie viele Gramm entsprechen einer Anzeige-Einheit (z. B. 1 EL Öl = 10 g). |
| `size` | Number | – | Durchschnittliche Größe pro Stück in Gramm bei `unit: "stueck"` (z. B. Chili ~ 6 g). |
| `note` | String | – | Zusatzinfo, die in der Einkaufsliste erscheint (z. B. „Becher à 500 g"). |

### Wichtige Konventionen

- **Zutaten-Wiederverwendung (Guardrail 8):** Vor dem Anlegen einer Zutat unter `newIngredients` prüfen, ob sie unter leicht anderem Namen bereits in `src/data/ingredients.json` existiert. Beispiel: schreib nicht `paprika_rot` an, wenn `paprika` (rote Paprika) schon da ist. Der Import warnt bei potenziellen Duplikaten.
- **Steps-Sprachstil:** Du-Ansprache, aktive Form, einheitlich „Min." (nicht „min"), Zeitspannen mit Halbgeviert „–" (Alt-Bindestrich), keine Anglizismen („vollenden" statt „finishen", „pfannenrühren" statt „stir-fry").
- **Portionen:** Nährwerte sind pro Portion, nicht pro 100 g. Als Referenz: 1 Portion = Standard-Kochmenge für 1 Person (typisch 500–900 kcal).

---

## 2. Bildgenerierungs-Prompt

Damit importierte Rezepte visuell zur bestehenden Bibliothek (32 Foodblog-Style-Bilder) passen, folgt der Prompt dem gleichen Aufbau wie in [`docs/Bilder-Prompts.md`](../Bilder-Prompts.md).

### Template zum Ausfüllen

```
Appetizing food photography of a [DISH NAME IN ENGLISH], [MAIN INGREDIENTS AND PREPARATION IN ENGLISH — e.g. "seared chicken breast, fluffy basmati rice, sautéed spinach"], garnished with [OPTIONAL GARNISH — e.g. "fresh parsley and a lemon wedge"], in a [CONTAINER — e.g. "shallow ceramic bowl" / "cast iron pan" / "wooden board"]. low three-quarter camera angle at approximately 30 degrees above horizontal — camera placed just above table height and tilted only slightly downward toward the front of the plate, the plate rim clearly visible as a pronounced elongated ellipse, food primarily seen from the side showing full vertical depth and layering of ingredients, only a small portion of the top surface visible — classic food-blog hero shot perspective (NOT top-down, NOT overhead, NOT bird's-eye, NOT flat lay), soft natural daylight, bright neutral background with light marble or light wood texture. Subtle props at the edges including a folded linen napkin and minimalist cutlery. Natural rich colors, subtle styling, clean food blog aesthetic, highly detailed --no top-down, overhead, flat lay, bird's eye view --ar 1:1
```

### Was du selbst ausfüllst

Nur die drei markierten Platzhalter — der Rest ist **immer identisch**, damit die Bilder als einheitliche Reihe wirken:

1. **`[DISH NAME IN ENGLISH]`** — englischer Rezeptname im Titel-Format, z. B. „chicken skyr tikka masala", „shrimp zucchini pasta".
2. **`[MAIN INGREDIENTS AND PREPARATION IN ENGLISH]`** — sichtbare Zutaten mit Zubereitungszustand. Verben wie `seared`, `roasted`, `grilled`, `steamed`, `sautéed`, `julienned`, `sprinkled with`, `drizzled with`, `crumbled`, `wilted`.
3. **`[CONTAINER]`** — passendes Gefäß:
   - Bowls: `light ceramic bowl`, `shallow ceramic bowl`, `deep pasta bowl`
   - Teller: `wide ceramic plate`, `rustic ceramic plate`
   - Pfanne: `cast iron pan`, `paella pan`
   - Brett: `wooden board`, `slate board`

### Beispiel (Referenz aus dem bestehenden Katalog)

```
Appetizing food photography of a wild salmon bowl, seared wild salmon fillet, black rice, edamame beans, julienned carrots, thin cucumber slices, sprinkled with sesame seeds and sliced green spring onions, neatly arranged in a light ceramic bowl. [Stil-Rahmen unverändert wie oben]
```

### Ausgabe-Format

- **Ratio:** 1:1 (Quadrat, damit in der Dashboard-Card sauber passt)
- **Auflösung:** empfohlen ≥ 1024×1024
- **Format:** JPG (kleiner als PNG bei vergleichbarer Qualität, App-optimiert)
- **Dateiname:** frei wählbar, wird beim Import automatisch in `dish-<neue-id>.jpg` umbenannt

---

## Import-Ablauf (aus User-Sicht, wenn Feature umgesetzt ist)

1. Rezept-JSON nach Template ausfüllen
2. Bild mit Prompt-Vorlage generieren und als JPG speichern
3. In der App: Settings → Daten → „Rezept importieren"
4. JSON + Bild auswählen
5. Bei Validierungsfehler: konkrete Fehlermeldung mit Zeilenangabe oder unbekannten Zutaten-Keys
6. Bei Erfolg: Bestätigung („Rezept 'X' importiert"), Rezept erscheint in Dish-Picker mit Custom-Badge
