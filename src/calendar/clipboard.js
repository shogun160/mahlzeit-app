// Kopiert Text in die Zwischenablage. Nutzt navigator.clipboard.writeText —
// in der Capacitor-Webview auf Android und in modernen Desktop-Browsern
// funktioniert das aus einem User-Gesture heraus (Click-Handler).
//
// Rueckgabe: true bei Erfolg, false sonst. Der Caller entscheidet, wie er
// den Fehler kommuniziert (Toast). Kein automatischer Fallback auf ein
// natives Plugin — falls es doch mal fehlschlaegt, wird @capacitor/clipboard
// gezielt nachgezogen (Kommentar unten dokumentiert den Pfad).

export async function copyToClipboard(text) {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Fallback-Pfad (nur implementieren wenn navigator.clipboard in einer echten
// Umgebung reproduzierbar fehlschlaegt):
//   1. npm i @capacitor/clipboard
//   2. npx cap sync
//   3. hier importieren:
//        import { Clipboard } from '@capacitor/clipboard';
//        await Clipboard.write({ string: text });
