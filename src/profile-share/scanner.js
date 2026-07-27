// Klassischer Kamera-Preview-Scanner via @capacitor-mlkit/barcode-scanning
// startScan(). Fragt CAMERA-Permission an, zeigt die native Kamera hinter der
// transparenten WebView und legt ein App-eigenes Overlay (Fokus-Rahmen +
// "Abbrechen"-Button) drueber. Vergleiche scan() (Google-Barcode-Modul) das
// beim Nachlade-Progress auf manchen Devices haengt.
import { Capacitor } from '@capacitor/core';

let PluginRef = null;
async function loadPlugin() {
  if (PluginRef) return PluginRef;
  const mod = await import('@capacitor-mlkit/barcode-scanning');
  PluginRef = mod.BarcodeScanner;
  return PluginRef;
}

export function isScannerAvailable() {
  return Capacitor.isNativePlatform();
}

// Sichert CAMERA-Permission. Wenn noch nicht gefragt: System-Dialog.
// Wenn schon denied: kein zweiter Dialog moeglich (System-Verhalten) → return false.
async function ensureCameraPermission(B) {
  const status = await B.checkPermissions();
  if (status.camera === 'granted' || status.camera === 'limited') return true;
  if (status.camera === 'denied') return false;
  const req = await B.requestPermissions();
  return req.camera === 'granted' || req.camera === 'limited';
}

let activeOverlay = null;
function mountOverlay(onCancel) {
  activeOverlay = document.createElement('div');
  activeOverlay.className = 'qr-scan-overlay';
  activeOverlay.innerHTML = `
    <div class="qr-scan-frame" aria-hidden="true"></div>
    <p class="qr-scan-hint">QR-Code in den Rahmen halten</p>
    <button class="qr-scan-cancel" type="button">Abbrechen</button>
  `;
  document.body.appendChild(activeOverlay);
  activeOverlay.querySelector('.qr-scan-cancel')?.addEventListener('click', onCancel);
}
function unmountOverlay() {
  if (activeOverlay?.parentNode) activeOverlay.parentNode.removeChild(activeOverlay);
  activeOverlay = null;
}

// Ruft den Scanner mit Kamera-Preview auf.
//   { rawValue }               -> QR erkannt
//   { canceled: true }         -> User hat den Abbrechen-Button geklickt
//   { error: 'permission_denied' | 'not_native' | '<msg>' }
export async function scanOnce() {
  if (!isScannerAvailable()) return { error: 'not_native' };
  const B = await loadPlugin();

  const granted = await ensureCameraPermission(B);
  if (!granted) return { error: 'permission_denied' };

  // WebView transparent + Body-Content unsichtbar (per CSS via .barcode-scanner-active).
  document.documentElement.classList.add('barcode-scanner-active');
  document.body.classList.add('barcode-scanner-active');

  let listener = null;
  const result = await new Promise((resolve) => {
    // Listener BEVOR startScan, sonst verpasst er den ersten Barcode-Event.
    B.addListener('barcodeScanned', (event) => {
      const b = event?.barcode;
      if (b?.rawValue) resolve({ rawValue: b.rawValue });
    }).then((h) => { listener = h; });

    mountOverlay(() => resolve({ canceled: true }));

    B.startScan({ formats: ['QR_CODE'] }).catch((e) => {
      resolve({ error: String(e && e.message || e) });
    });
  });

  // Cleanup unabhaengig vom Ausgang.
  if (listener) await listener.remove().catch(() => {});
  await B.stopScan().catch(() => {});
  unmountOverlay();
  document.documentElement.classList.remove('barcode-scanner-active');
  document.body.classList.remove('barcode-scanner-active');

  return result;
}
