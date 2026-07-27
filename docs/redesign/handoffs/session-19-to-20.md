# Handoff — Session 19 → 20 (Mahlzeit-App)

## Fokus Session 20: QR-Scanner-Kamera-Bug fixen (kritisch)

Der QR-Code-Scanner öffnet die Kamera nicht, obwohl Handler feuert. **Muss zuerst repariert werden**, damit das Session-19-Feature „Profil teilen / importieren" komplett funktioniert. Der Text-Paste-Weg funktioniert bereits.

## Bug im Detail

**Symptom (letzte Beta-APK 13:52, HEAD `77c412a`):**
- User klickt „Profil-QR scannen" im Wizard-Welcome (First-Run) oder Add-Choice-Sheet (Settings > Profil hinzufügen)
- Sofort erscheint Toast **„Kamera wird geöffnet…"** → Handler feuert korrekt
- **Danach: nichts.** Keine Kamera-Preview, kein weiterer Fehler-Toast, kein Permission-Dialog
- Wizard-/Sheet-Screen bleibt sichtbar (Screenshot in Session-19-Endphase gepostet)

**Aktueller Ansatz:** `@capacitor-mlkit/barcode-scanning@8.1.0` mit `startScan()`. Siehe `src/profile-share/scanner.js` (Commit `f402b02`) und Error-Reporting-Nachrüstung `77c412a` / `193133f`.

**Wichtige Hinweise fürs Debugging:**

- Zwei Iterationen mit dem Plugin gemacht: erst `scan()` (Google-Barcode-Modul via Play Services — hing bei Modul-Nachladen ohne Progress-Event), dann Wechsel auf `startScan()` (klassischer Weg mit CAMERA-Permission + WebView-transparent). Beide zeigen das gleiche Endverhalten: „Handler feuert, aber Kamera bleibt weg".
- `@capacitor-community/barcode-scanner` (der klassische Weg im Cap-Community-Ökosystem) unterstützt nur Capacitor 5 — nicht kompatibel mit unserem Cap 8. Deshalb bei MLKit geblieben.
- CAMERA-Permission ist manuell im Manifest ergänzt (`android/app/src/main/AndroidManifest.xml` Zeile ~41). User hat auch manuell in System-Settings die Permission erteilt — half nicht.
- Toast-Debug-Path funktioniert: Fehler wären sichtbar. `runScanFlow` catcht Exceptions und zeigt sie. Also `startScan()` läuft, wirft nicht, aber die Kamera erscheint nie und `barcodeScanned` feuert nie.

## Diagnose-Empfehlungen für Session 20

1. **USB-Debug + Chrome DevTools** (`chrome://inspect`) — Console-Output live sehen, `console.log` in `scanner.js` an jedem Step einbauen.
2. **`adb logcat -s Capacitor:*`** — native Plugin-Aufrufe verfolgen. Ist `startScan` überhaupt beim nativen Plugin angekommen?
3. **CSS-Klasse-Check:** Wird `.barcode-scanner-active` tatsächlich auf `<html>` und `<body>` gesetzt? Wenn ja, wird die WebView transparent? Der Screenshot zeigt den Wizard-Screen NICHT transparent — vermutlich greift die CSS-Regel `body.barcode-scanner-active > *:not(.qr-scan-overlay) { visibility: hidden }` nicht rechtzeitig oder wird durch andere Overlay-Ebenen (Wizard/Sheet-Overlay) überlagert.
4. **Listener-Reihenfolge:** In `scanner.js` ist `addListener('barcodeScanned', …)` als `.then((h) => {…})` implementiert — die Listener-Registrierung ist **async und läuft parallel zu `startScan()`**. Wenn `startScan` bereits Barcodes emittiert bevor der Listener registriert ist, gehen sie verloren.

## Kandidaten-Fixes (in Reihenfolge geringster Aufwand)

1. **Fix Listener-Race** in `scanner.js`: `await` die `addListener`-Promise BEVOR `B.startScan(…)`.
2. **Overlay-Position prüfen**: Wizard/Sheet-Overlays haben `z-index: 2000` (Sheet) / `2100` (Wizard) — sie könnten unter `body.barcode-scanner-active` weiterhin sichtbar sein weil `visibility: hidden` bei Kindern durch expliziten `visibility: visible` überschrieben werden kann. Prüf ob Wizard/Add-Choice-Sheet ihre Overlays wirklich verstecken.
3. **`hideBackground()` explicit aufrufen** — laut MLKit-Docs muss man ggf. selbst die WebView transparent machen, nicht nur CSS. Aber MLKit v8 hat kein `hideBackground()` (das war beim älteren `@capacitor-community/barcode-scanner`). Prüfen ob MLKit ein Äquivalent bietet.
4. **Alternative Plugins prüfen** (Cap-8-kompatibel):
   - `@capgo/capacitor-barcode-scanner` — von Martin Donadieu (Capgo), aktive Community, Cap-8-Support angeblich vorhanden — verifizieren
   - `@ionic-native/barcode-scanner` — legacy aber battle-tested
5. **Native Kotlin/Java-Wrapper selbst schreiben** mit CameraX + ML Kit Barcode Scanner — nur wenn nichts anderes klappt.

## Bisher in Session 19 erledigt (Referenz, nicht duplizieren)

### Feature „Profil teilen / importieren" (Kern-Thema Session 19)
- Design + Plan: `docs/redesign/2026-07-27-profil-teilen-import-design.md`, `docs/redesign/2026-07-27-profil-teilen-import-plan.md`
- Payload-Modul mit Node-Simulation (21 Tests grün): `src/profile-share/payload.js` + `payload.test.mjs`
- Export-Sheet mit QR-Generierung + Share-API + Copy-Fallback: `src/profile-share/share-sheet.js` + `qr.js`
- Import-Sheet mit Text-Paste (**Scan-Modus dieser Bug**): `src/profile-share/import-sheet.js` + `scanner.js`
- Wizard-Welcome-Screen + Sub-Wizard-Welcome-Screen (First-Run + Person n+1): `src/onboarding/wizard.js`
- Add-Choice-Sheet für Settings > „+ Profil hinzufügen": `src/profile-share/add-choice-sheet.js`
- Toast-Helper: `src/util/toast.js`

### Zahlreiche UX-Fixes am Card + Settings (aus User-Iterationen)
Alle als eigene Commits (siehe `git log multiuser --oneline`), Auswahl:
- Card selected-State clean (nur Tint + Bild-Overlay-Pillen behalten primary-Look)
- Herz-Pille aus Makros raus → neben Portion-Pille im oberen Overlay (26×26, gleiche Baseline)
- Makro-Pillen normalisiert auf 24 px
- Liste-Icon filled + primary bei aktiv
- Section-Summary in Settings jetzt IMMER bei collapsed + rAF-Fix beim Sheet-Open
- Delete-Button-Sichtbarkeit (fehlende M3-`--md-sys-color-error`-Token definiert)
- „Proteinreich" im Dish-Picker nicht mehr links abgeschnitten (nowrap-Reihen linksbündig)
- Makro-Preset-Chips im Nährstoff-Popup horizontal scrollbar
- Import-Sheet springt direkt in Scan/Paste-Modus (kein doppelter Choice-Screen)
- Add-Choice + Wizard-Welcome „Text einfügen" als Secondary-Button (gleiche Optik wie „QR scannen")
- `.claude/` ins `.gitignore`

## Branch-State beim Session-Ende

- **`main`** — unverändert seit Session-19-Start (Stable v1.1)
- **`multiuser`** — Feature-Branch (HEAD `193133f`), letzter Fix: Error-Visibility bei Silent Scan-Failure
- **`beta`** — Release-Branch (HEAD `77c412a`), inhaltlich identisch zu multiuser
- **APK aus letztem Build:** `android/app/build/outputs/apk/debug/mahlzeit-1.2-beta.apk` (33 MB, 13:52 gebaut, mit Error-Visibility-Fix aber Kamera-Bug offen)
- **Working Tree:** sauber
- **Uncommitted:** keine

## Wichtige Guardrails / User-Preferences für Session 20

- **APK-Build nur auf Anfrage** (siehe `feedback_apk_only_on_request.md` in Memory)
- **multiuser ist Test-Branch — kein Auto-Merge/APK ohne Ansage** (siehe `feedback_apk_only_from_beta.md`)
- Solo-Projekt, keine Framework-Tests (Guardrail 10, `CLAUDE.md`) — Node-Simulation für pure Logic, manueller Test für UI
- Vanilla ES + Vite + Capacitor 8, kein Framework-Umbau
- UI-Strings deutsch, Du-Ansprache

## Skill-Empfehlungen für Session 20

- **`superpowers:systematic-debugging`** — für den Kamera-Bug, sauber schrittweise (Reproduzieren → Isolieren → Instrumentieren → Fix → Regression)
- **`superpowers:brainstorming`** — falls Plugin-Wechsel evaluiert wird
- **`handoff`** — am Session-Ende

## Einstiegs-Move für Session 20

```bash
# Auf multiuser wechseln, letzten Fix-Stand ansehen
git checkout multiuser
git log --oneline -10

# Aktuellen scanner.js + Error-Reporting-Nachrüstung ansehen
cat src/profile-share/scanner.js
cat src/profile-share/import-sheet.js | grep -A 30 "runScanFlow"

# Bug-Reproduce: Dev-Server + Browser-Fallback (isScannerAvailable=false)
#   NUR fürs UI-Layout; im Browser gibt es keine Kamera.
# Echter Test: APK auf Handy mit USB-Debug + chrome://inspect für Console-Logs

# Plugin-Version verifizieren
npm ls @capacitor-mlkit/barcode-scanning

# Manifest-Permission verifizieren
grep CAMERA android/app/src/main/AndroidManifest.xml
```

Dann Debug-Console.log-Instrumente in `scanner.js` und via `chrome://inspect` live nachvollziehen wo `startScan()` genau hängt.
