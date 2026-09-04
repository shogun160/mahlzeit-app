// Touch-Gesten fuer eigene Einkaufslisten-Zutaten:
//   nach links wischen  → roten Loeschen-Button aufdecken (loescht noch NICHT)
//   Loeschen antippen   → loeschen
//   lange druecken      → bearbeiten
//   kurz tippen         → abhaken (der normale Click-Handler der Liste)
//
// Zwei-Schritt statt Sofort-Loeschen wie in iOS-Listen: ein Wisch ist zu leicht
// versehentlich ausgeloest, und eine eigene Zutat ist nicht wiederherstellbar.
// Der aufgedeckte Button ist die Bestaetigung.
//
// Pointer-Events statt Touch-Events, damit dieselbe Implementierung im
// Desktop-Browser testbar bleibt (npm run dev).

// Breite des aufgedeckten Aktionsbereichs: zwei Buttons (Bearbeiten, Loeschen)
// à 72 px. Muss zur CSS-Breite von .shop-item__actions passen — sonst bleibt
// ein Spalt oder ein Button wird angeschnitten. 72 px liegen ueber dem
// 48-px-Minimum aus Guardrail 9.
export const REVEAL_WIDTH_PX = 144;

// Ab dieser Wischweite rastet die Zeile offen ein, darunter schnappt sie zu.
const OPEN_THRESHOLD_PX = REVEAL_WIDTH_PX / 2;

// Ab hier gilt die Bewegung als Wisch bzw. Scroll — vorher ist alles noch ein
// potenzieller Long-Press.
const MOVE_TOLERANCE_PX = 10;

const LONG_PRESS_MS = 500;

// Haptik beim Long-Press. Ohne Rueckmeldung ist unklar, wann der Druck lang
// genug war. Nicht jede WebView kann das — daher der Guard.
function buzz() {
  try {
    navigator.vibrate?.(30);
  } catch (_) {
    // Vibration nicht verfuegbar oder vom System blockiert — rein kosmetisch.
  }
}

export function isRevealed(el) {
  return el.classList.contains('shop-item--revealed');
}

export function closeReveal(el) {
  el.classList.remove('shop-item--revealed');
  const surface = el.querySelector('.shop-item__surface');
  if (surface) {
    surface.style.transition = '';
    surface.style.transform = '';
  }
}

// Schliesst alle offenen Zeilen ausser der uebergebenen. Immer nur eine Zeile
// offen — sonst haette der User mehrere scharfe Loeschen-Buttons gleichzeitig.
export function closeAllReveals(root, except = null) {
  root.querySelectorAll('.shop-item--revealed').forEach((el) => {
    if (el !== except) closeReveal(el);
  });
}

function openReveal(el) {
  el.classList.add('shop-item--revealed');
  const surface = el.querySelector('.shop-item__surface');
  if (surface) {
    surface.style.transition = 'transform .18s ease';
    surface.style.transform = `translateX(-${REVEAL_WIDTH_PX}px)`;
  }
}

// Haengt die Gesten an eine Zeile.
//   root    — Scroll-Container der Liste, fuer "nur eine Zeile offen"
//   onEdit  — Long-Press
// Das eigentliche Loeschen haengt am aufgedeckten Button und wird in render.js
// verdrahtet, nicht hier.
//
// Click-Unterdrueckung: Nach einem Wisch oder Long-Press feuert der Browser
// trotzdem noch ein click-Event — das wuerde die Zutat zusaetzlich abhaken.
// Wir markieren das Element per data-suppress-click; der Click-Handler in
// render.js liest und loescht das Flag.
export function attachCustomGestures(el, { root, onEdit }) {
  const surface = el.querySelector('.shop-item__surface');
  if (!surface) return;

  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dragging = false;
  let resolved = false;   // Long-Press hat schon gefeuert
  let timer = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const finish = () => {
    clearTimer();
    dragging = false;
    dx = 0;
  };

  el.addEventListener('pointerdown', (ev) => {
    // Nur primaerer Button/Finger. Rechtsklick und Zweitfinger ignorieren.
    if (ev.button !== 0) return;
    // Auf den aufgedeckten Aktions-Buttons keine Geste starten — die wollen nur
    // ihren Click.
    if (ev.target.closest?.('.shop-item__actions')) return;

    startX = ev.clientX;
    startY = ev.clientY;
    dx = 0;
    dragging = true;
    resolved = false;
    surface.style.transition = 'none';

    clearTimer();
    timer = setTimeout(() => {
      // Long-Press nur wenn der Finger im Wesentlichen stillstand.
      if (!dragging || Math.abs(dx) > MOVE_TOLERANCE_PX) return;
      resolved = true;
      el.dataset.suppressClick = '1';
      buzz();
      closeReveal(el);
      finish();
      onEdit();
    }, LONG_PRESS_MS);
  });

  el.addEventListener('pointermove', (ev) => {
    if (!dragging || resolved) return;
    const moveX = ev.clientX - startX;
    const moveY = ev.clientY - startY;

    // Vertikal dominant → der User scrollt. Geste abbrechen und die Zeile in
    // ihren Ausgangszustand zurueckbringen.
    if (Math.abs(moveY) > MOVE_TOLERANCE_PX && Math.abs(moveY) > Math.abs(moveX)) {
      if (isRevealed(el)) openReveal(el); else closeReveal(el);
      finish();
      return;
    }

    if (Math.abs(moveX) > MOVE_TOLERANCE_PX) {
      // Es ist ein Wisch, kein Long-Press.
      clearTimer();
      // Pointer erst hier einfangen: vorher wuerde das Capture ein vertikales
      // Scrollen der Liste blockieren.
      if (el.hasPointerCapture?.(ev.pointerId) === false) {
        try { el.setPointerCapture(ev.pointerId); } catch (_) { /* egal */ }
      }
      closeAllReveals(root, el);
    }

    dx = moveX;
    // Basis ist der aktuelle Zustand: aus einer offenen Zeile heraus wischt man
    // wieder zu. Nach links wird bei der Reveal-Breite gedeckelt, nach rechts
    // bei 0 — die Zeile soll nicht nach rechts aus ihrem Rahmen wandern.
    const base = isRevealed(el) ? -REVEAL_WIDTH_PX : 0;
    const offset = Math.max(-REVEAL_WIDTH_PX, Math.min(0, base + dx));
    surface.style.transform = `translateX(${offset}px)`;
  });

  const endGesture = (ev) => {
    if (!dragging || resolved) {
      finish();
      return;
    }
    try { el.releasePointerCapture?.(ev.pointerId); } catch (_) { /* egal */ }

    const base = isRevealed(el) ? -REVEAL_WIDTH_PX : 0;
    const offset = base + dx;

    // Ein sichtbarer Wisch darf danach nicht auch noch abhaken.
    if (Math.abs(dx) > MOVE_TOLERANCE_PX) el.dataset.suppressClick = '1';

    if (offset <= -OPEN_THRESHOLD_PX) openReveal(el);
    else closeReveal(el);

    finish();
  };

  el.addEventListener('pointerup', endGesture);
  el.addEventListener('pointercancel', (ev) => {
    try { el.releasePointerCapture?.(ev.pointerId); } catch (_) { /* egal */ }
    if (isRevealed(el)) openReveal(el); else closeReveal(el);
    finish();
  });
}

// Liest das Suppress-Flag und loescht es. true = dieser Click gehoerte zu einer
// Geste und darf nicht abhaken.
export function consumeSuppressedClick(el) {
  if (el.dataset.suppressClick !== '1') return false;
  delete el.dataset.suppressClick;
  return true;
}
