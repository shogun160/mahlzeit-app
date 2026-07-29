import { state, getActiveProfile, getProfileById, DAYS } from '../state.js';
import { dishesById } from '../data/dishes.js';
import { renderMacros } from '../onboarding/result.js';
import { rerollAll } from './reroll.js';
import {
  hasProfile,
  dinnerTarget,
  dishScale,
  kcalRange,
  effectiveMacroTargets,
  MACRO_PRESETS,
  MACRO_PRESET_DEFAULT,
  MACRO_MIN,
  MACRO_MAX,
  MACRO_STEP,
} from '../nutrition/target.js';

const ICON_REFRESH = `<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;

// Bottom-Sheet-Popup mit Makro-Verlaufsdiagramm. Aufgerufen per Tap auf die
// Bedarfs-Pille im Dashboard. Zeigt für alle 7 Tage einen Balken (KH unten →
// P mitte → F oben; F in hellgrau), plus einen Ø-Balken rechts der die
// gemittelte P/KH/F-Verteilung der SELECTED Tage zeigt (identische Semantik
// wie die kcal-Pille — nicht-selected zählen nicht in den Ø).
//
// Balkenhöhe ist absolut in kcal, sodass die Verbindungslinie über die Tops
// den kcal-Verlauf zeigt. Zielkorridor (Abendessen ± TARGET_WINDOW) als
// horizontales Band im Chart. Nicht-selected Tage als leere Umriss-Rahmen —
// Wochen-Position bleibt sichtbar, aber trägt nicht zur Ø-Berechnung bei.

const TRANSITION_MS = 250;
const SWIPE_THRESHOLD_PX = 55;
const SWIPE_DIRECTIONAL_RATIO = 1.4;

// Chart-Layout (fest, damit SVG-Koordinaten planbar sind — CSS skaliert das
// SVG per viewBox auf die verfügbare Popup-Breite). Bar-Widths und Gaps sind
// bewusst großzügig für Fingertouch (Task 8: Tap-auf-Balken).
const CHART_W = 400;
const CHART_H = 240;
const CHART_PAD_T = 20;
const CHART_PAD_B = 32; // Platz für Wochentag-Label unter dem Chart
const CHART_PAD_L = 40; // Platz für kcal-Skala links
const CHART_PAD_R = 12;
const AVG_SEPARATOR_GAP = 12; // extra Abstand vor dem Ø-Balken
// Balken bewusst schmal — mehr "dicker Strich" als "Säule", damit die
// Trendlinie und die Wochen-Struktur visuell dominiert.
const BAR_WIDTH = 9;
// Bar-Radius = halbe Bar-Breite → perfekte Halbkreis-Kappe oben.
const BAR_TOP_RADIUS = BAR_WIDTH / 2;

// Baut einen Path für ein Rechteck mit nur oben abgerundeten Ecken (top-left
// + top-right). Boden und Seiten bleiben eckig. Genutzt für das oberste
// Segment eines Stacks; falls das Segment kleiner als 2×radius ist, wird der
// Radius reduziert damit der Path nicht kollabiert.
function topRoundedRectPath(x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h);
  return `M ${x} ${y + rad}
          Q ${x} ${y} ${x + rad} ${y}
          L ${x + w - rad} ${y}
          Q ${x + w} ${y} ${x + w} ${y + rad}
          L ${x + w} ${y + h}
          L ${x} ${y + h} Z`;
}

let rootEl = null;
let onExternalOpenDetail = null;
let onExternalChange = null;
// Trackt ob das Popup gerade offen ist. Wichtig fuer Re-Renders nach Pill-
// Klick: renderShell() muss die is-open-Klasse direkt ins HTML nehmen, sonst
// startet die CSS-Fade-Transition beim neuen Overlay bei opacity 0 und das
// Popup schliesst sich sichtbar.
let isOpen = false;

// Popup-lokale Auswahl fuer Multi-User-Anzeige (bewusst nicht im state — die
// Auswahl ist eine reine Anzeige-Praeferenz im Popup und soll nicht persistieren,
// aendert vor allem NICHT den globalen activeProfileId). Bei Multi-Select
// werden Ist- und Soll-Werte als Durchschnitt ueber die selected User gerechnet.
let selectedProfileIds = new Set();

function getSelectedProfiles() {
  const list = [];
  for (const id of selectedProfileIds) {
    const p = getProfileById(id);
    if (p) list.push(p);
  }
  if (list.length === 0) {
    // Fallback: aktiver User — passiert nur wenn alle Pills abgewaehlt wurden
    // oder ein selected Profil geloescht wurde.
    const active = getActiveProfile();
    if (active) list.push(active);
  }
  return list;
}

// Durchschnitt des Abendessen-Ziels (kcal) ueber alle selected Profile. Fuer
// Chart-Zielkorridor + Soll-Balken.
function avgDinnerTargetOfSelected() {
  const list = getSelectedProfiles();
  let sum = 0, count = 0;
  for (const p of list) {
    const t = dinnerTarget(p);
    if (t == null || t <= 0) continue;
    sum += t;
    count++;
  }
  return count > 0 ? sum / count : null;
}

// Durchschnitt der effektiven Makro-Ziele (Gramm) ueber alle selected. Wird
// fuer die Delta-Klassifizierung (ok/off) in renderAverageText gebraucht.
function avgMacroTargetsOfSelected() {
  const list = getSelectedProfiles();
  let sp = 0, skh = 0, sf = 0, count = 0;
  for (const p of list) {
    const t = effectiveMacroTargets(p);
    if (!t) continue;
    sp += t.p; skh += t.kh; sf += t.f;
    count++;
  }
  return count > 0 ? { p: sp / count, kh: skh / count, f: sf / count } : null;
}

export function mountMacroPopup(el, { onOpenDetail, onChange } = {}) {
  rootEl = el;
  onExternalOpenDetail = onOpenDetail || (() => {});
  onExternalChange = onChange || (() => {});
  rootEl.innerHTML = '';
  rootEl.hidden = true;
}

export function openMacroPopup() {
  if (!rootEl) throw new Error('Makro-Popup nicht gemountet.');
  const profile = getActiveProfile();
  if (!hasProfile(profile)) return;
  // Auswahl initialisieren: standardmaessig nur der aktive User. Der User kann
  // im Popup weitere Pills antippen (Toggle) um Multi-User-Durchschnitt zu sehen.
  selectedProfileIds = new Set([profile.id]);
  renderShell();
  rootEl.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      isOpen = true;
      const overlay = rootEl.querySelector('.macro-overlay');
      if (overlay) overlay.classList.add('is-open');
    });
  });
  document.addEventListener('keydown', handleEsc);
}

export function closeMacroPopup() {
  if (!rootEl || rootEl.hidden) return;
  isOpen = false;
  const overlay = rootEl.querySelector('.macro-overlay');
  if (overlay) overlay.classList.remove('is-open');
  document.removeEventListener('keydown', handleEsc);
  setTimeout(() => {
    if (rootEl && !rootEl.querySelector('.macro-overlay.is-open')) {
      rootEl.hidden = true;
      rootEl.innerHTML = '';
    }
  }, TRANSITION_MS);
}

function handleEsc(ev) {
  if (ev.key === 'Escape') closeMacroPopup();
}

// Ist-Makros eines Tages in Gramm, gemittelt ueber die selected Profile. Bei
// Einzelauswahl = wie frueher (was DIESER User isst). Bei Mehrfachauswahl =
// Durchschnitt der individuellen Portionen — nur Anzeige, aendert nichts an
// Assignment oder Kochmengen.
function dayMacros(day) {
  const dishId = state.assignment[day];
  const dish = dishId != null ? dishesById.get(dishId) : null;
  if (!dish) return null;
  const list = getSelectedProfiles();
  let sum = 0, count = 0;
  for (const p of list) {
    const s = dishScale(dish.kcal, dinnerTarget(p));
    sum += s; count++;
  }
  const scale = count > 0 ? sum / count : 0;
  return {
    dishId,
    p: dish.p * scale,
    kh: dish.kh * scale,
    f: dish.f * scale,
    kcal: dish.kcal * scale,
  };
}

// Soll-Werte für ein Abendessen. Bei Multi-Select: dinnerTarget und die
// Ziel-Verteilung werden ueber alle selected Profile gemittelt — die Ziel-
// Saeule zeigt dann "was der Durchschnitt der ausgewaehlten User haben soll".
// Soll-kcal = Mittelwert des visuellen Zielkorridors (kcalRange).
function dinnerMacroTargets() {
  const dinner = avgDinnerTargetOfSelected();
  if (dinner == null || dinner <= 0) return null;
  const range = kcalRange(dinner);
  const sollKcal = range ? (range[0] + range[1]) / 2 : dinner;
  // Ø der effektiven Ziel-Verteilung (Gramm) ueber selected → daraus Prozente.
  const avgTargets = avgMacroTargetsOfSelected();
  if (!avgTargets) return null;
  const totalKcal = avgTargets.p * 4 + avgTargets.kh * 4 + avgTargets.f * 9;
  if (totalKcal <= 0) return null;
  const pPct  = (avgTargets.p * 4)  / totalKcal;
  const khPct = (avgTargets.kh * 4) / totalKcal;
  const fPct  = (avgTargets.f * 9)  / totalKcal;
  return {
    p:  (sollKcal * pPct)  / 4,
    kh: (sollKcal * khPct) / 4,
    f:  (sollKcal * fPct)  / 9,
    kcal: sollKcal,
  };
}

// Ø-Werte immer aus ALLEN 7 Tagen — die Wochen-Zusammenfassung ist die Woche,
// unabhaengig davon welche Tage der User fuer die Einkaufsliste ausgewaehlt hat.
// Die Selection beeinflusst nur die visuelle Daempfung der Tages-Balken im Chart,
// nicht mehr die Ø-Berechnung.
function averageMacros() {
  const sum = { p: 0, kh: 0, f: 0, kcal: 0 };
  let count = 0;
  for (const day of DAYS) {
    const m = dayMacros(day);
    if (!m) continue;
    sum.p += m.p;
    sum.kh += m.kh;
    sum.f += m.f;
    sum.kcal += m.kcal;
    count++;
  }
  if (count === 0) return null;
  return {
    p: sum.p / count,
    kh: sum.kh / count,
    f: sum.f / count,
    kcal: sum.kcal / count,
  };
}

function renderShell() {
  const target = avgDinnerTargetOfSelected();
  const [rangeLow, rangeHigh] = target != null ? kcalRange(target) : [null, null];
  const avg = averageMacros();
  const targets = avgMacroTargetsOfSelected();

  rootEl.innerHTML = `
    <div class="macro-overlay${isOpen ? ' is-open' : ''}" data-role="backdrop">
      <div class="macro-sheet" role="dialog" aria-modal="true" aria-labelledby="macro-title">
        <div class="macro-handle" aria-hidden="true"></div>
        <div class="macro-header">
          <h2 class="macro-title" id="macro-title">Deine Woche</h2>
          <div class="macro-title__kcal">
            <button class="macro-title__kcal-reset" type="button" data-action="reroll-all-confirm" aria-label="Alle Gerichte wechseln" title="Alle Gerichte wechseln">
              ${ICON_REFRESH}
            </button>
            <span data-role="header-kcal">${formatHeaderKcal(avg)}</span>
          </div>
          <button class="macro-close" data-action="close" aria-label="Schließen">✕</button>
        </div>
        <div class="macro-body">
          ${renderProfilePills()}
          ${renderChartIntro(rangeLow, rangeHigh)}
          <div data-role="chart-slot">${renderChart(target, rangeLow, rangeHigh, avg)}</div>
          <div data-role="donut-slot" class="macro-donut-slot">${renderIstMacros(avg)}</div>
          <div class="macro-donut-hint">Zutaten beim Kochen bitte bei Bedarf anpassen</div>
          ${renderControls()}
        </div>
      </div>
    </div>
  `;

  attachHandlers();
  // Font-Fitter erst nach Layout (rAF), sonst sind scrollWidth/clientWidth null.
  requestAnimationFrame(() => {
    fitAvgFontSize();
    syncKcalPillWidths();
  });
}

// Synchronisiert die Breite der Header-kcal-Pille und der Sollwert-Pille im
// Chart-Intro: misst die natuerliche Breite beider und setzt beide auf die
// GROESSERE. Damit sind sie immer visuell gleich lang, egal welcher Wert
// gerade laenger ist.
function syncKcalPillWidths() {
  if (!rootEl) return;
  const header = rootEl.querySelector('.macro-header .macro-title__kcal');
  const soll = rootEl.querySelector('.macro-chart-intro__row .macro-title__kcal');
  if (!header || !soll) return;
  // Alte inline min-width zuerst zuruecksetzen, damit wir die natuerliche
  // Breite messen (sonst waere der vorherige Sync-Wert noch drauf).
  header.style.minWidth = '';
  soll.style.minWidth = '';
  const w = Math.max(header.offsetWidth, soll.offsetWidth);
  header.style.minWidth = `${w}px`;
  soll.style.minWidth = `${w}px`;
}

// Pills-Zeile ueber dem Chart: pro Profil eine Toggle-Pille. Klick togglet die
// Auswahl. Bei Multi-Select werden Chart + Ø-Werte + Soll ueber die selected
// gemittelt. AENDERT NICHT activeProfileId — reine Anzeige-Praeferenz. Bei nur
// einem Profil wird die Zeile nicht gerendert (nichts zu waehlen).
function renderProfilePills() {
  const profiles = state.settings.profiles ?? [];
  if (profiles.length <= 1) return '';
  const pills = profiles.map((p) => {
    const isSelected = selectedProfileIds.has(p.id);
    const label = p.name || 'Profil';
    return `
      <button class="macro-profile-pill"
              type="button"
              data-action="toggle-profile"
              data-profile-id="${p.id}"
              aria-pressed="${isSelected}">
        ${escapeHtml(label)}
      </button>
    `;
  }).join('');
  return `<div class="macro-profile-pills" role="group" aria-label="Profile für die Anzeige">${pills}</div>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Verkleinert die Pill-Schrift schrittweise von 14 → 10 px in 0.5-Schritten
// bis ALLE Pillen in ihre Container-Breite passen. Font-Var wird auf der Row
// gesetzt (cascadet auf alle Pillen), damit die Schriftgröße konsistent bleibt
// — kleinster Fit gewinnt für alle.
const AVG_FONT_MAX = 14;
const AVG_FONT_MIN = 10;
function fitAvgFontSize() {
  if (!rootEl) return;
  const row = rootEl.querySelector('.macro-avg-row');
  if (!row) return;
  const pills = row.querySelectorAll('.macro-avg');
  if (pills.length === 0) return;
  let size = AVG_FONT_MAX;
  row.style.setProperty('--macro-avg-font', `${size}px`);
  const overflows = () => Array.from(pills).some((p) => p.scrollWidth > p.clientWidth + 1);
  let guard = 20;
  while (overflows() && size > AVG_FONT_MIN && guard-- > 0) {
    size -= 0.5;
    row.style.setProperty('--macro-avg-font', `${size}px`);
  }
}

// SVG-Bar-Chart. Y-Achse skaliert auf max(alle kcal, targetHigh × 1.15) —
// damit der Ziel-Korridor immer sichtbar ist, auch wenn kein Tag ihn erreicht.
// Die Verbindungslinie über den Tops entsteht aus einem polyline über die
// kcal-Punkte aller Tage (selected wie unselected — sonst wären Lücken in der
// Linie).
function renderChart(target, rangeLow, rangeHigh, avg) {
  const days = DAYS.map((day) => ({ day, macros: dayMacros(day), selected: !!state.selected[day] }));
  const soll = dinnerMacroTargets();
  const targetHigh = rangeHigh ?? 0;
  // Y-Skala: mind. bis 15% über Zielkorridor, sonst bis zum größten Tag +10%.
  const maxKcal = Math.max(
    targetHigh * 1.15,
    ...days.map((d) => d.macros?.kcal ?? 0),
    avg?.kcal ?? 0,
    soll?.kcal ?? 0,
  );
  const scaleY = (kcal) => (kcal / maxKcal) * (CHART_H - CHART_PAD_T - CHART_PAD_B);

  // Layout: 7 Tage + Ø + Soll = 9 Balken. Nur EIN großer Gap (vor Ø), damit
  // Ø und Soll visuell zusammen als "Referenz-Block" rechts stehen.
  const totalBars = DAYS.length + 2;
  const availableW = CHART_W - CHART_PAD_L - CHART_PAD_R - AVG_SEPARATOR_GAP;
  const slotW = availableW / totalBars;
  const barW = BAR_WIDTH;

  const barX = (i) => {
    // Index 0..6 = Tage, 7 = Ø, 8 = Soll. Ab Index 7 kommt AVG_SEPARATOR_GAP dazu.
    const slotStart = CHART_PAD_L + i * slotW + (i >= DAYS.length ? AVG_SEPARATOR_GAP : 0);
    return slotStart + (slotW - barW) / 2;
  };

  // Chart-Boden (y für kcal=0)
  const chartBottom = CHART_H - CHART_PAD_B;
  const chartTop = CHART_PAD_T;

  // Zielkorridor-Band (nur wenn Range definiert)
  const targetBand = (rangeLow != null && rangeHigh != null) ? `
    <rect class="macro-chart__target-band"
          x="${CHART_PAD_L}" y="${chartBottom - scaleY(rangeHigh)}"
          width="${CHART_W - CHART_PAD_L - CHART_PAD_R}" height="${scaleY(rangeHigh) - scaleY(rangeLow)}" />
  ` : '';

  // Y-Achse: nur 0 unten + Range-Min/Max (Zielkorridor-Grenzen) beschriftet.
  // Wenn kein Range (Profil unvollständig) → nur 0. Bewusst keine mid-Werte
  // oder max — die Range-Grenzen sind die einzigen semantisch bedeutsamen
  // Ankerpunkte auf der kcal-Achse.
  const yLabels = [`<text class="macro-chart__axis-label" x="${CHART_PAD_L - 6}" y="${chartBottom + 4}" text-anchor="end">0</text>`];
  if (rangeLow != null && rangeHigh != null) {
    yLabels.push(`<text class="macro-chart__axis-label" x="${CHART_PAD_L - 6}" y="${chartBottom - scaleY(rangeLow) + 4}" text-anchor="end">${Math.round(rangeLow)}</text>`);
    yLabels.push(`<text class="macro-chart__axis-label" x="${CHART_PAD_L - 6}" y="${chartBottom - scaleY(rangeHigh) + 4}" text-anchor="end">${Math.round(rangeHigh)}</text>`);
  }
  const yAxis = `
    <g class="macro-chart__axis">
      <line x1="${CHART_PAD_L}" y1="${chartBottom}" x2="${CHART_W - CHART_PAD_R}" y2="${chartBottom}" />
      ${yLabels.join('')}
    </g>
  `;

  // Balken-SVG-Fragmente + Tages-Label-Fragmente.
  const barsSvg = [];
  const labelsSvg = [];

  days.forEach((d, i) => {
    const x = barX(i);
    const m = d.macros;
    if (!m) return;
    // Stack von unten: KH, P, F (F oben in hellgrau — visuell die "Krone").
    // Nicht-selektierte Tage bekommen dieselbe Struktur, werden im CSS aber
    // per Modifier gedämpft (opacity), damit man sie sieht ohne sie mit den
    // aktiven Tagen zu verwechseln.
    //
    // M3-Shape: nur das oberste sichtbare Segment bekommt oben Rundung
    // (topRoundedRectPath), damit der Stack als Ganzes eine abgerundete Krone
    // hat statt jedes Segment einzeln zu runden. Segmente unter dem obersten
    // bleiben eckige <rect>s.
    const khH = scaleY(m.kh * 4);
    const pH = scaleY(m.p * 4);
    const fH = scaleY(m.f * 9);
    const stackTop = chartBottom - khH - pH - fH;
    const mutedCls = d.selected ? '' : ' macro-chart__bar--muted';
    // Bestimmt welches Segment das oberste sichtbare ist (F > P > KH),
    // damit dort die runden oberen Ecken angehängt werden.
    const topKey = fH > 0.5 ? 'f' : (pH > 0.5 ? 'p' : 'kh');
    const segShape = (key, y, h, colorCls) => {
      if (h <= 0) return '';
      const cls = `macro-chart__bar macro-chart__bar--${colorCls}${mutedCls}`;
      if (key === topKey) {
        return `<path class="${cls}" data-day="${d.day}" d="${topRoundedRectPath(x, y, barW, h, BAR_TOP_RADIUS)}" />`;
      }
      return `<rect class="${cls}" data-day="${d.day}" x="${x}" y="${y}" width="${barW}" height="${h}" />`;
    };
    let y = chartBottom;
    y -= khH;
    if (khH > 0) barsSvg.push(segShape('kh', y, khH, 'kh'));
    y -= pH;
    if (pH > 0) barsSvg.push(segShape('p', y, pH, 'p'));
    y -= fH;
    if (fH > 0) barsSvg.push(segShape('f', y, fH, 'f'));
    // Unsichtbares Klick-Overlay über den gesamten Stack (auch für unmuted
    // Tage klickbar — dort will man vielleicht das Rezept sehen).
    barsSvg.push(`<rect class="macro-chart__bar-hit" data-day="${d.day}" x="${x}" y="${stackTop}" width="${barW}" height="${khH + pH + fH}" />`);
    // Wochentag-Label (nur erster Buchstabe — Platz). Bei nicht-selektierten
    // Tagen dieselbe Dämpfung (opacity) wie beim Bar.
    labelsSvg.push(`<text class="macro-chart__day-label${mutedCls ? ' macro-chart__day-label--muted' : ''}" x="${x + barW / 2}" y="${chartBottom + 16}" text-anchor="middle">${d.day.substring(0, 2)}</text>`);
  });

  // Ø-Balken rechts (nur wenn avg != null). Ausgewogen-Zone 22-42% als grünes
  // Referenzband hinter dem Balken markiert die "gesunde" Verteilung.
  // Nutzt dieselbe topRoundedRectPath-Logik wie die Tages-Balken für einen
  // konsistent geformten Stack (M3-Rundung nur am obersten sichtbaren Segment).
  let avgSvg = '';
  const avgX = barX(DAYS.length);
  if (avg) {
    const khH = scaleY(avg.kh * 4);
    const pH = scaleY(avg.p * 4);
    const fH = scaleY(avg.f * 9);
    const avgTopKey = fH > 0.5 ? 'f' : (pH > 0.5 ? 'p' : 'kh');
    // Ø-Balken ist immer die Wochen-Zusammenfassung — nie mehr gedaempft.
    const avgMutedCls = '';
    const avgSeg = (key, y, h, colorCls) => {
      if (h <= 0) return '';
      const cls = `macro-chart__bar macro-chart__bar--${colorCls}${avgMutedCls}`;
      if (key === avgTopKey) {
        return `<path class="${cls}" d="${topRoundedRectPath(avgX, y, barW, h, BAR_TOP_RADIUS)}" />`;
      }
      return `<rect class="${cls}" x="${avgX}" y="${y}" width="${barW}" height="${h}" />`;
    };
    let y = chartBottom;
    y -= khH;
    avgSvg += avgSeg('kh', y, khH, 'kh');
    y -= pH;
    avgSvg += avgSeg('p', y, pH, 'p');
    y -= fH;
    avgSvg += avgSeg('f', y, fH, 'f');
  }
  const avgLabel = `<text class="macro-chart__day-label macro-chart__day-label--avg" x="${avgX + barW / 2}" y="${chartBottom + 16}" text-anchor="middle">Ø</text>`;

  // Soll-Balken (Referenz aus Preset/Custom-Targets, auf Dinner-kcal skaliert).
  // Visuell mit gestricheltem Outline und reduziertem Fill markiert — klar
  // erkennbar als "Ziel" statt als weiterer Datenpunkt.
  let sollSvg = '';
  let sollLabel = '';
  if (soll) {
    const sollX = barX(DAYS.length + 1);
    const khH = scaleY(soll.kh * 4);
    const pH = scaleY(soll.p * 4);
    const fH = scaleY(soll.f * 9);
    const sollTopKey = fH > 0.5 ? 'f' : (pH > 0.5 ? 'p' : 'kh');
    const sollSeg = (key, y, h, colorCls) => {
      if (h <= 0) return '';
      const cls = `macro-chart__bar macro-chart__bar--${colorCls} macro-chart__bar--soll`;
      if (key === sollTopKey) {
        return `<path class="${cls}" d="${topRoundedRectPath(sollX, y, barW, h, BAR_TOP_RADIUS)}" />`;
      }
      return `<rect class="${cls}" x="${sollX}" y="${y}" width="${barW}" height="${h}" />`;
    };
    let y = chartBottom;
    y -= khH;
    sollSvg += sollSeg('kh', y, khH, 'kh');
    y -= pH;
    sollSvg += sollSeg('p', y, pH, 'p');
    y -= fH;
    sollSvg += sollSeg('f', y, fH, 'f');
    sollLabel = `<text class="macro-chart__day-label macro-chart__day-label--avg" x="${sollX + barW / 2}" y="${chartBottom + 16}" text-anchor="middle">Soll</text>`;
  }

  return `
    <svg class="macro-chart"
         viewBox="0 0 ${CHART_W} ${CHART_H}"
         preserveAspectRatio="xMidYMid meet"
         role="img"
         aria-label="Nährstoff-Details der Woche">
      ${targetBand}
      ${yAxis}
      ${barsSvg.join('')}
      ${avgSvg}
      ${sollSvg}
      ${labelsSvg.join('')}
      ${avgLabel}
      ${sollLabel}
    </svg>
  `;
}

// Ø-Pill unter dem Chart: pro Makro eine kleine Spalte — Buchstabe oben
// (in Chart-Farbe, ersetzt die Legende), g + % darunter in einer Zeile.
// KH steht mittig zwischen P und F. Ø-kcal rechts als Summenwert.
// Delta-Klasse (ok/off) auf der Value-Zeile.
function renderAverageText(avg, targets) {
  if (!avg) {
    return `<p class="macro-avg macro-avg--empty">Keine Tage ausgewählt.</p>`;
  }
  const totalMacroKcal = avg.p * 4 + avg.kh * 4 + avg.f * 9;
  const pctP = totalMacroKcal > 0 ? (avg.p * 4) / totalMacroKcal * 100 : 0;
  const pctKh = totalMacroKcal > 0 ? (avg.kh * 4) / totalMacroKcal * 100 : 0;
  const pctF = totalMacroKcal > 0 ? (avg.f * 9) / totalMacroKcal * 100 : 0;
  const deltaClass = (istG, zielG) => {
    if (!zielG || zielG === 0) return '';
    const rel = Math.abs(istG - zielG) / zielG;
    return rel <= 0.10 ? 'macro-avg__grams--ok' : 'macro-avg__grams--off';
  };
  const fmtG = (g) => Math.round(g).toLocaleString('de-DE');
  const fmtPct = (p) => Math.round(p);
  const cP = targets ? deltaClass(avg.p, targets.p) : '';
  const cKh = targets ? deltaClass(avg.kh, targets.kh) : '';
  const cF = targets ? deltaClass(avg.f, targets.f) : '';
  // Vier getrennte Pillen: P, KH, F je einzeln + kcal separat. Jede Pille
  // trägt eine Makro-Spalte (Buchstabe links, g/% zweizeilig rechts).
  const pill = (keyMod, letter, grams, pct, cls) => `
    <div class="macro-avg">
      <div class="macro-avg__col">
        <div class="macro-avg__key ${keyMod}">${letter}</div>
        <div class="macro-avg__values">
          <div class="macro-avg__grams ${cls}">${grams}</div>
          <div class="macro-avg__pct">${pct}</div>
        </div>
      </div>
    </div>
  `;
  const rowMuted = avg.isFallback ? ' macro-avg-row--muted' : '';
  return `
    <div class="macro-avg-row${rowMuted}" aria-live="polite">
      ${pill('macro-avg__key--p',  'P',  `${fmtG(avg.p)} g`,  `${fmtPct(pctP)} %`,  cP)}
      ${pill('macro-avg__key--kh', 'KH', `${fmtG(avg.kh)} g`, `${fmtPct(pctKh)} %`, cKh)}
      ${pill('macro-avg__key--f',  'F',  `${fmtG(avg.f)} g`,  `${fmtPct(pctF)} %`,  cF)}
      <div class="macro-avg macro-avg--kcal">
        ${Math.round(avg.kcal).toLocaleString('de-DE')} kcal
      </div>
    </div>
  `;
}

// Controls-Section unten im Popup: Preset-Chips + Ø-Werte-Slider (P/KH/F) +
// Refresh-Button. Bei Einzelauswahl wird das SELECTED Profil editiert (nicht
// zwingend activeProfileId — der bleibt unveraendert). Bei Multi-Select
// werden die Controls disabled, weil ein Wert nicht in mehrere Profile
// gleichzeitig geschrieben werden kann.
function renderControls() {
  const selected = getSelectedProfiles();
  const isMulti = selected.length > 1;
  const p = selected[0] ?? getActiveProfile();
  // Bei Multi-Select zeigen die Slider den Durchschnitt der effektiven Ziele
  // aller selected Profile — nur Anzeige, weil die Controls in Multi-Modus
  // disabled sind (Anpassungen nur bei Einzelauswahl moeglich).
  // Slider zeigen die Ziel-Verteilung fuer's Abendessen (nicht Tages-Makros)
  // — konsistent zum Rest der App, wo geplantes Abendessen der Fokus ist.
  const targets = dinnerMacroTargets() ?? { p: 0, kh: 0, f: 0 };
  const isCustom = p.macroTargets != null;
  const activePreset = isCustom ? null : (p.macroPreset ?? MACRO_PRESET_DEFAULT);
  // Preset-Name nicht mehr im Hint zeigen — der aktive Chip unten spricht
  // fuer sich. Nur Sonderzustaende (Multi-Select, Custom) bleiben.
  const hint = isMulti
    ? `Ø aus ${selected.length} Profilen`
    : (isCustom ? 'Manuell überschrieben' : '');
  const disabledAttr = isMulti ? 'disabled' : '';
  const controlsDisabledCls = isMulti ? ' macro-controls--disabled' : '';
  return `
    <div class="macro-controls${controlsDisabledCls}">
      <div class="macro-controls__header">
        <h3 class="macro-controls__title">Makro Sollwerte</h3>
        <span class="macro-controls__hint" data-role="macro-hint">${hint}</span>
        <button class="settings-refresh"
                type="button"
                data-action="macros-reset"
                data-role="macros-reset"
                ${(isCustom && !isMulti) ? '' : 'hidden'}
                aria-label="Vorschlag wiederherstellen"
                title="Vorschlag wiederherstellen">
          ${ICON_REFRESH}
        </button>
      </div>
      <div data-role="soll-donut-slot" class="macro-donut-slot">${renderSollMacros(targets)}</div>
      <div class="macro-controls__preset-label">Makro Profil</div>
      <div class="macro-controls__presets" role="group" aria-label="Makro-Presets">
        ${MACRO_PRESETS.map((m) => `
          <button class="pref-chip"
                  type="button"
                  data-macro-preset="${m.key}"
                  aria-pressed="${activePreset === m.key}"
                  ${disabledAttr}>
            ${m.label}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderMacroSlider(key, label, value) {
  // Alle drei Slider teilen dieselbe Range 0..200 g — realistisch fuer's
  // Abendessen (Preset 40 % P bei 1000 kcal Dinner = 100 g; Extreme decken
  // 200 g ab). Gleiche Skala erlaubt visuellen Groessenvergleich zwischen
  // P/KH/F. Slider ist reine Anzeige (readonly) — Thumb ist per CSS versteckt.
  const rounded = Math.round(value);
  return `
    <div class="settings-field macro-slider--${key}">
      <div class="settings-row">
        <div class="settings-row__label">
          <div class="settings-row__label-primary">${label}</div>
        </div>
        <div class="settings-row__value" data-role="macro-${key}-value">${rounded.toLocaleString('de-DE')} g</div>
      </div>
      <input type="range"
             class="settings-slider settings-slider--readonly settings-slider--${key}"
             data-action="macro-${key}-change"
             min="0"
             max="200"
             step="${MACRO_STEP}"
             value="${rounded}"
             tabindex="-1"
             aria-disabled="true"
             aria-label="${label} für Abendessen in Gramm (Anzeige)" />
    </div>
  `;
}

// Nach Preset-/Slider-/Refresh-Änderung: Chart + Ø + Slider-Anzeigen neu
// rendern. Wir tauschen nur die Slots aus, damit der Sheet-Container und die
// Handler-Bindungen am Root nicht verloren gehen. Handler auf den neuen Bar-
// Hits müssen aber neu gebunden werden.
function refreshChartAndAvg() {
  const target = avgDinnerTargetOfSelected();
  const [rangeLow, rangeHigh] = target != null ? kcalRange(target) : [null, null];
  const avg = averageMacros();
  const chartSlot = rootEl.querySelector('[data-role="chart-slot"]');
  const donutSlot = rootEl.querySelector('[data-role="donut-slot"]');
  const headerKcal = rootEl.querySelector('[data-role="header-kcal"]');
  if (chartSlot) chartSlot.innerHTML = renderChart(target, rangeLow, rangeHigh, avg);
  if (donutSlot) {
    donutSlot.innerHTML = renderIstMacros(avg);
    donutSlot.classList.remove('macro-donut-slot--muted');
  }
  if (headerKcal) headerKcal.textContent = formatHeaderKcal(avg);
  bindBarHits();
  requestAnimationFrame(syncKcalPillWidths);
}

// Intro-Zeile ueber dem Balken-Chart: Sollwert-Range in Kcal + Hinweistext.
// Layout so justiert dass der Hint nah am Chart sitzt und das Chart selbst
// dennoch weit oben Platz bekommt (via negativem margin-bottom im CSS).
function renderChartIntro(rangeLow, rangeHigh) {
  if (rangeLow == null || rangeHigh == null) return '';
  const round10 = (n) => Math.round(n / 10) * 10;
  const lo = round10(rangeLow).toLocaleString('de-DE');
  const hi = round10(rangeHigh).toLocaleString('de-DE');
  return `
    <div class="macro-chart-intro">
      <div class="macro-chart-intro__row">
        <span class="macro-chart-intro__label">Sollwert</span>
        <span class="macro-title__kcal macro-title__kcal--inactive">${lo}&thinsp;–&thinsp;${hi} kcal</span>
      </div>
      <div class="macro-chart-intro__hint">Die Ø Ist-Werte berechnen sich aus den Gerichten deiner Woche.</div>
    </div>
  `;
}

// Header-kcal-Pille: nur Ø-Symbol vor dem kcal-Wert. Kompakter als vorher
// ('Ø Woche · X kcal'), macht Platz fuer die Reset-Pille daneben.
function formatHeaderKcal(avg) {
  if (!avg) return '';
  return `Ø ${Math.round(avg.kcal).toLocaleString('de-DE')} kcal`;
}

// Ist-Werte-Ausgabe wie in der Wizzard-Zusammenfassung: Kreisdiagramm links,
// Farbige Legende mit g + % rechts. Verwendet dieselbe renderMacros-Impl —
// Werte werden vorher gerundet (avg liefert floats).
function renderIstMacros(avg) {
  if (!avg) return '';
  return renderMacros({
    p: Math.round(avg.p),
    kh: Math.round(avg.kh),
    f: Math.round(avg.f),
  }, { withLabel: false });
}

// Soll-Werte-Ausgabe im gleichen Kreis+Legende-Format wie die Ist-Ausgabe —
// visuell direkt vergleichbar. Werte kommen aus dinnerMacroTargets (Preset
// oder Custom applied auf Abendessen-kcal).
function renderSollMacros(targets) {
  if (!targets) return '';
  return renderMacros({
    p: Math.round(targets.p),
    kh: Math.round(targets.kh),
    f: Math.round(targets.f),
  }, { withLabel: false });
}

function bindBarHits() {
  rootEl.querySelectorAll('.macro-chart__bar-hit').forEach((el) => {
    el.addEventListener('click', () => {
      const day = el.dataset.day;
      const dishId = state.assignment[day];
      if (dishId == null) return;
      closeMacroPopup();
      setTimeout(() => onExternalOpenDetail(dishId, 'zutaten', day), TRANSITION_MS);
    });
  });
}

function attachHandlers() {
  const overlay = rootEl.querySelector('[data-role="backdrop"]');
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) closeMacroPopup();
  });
  rootEl.querySelector('[data-action="close"]').addEventListener('click', closeMacroPopup);

  // Reset-Pille im Header: rerollAll mit Confirm. Nach Bestaetigung wird die
  // ganze Woche neu ausgelost, Chart + Ø + Slider werden neu gerendert und
  // das Dashboard bekommt via onExternalChange Bescheid (state save + refresh).
  const resetBtn = rootEl.querySelector('[data-action="reroll-all-confirm"]');
  if (resetBtn) {
    resetBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!window.confirm('Alle Gerichte wechseln?')) return;
      rerollAll();
      onExternalChange();
      refreshChartAndAvg();
    });
  }

  // Profil-Pills: Klick togglet die Auswahl. Kein Persist — reine Anzeige-
  // Praeferenz. Nach Toggle wird das Popup komplett re-rendered damit auch die
  // Controls-Section auf Multi/Single-Semantik reagiert.
  rootEl.querySelectorAll('[data-action="toggle-profile"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.profileId;
      if (!id) return;
      if (selectedProfileIds.has(id)) {
        // Mindestens ein Profil muss selected bleiben — sonst waere die
        // Anzeige leer. Der User soll stattdessen eine andere Pille aktivieren.
        if (selectedProfileIds.size === 1) return;
        selectedProfileIds.delete(id);
      } else {
        selectedProfileIds.add(id);
      }
      renderShell();
    });
  });

  // Tap-Handler auf Bar-Hit-Overlays: öffnet das Rezept-Detail-Sheet des jeweiligen
  // Tages. Kapsel-Funktion, weil wir nach jedem Preset-/Slider-Change den Chart
  // neu rendern und die Handler erneut binden müssen.
  bindBarHits();
  attachMacroControlHandlers();
  attachCloseSwipe();
}

// Preset-Chips + 3 Slider + Refresh-Button — analog zu attachMacroHandlers in
// der alten Settings-Section. Änderungen triggern refreshChartAndAvg() damit
// der Ziel-Marker / die abgeleiteten Slider-Werte live nachziehen.
function attachMacroControlHandlers() {
  const hintEl = rootEl.querySelector('[data-role="macro-hint"]');
  const resetBtn = rootEl.querySelector('[data-role="macros-reset"]');

  // Preset-Chips
  rootEl.querySelectorAll('[data-macro-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.macroPreset;
      const p = getSelectedProfiles()[0] ?? getActiveProfile();
      p.macroPreset = key;
      p.macroTargets = null;
      rootEl.querySelectorAll('[data-macro-preset]').forEach((other) => {
        other.setAttribute('aria-pressed', String(other.dataset.macroPreset === key));
      });
      if (hintEl) hintEl.textContent = '';
      if (resetBtn) resetBtn.hidden = true;
      syncSollDonut();
      refreshChartAndAvg();
      onExternalChange();
    });
  });

  // Slider: input aktualisiert nur den bewegten Slider live + speichert alle
  // drei Werte als Custom-Override. change triggert externes refresh (State-Save).
  ['p', 'kh', 'f'].forEach((k) => {
    const slider = rootEl.querySelector(`[data-action="macro-${k}-change"]`);
    const valEl = rootEl.querySelector(`[data-role="macro-${k}-value"]`);
    if (!slider) return;
    slider.addEventListener('input', () => {
      const v = parseInt(slider.value, 10);
      if (valEl) valEl.textContent = `${v.toLocaleString('de-DE')} g`;
      const p = getSelectedProfiles()[0] ?? getActiveProfile();
      p.macroTargets = readSliderMacros();
      p.macroPreset = null;
      rootEl.querySelectorAll('[data-macro-preset]').forEach((other) => {
        other.setAttribute('aria-pressed', 'false');
      });
      if (hintEl) hintEl.textContent = 'Manuell überschrieben';
      if (resetBtn) resetBtn.hidden = false;
      // Nur den Delta-Farb-Zustand der Ø-Anzeige neu rendern (die Ziel-Werte
      // haben sich geändert). Chart bleibt gleich weil nur die Ist-Werte
      // gezeichnet werden, nicht die Ziele.
      refreshAvgOnly();
    });
    slider.addEventListener('change', () => onExternalChange());
  });

  // Refresh: zurück auf Preset "Ausgewogen".
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const p = getSelectedProfiles()[0] ?? getActiveProfile();
      p.macroPreset = MACRO_PRESET_DEFAULT;
      p.macroTargets = null;
      if (hintEl) hintEl.textContent = '';
      resetBtn.hidden = true;
      rootEl.querySelectorAll('[data-macro-preset]').forEach((other) => {
        other.setAttribute('aria-pressed', String(other.dataset.macroPreset === MACRO_PRESET_DEFAULT));
      });
      syncSollDonut();
      refreshChartAndAvg();
      onExternalChange();
    });
  }
}

function readSliderMacros() {
  const g = (k) => parseInt(rootEl.querySelector(`[data-action="macro-${k}-change"]`)?.value ?? '0', 10);
  return { p: g('p'), kh: g('kh'), f: g('f') };
}

function syncSollDonut() {
  const slot = rootEl?.querySelector('[data-role="soll-donut-slot"]');
  if (slot) slot.innerHTML = renderSollMacros(dinnerMacroTargets());
}

function syncSliderValues() {
  // Slider zeigen Abendessen-Soll (nicht Tages-Werte), analog zu
  // renderControls. Sonst wuerden Preset-Wechsel/Reset die Slider auf
  // Tages-Makros zuruecksetzen und mit dem Ist-Kreis nicht mehr vergleichbar.
  const targets = dinnerMacroTargets();
  if (!targets) return;
  ['p', 'kh', 'f'].forEach((k) => {
    const slider = rootEl.querySelector(`[data-action="macro-${k}-change"]`);
    const valEl = rootEl.querySelector(`[data-role="macro-${k}-value"]`);
    const rounded = Math.round(targets[k]);
    if (slider) slider.value = String(rounded);
    if (valEl) valEl.textContent = `${rounded.toLocaleString('de-DE')} g`;
  });
}

function refreshAvgOnly() {
  const avg = averageMacros();
  const donutSlot = rootEl.querySelector('[data-role="donut-slot"]');
  const headerKcal = rootEl.querySelector('[data-role="header-kcal"]');
  if (donutSlot) {
    donutSlot.innerHTML = renderIstMacros(avg);
    donutSlot.classList.remove('macro-donut-slot--muted');
  }
  if (headerKcal) headerKcal.textContent = formatHeaderKcal(avg);
  requestAnimationFrame(syncKcalPillWidths);
}

function attachCloseSwipe() {
  const sheet = rootEl.querySelector('.macro-sheet');
  if (!sheet) return;
  const s = { startX: 0, startY: 0, tracking: false };

  sheet.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    // Swipe nur über Handle + Header — Body scrollt (auch wenn hier nichts
    // Scrollbares drin ist, hält's die Semantik konsistent mit Detail-/
    // Settings-Sheet). Buttons, Slider und Chart-Bars werden ausgeschlossen
    // damit deren Interaktion nicht als Swipe-Start missdeutet wird.
    if (ev.target.closest('button, input, .macro-chart__bar-hit')) return;
    if (ev.target.closest('.macro-body')) return;
    s.startX = ev.clientX;
    s.startY = ev.clientY;
    s.tracking = true;
    try { sheet.setPointerCapture(ev.pointerId); } catch (_) {}
  });

  sheet.addEventListener('pointerup', (ev) => {
    if (!s.tracking) return;
    s.tracking = false;
    try { sheet.releasePointerCapture(ev.pointerId); } catch (_) {}
    const dx = ev.clientX - s.startX;
    const dy = ev.clientY - s.startY;
    if (dy <= SWIPE_THRESHOLD_PX) return;
    if (dy <= Math.abs(dx) * SWIPE_DIRECTIONAL_RATIO) return;
    closeMacroPopup();
  });

  sheet.addEventListener('pointercancel', () => { s.tracking = false; });
}
