# Rezept-Schema

Struktur eines Rezepts in [`src/data/dishes.json`](../src/data/dishes.json) und einer Zutat in [`src/data/ingredients.json`](../src/data/ingredients.json).

## Top-Level

Beide JSONs haben ein `schemaVersion: 1`-Feld direkt neben dem Daten-Array/Objekt. Muss zu den in der App eingebauten Konstanten passen. Bei Erhöhung: alle bestehenden Rezepte müssen zur neuen Version passen (Migrations-Layer im Code).

## Dish

| Feld | Typ | Pflicht | Erklärung |
|------|-----|---------|-----------|
| `id` | Number | ✓ | Eindeutig über alle Rezepte hinweg. Wird für Bild-Pfad, Assignment, Favoriten genutzt. Beim Anlegen: höchste bestehende ID + 1. |
| `name` | String | ✓ | Rezept-Titel wie in der App angezeigt. |
| `cuisine` | String | ✓ | Küche als Klartext (z. B. „Italienisch"). Wird als Filter-Chip angezeigt. |
| `cuisineGroup` | Enum | ✓ | Einer von: `mediterranean`, `asian`, `middleEast`, `americas`. Steuert die Küchen-Filter-Gruppierung. Erweiterung um `indian`, `european`, `german` etc. jederzeit möglich — dann muss die Konstante im Picker (`src/dish-picker/render.js`) und im Validator synchron erweitert werden. |
| `cooktime` | Number | ✓ | Kochzeit in Minuten (inkl. Vorbereitung). |
| `kcal` | Number | ✓ | Kalorien pro Portion (nicht pro 100 g). |
| `p` | Number | ✓ | Protein in Gramm pro Portion. |
| `kh` | Number | ✓ | Kohlenhydrate in Gramm pro Portion. |
| `f` | Number | ✓ | Fett in Gramm pro Portion. |
| `tags` | String[] | ✓ | Attribute für Filter und Warnhinweise. Bekannte Tags: `contains-meat`, `contains-fish`, `contains-lactose`, `contains-gluten`, `vegetarian`, `vegan`, `low-carb`, `high-protein`, `quick` (< 20 min), `few-ingredients` (≤ 7). Unbekannte Tags werden akzeptiert, wirken aber nicht auf Filter. |
| `ingredients` | Array | ✓ | Jede Zutat: `{ key, grams, note? }`. `key` muss in `src/data/ingredients.json` existieren. |
| `ingredients[].note` | String | – | Optionaler Zusatz, z. B. „TK-Packung à 400 g" oder „trocken abwiegen". |
| `steps` | String[] | ✓ | Zubereitungs-Schritte, Reihenfolge = Ausführungsreihenfolge. |
| `revision` | Number | – | **Zukunfts-Öffnung** — aktuell nicht ausgewertet. Kann in einer späteren App-Version genutzt werden, um Fixes an bereits ausgerollten Rezepten via Remote-Update zu erlauben. |

Das Bild liegt als eigenständige Datei unter `public/dishes/dish-<id>.jpg` (800×800, ≤ 400 kB, JPEG). Kein `image`-Feld im JSON.

## Ingredient

Struktur pro Eintrag in `ingredients.<key>`:

| Feld | Typ | Pflicht | Erklärung |
|------|-----|---------|-----------|
| `label` | String | ✓ | User-sichtbarer Name, deutsch. Konvention: Substantiv im Singular („Karotte"), Attribute mit Komma („Chili, frisch"). |
| `cat` | Enum | ✓ | Kategorie für Einkaufslisten-Sortierung. Werte: `frisch`, `kuehlung`, `tk`, `trocken`, `konserve`, `gewuerze`, `bakery`, `getraenke`, `sonstiges`. |
| `unit` | Enum | ✓ | Basis-Einheit: `g`, `ml`, `stueck`, `bund`. |
| `per100g` | Objekt | ✓ | Nährwerte pro 100 g / 100 ml / pro Stück: `{ kcal, p, kh, f }`. |
| `displayUnit` | String | – | Anzeige-Einheit wenn abweichend von `unit`, z. B. `el`, `tl`, `prise`. |
| `gramsPerUnit` | Number | – | Umrechnungsfaktor bei `displayUnit`: wie viele Gramm entsprechen einer Anzeige-Einheit (z. B. 1 EL Öl = 10 g). |
| `size` | Number | – | Durchschnittliche Größe pro Stück in Gramm bei `unit: "stueck"` (z. B. Chili ~ 6 g). |
| `note` | String | – | Zusatzinfo, die in der Einkaufsliste erscheint (z. B. „Becher à 500 g"). |

## Konventionen

- **Zutaten-Wiederverwendung (Guardrail 8):** Vor dem Anlegen einer Zutat immer prüfen, ob sie unter leicht anderem Namen bereits in `src/data/ingredients.json` existiert. Der Validator warnt bei 4-Zeichen-Prefix-Kollisionen, aber semantisch identische Namen (`aubergine` vs `eierpflanze`) müssen manuell erkannt werden.
- **Steps-Sprachstil:** Du-Ansprache, aktive Form, einheitlich „Min." (nicht „min"), Zeitspannen mit Halbgeviert „–" (Alt-Bindestrich), keine Anglizismen.
- **Portionen:** Nährwerte sind pro Portion, nicht pro 100 g. Eine Portion = Standard-Kochmenge für 1 Person (typisch 500–900 kcal).

## Validierung

Die GitHub Action [`pr-recipe-check.yml`](../.github/workflows/pr-recipe-check.yml) prüft PRs automatisch. Details unter [`CONTRIBUTING.md`](../CONTRIBUTING.md).
