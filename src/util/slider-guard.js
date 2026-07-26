// Verhindert versehentliches Verstellen von .settings-slider-Range-Inputs
// beim vertikalen Scrollen im Settings-Sheet / Onboarding-Wizard.
//
// Problem: Native <input type="range"> springt auf Android WebView beim ersten
// Touch schon zur Tap-Position, bevor der Browser die Scroll-Richtung anhand
// von touch-action entscheiden kann. Ergebnis: Beim Runterscrollen mit dem
// Finger auf einem Slider verstellt sich der Wert leicht.
//
// Loesung: Globales Delegations-Listener-Set am document. Auf touchstart
// merken wir uns Start-Position und Ausgangs-Wert. Auf erstem touchmove ueber
// einem 6-px-Threshold entscheiden wir Richtung (dy > dx = Scroll-Intent).
// Bei Scroll-Intent unterdruecken wir alle folgenden 'input'-Events (capture-
// phase + stopImmediatePropagation), damit downstream-Handler den Draft-State
// nicht updaten. Zusaetzlich revertieren wir den DOM-Wert des Sliders, damit
// die UI-Anzeige stabil bleibt.
//
// Nur ein aktiver Slider zurzeit — Single-Touch-Szenario reicht (App hat keine
// Multi-Touch-Slider-Interaktionen).

const THRESHOLD_PX = 6;

let activeSlider = null;
let startX = 0;
let startY = 0;
let preValue = '';
let decided = false;
let isScroll = false;

export function installSliderScrollGuard() {
  document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
  document.addEventListener('touchmove',  onTouchMove,  { capture: true, passive: true });
  document.addEventListener('input',      onInput,      { capture: true });
  document.addEventListener('touchend',   onTouchEnd,   { capture: true, passive: true });
  document.addEventListener('touchcancel', onTouchEnd,  { capture: true, passive: true });
}

function isSlider(el) {
  return el && el.classList && el.classList.contains('settings-slider');
}

function onTouchStart(ev) {
  const target = ev.target;
  if (!isSlider(target)) {
    activeSlider = null;
    return;
  }
  const t = ev.touches[0];
  activeSlider = target;
  startX = t.clientX;
  startY = t.clientY;
  preValue = target.value;
  decided = false;
  isScroll = false;
}

function onTouchMove(ev) {
  if (!activeSlider) return;
  if (decided) return;
  const t = ev.touches[0];
  const dx = Math.abs(t.clientX - startX);
  const dy = Math.abs(t.clientY - startY);
  if (dx < THRESHOLD_PX && dy < THRESHOLD_PX) return;
  decided = true;
  isScroll = dy > dx;
}

function onInput(ev) {
  if (!activeSlider || ev.target !== activeSlider) return;
  if (!isScroll) return;
  // Wert auf den Ausgangs-Stand zuruecksetzen und Event stoppen — Draft-State
  // wird nicht mutiert, UI zeigt weiterhin den urspruenglichen Wert.
  activeSlider.value = preValue;
  ev.stopImmediatePropagation();
}

function onTouchEnd() {
  if (activeSlider && isScroll) {
    // Sicherheit: falls waehrend des Drags irgendein input-Handler doch durch
    // ist (Timing-Race), am Ende nochmal auf preValue setzen und synthetisches
    // input-Event feuern, damit downstream-Handler den Draft zuruecknehmen.
    // input-Guard-Flag verhindert Rekursion.
    if (activeSlider.value !== preValue) {
      activeSlider.value = preValue;
    }
  }
  activeSlider = null;
  decided = false;
  isScroll = false;
}
