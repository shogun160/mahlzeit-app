import { renderHeader } from './dashboard/header.js';
import { renderDashboard } from './dashboard/render.js';
import { rerollAll, rerollDay } from './dashboard/reroll.js';
import { toggleAllSelected } from './dashboard/selection.js';
import { renderShoppingList } from './shopping-list/render.js';
import { resetChecked, checkAll } from './shopping-list/check.js';
import { mountDetailSheet, openDetailSheet } from './detail-sheet/render.js';
import { mountSettingsSheet, openSettingsSheet, refreshProfileListInOpenSheet } from './settings/render.js';
import { mountDishPicker, openDishPicker } from './dish-picker/render.js';
import { mountMacroPopup, openMacroPopup } from './dashboard/macro-popup.js';
import { mountOnboardingWizard, openOnboardingWizard } from './onboarding/wizard.js';
import { mountProfileDetailSheet, openProfileDetailSheet } from './settings/profile-detail-sheet.js';
import { attachViewSwipe } from './nav/swipe.js';
import { renderBottomNav } from './nav/bottom.js';
import { state, DAYS, setView, loadState, saveState } from './state.js';
import { setNativeNightMode } from './native/theme-plugin.js';
import { installSliderScrollGuard } from './util/slider-guard.js';
import { Capacitor } from '@capacitor/core';
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';

const headerRoot = document.getElementById('app-header');
const mainEl = document.getElementById('app');
const viewTrack = document.getElementById('view-track');
const dashboardRoot = document.getElementById('view-dashboard');
const shoppingRoot = document.getElementById('view-shopping');
const sheetRoot = document.getElementById('detail-sheet-root');
const settingsRoot = document.getElementById('settings-sheet-root');
const pickerRoot = document.getElementById('dish-picker-root');
const macroPopupRoot = document.getElementById('macro-popup-root');
const onboardingRoot = document.getElementById('onboarding-root');
const profileDetailRoot = document.getElementById('profile-detail-root');
const bottomNavRoot = document.getElementById('bottom-nav');

// Persistierten State laden. Wenn nichts gespeichert (oder JSON kaputt), würfelt
// renderDashboard() beim ersten Render ein frisches Assignment.
loadState();

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
  renderDashboard(dashboardRoot, refresh, openDetailSheet, openDishPicker, openMacroPopup, openOnboardingWizard);
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

// Sheets einmalig mounten. Detail-Sheet triggert bei internen Änderungen ein
// refresh() (Card-Badges, Shopping-Mengen). Settings-Sheet auch — Änderungen
// dort (Standard-Portionen, Kochzeit) sollen mindestens saveState triggern.
mountDetailSheet(sheetRoot, { onChange: refresh });
mountSettingsSheet(settingsRoot, {
  onChange: refresh,
  onOpenOnboarding: () => openOnboardingWizard(),
  onOpenProfileDetail: (profileId) => openProfileDetailSheet(profileId),
  onAddProfile: () => openOnboardingWizard({ addProfile: true }),
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
mountMacroPopup(macroPopupRoot, {
  onOpenDetail: (dishId, tab, day) => openDetailSheet(dishId, tab, day),
  onChange: refresh,
});
mountOnboardingWizard(onboardingRoot, {
  onChange: refresh,
  onThemeChange: () => {
    applyTheme();
    saveState();
  },
});

// Dish-Picker: onPick mutiert das Assignment für den gewählten Tag und würfelt
// alle anderen Tage, die dasselbe Gericht hatten, automatisch neu — sonst wäre
// das Gericht zweifach im Dashboard.
mountDishPicker(pickerRoot, {
  onPick: (day, dishId) => {
    state.assignment[day] = dishId;
    // Auto-Select: bewusstes Umwählen ist ein starkes Signal, dass der User
    // das Gericht wirklich kochen will → Tag landet automatisch auf der
    // Einkaufsliste. Wenn schon selected, ändert sich nichts.
    // Wichtig: checkedShopping bleibt unangetastet — bereits gekaufte Artikel
    // bleiben abgehakt, auch wenn sie im neuen Gericht (oder als Leftover)
    // wieder auftauchen.
    state.selected[day] = true;
    // Doppelbelegung auflösen: jeder andere Tag mit demselben Gericht wird
    // neu ausgelost. Reihenfolge ist wichtig — assignment[day] steht bereits
    // auf dishId, sodass rerollDay das gewählte Gericht via usedElsewhere
    // ausschließt und einen echten Wechsel liefert. Der reroll setzt den
    // anderen Tag zusätzlich auf selected=false; das trifft im Regelfall
    // ohnehin nur zu (nur solche Tage waren im Picker klickbar).
    for (const otherDay of DAYS) {
      if (otherDay === day) continue;
      if (state.assignment[otherDay] === dishId) {
        rerollDay(otherDay);
      }
    }
    refresh();
  },
});

// Screen-Swipe einmalig mounten — nutzt state.view aus dem Modul.
attachViewSwipe(mainEl, {
  onViewChange: (next) => {
    setView(next);
    refresh();
  },
});

refresh();

// Onboarding-Auto-Open beim allerersten App-Start. Wizard setzt onboardingSeen
// sofort auf true (in openOnboardingWizard selbst), damit auch ein Crash
// während des Wizards kein Re-Trigger auslöst. Ab dem zweiten Start kommt der
// Wizard nur noch via Placeholder-Pille oder Settings > Daten > Einrichtung.
if (state.settings.onboardingSeen === false) {
  openOnboardingWizard();
}
