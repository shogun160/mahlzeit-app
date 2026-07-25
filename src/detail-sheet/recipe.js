// Baut die nummerierte Rezept-Liste als HTML-String.
// dish.steps: [string, ...] (5–8 Schritte pro Gericht laut dishes.json)
// Nummern werden per CSS-Counter gerendert — <ol> ist semantisch, <li> stumm.
export function renderRecipe(dish) {
  const items = dish.steps.map((step) => `
    <li class="recipe-step">${step}</li>
  `).join('');
  return `<ol class="recipe-list">${items}</ol>`;
}
