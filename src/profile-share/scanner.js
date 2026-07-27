// Wrapper um @capacitor-mlkit/barcode-scanning. Nutzt scan() = Google
// Barcode Scanner Modul (Play Services). Braucht keine Kamera-Permission,
// aber ggf. Nachinstallation des Play-Services-Moduls beim ersten Aufruf.
import { Capacitor } from '@capacitor/core';

let BarcodeScannerRef = null;
async function loadPlugin() {
  if (BarcodeScannerRef) return BarcodeScannerRef;
  const mod = await import('@capacitor-mlkit/barcode-scanning');
  BarcodeScannerRef = mod.BarcodeScanner;
  return BarcodeScannerRef;
}

export function isScannerAvailable() {
  return Capacitor.isNativePlatform();
}

// Stellt sicher dass das Google-Barcode-Scanner-Modul (Play Services) verfuegbar
// ist. Falls nicht: Install starten und auf das Progress-Event 'completed'
// warten. `onProgress(state)` liefert Zustands-Updates fuer die UI:
//   'downloading' | 'installing' | 'completed' | 'failed'
async function ensureGoogleScannerModule(B, onProgress) {
  try {
    const check = await B.isGoogleBarcodeScannerModuleAvailable();
    if (check?.available) return { ok: true };
  } catch {
    // isGoogleBarcodeScannerModuleAvailable ist Android-only; auf iOS wirft es
    // — dort ist das Modul in scan() ohnehin integriert.
    return { ok: true };
  }
  return new Promise((resolve) => {
    let handle = null;
    B.addListener('googleBarcodeScannerModuleInstallProgress', (ev) => {
      // state: 1=PENDING, 2=DOWNLOADING, 3=CANCELED, 4=COMPLETED, 5=FAILED,
      //        6=INSTALLING, 7=DOWNLOAD_PAUSED — laut Plugin-Enum
      if (ev.state === 4) {
        handle?.remove();
        resolve({ ok: true });
      } else if (ev.state === 3 || ev.state === 5) {
        handle?.remove();
        resolve({ ok: false, reason: 'install_failed' });
      } else if (ev.state === 2 && onProgress) {
        onProgress('downloading');
      } else if (ev.state === 6 && onProgress) {
        onProgress('installing');
      }
    }).then((h) => { handle = h; });
    B.installGoogleBarcodeScannerModule().catch(() => {
      handle?.remove();
      resolve({ ok: false, reason: 'install_failed' });
    });
    if (onProgress) onProgress('downloading');
  });
}

// Ruft den Scanner auf. Rueckgabe:
//   { rawValue }               -> QR erfolgreich erkannt
//   { canceled: true }         -> User hat Scanner abgebrochen (kein Barcode)
//   { error: 'install_failed' }-> Play-Services-Modul-Install fehlgeschlagen
//   { error: '<message>' }     -> sonstiger Fehler
// onProgress ist optional und liefert 'downloading' | 'installing' waehrend
// der Modul-Nachinstallation, damit die UI Feedback zeigen kann.
export async function scanOnce({ onProgress } = {}) {
  const B = await loadPlugin();
  const modReady = await ensureGoogleScannerModule(B, onProgress);
  if (!modReady.ok) return { error: modReady.reason || 'module_unavailable' };
  try {
    const result = await B.scan({ formats: ['QR_CODE'] });
    const first = result?.barcodes?.[0];
    if (first?.rawValue) return { rawValue: first.rawValue };
    return { canceled: true };
  } catch (e) {
    return { error: String(e && e.message || e) };
  }
}
