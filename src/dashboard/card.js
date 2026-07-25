// Rendert eine einzelne Day-Card als <article>-Element.
// Erwartet: { day: string, dish: { id, name, cuisine, cooktime, ... } }
export function createDayCard({ day, dish }) {
  const article = document.createElement('article');
  article.className = 'day-card';
  const imageSrc = `/dishes/dish-${dish.id}.jpg`;
  article.innerHTML = `
    <img class="day-card__image" src="${imageSrc}" alt="${dish.name}" loading="lazy" />
    <div class="day-card__body">
      <div class="day-card__day">${day}</div>
      <h2 class="day-card__title">${dish.name}</h2>
      <div class="day-card__meta">~${dish.cooktime} Min. · ${dish.cuisine}</div>
    </div>
  `;
  return article;
}
