# Rezept-Bild-Prompt

Alle Rezept-Bilder in der App folgen einem einheitlichen Foodblog-Stil (Vogelperspektive-nah, natürliches Licht, marmorner/heller Holzhintergrund, dezente Props). Damit Community-beigesteuerte Bilder sich einfügen, folgt der Prompt einem festen Rahmen — du füllst nur drei Platzhalter aus.

## Prompt-Rahmen (immer identisch)

```
Appetizing food photography of a [DISH NAME IN ENGLISH], [MAIN INGREDIENTS AND PREPARATION IN ENGLISH], garnished with [OPTIONAL GARNISH], in a [CONTAINER]. low three-quarter camera angle at approximately 30 degrees above horizontal — camera placed just above table height and tilted only slightly downward toward the front of the plate, the plate rim clearly visible as a pronounced elongated ellipse, food primarily seen from the side showing full vertical depth and layering of ingredients, only a small portion of the top surface visible — classic food-blog hero shot perspective (NOT top-down, NOT overhead, NOT bird's-eye, NOT flat lay), soft natural daylight, bright neutral background with light marble or light wood texture. Subtle props at the edges including a folded linen napkin and minimalist cutlery. Natural rich colors, subtle styling, clean food blog aesthetic, highly detailed --no top-down, overhead, flat lay, bird's eye view --ar 1:1
```

## Die drei Platzhalter

**`[DISH NAME IN ENGLISH]`** — englischer Rezeptname im Titel-Format.
Beispiele: „chicken skyr tikka masala", „shrimp zucchini pasta", „butter chicken with basmati rice".

**`[MAIN INGREDIENTS AND PREPARATION IN ENGLISH]`** — sichtbare Zutaten mit Zubereitungszustand.
Verben: `seared`, `roasted`, `grilled`, `steamed`, `sautéed`, `julienned`, `sprinkled with`, `drizzled with`, `crumbled`, `wilted`.
Beispiel: „seared chicken breast, fluffy basmati rice, sautéed spinach".

**`[CONTAINER]`** — passendes Gefäß:
- Bowls: `light ceramic bowl`, `shallow ceramic bowl`, `deep pasta bowl`
- Teller: `wide ceramic plate`, `rustic ceramic plate`
- Pfanne: `cast iron pan`, `paella pan`
- Brett: `wooden board`, `slate board`

## Beispiel (Referenz aus dem Katalog)

```
Appetizing food photography of a wild salmon bowl, seared wild salmon fillet, black rice, edamame beans, julienned carrots, thin cucumber slices, sprinkled with sesame seeds and sliced green spring onions, neatly arranged in a light ceramic bowl. [Stil-Rahmen unverändert wie oben]
```

## Ausgabe-Format

- **Ratio:** 1:1 (Quadrat)
- **Auflösung:** empfohlen ≥ 1024×1024, im PR auf 800×800 skalieren
- **Format:** JPEG (kleiner als PNG bei vergleichbarer Qualität)
- **Dateigröße:** ≤ 400 kB
- **Dateiname:** `dish-<id>.jpg` (`<id>` ist die neue Dish-ID)

## Modell-Hinweise

Der Prompt funktioniert mit **ChatGPT/DALL-E**, **Midjourney**, **Nano-Banana** und ähnlichen Diffusionsmodellen. Bei starken Abweichungen: die drei Platzhalter präziser fassen, den Rahmen nicht ändern.

Bei Midjourney: `--ar 1:1` und `--no top-down, overhead, flat lay, bird's eye view` sind schon enthalten.
