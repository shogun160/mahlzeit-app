import { state } from '../state.js';
import { CAT_ORDER } from './categories.js';
import { findIngredientKeyByLabel } from './ingredient-search.js';

// Eigene Einkaufslisten-Zutaten: Eintraege, die der User selbst anlegt und die
// an keinem Gericht haengen ("Klopapier", "Kaffee", "noch Zwiebeln").
//
// Warum ein eigener State-Slot statt eines Registry-Eintrags: ingredients.json
// ist Rezept-Datenbestand mit Naehrwerten und wird beim Remote-Import gemerged
// (Guardrail 8 — keine Duplikate). User-Eintraege haben dort nichts zu suchen;
// sie tragen keine Makros und sollen nie in eine Rezept-Berechnung geraten.
//
// Der Listen-Key ist `custom:<id>`. Dadurch liegen eigene Zutaten ohne
// Sonderbehandlung in checkedShopping (das haelt nur Strings) und kollidieren
// per Praefix garantiert nicht mit einem Registry-Key.

export const CUSTOM_KEY_PREFIX = 'custom:';

// Vorausgewaehlte Kategorie beim Anlegen. "Sonstiges" trifft fuer typische
// Nicht-Rezept-Eintraege am haeufigsten zu, ist aber im Sheet aenderbar.
export const DEFAULT_CUSTOM_CAT = 'sonstig';

// Laenge der MRU-Vorschlagsliste.
export const RECENT_CUSTOM_LIMIT = 10;

// Harte Obergrenzen — kein Validierungs-Theater, sondern Layout-Schutz: ein
// 500-Zeichen-Label wuerde die Zeile sprengen.
const MAX_LABEL_LEN = 60;
const MAX_QTY_LEN = 30;

// Monoton steigender Suffix, damit zwei Eintraege in derselben Millisekunde
// nicht dieselbe id bekommen.
let idCounter = 0;

function nextId() {
  idCounter += 1;
  return `c${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function isCustomKey(key) {
  return typeof key === 'string' && key.startsWith(CUSTOM_KEY_PREFIX);
}

export function customKeyFor(id) {
  return `${CUSTOM_KEY_PREFIX}${id}`;
}

export function findCustomItemById(id) {
  return state.customItems.find((it) => it.id === id) || null;
}

// Bringt Roh-Eingaben in die Form, die im State landet. Unbekannte Kategorien
// fallen auf den Default zurueck — sonst landete das Item in einer Gruppe, die
// CAT_ORDER nicht rendert, und waere unsichtbar.
function normalize({ label, cat, qty }) {
  return {
    label: String(label ?? '').trim().slice(0, MAX_LABEL_LEN),
    cat: CAT_ORDER.includes(cat) ? cat : DEFAULT_CUSTOM_CAT,
    qty: String(qty ?? '').trim().slice(0, MAX_QTY_LEN),
  };
}

function sameLabel(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Legt eine eigene Zutat an. Existiert bereits eine mit gleichem Label
// (case-insensitive), wird diese aktualisiert statt ein Duplikat anzulegen —
// zweimal "Klopapier" auf einer Einkaufsliste hilft niemandem.
// Rueckgabe: { item, wasExisting } oder null bei leerem Label.
export function addCustomItem(input) {
  const fields = normalize(input);
  if (!fields.label) return null;

  const existing = state.customItems.find((it) => sameLabel(it.label, fields.label));
  if (existing) {
    Object.assign(existing, fields);
    rememberRecent(fields);
    return { item: existing, wasExisting: true };
  }

  const item = { id: nextId(), ...fields };
  state.customItems.push(item);
  rememberRecent(fields);
  return { item, wasExisting: false };
}

// Aendert eine bestehende eigene Zutat (Long-Press bzw. Stift → Sheet im
// Edit-Modus). Der Listen-Key bleibt gleich, weil er an der id haengt — ein
// umbenanntes Item behaelt damit seinen Haken.
//
// Rueckgabe: { item, merged } — merged ist true, wenn beim Umbenennen ein
// gleichnamiger Eintrag geschluckt wurde. Der Aufrufer kann das melden, sonst
// verschwaende eine Zeile ohne Erklaerung.
export function updateCustomItem(id, input) {
  const item = state.customItems.find((it) => it.id === id);
  if (!item) return null;
  const fields = normalize(input);
  if (!fields.label) return null;

  const oldLabel = item.label;

  // Traegt eine ANDERE eigene Zutat den neuen Namen schon, werden beide
  // zusammengefasst — zwei gleichnamige Zeilen auf einer Einkaufsliste sind
  // immer ein Versehen, und sie erzeugten obendrein denselben Vorschlag
  // doppelt. Das bearbeitete Item ueberlebt samt id, Haken und Formularwerten;
  // der Aufrufer wird gerade daran gearbeitet haben.
  const clash = state.customItems.find((it) => it.id !== id && sameLabel(it.label, fields.label));
  if (clash) removeCustomItem(clash.id);

  Object.assign(item, fields);

  // Beim Umbenennen den alten Namen aus den Vorschlaegen werfen. Typischer
  // Fall ist die Tippfehler-Korrektur ("Sojamlich" → "Sojamilch") — der
  // Vertipper darf danach nicht weiter vorgeschlagen werden.
  //
  // Unterschied zum Loeschen, das die MRU bewusst stehen laesst: dort bleibt
  // der Name gueltig und man will ihn spaeter wieder anbieten. Hier war er nie
  // gemeint.
  if (!sameLabel(oldLabel, fields.label)) {
    state.recentCustomItems = state.recentCustomItems.filter(
      (r) => !sameLabel(r.label, oldLabel),
    );
  }

  rememberRecent(fields);
  return { item, merged: !!clash };
}

// Entfernt eine eigene Zutat. Der Haken muss mitgehen, sonst bliebe ein
// verwaister Key in checkedShopping liegen und wuerde den Progress-Zaehler
// verfaelschen.
export function removeCustomItem(id) {
  const idx = state.customItems.findIndex((it) => it.id === id);
  if (idx === -1) return false;
  state.customItems.splice(idx, 1);
  state.checkedShopping.delete(customKeyFor(id));
  return true;
}

// Entfernt alle eigenen Zutaten, die aktuell abgehakt sind. Gedacht fuer den
// Wochenwechsel (rerollAll): abgehakt heisst eingekauft, und damit ist der
// Eintrag erledigt. Nicht abgehakte bleiben stehen — die stehen ja noch aus.
//
// Muss VOR resetChecked() laufen, sonst ist checkedShopping schon leer und die
// Funktion findet nichts mehr.
// Rueckgabe: die entfernten Eintraege (fuer Toast/Log durch den Aufrufer).
export function removeCheckedCustomItems() {
  const removed = [];
  state.customItems = state.customItems.filter((it) => {
    const key = customKeyFor(it.id);
    // Ist die Zutat mit einer Rezept-Zeile verschmolzen (gleicher Name wie eine
    // Zutat aus der App-Datenbank), haengt ihr Haken am Registry-Key statt am
    // custom:-Key. Ohne diese zweite Pruefung ueberlebte sie den Wochenwechsel,
    // obwohl der User sie abgehakt hat.
    const ref = findIngredientKeyByLabel(it.label);
    if (!state.checkedShopping.has(key) && !(ref && state.checkedShopping.has(ref))) return true;
    // Nur den eigenen Key raeumen — der Registry-Key gehoert der Rezept-Zeile.
    state.checkedShopping.delete(key);
    removed.push(it);
    return false;
  });
  return removed;
}

// Schiebt einen Eintrag an den Kopf der MRU-Liste. Dedupe nach Label, damit
// wiederholtes Anlegen derselben Zutat die Vorschlaege nicht zumuellt.
// Bewusst beim ANLEGEN aufgerufen, nicht beim Abhaken: die Vorschlagsliste
// soll zeigen, was der User typischerweise dazuschreibt.
export function rememberRecent({ label, cat, qty }) {
  if (!label) return;
  const entry = { label, cat, qty };
  state.recentCustomItems = [
    entry,
    ...state.recentCustomItems.filter((it) => !sameLabel(it.label, label)),
  ].slice(0, RECENT_CUSTOM_LIMIT);
}

// Vorschlaege fuer das Sheet: MRU ohne die Zutaten, die ohnehin schon auf der
// Liste stehen — ein Vorschlag, der nur ein Duplikat erzeugt, ist kein
// Vorschlag.
export function recentSuggestions() {
  return state.recentCustomItems.filter(
    (r) => !state.customItems.some((it) => sameLabel(it.label, r.label)),
  );
}

// Als Consolidated-List-Eintraege. isCustom steuert Rendering (Badge, Gesten)
// und formatQuantity; sum/unit bleiben leer, weil eigene Zutaten keine
// Portions-Skalierung durchlaufen.
//
// `ref` ist der Key der gleichnamigen Zutat aus der App-Datenbank, sonst null.
// Bewusst hier abgeleitet statt im State gespeichert: ein gespeicherter Bezug
// koennte veralten (Remote-Import entfernt eine Zutat) und muesste beim
// Umbenennen von Hand nachgezogen werden. Abgeleitet stimmt er immer.
export function customListEntries() {
  return state.customItems.map((it) => ({
    key: customKeyFor(it.id),
    id: it.id,
    label: it.label,
    cat: it.cat,
    qty: it.qty,
    ref: findIngredientKeyByLabel(it.label),
    sum: 0,
    isCustom: true,
    isLeftover: false,
  }));
}
