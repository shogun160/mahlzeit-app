# Beitragen — Rezepte

Neue Rezepte sind willkommen. Zwei Wege:

## Mit Git (Pull Request)

1. **Fork** und einen Branch von `main` erstellen.
2. **Rezept** in `src/data/dishes.json` ergänzen (Schema-Referenz: [`docs/recipe-schema.md`](docs/recipe-schema.md)).
3. **Bild** als `public/dishes/dish-<neue-id>.jpg` beilegen (Prompt: [`docs/recipe-image-prompt.md`](docs/recipe-image-prompt.md)).
4. **Neue Zutaten** in `src/data/ingredients.json` ergänzen, falls das Rezept welche einführt. Vorher **immer** im [`docs/zutaten-katalog.md`](docs/zutaten-katalog.md) nachschauen ob eine bestehende Zutat wiederverwendet werden kann (Guardrail 8). Auch verwandte Formen prüfen (z. B. „Petersilie" vs. „Petersilie glatt"). Nach dem Ergänzen den Katalog regenerieren: `node scripts/zutaten-katalog.js`.
5. **PR gegen `main`** öffnen.

Beim Öffnen des PRs läuft die [`pr-recipe-check`-Action](.github/workflows/pr-recipe-check.yml) automatisch. Bei rotem Check: die Kommentare der Action anschauen und die genannten Punkte fixen.

Nach Merge landet das Rezept beim nächsten Repo-Update-Check der App bei allen Usern (dauert bis zu 24h automatisch, oder sofort per Settings > Rezepte > „Nach neuen Rezepten suchen").

## Ohne Git (Issue-Formular)

Issues → **New Issue → „Rezept-Vorschlag"** → Formular ausfüllen. Ich übernehme die Rezepte manuell in die Datenbank.

## Bild-Standard

- 1:1 (Quadrat), 800×800 px, JPEG, ≤ 400 kB
- Foodblog-Stil (natürliches Licht, heller Hintergrund, dezente Props)
- Prompt-Rahmen unter [`docs/recipe-image-prompt.md`](docs/recipe-image-prompt.md)

## Rechtliches

Rezepte und Bilder gehen mit dem PR ins Repo — bitte nur Inhalte einreichen, die du selbst besitzt oder freigegeben sind. Das Projekt ist ein privates Hobby-Projekt ohne Lizenz.
