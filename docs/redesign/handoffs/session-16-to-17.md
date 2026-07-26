# Handoff — Mahlzeit-App Rebuild, Session 17

## Kontext in einem Satz

Session 16 hat das **Favoriten-Feature** komplett gebaut (Herz-Toggle auf Dashboard-Card, Dish-Picker-Tile, Detail-Sheet, Filter-Chip, Empty-State, FLIP-Animation im Picker), dazu **Wizard-Politur** (Theme-Cycle-Button + Personen-Slider), **Header-Layout** (Selection-Chip mittig ueber 3-Spalten-Grid), **Shopping-Personalisierung** (persoenliche Done-Copy mit Profil-Name), diverse Bugfixes (Picker-Sortierung, Shopping-Progress-Padding, Copy-Feinschliff) und den **Kalender-Export-Design-Doc** fuer Session 17 vorbereitet.

## Pflichtlektuere (in dieser Reihenfolge)

1. **`CLAUDE.md`** — projekt-uebergreifender Kontext + Guardrails
2. **`docs/redesign/2026-07-25-rebuild-design.md`** — Rebuild-Spec + Roadmap-Tabelle
3. **`docs/redesign/2026-07-26-kalender-export-design.md`** — Design-Doc fuer Session 17 (Haupt-Thema)
4. **`docs/redesign/backlog.md`** — offene Ideen (jetzt inklusive Einkaufslisten-Mengen-Anpassung + Custom Produkte)

## Aktueller Repo-Zustand

- **Branch:** `redesign` (auf `origin/redesign` gepusht)
- **Session-16 Commits (neueste zuerst):**
  - `style(settings): erscheinungsbild-row inline + pills auf einheitliche 40px`
  - `docs(design): kalender-export mvp konzept`
  - `style(settings): kochzeit-label 'unbegrenzt' -> 'egal'`
  - `style(picker): schnell + wenig zutaten zurueck auf text-chip`
  - `fix(shopping): shop-progress top-padding reduziert fuer buendigen anschluss`
  - `docs(backlog): mengen-anpassung + custom produkte einkaufsliste`
  - `style(header): selection-chip mittig ueber 3-spalten-grid`
  - `feat(shopping): persoenliche done-copy mit profil-name`
  - `feat(onboarding): personen-slider unter gewicht in step 1`
  - `feat(favoriten): herz-toggle dashboard + picker + detail-sheet + filter`
  - `feat(onboarding): theme-cycle-button auf ergebnis-seite`
- **Working Tree:** sauber
- **Dev-Server:** `npm run dev` (Port 5173)

## Was in Session 16 gebaut wurde

### Favoriten-Feature komplett

Ein neuer Baustein: **Herz-Markierung fuer Lieblingsgerichte**, ueberall wo ein Gericht sichtbar ist toggle-fahig.

- **Datenmodell:** `state.settings.profile.favorites = { [dishId]: true }` — bewusst Map (nicht Array), Multi-User-ready-Nesting: spaeter zieht ein aeusserer `profiles[id]`-Layer die Struktur nach oben, `favorites` wandert 1:1 mit. Kein neuer Storage-Key, `mahlzeit-state-v2` bleibt. Helper `isFavorite(id)` + `toggleFavorite(id)` in `state.js`.
- **Dashboard-Card:** Herz-Pille als 5. Element in `.day-card__makros`, rechts neben Fett. Off wie Fett (`--frosted-glass`), On wie kcal (`primary` bg). `stopPropagation` beim Klick, damit Bild-Klick nicht mit ausgeloest wird.
- **Dish-Picker-Tile:** Herz-Badge oben rechts im Bild (`.picker-tile__fav` + `--active`), Stil analog Weekday-Badge (frosted-glass / primary). `<span role="button">` weil Nested-Button in `<button>` invalides HTML. Keyboard-Support (Enter/Space) + Swipe-Close-Filter beruecksichtigt.
- **Detail-Sheet:** Herz-Toggle in `.sheet-header__day` neben dem Wochentag. In-place Icon/Klass-Swap ohne Full-Rerender, damit Sheet-Scroll-Position stehen bleibt.
- **Filter-Chip:** neuer Filter `favorite` in der attr-Gruppe, icon-only (`.picker-filter-chip--icon`). Schnell + Wenig Zutaten blieben zunaechst auch icon-only, wurden aber im Verlauf zurueckgerollt auf Text-Chips — nur Favoriten bleibt icon-only.
- **Empty-State:** bei Favoriten-Filter ohne Favoriten „Noch keine Favoriten — Nimm dir ein Herz [❤]" mit inline gefuelltem primary Herz-Icon.
- **FLIP-Animation:** beim Fav-Toggle im Picker gleiten Tiles an ihre neue Sort-Position (380ms `cubic-bezier(0.2, 0, 0, 1)`, analog Shopping-Liste). `updateGrid({ preserveScroll, animate })` parametrisiert — Filter-Klicks scrollen weiter auf 0 (kein FLIP), Fav-Toggle behaelt Scroll + animiert.

### Picker-Sortierung ueberarbeitet

- **Favoriten IMMER zuerst** — in beiden Sort-Pfaden (mit aktivem Filter-Sort und ohne). Sekundaere Sortierung bleibt wie vorher (cooktime, ingredients, kcal, macros).
- **Aktuelles Gericht nicht mehr priorisiert** — der `current`-Bucket ist raus. currentDishId laeuft durch die normale Sortierung (bleibt weiter im Ergebnis auch wenn Filter nicht matcht, via `passesFilter`-Override). Landet unter „Bereits geplant" wenn Filter nicht matcht.

### Wizard-Politur

- **Theme-Cycle-Button auf Ergebnis-Seite (Step 4)** — Kachel oben rechts, cycled System → Hell → Dunkel. Off-Zustand mit `surface-container-high` fuer sichtbaren Kontrast, On-Zustaende mit `primary`/`on-primary` analog aktive Theme-Chip in Settings. Titel/Untertitel bleiben links, Icon vertikal mittig.
- **Personen-Slider in Step 1** — unter Gewicht: „Fuer wie viele kochst du?" per Slider (1-6 Personen, Live-Label mit korrekter Ein-/Mehrzahl). Draft-Key `defaultPortions`, persistiert zu `state.settings.defaultPortions` (nicht ins profile, weil das Feld schon global auf dem Settings-Slot lebt).

### Header-Layout

Header von flex `space-between` auf `grid 1fr auto 1fr` umgestellt. Logo bleibt links, Reroll/Reset + Settings bleiben rechts, die Selection-Chip (Progress-Ring + „N/7 Tage") sitzt jetzt in der echten Viewport-Mitte — unabhaengig von den unterschiedlichen Seiten-Breiten. Gilt fuer Dashboard- und Shopping-View gleich.

### Shopping-Personalisierung

- **Persoenliche Done-Copy** — mit gesetztem Profil-Name: „Sauber [Name], du hast alles besorgt – Mahlzeit!". Ohne Name: „Sauber, du hast alles besorgt – Mahlzeit!" als Fallback.
- **Shop-Progress padding-top von 14 auf 4 px** — vorher entstand zusammen mit dem App-Header padding-bottom (12px) ein sichtbarer 26-px-Surface-Streifen zwischen den beiden Content-Zeilen (im Dark-Mode als „Spalt" wahrgenommen).

### Settings-Sheet Feinschliff

- **Kochzeit-Label:** „unbegrenzt" → „egal" bei `COOKTIME_MAX`. Kuerzer und passt besser zur direkten Ansprache.
- **Erscheinungsbild-Row umgebaut** — Label + Chips in derselben `settings-row`, analog Ziel/Geschlecht. Kein extra Row + margin-top mehr, kein sekundaeres Erklaerungs-Label. Chip-Bezeichner „Auto" umbenannt zu **„System"** (selbsterklaerender). Aktiver Chip in beiden Modi mit kcal-Pill-Look (die frueher separate Dark-Mode-Regel `primary-container` ist raus).
- **Alle Pills auf einheitliche `min-height: 40px`** — `.pref-chip`, `.theme-toggle__chip`, `.settings-link`, `.settings-action-btn`, `.settings-row__value--pill`. Touch-Target-Guardrail bleibt via Chip-Reihen-Breite gewahrt.

### Backlog aktualisiert

Zwei neue Eintraege fuer die Einkaufsliste eingepflegt (mit UX- + State-Skizzen und offenen Fragen):

- **Mengen manuell anpassen** — `state.shoppingOverrides` mit Override-Semantik, offene Fragen zu Reset-/Portions-Verhalten
- **Custom Produkte hinzufuegen** — `state.customShoppingItems` als parallele Source zu Rezept-Items, Kopplungshinweis zur Mengen-Anpassung (beste Session-Kombi)

### Kalender-Export Design-Doc (Session 17-Vorbereitung)

Vollstaendiges Konzept unter `docs/redesign/2026-07-26-kalender-export-design.md`. MVP-Scope, Delivery-Weg, Event-Format, Datums-Zuordnung, Settings, Aufwand-Schaetzung — alle User-Entscheidungen drin. Session 17 kann direkt in die Umsetzung starten.

---

## Wo weitermachen — Session 17

### Hauptthema: **Kalender-Export**

Details in `docs/redesign/2026-07-26-kalender-export-design.md`. Kurzform:

- **Delivery:** ICS-Datei-Generierung + Capacitor Share Plugin (`@capacitor/share` + `@capacitor/filesystem`)
- **Trigger:** neuer Button in Settings > Daten: „Wochenplan exportieren" (mit kleinem Confirm-Sheet: „N Gerichte werden exportiert, jeweils 19:00–20:00")
- **Event pro Gericht:** `🍽 [Gericht-Name]`, DTSTART/DTEND mit System-TZ (`TZID=Europe/Berlin` o.ae.), Body = Zutaten (skaliert) + Makros (Summe) + Zubereitungs-Schritte + VALARM 60 min vor Event
- **Datums-Regel:** naechster Sonntag = Endtag, Woche = Mo-So davor, nur `state.selected[day] === true` UND `date >= today` werden exportiert
- **Settings-Vorbereitung:** neue Zeile „Abendessen-Zeit" unter Daten mit Time-Picker (Von/Bis) — persistiert als `state.settings.mealTime = { startHour, startMinute, endHour, endMinute }`. Default 19:00–20:00.
- **Aufwand:** ~5h in einer Session, siehe Design-Doc §11

### Vorschlag zum Einstieg

- Session-Start: Design-Doc einmal durchlesen zur Auffrischung
- Erst `@capacitor/share` + `@capacitor/filesystem` installieren + syncen (~10 min)
- Modul-Struktur `src/calendar/{ics.js, date.js, export.js}` anlegen (~1h)
- ICS-Generierung + Datums-Zuordnung isoliert bauen, testen via Node-Sim (~1h)
- Settings-UI (Abendessen-Zeit + Export-Button + Confirm-Sheet) (~1.5h)
- Verdrahtung + Share-Call (~30 min)
- Real-Device-Test (Share-Sheet + Import in Google Calendar), Feinschliff (~1h)

### Andere Kandidaten (falls Prioritaet wechselt)

**Klein (~½-1 Session):**
- **Favoriten Weighted-Reroll** — Favoriten haeufiger beim `rerollDay`/`rerollAll` ziehen (analog Cuisine-Weighting). Rundet das Favoriten-Feature ab.
- **Datenverwaltung / Iteration 7** — Export/Import JSON + „Alle Daten zuruecksetzen"-Bestaetigung. Nuetzliches Safety-Net vor allen weiteren Aenderungen.
- **Bar-Bootstrap-Anti-Flash** — `SharedPreferences` in `MainActivity.onCreate` (Doppel-Wahrheit-Trade-off, siehe Session 15 Handoff)

**Mittel (1 Session):**
- **Einkaufsliste: Mengen anpassen + Custom Produkte zusammen** — die zwei neuen Backlog-Ideen ueberschneiden sich am Datenmodell, ideal in einer gemeinsamen Session

**Gross (mehrere ~1 Session):**
- **Google Health Sync** — Android-only via Health Connect, eigenes Capacitor-Plugin bauen. Konzept: Kotlin-Plugin mit `writeNutrition({ kcal, p, kh, f, mealType, timestamp })`, JS-Bridge, Consent-Choreographie
- **Akzentfarbe / Dynamic Color (Iteration 6)** — Follow-up zu Dark, Community-Plugin oder manueller Farbwaehler
- **Multi-Profile** (Backlog, gross) — braucht eigenes Design-Doc

---

## Guardrails-Recap

- **Kein Framework** ohne Rueckfrage — Vanilla JS + ES Modules
- **Keine Tests** (Solo-Projekt) — Node-Simulation fuer Randfaelle
- **Deutsche UI-Strings, Du-Ansprache**
- **Touch-Targets ≥ 48 px** (bei Pill-Reihen ueber die Breite der ganzen Reihe erfuellt)
- **Storage-Key `mahlzeit-state-v2`** unveraenderlich ohne Migration — beim Hinzufuegen neuer Felder (jetzt `settings.mealTime`) einfach ergaenzen
- **Package-ID mit `applicationIdSuffix ".dev"`** auf `redesign` — vor Merge auf main zuruecknehmen
- **App-Name `"Mahlzeit Beta"`** auf `redesign` — vor Merge auf main zurueck auf `"Mahlzeit"`
- **Zutaten-Wiederverwendung (Guardrail #8)** — beim Rezept-Anlegen IMMER pruefen ob `key` in `ingredients.json` schon existiert

## User-Preferences (Feedback-Memories)

- **APK-Build nur auf Anfrage** — kein automatisches Gradle nach jedem Build
- **Progress-Framing** — Zaehler in „erledigt/gesamt" statt „offen/gesamt"

## Bekannte Environment-Constraints

- **`curl` im Bash-Sandbox** braucht absoluten Pfad (`/usr/bin/curl`)
- **Gradle** braucht JDK 11+ — nutze `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`

## Erster empfohlener Move fuer Session 17

```bash
git status                                          # sauber, on redesign
git log --oneline a958437..HEAD                     # Session-16 Commits ansehen
cat docs/redesign/2026-07-26-kalender-export-design.md  # Konzept auffrischen
```

Dann `@capacitor/share` + `@capacitor/filesystem` installieren und mit der Modul-Struktur starten.
