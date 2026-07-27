# Session 23 — Fixes-Roadmap

Input: 9 Screenshots mit roten Markierungen (siehe `/Users/oliverwosnitza/Downloads/Abendessenplaner/fixes/screenshots/`). Nach Rueckfrage-Runde konsolidiert.

## Priorisierte Reihenfolge

### Block A — Detail-Sheet-Header als Bild-Hero  *(Start Session 23)*
- **A1** — Header wird zur Bild-Hero-Section, Gericht-Bild als Hintergrund, hoeher als jetzt.
- Overlays als Pills (wie Dashboard-Cards):
  - Wochentag unten links
  - Favoriten-Herz unten rechts
  - Neu-Marker (Sparkles) oben links (nur wenn Rezept neu-importiert)
  - Schliessen-Button oben rechts — Design unveraendert, nur Position
- Persistent ueber beide Tabs (Zutaten + Rezept).
- Gerichtname wandert vom Text-Header ins Bild-Overlay.
- (Screenshot 18:08)

### Block B — Einkaufsliste-Feinschliff
- **B1** — Expand-All-Icon auch im Done-State rendern (fehlt aktuell wenn alles besorgt). (Screenshot 17:59)
- **B2** — Done-Banner Komma-Fix: „Sauber, Oliver, du hast alles besorgt – Mahlzeit!" → „Sauber Oliver, du hast alles besorgt – Mahlzeit!". (Screenshot 17:59)
- **B3** — Kategorie-Counter auf positives Framing: „0/5" → „5/5" bzw. „erledigt/gesamt", konsistent mit Global-Zaehler oben. (Screenshot 18:00)

### Block C — Picker-Feinschliff
- **C1** — Einkaufskorb-Badge auch bei 0 rendern (aktuell versteckt bei 0 fehlend). (Screenshot 18:02)
- **C2** — Wochentag-Pill (heute) an aktueller Tages-Tile im Picker — **offen, Klaerung mit User laeuft**. (Screenshot 18:06)
- **C3** — Klick auf FILTER-Section-Header soll Sheet zur Section scrollen statt collapsen — **offen, Klaerung mit User laeuft**. (Screenshot 18:11)

### Block D — Naehrstoff-Details-Sheet
- **D1** — Hinweistext zum Ø-Balken korrigieren (Berechnung stimmt). **offen, Klaerung**. (Screenshot 18:16)
- **D2** — Makro-Donut wie im Onboarding-Wizard, ersetzt/ergaenzt die aktuellen Pillen. **Detailklaerung offen**. (Screenshot 18:16)

### Block E — Settings / Standard-Profil
- **E1** — Standard-Profil-Card mit dashed Border (wie „Profil hinzufuegen"). (Screenshot 18:22)
- **E2** — Standard-Profil-Card zeigt kcal-Bereich statt Alter/Groesse/Gewicht/Ziel. (Screenshot 18:22)
- **E3** — Standard-Profil-Detail-Sheet zeigt **nur** einen Abendessen-kcal-Slider. Alle anderen Felder (Geschlecht, Alter, Groesse, Gewicht, Aktivitaet, Ziel, Ernaehrungs-/Kuechen-Praeferenz, Tagesziel, Fruehstueck, Mittag) raus. (Screenshot 18:28)

## Offene Rueckfragen (blockieren nicht die Roadmap, aber die Umsetzung der Blocks)

- **C2**: Fehlt „heute"-Highlight an Mittwoch-Tile *oder* fehlt das heutige Gericht in „aktive Gerichte fuer diese Filter"-Section?
- **C3**: Chevron rechts behaelt Collapse-Funktion, Header-Klick nur scroll? Oder Collapse ganz weg?
- **D1**: Welcher Text ist gemeint — Tooltip, Beschriftung, oder ein separater Text im Sheet?
- **D2**: kcal / g / %? Ersetzt Pillen oder ergaenzt? Bezugsraum: heute, Ø, oder ausgewaehltes Gericht?

## Explizit **nicht** in dieser Session

- „Nicht mehr im Plan"-Label unterhalb erledigter Zeilen bleibt wie es ist (war Referenz-Hinweis fuer Kategorie-Counter-Fix). (Screenshot 18:00)

## Test-/Release-Strategie

Alle Fixes iterativ per `npm run dev`. Sammel-Commit bzw. thematische Commits (nicht ein Sammel-Commit fuer alles). APK-Bau erst am Session-Ende und nur nach expliziter Ansage — Version-Bump-Vorschlag: `versionCode 11`, `versionName "1.3.7"` fuer die naechste Runde.
