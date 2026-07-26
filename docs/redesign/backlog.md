# Mahlzeit-App — Ideen-Backlog

Ideen, die nicht direkt in einer Iteration umgesetzt werden, aber nicht verloren gehen sollen. Reihenfolge = grobe Priorität, nicht bindend.

## Ersteinrichtung / Onboarding

**Idee:** Beim ersten App-Start (oder wenn Profil noch nicht ausgefüllt) einen geführten Ablauf zeigen, der den User Schritt-für-Schritt durch die Kern-Setup-Werte führt. Zwei Varianten denkbar:

- **First-Run-Wizard:** modaler Flow mit Steps (Geschlecht → Alter → Größe → Gewicht → Aktivität → Ziel → Fertig). Am Ende ist Profil vollständig, Bedarfs-Pille sichtbar.
- **On-Screen-Anleitung:** dezente Hinweise ("Klicke hier für dein Profil") die auf die Settings-Section zeigen, ohne die App zu blockieren.

**Warum später:** Erst müssen die manuellen Einstellungen alle sauber funktionieren (Iteration 4 abgeschlossen). Onboarding ist Politur, kein Kern-Feature.

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

## Multi-Profile

**Idee:** Mehrere Nutzer-Profile hinterlegen (z. B. für Partner:in, Kinder). Beim Planen einer Woche wählt man, wer isst — die Rezept-Skalierung berücksichtigt die individuellen Ziele.

**Warum später:** Große State-Erweiterung (Profil-Liste statt Single-Profile), pro-Tag/Person-Assignment nötig. Erst Solo-Case sauber implementieren, dann Multi.

**Auslöser:** Aus Session 10 (Iteration 4/5 — Profil + Rezept-Skalierung). User bekocht meist allein, aber die Semantik "userScale wirkt auf gesamte Kochmenge" bricht sobald mehrere Personen unterschiedliche Ziele haben.

**Skizze für später:**
- `state.settings.profiles: [{ id, name, ...profileFields }]`
- `state.assignment[day].dishId` bleibt, dazu `state.assignment[day].diners: [profileId]`
- Rezept-Skalierung: Faktor pro Person, dann Aggregat für Einkaufsliste
- Wochen-Bar: eine pro aktivem Profil oder Umschalter
