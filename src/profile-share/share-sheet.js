import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { encodeProfile } from './payload.js';
import { renderQrToCanvas } from './qr.js';
import { showToast } from '../util/toast.js';

let rootEl = null;
const TRANSITION_MS = 200;

export function mountProfileShareSheet(el) {
  rootEl = el;
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export async function openProfileShareSheet(profile) {
  if (!rootEl) throw new Error('Share-Sheet nicht gemountet.');
  const { text, meta } = encodeProfile(profile);
  const displayName = profile.name || 'Profil';
  const favHint = renderFavHint(meta);
  rootEl.innerHTML = `
    <div class="share-sheet-overlay" data-role="backdrop">
      <div class="share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-sheet-title">
        <div class="share-sheet__handle" aria-hidden="true"></div>
        <div class="share-sheet__header">
          <h2 class="share-sheet__title" id="share-sheet-title">Profil teilen</h2>
          <button class="share-sheet__close" type="button" data-action="close" aria-label="Schließen">✕</button>
        </div>
        <div class="share-sheet__body">
          <p class="share-sheet__desc">„${escapeHtml(displayName)}" als QR oder Text weitergeben — dein Partner kann es in Mahlzeit importieren.</p>
          <div class="share-sheet__qr-wrap">
            <canvas class="share-sheet__qr" data-role="qr" width="240" height="240" aria-label="QR-Code des Profils"></canvas>
          </div>
          ${favHint}
          <div class="share-sheet__actions">
            <button class="btn btn--primary share-sheet__btn" type="button" data-action="share">Teilen</button>
            <button class="btn btn--secondary share-sheet__btn" type="button" data-action="copy">In Zwischenablage</button>
          </div>
          <textarea class="share-sheet__fallback" data-role="fallback" hidden readonly>${escapeHtml(text)}</textarea>
        </div>
      </div>
    </div>
  `;
  rootEl.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      rootEl.querySelector('.share-sheet-overlay')?.classList.add('is-open');
    });
  });
  attachHandlers(text);
  const canvas = rootEl.querySelector('[data-role="qr"]');
  const qrResult = await renderQrToCanvas(canvas, text, { size: 240 });
  if (!qrResult.ok) {
    const wrap = rootEl.querySelector('.share-sheet__qr-wrap');
    if (wrap) wrap.innerHTML = '<p class="share-sheet__qr-error">QR nicht darstellbar — bitte Text-Teilen nutzen.</p>';
  }
}

export function closeProfileShareSheet() {
  if (!rootEl || rootEl.hidden) return;
  rootEl.querySelector('.share-sheet-overlay')?.classList.remove('is-open');
  setTimeout(() => {
    if (rootEl && !rootEl.querySelector('.share-sheet-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
    }
  }, TRANSITION_MS);
}

function renderFavHint(meta) {
  if (meta.favoritesTotal === 0) return '';
  if (meta.favoritesTotal <= 15) {
    return `<p class="share-sheet__fav-hint">${meta.favoritesTotal} Favoriten geteilt</p>`;
  }
  return `<p class="share-sheet__fav-hint share-sheet__fav-hint--warn">15 von ${meta.favoritesTotal} Favoriten geteilt (nur die ersten 15 passen)</p>`;
}

function attachHandlers(text) {
  rootEl.querySelector('[data-action="close"]')?.addEventListener('click', closeProfileShareSheet);
  rootEl.querySelector('[data-role="backdrop"]')?.addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) closeProfileShareSheet();
  });
  rootEl.querySelector('[data-action="share"]')?.addEventListener('click', async () => {
    await handleShare(text);
  });
  rootEl.querySelector('[data-action="copy"]')?.addEventListener('click', async () => {
    await handleCopy(text);
  });
}

async function handleShare(text) {
  const isNative = Capacitor.isNativePlatform();
  if (isNative) {
    try {
      await Share.share({ title: 'Mahlzeit-Profil', text });
      return;
    } catch (e) {
      await handleCopy(text);
      return;
    }
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try { await navigator.share({ title: 'Mahlzeit-Profil', text }); return; } catch { /* fallthrough */ }
  }
  await handleCopy(text);
}

async function handleCopy(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showToast('Kopiert — jetzt in Chat/Mail einfügen');
      return;
    }
  } catch { /* fallthrough */ }
  const ta = rootEl.querySelector('[data-role="fallback"]');
  if (ta) {
    ta.hidden = false;
    ta.focus();
    ta.select();
    showToast('Bitte manuell kopieren');
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
