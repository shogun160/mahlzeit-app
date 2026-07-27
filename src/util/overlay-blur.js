// Blurred den Dashboard/View-Track + Header + Bottom-Nav sobald irgendein
// Sheet/Overlay geoeffnet ist. Statt CSS backdrop-filter (auf Android WebView
// unzuverlaessig) wird body.has-open-overlay gesetzt und im CSS ein filter:
// blur() auf die Content-Container gelegt.
//
// Wir beobachten die hidden-Attribute aller Sheet-Root-Container per einem
// gemeinsamen MutationObserver — kein Eingriff in die einzelnen Sheet-Module.

const OVERLAY_ROOT_IDS = [
  'detail-sheet-root',
  'settings-sheet-root',
  'profile-detail-root',
  'profile-share-sheet-root',
  'profile-import-sheet-root',
  'add-choice-sheet-root',
  'update-sheet-root',
  'dish-picker-root',
  'macro-popup-root',
  'onboarding-root',
];

export function installOverlayBlur() {
  const roots = OVERLAY_ROOT_IDS
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (roots.length === 0) return;

  // "Offen" = nicht hidden, hat Content, UND kein innerer overlay-Container
  // wartet gerade auf sein Close (dh. hat `.is-open` weiter). Die is-open-
  // Klasse wird beim closeXX() SOFORT entfernt (vor dem 250ms hidden-Timeout),
  // damit hier der Blur schnell wegkippt statt bis zum Ende der Slide-Down-
  // Animation zu haengen.
  const update = () => {
    const anyOpen = roots.some((el) => {
      if (el.hidden || el.children.length === 0) return false;
      // Overlay-Elemente im Root suchen (sheet-overlay, picker-overlay,
      // macro-overlay, settings-overlay etc.). Wenn welche da sind, muss
      // mindestens eines is-open haben. Wenn kein overlay-Element existiert
      // (kleinere Sheets ohne is-open-Konvention), als offen zaehlen.
      const overlays = el.querySelectorAll('[class*="overlay"]');
      if (overlays.length === 0) return true;
      return Array.from(overlays).some((o) => o.classList.contains('is-open'));
    });
    document.body.classList.toggle('has-open-overlay', anyOpen);
  };

  const observer = new MutationObserver(update);
  roots.forEach((el) => observer.observe(el, {
    attributes: true,
    attributeFilter: ['hidden', 'class'],
    childList: true,
    subtree: true,
  }));
  update();
}
