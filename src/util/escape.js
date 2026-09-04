// HTML-Escaping fuer User-Eingaben, die per innerHTML in die View gehen.
//
// Warum das hier zentral liegt: Bis zu den eigenen Einkaufslisten-Zutaten kamen
// alle Labels aus den projekteigenen JSONs — Escaping war ueberall verzichtbar.
// Sobald der User frei tippt, ist jedes ungeescapte Interpolat eine XSS-Luecke
// im WebView. Neue Stellen, die User-Text rendern, importieren diese Funktion
// statt sich eine eigene zu bauen.
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
