import { state } from '../state.js';
import { allIngredients } from '../data/dishes.js';

// Zutaten-Suche fuer das Eigene-Zutat-Sheet.
//
// Zwei Quellen in einer Trefferliste:
//   - die Zutaten-DB (bundled + remote, via allIngredients) — liefert Label,
//     Kategorie und Einheit
//   - die eigene MRU (state.recentCustomItems) — liefert alles, was in keiner
//     Rezept-DB steht ("Klopapier")
//
// Warum beides zusammen statt zweier getrennter Vorschlagswege: der User tippt
// einen Namen und will Treffer sehen. Ob der aus der App-Datenbank oder aus
// seiner eigenen Historie kommt, ist seine Sache — nicht seine Entscheidung
// vor dem Tippen.

// Maximale Anzahl angezeigter Treffer. Mehr als sechs Zeilen verdecken im
// Sheet das Mengenfeld und die Buttons komplett.
export const SEARCH_LIMIT = 6;

// Normalisiert fuer den Vergleich: Kleinschreibung, Umlaute ausgeschrieben,
// restliche Diakritika entfernt. Damit findet "muesli" auch "Müsli", "zwiebeln"
// auch "Zwiebeln" und "creme" auch "Crème".
//
// Umlaute bewusst zu ae/oe/ue statt zu a/o/u: auf einer deutschen Tastatur
// tippt niemand "Mslli", aber "muesli" ist die uebliche Ersatzschreibung.
function fold(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Treffer am Wortanfang sind die besseren: wer "creme" tippt, meint eher
// "Crème fraîche" als "Sauerrahm-Creme". Wortgrenze ist alles, was kein
// Buchstabe/keine Ziffer ist — deckt Leerzeichen, Komma und Bindestrich ab
// ("Zwiebeln, rot", "Creme-fraiche").
function isWordStart(haystack, pos) {
  if (pos === 0) return true;
  return !/[a-z0-9]/.test(haystack[pos - 1]);
}

// Plural-Endungen, die ein getippter Name gegenueber dem DB-Label zusaetzlich
// tragen darf: "Karotten" soll "Karotte" treffen, "Zwiebeln" die "Zwiebel".
// Bewusst nur -n und -en, nicht -e oder -s: mit "-e" wuerde "Kohle" auf "Kohl"
// matchen, und Grillkohle ist keine Zutat.
const PLURAL_SUFFIXES = ['n', 'en'];

// Kuerzere DB-Labels nehmen nicht am Praefix-Matching teil. "Ei" wuerde sonst
// als Praefix von zu vielem durchgehen.
const MIN_PREFIX_LEN = 4;

// Label-Treffer in der Zutaten-DB → deren Key, sonst null.
//
// Das ist die einzige Stelle, an der der Registry-Bezug einer eigenen Zutat
// entsteht: er wird aus dem Label abgeleitet, nicht separat gespeichert. Damit
// zieht ein Bezug automatisch nach, egal ob der User einen Vorschlag angetippt
// oder den Namen selbst getippt hat — und er faellt genauso automatisch weg,
// wenn das Label spaeter wieder wegeditiert wird.
//
// Exakt schlaegt Praefix. Beim Praefix-Matching gilt zusaetzlich: mehrere
// Kandidaten heissen kein Bezug — ein falscher Bezug verschmilzt zwei Zeilen,
// die nichts miteinander zu tun haben, und das ist schlechter als gar keiner.
export function findIngredientKeyByLabel(label) {
  const needle = fold(label);
  if (!needle) return null;

  const prefixHits = [];
  for (const [key, ing] of Object.entries(allIngredients)) {
    const candidate = fold(ing.label);
    if (candidate === needle) return key;
    if (candidate.length < MIN_PREFIX_LEN) continue;
    if (!needle.startsWith(candidate)) continue;
    if (!PLURAL_SUFFIXES.includes(needle.slice(candidate.length))) continue;
    prefixHits.push(key);
  }

  return prefixHits.length === 1 ? prefixHits[0] : null;
}

// Sucht Zutaten zu einer Eingabe.
// Rueckgabe: [{ key, label, cat, unit, qty, source }] — key/unit nur bei
// source === 'db', qty nur bei source === 'recent'.
export function searchIngredients(query) {
  const needle = fold(query);
  if (!needle) return [];

  // Was ohnehin schon auf der Liste steht, ist kein Vorschlag — es erzeugte nur
  // ein Duplikat. Gilt bewusst NUR fuer eigene Zutaten: eine DB-Zutat, die
  // diese Woche durch ein Gericht auf der Liste steht, darf man trotzdem
  // dazunehmen ("ich brauche mehr Zwiebeln als das Rezept"). Sie verschmilzt
  // dann mit der Rezept-Zeile.
  const onList = new Set(state.customItems.map((it) => fold(it.label)));

  // Ueber den Registry-Bezug zaehlt auch als "steht schon drauf", was nur per
  // Plural-Praefix trifft: hat der User "Karotten" angelegt, waere "Karotte"
  // als Vorschlag ein zweiter Eintrag auf dieselbe Zutat.
  const refsOnList = new Set(
    state.customItems.map((it) => findIngredientKeyByLabel(it.label)).filter(Boolean),
  );

  const seen = new Set();
  const hits = [];

  const push = (folded, hit) => {
    if (!folded || seen.has(folded) || onList.has(folded)) return;
    const pos = folded.indexOf(needle);
    if (pos === -1) return;
    seen.add(folded);
    hits.push({ ...hit, rank: isWordStart(folded, pos) ? 0 : 1 });
  };

  // Historie zuerst einsammeln, damit sie bei sonst gleichem Rang gewinnt —
  // seen verhindert, dass dieselbe Zutat spaeter nochmal aus der DB kommt.
  for (const entry of state.recentCustomItems) {
    push(fold(entry.label), {
      key: null,
      label: entry.label,
      cat: entry.cat,
      unit: null,
      qty: entry.qty || '',
      source: 'recent',
    });
  }

  for (const [key, ing] of Object.entries(allIngredients)) {
    if (refsOnList.has(key)) continue;
    push(fold(ing.label), {
      key,
      label: ing.label,
      cat: ing.cat,
      unit: ing.unit,
      qty: '',
      source: 'db',
    });
  }

  hits.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.source !== b.source) return a.source === 'recent' ? -1 : 1;
    return a.label.localeCompare(b.label, 'de');
  });

  return hits.slice(0, SEARCH_LIMIT).map(({ rank, ...hit }) => hit);
}
