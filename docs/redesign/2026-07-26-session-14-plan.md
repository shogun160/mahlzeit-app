# Session 14 Implementation Plan — Dark Mode

> **Environment note aus Sessions 1-13:** Subagent-Worktree-Dispatch nicht verfügbar. Direktausführung in der Haupt-Session. Gradle braucht `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`.

> **REQUIRED SUB-SKILL:** Steps sind mit Checkboxen (`- [ ]`) auszuführen, in der Reihenfolge des Dokuments. Am Ende jeder Task steht ein Commit-Command — nach jedem Commit ist ein sauberer Zwischenstand erreicht, an dem der User pausieren oder abbrechen kann.

**Goal:** Voll funktionaler Dark Mode für die gesamte Rebuild-App. Auto-Modus folgt System-`prefers-color-scheme`, User kann explizit auf Hell oder Dunkel überschreiben via 3-Chip-Toggle in Settings > Darstellung.

**Architecture:**

- **Tokens:** In `styles/tokens.css` bekommt jedes `--md-sys-color-*` Token eine Dark-Variante. Aktivierung über zwei Wege: `@media (prefers-color-scheme: dark)` (Auto-Modus) und `html[data-theme="dark"]` (Manual-Override).
- **State-driven Theme:** `state.settings.theme` (`'auto' | 'light' | 'dark'`, existiert bereits) steuert ein `data-theme`-Attribut am `<html>`-Element. `'auto'` → kein Attribut → System-Media-Query greift. `'light'`/`'dark'` → explizites Attribut → Media-Query wird überschrieben.
- **Custom-Farben aufräumen:** `rgba(255,255,255,0.78)`-Frosted-Glass in `calorie-bar.css`, `macro-popup.css`, `card.css`, `dish-picker.css` bekommen Dark-Varianten (z. B. `rgba(0,0,0,0.4)`). `#b3541e` Warnfarbe in `calorie-bar.css` wird auf Token gezogen.
- **Chart-Farben:** Bekommen dedizierte Dark-Varianten (heller/kräftiger) für Sichtbarkeit auf dunklem Grund.
- **Logo:** PNG bleibt Original, wird im Dark Mode via `filter: brightness(0) invert(1)` auf Weiß gezogen.
- **Android-StatusBar:** `MainActivity.java` nutzt `Configuration.UI_MODE_NIGHT_YES` für die Bar-Icon-Farbe. Best-Effort — bei App-Override (Hell/Dunkel) und System-Modus im Konflikt kann die Bar-Icon-Farbe leicht mismatchen. Akzeptierter Trade-off für Session 14 (kein neues Plugin nötig).

**Tech Stack:** unverändert. Vite, Vanilla JS (ES Modules), CSS Custom Properties, Capacitor. Keine neuen npm-Packages, keine neuen Capacitor-Plugins.

---

## Design-Entscheidungen

| Frage | Entscheidung | Warum |
|---|---|---|
| Default-Mode | Auto (`prefers-color-scheme`) | Üblichste Wahl, User kann bewusst überschreiben |
| Theme-Toggle-Position | 3 Chips in Settings > `darstellung`-Section | Section wartet schon als "Kommt bald" |
| Icons | contrast (Auto) / light_mode (Hell) / dark_mode (Dunkel) — Material Symbols | Sonne+Mond+Halb-Halb = grafisch konsistent |
| Chart-Farben Dark | Explizite Dark-Varianten (heller/kräftiger) | M3 empfiehlt gesättigtere Farben auf dunklem Grund |
| Frosted-Glass Dark | `rgba(0,0,0,0.4)` + backdrop-blur (bleibt) | Hält Frost-Look, passt zum dunklen Rest |
| Logo im Dark Mode | CSS `filter: brightness(0) invert(1)` → weiß | Kein neues Asset, funktioniert bei jedem PNG |
| Aktivierungs-Mechanismus | `data-theme`-Attribut am `<html>` | Overridet `@media (prefers-color-scheme: dark)` sauber |
| Persistenz | `state.settings.theme` (existiert schon) | Wird beim App-Start aus loadState gelesen + gesetzt |
| Android StatusBar-Icons | System-Modus-basiert in `MainActivity.java` | Ohne neues Plugin auskommen — Trade-off dokumentiert |
| Kein separates Dark-Logo-Asset | Filter-Ansatz reicht | Vermeidet doppelte Bilder + Wartungsaufwand |

---

## Voraussetzungen

- **Working Directory:** `/Users/oliverwosnitza/Documents/Mahlzeit-App`
- **Branch:** `redesign`
- **Working Tree:** sauber (letzter Commit `158c9c9` — Details→Makros)
- **Session 13 abgeschlossen** — Handoff [`docs/redesign/handoffs/session-13-to-14.md`](handoffs/session-13-to-14.md)

## Datei-Struktur nach dieser Session

```
Mahlzeit-App/
├── styles/
│   ├── tokens.css                            ← Dark-Palette + Chart-Dark-Varianten + Frosted-Glass-Tokens
│   └── components/
│       ├── calorie-bar.css                   ← Frosted + Warnfarbe auf Tokens
│       ├── card.css                          ← Frosted-Overlays auf Tokens
│       ├── macro-popup.css                   ← Frosted + Backdrop auf Tokens
│       ├── dish-picker.css                   ← Frosted + Backdrops auf Tokens
│       ├── settings-sheet.css                ← Backdrop + Theme-Toggle-Styles
│       ├── sheet.css                         ← Backdrop auf Token
│       └── header.css                        ← Logo-Filter im Dark Mode
├── src/
│   ├── main.js                               ← applyTheme() beim Start + nach jedem Toggle-Klick
│   └── settings/render.js                    ← darstellung-Section aktivieren mit Theme-Chip-Row
└── android/app/src/main/java/com/mahlzeit/myapp/
    └── MainActivity.java                     ← StatusBar-Icons je nach System-Dark-Mode
```

---

## Task 1 — Dark-Palette in `tokens.css`

**Files:**
- Modify: `styles/tokens.css`

- [ ] **Step 1.1: Frosted-Glass-Tokens im `:root` ergänzen (Light-Mode-Defaults)**

Am Ende des `:root {}`-Blocks (vor der schließenden `}` in Zeile 57) einfügen:

```css
  /* Frosted-Glass für schwebende Pillen (Bedarfs-Pille, Card-Overlays, Sheet-
     Header). Semi-transparent damit der Content darunter durchschimmert.
     Dark-Mode überschreibt auf dunkles Glas mit invertiertem Alpha-Ratio. */
  --frosted-glass: rgba(255, 255, 255, 0.78);
  --frosted-glass-strong: rgba(255, 255, 255, 0.88);
  --frosted-glass-strongest: rgba(255, 255, 255, 0.92);

  /* Backdrop hinter Modals — dunkler halbtransparenter Overlay-Ton. Bleibt
     im Dark Mode praktisch gleich (dunkel auf dunkel ist ok, backdrop-blur
     im Kontrast). */
  --overlay-backdrop: rgba(15, 23, 42, 0.42);

  /* Warnfarbe für "über Zielkorridor"-Zustand (Bedarfs-Pille). */
  --semantic-warn: #b3541e;
```

- [ ] **Step 1.2: Dark-Palette am Ende der Datei ergänzen**

Direkt nach `}` des `:root`-Blocks anfügen:

```css

/* Dark Mode: aktiv bei @media prefers-color-scheme: dark ODER bei explizitem
   data-theme="dark" am <html>. Der User-Toggle in Settings überschreibt das
   System-Preference via data-theme. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --md-sys-color-primary: #4FD1C5;
    --md-sys-color-on-primary: #063C3A;
    --md-sys-color-primary-container: #164E4B;
    --md-sys-color-on-primary-container: #A7F3D0;
    --md-sys-color-primary-track: color-mix(in srgb, var(--md-sys-color-primary) 20%, var(--md-sys-color-surface-container-highest));

    --md-sys-color-surface: #0E1414;
    --md-sys-color-surface-container-lowest: #060A0A;
    --md-sys-color-surface-container-low: #131A1A;
    --md-sys-color-surface-container: #1A2222;
    --md-sys-color-surface-container-high: #232C2C;
    --md-sys-color-surface-container-highest: #2C3636;

    --md-sys-color-on-surface: #E5E7EB;
    --md-sys-color-on-surface-variant: #9CA3AF;
    --md-sys-color-outline: #6B7280;
    --md-sys-color-outline-variant: #2A3434;

    --chart-color-kh: #FBBF24;
    --chart-color-p:  #F87171;
    --chart-color-f:  #60A5FA;
    --chart-color-ok: #4ADE80;

    --frosted-glass: rgba(0, 0, 0, 0.4);
    --frosted-glass-strong: rgba(0, 0, 0, 0.5);
    --frosted-glass-strongest: rgba(0, 0, 0, 0.6);
    --overlay-backdrop: rgba(0, 0, 0, 0.6);
    --semantic-warn: #F97316;
  }
}

/* Manuelles Dark-Override — User hat in Settings "Dunkel" gewählt. Gleiche
   Werte wie oben, greift unabhängig vom System-Preference. */
:root[data-theme="dark"] {
  --md-sys-color-primary: #4FD1C5;
  --md-sys-color-on-primary: #063C3A;
  --md-sys-color-primary-container: #164E4B;
  --md-sys-color-on-primary-container: #A7F3D0;
  --md-sys-color-primary-track: color-mix(in srgb, var(--md-sys-color-primary) 20%, var(--md-sys-color-surface-container-highest));

  --md-sys-color-surface: #0E1414;
  --md-sys-color-surface-container-lowest: #060A0A;
  --md-sys-color-surface-container-low: #131A1A;
  --md-sys-color-surface-container: #1A2222;
  --md-sys-color-surface-container-high: #232C2C;
  --md-sys-color-surface-container-highest: #2C3636;

  --md-sys-color-on-surface: #E5E7EB;
  --md-sys-color-on-surface-variant: #9CA3AF;
  --md-sys-color-outline: #6B7280;
  --md-sys-color-outline-variant: #2A3434;

  --chart-color-kh: #FBBF24;
  --chart-color-p:  #F87171;
  --chart-color-f:  #60A5FA;
  --chart-color-ok: #4ADE80;

  --frosted-glass: rgba(0, 0, 0, 0.4);
  --frosted-glass-strong: rgba(0, 0, 0, 0.5);
  --frosted-glass-strongest: rgba(0, 0, 0, 0.6);
  --overlay-backdrop: rgba(0, 0, 0, 0.6);
  --semantic-warn: #F97316;
}
```

- [ ] **Step 1.3: Build check**

```bash
npm run build
```

Erwartet: `built in Xms`, keine Errors.

- [ ] **Step 1.4: Commit**

```bash
git add styles/tokens.css
git commit -m "feat(tokens): dark-palette + frosted-glass + semantic tokens"
```

---

## Task 2 — Custom-Farben in Components auf Tokens ziehen

**Files:**
- Modify: `styles/components/calorie-bar.css`
- Modify: `styles/components/card.css`
- Modify: `styles/components/macro-popup.css`
- Modify: `styles/components/dish-picker.css`
- Modify: `styles/components/sheet.css`
- Modify: `styles/components/settings-sheet.css`

- [ ] **Step 2.1: `calorie-bar.css` — Frosted + Warnfarbe auf Tokens**

Ersetze in `styles/components/calorie-bar.css`:

Zeile 19 (`background: rgba(255, 255, 255, 0.78);`) → `background: var(--frosted-glass);`
Zeile 32 (`background: rgba(255, 255, 255, 0.9);` — hover) → `background: var(--frosted-glass-strong);`
Zeile 79 (`color: #b3541e;`) → `color: var(--semantic-warn);`

- [ ] **Step 2.2: `card.css` — Frosted-Overlays auf Tokens**

In `styles/components/card.css`:

Zeile 79 (`background: rgba(255, 255, 255, 0.88);`) → `background: var(--frosted-glass-strong);`
Zeile 108 (`background: rgba(255, 255, 255, 0.88);`) → `background: var(--frosted-glass-strong);`
Zeile 147 (`background: rgba(255, 255, 255, 0.78);`) → `background: var(--frosted-glass);`

- [ ] **Step 2.3: `macro-popup.css` — Backdrop + Frosted auf Tokens**

In `styles/components/macro-popup.css`:

Zeile 12 (`background: rgba(15, 22, 32, 0.35);`) → `background: var(--overlay-backdrop);`
Zeile 186 (`background: rgba(255, 255, 255, 0.78);`) → `background: var(--frosted-glass);`

- [ ] **Step 2.4: `dish-picker.css` — Backdrop + Frosted auf Tokens**

In `styles/components/dish-picker.css`:

Zeile 19 (`background: rgba(0, 0, 0, 0.35);`) → `background: var(--overlay-backdrop);`
Zeile 546 (`background: rgba(255, 255, 255, 0.92);`) → `background: var(--frosted-glass-strongest);`
Zeile 571 (`background: rgba(255, 255, 255, 0.92);`) → `background: var(--frosted-glass-strongest);`

Zeile 10 (`background: rgba(0, 0, 0, 0);` — transparent placeholder) bleibt.

- [ ] **Step 2.5: `sheet.css` und `settings-sheet.css` — Backdrops auf Tokens**

In `styles/components/sheet.css` Zeile 9 (`background: rgba(15, 23, 42, 0.42);`) → `background: var(--overlay-backdrop);`

In `styles/components/settings-sheet.css` Zeile 12 (`background: rgba(15, 23, 42, 0.42);`) → `background: var(--overlay-backdrop);`

- [ ] **Step 2.6: Build check**

```bash
npm run build
```

- [ ] **Step 2.7: Commit**

```bash
git add styles/components/calorie-bar.css styles/components/card.css styles/components/macro-popup.css styles/components/dish-picker.css styles/components/sheet.css styles/components/settings-sheet.css
git commit -m "refactor(styles): frosted-glass + backdrop + warn auf tokens ziehen"
```

---

## Task 3 — Logo weiß im Dark Mode

**Files:**
- Modify: `styles/components/header.css`

- [ ] **Step 3.1: Filter-Regel für Dark Mode ergänzen**

Am Ende von `styles/components/header.css` einfügen:

```css
/* Logo ist ein dunkelgrünes PNG. Im Dark Mode via brightness(0) invert(1)
   auf Weiß gezogen — funktioniert bei jedem PNG mit transparentem Hintergrund.
   Sowohl bei Auto-Modus (System-Media-Query) als auch bei explizitem Override. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .app-header__logo {
    filter: brightness(0) invert(1);
  }
}
:root[data-theme="dark"] .app-header__logo {
  filter: brightness(0) invert(1);
}
```

- [ ] **Step 3.2: Commit**

```bash
git add styles/components/header.css
git commit -m "feat(header): logo weiß im dark mode via brightness+invert filter"
```

---

## Task 4 — `state.settings.theme` aktivieren

**Files:**
- Modify: `src/main.js`

- [ ] **Step 4.1: `applyTheme()`-Helper anlegen und beim Start rufen**

In `src/main.js`, nach dem `loadState()`-Aufruf (Zeile 28), folgende Funktion + Aufruf ergänzen:

```js
// Setzt data-theme am <html>-Element je nach state.settings.theme:
// - 'auto' → Attribut entfernen (Media-Query prefers-color-scheme greift)
// - 'light' → data-theme="light" (überschreibt Dark-Media-Query)
// - 'dark' → data-theme="dark" (aktiviert Dark-Tokens explizit)
// Wird beim App-Start und nach jedem Theme-Toggle in Settings aufgerufen.
export function applyTheme() {
  const theme = state.settings.theme;
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }
}
applyTheme();
```

- [ ] **Step 4.2: Build check**

```bash
npm run build
```

- [ ] **Step 4.3: Commit**

```bash
git add src/main.js
git commit -m "feat(theme): applyTheme setzt data-theme am html-element beim start"
```

---

## Task 5 — Theme-Toggle in Settings > Darstellung

**Files:**
- Modify: `src/settings/render.js`
- Modify: `src/main.js` (Callback für Theme-Change)
- Modify: `styles/components/settings-sheet.css` (Chip-Styles falls nötig)

- [ ] **Step 5.1: Icons in `settings/render.js` ergänzen**

Am Anfang der Datei (nach den bestehenden Imports und `ICON_REFRESH`, ca. Zeile 41) einfügen:

```js
// Material Symbols für Theme-Toggle. Alle im viewBox 0 -960 960 960.
// contrast: Kreis halb hell/halb dunkel (Auto-Modus).
// light_mode: Sonne mit Strahlen. dark_mode: Sichel-Mond.
const ICON_CONTRAST   = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm40-82q100-15 170-92.5T760-480q0-108-70-185.5T520-758v596Z"/></svg>`;
const ICON_LIGHT_MODE = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0 80q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280ZM200-440H40v-80h160v80Zm720 0H760v-80h160v80ZM440-760v-160h80v160h-80Zm0 720v-160h80v160h-80ZM256-650l-101-97 57-59 96 100-52 56Zm492 496-97-101 53-55 101 97-57 59Zm-98-550 97-101 59 57-100 96-56-52ZM154-212l101-97 55 53-97 101-59-57Z"/></svg>`;
const ICON_DARK_MODE  = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q55 0 101-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120Z"/></svg>`;
```

- [ ] **Step 5.2: Darstellung-Section aktivieren**

Ersetze in `src/settings/render.js` (ca. Zeile 184):

```js
          ${section('darstellung', 'Darstellung', `
            <p class="settings-section__note">Kommt bald — Dark Mode, Akzentfarbe</p>
          `, 'settings-section-body--soon')}
```

durch:

```js
          ${section('darstellung', 'Darstellung', `
            <div class="settings-row">
              <div class="settings-row__label">
                <div class="settings-row__label-primary">Erscheinungsbild</div>
                <div class="settings-row__label-secondary">Auto folgt dem System-Modus</div>
              </div>
            </div>
            <div class="theme-toggle" role="group" aria-label="Erscheinungsbild">
              <button class="theme-toggle__chip" type="button" data-action="theme-pick" data-value="auto"  aria-pressed="${state.settings.theme === 'auto'}"  aria-label="Automatisch">
                ${ICON_CONTRAST}<span>Auto</span>
              </button>
              <button class="theme-toggle__chip" type="button" data-action="theme-pick" data-value="light" aria-pressed="${state.settings.theme === 'light'}" aria-label="Hell">
                ${ICON_LIGHT_MODE}<span>Hell</span>
              </button>
              <button class="theme-toggle__chip" type="button" data-action="theme-pick" data-value="dark"  aria-pressed="${state.settings.theme === 'dark'}"  aria-label="Dunkel">
                ${ICON_DARK_MODE}<span>Dunkel</span>
              </button>
            </div>
            <p class="settings-section__note settings-section__note--soft">Akzentfarbe kommt in einer späteren Iteration</p>
          `)}
```

- [ ] **Step 5.3: Handler + Callback in `settings/render.js`**

In der `attachHandlers()`-Funktion (ca. Zeile 600, nach dem `open-onboarding`-Handler) ergänzen:

```js
  // Theme-Toggle — 3 exklusive Chips. Klick setzt state.settings.theme,
  // ruft onExternalThemeChange() (das applyTheme + saveState triggert),
  // aktualisiert aria-pressed. Kein Sheet-Rerender nötig.
  rootEl.querySelectorAll('[data-action="theme-pick"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value;
      state.settings.theme = val;
      rootEl.querySelectorAll('[data-action="theme-pick"]').forEach((other) => {
        other.setAttribute('aria-pressed', String(other.dataset.value === val));
      });
      onExternalThemeChange();
    });
  });
```

Und oben in der Datei (nach `let onExternalOpenOnboarding = () => {};`):

```js
let onExternalThemeChange = () => {};
```

In `mountSettingsSheet` erweitern:

```js
export function mountSettingsSheet(el, { onChange, onOpenMacro, onOpenOnboarding, onThemeChange } = {}) {
  rootEl = el;
  onExternalChange = onChange || (() => {});
  onExternalOpenMacro = onOpenMacro || (() => {});
  onExternalOpenOnboarding = onOpenOnboarding || (() => {});
  onExternalThemeChange = onThemeChange || (() => {});
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}
```

- [ ] **Step 5.4: `main.js` — onThemeChange-Callback durchreichen**

In `src/main.js` — den `mountSettingsSheet`-Aufruf erweitern:

```js
mountSettingsSheet(settingsRoot, {
  onChange: refresh,
  onOpenMacro: () => openMacroPopup(),
  onOpenOnboarding: () => openOnboardingWizard(),
  onThemeChange: () => {
    applyTheme();
    saveState();
  },
});
```

- [ ] **Step 5.5: Chip-Styles in `settings-sheet.css`**

Am Ende der Datei einfügen:

```css
/* Theme-Toggle im Settings-Sheet: 3-Chip-Row, Icons oben, Label darunter.
   Aktiver Chip hat primary-container-Background + on-primary-container-Text
   analog M3 Segmented Button. */
.theme-toggle {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 8px;
}
.theme-toggle__chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 72px;
  padding: 12px 8px;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: 12px;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.theme-toggle__chip svg {
  width: 22px;
  height: 22px;
}
.theme-toggle__chip[aria-pressed="true"] {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border-color: transparent;
}
.theme-toggle__chip:active {
  transform: scale(0.98);
}
```

- [ ] **Step 5.6: Build check**

```bash
npm run build
```

- [ ] **Step 5.7: Commit**

```bash
git add src/settings/render.js src/main.js styles/components/settings-sheet.css
git commit -m "feat(settings): theme-toggle in darstellung-section (auto/hell/dunkel)"
```

---

## Task 6 — Android StatusBar dynamisch

**Files:**
- Modify: `android/app/src/main/java/com/mahlzeit/myapp/MainActivity.java`

- [ ] **Step 6.1: `MainActivity.java` — StatusBar-Icons je nach System-Dark-Mode**

Ersetze die komplette Datei `android/app/src/main/java/com/mahlzeit/myapp/MainActivity.java` durch:

```java
package com.mahlzeit.myapp;

import android.content.res.Configuration;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applySystemBarAppearance();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Fängt System-Dark-Mode-Wechsel während App läuft ab (User dreht in
        // Android-Settings um). Bar-Icons aktualisieren sich damit ohne Restart.
        applySystemBarAppearance();
    }

    // Setzt Status- und Navigation-Bar-Icons je nach System-Dark-Mode. Bei
    // hellem Modus dunkle Icons, bei dunklem Modus helle Icons.
    // Trade-off (Session 14): folgt dem System, nicht dem App-Theme-Toggle. Wenn
    // User in der App "Hell" aber System auf "Dark" ist, bekommen wir helle
    // Icons auf hellem Bar — Mismatch. Akzeptiert für v1; ein späteres
    // @capacitor/status-bar Plugin könnte das dynamisch aus JS setzen.
    private void applySystemBarAppearance() {
        int nightModeFlags = getResources().getConfiguration().uiMode
            & Configuration.UI_MODE_NIGHT_MASK;
        boolean isSystemDark = (nightModeFlags == Configuration.UI_MODE_NIGHT_YES);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(!isSystemDark);
        controller.setAppearanceLightNavigationBars(!isSystemDark);
    }
}
```

- [ ] **Step 6.2: `AndroidManifest.xml` — `uiMode` in `configChanges` sicherstellen**

Damit `onConfigurationChanged()` bei System-Dark-Mode-Wechsel gefeuert wird (statt die Activity komplett neu zu starten), muss `uiMode` in `android:configChanges` gelistet sein.

Prüf-Command:

```bash
grep "configChanges" /Users/oliverwosnitza/Documents/Mahlzeit-App/android/app/src/main/AndroidManifest.xml
```

**Fall A** — Output enthält `uiMode` → nichts tun, Step ist erledigt.

**Fall B** — Output enthält kein `uiMode` → in `android/app/src/main/AndroidManifest.xml` das `configChanges`-Attribut der `MainActivity`-Zeile öffnen und `|uiMode` am Ende ergänzen. Beispiel-Zeile vorher:

```xml
android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout"
```

Nachher:

```xml
android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
```

Datei speichern.

- [ ] **Step 6.3: `npx cap sync`**

```bash
npx cap sync
```

- [ ] **Step 6.4: Commit**

```bash
git add android/app/src/main/java/com/mahlzeit/myapp/MainActivity.java
git commit -m "feat(android): statusbar-icons je nach system-dark-mode dynamisch"
```

---

## Task 7 — Manueller Browser-Test (E2E)

- [ ] **Step 7.1: Vite starten und im Browser durchgehen**

```bash
npm run dev
```

Browser: http://localhost:5173

**Test Auto-Modus (Default):**
1. `localStorage.clear(); location.reload();` — Wizard geht auf (Session 13). Später klicken.
2. Aktuelle System-Theme prüfen (macOS System-Settings → Appearance).
3. App-Farben müssen dem System folgen (hell wenn System hell, dunkel wenn dunkel).
4. System-Theme in macOS wechseln (Cmd-Space → "Appearance" → schalten). App muss sofort mitziehen (`prefers-color-scheme` fires).

**Test Manual Hell:**
5. Settings öffnen → Darstellung → "Hell" klicken. `data-theme="light"` steht am `<html>`. App bleibt hell auch wenn System auf Dark ist.
6. Alle Screens durchgehen: Dashboard, Card-Grid, Bedarfs-Pille, Detail-Sheet, Settings-Sheet, Makro-Popup, Dish-Picker, Onboarding-Wizard, Shopping-List. Nichts darf farblich kaputt aussehen.

**Test Manual Dunkel:**
7. Settings → Darstellung → "Dunkel" klicken. App wird dunkel.
8. Alle Screens durchgehen. Prüfen:
   - **Cards, Sheets, Backdrops** haben dunkles Grau
   - **Frosted-Glass-Pillen** haben schwarzes semi-transparentes Glass
   - **Chart-Farben** sind heller/kräftiger (Makro-Popup, Horseshoe im Wizard-Ergebnis)
   - **Logo im Header** ist weiß
   - **Aktiver Fertig-Button / active Abendessen-Card** sind noch als primary erkennbar
   - **Slider-Track** und andere `--primary-track` sind sichtbar
   - **Text-Kontraste** überall OK (kein grau-auf-grau)

**Test Persistenz:**
9. `location.reload()` — Theme bleibt bei letzter Wahl.

- [ ] **Step 7.2: Bugs sammeln**

Wenn ein Screen kaputt aussieht: Screenshot oder Beschreibung → Fix inline, dann Commit als `fix(dark-mode): <screen>`.

- [ ] **Step 7.3: Wenn alles ok — kein extra Commit nötig**

Testing hat keine File-Changes wenn nichts gebrochen war.

---

## Task 8 — Vite Build + Sync (APK auf Anfrage)

- [ ] **Step 8.1: Vite-Build**

```bash
npm run build
```

- [ ] **Step 8.2: `npx cap sync`**

```bash
npx cap sync
```

- [ ] **Step 8.3: APK-Build nur auf explizite User-Anfrage**

Wenn der User "apk bauen" sagt:

```bash
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./android/gradlew -p android assembleDebug
```

Erwartet: `BUILD SUCCESSFUL`, APK unter `android/app/build/outputs/apk/debug/app-debug.apk`.

Sonst überspringen — Präferenz "APK-Build nur auf Anfrage" aus User-Memory.

---

## Nicht im Scope

- **Akzentfarbe / Dynamic Color** (eigene Iteration 6)
- **Chart-Farb-Feintuning** — die Dark-Chart-Farben sind Startwerte; falls User in Praxis feedback gibt, iteriert in Follow-Up-Commit
- **Perfekte StatusBar-Icon-Sync bei App-Override** — braucht `@capacitor/status-bar` Plugin (nicht in dieser Session)
- **Splash-Screen im Dark Mode** — nutzt aktuell `styles.xml`; könnte separat gefixt werden

## Guardrails (aus CLAUDE.md)

- Storage-Key `mahlzeit-state-v2` bleibt — `settings.theme` existiert schon, keine neue Migration
- Package-ID `com.mahlzeit.myapp.dev` unverändert
- Deutsche UI-Strings, Du-Ansprache
- Touch-Targets ≥ 48 px (Theme-Chips: 72 px hoch — passt)
- Kein Framework, keine neuen npm-Packages, keine neuen Capacitor-Plugins
- Nach jedem substantiellen Task: Commit
- Vor Merge auf `main`: Beta-Branding + `applicationIdSuffix ".dev"` zurückbauen (unverändert von Session 13)
