# Profil teilen / importieren — Design

**Session 19 · 2026-07-27 · MVP für Multi-Profile-Weitergabe**

## Kontext & Ziel

Session 18 hat Multi-Profile als Stable v1.1 nach `main` gemerged. Der reale Use-Case dahinter: „Mein Partner nutzt die App neu, ich schicke ihm mein Profil, damit er nicht alles neu einrichten muss." Aktuell muss der Empfänger den Onboarding-Wizard komplett manuell durchklicken.

**Feature:** Ein Profil aus `state.settings.profiles[i]` kompakt verpacken und über Android-Share-Sheet, QR-Code oder Copy-Paste teilen. Empfang analog: QR-Scan oder Text-Paste. Peer-to-Peer, kein Cloud-Sync, keine Deep-Links.

**Zusätzlicher Onboarding-Nutzen** (User-Wunsch aus Session 19): QR-Scan als Alternative zum manuellen Wizard beim Erst-Setup UND beim Anlegen von Person n+1.

## Architektur

### Neue Module unter `src/profile-share/`

| Modul | Aufgabe |
|---|---|
| `payload.js` | Encode/Decode Profil ↔ Wire-Format. Version-Guard. Favoriten-Cap 15. Enum-Validation. Sanitizer. |
| `share-sheet.js` | Export-UI: Sub-Sheet aus Profil-Detail-Sheet. QR-Canvas + Share-Button + Copy-Button. |
| `import-sheet.js` | Import-UI: Sheet mit Scanner/Text-Paste-Auswahl. Toast-Feedback nach Import. |
| `scanner.js` | Wrapper um `@capacitor-mlkit/barcode-scanning`. Permission-Handling + Fallback-Weiterleitung auf Text-Paste. |
| `qr.js` | Wrapper um `qrcode` npm. Rendert Canvas passend zur Sheet-Breite. |

Zusätzlich neu in `src/util/`:

| Modul | Aufgabe |
|---|---|
| `toast.js` | Kleiner Snackbar-Helper: `showToast(text, opts?)`. Rendert am unteren Rand, verschwindet nach ~2.5 s. Wiederverwendbar (Import-Bestätigung, Copy-Feedback im Export-Sheet, Fehler-Overlay im Scanner). Aktuell hat das Projekt keinen Toast — er entsteht mit diesem Feature. |

### Neue Dependencies

- `@capacitor/share@^8` — Text-Share via Android-Share-Sheet, konsistenter Web-Fallback.
- `@capacitor-mlkit/barcode-scanning@^8` — QR-Scanner mit Kamera-Preview.
- `qrcode@^1` — QR-Generator, canvas-basiert.

Nach `npm i`: `npx cap sync` obligatorisch, weil MLKit-Plugin native Android-Änderungen mitbringt (Kamera-Permission im Manifest).

### Trigger-Punkte im existierenden Code

1. `settings/profile-detail-sheet.js` — „Profil teilen"-Button oberhalb des roten „Profil löschen", ausgeblendet für `id === '_default'`.
2. `onboarding/` — Neuer Welcome-Screen VOR Step 1 (Erst-Onboarding).
3. `onboarding/` — Analoger Welcome-Screen VOR Sub-Wizard Step 1 (Person n+1).
4. `settings/render.js` — „+ Profil hinzufügen"-Button wird zu Auswahl-Sheet „Manuell / QR / Text".
5. `state.js` — unverändert. `addProfile(patch)` bekommt das dekodierte, sanitizete Profil-Objekt und ergänzt fehlende Felder via `blankProfile()`.

## JSON-Payload-Schema

**Wire-Format** (in Base64 verpackt für Text/QR-Transport):

```json
{
  "type": "mahlzeit-profile",
  "version": 1,
  "exportedAt": "2026-07-27T18:32:00Z",
  "profile": {
    "name": "Oliver",
    "gender": "male",
    "age": 38,
    "heightCm": 180,
    "weightKg": 78,
    "activityLevel": 3,
    "goal": "maintain",
    "dailyTargetOverride": 2200,
    "breakfastKcal": 550,
    "lunchKcal": 770,
    "showCalorieBar": true,
    "macroPreset": "balanced",
    "macroTargets": null,
    "preferences": { "meat": true, "fish": true, "vegetarian": false },
    "cuisines": { "asian": true, "mediterranean": false, "middleEast": false, "americas": false },
    "favorites": { "3": true, "12": true, "27": true }
  }
}
```

### Regeln

- `id` wird NICHT mit exportiert — Empfänger bekommt neue ID via `nextProfileId()` im `addProfile()`.
- `favorites`-Cap: Max 15 Einträge. Bei `Object.keys(profile.favorites).length > 15` werden die ersten 15 nach Insertion-Order genommen; die Original-Anzahl steht im Sender-UI-Hinweis (nicht im Payload).
- Enums beim Import strikt validiert:
  - `gender ∈ {'male','female'}` (aktueller Wizard-Stand, `onboarding/steps.js:54-55`; der „Standard"-Chip aus Session 18 setzt kein neues Enum, sondern übernimmt DGE-Werte in andere Felder).
  - `activityLevel ∈ {1,2,3,4,5}`
  - `goal ∈ {'maintain','lose','gain'}`
  - `macroPreset` ∈ Preset-Enum aus `nutrition/target.js` (nicht duplizieren, direkt referenzieren).
- Nullable Felder (`age`, `heightCm`, `weightKg`, `activityLevel`, `goal`, `dailyTargetOverride`, `breakfastKcal`, `lunchKcal`, `name`, `macroTargets`) → Typ `number | null` bzw. `string | null`.
- Standard-Profil (`id === '_default'`) ist nicht exportierbar — kein „Teilen"-Button in der UI.

### Modul-Interface (`src/profile-share/payload.js`)

```js
export function encodeProfile(profile) → { text: base64String, meta: { favoritesTotal, favoritesShared } }
export function decodeProfile(base64OrJson) → { profile } | { error, detail }
```

**Fehler-Codes:** `'BAD_TYPE' | 'BAD_VERSION' | 'PARSE_ERROR' | 'INVALID_FIELD' | 'TOO_LARGE'`.

**Version-Guard:** `version === 1` beim Decode. Alles andere → `BAD_VERSION` mit User-Message „Diese Profil-Version wird von deiner App nicht unterstützt — bitte aktualisieren."

**Size-Cap:** Base64-String > 20 KB → `TOO_LARGE` (DoS-Schutz). Realistisch alle Payloads < 1 KB.

**Fehler kommen als `{ error, detail }` zurück**, nicht als Throw — UI zeigt kontrolliert Message an.

## Export-Flow

### Trigger

„Profil teilen"-Button im Profil-Detail-Sheet, oberhalb „Profil löschen". Für Standard-Profil (`_default`) ausgeblendet.

### Sheet-Layout

```
┌─────────────────────────────────┐
│  ✕     Profil teilen            │
├─────────────────────────────────┤
│  „Oliver" als QR oder Text      │
│  weitergeben — dein Partner     │
│  kann es in Mahlzeit importieren│
│                                 │
│  ┌─────────────────────────┐   │
│  │   [QR-Canvas 240×240]   │   │
│  └─────────────────────────┘   │
│                                 │
│  {Favoriten-Hinweis}            │
│                                 │
│  [ 📤 Teilen ]                  │
│  [ 📋 In Zwischenablage ]       │
└─────────────────────────────────┘
```

### Verhalten

- QR wird beim Öffnen einmal gerendert (Error-Correction Level M, ≥ 240 px für sichere Handy-Scanbarkeit).
- „Teilen": `Share.share({ title: 'Mahlzeit-Profil', text: base64Payload })`. Native → Android-Share-Sheet. Web → `navigator.share` falls verfügbar, sonst Copy + Toast.
- „In Zwischenablage": `navigator.clipboard.writeText(base64Payload)` + Toast „Kopiert — jetzt in Chat/Mail einfügen".
- Text-Payload = reiner Base64-String, ohne Prefix/Suffix (Empfänger kann direkt einfügen).

### Favoriten-Hinweis-Regel

- **0 Favoriten**: kein Hinweis.
- **1–15**: dezente Zeile „N Favoriten geteilt".
- **16+**: mit Warn-Färbung „15 von N Favoriten geteilt (nur die ersten 15 passen)".

### Schließen

„✕" oder Swipe-Down → zurück zum Profil-Detail-Sheet. Kein „Fertig"-Button (kein Save-Vorgang).

### Fehlerfälle

- QR-Rendering schlägt fehl (Extrem-Edge, sehr großer Payload): QR-Bereich zeigt „QR nicht darstellbar — bitte Text-Teilen nutzen". Buttons bleiben aktiv.
- Share-API + Clipboard beide nicht verfügbar: Textarea-Fallback im Sheet, User kann manuell markieren + kopieren.

## Import-Flow

### Trigger (3 Stück, alle öffnen dasselbe Import-Sheet)

1. **Wizard-Welcome-Screen** (neu, vor Step 1) — nur beim allerersten Onboarding.
2. **Sub-Wizard-Welcome für Person n+1** (neu, vor Sub-Wizard Step 1) — analog.
3. **Settings > „+ Profil hinzufügen"** — Button öffnet Auswahl-Sheet „Manuell / QR / Text".

### Neuer Welcome-Screen im Wizard

```
┌─────────────────────────────────┐
│         Willkommen              │
│      bei Mahlzeit               │
│                                 │
│   Zum ersten Mal hier?          │
│   Richte dein Profil ein oder   │
│   übernimm ein bestehendes.     │
│                                 │
│  [ ▶  Manuell einrichten ]     │
│  [ 📷  Profil-QR scannen ]     │
│  [ 📝  Text einfügen ]         │
└─────────────────────────────────┘
```

- „Manuell": Wizard Step 1 wie bisher.
- „Profil-QR scannen": öffnet Scanner-Sheet.
- „Text einfügen": öffnet Text-Paste-Sheet.

### Sub-Wizard-Welcome (Person n+1)

Analog, aber Header zeigt Progress-Pille „Person 2 von 3" (wie in Session 18).

### Scanner-Sheet

```
┌─────────────────────────────────┐
│  ✕     QR-Code scannen          │
├─────────────────────────────────┤
│  [Kamera-Preview vollflächig,   │
│   Overlay mit Fokus-Rahmen]     │
│                                 │
│  Halte die Kamera auf den       │
│  QR-Code des anderen Profils.   │
│                                 │
│  [ Stattdessen Text einfügen ]  │
└─────────────────────────────────┘
```

- Beim Öffnen: `BarcodeScanner.requestPermissions()`. Bei Deny → Fallback-Screen „Kamera-Berechtigung nötig. In Systemeinstellungen erlauben oder Text einfügen." mit Weiter-Button.
- MLKit-Scanner läuft kontinuierlich; erster erkannter QR wird sofort dekodiert.
- Bei erfolgreichem Decode → `addProfile()` + Toast + Sheet schließt.
- Bei ungültigem QR (Nicht-Mahlzeit oder BAD_VERSION): kurzes rotes Overlay „Ungültiger QR-Code" für 2 Sek, Scanner läuft weiter.

### Text-Paste-Sheet

```
┌─────────────────────────────────┐
│  ✕     Profil-Text einfügen     │
├─────────────────────────────────┤
│  Text aus Chat/Mail hier        │
│  einfügen:                      │
│  ┌─────────────────────────┐   │
│  │ [multiline textarea]    │   │
│  └─────────────────────────┘   │
│                                 │
│  [ Aus Zwischenablage einfügen ]│
│  [ Importieren ]                │
└─────────────────────────────────┘
```

- „Aus Zwischenablage einfügen": `navigator.clipboard.readText()` → Textarea-Wert. Wenn API nicht verfügbar → Button versteckt.
- „Importieren": disabled bei leerem Textarea. Bei Klick → `decodeProfile(textareaValue)`. Bei Erfolg → `addProfile()` + Toast + Sheet schließt. Bei Fehler → Inline-Meldung unter Textarea („Konnte den Text nicht lesen — sicher der richtige aus Mahlzeit?").

### Bestätigung nach erfolgreichem Import

**Toast** (kein Preview-Screen): „Profil von **Oliver** hinzugefügt". Bei gefilterten Favoriten Zusatz in Klammern „(2 Favoriten übersprungen)". Bei Payload ohne Namen: „Profil hinzugefügt" ohne Namensangabe.

### Nach-Import-Verhalten

- Aus **Settings**: Sheet schließt zur Profil-Liste, neue Zeile mit sanfter Flash-Animation.
- Aus **Wizard-Welcome**: User landet direkt im Dashboard, kein weiterer Wizard-Step. (`onboardingSeen` wird bereits beim Wizard-Öffnen sofort auf `true` gesetzt, `wizard.js:117-119` — muss hier nicht nochmal gesetzt werden.)
- Aus **Sub-Wizard-Welcome**: Person n als importiertes Profil, weiter zum Sub-Wizard für Person n+1 falls noch offen, sonst Onboarding-Ende.

## State & Sanitizer

**Kein struktureller State-Change.** `state.js` bleibt unverändert. `addProfile(patch)` nimmt das dekodierte Profil und ergänzt Defaults via `blankProfile()`. Storage-Key `mahlzeit-state-v2` unverändert (Guardrail 2).

**Import-Sanitizer** (in `payload.js`, läuft nach Decode und vor `addProfile`):
- Unbekannte `favorites`-Keys entfernen (Prüfung gegen `getAllDishes().map(d => d.id)`).
- `id`-Feld aus Payload verwerfen (falls doch drin).
- Enum-Felder auf gültige Werte prüfen; bei ungültig → `INVALID_FIELD` mit Feldname im `detail`.
- Nullable Felder auf Typ prüfen; Missmatch → `INVALID_FIELD`.

## Fehlerbehandlung (vollständig)

| Fehler | Wo | User-Message |
|---|---|---|
| Base64-Parse-Fehler | decode | „Konnte den Text nicht lesen — sicher der richtige aus Mahlzeit?" |
| JSON-Parse-Fehler | decode | dieselbe |
| Fehlender `type` oder falscher `type` | decode | „Das ist kein Mahlzeit-Profil." |
| `version !== 1` | decode | „Diese Profil-Version wird von deiner App nicht unterstützt — bitte aktualisieren." |
| Ungültiges Enum-Feld | sanitize | „Profil hat ein ungültiges Feld: {feldname}." |
| Payload > 20 KB | decode | „Datei zu groß — vermutlich kein Mahlzeit-Profil." |
| Scanner-Permission denied | UI | Fallback-Screen mit „Text einfügen" |
| Kein Kamera-Gerät | UI | dasselbe |
| Web Share API + Clipboard beide nicht verfügbar | Export | Textarea-Fallback im Sheet |

## Edge Cases

1. **Standard-Profil (`_default`)**: „Profil teilen"-Button ausgeblendet. Standard-Profil ist ein globaler Fallback-Diner, keine Person.
2. **QR-Scan im Wizard, aber Wizard-Draft ist teils ausgefüllt** (User springt vom Step 3 zurück auf Welcome und wählt QR): Draft wird verworfen, importiertes Profil ersetzt den aktuellen Slot. Kein Merge.
3. **Import im Sub-Wizard mit `defaultPortions = 2`**: Person 2 wird als importiertes Profil angelegt, Onboarding fragt danach wie bisher „Noch eine Person hinzufügen?" wenn `defaultPortions` das erlaubt.
4. **Payload ohne `name`**: Erlaubt. Toast „Profil hinzugefügt" ohne Namensangabe. Profil-Liste zeigt Namens-Fallback wie heute.
5. **Scanner erkennt Nicht-Mahlzeit-QR** (z. B. WhatsApp-Login-QR): Decode-Fehler „Das ist kein Mahlzeit-Profil.", Scanner läuft weiter.
6. **User importiert sein eigenes exportiertes Profil**: Zweites Profil mit gleichem Namen wird angelegt, keine Warnung, keine Sperre. User kann eines im Detail-Sheet löschen.
7. **Favoriten-Hinweis-Randfall**: Immer angezeigt bei ≥ 1 Favorit; siehe Favoriten-Hinweis-Regel im Export-Flow.

## Guardrail-Check

- **Storage-Key v2**: unverändert ✓
- **Vanilla-JS + Vite**: keine Framework-Änderung ✓
- **UI deutsch, Du-Ansprache**: alle neuen Strings ✓
- **Touch-Targets ≥ 48 px**: alle Buttons (Wizard-Welcome, Import-Sheet, Export-Sheet) ✓
- **Package-ID unverändert**: kein Intent-Filter, kein Deep-Link ✓
- **Nach Änderungen `npm run build && npx cap sync`**: obligatorisch für die 3 neuen Deps + MLKit Manifest-Eintrag ✓
- **APK nur auf Anfrage**: kein automatisches Gradle ✓
- **Keine Tests (Solo)**: Node-Simulation für `payload.js` Round-Trip + Fehlerfälle ✓
- **Bilder als externe Dateien**: nicht betroffen ✓
- **Zutaten-Wiederverwendung**: nicht betroffen ✓

## Nicht im MVP

- **Deep-Link `mahlzeit://profile/import?data=...`** — braucht Manifest-Intent-Filter + `App.addListener('appUrlOpen', ...)`. QR + Share-Sheet reichen.
- **Datei-Export/Import** (`.mahlzeit-profile.json`) — braucht `@capacitor/filesystem` + File-Picker + MIME-Registrierung. Eigener Feature-Scope („Backup/Export der Wochendaten").
- **Merge in existierendes Profil** — Import legt immer ein neues Profil an. Merge würde State-Semantik komplizieren.
- **Rezept-Katalog-Referenz für Favoriten** — teilt aktuell nur dish-IDs; bei abweichender `dishes.json` gehen unbekannte verloren. Später denkbar: Match per Name/Hash, überschneidet sich mit Rezept-Import.
- **iOS-Test** — Feature ist Android-fokussiert. Bei iOS-Build separat Camera-Permission konfigurieren.
- **QR über externe Kamera-App** — funktioniert nebenbei (Google Lens zeigt Base64-Text an), wir dokumentieren es nicht als offiziellen Kanal.

## Umsetzungs-Reihenfolge

1. **Payload-Modul** (`payload.js`) — Encode/Decode/Sanitize + Version-Guard + Enum-Validation. Reine Logik. Node-Simulation für Round-Trip + Fehlerfälle.
2. **Toast-Helper** (`util/toast.js`) — kleiner Snackbar-Helper, wird von Etappe 3 + 4 gebraucht.
3. **NPM-Deps installieren** — `@capacitor/share`, `@capacitor-mlkit/barcode-scanning`, `qrcode`. `npx cap sync`. Android-Kamera-Permission via MLKit-Plugin automatisch ins Manifest.
4. **Export-Sheet** (`share-sheet.js` + `qr.js`) — Sub-Sheet aus Profil-Detail-Sheet mit QR-Canvas, Share + Copy. Button-Verdrahtung im Detail-Sheet (außer `_default`).
5. **Import-Sheet** (`import-sheet.js` + `scanner.js`) — QR-Scanner-Overlay, Text-Paste-Textarea, Toast-Bestätigung, Fehler-Meldungen inline.
6. **Wizard-Integration** — Neuer Welcome-Screen vor Step 1 + Sub-Wizard-Welcome für Person n+1. Skip-Logik nach Import.
7. **Settings-Integration** — „+ Profil hinzufügen"-Button auf Auswahl-Sheet „Manuell / QR / Text" umbauen.

**Aufwand:** Etappen 1, 2, 3, 7 klein; 4, 5, 6 größer. Zusammen ein solider Session-Umfang, aber machbar. Fallback bei Zeitdruck: 1–5 sind der MVP (inkl. Settings-Import via Umweg über Profil-Detail-Sheet), 6+7 optional in Session 20.

**Test-Strategie:** Node-Simulation für `payload.js`. Manueller Test-Kreislauf: Export → Screenshot QR → auf zweitem Handy scannen → Import prüfen. Fallback: Export → Copy → Import auf demselben Handy (Sanity-Check).
