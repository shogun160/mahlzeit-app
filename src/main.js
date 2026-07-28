import { renderHeader } from './dashboard/header.js';
import { renderDashboard } from './dashboard/render.js';
import { rerollAll, rerollDay } from './dashboard/reroll.js';
import { toggleAllSelected } from './dashboard/selection.js';
import { renderShoppingList } from './shopping-list/render.js';
import { resetChecked, checkAll } from './shopping-list/check.js';
import { mountSheet, openSheet } from './sheet/render.js';
import { mountSettingsSheet, openSettingsSheet, refreshProfileListInOpenSheet } from './settings/render.js';
import { mountMacroPopup, openMacroPopup } from './dashboard/macro-popup.js';
import { mountOnboardingWizard, openOnboardingWizard } from './onboarding/wizard.js';
import { mountProfileDetailSheet, openProfileDetailSheet } from './settings/profile-detail-sheet.js';
import { mountProfileShareSheet } from './profile-share/share-sheet.js';
import { mountProfileImportSheet, openProfileImportSheet } from './profile-share/import-sheet.js';
import { mountAddChoiceSheet, openAddChoiceSheet } from './profile-share/add-choice-sheet.js';
import { mountUpdateSheet, openUpdateSheet } from './settings/update-sheet.js';
import { showToast } from './util/toast.js';
import { attachViewSwipe } from './nav/swipe.js';
import { renderBottomNav } from './nav/bottom.js';
import { state, DAYS, setView, loadState, saveState } from './state.js';
import { rebuildDishes } from './data/dishes.js';
import { setNativeNightMode } from './native/theme-plugin.js';
import { installSliderScrollGuard } from './util/slider-guard.js';
import { installOverlayBlur } from './util/overlay-blur.js';
import { Capacitor } from '@capacitor/core';
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';

const headerRoot = document.getElementById('app-header');
const mainEl = document.getElementById('app');
const viewTrack = document.getElementById('view-track');
const dashboardRoot = document.getElementById('view-dashboard');
const shoppingRoot = document.getElementById('view-shopping');
const sheetRoot = document.getElementById('sheet-root');
const settingsRoot = document.getElementById('settings-sheet-root');
const macroPopupRoot = document.getElementById('macro-popup-root');
const onboardingRoot = document.getElementById('onboarding-root');
const profileDetailRoot = document.getElementById('profile-detail-root');
const profileShareSheetRoot = document.getElementById('profile-share-sheet-root');
const profileImportSheetRoot = document.getElementById('profile-import-sheet-root');
const addChoiceSheetRoot = document.getElementById('add-choice-sheet-root');
const updateSheetRoot = document.getElementById('update-sheet-root');
const bottomNavRoot = document.getElementById('bottom-nav');

// Persistierten State laden. Wenn nichts gespeichert (oder JSON kaputt), würfelt
// renderDashboard() beim ersten Render ein frisches Assignment.
loadState();
// Persisted Remote-Rezepte in die exportierten Dish-Bindings uebernehmen,
// bevor Views auf allDishes/dishesById zugreifen. Ohne diesen Call wuerde
// die App nach einem Import-Restart nur die bundled Dishes sehen.
rebuildDishes();
// remoteImageFailures hat 24h-TTL: beim Start wird die Menge immer geleert,
// damit fehlgeschlagene Bild-Downloads am naechsten Tag automatisch neu
// versucht werden. loadState() setzt das Feld schon auf ein leeres Set,
// dieser Kommentar dokumentiert die bewusste Semantik.

// Globaler Guard verhindert dass Slider beim vertikalen Scrollen im Settings-
// Sheet / Onboarding-Wizard versehentlich verstellt werden. Muss vor dem ersten
// Render laufen, wirkt aber via Delegation auch fuer spaeter gemountete Slider.
installSliderScrollGuard();

// Setzt data-theme am <html>-Element auf das *effektive* Theme (light|dark):
// - 'light'/'dark' → direkt uebernehmen
// - 'auto' → aus prefers-color-scheme aufloesen
// Dadurch reicht ein einziger [data-theme="dark"]-Palette-Block in tokens.css;
// der frueher noetige @media-Zweig entfaellt.
// Zusaetzlich auf Android: AppCompatDelegate-NightMode via ThemePlugin kippen
// (damit Bar-Icons folgen) und Bar-Hintergrund via EdgeToEdge auf das aktuelle
// Surface-Token setzen.
// Wird beim App-Start und nach jedem Theme-Toggle in Settings aufgerufen.
const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');

function resolveEffectiveTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  return darkMedia.matches ? 'dark' : 'light';
}

export function applyTheme() {
  const theme = state.settings.theme;
  const effective = resolveEffectiveTheme(theme);
  document.documentElement.setAttribute('data-theme', effective);
  syncNativeTheme(theme);
}

async function syncNativeTheme(theme) {
  if (!Capacitor.isNativePlatform()) return;

  await setNativeNightMode(
    theme === 'dark' ? 'yes' :
    theme === 'light' ? 'no' :
    'follow_system'
  );

  // Ein Frame warten, damit CSS-Media-Query bzw. data-theme umgestellt ist
  // und getComputedStyle die korrekte Surface-Farbe liefert.
  requestAnimationFrame(() => {
    const surface = getComputedStyle(document.documentElement)
      .getPropertyValue('--md-sys-color-surface')
      .trim();
    if (!surface) return;
    try {
      EdgeToEdge.setStatusBarColor({ color: surface });
      EdgeToEdge.setNavigationBarColor({ color: surface });
    } catch (e) {
      console.warn('[theme] edge-to-edge color update failed', e);
    }
  });
}

// Bei "Auto" bei System-Wechsel neu triggern, damit Bar-Farben live folgen.
// Bei explizitem Light/Dark ignorieren.
darkMedia.addEventListener?.('change', () => {
  if (state.settings.theme === 'auto') applyTheme();
});

applyTheme();

function refresh() {
  // Header ist view-abhängig — Dashboard-Actions vs. Shopping-Reset.
  renderHeader(headerRoot, {
    view: state.view,
    onRerollAll: () => {
      rerollAll();
      refresh();
      // Nach dem Neu-Rollen der Woche zurueck an den Anfang scrollen —
      // sonst bleibt der User auf einer beliebigen Card-Position stehen
      // und sieht die neue Woche nur teilweise. Scroll passiert auf dem
      // View-Element, weil body/main overflow:hidden haben (siehe base.css).
      const view = document.getElementById('view-dashboard');
      if (view) view.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onToggleAllSelected: () => {
      toggleAllSelected();
      refresh();
    },
    onOpenSettings: () => {
      openSettingsSheet();
    },
    onResetChecked: () => {
      resetChecked();
      refresh();
    },
    onCheckAll: (keys, cats) => {
      checkAll(keys);
      // Alle betroffenen Kategorien collapsen — die Liste ist erledigt,
      // eingeklappt spart Scrollflaeche und signalisiert den Zustand klar.
      if (Array.isArray(cats)) {
        for (const c of cats) state.collapsedCategories.add(c);
      }
      refresh();
    },
    onGoDashboard: () => {
      setView('dashboard');
      refresh();
    },
  });

  // Beide Views immer rendern: der Swipe braucht den Zielinhalt sofort sichtbar.
  // Sheet-Callbacks: dishId wird vom Sheet aus state.assignment[day] gelesen —
  // die uebergebene dishId hier ist historisch, wird nicht mehr genutzt.
  renderDashboard(
    dashboardRoot,
    refresh,
    (_dishId, tab, day) => openSheet({ mode: 'detail', day, tab }),
    (day) => openSheet({ mode: 'picker', day }),
    openMacroPopup,
    openOnboardingWizard,
  );
  renderShoppingList(shoppingRoot, { onChange: refresh });

  // Bottom-Nav: aktiver Tab + Badge sind state-abhängig, deshalb pro refresh() neu.
  renderBottomNav(bottomNavRoot, {
    onNavigate: (next) => {
      setView(next);
      refresh();
    },
  });

  // Track slidet per CSS-Attribut-Selektor auf `data-view`.
  viewTrack.dataset.view = state.view;

  // Auto-Save nach jedem Render — zentraler Punkt.
  saveState();
}

// Sheets einmalig mounten. Sheet triggert bei internen Änderungen ein
// refresh() (Card-Badges, Shopping-Mengen). Settings-Sheet auch — Änderungen
// dort (Standard-Portionen, Kochzeit) sollen mindestens saveState triggern.
// onPick uebernimmt die Post-Pick-Semantik: assignment setzen, Auto-Select
// fuer die Einkaufsliste, Doppelbelegungen auf anderen Tagen aufloesen.
mountSheet(sheetRoot, {
  onChange: refresh,
  onPick: (day, dishId) => {
    state.assignment[day] = dishId;
    // Auto-Select: bewusstes Umwaehlen ist ein starkes Signal, dass der User
    // das Gericht wirklich kochen will → Tag landet automatisch auf der
    // Einkaufsliste. checkedShopping bleibt unangetastet — bereits gekaufte
    // Artikel bleiben abgehakt, auch wenn sie im neuen Gericht wieder
    // auftauchen.
    state.selected[day] = true;
    // Doppelbelegung aufloesen: jeder andere Tag mit demselben Gericht wird
    // neu ausgelost. Reihenfolge wichtig — assignment[day] steht bereits auf
    // dishId, sodass rerollDay das gewaehlte Gericht via usedElsewhere
    // ausschliesst und einen echten Wechsel liefert.
    for (const otherDay of DAYS) {
      if (otherDay === day) continue;
      if (state.assignment[otherDay] === dishId) {
        rerollDay(otherDay);
      }
    }
    refresh();
  },
});
mountSettingsSheet(settingsRoot, {
  onChange: refresh,
  onOpenOnboarding: () => openOnboardingWizard(),
  onOpenProfileDetail: (profileId) => openProfileDetailSheet(profileId),
  onAddProfile: () => openAddChoiceSheet({
    onManualChoice: () => openOnboardingWizard({ addProfile: true }),
    onImportChoice: (mode) => openProfileImportSheet({
      mode,
      onImported: () => {
        refreshProfileListInOpenSheet();
        refresh();
      },
    }),
  }),
  onThemeChange: () => {
    applyTheme();
    saveState();
  },
});
mountProfileDetailSheet(profileDetailRoot, {
  onChange: () => {
    refresh();
    // Profil-Liste im Settings-Sheet aktualisieren, falls es noch offen ist
    // (Aktiv-Wechsel/Delete/Name-Aenderung reflektieren sich in der Liste).
    refreshProfileListInOpenSheet();
  },
});
mountProfileShareSheet(profileShareSheetRoot);
mountProfileImportSheet(profileImportSheetRoot);
mountAddChoiceSheet(addChoiceSheetRoot);
mountUpdateSheet(updateSheetRoot, {
  onChange: refresh,
  showToast: (msg) => showToast(msg),
});
mountMacroPopup(macroPopupRoot, {
  onOpenDetail: (_dishId, tab, day) => openSheet({ mode: 'detail', day, tab }),
  onChange: refresh,
});
mountOnboardingWizard(onboardingRoot, {
  onChange: refresh,
  onThemeChange: () => {
    applyTheme();
    saveState();
  },
});

// Screen-Swipe einmalig mounten — nutzt state.view aus dem Modul.
attachViewSwipe(mainEl, {
  onViewChange: (next) => {
    setView(next);
    refresh();
  },
});

// Overlay-Blur: setzt body.has-open-overlay sobald ein Sheet/Overlay sichtbar
// ist. Muss NACH allen mount*()-Calls laufen, damit die Sheet-Roots bereits
// hidden=true gesetzt haben — sonst wird der initial-state als "alles offen"
// interpretiert und das Dashboard permanent geblurrt.
installOverlayBlur();

refresh();

// Debug-Bridge nur im Dev-Mode: erlaubt Console-Zugriff auf state/refresh
// zum manuellen Testen von Remote-Import-Flows. Wird von Vite im Prod-Build
// ge-tree-shaked (import.meta.env.DEV ist dann false).
if (import.meta.env.DEV) {
  window.__dbg = { state, refresh, setView };
}

// Remote-Rezept-Auto-Check: laueft asynchron im Hintergrund, blockiert
// den ersten Render nicht. Wenn neue Rezepte gefunden werden, setzt der
// Check state.remoteHasUpdates=true und triggert einen refresh() damit
// der Badge am Burger-Icon erscheint.
import('./data/remote-updates.js').then(({ performAutoCheck }) => {
  performAutoCheck().then(() => {
    if (state.remoteHasUpdates) refresh();
  }).catch(() => { /* silent */ });
});

// Onboarding-Auto-Open beim allerersten App-Start. Wizard setzt onboardingSeen
// sofort auf true (in openOnboardingWizard selbst), damit auch ein Crash
// während des Wizards kein Re-Trigger auslöst. Ab dem zweiten Start kommt der
// Wizard nur noch via Placeholder-Pille oder Settings > Daten > Einrichtung.
if (state.settings.onboardingSeen === false) {
  openOnboardingWizard();
}
