import { createDayCard } from './card.js';
import { renderCalorieBar } from './calorie-bar.js';
import { state, DAYS, initState, toggleFavorite } from '../state.js';
import { dishesById, shuffled } from '../data/dishes.js';
import { rerollDay, rerollAll, eligibleDishIds } from './reroll.js';
import { changePortion } from './portions.js';
import { toggleSelected } from './selection.js';

function pickInitialAssignment() {
  const picks = shuffled(eligibleDishIds()).slice(0, DAYS.length);
  const assignment = {};
  DAYS.forEach((day, i) => {
    assignment[day] = picks[i];
  });
  return assignment;
}

export function renderDashboard(root, onChange, onOpenDetail, onOpenPicker, onOpenMacroPopup, onOpenOnboarding) {
  // Erst-Initialisierung: falls noch kein Assignment vorliegt, würfeln.
  if (Object.keys(state.assignment).length === 0) {
    initState(pickInitialAssignment());
  }

  root.innerHTML = '';

  // Selection-Toolbar früherer Iteration ist in den App-Header umgezogen
  // (Progress-Ring + Count-Text, siehe dashboard/header.js).

  // Wochen-Kalorien-Bar über den Cards — nur sichtbar wenn Profil ausgefüllt.
  // renderCalorieBar() liefert leeren String wenn nicht → kein DOM-Element.
  const calorieBarHtml = renderCalorieBar();
  if (calorieBarHtml) {
    const wrap = document.createElement('div');
    wrap.innerHTML = calorieBarHtml;
    const barEl = wrap.firstElementChild;
    root.appendChild(barEl);
    // Klick auf die Bedarfs-Pille öffnet das Makro-Popup (Chart + Ø + Preset-
    // Einstellungen). Selector via data-action, damit die Bindung robust ist
    // wenn die Klasse mal wandert.
    const macroTrigger = barEl.matches('[data-action="open-macro-popup"]') ? barEl : barEl.querySelector('[data-action="open-macro-popup"]');
    if (macroTrigger && onOpenMacroPopup) {
      macroTrigger.addEventListener('click', () => onOpenMacroPopup());
    }
    const onboardingTrigger = barEl.matches('[data-action="open-onboarding"]') ? barEl : barEl.querySelector('[data-action="open-onboarding"]');
    if (onboardingTrigger && onOpenOnboarding) {
      onboardingTrigger.addEventListener('click', () => onOpenOnboarding());
    }
    // Reset-Pille links: rerollAll mit Confirm-Popup. Der Confirm nutzt
    // window.confirm — nativer Browser-Dialog, in Capacitor-WebView voll
    // funktional und semantisch klar (Bestaetigen/Abbrechen).
    const resetTrigger = barEl.querySelector('[data-action="reroll-all-confirm"]');
    if (resetTrigger) {
      resetTrigger.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!window.confirm('Alle Gerichte wechseln?')) return;
        rerollAll();
        onChange();
        const view = document.getElementById('view-dashboard');
        if (view) view.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  for (const day of DAYS) {
    const dishId = state.assignment[day];
    const dish = dishesById.get(dishId);
    // Anzahl offener (nicht abgehakter) Zutaten dieses Gerichts.
    // Wandert im Card-Layout zwischen Zutaten-Icon (nicht selected) und Liste-Icon
    // (selected) — Semantik: "so viele Zutaten stehen noch offen".
    const openIngredientsCount = dish.ingredients.filter(
      (ing) => !state.checkedShopping.has(ing.key),
    ).length;
    const card = createDayCard({
      day,
      dish,
      portions: state.portions[day],
      isSelected: state.selected[day],
      openIngredientsCount,
      handlers: {
        onPortionChange: (delta) => {
          changePortion(day, delta);
          onChange();
        },
        onReroll: () => {
          rerollDay(day);
          onChange();
        },
        onToggleSelected: () => {
          toggleSelected(day);
          onChange();
        },
        onOpenDetail: (tab) => {
          onOpenDetail(dishId, tab, day);
        },
        onOpenPicker: () => {
          onOpenPicker(day);
        },
        onToggleFavorite: () => {
          toggleFavorite(dishId);
          onChange();
        },
      },
    });
    root.appendChild(card);
  }
}
