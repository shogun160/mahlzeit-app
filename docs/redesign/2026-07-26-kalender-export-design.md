# Design-Doc: Kalender-Export

**Status:** Approved fuer MVP — Umsetzung ausstehend
**Datum:** 2026-07-26
**Ziel-Session:** offen (Session 17+)

## 1. Ziel

User exportiert die geplante Woche als Kalender-Eintraege in eine `.ics`-Datei. Jedes ausgewaehlte Gericht wird ein Event zur konfigurierten Abendessens-Zeit. Datei wird ueber das Capacitor Share Plugin ans System weitergegeben — der User waehlt das Ziel (Google Calendar, Outlook, Mail, Files, ...). Universell, ohne extra Plugin, ohne Vendor-Lock.

## 2. UX-Flow

**Trigger:** Neuer Button im Settings-Sheet unter der Section „Daten": **„Wochenplan exportieren"**.

Klick oeffnet ein kleines Sheet mit:
- **Info-Zeile:** „N Gerichte werden exportiert — vom Montag 4.8. bis Sonntag 10.8., jeweils 19:00–20:00 Uhr" (dynamisch berechnet)
- **Buttons:** „Abbrechen" + „Exportieren"

Kein extra Zeitraum-Picker im Sheet (MVP), Datums-Berechnung ist deterministisch (siehe §5). Zeit ist ueber Settings > Daten > „Abendessen-Zeit" einstellbar (siehe §6).

Nach Klick auf „Exportieren":
1. App generiert die `.ics`-Datei im temporaeren Speicher
2. `Share.share({ files: [icsPath], title: 'Mahlzeit-Wochenplan' })` oeffnet den System-Share-Sheet
3. User waehlt Ziel-App, importiert dort

## 3. Datenmodell (was in die ICS reingeht)

### Event-Struktur pro Gericht

**Titel:**
```
🍽 Rinderfilet mit Bohnensalat
```
- Emoji-Praefix `🍽` (Teller + Besteck) als neutrales Meal-Symbol
- Universell in allen Kalender-Apps sichtbar
- Cuisine-basierte Emojis (🍜/🥗/🌮) bewusst NICHT im MVP — v2 wenn gewuenscht

**Zeit:**
- `DTSTART` = Datum des Wochentags + konfigurierte Startzeit
- `DTEND` = Datum des Wochentags + konfigurierte Endzeit
- Zeitzone aus System (`Intl.DateTimeFormat().resolvedOptions().timeZone`, z.B. `Europe/Berlin`)
- ICS-Feld `TZID=Europe/Berlin` pro DTSTART/DTEND, damit importierende Kalender korrekt umrechnen bei anderer TZ

**Body (Description):**
```
Zutaten (X Portionen):
• 200 g Rinderfilet
• 300 g Bohnen (aus der Dose)
• 2 EL Olivenöl
• 1 Zwiebel, gewürfelt
• ...

Nährwerte gesamt:
Kalorien:        880 kcal
Protein:          45 g
Kohlenhydrate:    62 g
Fett:             28 g

Zubereitung:
1. Rinderfilet bei Raumtemperatur ...
2. Bohnen abwaschen und ...
3. ...
```
- Zutaten mit skalierten Mengen (`portions × userScale`)
- Makros als Summe fuer die geplanten Portionen (auch skaliert)
- Rezept-Schritte vollstaendig, damit im Kalender-Event alles greifbar ist ohne App-Rueckwechsel
- Keine App-Deep-Links im MVP (unklar ob Custom-URL-Handler jetzt eingebaut werden soll — bewusst rausgehalten)

**Location:** leer (kein Restaurant/Adresse). Optional in v2: `Location: 'Zuhause'`.

**Reminder (VALARM):** 60 Minuten vor Event-Start. Fest im MVP verdrahtet, keine Setting. Beispiel-Block innerhalb des VEVENT:
```
BEGIN:VALARM
TRIGGER:-PT60M
ACTION:DISPLAY
DESCRIPTION:Zeit zum Kochen
END:VALARM
```

**Wiederholung:** Events sind einmalig — kein `RRULE`. Jede Woche ist ein neuer Export, damit auch mal Gericht-Aenderungen sauber greifen.

## 4. Settings (neu)

Unter Settings > Daten, neue Zeile ueber „Wochenplan exportieren":

- **„Abendessen-Zeit"** — zwei kleine Time-Picker (Von/Bis) nebeneinander, oder ein Stepper-Zeit-Widget
- Speicherung:
  ```js
  state.settings.mealTime = {
    startHour: 19,
    startMinute: 0,
    endHour: 20,
    endMinute: 0,
  }
  ```
- Default: 19:00–20:00 Uhr
- Persistiert im vorhandenen Storage-Key `mahlzeit-state-v2`, kein Storage-Bump

## 5. Datums-Zuordnung

**Regel (approved vom User):**
- Der spaeteste Wochentag im Export ist **immer Sonntag**.
- Der **erste markierte** (state.selected) Kalendertag muss in der Zukunft liegen und wird damit zum Start-Datum.
- Konkret:
  1. Berechne den **naechsten Sonntag** ab heute (`endDate`)
  2. Berechne den Montag dieser Woche (`endDate - 6`)
  3. Ordne jedem App-Tag (Mo, Di, ..., So) ein Kalender-Datum zu
  4. Filter: nur Tage mit `state.selected[day] === true` **und** `date >= today` werden exportiert
  5. Reihenfolge chronologisch aufsteigend

**Beispiele (mit heute = 2026-07-30 Donnerstag):**
- Naechster Sonntag = 2026-08-02
- Wochenfenster: Mo 27.7. – So 2.8.
- Selected: Mo, Di, Mi, Do, Fr → Mo–Mi liegen in der Vergangenheit → exportiert werden nur Do 30.7. und Fr 31.7.

**Beispiel (mit heute = 2026-08-03 Montag):**
- Naechster Sonntag = 2026-08-09
- Wochenfenster: Mo 3.8. – So 9.8.
- Alle selected Tage liegen ab heute → alle werden exportiert

**Edge Case:** heute = Sonntag + Sonntag ist als einziger selected → nur Sonntag heute wird exportiert. UI-Hint im Sheet macht das transparent („N Gerichte werden exportiert").

**Edge Case:** kein Tag selected → Export-Button im Settings-Sheet disabled (mit Tooltip „Waehle im Dashboard mindestens einen Tag aus").

## 6. Multi-Event-Support

ICS unterstuetzt beliebig viele `VEVENT`-Bloecke in einer Datei. Alle exportierten Gerichte landen in einer einzigen `.ics`. Der User importiert einmal, der Kalender legt N Eintraege an.

## 7. Technische Umsetzung

### Modul-Struktur

Neuer Ordner `src/calendar/`:
- `src/calendar/ics.js` — reine ICS-Generierung, keine Native-Bindings. Testbar per Node-Sim.
- `src/calendar/export.js` — orchestriert: Datenmodell aus state bauen, `ics.js` aufrufen, ueber Share-Plugin verteilen.
- `src/calendar/date.js` — Datums-Zuordnung (naechster Sonntag, Filter).

### Bibliothek

Kein NPM-Package. ICS-Generierung ist ~50 Zeilen JS (RFC 5545 fuer VEVENT ist ueberschaubar). Handroll spart Bundle-Groesse und Abhaengigkeit.

Beispiel-Skeleton `ics.js`:
```js
export function buildICS(events) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mahlzeit App//DE',
    ...events.flatMap(buildEvent),
    'END:VCALENDAR',
  ].join('\r\n');
}

function buildEvent(ev) {
  return [
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${formatUTC(new Date())}`,
    `DTSTART;TZID=${ev.tzid}:${formatLocal(ev.start)}`,
    `DTEND;TZID=${ev.tzid}:${formatLocal(ev.end)}`,
    `SUMMARY:${escape(ev.title)}`,
    `DESCRIPTION:${escape(ev.description)}`,
    'END:VEVENT',
  ];
}
```

### Capacitor Share

`@capacitor/share` ist bereits Standard-Plugin, muss ggf. installiert werden (`npm i @capacitor/share` + `npx cap sync`). API:
```js
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

async function shareICS(icsText, filename) {
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: icsText,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({
    title: 'Mahlzeit-Wochenplan',
    url: uri,
    dialogTitle: 'Wochenplan exportieren',
  });
}
```

`@capacitor/filesystem` braucht's auch, weil `Share.share({ files: [] })` nur mit auf-Disk-liegenden Dateien funktioniert. Beide sind offizielle Capacitor-Plugins, gut gepflegt.

## 8. MVP-Scope (Session 17-Kandidat)

**Drin:**
- Settings-Zeile „Abendessen-Zeit" mit Time-Picker
- Settings-Zeile „Wochenplan exportieren" mit Info-Sheet + Export-Button
- ICS-Generierung mit Titel-Emoji, Body (Zutaten + Makros + Zubereitung), TZ aus System
- Datums-Zuordnung nach §5-Regel
- Nur ausgewaehlte Tage werden exportiert (state.selected)
- Multi-Event pro Datei
- VALARM 60 Minuten vor Event-Start, fest verdrahtet
- Einmalige Events (kein RRULE)

**Bewusst NICHT im MVP:**
- Cuisine-basierte Emojis im Titel
- Direct-Insert via Calendar-Plugin (nur Share)
- App-Deep-Link im Body
- Zeitraum-Picker im Export-Sheet („Diese Woche" / „Naechste Woche")
- Reminder-Zeit einstellbar (fix 60 min)
- Wiederkehrende Events (RRULE)

## 9. Offene Fragen fuer Session-Start

Alles fuer den MVP entschieden. Diese Fragen kommen erst in v2:
- Cuisine-Emojis? (Mapping cuisine → emoji noetig)
- Reminder-Zeit einstellbar (aktuell fix 60 min)?
- Deep-Link zur App als Body-Zeile?
- Zeitraum-Picker im Export-Sheet?

## 10. Guardrails-Check

- **UI-Strings deutsch** ✓
- **State-Storage-Key unveraendert** ✓ (nur neue Property `settings.mealTime`)
- **Zutaten-Wiederverwendung** N/A (keine neuen Zutaten)
- **Package-ID unveraendert** ✓
- **Nach Aenderungen syncen** ✓ (npm run build + npx cap sync)

## 11. Aufwand-Schaetzung

**Session-Groesse:** eine mittlere Session (~1x Tag konzentrierte Arbeit)

Schritte:
1. `@capacitor/share` + `@capacitor/filesystem` installieren + syncen (~10 min)
2. `src/calendar/` Modul-Struktur, `ics.js`, `date.js` (~1h)
3. Settings-Zeile Abendessen-Zeit + Time-Picker-UI (~45 min)
4. Settings-Zeile „Wochenplan exportieren" + Confirm-Sheet (~1h)
5. `export.js` — Orchestrierung, Share-Call (~30 min)
6. Testen auf Handy (Real-Device noetig fuer Share-Sheet) (~30 min)
7. Feinschliff, ICS-Escape-Edge-Cases (~30 min)

**Gesamt:** ~5 Stunden konzentriert, machbar in einer Session.
