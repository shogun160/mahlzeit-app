// Zentrale Bild-URL-Aufloesung: bundled hat Vorrang, sonst Remote-Cache,
// sonst Fallback-Silhouette.
//
// Die Card + das Detail-Sheet rufen resolveDishImage(id) und binden das
// Ergebnis in <img src>. Fuer Remote-Bilder ist die Rueckgabe ein Cache-URI
// (Filesystem oder Blob-URL) — beim ersten Aufruf nach Import kann sie null
// sein, dann wird die Fallback-Silhouette gerendert bis der Bild-Download
// durch ist.

import dishesData from './dishes.json' with { type: 'json' };
import { imageCache } from '../util/image-cache.js';

const bundledIds = new Set(dishesData.dishes.map((d) => d.id));

const PLACEHOLDER = '/dishes/dish-placeholder.jpg';

// Sync-Version fuer Card-Rendering: liefert entweder bundled-URL oder
// Placeholder. Fuer Remote-Bilder muss der Caller separat resolveDishImageAsync
// nutzen und die URL nachtraeglich in die Card patchen.
export function resolveDishImage(id) {
  if (bundledIds.has(id)) return `/dishes/dish-${id}.jpg`;
  return PLACEHOLDER;
}

// Async-Version: liefert echten Cache-URI wenn bereits geladen, sonst null.
export async function resolveDishImageAsync(id) {
  if (bundledIds.has(id)) return `/dishes/dish-${id}.jpg`;
  const cached = await imageCache.get(id);
  return cached || null;
}

// Convenience fuer's Card-Rendering: liefert sofort einen brauchbaren src
// (bundled oder placeholder) UND setzt asynchron den echten Cache-URI wenn
// verfuegbar. Der Consumer uebergibt ein <img>-Element.
export async function bindDishImage(imgEl, id) {
  imgEl.src = resolveDishImage(id);
  if (bundledIds.has(id)) return;
  const url = await resolveDishImageAsync(id);
  if (url) imgEl.src = url;
}
