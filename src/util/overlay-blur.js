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

  const update = () => {
    const anyOpen = roots.some((el) => !el.hidden);
    document.body.classList.toggle('has-open-overlay', anyOpen);
  };

  const observer = new MutationObserver(update);
  roots.forEach((el) => observer.observe(el, {
    attributes: true,
    attributeFilter: ['hidden'],
  }));
  update();
}
