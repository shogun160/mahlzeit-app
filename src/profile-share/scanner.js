// Wrapper um @capacitor-mlkit/barcode-scanning. Kapselt Permission-Handling
// und den Native-vs-Web-Zweig (Web hat keinen Scanner -> Fallback).
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

export async function requestPermission() {
  const B = await loadPlugin();
  const res = await B.requestPermissions();
  return res.camera === 'granted' || res.camera === 'limited';
}

// startScan zeigt die native Kamera-UI von MLKit (Full-Screen-Preview).
// Rueckgabe: erkannter Payload (String) oder null bei Abbruch.
export async function scanOnce() {
  const B = await loadPlugin();
  try {
    const result = await B.scan({ formats: ['QR_CODE'] });
    const first = result?.barcodes?.[0];
    return first?.rawValue ?? null;
  } catch (e) {
    return null;
  }
}
