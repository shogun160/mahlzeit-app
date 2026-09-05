import { state, DAYS } from '../state.js';
import { dishesById } from '../data/dishes.js';
import { ingredientRegistry } from '../data/ingredient-registry.js';
import { scaledGramsForDay } from '../nutrition/scale.js';
import { customListEntries, isCustomKey } from './custom-items.js';

// Aggregiert alle Zutaten der ausgewählten Tage in eine flache Map.
// Rückgabe: { [key]: { key, label, cat, unit, size, note, sum, isLeftover } }
// - sum: Summe der Tagesmengen über alle selektierten Tage. Pro Tag exakt die
//        Menge, die auch im Detail-Sheet steht (scaledGramsForDay: portions ×
//        Diner-Skalierung, Stück auf 0.25 gerundet, Aromageber gedämpft).
//        Für unit === 'vorrat' bleibt sum = 0 (Anzeige zeigt "Vorrat prüfen" statt Menge).
// - isLeftover: true für Zutaten, die nur in checkedShopping stehen, weil ihr
//        Gericht nachträglich abgewählt wurde. Menge ist dann unbekannt → sum = 0.
//        Meta (label/cat/unit/size/note) kommt aus ingredientRegistry.
// - cat / unit / size / note: übernommen von der ersten Zutat des Keys (identisch über Dishes).
export function buildConsolidatedList() {
  const activeDays = DAYS.filter((d) => state.selected[d]);
  const consolidated = {};
  activeDays.forEach((day) => {
    const dishId = state.assignment[day];
    const dish = dishesById.get(dishId);
    if (!dish) return;
    // Menge pro Tag kommt aus scaledGramsForDay — derselben Funktion, die auch
    // das Detail-Sheet nutzt. Das ist wichtig: scaledGramsForDay rundet
    // Stueck-Zutaten auf 0.25-Schritte und daempft Aromageber (bund/el/tl).
    // Wuerde hier stattdessen roh mit dem Tagesfaktor multipliziert, summierte
    // die Liste ungerundete Mengen und liefe gegen das, was im Rezept steht:
    // zwei Gerichte mit angezeigter "1/2 Gurke" landeten bei 2 Gurken statt 1.
    const portions = state.portions[day] || 1;
    dish.ingredients.forEach((ing) => {
      if (!consolidated[ing.key]) {
        consolidated[ing.key] = {
          key: ing.key,
          label: ing.label,
          cat: ing.cat,
          unit: ing.unit,
          size: ing.size,
          displayUnit: ing.displayUnit,
          gramsPerUnit: ing.gramsPerUnit,
          note: ing.note,
          sum: 0,
          isLeftover: false,
        };
      }
      // Vorrat-Zutaten mit displayUnit (Öl, Sojasauce, Honig als EL/TL) sollen
      // die konsolidierte Menge zeigen — der User will wissen wieviel er braucht,
      // um den Vorrat prüfen zu können. Vorrat ohne displayUnit (Sesam, Gewürze
      // in Prisen) bleibt bei sum=0 → reines "Vorrat prüfen".
      const contributesSum = ing.unit !== 'vorrat' || ing.displayUnit;
      consolidated[ing.key].sum += contributesSum ? scaledGramsForDay(ing, portions, dish) : 0;
    });
  });

  // Eigene Zutaten des Users. Unabhaengig von selected/assignment — sie haengen
  // an keinem Gericht und bleiben deshalb auch dann stehen, wenn kein Tag
  // ausgewaehlt ist oder die Woche neu gewuerfelt wurde.
  const customEntries = customListEntries();
  const customRefs = new Set(customEntries.map((e) => e.ref).filter(Boolean));

  // Abgehakte Zutaten aus abgewählten Gerichten bleiben sichtbar (als Leftover),
  // bis der User sie unhakt oder den Reset-Button drückt. Menge unbekannt.
  state.checkedShopping.forEach((key) => {
    if (consolidated[key]) return;
    // Eigene Zutaten kommen unten aus customListEntries — hier wuerde sonst ein
    // Leftover-Duplikat entstehen, sobald der User seinen Eintrag abhakt
    // (ingredientRegistry kennt custom:-Keys ohnehin nicht, aber der Skip macht
    // die Absicht explizit).
    if (isCustomKey(key)) return;
    // Dasselbe fuer Keys, auf die eine eigene Zutat zeigt: die erscheint unten
    // als eigene Zeile. Eine Leftover-Zeile daneben waere exakt das Duplikat,
    // das der Registry-Bezug verhindern soll.
    if (customRefs.has(key)) return;
    const meta = ingredientRegistry[key];
    if (!meta) return;
    consolidated[key] = {
      ...meta,
      sum: 0,
      isLeftover: true,
    };
  });

  for (const entry of customEntries) {
    // Traegt die Zutat den Namen einer Zutat, die diese Woche ohnehin durch ein
    // Gericht auf der Liste steht, haengt sie sich als Zusatz an diese Zeile,
    // statt eine zweite mit demselben Namen zu erzeugen. Der Haken der Zeile
    // gehoert dann dem Registry-Key: es kommt Menge dazu, die noch nicht
    // gekauft ist, also ist die Zeile wieder offen.
    // Haengt schon ein eigener Anteil an der Zeile, bekommt dieser hier seine
    // eigene. Der Fall ist ueber die Suche nicht erreichbar (sie filtert
    // belegte Registry-Bezuege aus), aber von Hand eintippbar — und eine
    // ueberschriebene Zeile waere ein lautloser Datenverlust.
    const host = entry.ref ? consolidated[entry.ref] : null;
    if (host && !host.isLeftover && !host.customExtra) {
      host.customExtra = entry;
      continue;
    }
    consolidated[entry.key] = entry;
  }

  return consolidated;
}
