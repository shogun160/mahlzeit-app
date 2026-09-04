// Touch-Gesten fuer eigene Einkaufslisten-Zutaten:
//   horizontal wischen  → loeschen
//   lange druecken      → bearbeiten
//   kurz tippen         → abhaken (der normale Click-Handler der Liste)
//
// Pointer-Events statt Touch-Events, damit dieselbe Implementierung im
// Desktop-Browser testbar bleibt (npm run dev). Die drei Gesten teilen sich
// einen Pointer-Down, deshalb liegen sie in einem Modul: erst der Verlauf der
// Bewegung entscheidet, welche gemeint war.

// Ab dieser horizontalen Distanz gilt der Wisch als Loeschen. 80 px ist weit
// genug, dass ein unruhiger Daumen beim Abhaken nichts loescht.
const SWIPE_THRESHOLD_PX = 80;

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

// Haengt die Gesten an eine Zeile. `onDelete`/`onEdit` werden hoechstens einmal
// pro Pointer-Down gefeuert.
//
// Click-Unterdrueckung: Nach einem Wisch oder Long-Press feuert der Browser
// trotzdem noch ein click-Event — das wuerde die Zutat zusaetzlich abhaken.
// Wir markieren das Element per data-suppress-click; der Click-Handler in
// render.js liest und loescht das Flag.
export function attachCustomGestures(el, { onDelete, onEdit }) {
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dragging = false;
  let resolved = false;   // Geste bereits ausgeloest → keine zweite Aktion
  let timer = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const resetTransform = () => {
    el.style.transition = '';
    el.style.transform = '';
    el.style.opacity = '';
  };

  const finish = () => {
    clearTimer();
    dragging = false;
    dx = 0;
  };

  el.addEventListener('pointerdown', (ev) => {
    // Nur primaerer Button/Finger. Rechtsklick und Zweitfinger ignorieren.
    if (ev.button !== 0) return;
    startX = ev.clientX;
    startY = ev.clientY;
    dx = 0;
    dragging = true;
    resolved = false;
    el.style.transition = 'none';

    clearTimer();
    timer = setTimeout(() => {
      // Long-Press nur wenn der Finger im Wesentlichen stillstand.
      if (!dragging || Math.abs(dx) > MOVE_TOLERANCE_PX) return;
      resolved = true;
      el.dataset.suppressClick = '1';
      buzz();
      resetTransform();
      finish();
      onEdit();
    }, LONG_PRESS_MS);
  });

  el.addEventListener('pointermove', (ev) => {
    if (!dragging || resolved) return;
    const moveX = ev.clientX - startX;
    const moveY = ev.clientY - startY;

    // Vertikal dominant → der User scrollt. Geste abbrechen und die Zeile
    // zurueckschnappen lassen, damit sie nicht schief unter dem Finger klebt.
    if (Math.abs(moveY) > MOVE_TOLERANCE_PX && Math.abs(moveY) > Math.abs(moveX)) {
      resetTransform();
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
    }

    dx = moveX;
    el.style.transform = `translateX(${dx}px)`;
    // Ausblenden proportional zur Wischweite — macht sichtbar, dass hier
    // etwas verschwindet, und wo die Schwelle liegt.
    el.style.opacity = String(Math.max(0.25, 1 - Math.abs(dx) / (SWIPE_THRESHOLD_PX * 2)));
  });

  const endGesture = (ev) => {
    if (!dragging || resolved) {
      finish();
      return;
    }
    const passed = Math.abs(dx) >= SWIPE_THRESHOLD_PX;
    try { el.releasePointerCapture?.(ev.pointerId); } catch (_) { /* egal */ }

    if (passed) {
      resolved = true;
      el.dataset.suppressClick = '1';
      finish();
      onDelete();
      return;
    }

    // Unter der Schwelle: zurueckschnappen. Ein Wisch, der schon sichtbar war,
    // darf danach nicht auch noch abhaken.
    if (Math.abs(dx) > MOVE_TOLERANCE_PX) el.dataset.suppressClick = '1';
    el.style.transition = 'transform .18s ease, opacity .18s ease';
    el.style.transform = '';
    el.style.opacity = '';
    finish();
  };

  el.addEventListener('pointerup', endGesture);
  el.addEventListener('pointercancel', (ev) => {
    resetTransform();
    try { el.releasePointerCapture?.(ev.pointerId); } catch (_) { /* egal */ }
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
