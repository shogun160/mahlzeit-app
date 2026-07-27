// Konfiguration fuer den Remote-Rezept-Import.
// Alle Fetches gehen gegen den main-Branch des oeffentlichen Repos —
// keine Channel-Trennung fuer Content (siehe Design-Doc: Beta-APK und
// Stable-APK sehen denselben Rezept-Bestand).

const REPO_BASE = 'https://raw.githubusercontent.com/shogun160/mahlzeit-app/main';

export const dishesUrl = `${REPO_BASE}/src/data/dishes.json`;
export const ingredientsUrl = `${REPO_BASE}/src/data/ingredients.json`;
export const dishImageUrl = (id) => `${REPO_BASE}/public/dishes/dish-${id}.jpg`;

// Schema-Versionen: muessen mit den Werten in dishes.json / ingredients.json
// uebereinstimmen. Bei Remote-Version > lokal blockt die App den Import mit
// klarer Fehlermeldung (User muss App aktualisieren).
export const SCHEMA_VERSION_DISHES = 1;
export const SCHEMA_VERSION_INGREDIENTS = 1;

// Manueller Button hat einen 60s-Soft-Cache: innerhalb dieser Zeit
// wird kein neuer Fetch ausgeloest, sondern ein Toast angezeigt.
export const MANUAL_RATE_LIMIT_MS = 60 * 1000;

// Notfall-Kill-Switch: false schaltet Auto-Check UND manuellen Button aus.
// Ermoeglicht einen Feature-Rollback ohne groesseren Code-Umbau (nur
// Konstante flippen und neue APK bauen).
export const IMPORT_ENABLED = true;
