# Handoff — Mahlzeit-App, Session 19

## Kontext in einem Satz

Session 18 hat das Multi-Profile-Feature komplett gebaut, in mehreren UX-Iterationen mit dem User geschliffen und als **Stable v1.1** nach `main` gemerged; parallel lebt `beta` weiter als `com.mahlzeit.myapp.beta` mit `v1.2-beta` fürs nächste Feature.

## Pflichtlektüre

1. **`CLAUDE.md`** — Guardrails (v2-Storage-Key, Vanilla JS + Vite + Capacitor, App-ID)
2. **`docs/redesign/2026-07-26-session-18-multi-profile-plan.md`** — der Plan der ausgeführt wurde
3. **`docs/redesign/backlog.md`** — offene Ideen (u.a. neuer Eintrag „Profil teilen / importieren")

## Aktueller Repo-Zustand

- **Branches** (alle drei gepusht):
  - `main` → `2b56b80` — Stable v1.1 (`com.mahlzeit.myapp`, „Mahlzeit")
  - `beta` → `848e793` — v1.2-beta (`com.mahlzeit.myapp.beta`, „Mahlzeit Beta")
  - `multiuser` → `d8bfa6d` — synchron zu beta, dient als Feature-Branch
- **Working tree** sauber (nur `.claude/` untracked)
- **APKs:**
  - Stable: `android/app/build/outputs/apk/debug/mahlzeit-1.1-stable.apk` (10 MB, debug-signed)
  - Beta (v1.1-beta) wurde während der Session installiert, v1.2-beta noch nicht gebaut
- **Version-Bumps in dieser Session:**
  - `main`: versionCode 2 / versionName „1.1"
  - `beta`: versionCode 3 / versionName „1.2-beta"

## Was Session 18 gebaut hat

### Etappen 1–5 (Multi-Profile)

Alles aus dem Plan durchgezogen:

1. **State-Refactor + `DEFAULT_USER` + `dinersForPortion`** (`69366ff` + Fixup `7f44010`) — `state.settings.profiles[]` + `activeProfileId`, Migration im `loadState()`, 40+ Callsites von `settings.profile.xyz` auf `getActiveProfile().xyz` umgestellt.
2. **Onboarding-Follow-up** (`66d7747`) — nach dem Wizard fragt der User „weitere Profile anlegen?" wenn `defaultPortions > 1`. Sub-Wizards ohne Personen-Slider, Personen-Pille im Header, Zombie-Entfernung leerer Sub-Profile.
3. **Settings-Profil-Liste + Detail-Sheet** (`bea6826`) — Section „Profile" mit Liste + Add-Button, neues `profile-detail-sheet.js` mit allen Wizard-Slots als Single-Page-Form.
4. **Kochmengen-Aggregation** (`0685c92`) — `totalFactorForDish` summiert individuelle Diner-Skalierungen; Detail-Sheet zeigt bei portions > 1 pro-Diner-Aufteilung.
5. **Edge-Case-Warnings** (`fda406f`) — console.warn für State-Fallbacks.

### Was in Session 18 zusätzlich passiert ist (nicht im Plan, aus User-Feedback)

Die Session ist deutlich über die 5 geplanten Etappen hinausgewachsen — viele UX-Runden mit dem User:

- **Multi-User Makro-Popup**: Profil-Pills oberhalb des Charts, Multi-Select mit Ø-Berechnung, disable Preset-/Slider-Controls bei > 1 selected. Später umbenannt in „Nährstoff-Details".
- **Aktives Profil = `profiles[0]`** (statt separatem `activeProfileId`-Marker) + **Material-3-Drag&Drop-Reordering** in der Settings-Liste (Long-Press 500ms + haptic feedback + Elevation-Shadow).
- **Prefs pro User** (statt global): Diät = Schnitt der mitkochenden Profile mit Fallback auf active; Küchen = Union + Voter-Ranking; Favoriten = Union + Likes-Ranking.
- **Standard-Profil**: editierbarer globaler Fallback-Diner statt hardcodiertem `DEFAULT_USER`. Nicht löschbar, eigene dashed-Row in Settings, id `_default` triggert Sonder-Layout im Detail-Sheet.
- **Dashboard-Karten**: kcal + Makros wieder auf aktiven User (kurz auf Ø gewechselt, zurückgerollt).
- **Shopping-Header**: dynamischer Modus-Wechsel Reset ↔ Check-All je nach Zustand; Chip klickbar für Dashboard-Sprung; Global-Check-All collapsed alle Kategorien.
- **Dashboard-Karten frosted-glass**: neue `--card-pill-glass`-Variable + stärkerer `backdrop-filter` (`blur 14 saturate 1.5`), damit Werte auf hellem Bild lesbar bleiben aber Glas-Look behalten wird.
- **Onboarding Step 1**: dritter Gender-Chip „Standard" (dashed outline) übernimmt alle DGE-Defaults auf einen Klick.
- **Zahlreiche kleinere UX-Fixes**: Info-Dialog mittig positioniert, GitHub-Pille mit „extern öffnen"-Icon rechtsbündig, Chip-Row-Layout in Profile-Detail (stacked mit `flex-shrink: 0` + `align-items: stretch`), Ingwer-Note gekürzt, Delete-Button als rote Pille, „Über"-Section per Default eingeklappt, Section-Summaries angepasst usw.

### Stable-Release v1.1

- `beta` bekam einen `chore(release)`-Commit der `applicationIdSuffix ".beta"` entfernte, „Mahlzeit Beta" → „Mahlzeit", `1.1-beta` → `1.1` (`9892411`).
- Fast-forward merge `beta` → `main` (kein Merge-Commit).
- Debug-signed Stable-APK gebaut und als `mahlzeit-1.1-stable.apk` kopiert.
- `beta` danach sofort auf `1.2-beta` mit reaktiviertem `.beta`-Suffix zurückgesetzt, damit weitere Feature-Arbeit parallel zur installierten Stable laufen kann.

## Bewusst NICHT gemacht (Kandidaten für spätere Sessions)

- **Profil teilen / importieren** — neu im Backlog (letzte Section). MVP: Web Share API + Clipboard-Fallback, JSON-Format mit `type: "mahlzeit-profile"`.
- **Signierte Release-APK** — aktuell debug-signed. Für Play-Store bräuchte man Keystore + Signing-Config in `build.gradle`. Nachteil: Bricht App-Continuity mit bereits installierten Debug-Versionen (Nutzer müsste deinstallieren + neu installieren).
- **DGE-Werte des Standard-Profils gegen aktuelle Quelle prüfen** — TODO steht in `src/nutrition/defaults.js`.
- **UX-Feedback nach Beta-Test einholen** — der User hat während der Session viele Fixes gemacht, aber unter Realbedingungen (mehrere Wochen echtes Kochen mit Multi-User) noch nicht getestet.

## Wo weitermachen — Session 19

### Direkte Follow-ups

- **APK-Rollout an Nutzer** (falls es außer dem Solo-Entwickler weitere gibt): Stable v1.1 verteilen.
- **Beta v1.2-beta APK** bauen und installieren, falls der User weiter auf beta testen will.
- **Beta-Test-Feedback** sammeln, evtl. Bugfixes in `beta`/`multiuser`.

### Hauptthema-Kandidaten

- **Profil teilen / importieren** (siehe Backlog-Eintrag) — natürliche Fortsetzung von Multi-Profile.
- **Rezept-Import** (Backlog-Eintrag existiert seit Session 17) — überschneidet sich mit Profil-Import am JSON-Validation-Framework.
- **Kalender-Export** (`docs/redesign/2026-07-26-kalender-export-design.md`) — Design-Doc ist komplett, wartet seit Session 17.
- **Datenverwaltung / Iteration 7** — Export/Import JSON + „Alle Daten zurücksetzen"-Bestätigung.
- **Favoriten Weighted-Reroll** — Favoriten häufiger beim Reroll ziehen (analog Cuisine-Weighting).

### Wiedereinstiegs-Move

```bash
git checkout main
git log --oneline -5                   # Stable-Stand
git checkout beta                      # Feature-Branch
git log --oneline main..beta           # was auf beta ueber main hinaus liegt
cat docs/redesign/backlog.md | grep "^## " # Backlog-Overview
```

## Guardrails-Recap

- **Kein Framework** ohne Rückfrage — Vanilla JS + ES Modules
- **Keine Tests** (Solo-Projekt) — Node-Simulation für Randfälle
- **Deutsche UI-Strings, Du-Ansprache**
- **Touch-Targets ≥ 48 px**
- **Storage-Key `mahlzeit-state-v2`** unveränderlich ohne Migration
- **Package-ID `com.mahlzeit.myapp`** auf main, `.beta`-Suffix auf beta
- **Zutaten-Wiederverwendung (Guardrail 8)** — beim Rezept-Anlegen prüfen ob Key existiert
- **APK-Build nur auf Anfrage** — kein automatisches Gradle

## User-Preferences (Feedback-Memories, stabil)

- **APK-Build nur auf Anfrage** — kein automatisches Gradle
- **Progress-Framing** — Zähler in „erledigt/gesamt"

## Skill-Empfehlungen für Session 19

- **`superpowers:brainstorming`** vor jedem größeren neuen Feature (Profil-Teilen, Rezept-Import).
- **`superpowers:writing-plans`** wenn Profil-Teilen / Rezept-Import angegangen wird — beide sind mehrere Etappen.
- **`superpowers:dispatching-parallel-agents`** falls unabhängige Chunks (z. B. JSON-Format-Design vs. UI-Sheet vs. Share-API-Integration).
- **`handoff`** am Session-Ende.
