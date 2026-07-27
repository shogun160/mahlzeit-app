// Klassischer Kamera-Preview-Scanner via @capacitor-mlkit/barcode-scanning
// startScan(). Fragt CAMERA-Permission an, zeigt die native Kamera hinter der
// transparenten WebView und legt ein App-eigenes Overlay (Fokus-Rahmen +
// "Abbrechen"-Button) drueber.
import { Capacitor } from '@capacitor/core';

let PluginRef = null;
async function loadPlugin() {
  if (PluginRef) return PluginRef;
  const mod = await import('@capacitor-mlkit/barcode-scanning');
  PluginRef = mod.BarcodeScanner;
  if (!PluginRef) throw new Error('BarcodeScanner-Export fehlt');
  return PluginRef;
}

export function isScannerAvailable() {
  return Capacitor.isNativePlatform();
}

async function ensureCameraPermission(B) {
  let status;
  try {
    status = await B.checkPermissions();
  } catch (e) {
    return { granted: false, reason: `checkPermissions warf: ${e?.message ?? e}` };
  }
  if (status?.camera === 'granted' || status?.camera === 'limited') return { granted: true };
  if (status?.camera === 'denied') return { granted: false, reason: 'system: denied' };
  let req;
  try {
    req = await B.requestPermissions();
  } catch (e) {
    return { granted: false, reason: `requestPermissions warf: ${e?.message ?? e}` };
  }
  const granted = req?.camera === 'granted' || req?.camera === 'limited';
  return { granted, reason: granted ? undefined : `system: ${req?.camera ?? 'unbekannt'}` };
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
//   { error: '<key>', detail } -> Fehler mit lesbarem Detail
export async function scanOnce() {
  if (!isScannerAvailable()) return { error: 'not_native' };

  let B;
  try {
    B = await loadPlugin();
  } catch (e) {
    return { error: 'plugin_load_failed', detail: e?.message ?? String(e) };
  }

  const perm = await ensureCameraPermission(B);
  if (!perm.granted) return { error: 'permission_denied', detail: perm.reason };

  document.documentElement.classList.add('barcode-scanner-active');
  document.body.classList.add('barcode-scanner-active');

  let listener = null;
  let startError = null;

  const result = await new Promise((resolve) => {
    B.addListener('barcodeScanned', (event) => {
      const b = event?.barcode;
      if (b?.rawValue) resolve({ rawValue: b.rawValue });
    }).then((h) => { listener = h; }).catch(() => { /* nicht kritisch */ });

    mountOverlay(() => resolve({ canceled: true }));

    B.startScan({ formats: ['QR_CODE'] }).catch((e) => {
      startError = e?.message ?? String(e);
      resolve({ error: 'start_scan_failed', detail: startError });
    });
  });

  if (listener) await listener.remove().catch(() => {});
  await B.stopScan().catch(() => {});
  unmountOverlay();
  document.documentElement.classList.remove('barcode-scanner-active');
  document.body.classList.remove('barcode-scanner-active');

  return result;
}
