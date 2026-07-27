// Klassischer Kamera-Preview-Scanner via @capacitor-mlkit/barcode-scanning
// startScan(). Fragt CAMERA-Permission an, zeigt die native Kamera hinter der
// transparenten WebView und legt ein App-eigenes Overlay (Fokus-Rahmen +
// "Abbrechen"-Button) drueber.
//
// Debug-Modus: Wenn SCANNER_DEBUG aktiv, wird ein sichtbares Log-Overlay
// gerendert, das jeden Schritt zeigt (Perm, Listener, startScan, Events).
// Beim naechsten Kamera-Bug-Fund → auf false setzen.
import { Capacitor } from '@capacitor/core';
// Statischer Import statt dynamischem: der Vite-Chunk-Load fuer diesen
// Import hing in der Capacitor-WebView still (kein Reject, kein Resolve).
// Statischer Import hebt den Handler beim App-Start und umgeht das Problem.
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

const SCANNER_DEBUG = true;

export function isScannerAvailable() {
  return Capacitor.isNativePlatform();
}

// --- Debug-Overlay --------------------------------------------------------
let debugEl = null;
function debugMount() {
  if (!SCANNER_DEBUG) return;
  if (debugEl?.parentNode) return;
  debugEl = document.createElement('div');
  debugEl.className = 'qr-scan-debug';
  debugEl.setAttribute('style', [
    'position:fixed',
    'top:env(safe-area-inset-top,0)',
    'left:0',
    'right:0',
    'max-height:60vh',
    'overflow:auto',
    'z-index:2147483647',
    'visibility:visible',
    'background:rgba(0,0,0,0.85)',
    'color:#0f0',
    'font:11px/1.35 monospace',
    'padding:8px 10px',
    'pointer-events:none',
    'white-space:pre-wrap',
    'word-break:break-word',
  ].join(';'));
  document.body.appendChild(debugEl);
  debugEl.textContent = '[scan] init\n';
}
function debugLog(msg) {
  if (!SCANNER_DEBUG) return;
  const ts = new Date().toISOString().slice(11, 23);
  const line = `[${ts}] ${msg}`;
  // eslint-disable-next-line no-console
  console.log('[SCAN]', line);
  if (debugEl) debugEl.textContent += line + '\n';
}
function debugUnmount() {
  if (debugEl?.parentNode) debugEl.parentNode.removeChild(debugEl);
  debugEl = null;
}

async function ensureCameraPermission(B) {
  let status;
  try {
    status = await B.checkPermissions();
  } catch (e) {
    return { granted: false, reason: `checkPermissions warf: ${e?.message ?? e}` };
  }
  debugLog(`checkPermissions → camera=${status?.camera ?? '?'}`);
  if (status?.camera === 'granted' || status?.camera === 'limited') return { granted: true };
  if (status?.camera === 'denied') return { granted: false, reason: 'system: denied' };
  let req;
  try {
    req = await B.requestPermissions();
  } catch (e) {
    return { granted: false, reason: `requestPermissions warf: ${e?.message ?? e}` };
  }
  debugLog(`requestPermissions → camera=${req?.camera ?? '?'}`);
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
  debugMount();
  debugLog(`scanOnce() start · platform=${Capacitor.getPlatform()}`);

  if (!isScannerAvailable()) {
    debugUnmount();
    return { error: 'not_native' };
  }

  const B = BarcodeScanner;
  if (!B) {
    debugLog('plugin_load_failed: BarcodeScanner-Export fehlt');
    debugUnmount();
    return { error: 'plugin_load_failed', detail: 'BarcodeScanner-Export fehlt' };
  }
  debugLog('plugin ref ok (static import)');

  const perm = await ensureCameraPermission(B);
  if (!perm.granted) {
    debugLog(`permission_denied: ${perm.reason}`);
    debugUnmount();
    return { error: 'permission_denied', detail: perm.reason };
  }
  debugLog('permission granted');

  document.documentElement.classList.add('barcode-scanner-active');
  document.body.classList.add('barcode-scanner-active');
  debugLog('css class barcode-scanner-active gesetzt');

  // Listener-Race-Fix: ALLE Listener SYNCHRON registrieren BEVOR startScan()
  // aufgerufen wird. Sonst koennen Events verloren gehen.
  let barcodeHandle = null;
  let barcodesHandle = null;
  let errorHandle = null;
  let latestError = null;

  // Nimmt den ersten rawValue an – egal ob er ueber den singular- oder
  // plural-Event kam. Weitere Events werden ignoriert.
  let accepted = false;
  const acceptRawValue = (raw, from) => {
    if (accepted) return;
    accepted = true;
    debugLog(`accept rawValue via ${from} · len=${raw.length} · head="${raw.slice(0, 40).replace(/\n/g, '\\n')}"`);
  };

  const result = await new Promise(async (resolve) => {
    try {
      barcodeHandle = await B.addListener('barcodeScanned', (event) => {
        const b = event?.barcode;
        const raw = b?.rawValue;
        debugLog(`event barcodeScanned · fmt=${b?.format ?? '?'} · raw=${raw ? `len=${raw.length}` : '(empty)'}`);
        if (raw) { acceptRawValue(raw, 'barcodeScanned'); resolve({ rawValue: raw }); }
      });
      debugLog('barcodeScanned-Listener registriert');
    } catch (e) {
      debugLog(`addListener(barcodeScanned) warf: ${e?.message ?? e}`);
    }

    try {
      barcodesHandle = await B.addListener('barcodesScanned', (event) => {
        const list = event?.barcodes ?? [];
        debugLog(`event barcodesScanned · count=${list.length}`);
        for (const b of list) {
          const raw = b?.rawValue;
          if (raw) { acceptRawValue(raw, 'barcodesScanned'); resolve({ rawValue: raw }); return; }
        }
      });
      debugLog('barcodesScanned-Listener registriert');
    } catch (e) {
      debugLog(`addListener(barcodesScanned) warf: ${e?.message ?? e}`);
    }

    try {
      errorHandle = await B.addListener('scanError', (event) => {
        latestError = event?.message ?? String(event);
        debugLog(`event scanError · ${latestError}`);
      });
      debugLog('scanError-Listener registriert');
    } catch (e) {
      debugLog(`addListener(scanError) warf: ${e?.message ?? e}`);
    }

    mountOverlay(() => {
      debugLog('user cancel');
      resolve({ canceled: true });
    });
    debugLog('overlay mounted');

    // Hoehere Auflosung (1920x1080) fuer dichte QR-Codes: der Default
    // (1280x720) laesst QR-Codes mit vielen Modulen zu klein wirken →
    // pro Modul zu wenige Pixel → MLKit erkennt nichts.
    debugLog('rufe startScan({ formats: [QR_CODE], resolution: 2 })');
    B.startScan({ formats: ['QR_CODE'], resolution: 2 })
      .then(() => debugLog('startScan resolved (Kamera-Preview sollte laufen)'))
      .catch((e) => {
        const detail = e?.message ?? String(e);
        debugLog(`startScan REJECTED: ${detail}`);
        resolve({ error: 'start_scan_failed', detail });
      });
  });

  if (barcodeHandle) await barcodeHandle.remove().catch(() => {});
  if (barcodesHandle) await barcodesHandle.remove().catch(() => {});
  if (errorHandle) await errorHandle.remove().catch(() => {});
  await B.stopScan().catch(() => {});
  unmountOverlay();
  document.documentElement.classList.remove('barcode-scanner-active');
  document.body.classList.remove('barcode-scanner-active');

  if (result && !result.error && !result.canceled && !result.rawValue && latestError) {
    result.error = 'scan_error_event';
    result.detail = latestError;
  }
  debugLog(`scanOnce() ende · result=${JSON.stringify(result)}`);
  // Debug-Overlay kurz stehen lassen, damit User es lesen kann, danach weg.
  setTimeout(debugUnmount, 3500);

  return result;
}
