// Gibt den Export-Text ueber das System-Share-Sheet weiter (Android-Teilen-
// Dialog) und faellt auf die Zwischenablage zurueck, wenn kein Share-Kanal
// da ist — also im Desktop-Browser ohne Web-Share-API.
//
// Kaskade: Capacitor Share (nativ) → navigator.share (Web) → Clipboard.
// Analog zu src/profile-share/share-sheet.js, aber mit einem Unterschied:
// ein vom User abgebrochener Share-Dialog kopiert NICHT ersatzweise in die
// Zwischenablage. Abbruch ist eine Entscheidung, kein Fehler.

import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { copyToClipboard } from './clipboard.js';

// Rueckgabe: 'shared' | 'copied' | 'canceled' | 'failed'
// Der Caller entscheidet daraus den Toast-Text.
export async function shareExportText(text, { title, dialogTitle } = {}) {
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({ title, text, dialogTitle });
      return 'shared';
    } catch (e) {
      if (isCanceled(e)) return 'canceled';
      // Kein Share-Ziel oder Plugin-Fehler → Clipboard rettet den Flow.
      return (await copyToClipboard(text)) ? 'copied' : 'failed';
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (e) {
      if (isCanceled(e)) return 'canceled';
      // fallthrough auf Clipboard
    }
  }

  return (await copyToClipboard(text)) ? 'copied' : 'failed';
}

// Abbruch meldet sich je nach Kanal unterschiedlich: die Web-Share-API wirft
// einen DOMException mit name 'AbortError', Capacitor auf Android eine
// generische Error-Message ("Share canceled").
function isCanceled(e) {
  if (!e) return false;
  if (e.name === 'AbortError') return true;
  return /cancel/i.test(e.message || '');
}
