import { state, getActiveProfile, getProfileById, addProfile, removeProfile, saveState, setActiveProfileId } from '../state.js';
import { openProfileImportSheet } from '../profile-share/import-sheet.js';
import { isScannerAvailable } from '../profile-share/scanner.js';
import { AGE_MIN, AGE_MAX, ACTIVITY_LEVELS, dailyTarget, dinnerTarget, kcalRange } from '../nutrition/target.js';
import { DEFAULT_USER } from '../nutrition/defaults.js';
import { renderStep1, renderStep2, renderStep3, DEFAULTS } from './steps.js';
import { renderStep5 as renderStep4, refreshResultDynamic, resolvedProfile, macrosForKcal, renderMacrosPills, THEME_CYCLE, themeIconFor, themeLabelFor } from './result.js';

const TRANSITION_MS = 250;
const TOTAL_STEPS = 4;

let rootEl = null;
let onExternalChange = () => {};
let onExternalThemeChange = () => {};
let currentStep = 1;
// Trackt ob das Sheet gerade offen ist — wichtig, damit renderShell() bei
// Re-Renders (goNext/goBack) die .is-open-Klasse direkt ins HTML nimmt und
// das Sheet nicht kurz weg-slidet.
let isOpen = false;

// Multi-Profile-Follow-up (Etappe 2):
//   editingProfileId  null = erster Durchgang, editiert getActiveProfile()
//                     sonst = Sub-Wizard fuer profiles[id] (neu angelegt beim
//                             Klick auf "Ja, jetzt")
//   personIndex       1 = User 1, 2 = zweiter Sub-Wizard, ... — zeigt sich
//                     als "Person X von N"-Pille im Header ab Index > 1.
//   showFollowup      true = statt normalem Step-Content wird die Zwischen-
//                     Frage "Willst du weitere Profile anlegen?" gezeigt.
//   suppressFollowup  true = maybeShowFollowupOrClose zeigt keine Frage
//                     an — genutzt beim Add-Profile-Modus aus Settings, wo
//                     der User bewusst genau ein neues Profil anlegen will.
let editingProfileId = null;
let personIndex = 1;
let showFollowup = false;
let suppressFollowup = false;
let showWelcome = false;

// Draft hält die Werte, die der User im Wizard eingibt. Beim Öffnen aus dem
// editierten Profil (getEditingProfile()) pre-fillt. touched trackt pro Feld,
// ob der User es aktiv angefasst hat — nur touched-Werte werden bei
// "Überspringen" persistiert. "Fertig" committet alles inkl. stiller Defaults.
let draft = {};
let touched = {};

// Rueckgabe des Profils, das der Wizard aktuell editiert. Bei erstem Durchgang
// = aktives Profil (User 1). Bei Sub-Wizards = neu angelegtes Profil per
// editingProfileId. Fallback auf getActiveProfile() falls die id ins Leere zeigt
// (defensiv — sollte nie greifen).
function getEditingProfile() {
  if (editingProfileId) {
    const p = getProfileById(editingProfileId);
    if (p) return p;
  }
  return getActiveProfile();
}

// Setzt Draft + touched aus einem Profil. Bei Sub-Wizards (neu angelegt) sind
// alle Slots noch null — der User startet mit den stillen DEFAULTS als
// Anzeige, die nur bei aktivem Klicken/Ziehen als touched markiert werden.
function initDraftFromProfile(p) {
  draft = {
    name: p.name,
    gender: p.gender,
    age: p.age,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    // Personen-Slider steht im Wizard-Step-1, das Feld sitzt aber global auf
    // state.settings.defaultPortions (nicht im profile) — der Wizard fuellt es
    // im finishAndClose/persistAndClose separat zurueck. Bei Sub-Wizards wird
    // der Slider ausgeblendet (isSubProfile=true), das Feld hier bleibt aber
    // synchron zum globalen Wert.
    defaultPortions: state.settings.defaultPortions,
    activityLevel: p.activityLevel,
    goal: p.goal,
    breakfastKcal: p.breakfastKcal,
    lunchKcal: p.lunchKcal,
    dailyTargetOverride: p.dailyTargetOverride,
  };
  touched = {
    name: false, gender: false, age: false, heightCm: false, weightKg: false,
    defaultPortions: false,
    activityLevel: false, goal: false, breakfastKcal: false, lunchKcal: false,
    dailyTargetOverride: false,
  };
}

function isSubProfileWizard() {
  return editingProfileId != null;
}

export function mountOnboardingWizard(el, { onChange, onThemeChange } = {}) {
  rootEl = el;
  onExternalChange = onChange || (() => {});
  onExternalThemeChange = onThemeChange || (() => {});
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export function openOnboardingWizard(opts = {}) {
  if (!rootEl) throw new Error('Onboarding-Wizard nicht gemountet.');
  // Reset Multi-Profile-State — jedes Oeffnen startet neu.
  editingProfileId = null;
  personIndex = 1;
  showFollowup = false;
  suppressFollowup = false;
  currentStep = 1;

  if (opts.addProfile) {
    // Add-Modus aus Settings: neues Blank-Profil sofort anlegen, Wizard fuer
    // dieses Profil starten. Kein Follow-up am Ende — der User will bewusst
    // genau EIN Profil hinzufuegen, nicht die Personen-Zahl vollmachen.
    const p = addProfile({});
    editingProfileId = p.id;
    suppressFollowup = true;
    initDraftFromProfile(p);
  } else {
    initDraftFromProfile(getActiveProfile());
  }

  // Welcome-Screen nur beim First-Run (nicht bei addProfile aus Settings — dort
  // hat der User schon manuell "+ Profil hinzufuegen" geklickt, ein zweiter
  // Choice-Screen waere redundant).
  showWelcome = !opts.addProfile;

  // onboardingSeen SOFORT setzen — auch bei App-Crash während Wizard nicht wieder
  // auto-triggern. saveState() persistiert das direkt.
  state.settings.onboardingSeen = true;
  saveState();

  renderShell();
  rootEl.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      isOpen = true;
      const overlay = rootEl.querySelector('.onboarding-overlay');
      if (overlay) overlay.classList.add('is-open');
    });
  });
  document.addEventListener('keydown', handleEsc);
}

export function closeOnboardingWizard() {
  if (!rootEl || rootEl.hidden) return;
  isOpen = false;
  const overlay = rootEl.querySelector('.onboarding-overlay');
  if (overlay) overlay.classList.remove('is-open');
  document.removeEventListener('keydown', handleEsc);
  setTimeout(() => {
    if (rootEl && !rootEl.querySelector('.onboarding-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
    }
  }, TRANSITION_MS);
}

function handleEsc(ev) {
  if (ev.key !== 'Escape') return;
  // Im Follow-up = Spaeter (kein weiteres Profil), sonst persistAndClose.
  if (showFollowup) closeOnboardingWizard();
  else persistAndClose();
}

// Persistiert nur touched-Felder in das editierte Profil. Endroutine für
// "Überspringen", Backdrop-Klick und X — der User hat den Wizard nicht bewusst
// abgeschlossen, deshalb bleiben stille Defaults null (Placeholder-Pille zeigt
// die unvollständige Einrichtung im Dashboard).
//
// Sub-Wizard-Sonderfall (Etappe 2): Wenn der User im 2..N-Wizard NICHTS
// touched hat, wird das leere Profil wieder entfernt — sonst haetten wir einen
// Zombie-Slot in state.settings.profiles.
function persistAndClose() {
  const anyTouched = Object.values(touched).some(Boolean);
  if (isSubProfileWizard() && !anyTouched) {
    removeProfile(editingProfileId);
    editingProfileId = null;
    saveState();
    onExternalChange();
    closeOnboardingWizard();
    return;
  }
  const p = getEditingProfile();
  for (const key of Object.keys(touched)) {
    if (!touched[key]) continue;
    // defaultPortions lebt global auf state.settings, nicht im profile. Bei
    // Sub-Wizards wird der Slider ausgeblendet (touched.defaultPortions bleibt
    // false), sodass die globale Personenzahl von hier nicht ungewollt
    // ueberschrieben wird.
    if (key === 'defaultPortions') {
      state.settings.defaultPortions = draft[key];
    } else {
      p[key] = draft[key];
    }
  }
  saveState();
  onExternalChange();
  closeOnboardingWizard();
}

// Persistiert alle Draft-Werte. Endroutine für "Fertig" — der User hat den
// Wizard bewusst durchlaufen und die stillen Defaults durch Weiter-Klicken
// bestätigt. Null-Slots werden aus DEFAULTS gefüllt. Name und
// dailyTargetOverride bleiben optional (dürfen null sein).
//
// Nach dem Persist wird maybeShowFollowup() geprueft: reichen die vorhandenen
// Profile fuer die eingestellte Personenzahl, oder brauchen wir noch weitere?
function finishAndClose() {
  const p = getEditingProfile();
  for (const key of Object.keys(draft)) {
    if (key === 'name' || key === 'dailyTargetOverride') {
      p[key] = draft[key];
    } else if (key === 'defaultPortions') {
      // Sub-Wizards editieren die globale Personenzahl nicht (Slider ist da
      // ausgeblendet, touched bleibt false). Fuer User 1 gilt der Draft-Wert.
      if (!isSubProfileWizard()) {
        state.settings.defaultPortions = draft[key] ?? DEFAULTS.defaultPortions;
      }
    } else {
      p[key] = draft[key] ?? DEFAULTS[key];
    }
  }
  saveState();
  onExternalChange();
  maybeShowFollowupOrClose();
}

// Nach Fertig-Klick: pruefen ob wir die Follow-up-Frage einblenden muessen.
// Bedingung: eingestellte Personenzahl > vorhandene Profile UND wir sind
// gerade nicht schon dabei. Sonst: Wizard schliessen.
function maybeShowFollowupOrClose() {
  if (suppressFollowup) {
    closeOnboardingWizard();
    return;
  }
  const need = state.settings.defaultPortions;
  const have = state.settings.profiles.length;
  if (need > 1 && have < need) {
    showFollowup = true;
    personIndex = have + 1;
    renderShell();
    return;
  }
  closeOnboardingWizard();
}

// User hat "Ja, jetzt" gewaehlt — neues Blank-Profil anlegen, Wizard fuer
// diesen Slot neu starten. editingProfileId zeigt jetzt auf das neue Profil,
// draft ist leer (der User startet frisch, mit stillen DEFAULTS in Step 1).
function startSubProfileWizard() {
  const p = addProfile({});
  editingProfileId = p.id;
  showFollowup = false;
  showWelcome = true;   // Sub-Wizard startet auch mit Welcome-Screen
  currentStep = 1;
  initDraftFromProfile(p);
  renderShell();
}

function renderShell() {
  const progressPct = (currentStep / TOTAL_STEPS) * 100;
  // isOpen ist true bei Re-Renders aus goNext/goBack — dann die Klasse direkt
  // ins HTML, sonst würde das Sheet zwischen den Steps weg-sliden.
  const openCls = isOpen ? ' is-open' : '';
  const totalPersons = state.settings.defaultPortions;
  // Personen-Pille nur ab Person 2 sichtbar — bei Solo-Einrichtung (User 1
  // allein) waere sie visuell Rauschen. Als eigene Zeile unter dem Titel
  // gerendert, damit das 3-Column-Grid der Header-Row (36|1fr|36) unangetastet
  // bleibt.
  const personPill = (personIndex > 1)
    ? `<div class="onboarding-header__person"><span class="onboarding-header__person-pill" aria-label="Person ${personIndex} von ${totalPersons}">Person ${personIndex} von ${totalPersons}</span></div>`
    : '';
  // Progress-Bar wird nur im normalen Wizard gezeigt, nicht im Follow-up-Screen
  // (dort gibt es keinen Step-Progress, nur die Ja/Spaeter-Entscheidung) und
  // nicht im Welcome-Screen (dort gibt es noch keine Steps).
  const progressBar = (showFollowup || showWelcome) ? '' : `
    <div class="onboarding-progress">
      <div class="onboarding-progress__label">Schritt ${currentStep} von ${TOTAL_STEPS}</div>
      <div class="onboarding-progress__track"
           role="progressbar"
           aria-valuemin="1"
           aria-valuemax="${TOTAL_STEPS}"
           aria-valuenow="${currentStep}">
        <div class="onboarding-progress__fill" style="width: ${progressPct}%"></div>
      </div>
    </div>
  `;
  rootEl.innerHTML = `
    <div class="onboarding-overlay${openCls}" data-role="backdrop">
      <div class="onboarding-sheet" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div class="onboarding-handle" aria-hidden="true"></div>
        <div class="onboarding-header">
          <div class="onboarding-header__row">
            <h2 class="onboarding-header__title" id="onboarding-title">Einrichtung</h2>
            <button class="onboarding-close" type="button" data-action="close" aria-label="Schließen — Entwurf speichern">✕</button>
          </div>
          ${personPill}
          ${progressBar}
        </div>
        <div class="onboarding-body" data-role="step-slot">
          ${renderStepContent()}
        </div>
        <div class="onboarding-footer" data-role="footer-slot">
          ${renderFooter()}
        </div>
      </div>
    </div>
  `;
  attachShellHandlers();
}

function renderStepContent() {
  if (showWelcome) return renderWelcome();
  if (showFollowup) return renderFollowup();
  switch (currentStep) {
    case 1: return renderStep1(draft, { isSubProfile: isSubProfileWizard() });
    case 2: return renderStep2(draft);
    case 3: return renderStep3(getEditingProfile());
    case 4: return renderStep4(draft);
    default: return `<p class="onboarding-placeholder">Step ${currentStep}</p>`;
  }
}

// Follow-up-Screen: nach "Fertig" von User X, wenn defaultPortions noch mehr
// Personen erwartet als Profile vorhanden sind. Zwei explizite Wege — "Ja"
// startet den naechsten Sub-Wizard, "Spaeter" schliesst den Wizard komplett.
function renderFollowup() {
  const total = state.settings.defaultPortions;
  const have = state.settings.profiles.length;
  const missing = total - have;
  const missingLabel = missing === 1 ? 'noch eine Person' : `noch ${missing} weitere Personen`;
  return `
    <div class="onboarding-followup">
      <h3 class="onboarding-step__title">Weitere Profile anlegen?</h3>
      <p class="onboarding-step__desc">Du kochst für <strong>${total} Personen</strong>. Es ${missing === 1 ? 'fehlt' : 'fehlen'} ${missingLabel}. Ohne Profil rechnen wir mit einem DGE-Standardbedarf (2200 kcal).</p>
    </div>
  `;
}

function renderWelcome() {
  const isSub = isSubProfileWizard();
  const title = isSub ? 'Person hinzufügen' : 'Willkommen bei Mahlzeit';
  const desc = isSub
    ? 'Neue Person manuell einrichten oder Profil-QR eines anderen Mahlzeit-Nutzers übernehmen.'
    : 'Zum ersten Mal hier? Richte dein Profil ein oder übernimm ein bestehendes.';
  const scanEnabled = isScannerAvailable();
  const scanLabel = scanEnabled ? 'Profil-QR scannen' : 'Profil-QR scannen (nur in der App)';
  return `
    <div class="wizard-welcome">
      <h3 class="wizard-welcome__title">${title}</h3>
      <p class="wizard-welcome__desc">${desc}</p>
      <div class="wizard-welcome__actions">
        <button class="btn btn--primary wizard-welcome__btn" type="button" data-action="welcome-manual">Manuell einrichten</button>
        <button class="btn btn--secondary wizard-welcome__btn" type="button" data-action="welcome-scan"${scanEnabled ? '' : ' disabled'}>${scanLabel}</button>
        <button class="btn btn--text wizard-welcome__btn" type="button" data-action="welcome-paste">Text einfügen</button>
      </div>
    </div>
  `;
}

function renderFooter() {
  if (showWelcome) return '';
  if (showFollowup) {
    // Follow-up hat zwei Buttons: "Spaeter" (schliesst) + "Ja, jetzt" (naechster
    // Sub-Wizard). Kein Zurueck/Ueberspringen — die Entscheidung ist binaer.
    return `
      <button class="onboarding-btn onboarding-btn--tertiary" type="button" data-action="followup-later">Später</button>
      <button class="onboarding-btn onboarding-btn--primary" type="button" data-action="followup-yes">Ja, jetzt</button>
    `;
  }
  const isFirst = currentStep === 1;
  const isLast = currentStep === TOTAL_STEPS;
  const primaryLabel = isLast ? 'Fertig' : 'Weiter';
  const primaryAction = isLast ? 'finish' : 'next';
  // Auf Seite 1 statt Zurück ein "Überspringen"-Button (schließt den Wizard mit
  // persistAndClose — nur touched-Felder werden persistiert). Ab Seite 2 der
  // gewöhnliche Zurück-Button.
  const leftBtn = isFirst
    ? `<button class="onboarding-btn onboarding-btn--tertiary" type="button" data-action="skip">Überspringen</button>`
    : `<button class="onboarding-btn onboarding-btn--tertiary" type="button" data-action="back">Zurück</button>`;
  return `
    ${leftBtn}
    <button class="onboarding-btn onboarding-btn--primary" type="button" data-action="${primaryAction}">${primaryLabel}</button>
  `;
}

function attachShellHandlers() {
  const overlay = rootEl.querySelector('[data-role="backdrop"]');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) {
      // Follow-up: Backdrop-Klick = Spaeter (schliessen ohne weiteres Profil).
      if (showFollowup) closeOnboardingWizard();
      else persistAndClose();
    }
  });

  const skipBtn = rootEl.querySelector('[data-action="skip"]');
  if (skipBtn) skipBtn.addEventListener('click', persistAndClose);
  // X oben rechts — global auf allen Steps verfügbar. Im Follow-up bedeutet
  // X das gleiche wie "Spaeter" (schliessen, kein weiteres Profil anlegen).
  // Sonst: Draft persistieren, Wizard schliesst als "nicht abgeschlossen"
  // (Placeholder-Pille bleibt sichtbar).
  const closeBtn = rootEl.querySelector('[data-action="close"]');
  if (closeBtn) closeBtn.addEventListener('click', () => {
    if (showFollowup) closeOnboardingWizard();
    else persistAndClose();
  });
  const nextBtn = rootEl.querySelector('[data-action="next"]');
  if (nextBtn) nextBtn.addEventListener('click', goNext);
  const backBtn = rootEl.querySelector('[data-action="back"]');
  if (backBtn) backBtn.addEventListener('click', goBack);
  const finishBtn = rootEl.querySelector('[data-action="finish"]');
  if (finishBtn) finishBtn.addEventListener('click', finishAndClose);

  // Follow-up-Buttons: Ja startet naechsten Sub-Wizard, Spaeter schliesst.
  const yesBtn = rootEl.querySelector('[data-action="followup-yes"]');
  if (yesBtn) yesBtn.addEventListener('click', startSubProfileWizard);
  const laterBtn = rootEl.querySelector('[data-action="followup-later"]');
  if (laterBtn) laterBtn.addEventListener('click', closeOnboardingWizard);

  // Step-Handler nur binden wenn wir gerade einen Step zeigen (Follow-up und
  // Welcome haben keine Step-Inputs).
  if (!showFollowup) attachStepHandlers();
}

function goNext() {
  if (currentStep < TOTAL_STEPS) {
    currentStep++;
    renderShell();
  }
}

function goBack() {
  if (currentStep > 1) {
    currentStep--;
    renderShell();
  }
}

function attachStepHandlers() {
  if (showWelcome) {
    attachWelcomeHandlers();
    return;
  }
  if (currentStep === 1) attachStep1Handlers();
  if (currentStep === 2) attachStep2Handlers();
  if (currentStep === 3) attachStep3Handlers();
  if (currentStep === 4) attachStep4Handlers();
}

function attachWelcomeHandlers() {
  rootEl.querySelector('[data-action="welcome-manual"]')?.addEventListener('click', () => {
    showWelcome = false;
    renderShell();
  });
  const openImport = () => {
    openProfileImportSheet({
      onImported: (importedProfile) => onWizardImported(importedProfile),
    });
  };
  rootEl.querySelector('[data-action="welcome-scan"]')?.addEventListener('click', openImport);
  rootEl.querySelector('[data-action="welcome-paste"]')?.addEventListener('click', openImport);
}

function onWizardImported(importedProfile) {
  if (isSubProfileWizard()) {
    // Blank-Sub-Profil (das startSubProfileWizard vorhin angelegt hat) wieder loeschen.
    removeProfile(editingProfileId);
    editingProfileId = importedProfile.id;
    maybeShowFollowupOrClose();
  } else {
    // First-Run: importedProfile ans erste Slot ziehen (aktives Profil).
    setActiveProfileId(importedProfile.id);
    // Alten Blank-User u1 (falls noch komplett leer) entfernen — sonst hat der
    // User zwei Profile: das importierte (jetzt aktiv) und einen alten leeren.
    const profiles = state.settings.profiles;
    const stale = profiles.find((p) => p.id !== importedProfile.id && isBlankProfile(p));
    if (stale && profiles.length > 1) removeProfile(stale.id);
    saveState();
    closeOnboardingWizard();
  }
}

function isBlankProfile(p) {
  return p && p.name == null && p.gender == null && p.age == null && p.heightCm == null && p.weightKg == null;
}

// Step 1 (Über dich) — Name + Geschlecht + Alter + Größe + Gewicht.
function attachStep1Handlers() {
  const nameInput = rootEl.querySelector('[data-action="name-change"]');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const v = nameInput.value.trim();
      draft.name = v === '' ? null : v;
      touched.name = true;
    });
  }

  rootEl.querySelectorAll('[data-action="gender-pick"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value;
      draft.gender = val;
      touched.gender = true;
      rootEl.querySelectorAll('[data-action="gender-pick"]').forEach((other) => {
        other.setAttribute('aria-pressed', String(other.dataset.value === val));
      });
    });
  });

  // "Standard"-Preset (dritter Chip in der Gender-Zeile): uebernimmt alle
  // Wizard-Werte aus DEFAULT_USER (Alter/Groesse/Gewicht/Aktivitaet/Ziel/
  // Kalorien-Verteilung). Nach Klick kann der User direkt "Fertig" — oder
  // einzelne Werte noch anpassen. Kein persistenter Gender-State: der Chip
  // bleibt nicht aria-pressed, weil er eine Aktion ist, kein Toggle.
  const standardBtn = rootEl.querySelector('[data-action="gender-standard"]');
  if (standardBtn) {
    standardBtn.addEventListener('click', () => {
      draft.name = draft.name; // Name unangetastet
      draft.gender = DEFAULT_USER.gender;
      draft.age = DEFAULT_USER.age;
      draft.heightCm = DEFAULT_USER.heightCm;
      draft.weightKg = DEFAULT_USER.weightKg;
      draft.activityLevel = DEFAULT_USER.activityLevel;
      draft.goal = DEFAULT_USER.goal;
      draft.breakfastKcal = DEFAULT_USER.breakfastKcal;
      draft.lunchKcal = DEFAULT_USER.lunchKcal;
      draft.dailyTargetOverride = DEFAULT_USER.dailyTargetOverride;
      touched.gender = true;
      touched.age = true;
      touched.heightCm = true;
      touched.weightKg = true;
      touched.activityLevel = true;
      touched.goal = true;
      touched.breakfastKcal = true;
      touched.lunchKcal = true;
      touched.dailyTargetOverride = true;
      // Re-render Step 1, damit alle Anzeigen (Stepper, Slider) die neuen
      // Werte spiegeln.
      renderShell();
    });
  }

  const ageMinus = rootEl.querySelector('[data-action="age-minus"]');
  const agePlus = rootEl.querySelector('[data-action="age-plus"]');
  const ageValEl = rootEl.querySelector('[data-role="age-value"]');
  const changeAge = (delta) => {
    const current = draft.age ?? DEFAULTS.age;
    const next = Math.max(AGE_MIN, Math.min(AGE_MAX, current + delta));
    draft.age = next;
    touched.age = true;
    if (ageValEl) ageValEl.textContent = String(next);
    if (ageMinus) ageMinus.disabled = next <= AGE_MIN;
    if (agePlus) agePlus.disabled = next >= AGE_MAX;
  };
  if (ageMinus) ageMinus.addEventListener('click', () => changeAge(-1));
  if (agePlus) agePlus.addEventListener('click', () => changeAge(+1));

  bindSlider('height-change', 'height-value', 'heightCm', (v) => `${v} cm`);
  bindSlider('weight-change', 'weight-value', 'weightKg', (v) => `${v} kg`);
  bindSlider('portions-change', 'portions-value', 'defaultPortions',
    (v) => `${v} ${v === 1 ? 'Person' : 'Personen'}`);
}

// Step 2 (Alltag) — Aktivität + Ziel + Frühstück + Mittag + Live-Preview
// des berechneten Abendessen-Kontingents.
function attachStep2Handlers() {
  bindSlider('activity-change', 'activity-value', 'activityLevel',
    (v) => ACTIVITY_LEVELS.find((a) => a.level === v)?.label ?? '—');
  bindChipGroup('goal-pick', 'goal', (v) => v);
  const fmt = (v) => `${v.toLocaleString('de-DE')} kcal`;
  bindSlider('breakfast-change', 'breakfast-value', 'breakfastKcal', fmt);
  bindSlider('lunch-change', 'lunch-value', 'lunchKcal', fmt);

  const updateDinnerPreview = () => {
    const el = rootEl.querySelector('[data-role="dinner-preview-value"]');
    if (!el) return;
    const p = resolvedProfile(draft);
    const dinner = dinnerTarget(p);
    if (dinner == null) { el.textContent = '—'; return; }
    const range = kcalRange(dinner);
    if (!range) { el.textContent = `${dinner.toLocaleString('de-DE')} kcal`; return; }
    const round10 = (n) => Math.round(n / 10) * 10;
    el.innerHTML = `${round10(range[0]).toLocaleString('de-DE')}&thinsp;–&thinsp;${round10(range[1]).toLocaleString('de-DE')} kcal`;
  };
  updateDinnerPreview();
  rootEl.querySelectorAll('[data-action="goal-pick"]').forEach((btn) => {
    btn.addEventListener('click', updateDinnerPreview);
  });
  rootEl.querySelectorAll('[data-action="activity-change"], [data-action="breakfast-change"], [data-action="lunch-change"]').forEach((slider) => {
    slider.addEventListener('input', updateDinnerPreview);
  });
}

// Step 3 (Filter) — Ernährungs- + Küchen-Präferenzen als Toggle-Chips +
// Makro-Preset als exklusive Auswahl + Live-Vorschau der Verteilung.
// Diaet-Prefs (pref-toggle) sitzen pro Profil (getEditingProfile()),
// Kuechen-Prefs weiter global (Etappe steht noch aus).
function attachStep3Handlers() {
  bindProfilePrefChips();
  bindProfileCuisineChips();
  bindMacroPresetChips();

  // Live-Vorschau der Makro-Verteilung (Donut + Legende). Wird beim initialen
  // Render gefüllt und nach jedem Preset-Klick refresht. Basis: dinnerTarget
  // aus resolvedProfile(draft) — biometrische Daten aus Step 1+2 fließen ein,
  // Fallbacks aus DEFAULTS wenn User Steps übersprungen hat.
  const updateMacroPreview = () => {
    const slot = rootEl.querySelector('[data-role="macro-preview-slot"]');
    if (!slot) return;
    const p = resolvedProfile(draft);
    const dinner = dinnerTarget(p);
    if (dinner == null) {
      slot.innerHTML = '';
      return;
    }
    const preset = getActiveProfile().macroPreset || 'balanced';
    const macros = macrosForKcal(dinner, preset);
    slot.innerHTML = renderMacrosPills(macros);
  };
  updateMacroPreview();
  rootEl.querySelectorAll('[data-action="macro-preset"]').forEach((btn) => {
    btn.addEventListener('click', updateMacroPreview);
  });
}

function bindToggleChips(action, bucketKey) {
  rootEl.querySelectorAll(`[data-action="${action}"]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.value;
      const bucket = state.settings[bucketKey];
      if (!bucket) return;
      bucket[key] = !bucket[key];
      btn.setAttribute('aria-pressed', String(!!bucket[key]));
    });
  });
}

// Diaet-Prefs pro Profil — bindet auf getEditingProfile().preferences statt
// state.settings.preferences. Bei Sub-Wizards / Add-Modus schreibt jeder
// User in seine eigenen Prefs.
function bindProfilePrefChips() {
  rootEl.querySelectorAll('[data-action="pref-toggle"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.value;
      const bucket = getEditingProfile().preferences;
      if (!bucket) return;
      bucket[key] = !bucket[key];
      btn.setAttribute('aria-pressed', String(!!bucket[key]));
    });
  });
}

// Kuechen-Prefs pro Profil — analog bindProfilePrefChips, aber auf
// getEditingProfile().cuisines. Multi-User-Semantik ist Union (nicht Schnitt
// wie bei Diaet).
function bindProfileCuisineChips() {
  rootEl.querySelectorAll('[data-action="cuisine-toggle"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.value;
      const bucket = getEditingProfile().cuisines;
      if (!bucket) return;
      bucket[key] = !bucket[key];
      btn.setAttribute('aria-pressed', String(!!bucket[key]));
    });
  });
}

// Makro-Preset: exklusive Chip-Gruppe. Klick setzt profile.macroPreset,
// löscht profile.macroTargets (Custom-Override aus Makro-Popup vergessen).
function bindMacroPresetChips() {
  rootEl.querySelectorAll('[data-action="macro-preset"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.value;
      const profile = getActiveProfile();
      profile.macroPreset = key;
      profile.macroTargets = null;
      rootEl.querySelectorAll('[data-action="macro-preset"]').forEach((other) => {
        other.setAttribute('aria-pressed', String(other.dataset.value === key));
      });
    });
  });
}

// Step 4 (Ergebnis) — Tagesbedarf-Slider + Refresh + Theme-Cycle.
function attachStep4Handlers() {
  // Theme-Cycle-Button oben rechts: Auto -> Hell -> Dunkel -> Auto ...
  // Mutiert state.settings.theme direkt und ruft onExternalThemeChange
  // (das applyTheme + saveState triggert), analog zum Settings-Sheet.
  const themeBtn = rootEl.querySelector('[data-action="theme-cycle"]');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = state.settings.theme || 'auto';
      const idx = THEME_CYCLE.indexOf(current);
      const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
      state.settings.theme = next;
      themeBtn.dataset.theme = next;
      themeBtn.innerHTML = themeIconFor(next);
      themeBtn.setAttribute('aria-label', `Erscheinungsbild: ${themeLabelFor(next)} — antippen zum Wechseln`);
      onExternalThemeChange();
    });
  }

  const slider = rootEl.querySelector('[data-action="target-change"]');
  if (slider) {
    slider.addEventListener('input', () => {
      draft.dailyTargetOverride = parseInt(slider.value, 10);
      touched.dailyTargetOverride = true;
      refreshResultDynamic(rootEl, draft);
    });
  }
  const resetBtn = rootEl.querySelector('[data-action="target-reset"]');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      draft.dailyTargetOverride = null;
      touched.dailyTargetOverride = true;
      if (slider) {
        const p = getActiveProfile();
        const fake = {
          gender:        draft.gender        ?? p.gender        ?? DEFAULTS.gender,
          age:           draft.age           ?? p.age           ?? DEFAULTS.age,
          heightCm:      draft.heightCm      ?? p.heightCm      ?? DEFAULTS.heightCm,
          weightKg:      draft.weightKg      ?? p.weightKg      ?? DEFAULTS.weightKg,
          activityLevel: draft.activityLevel ?? p.activityLevel ?? DEFAULTS.activityLevel,
          goal:          draft.goal          ?? p.goal          ?? DEFAULTS.goal,
        };
        const s = dailyTarget(fake);
        if (s != null) slider.value = String(s);
      }
      refreshResultDynamic(rootEl, draft);
    });
  }
}

// Chip-Binding-Helper: Klick setzt Draft + touched, aktualisiert aria-pressed.
function bindChipGroup(action, draftKey, parser) {
  rootEl.querySelectorAll(`[data-action="${action}"]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = parser(btn.dataset.value);
      draft[draftKey] = val;
      touched[draftKey] = true;
      rootEl.querySelectorAll(`[data-action="${action}"]`).forEach((other) => {
        other.setAttribute('aria-pressed', String(parser(other.dataset.value) === val));
      });
    });
  });
}

// Slider-Binding-Helper: setzt Draft + touched auf input, aktualisiert Value-
// Label live.
function bindSlider(action, valueRole, draftKey, formatter) {
  const slider = rootEl.querySelector(`[data-action="${action}"]`);
  const valEl = rootEl.querySelector(`[data-role="${valueRole}"]`);
  if (!slider) return;
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value, 10);
    draft[draftKey] = v;
    touched[draftKey] = true;
    if (valEl) valEl.textContent = formatter(v);
  });
}
