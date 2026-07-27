# Handoff — Session 20 → 21 (Mahlzeit-App)

## Fokus Session 21: Rezept-Import End-to-End

**Scope:** Rezepte in der App zur Laufzeit aus dem GitHub-Repo nachladen **und** einen sauberen Community-PR-Workflow im Repo einrichten. Zwei Backlog-Einträge, die aufeinander aufbauen und nur zusammen Sinn ergeben:

1. **Rezepte aus GitHub-Repo aktualisieren** — Konsum-Pfad (Button in Settings → App fetched Repo-Content).
2. **Community-Rezepte per Pull Request** — Contribution-Pfad (Templates + GitHub Action im Repo).

Kernidee: **Content-Rollout entkoppelt vom Schema-Rollout.** Neue Rezepte kommen ohne APK-Update zu den Usern. Schema-Änderungen bleiben APK-gebunden — bei Version-Mismatch klare Fehlermeldung „Bitte App aktualisieren".

Die File-Picker-Variante des Rezept-Imports wurde bewusst verworfen (siehe `backlog.md` → „Rezept-Import (File-Picker) — verworfen zugunsten Repo-Update").

## Session-20-Recap (zur Orientierung, nicht duplizieren)

### Kamera-Bug im QR-Scanner (Kern-Thema)

Drei Root-Causes hintereinander, siehe Commits:

- `7a10eee` **Statischer Import** statt hängender `await import('@capacitor-mlkit/barcode-scanning')` — der Vite-Chunk-Loader hing in der Capacitor-WebView still (kein Reject, kein Resolve).
- `de10ea3` **Auflösung 1920x1080** (statt Default 1280x720) — für dichte QR-Codes bracht MLKit mehr Pixel pro Modul.
- `de10ea3` **`barcodesScanned`-Listener** zusätzlich zum `barcodeScanned`.
- `980b59b` Listener-Race behoben: alle Listener werden per `await` registriert **bevor** `startScan()` läuft. `scanError`-Listener neu.
- `980b59b` Manifest: `com.google.mlkit.vision.DEPENDENCIES` Meta-Data ergänzt.
- `7df6d6c` Debug-Overlay abgeschaltet (Flag `SCANNER_DEBUG` in `src/profile-share/scanner.js` — bei Rückfall auf `true` setzen).

### Weitere Fixes

- `39e3f1d` **Dish-Picker kcal-Vorschau** matcht jetzt die Card-Anzeige (`Math.round(dish.kcal * getScaleForDish(dish))` statt roher `dish.kcal`).
- Filter-Logik im Picker bleibt bewusst auf ungeskalierter Basis (siehe Kommentar im FILTERS-Block).

### Release 1.2 auf `main`

- `bdd178b` Merge beta → main mit Stable-Config: **kein** `applicationIdSuffix ".beta"`, App-Name **„Mahlzeit"**, `versionCode: 3`, `versionName: "1.2"`.
- APK gebaut als `android/app/build/outputs/apk/debug/mahlzeit-1.2.apk` (Debug-signiert, aber Stable-Config).
- Package-ID: `com.mahlzeit.myapp` (installiert sich neben der `.beta`-Variante).

### Backlog-Updates

Sechs neue Einträge in `docs/redesign/backlog.md`:

- Kochmodus mit Wake-Lock
- Timer im Rezept (nur im Kochmodus)
- Rezept-Suche (Text) im Dish-Picker
- **Rezepte aus GitHub-Repo aktualisieren** ← Fokus Session 21
- **Community-Rezepte per Pull Request** ← Fokus Session 21
- Rezept-Import (File-Picker) — als **verworfen** markiert

### GitHub-Repo-Schutz (per gh api aktiviert)

- Branch Protection auf `main`: `allow_force_pushes: false`, `allow_deletions: false`. Sonst permissiv (Solo-Dev kann direkt committen und pushen).
- Dependabot Vulnerability Alerts aktiv.
- Secret Scanning + Push Protection aktiv.

## Branch-State beim Session-Ende

Alle drei Branches auf remote gepusht:

- **`main`** — `46af525` (Release 1.2 + Backlog-Cleanup)
- **`beta`** — `290f28f` (multiuser gemerged)
- **`multiuser`** — `39e3f1d` (Session-20-Fixes)
- **Working Tree:** sauber, keine uncommitteten Änderungen

## Umsetzungs-Skizze für Session 21

Details stehen ausführlich in den Backlog-Einträgen — hier nur die Reihenfolge und was zusammengehört.

### 1. Design-Doc erstellen (falls nötig)

Wahrscheinlich reichen die beiden Backlog-Einträge als Design-Grundlage. Falls doch: `superpowers:brainstorming` starten und Design-Doc unter `docs/redesign/2026-08-XX-rezept-import-design.md` ablegen.

### 2. Implementierungs-Plan

`superpowers:writing-plans` — Plan zerlegen in Steps mit klaren Success-Criteria. Sinnvolle Trennung:

**Phase A — Konsum-Pfad (App-Änderungen):**

- Schema-Version-Feld ergänzen in `src/data/dishes.json` und `src/data/ingredients.json`. Konstanten `SCHEMA_VERSION_DISHES = 1`, `SCHEMA_VERSION_INGREDIENTS = 1` in `src/data/dishes.js` / neuer `src/data/ingredients.js`.
- Neuer State-Slot in `src/state.js`: `state.remoteDishes: Dish[]`, `state.remoteIngredients: { [key]: Ingredient }`, `state.remoteUpdatedAt: string | null`. Keine Storage-Key-Änderung (Guardrail 2).
- Loader-Merger in `src/data/dishes.js` (`mergeDishes(bundled, remote)`) — Bundled hat Vorrang, Remote-Dishes mit bereits vorhandener ID werden verworfen.
- Analog Merger für Ingredients — Guardrail 8 (keine Duplikate) greift automatisch: Remote-Ingredients mit bereits vorhandenem Key werden verworfen.
- Neuer Fetcher in `src/data/remote-updates.js` (oder ähnlich):
  - Fetched `https://raw.githubusercontent.com/shogun160/mahlzeit-app/main/src/data/dishes.json` + `ingredients.json`.
  - Schema-Version-Vergleich → Mismatch = klare Fehlermeldung „Bitte App aktualisieren".
  - Diff gegen `bundled + state.remoteDishes` → Liste neuer Rezepte + neuer Zutaten.
- Bild-Handling via `@capacitor/filesystem`:
  - Speicherort: `Directory.Data/remote-dishes/dish-<id>.jpg`.
  - Loader-Fallback in Card/Detail-Sheet: erst Remote-Cache-Pfad prüfen, sonst Bundled `/dishes/dish-<id>.jpg`.
  - Progressiver Bild-Download (nicht blockierend) — Karte zeigt Platzhalter bis das Bild da ist.
- UI in Settings:
  - Neue Section „Rezepte" (oder Erweiterung existierender Section „Daten").
  - Button „Nach neuen Rezepten suchen" (secondary).
  - Section-Summary: „Zuletzt geprüft: vor 3 Tagen" bzw. „Noch nie geprüft".
  - Update-Sheet mit Preview-Liste + Bestätigen/Abbrechen + Progress.
  - Rate-Limiting: max 1 Check/Stunde (client-seitig).
- Fehlerfälle: kein Netz, JSON kaputt, Schema-Mismatch, Bild-Download failed. Alle mit klarem Toast/Sheet.
- Node-Simulation für Merger + Schema-Version-Check (Standard-Muster im Projekt).

**Phase B — Contribution-Pfad (Repo-Files):**

- `.github/pull_request_template.md` — Checkliste beim PR (JSON in `dishes.json`, Bild als `public/dishes/dish-<id>.jpg` 800×800 ≤ 400 kB, Ingredients ergänzt falls nötig, kcal-Sanity, Bild-Prompt genutzt, `npm run build` läuft).
- `.github/ISSUE_TEMPLATE/recipe-suggestion.yml` — Formular für User ohne Git (Name, Küche, Zutaten, Steps als Textfelder).
- `CONTRIBUTING.md` — Kurzanleitung, verlinkt Templates + Bild-Prompt + JSON-Schema.
- `docs/recipe-image-prompt.md` — Bild-Prompt-Rahmen (Foodblog-Stil, Vogelperspektive, natürliches Licht, quadratisch 800×800, modell-agnostisch). Kann aus dem bestehenden `docs/redesign/recipe-import-template.md` refaktoriert werden (der Bild-Prompt-Teil daraus, Rezept-Schema-Teil verweist auf `dishes.json`).
- `.github/workflows/pr-recipe-check.yml` — GitHub Action:
  - Trigger: `pull_request` auf `main` (NICHT `pull_request_target` — sonst Sicherheitslücke „pwn request").
  - Bild-Checks via `sharp` oder ImageMagick: Dimension 800×800 (±10 px), Dateigröße ≤ 400 kB, Format JPEG.
  - JSON-Checks via Node-Script: Pflichtfelder, `cuisineGroup` gegen Enum, ID eindeutig, Bild-Datei existiert für neue Dishes, alle Ingredient-Keys existieren, Nährwerte-Sanity (`|declared kcal − (p·4 + kh·4 + f·9)| < 100`).
  - Bei Fehler: roter Check + Kommentar mit Fix-Hint.
  - **KEIN** `npm run …` im Workflow (Sicherheit: keine arbitrary-Script-Execution aus PR-Content).

### 3. Testing

- Node-Simulation für Merger + Validator (nach Standard-Muster in `src/profile-share/payload.test.mjs`).
- Manuelles Browser-Testing mit `npm run dev`: Update-Flow mit lokalem Test-Fetch simulieren (Mock-Server oder lokale test-`dishes.json`).
- Live-Test in APK auf echtem Gerät: End-to-End mit echter Repo-URL, sauberes Merge-Verhalten.
- PR-Workflow selbst testen: dummy-Rezept-PR aufmachen, Action grün prüfen, mergen, dann in App per Update-Button ziehen.

### 4. Release-Flow

Nach Fertigstellung: multiuser → beta → main → Release 1.3 (analog Session 20). versionCode: 4, versionName: "1.3". Beta-Test-Runde vor main-Merge sinnvoll, um den End-to-End-Flow (PR → Merge → App-Update) auf echtem Gerät zu validieren.

## Wichtige Guardrails / User-Preferences

- **APK-Build nur auf Anfrage** (siehe Memory `feedback_apk_only_on_request.md`).
- **multiuser ist Test-Branch, kein Auto-Merge/APK ohne Ansage** (siehe Memory `feedback_apk_only_from_beta.md`).
- **Zutaten-Wiederverwendung** (Guardrail 8) — Merger verwirft Remote-Duplikate automatisch, aber die Action-Validation sollte auch semantisch ähnliche Ingredient-Keys als **Warnung** flaggen („`oregano_g` neu, es existiert bereits `oregano_tl`").
- **Storage-Key `mahlzeit-state-v2` unverändert** (Guardrail 2) — neue Felder ergänzen, aber keine Key-Migration.
- **Bilder als externe Dateien** (Guardrail 3) — für Remote-Cache: Capacitor Filesystem API, NIE Base64-Inline.
- **UI-Strings deutsch, Du-Ansprache** (Guardrail 1) — Section-Labels, Toasts, Sheet-Texte alle deutsch.
- **Statusbar-Farbe** (Guardrail 6) — bei neuen Sheets darauf achten.
- Solo-Projekt, keine Framework-Tests (Guardrail 10) — Node-Simulation für pure Logic, manueller Test für UI.

## Referenzen

- **Backlog (Detailtiefe):** [`docs/redesign/backlog.md`](../backlog.md) — Suche nach:
  - „Rezepte aus GitHub-Repo aktualisieren" (Konsum-Pfad)
  - „Community-Rezepte per Pull Request" (Contribution-Pfad)
  - „Rezept-Import (File-Picker) — verworfen zugunsten Repo-Update" (was NICHT gemacht wird)
- **Bestehende Basis-Vorlage:** [`docs/redesign/recipe-import-template.md`](../recipe-import-template.md) — enthält JSON-Schema + Bild-Prompt, kann aufgeteilt werden auf `dishes.json`-Schema (im Code) + neuer `docs/recipe-image-prompt.md`.
- **Aktuelle `dishes.json`-Struktur:** [`src/data/dishes.json`](../../../src/data/dishes.json) — 30 Rezepte, aktuell ohne `schemaVersion`-Feld. Migration Teil von Phase A.
- **Aktuelle `ingredients.json`-Struktur:** [`src/data/ingredients.json`](../../../src/data/ingredients.json) — auch ohne `schemaVersion`.
- **Bild-Standard:** `public/dishes/*.jpg` — alle 800×800 JPEG. Ein `identify public/dishes/dish-1.jpg` bestätigt.
- **Repo-URL für Raw-Fetch:** `https://raw.githubusercontent.com/shogun160/mahlzeit-app/main/`
- **GitHub-Repo:** https://github.com/shogun160/mahlzeit-app

## Skill-Empfehlungen für Session 21

- **`superpowers:brainstorming`** — falls Design-Doc nötig (die Backlog-Einträge sind schon dicht, evtl. reicht ein knapper Nachtrag zu offenen UX-Fragen).
- **`superpowers:writing-plans`** — Implementierungs-Plan mit klaren Success-Criteria pro Step. Sinnvoll wegen des Umfangs (App + Repo + Action).
- **`superpowers:executing-plans`** oder **`superpowers:subagent-driven-development`** — Phasen A und B haben unabhängige Sub-Tasks, die sich parallelisieren lassen.
- **`superpowers:test-driven-development`** — für Merger + Validator (pure Logic, ideal für Node-Simulation).
- **`superpowers:verification-before-completion`** — vor jedem Release-Merge.
- **`handoff`** — am Session-Ende.

## Einstiegs-Move für Session 21

```bash
# Sauberen Start prüfen
git status
git log main --oneline -8

# Backlog-Einträge nochmal frisch lesen (Kern-Design)
grep -n "^## " docs/redesign/backlog.md
# → Zeile mit "Rezepte aus GitHub-Repo aktualisieren" merken
# → Zeile mit "Community-Rezepte per Pull Request" merken

# Bestehende Template-Basis ansehen (Bild-Prompt + JSON-Schema)
cat docs/redesign/recipe-import-template.md

# Aktuelle Datenstruktur ansehen
head -60 src/data/dishes.json
head -30 src/data/ingredients.json

# Bild-Standard verifizieren
identify public/dishes/dish-1.jpg public/dishes/dish-15.jpg 2>&1 | head

# Loader anschauen — Merger wird hier andocken
cat src/data/dishes.js
```

Dann Skill laden (Brainstorm oder direkt Plan) und Phase A/B strukturieren. Rate-Limit-Frage und UX-Details zum Update-Sheet frühzeitig klären, weil sie später schwer zu ändern sind.
