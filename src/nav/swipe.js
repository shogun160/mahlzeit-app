import { state, VIEWS } from '../state.js';

const SWIPE_THRESHOLD_PX = 55;
const SWIPE_DIRECTIONAL_RATIO = 1.4; // |dx| muss 1.4x größer als |dy| sein

// Hängt horizontalen Swipe-Handler an `el` (typisch das <main>-Element).
// onViewChange('dashboard' | 'shopping') wird gerufen wenn Threshold gerissen wurde
// UND der Swipe in eine gültige Richtung ging (kein Wrap-around).
// Aktueller View wird aus `state.view` gelesen — keine eigene Kopie.
export function attachViewSwipe(el, { onViewChange }) {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  el.addEventListener(
    'touchstart',
    (ev) => {
      if (ev.touches.length !== 1) return;
      // Steht auf einer eigenen Einkaufslisten-Zutat der Bearbeiten/Loeschen-
      // Bereich offen, gehoert der horizontale Wisch dieser Zeile: er schliesst
      // sie wieder. Ohne die Ausnahme landet genau dieser Schliess-Wisch unten
      // in `dx > 0 && idx > 0` und wechselt zur Dashboard-View.
      //
      // Bewusst nur im aufgedeckten Zustand (--revealed, nicht --custom): bei
      // geschlossener Zeile soll der View-Wechsel normal funktionieren, auch
      // wenn der Finger zufaellig auf einer eigenen Zutat aufsetzt.
      //
      // Der Wisch zum AUFDECKEN geht nach links und braucht keine Ausnahme,
      // solange die Einkaufsliste die letzte View ist — `idx < VIEWS.length - 1`
      // laeuft dann ins Leere. Kommt je eine View dahinter, muss diese
      // Bedingung um den geschlossenen Fall erweitert werden.
      if (ev.target.closest?.('.shop-item--revealed')) {
        tracking = false;
        return;
      }
      startX = ev.touches[0].clientX;
      startY = ev.touches[0].clientY;
      tracking = true;
    },
    { passive: true },
  );

  el.addEventListener(
    'touchend',
    (ev) => {
      if (!tracking) return;
      tracking = false;
      const dx = ev.changedTouches[0].clientX - startX;
      const dy = ev.changedTouches[0].clientY - startY;
      if (Math.abs(dx) <= SWIPE_THRESHOLD_PX) return;
      if (Math.abs(dx) <= Math.abs(dy) * SWIPE_DIRECTIONAL_RATIO) return;

      const idx = VIEWS.indexOf(state.view);
      // dx < 0 = Wisch nach links = nächster View rechts.
      if (dx < 0 && idx < VIEWS.length - 1) onViewChange(VIEWS[idx + 1]);
      else if (dx > 0 && idx > 0) onViewChange(VIEWS[idx - 1]);
    },
    { passive: true },
  );
}
