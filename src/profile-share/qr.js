// Wrapper um qrcode-lib. Wir nutzen `toCanvas` weil das ohne Base64-Bild-URL
// direkt aufs Canvas rendert (schneller, weniger Zwischenschritte).
import QRCode from 'qrcode';

export async function renderQrToCanvas(canvasEl, text, { size = 240 } = {}) {
  try {
    await QRCode.toCanvas(canvasEl, text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}
