## Neues Rezept — Checkliste

- [ ] JSON in `src/data/dishes.json` ergänzt (Schema: [`docs/recipe-schema.md`](../docs/recipe-schema.md))
- [ ] Bild als `public/dishes/dish-<id>.jpg` beigelegt (800×800, ≤ 400 kB, JPEG)
- [ ] Neue Zutaten in `src/data/ingredients.json` ergänzt (falls nötig)
- [ ] Vor dem Anlegen geprüft, dass Zutaten nicht bereits unter anderem Key existieren
- [ ] Nährwerte plausibel (kcal ≈ p·4 + kh·4 + f·9, Toleranz ± 100)
- [ ] Bild-Prompt aus [`docs/recipe-image-prompt.md`](../docs/recipe-image-prompt.md) genutzt
- [ ] `npm run build` läuft lokal ohne Fehler
- [ ] PR gegen `main`-Branch

## Kurzbeschreibung
<!-- Was ist das für ein Rezept? Woher stammt es? -->
