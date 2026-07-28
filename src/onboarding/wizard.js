import { state, getActiveProfile, getProfileById, getStandardProfile, addProfile, removeProfile, saveState, setActiveProfileId } from '../state.js';
import { openProfileImportSheet } from '../profile-share/import-sheet.js';
import { isScannerAvailable } from '../profile-share/scanner.js';
import { AGE_MIN, AGE_MAX, ACTIVITY_LEVELS, DINNER_MIN_KCAL, dailyTarget, dinnerTarget, kcalRange, kcalRangeRounded, effectiveDailyTarget } from '../nutrition/target.js';
import { showToast } from '../util/toast.js';
import { rerollAll } from '../dashboard/reroll.js';
import { renderStep1, renderStep2, renderStep3, DEFAULTS } from './steps.js';
import { renderStep5 as renderStep4, refreshResultDynamic, resolvedProfile, macrosForKcal, renderMacros, THEME_CYCLE, themeIconFor, themeLabelFor } from './result.js';

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
// True wenn das editingProfile in diesem Wizard-Lauf frisch erstellt wurde
// (addProfile-Modus oder Erst-Setup ohne bestehende Profile). Bei
// persistAndClose vor Fertig wird das Profil wieder entfernt — Fresh Install
// bleibt sauber leer, Add-Modus fuegt kein halbfertiges Profil in die Liste.
let wasNewlyCreated = false;
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

// Snapshot vom draft zum Zeitpunkt des Wizard-Starts (fuer Reset-Button).
// undoStack sammelt draft-Snapshots pro Step-Wechsel; Undo rollt auf den
// letzten Snapshot zurueck.
let initialDraft = {};
let undoStack = [];

function snapshotDraft() {
  return JSON.parse(JSON.stringify(draft));
}
// Snapshot enthaelt draft PLUS die Profil-Felder die im Wizard direkt am
// Profil mutiert werden (Prefs, Cuisines, macroPreset — vs. draft-basiert).
function snapshotAll() {
  const p = getEditingProfile();
  return {
    draft: snapshotDraft(),
    prefs: p?.preferences ? { ...p.preferences } : null,
    cuisines: p?.cuisines ? { ...p.cuisines } : null,
    macroPreset: p?.macroPreset ?? null,
  };
}
function pushUndo() {
  undoStack.push(snapshotAll());
}
function restoreFromSnapshot(snap) {
  if (!snap) return;
  draft = snap.draft;
  const p = getEditingProfile();
  if (p) {
    if (snap.prefs) p.preferences = { ...snap.prefs };
    if (snap.cuisines) p.cuisines = { ...snap.cuisines };
    p.macroPreset = snap.macroPreset;
  }
}

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
    dinnerKcalOverride: p.dinnerKcalOverride,
  };
  touched = {
    name: false, gender: false, age: false, heightCm: false, weightKg: false,
    defaultPortions: false,
    activityLevel: false, goal: false, breakfastKcal: false, lunchKcal: false,
    dailyTargetOverride: false, dinnerKcalOverride: false,
  };
  initialDraft = snapshotAll();
  undoStack = [];
}

function isSubProfileWizard() {
  return editingProfileId != null;
}

// Neuer User bekommt initial die Werte des Standard-Profils — nicht ein
// vollstaendig leeres Profil. Damit hat der Wizard schon bei "Weiter"
// sinnvolle Startwerte, statt DEFAULTS-Fallbacks aus steps.js. Callsites:
// openOnboardingWizard({addProfile:true}) und startSubProfileWizard().
function addProfileFromStandard() {
  const s = getStandardProfile() || {};
  return addProfile({
    gender:              s.gender,
    age:                 s.age,
    heightCm:            s.heightCm,
    weightKg:            s.weightKg,
    activityLevel:       s.activityLevel,
    goal:                s.goal,
    breakfastKcal:       s.breakfastKcal,
    lunchKcal:           s.lunchKcal,
    dailyTargetOverride: s.dailyTargetOverride,
    dinnerKcalOverride:  s.dinnerKcalOverride,
    preferences:         s.preferences ? { ...s.preferences } : undefined,
    cuisines:            s.cuisines ? { ...s.cuisines } : undefined,
    macroPreset:         s.macroPreset,
  });
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
  wasNewlyCreated = false;
  personIndex = 1;
  showFollowup = false;
  suppressFollowup = false;
  currentStep = 1;

  const noProfiles = !Array.isArray(state.settings.profiles) || state.settings.profiles.length === 0;

  if (opts.addProfile || (noProfiles && !opts.editProfileId)) {
    // Add-Modus aus Settings ODER Erst-Setup ohne Profile: neues Profil mit
    // Standard-Werten anlegen. Bei X-Klick vor Fertig (persistAndClose) wird
    // es via wasNewlyCreated wieder entfernt — Add-Modus laesst kein
    // halbfertiges Profil, Fresh Install bleibt sauber leer.
    const p = addProfileFromStandard();
    editingProfileId = p.id;
    wasNewlyCreated = true;
    suppressFollowup = opts.addProfile === true;
    initDraftFromProfile(p);
  } else if (opts.editProfileId) {
    // Edit-Modus fuer ein bestehendes Profil (aus Profil-Detail-Sheet "Ändern").
    // Draft startet mit den aktuellen Werten. Kein Follow-up — der User will
    // dieses eine Profil bearbeiten, nicht die Personen-Zahl vollmachen.
    const p = getProfileById(opts.editProfileId);
    if (p) {
      editingProfileId = p.id;
      suppressFollowup = true;
      initDraftFromProfile(p);
    } else {
      initDraftFromProfile(getActiveProfile());
    }
  } else {
    initDraftFromProfile(getActiveProfile());
  }

  // Welcome-Screen nur beim First-Run (nicht bei add/edit aus Settings — dort
  // hat der User schon bewusst geklickt, ein zweiter Choice-Screen waere redundant).
  showWelcome = !opts.addProfile && !opts.editProfileId;

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
  // Neu erstelltes Profil (Add-Modus oder Fresh Install ohne Fertig) —
  // wir entfernen es wieder, damit kein halbfertiger Eintrag bleibt.
  // Der User schliesst bewusst ohne Fertig; alle draft-Aenderungen fallen weg.
  if (wasNewlyCreated && editingProfileId) {
    removeProfile(editingProfileId, { force: true });
    editingProfileId = null;
    wasNewlyCreated = false;
    saveState();
    onExternalChange();
    closeOnboardingWizard();
    return;
  }
  const p = getEditingProfile();
  if (!p) {
    closeOnboardingWizard();
    return;
  }
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
  if (!p) {
    closeOnboardingWizard();
    return;
  }
  // Neu erstelltes Profil bekommt jetzt die Draft-Werte als endgueltigen
  // Save (kein Rollback mehr in persistAndClose).
  wasNewlyCreated = false;
  for (const key of Object.keys(draft)) {
    if (key === 'name' || key === 'dailyTargetOverride' || key === 'dinnerKcalOverride' || key === 'breakfastKcal' || key === 'lunchKcal') {
      // Diese Felder duerfen null bleiben: null = kein manueller Override →
      // Standard-Regel greift (35 % Dinner ohne Fr/Mi-Aufteilung).
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
  // Nach Fertig: Woche neu ausdulesen — die Praeferenzen des Users haben
  // sich veraendert (Ziel, Aktivitaet, Prefs, Kuechen) und der bisherige
  // Wochenplan spiegelt sie evtl. nicht mehr.
  rerollAll();
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
  const p = addProfileFromStandard();
  editingProfileId = p.id;
  wasNewlyCreated = true;
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
            <div class="onboarding-header__actions">
              <button class="onboarding-header__icon-btn" type="button" data-action="undo" title="Letzten Schritt rückgängig" aria-label="Letzten Schritt rückgängig">
                <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z"/></svg>
              </button>
              <button class="onboarding-header__icon-btn" type="button" data-action="reset-draft" title="Auf Ausgangswerte zurücksetzen" aria-label="Auf Ausgangswerte zurücksetzen">
                <svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>
              </button>
            </div>
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
        <button class="btn btn--secondary wizard-welcome__btn" type="button" data-action="welcome-paste">Text einfügen</button>
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

  // Undo: draft auf den letzten Snapshot zuruecksetzen (Snapshot wird bei
  // jedem Step-Wechsel gespeichert — Undo rollt damit den aktuellen Step
  // komplett zurueck). Bei leerem Stack disabled.
  const undoBtn = rootEl.querySelector('[data-action="undo"]');
  if (undoBtn) {
    undoBtn.disabled = undoStack.length === 0;
    undoBtn.addEventListener('click', () => {
      if (undoStack.length === 0) return;
      restoreFromSnapshot(undoStack.pop());
      renderShell();
      rootEl.querySelector('.onboarding-overlay')?.classList.add('is-open');
    });
  }

  // Reset: draft + profil-basierte Wizard-Felder (Prefs/Cuisines/macroPreset)
  // auf den initialen Snapshot zuruecksetzen und undoStack leeren.
  const resetDraftBtn = rootEl.querySelector('[data-action="reset-draft"]');
  if (resetDraftBtn) resetDraftBtn.addEventListener('click', () => {
    restoreFromSnapshot(JSON.parse(JSON.stringify(initialDraft)));
    undoStack = [];
    renderShell();
    rootEl.querySelector('.onboarding-overlay')?.classList.add('is-open');
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
    pushUndo();
    currentStep++;
    renderShell();
  }
}

function goBack() {
  if (currentStep > 1) {
    pushUndo();
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
  const openImport = (mode) => () => {
    try {
      openProfileImportSheet({
        mode,
        onImported: (importedProfile) => onWizardImported(importedProfile),
      });
    } catch (e) {
      // Sichtbarer Fallback, sonst wuerde eine geworfene Exception im Handler
      // still verschluckt und der User sieht gar nichts.
      import('../util/toast.js').then(({ showToast }) => {
        showToast('Import konnte nicht gestartet werden: ' + (e?.message ?? e), { tone: 'error', duration: 5000 });
      });
    }
  };
  rootEl.querySelector('[data-action="welcome-scan"]')?.addEventListener('click', openImport('scan'));
  rootEl.querySelector('[data-action="welcome-paste"]')?.addEventListener('click', openImport('paste'));
}

function onWizardImported(importedProfile) {
  // Wenn wir vorher ein Profil frisch angelegt haben (Sub-Wizzard oder
  // Erst-Setup ohne bestehende Profile), entfernen wir es jetzt zugunsten
  // des importierten.
  if (wasNewlyCreated && editingProfileId && editingProfileId !== importedProfile.id) {
    removeProfile(editingProfileId, { force: true });
    wasNewlyCreated = false;
  }
  if (isSubProfileWizard()) {
    editingProfileId = importedProfile.id;
    maybeShowFollowupOrClose();
  } else {
    // First-Run oder Edit: importedProfile ans erste Slot ziehen (aktives Profil).
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

  const fmtKcal = (v) => `${(v ?? 0).toLocaleString('de-DE')} kcal`;
  const bfSlider = rootEl.querySelector('[data-action="breakfast-change"]');
  const luSlider = rootEl.querySelector('[data-action="lunch-change"]');
  const dinnerSlider = rootEl.querySelector('[data-action="dinner-override-change"]');
  const bfValEl = rootEl.querySelector('[data-role="breakfast-value"]');
  const luValEl = rootEl.querySelector('[data-role="lunch-value"]');
  const dinnerValEl = rootEl.querySelector('[data-role="dinner-preview-value"]');
  const profiDetails = rootEl.querySelector('[data-role="profi-details"]');

  const currentDaily = () => effectiveDailyTarget(resolvedProfile(draft));
  const currentDinner = () => dinnerTarget(resolvedProfile(draft));

  const renderDinnerRange = () => {
    if (!dinnerValEl) return;
    const dinner = currentDinner();
    if (dinner == null) { dinnerValEl.textContent = '—'; return; }
    const range = kcalRangeRounded(dinner);
    if (!range) { dinnerValEl.textContent = `${dinner.toLocaleString('de-DE')} kcal`; return; }
    dinnerValEl.innerHTML = `${range[0].toLocaleString('de-DE')}&thinsp;–&thinsp;${range[1].toLocaleString('de-DE')} kcal`;
  };

  const syncDinnerSlider = () => {
    if (!dinnerSlider) return;
    const dinner = currentDinner();
    if (dinner != null) dinnerSlider.value = String(dinner);
  };

  // Sollwerte fuer Fr/Mi als 25 % / 35 % des Daily (rounded 10). Auch die
  // Referenzwerte fuer den Reset-Button.
  const sollFr = (daily) => Math.round(daily * 0.25 / 10) * 10;
  const sollMi = (daily) => Math.round(daily * 0.35 / 10) * 10;

  // Fr/Mi anpassen wenn Dinner sich aendert. Regel:
  //  - Delta = target(neu) − aktuell(Fr+Mi). Vorzeichen entscheidet Richtung.
  //  - Wachsen (Dinner ↓): erst die unter-Sollwert-Seiten bis auf Sollwert
  //    fuellen (proportional zu ihren Fehlbetraegen), dann Rest gleichmaessig.
  //  - Schrumpfen (Dinner ↑): erst die ueber-Sollwert-Seiten bis auf Sollwert
  //    reduzieren (proportional zu ihrem Ueberhang), dann Rest gleichmaessig.
  // Damit greift die Aenderung zuerst da, wo Abstand zum Sollwert am
  // groessten ist — die aktuelle Aufteilung wird respektiert.
  const round10 = (n) => Math.round(n / 10) * 10;
  const distributeFrLu = (dinner, daily) => {
    const target = Math.max(0, daily - dinner);
    const currFr = draft.breakfastKcal ?? 0;
    const currLu = draft.lunchKcal ?? 0;
    const currSum = currFr + currLu;
    const delta = target - currSum;
    if (delta === 0) return { fr: currFr, lu: currLu };
    const sF = sollFr(daily);
    const sM = sollMi(daily);
    if (delta > 0) {
      const frGap = Math.max(0, sF - currFr);
      const luGap = Math.max(0, sM - currLu);
      const gapSum = frGap + luGap;
      if (gapSum > 0 && delta <= gapSum) {
        const r = delta / gapSum;
        return { fr: currFr + round10(frGap * r), lu: currLu + round10(luGap * r) };
      }
      const remainder = delta - gapSum;
      const half = round10(remainder / 2);
      return { fr: currFr + frGap + half, lu: currLu + luGap + half };
    }
    const abs = -delta;
    const frOver = Math.max(0, currFr - sF);
    const luOver = Math.max(0, currLu - sM);
    const overSum = frOver + luOver;
    if (overSum > 0 && abs <= overSum) {
      const r = abs / overSum;
      return {
        fr: Math.max(0, currFr - round10(frOver * r)),
        lu: Math.max(0, currLu - round10(luOver * r)),
      };
    }
    const remainder = abs - overSum;
    const half = round10(remainder / 2);
    return {
      fr: Math.max(0, currFr - frOver - half),
      lu: Math.max(0, currLu - luOver - half),
    };
  };

  const applyFrLu = (fr, lu) => {
    draft.breakfastKcal = fr > 0 ? fr : null;
    draft.lunchKcal = lu > 0 ? lu : null;
    if (bfSlider) bfSlider.value = String(fr);
    if (luSlider) luSlider.value = String(lu);
    if (bfValEl) bfValEl.textContent = fmtKcal(fr);
    if (luValEl) luValEl.textContent = fmtKcal(lu);
  };

  const resetBtn = rootEl.querySelector('[data-action="profi-reset"]');
  const updateResetVisibility = () => {
    if (!resetBtn) return;
    const daily = currentDaily();
    if (daily == null) { resetBtn.hidden = true; return; }
    const overrideSet = draft.dinnerKcalOverride != null;
    const frDeviates = draft.breakfastKcal != null && Math.abs((draft.breakfastKcal ?? 0) - sollFr(daily)) > 15;
    const luDeviates = draft.lunchKcal != null && Math.abs((draft.lunchKcal ?? 0) - sollMi(daily)) > 15;
    resetBtn.hidden = !(overrideSet || frDeviates || luDeviates);
  };

  // Dinner-Slider hat immer Vorrang: Fr/Mi werden automatisch nachgeregelt
  // in Richtung Sollwerte (25/35 % vom Daily). Untergrenze DINNER_MIN_KCAL,
  // Obergrenze = daily.
  if (dinnerSlider) {
    dinnerSlider.addEventListener('input', () => {
      let v = parseInt(dinnerSlider.value, 10);
      const daily = currentDaily();
      if (v < DINNER_MIN_KCAL) {
        v = DINNER_MIN_KCAL;
        dinnerSlider.value = String(v);
        showToast('Abendessen kann nicht kleiner als 500 kcal sein.');
      }
      if (daily != null && v > daily) {
        v = Math.floor(daily / 10) * 10;
        dinnerSlider.value = String(v);
        showToast('Abendessen überschreitet dein Tagesbedarf.');
      }
      draft.dinnerKcalOverride = v;
      if (daily != null) {
        const { fr, lu } = distributeFrLu(v, daily);
        applyFrLu(fr, lu);
      }
      renderDinnerRange();
      updateResetVisibility();
    });
  }

  // Reset-Klick: Fr/Mi auf Sollwerte, Override raus. Fallback wenn daily
  // klein: anteilige Reduktion damit Dinner nicht unter 500 kcal faellt.
  if (resetBtn) {
    resetBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const daily = currentDaily();
      if (daily == null) return;
      let fr = sollFr(daily);
      let lu = sollMi(daily);
      if (fr + lu > daily - DINNER_MIN_KCAL) {
        const room = Math.max(0, daily - DINNER_MIN_KCAL);
        const ratio = room / (fr + lu);
        fr = Math.floor(fr * ratio / 10) * 10;
        lu = Math.floor(lu * ratio / 10) * 10;
      }
      draft.dinnerKcalOverride = null;
      applyFrLu(fr, lu);
      renderDinnerRange();
      syncDinnerSlider();
      updateResetVisibility();
    });
  }

  // Fr/Mi-Slider: setzen breakfastKcal/lunchKcal, dinnerKcalOverride wird
  // gecleart, damit die Standard-/Profi-Berechnung greift. Constraint:
  // Fr+Mi darf nicht so gross sein, dass Dinner unter DINNER_MIN_KCAL faellt.
  const bindMealClampSlider = (slider, valEl, otherKey, myKey) => {
    if (!slider) return;
    slider.addEventListener('input', () => {
      let v = parseInt(slider.value, 10);
      const daily = currentDaily() ?? Infinity;
      const other = draft[otherKey] ?? 0;
      const maxAllowed = Math.max(0, daily - other - DINNER_MIN_KCAL);
      if (v > maxAllowed) {
        v = Math.floor(maxAllowed / 10) * 10;
        slider.value = String(v);
        showToast('Frühstück + Mittag würden dein Abendessen unter 500 kcal drücken.');
      }
      draft[myKey] = v > 0 ? v : null;
      draft.dinnerKcalOverride = null; // Profi-Werte gewinnen jetzt
      if (valEl) valEl.textContent = fmtKcal(v);
      renderDinnerRange();
      syncDinnerSlider();
      updateResetVisibility();
    });
  };
  bindMealClampSlider(bfSlider, bfValEl, 'lunchKcal', 'breakfastKcal');
  bindMealClampSlider(luSlider, luValEl, 'breakfastKcal', 'lunchKcal');

  // Wenn User Profi zum ersten Mal aufklappt und noch keine Fr/Mi-Werte im
  // draft sind: init mit DGE-Verteilung (Fr 25 %, Mi 35 %, Snacks 5 %
  // vorgehalten → Abendessen ~35 %). Danach Slider + Anzeige nachziehen.
  if (profiDetails) {
    profiDetails.addEventListener('toggle', () => {
      if (!profiDetails.open) return;
      if (draft.breakfastKcal != null && draft.breakfastKcal > 0) return;
      if (draft.lunchKcal != null && draft.lunchKcal > 0) return;
      const daily = currentDaily();
      if (daily == null) return;
      // Fr+Mi so setzen dass der aktuell angezeigte Dinner-Wert erhalten
      // bleibt (kein Sprung beim Aufklappen). Verteilung 25:35 der DGE bleibt
      // aber gewahrt — beide werden proportional aus dem verfuegbaren Rest
      // (daily - dinner) berechnet.
      const dinnerNow = currentDinner();
      const room = Math.max(0, daily - (dinnerNow ?? Math.round(daily * 0.35)));
      let bfFinal = Math.round(room * (25 / 60) / 10) * 10;
      let luFinal = Math.round(room * (35 / 60) / 10) * 10;
      // Constraint sichern: falls Fr+Mi den 500-Rand doch reissen.
      if (bfFinal + luFinal > daily - DINNER_MIN_KCAL) {
        const cap = Math.max(0, daily - DINNER_MIN_KCAL);
        const ratio = cap / (bfFinal + luFinal);
        bfFinal = Math.floor(bfFinal * ratio / 10) * 10;
        luFinal = Math.floor(luFinal * ratio / 10) * 10;
      }
      draft.breakfastKcal = bfFinal;
      draft.lunchKcal = luFinal;
      draft.dinnerKcalOverride = null;
      if (bfSlider) bfSlider.value = String(bfFinal);
      if (luSlider) luSlider.value = String(luFinal);
      if (bfValEl) bfValEl.textContent = fmtKcal(bfFinal);
      if (luValEl) luValEl.textContent = fmtKcal(luFinal);
      renderDinnerRange();
      syncDinnerSlider();
      updateResetVisibility();
    });
  }

  // Aktivitaet + Ziel aendern das Daily und damit den Dinner-Wert (im
  // Standard-Modus). Manuellen Override clearen, Slider mitziehen.
  const onCalculationChange = () => {
    draft.dinnerKcalOverride = null;
    renderDinnerRange();
    syncDinnerSlider();
    updateResetVisibility();
  };
  rootEl.querySelectorAll('[data-action="goal-pick"]').forEach((btn) => {
    btn.addEventListener('click', onCalculationChange);
  });
  rootEl.querySelectorAll('[data-action="activity-change"]').forEach((slider) => {
    slider.addEventListener('input', onCalculationChange);
  });

  renderDinnerRange();
  syncDinnerSlider();
  updateResetVisibility();
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
    slot.innerHTML = renderMacros(macros, { withLabel: false });
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
      pushUndo();
      bucket[key] = !bucket[key];
      btn.setAttribute('aria-pressed', String(!!bucket[key]));
      updateUndoButtonState();
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
      pushUndo();
      bucket[key] = !bucket[key];
      btn.setAttribute('aria-pressed', String(!!bucket[key]));
      updateUndoButtonState();
    });
  });
}

// Makro-Preset: exklusive Chip-Gruppe. Klick setzt profile.macroPreset,
// löscht profile.macroTargets (Custom-Override aus Makro-Popup vergessen).
function bindMacroPresetChips() {
  rootEl.querySelectorAll('[data-action="macro-preset"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.value;
      const profile = getEditingProfile();
      if (profile.macroPreset === key) return;
      pushUndo();
      profile.macroPreset = key;
      profile.macroTargets = null;
      rootEl.querySelectorAll('[data-action="macro-preset"]').forEach((other) => {
        other.setAttribute('aria-pressed', String(other.dataset.value === key));
      });
      updateUndoButtonState();
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
  // "Weiteres Profil hinzufuegen" — persistiert den aktuellen Draft und
  // startet einen Sub-Wizzard fuer ein neu angelegtes Profil.
  const addAnotherBtn = rootEl.querySelector('[data-action="add-another-user"]');
  if (addAnotherBtn) {
    addAnotherBtn.addEventListener('click', () => {
      const p = getEditingProfile();
      if (!p) return;
      // Aktuellen Draft in das (frisch erstellte) Profil schreiben. Damit
      // gilt es als committed — Sub-Wizzard darf es beim Rollback nicht mehr
      // entfernen, deshalb wasNewlyCreated=false BEVOR startSubProfileWizard
      // den Flag fuer das naechste Profil wieder auf true setzt.
      for (const key of Object.keys(draft)) {
        if (key === 'name' || key === 'dailyTargetOverride' || key === 'dinnerKcalOverride' || key === 'breakfastKcal' || key === 'lunchKcal') {
          p[key] = draft[key];
        } else if (key === 'defaultPortions') {
          if (!isSubProfileWizard()) {
            state.settings.defaultPortions = draft[key] ?? DEFAULTS.defaultPortions;
          }
        } else {
          p[key] = draft[key] ?? DEFAULTS[key];
        }
      }
      wasNewlyCreated = false;
      saveState();
      onExternalChange();
      startSubProfileWizard();
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
      if (draft[draftKey] === val) return;
      pushUndo();
      draft[draftKey] = val;
      touched[draftKey] = true;
      rootEl.querySelectorAll(`[data-action="${action}"]`).forEach((other) => {
        other.setAttribute('aria-pressed', String(parser(other.dataset.value) === val));
      });
      updateUndoButtonState();
    });
  });
}

// Slider-Binding-Helper: setzt Draft + touched auf input, aktualisiert Value-
// Label live. Undo-Snapshot einmal pro Drag (auf pointerdown) — so wird nicht
// jede Zwischenposition auf den Stack gepusht.
function bindSlider(action, valueRole, draftKey, formatter) {
  const slider = rootEl.querySelector(`[data-action="${action}"]`);
  const valEl = rootEl.querySelector(`[data-role="${valueRole}"]`);
  if (!slider) return;
  slider.addEventListener('pointerdown', () => {
    pushUndo();
    updateUndoButtonState();
  });
  slider.addEventListener('input', () => {
    const v = parseInt(slider.value, 10);
    draft[draftKey] = v;
    touched[draftKey] = true;
    if (valEl) valEl.textContent = formatter(v);
  });
}

// Undo-Button live disabled/enabled halten wenn sich der Stack aendert.
function updateUndoButtonState() {
  const btn = rootEl?.querySelector('[data-action="undo"]');
  if (btn) btn.disabled = undoStack.length === 0;
}
