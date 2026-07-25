import { createDayCard } from './card.js';

// Provisorisches Beispiel-Data — echte DATA-Anbindung kommt in Session 2
const SAMPLE_DAY = {
  day: 'Montag',
  dish: {
    name: 'Wildlachs-Bowl',
    cuisine: 'Asiatisch-Fusion',
    cooktime: 35,
    imageSrc: '/dishes/dish-1.jpg',
  },
};

export function renderDashboard(root) {
  root.innerHTML = '';
  const card = createDayCard(SAMPLE_DAY);
  root.appendChild(card);
}
