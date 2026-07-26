# Mahlzeit-App — Ideen-Backlog

Ideen, die nicht direkt in einer Iteration umgesetzt werden, aber nicht verloren gehen sollen. Reihenfolge = grobe Priorität, nicht bindend.

## Multi-Profile

**Idee:** Mehrere Nutzer-Profile hinterlegen (z. B. für Partner:in, Kinder). Beim Planen einer Woche wählt man, wer isst — die Rezept-Skalierung berücksichtigt die individuellen Ziele.

**Warum später:** Große State-Erweiterung (Profil-Liste statt Single-Profile), pro-Tag/Person-Assignment nötig. Erst Solo-Case sauber implementieren, dann Multi.

**Auslöser:** Aus Session 10 (Iteration 4/5 — Profil + Rezept-Skalierung). User bekocht meist allein, aber die Semantik "userScale wirkt auf gesamte Kochmenge" bricht sobald mehrere Personen unterschiedliche Ziele haben.

**Skizze für später:**
- `state.settings.profiles: [{ id, name, ...profileFields }]`
- `state.assignment[day].dishId` bleibt, dazu `state.assignment[day].diners: [profileId]`
- Rezept-Skalierung: Faktor pro Person, dann Aggregat für Einkaufsliste
- Wochen-Bar: eine pro aktivem Profil oder Umschalter
