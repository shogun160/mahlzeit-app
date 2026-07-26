# Session 18 Implementation Plan — Multi-Profile

> **Branch:** `multiuser` (bereits angelegt, gepusht, mit Beta-Config `com.mahlzeit.myapp.beta` / „Mahlzeit Beta"). Nicht auf `main` oder `beta` arbeiten.

> **Merge-Flow:** `multiuser` → wenn Feature ready → `beta` → Beta-APK testen → `main` → Stable-APK.

**Goal:** Aus dem bisherigen Single-User-Profil ein Multi-Profile-System machen, das im Onboarding und in den Einstellungen bedient wird und beim Kochen für 2+ Personen die individuellen Kalorien-/Makro-Ziele je Diner berücksichtigt.

---

## Pflichtlektüre (in dieser Reihenfolge)

1. **`CLAUDE.md`** — Guardrails (v2-Storage-Key bleibt, keine Frameworks, Zutaten-Wiederverwendung)
2. **`docs/redesign/backlog.md` → Sektion „Multi-Profile"** — vollständiges Design-Doc (UX-Konzept, Portion-Semantik, Default-User mit DGE-Referenz, State-Skizze, Migration)
3. **`docs/redesign/handoffs/session-17-to-18.md`** — Zustand am Ende von Session 17
4. **`src/state.js`** — aktueller Profile-Slot, um zu wissen was migriert werden muss
5. **`src/onboarding/wizard.js` + `src/onboarding/steps.js`** — Wizard-Struktur, in die der Follow-up-Screen eingehängt wird
6. **`src/settings/render.js`** — Settings-Sheet-Struktur, in die die Profil-Liste kommt

---

## Aktueller Repo-Zustand (Startpunkt)

- **Branch:** `multiuser` (auf `origin/multiuser`)
- **Working Tree:** sauber (außer `.claude/` untracked)
- **Letzte Commits auf multiuser:**
  - `4cc940d chore(config): beta-suffix + beta-name auf multiuser`
  - `0d7dc00 docs(backlog): multi-profile konzept ausgebaut`
  - `5a94bad docs(backlog): rezept-import + template mit bild-prompt`
- **Config:** App-ID `com.mahlzeit.myapp.beta`, App-Name „Mahlzeit Beta" — Beta läuft parallel zur Stable auf dem Handy.

---

## Architektur

- **State:** `state.settings.profile: Profile` → `state.settings.profiles: Profile[]` + `state.settings.activeProfileId: string`. Migration im `loadState()`-Fallback, kein Storage-Key-Wechsel (Guardrail 2).
- **Default-User als Konstante:** `src/nutrition/defaults.js` exportiert `DEFAULT_USER` mit den DGE-basierten Werten aus dem Backlog (2200 kcal, 30/40/30 Makros, 550/770/880 Mahlzeiten). Wenn `portions > profiles.length`, wird der Rest mit dieser Konstante aufgefüllt.
- **Portion-Semantik:** `dinersForPortion(portions, profiles)` in `src/nutrition/diners.js` — nimmt erste N Profile, füllt Rest mit `DEFAULT_USER`. Alle Kochmengen-Aggregate (Einkaufsliste, Detail-Sheet-Nährwerte) laufen über diese Funktion.
- **UI-Bindung:** Bedarfs-Pille + Nährwert-Balken beziehen sich weiter auf **den aktiven User** (`profiles[activeProfileId]`). Multi-User verändert die Kochmenge, nicht die persönliche Bedarfs-Anzeige.

**Tech Stack:** unverändert. Vanilla JS + Vite + Capacitor. Keine neuen Packages.

---

## Empfohlene Etappen (je eine Session oder in einem Rutsch)

Große Fläche — je Etappe ein Commit-Endpunkt, an dem man pausieren kann.

### Etappe 1 — State-Refactor + Migration + DEFAULT_USER (Fundament)

- [ ] `src/nutrition/defaults.js` anlegen mit `DEFAULT_USER`-Konstante (Werte aus `backlog.md#default-user`). Kommentar mit DGE-Verweis und Hinweis „beim Bauen final gegen aktuelle DGE-Quelle prüfen".
- [ ] `src/state.js`:
  - Neues Schema: `settings.profiles: Profile[]` + `settings.activeProfileId: string`
  - Migration im `loadState()`: alter `settings.profile` → `profiles[0]` mit `id: "u1"`, `activeProfileId: "u1"`. Löscht den alten Slot nicht sofort (Fallback für Rollback), setzt Feature-Flag `_migratedToProfiles: true`.
  - Helper: `getActiveProfile()`, `getProfileById(id)`, `addProfile(profile)`, `removeProfile(id)` (User 1 nicht löschbar), `updateProfile(id, patch)`.
- [ ] `src/nutrition/diners.js` anlegen mit `dinersForPortion(portions, profiles)`.
- [ ] **Alle Callsites von `settings.profile` durchgehen** — grep durch `src/**`. Ersetzen durch `getActiveProfile()`. Betrifft: Dashboard-Bedarfs-Pille, Nährwert-Balken, Onboarding-Ergebnis-Screen, Settings-Sheet-Rows, Detail-Sheet-Nährwerte, Shopping-Personal-Copy.
- [ ] Manueller Test im Browser: bestehende v2-State-Datei laden → Profil-Werte sind da, App verhält sich identisch. Neu einrichten → nur ein Profil (`u1`), Verhalten identisch.
- **Commit:** `refactor(state): profile -> profiles[] mit default-user und diner-formel`

### Etappe 2 — Onboarding-Follow-up (Wizard für User 2..N)

- [ ] Nach dem letzten Wizard-Step neuen Screen einhängen: **wenn `draft.defaultPortions > 1`** → Frage „Du kochst für N Personen. Willst du Profile für die anderen anlegen?" mit Buttons „Ja, jetzt" / „Später".
- [ ] „Ja" → Wizard-Zustand zurücksetzen, aber Progress-Pille „Person 2 von N" oben einblenden, Steps 1–4 nochmal. Am Ende: neues Profil in `profiles[]` anhängen, Follow-up-Frage wiederholen bis `profiles.length === defaultPortions` oder User „Später" wählt.
- [ ] „Später" → normal beenden.
- [ ] Manueller Test: Wizard mit 3 Personen → nach Wizard-1 kommt Follow-up → Ja → Wizard-2 mit „Person 2 von 3" → am Ende Follow-up für User 3 → Ja/Nein.
- **Commit:** `feat(onboarding): follow-up fuer weitere profile wenn portions > 1`

### Etappe 3 — Settings-Profil-Liste + Profil-Detail-Sheet

- [ ] Settings-Section „Profil" → umbenennen zu **„Profile"**. Statt der Single-Row eine Liste rendern:
  - Pro Profil eine Zeile: Name + Meta („28 J., 175 cm, Halten") + Chevron.
  - Klick öffnet Profil-Detail-Sheet (neu, analog Dish-Detail-Sheet).
  - Am Listenende: primärer Button „+ Profil hinzufügen" → öffnet Wizard-Sequenz für neuen User (ohne Follow-up-Fragen zwischendrin).
- [ ] Profil-Detail-Sheet: alle Wizard-Felder editierbar. Ganz unten „Profil löschen"-Button, **deaktiviert für `profiles[0]`** (Mindestens-ein-Profil-Regel).
- [ ] Aktives Profil wechseln: neben Name eine kleine Radio-Pille „Aktiv" — Klick setzt `activeProfileId`. Genau ein Profil ist immer aktiv, Bedarfs-Pille/Nährwert-Balken reagieren.
- **Commit:** `feat(settings): profil-liste + detail-sheet + add-button`

### Etappe 4 — Portion → Diners + Kochmengen-Aggregation

- [ ] Einkaufsliste (`src/shopping-list/build.js` oder wo aggregiert wird): pro Gericht × Tag den `portions`-Wert nehmen, `dinersForPortion()` auflösen, dann pro Diner den individuellen `scale = abendessenKcal / 900` (oder aktueller Referenzwert) anwenden. Aggregat = Σ Skalierungen × Rezept-Basismenge.
- [ ] Detail-Sheet-Nährwerte: wenn `portions > 1`, Nährwerte pro Diner als kleine Zeilen anzeigen („Du: 620 kcal · P 45 g · KH 68 g · F 18 g", darunter Partner, darunter Default-User falls Überzahl). Gesamt-Summe als fette Zeile darüber.
- [ ] Test: 2-Personen-Rezept auswählen → Einkaufsliste zeigt Summe der beiden Diner-Bedarfe. 5-Personen-Rezept bei 3 Profilen → 3 Profile + 2 Default-User in Aggregation.
- **Commit:** `feat(nutrition): kochmengen-aggregation ueber diners-formel`

### Etappe 5 — Feinschliff + Migration Edge Cases

- [ ] Wenn `activeProfileId` auf ein gelöschtes Profil zeigt: automatisch auf `profiles[0]` fallen zurück.
- [ ] Wenn `profiles` leer ist (Bug-State): DEFAULT_USER als Notfall-Profil einsetzen, Warnung ins DevTools-Log.
- [ ] Favoriten: `favorites` wandert in `profiles[i].favorites`. Migration: alte globale `settings.profile.favorites` → `profiles[0].favorites`. Andere Profile starten mit `{}`.
- [ ] UI-Polish: Sortierung Profile in Settings (Reihenfolge = Anlage-Reihenfolge, User 1 immer oben). Beim Löschen: kein Reindex der IDs (`id` bleibt stabil).
- **Commit:** `feat(profiles): edge cases + favoriten-migration + polish`

---

## Skill-Empfehlungen für Session 18

- **`superpowers:writing-plans`** falls die Etappen weiter aufgesplittet werden sollen (z. B. Etappe 3 in „Settings-List" + „Detail-Sheet" trennen).
- **`superpowers:brainstorming`** vor Etappe 3, falls die UX-Entscheidung „Nährwerte pro Person zeigen vs. Summe" noch offen ist — kurz verifizieren mit Mockup-Skizze.
- **`superpowers:test-driven-development`** ist im Projekt nicht Standard (Solo-Projekt, keine Tests), aber für die `dinersForPortion`-Funktion und die State-Migration könnte Node-Simulation sinnvoll sein.
- **`handoff`** am Session-Ende.

---

## Rote Flaggen für diese Session

- **Storage-Key ändern** (Guardrail 2): Migration MUSS im Fallback laufen, nicht durch Key-Wechsel. `mahlzeit-state-v2` bleibt.
- **Default-User-Zahlen** kritisch prüfen — die Werte im Backlog sind Vorschlag basierend auf DGE-Referenzwerten, sollten aber vor Merge in `beta` gegen aktuelle DGE-Quelle abgeglichen werden. Sonst kochen 5-Personen-Rezepte zu wenig oder zu viel für Gäste.
- **Kein User 1 löschen** — Guard im Detail-Sheet + State-Helper.
- **UI-Bindung an `settings.profile` vs. `getActiveProfile()`** — bei jedem Callsite prüfen, ob „aktiver User" oder „alle Diner" gemeint ist. Bedarfs-Pille = aktiver User. Einkaufsliste = alle Diner. Nährwert-Balken = aktiver User.

---

## Wiedereinstieg-Move

```bash
git checkout multiuser                              # falls nicht schon aktiv
git status                                          # sauber?
git log --oneline main..HEAD                        # was diverged
cat docs/redesign/backlog.md | sed -n '/^## Multi-Profile/,/^## /p'  # Design-Doc auffrischen
grep -rn "settings\.profile\b" src/ | head -30      # Callsites, die migriert werden muessen
```

Dann Etappe 1 (State-Refactor) starten.
