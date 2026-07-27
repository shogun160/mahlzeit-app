// Kleiner Snackbar-Helper. Rendert am unteren Rand des Viewports, blendet
// automatisch nach `duration` aus. Kein Queue-System (Solo-App-Scope: mehrere
// Toasts zeitgleich kommen praktisch nicht vor); neuer Toast ersetzt alten.

let rootEl = null;
let hideTimer = null;

function ensureRoot() {
  if (rootEl && document.body.contains(rootEl)) return rootEl;
  rootEl = document.getElementById('toast-root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'toast-root';
    document.body.appendChild(rootEl);
  }
  return rootEl;
}

export function showToast(text, { duration = 2500, tone = 'default' } = {}) {
  const root = ensureRoot();
  root.innerHTML = '';
  const el = document.createElement('div');
  el.className = `toast toast--${tone}`;
  el.setAttribute('role', 'status');
  el.textContent = text;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => { if (el.parentNode === root) root.removeChild(el); }, 250);
  }, duration);
}
