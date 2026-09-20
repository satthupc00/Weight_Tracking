// ===================================================================
// Weight Tracking — vanilla JS core (no framework, no build step)
// Created by Mondiro
// ===================================================================

// ---------------------------------------------------------------
// Storage
// ---------------------------------------------------------------
const STORAGE_KEY = 'wt_entries_v1';
const GOAL_KEY = 'wt_goal_v1';
const HEIGHT_KEY = 'wt_height_v1';
const VIEW_KEY = 'wt_view_v1';

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
function loadGoal() {
  const v = localStorage.getItem(GOAL_KEY);
  return v ? parseFloat(v) : null;
}
function saveGoal(v) {
  if (v === null || v === '' || isNaN(v)) localStorage.removeItem(GOAL_KEY);
  else localStorage.setItem(GOAL_KEY, String(v));
}
function loadHeight() {
  const v = localStorage.getItem(HEIGHT_KEY);
  return v ? parseFloat(v) : null;
}
function saveHeight(v) {
  if (v === null || v === '' || isNaN(v)) localStorage.removeItem(HEIGHT_KEY);
  else localStorage.setItem(HEIGHT_KEY, String(v));
}
// persisted pan/zoom so the chart reopens exactly where it was left, instead of resetting every launch
function loadViewState() {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    const nums = [v.xMin, v.xMax, v.yMin, v.yMax];
    if (nums.every(n => typeof n === 'number' && isFinite(n)) && v.xMax > v.xMin && v.yMax > v.yMin) return v;
  } catch (e) { /* ignore corrupt state */ }
  return null;
}
function saveViewState() {
  if (view.xMin === null || view.xMax === null || view.yMin === null || view.yMax === null) return;
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify({ xMin: view.xMin, xMax: view.xMax, yMin: view.yMin, yMax: view.yMax }));
  } catch (e) { /* ignore quota errors */ }
}

// optional demo/preview seed (only used by the standalone preview build; harmless no-op otherwise)
if (loadEntries().length === 0 && window.__WT_SEED_ENTRIES__) saveEntries(window.__WT_SEED_ENTRIES__);
if (loadGoal() === null && window.__WT_SEED_GOAL__ != null) saveGoal(window.__WT_SEED_GOAL__);

let entries = loadEntries(); // {id, date:'YYYY-MM-DD', weight:Number, note:String}
let goalWeight = loadGoal();
let heightCm = loadHeight();

function sortedEntries() {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}
function upsertEntry(entry) {
  const idx = entries.findIndex(e => e.date === entry.date);
  if (idx >= 0) entries[idx] = { ...entries[idx], ...entry };
  else entries.push(entry);
  saveEntries(entries);
}

// ---------------------------------------------------------------
// CSV — format matches the user's existing export: "date"\t"weight"\t"note"
// ---------------------------------------------------------------
const LBS_PER_KG = 2.2046226218;
function parseCsv(text, unit) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    // split on tab first, fall back to comma
    let parts = line.split('\t');
    if (parts.length < 2) parts = line.split(',');
    if (parts.length < 2) continue;
    const clean = s => (s || '').trim().replace(/^"(.*)"$/, '$1');
    const date = clean(parts[0]);
    const weightStr = clean(parts[1]);
    const note = clean(parts[2] || '');
    let weight = parseFloat(weightStr);
    if (!date || isNaN(weight)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (unit === 'lbs') weight = weight / LBS_PER_KG;
    out.push({ id: date, date, weight, note });
  }
  return out;
}
function entriesToCsv(list) {
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date)); // newest first, matches sample file
  return sorted.map(e => `"${e.date}"\t"${e.weight.toFixed(1)}"\t"${(e.note || '').replace(/"/g, '""')}"`).join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------
const VN_MONTHS_SHORT = ['Th1','Th2','Th3','Th4','Th5','Th6','Th7','Th8','Th9','Th10','Th11','Th12'];
function toDate(iso) { const [y,m,d] = iso.split('-').map(Number); return new Date(y, m-1, d); }
function toIso(d) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function isMonday(iso) { return toDate(iso).getDay() === 1; }
function fmtShort(d) { return `${d.getDate()} ${VN_MONTHS_SHORT[d.getMonth()]}`; }
function fmtLong(iso) {
  const d = toDate(iso);
  return `${d.getDate()} tháng ${d.getMonth()+1} ${d.getFullYear()}`;
}
function daysBetween(a, b) { return (b - a) / 86400000; }

// ---------------------------------------------------------------
// Trend (7-day) — simple linear regression over the most recent 7 entries
// ---------------------------------------------------------------
function computeTrend(list) {
  const sorted = [...list].sort((a,b)=>a.date.localeCompare(b.date));
  const recent = sorted.slice(-7);
  if (recent.length < 2) return null;
  const t0 = toDate(recent[0].date).getTime();
  const xs = recent.map(e => daysBetween(t0, toDate(e.date).getTime()));
  const ys = recent.map(e => e.weight);
  const n = xs.length;
  const sumX = xs.reduce((a,b)=>a+b,0), sumY = ys.reduce((a,b)=>a+b,0);
  const sumXY = xs.reduce((a,x,i)=>a+x*ys[i],0);
  const sumXX = xs.reduce((a,x)=>a+x*x,0);
  const denom = (n*sumXX - sumX*sumX);
  const slope = denom === 0 ? 0 : (n*sumXY - sumX*sumY) / denom; // kg / day
  const lastIso = sorted[sorted.length-1].date;
  const lastWeight = sorted[sorted.length-1].weight;
  return { slopePerDay: slope, lastIso, lastWeight };
}

// ===================================================================
// CHART
// ===================================================================
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');
const chartWrap = document.getElementById('chartWrap');
const tooltip = document.getElementById('tooltip');
const emptyState = document.getElementById('emptyState');

let view = loadViewState() || { xMin: null, xMax: null, yMin: null, yMax: null }; // xMin/xMax = timestamps (ms), yMin/yMax = kg
let selected = null; // selected entry for tooltip
let lastScale = null; // {xToPx, yToPx} from the most recent drawChart(), reused for tap hit-testing
const PAD = { l: 46, r: 16, t: 22, b: 30 };
const FUTURE_DAYS = 21;
const PROJECTION_DAYS = 30; // how far ahead the prediction dashed line is drawn, independent of current zoom/pan

function resizeCanvas() {
  const rect = chartWrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawChart();
}

const DEFAULT_WINDOW_DAYS = 60; // first-ever-launch fallback (no saved view yet) shows the most recent ~2 months
const RESET_WINDOW_DAYS = 21; // the ⤾ reset button instead snaps to a closer ~3-week window, tightly fit to the data
const RESET_FUTURE_DAYS = 4;

// projected weight at a given time, capped to PROJECTION_DAYS ahead of the last real entry
// (kept independent of the current zoom/pan range so the trend line never "runs away" when zoomed out)
function projectedTrendPoint(trend) {
  const lastT = toDate(trend.lastIso).getTime();
  const endT = lastT + PROJECTION_DAYS * 86400000;
  const endW = trend.lastWeight + trend.slopePerDay * PROJECTION_DAYS;
  return { lastT, startW: trend.lastWeight, endT, endW };
}

function ensureView() {
  const list = sortedEntries();
  const needX = view.xMin === null || view.xMax === null;
  const needY = view.yMin === null || view.yMax === null;
  if (!needX && !needY) return;
  if (list.length === 0) {
    if (needX) {
      const now = Date.now();
      view.xMin = now - 30 * 86400000;
      view.xMax = now + 5 * 86400000;
    }
    if (needY) { view.yMin = 50; view.yMax = 100; }
    return;
  }
  const last = toDate(list[list.length-1].date).getTime();
  if (needX) {
    view.xMax = last + FUTURE_DAYS * 86400000;
    view.xMin = view.xMax - (DEFAULT_WINDOW_DAYS + FUTURE_DAYS) * 86400000;
  }
  if (needY) {
    const recentList = list.filter(e => toDate(e.date).getTime() >= view.xMin);
    let values = (recentList.length ? recentList : list).map(e => e.weight);
    if (goalWeight) values = values.concat([goalWeight]);
    const trend = computeTrend(list);
    if (trend) { const p = projectedTrendPoint(trend); values.push(p.endW); }
    let yMin = Math.min(...values), yMax = Math.max(...values);
    if (yMin === yMax) { yMin -= 2; yMax += 2; }
    const yPad = (yMax - yMin) * 0.18 + 0.3;
    view.yMin = yMin - yPad;
    view.yMax = yMax + yPad;
  }
}

function resetView() { view.xMin = view.xMax = view.yMin = view.yMax = null; }

// what the ⤾ reset button snaps to: a closer ~3-week window tightly fit to the visible data's own
// weight range (not the wide auto-fit used for the very first launch)
function computeResetView() {
  const list = sortedEntries();
  if (list.length === 0) return null;
  const last = toDate(list[list.length - 1].date).getTime();
  const xMax = last + RESET_FUTURE_DAYS * 86400000;
  const xMin = xMax - (RESET_WINDOW_DAYS + RESET_FUTURE_DAYS) * 86400000;
  const inWindow = list.filter(e => toDate(e.date).getTime() >= xMin);
  const values = (inWindow.length ? inWindow : list).map(e => e.weight);
  let yMin = Math.min(...values), yMax = Math.max(...values);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const yPad = (yMax - yMin) * 0.12 + 0.15;
  return { xMin, xMax, yMin: yMin - yPad, yMax: yMax + yPad };
}
function resetToDefaultZoomView() {
  const rv = computeResetView();
  if (rv) view = rv; else resetView();
  saveViewState();
  drawChart();
}

function visibleEntries() {
  return sortedEntries().filter(e => {
    const t = toDate(e.date).getTime();
    return t >= view.xMin - 86400000 && t <= view.xMax + 86400000;
  });
}

function drawChart() {
  const rect = chartWrap.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  ctx.clearRect(0, 0, W, H);
  ensureView();

  const list = sortedEntries();
  emptyState.classList.toggle('hidden', list.length > 0);
  if (list.length === 0) return;

  const vis = visibleEntries();
  const trend = computeTrend(list);
  const yMin = view.yMin, yMax = view.yMax;

  const xToPx = (t) => PAD.l + (t - view.xMin) / (view.xMax - view.xMin) * (W - PAD.l - PAD.r);
  const yToPx = (v) => H - PAD.b - (v - yMin) / (yMax - yMin) * (H - PAD.t - PAD.b);
  lastScale = { xToPx, yToPx }; // reused by tap-hit-testing so it matches exactly what was drawn

  // ---- grid + y labels ----
  ctx.strokeStyle = '#26313f';
  ctx.fillStyle = '#7f97ab';
  ctx.font = '11px -apple-system,Roboto,Arial,sans-serif';
  ctx.textBaseline = 'middle';
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const v = yMin + (yMax - yMin) * i / ySteps;
    const py = yToPx(v);
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(PAD.l, py); ctx.lineTo(W - PAD.r, py); ctx.lineWidth = 1;
    ctx.strokeStyle = '#222d3a'; ctx.stroke();
    ctx.fillText(v.toFixed(1), 4, py);
  }

  // ---- x labels ----
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const xSteps = 4;
  for (let i = 0; i <= xSteps; i++) {
    const t = view.xMin + (view.xMax - view.xMin) * i / xSteps;
    const px = xToPx(t);
    ctx.fillStyle = '#7f97ab';
    ctx.fillText(fmtShort(new Date(t)), px, H - PAD.b + 8);
  }
  ctx.textAlign = 'left';

  // ---- goal dashed line ----
  if (goalWeight) {
    const py = yToPx(goalWeight);
    ctx.save();
    ctx.setLineDash([6,5]);
    ctx.strokeStyle = '#e6483f';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PAD.l, py); ctx.lineTo(W - PAD.r, py); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#e6483f';
    ctx.font = '11px -apple-system,Roboto,Arial,sans-serif';
    ctx.fillText(`mục tiêu: ${goalWeight.toFixed(1)} kg`, PAD.l + 6, py - 14);
  }

  // ---- prediction dashed line (capped to PROJECTION_DAYS ahead, independent of zoom) ----
  if (trend) {
    const proj = projectedTrendPoint(trend);
    const startPx = xToPx(proj.lastT);
    const startPy = yToPx(proj.startW);
    const endPx = xToPx(proj.endT);
    const endPy = yToPx(proj.endW);
    ctx.save();
    ctx.setLineDash([4,4]);
    ctx.strokeStyle = '#4fd6c4';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(startPx, startPy); ctx.lineTo(endPx, endPy); ctx.stroke();
    ctx.restore();
    const perWeek = trend.slopePerDay * 7;
    ctx.fillStyle = '#4fd6c4';
    ctx.font = '11px -apple-system,Roboto,Arial,sans-serif';
    const label = `${perWeek >= 0 ? '+' : ''}${perWeek.toFixed(1)} kg/tuần`;
    // keep the label inside the visible chart area even if the projected endpoint is off-screen
    const lx = Math.min(Math.max(endPx, PAD.l + 60), W - PAD.r - 4);
    ctx.textAlign = 'right';
    ctx.fillText(label, lx, Math.min(Math.max(endPy, PAD.t + 12), H - PAD.b - 4) - 12);
    ctx.textAlign = 'left';
  }

  // ---- solid line through actual points ----
  ctx.beginPath();
  vis.forEach((e, i) => {
    const px = xToPx(toDate(e.date).getTime());
    const py = yToPx(e.weight);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = '#4fd6c4';
  ctx.lineWidth = 2;
  ctx.stroke();

  // ---- points ----
  vis.forEach(e => {
    const px = xToPx(toDate(e.date).getTime());
    const py = yToPx(e.weight);
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI*2);
    ctx.fillStyle = isMonday(e.date) ? '#e6483f' : '#4fd6c4';
    ctx.fill();
  });

  // ---- weight value labels above each point ----
  // Monday (red-dot) labels always show; a non-Monday label is hidden instead if it would overlap
  // one — so pass 1 reserves+draws every Monday label first, then pass 2 fills in the rest around them.
  ctx.font = '11px -apple-system,Roboto,Arial,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const LABEL_GAP = 4;
  const mondayRects = [];
  vis.forEach(e => {
    if (!isMonday(e.date)) return;
    const px = xToPx(toDate(e.date).getTime());
    const py = yToPx(e.weight);
    if (py - 10 < PAD.t) return; // too close to the top edge
    const text = e.weight.toFixed(1).replace('.', ',');
    const w = ctx.measureText(text).width;
    mondayRects.push({ left: px - w/2, right: px + w/2, px, py, text });
  });
  ctx.fillStyle = '#e6483f';
  mondayRects.forEach(r => ctx.fillText(r.text, r.px, r.py - 10));

  let lastLabelRight = -Infinity;
  vis.forEach(e => {
    if (isMonday(e.date)) return; // already drawn above, with priority
    const px = xToPx(toDate(e.date).getTime());
    const py = yToPx(e.weight);
    if (py - 10 < PAD.t) return; // too close to the top edge
    const text = e.weight.toFixed(1).replace('.', ',');
    const w = ctx.measureText(text).width;
    const left = px - w/2, right = px + w/2;
    if (left < lastLabelRight + LABEL_GAP) return; // overlaps the previous non-Monday label — skip it
    const overlapsMonday = mondayRects.some(r => !(right + LABEL_GAP < r.left || left - LABEL_GAP > r.right));
    if (overlapsMonday) return; // overlaps a (always-shown) Monday label — skip it
    ctx.fillStyle = '#4fd6c4';
    ctx.fillText(text, px, py - 10);
    lastLabelRight = right;
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // ---- selection dashed line + marker ----
  if (selected) {
    const px = xToPx(toDate(selected.date).getTime());
    const py = yToPx(selected.weight);
    ctx.save();
    ctx.setLineDash([3,4]);
    ctx.strokeStyle = '#e8edf2';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, PAD.t); ctx.lineTo(px, H - PAD.b); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.l, py); ctx.lineTo(W - PAD.r, py); ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI*2);
    ctx.strokeStyle = '#e8edf2'; ctx.lineWidth = 2; ctx.stroke();

    positionTooltip(px, py);
  } else {
    tooltip.style.display = 'none';
  }

  // ---- BMI bar ----
  updateBmi();

  scheduleSaveView();
}

// debounce the localStorage write so a drag/pinch/fling in progress doesn't write on every single frame
let viewSaveTimer = null;
function scheduleSaveView() {
  clearTimeout(viewSaveTimer);
  viewSaveTimer = setTimeout(saveViewState, 400);
}

function positionTooltip(px, py) {
  const bmi = heightCm ? (selected.weight / ((heightCm/100)**2)) : null;
  tooltip.querySelector('.w').textContent = `${selected.weight.toFixed(1)} kg`;
  tooltip.querySelector('.d').textContent = fmtLong(selected.date) + (bmi ? `  BMI: ${bmi.toFixed(1)}` : '');
  const noteEl = tooltip.querySelector('.n');
  if (selected.note) { noteEl.textContent = selected.note; noteEl.style.display='block'; }
  else noteEl.style.display = 'none';
  tooltip.style.display = 'block';
  const rect = chartWrap.getBoundingClientRect();
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  let left = px - tw/2, top = py - th - 16;
  left = Math.max(4, Math.min(rect.width - tw - 4, left));
  if (top < 4) top = py + 16;
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

function updateBmi() {
  const bar = document.getElementById('bmiBar');
  if (!heightCm || entries.length === 0) { bar.style.display = 'none'; return; }
  const latest = sortedEntries()[sortedEntries().length-1];
  const bmi = latest.weight / ((heightCm/100)**2);
  bar.style.display = 'flex';
  document.getElementById('bmiLabel').textContent = `BMI: ${bmi.toFixed(1)}`;
}

// ---------------------------------------------------------------
// touch: free pan (1 finger, both axes) + free independent pinch zoom (2 fingers)
// + tap-to-select/toggle + Google-Maps-style "double-tap-then-hold-and-drag" one-finger
//   zoom (drag vertically to zoom the y-axis, horizontally to zoom the x-axis) so the
//   whole chart is usable one-handed without needing a second finger to pinch.
// ---------------------------------------------------------------
let touchState = null;
let pendingTap = null; // {time, x, y} of the most recent quick single-finger tap — used to detect the 2nd tap-and-hold
const DOUBLE_TAP_MS = 350, DOUBLE_TAP_PX = 40;
const DRAG_ZOOM_SENSITIVITY = 70; // px of drag per octave (doubling/halving) of the axis span — lower = faster zoom (2x speed)
const MIN_X_SPAN = 3 * 86400000, MAX_X_SPAN = 3650 * 86400000;
const MIN_Y_SPAN = 1, MAX_Y_SPAN = 1000;

function plotRect(rect) { return { w: rect.width - PAD.l - PAD.r, h: rect.height - PAD.t - PAD.b }; }

function panBy(dxPx, dyPx, rect) {
  const { w, h } = plotRect(rect);
  const dt = -dxPx * (view.xMax - view.xMin) / w;
  const dv = dyPx * (view.yMax - view.yMin) / h; // screen-down (+dyPx) = value down
  view.xMin += dt; view.xMax += dt;
  view.yMin += dv; view.yMax += dv;
}

function zoomAt(anchorPxX, anchorPxY, scaleX, scaleY, rect) {
  const { w, h } = plotRect(rect);
  if (scaleX !== 1) {
    const t = view.xMin + (anchorPxX - PAD.l) / w * (view.xMax - view.xMin);
    const oldSpan = view.xMax - view.xMin;
    const newSpan = Math.max(MIN_X_SPAN, Math.min(oldSpan * scaleX, MAX_X_SPAN));
    const ratioLeft = (t - view.xMin) / oldSpan;
    view.xMin = t - newSpan * ratioLeft;
    view.xMax = view.xMin + newSpan;
  }
  if (scaleY !== 1) {
    const v = view.yMax - (anchorPxY - PAD.t) / h * (view.yMax - view.yMin);
    const oldSpan = view.yMax - view.yMin;
    const newSpan = Math.max(MIN_Y_SPAN, Math.min(oldSpan * scaleY, MAX_Y_SPAN));
    const ratioTop = (view.yMax - v) / oldSpan;
    view.yMax = v + newSpan * ratioTop;
    view.yMin = view.yMax - newSpan;
  }
}

chartWrap.addEventListener('touchstart', (ev) => {
  ev.preventDefault();
  const rect = chartWrap.getBoundingClientRect();
  if (ev.touches.length === 1) {
    const x = ev.touches[0].clientX, y = ev.touches[0].clientY;
    const isSecondTapOfDoubleTap = pendingTap && (Date.now() - pendingTap.time < DOUBLE_TAP_MS) &&
      Math.hypot(x - pendingTap.x, y - pendingTap.y) < DOUBLE_TAP_PX;
    pendingTap = null;
    if (isSecondTapOfDoubleTap) {
      touchState = { mode: 'dragzoom', originX: x - rect.left, originY: y - rect.top, baseline: { ...view }, moved: false };
    } else {
      touchState = { mode: 'pan', startX: x, startY: y, lastX: x, lastY: y,
                     moved: false, startTouchX: x - rect.left, startTouchY: y - rect.top };
    }
  } else if (ev.touches.length === 2) {
    pendingTap = null;
    const xDist = Math.abs(ev.touches[0].clientX - ev.touches[1].clientX);
    const yDist = Math.abs(ev.touches[0].clientY - ev.touches[1].clientY);
    const cx = (ev.touches[0].clientX + ev.touches[1].clientX) / 2 - rect.left;
    const cy = (ev.touches[0].clientY + ev.touches[1].clientY) / 2 - rect.top;
    touchState = { mode: 'pinch', startXDist: xDist, startYDist: yDist, cx, cy };
  }
}, { passive: false });

chartWrap.addEventListener('touchmove', (ev) => {
  ev.preventDefault();
  if (!touchState) return;
  const rect = chartWrap.getBoundingClientRect();
  if (touchState.mode === 'pan' && ev.touches.length === 1) {
    const x = ev.touches[0].clientX, y = ev.touches[0].clientY;
    const dxPx = x - touchState.lastX, dyPx = y - touchState.lastY;
    if (Math.abs(x - touchState.startX) > 3 || Math.abs(y - touchState.startY) > 3) touchState.moved = true;
    panBy(dxPx, dyPx, rect);
    touchState.lastX = x; touchState.lastY = y;
    drawChart();
  } else if (touchState.mode === 'pinch' && ev.touches.length === 2) {
    const xDist = Math.abs(ev.touches[0].clientX - ev.touches[1].clientX);
    const yDist = Math.abs(ev.touches[0].clientY - ev.touches[1].clientY);
    // only scale an axis once the fingers have meaningful separation on it (avoids divide-by-~0 jumps)
    const MIN_DIST = 24;
    const scaleX = (touchState.startXDist > MIN_DIST && xDist > MIN_DIST) ? touchState.startXDist / xDist : 1;
    const scaleY = (touchState.startYDist > MIN_DIST && yDist > MIN_DIST) ? touchState.startYDist / yDist : 1;
    zoomAt(touchState.cx, touchState.cy, scaleX, scaleY, rect);
    touchState.startXDist = xDist; touchState.startYDist = yDist;
    drawChart();
  } else if (touchState.mode === 'dragzoom' && ev.touches.length === 1) {
    const x = ev.touches[0].clientX - rect.left, y = ev.touches[0].clientY - rect.top;
    const dx = x - touchState.originX, dy = y - touchState.originY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) touchState.moved = true;
    // recompute from the baseline captured at gesture start (not incrementally) so the zoom never drifts
    view.xMin = touchState.baseline.xMin; view.xMax = touchState.baseline.xMax;
    view.yMin = touchState.baseline.yMin; view.yMax = touchState.baseline.yMax;
    const scaleX = Math.pow(2, dx / DRAG_ZOOM_SENSITIVITY);
    const scaleY = Math.pow(2, dy / DRAG_ZOOM_SENSITIVITY);
    zoomAt(touchState.originX, touchState.originY, scaleX, scaleY, rect);
    drawChart();
  }
}, { passive: false });

chartWrap.addEventListener('touchend', (ev) => {
  if (touchState && touchState.mode === 'pan' && !touchState.moved) {
    handleTap(touchState.startTouchX, touchState.startTouchY);
    pendingTap = { time: Date.now(), x: touchState.startX, y: touchState.startY };
  } else if (touchState && touchState.mode === 'dragzoom' && !touchState.moved) {
    // 2nd tap released without dragging (no zoom happened) — treat it as a normal tap: toggle the point's info
    handleTap(touchState.originX, touchState.originY);
  }
  if (ev.touches.length === 0) touchState = null;
});

// mouse fallback for desktop preview: drag pans both axes, wheel zooms x (shift+wheel zooms y),
// click-then-hold-and-drag mirrors the mobile double-tap-drag zoom gesture
let mouseDown = null;
let pendingClick = null;
chartWrap.addEventListener('mousedown', (ev) => {
  const rect = chartWrap.getBoundingClientRect();
  const isSecondClick = pendingClick && (Date.now() - pendingClick.time < DOUBLE_TAP_MS) &&
    Math.hypot(ev.clientX - pendingClick.x, ev.clientY - pendingClick.y) < DOUBLE_TAP_PX;
  pendingClick = null;
  if (isSecondClick) {
    mouseDown = { mode: 'dragzoom', originX: ev.clientX - rect.left, originY: ev.clientY - rect.top, baseline: { ...view }, moved: false };
  } else {
    mouseDown = { mode: 'pan', x: ev.clientX, y: ev.clientY, lastX: ev.clientX, lastY: ev.clientY, moved: false };
  }
});
window.addEventListener('mousemove', (ev) => {
  if (!mouseDown) return;
  const rect = chartWrap.getBoundingClientRect();
  if (mouseDown.mode === 'pan') {
    const dxPx = ev.clientX - mouseDown.lastX, dyPx = ev.clientY - mouseDown.lastY;
    if (Math.abs(ev.clientX - mouseDown.x) > 3 || Math.abs(ev.clientY - mouseDown.y) > 3) mouseDown.moved = true;
    panBy(dxPx, dyPx, rect);
    mouseDown.lastX = ev.clientX; mouseDown.lastY = ev.clientY;
    if (mouseDown.moved) drawChart();
  } else if (mouseDown.mode === 'dragzoom') {
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    const dx = x - mouseDown.originX, dy = y - mouseDown.originY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) mouseDown.moved = true;
    view.xMin = mouseDown.baseline.xMin; view.xMax = mouseDown.baseline.xMax;
    view.yMin = mouseDown.baseline.yMin; view.yMax = mouseDown.baseline.yMax;
    zoomAt(mouseDown.originX, mouseDown.originY, Math.pow(2, dx/DRAG_ZOOM_SENSITIVITY), Math.pow(2, dy/DRAG_ZOOM_SENSITIVITY), rect);
    drawChart();
  }
});
window.addEventListener('mouseup', (ev) => {
  const rect = chartWrap.getBoundingClientRect();
  if (mouseDown && mouseDown.mode === 'pan' && !mouseDown.moved) {
    handleTap(ev.clientX - rect.left, ev.clientY - rect.top);
    pendingClick = { time: Date.now(), x: mouseDown.x, y: mouseDown.y };
  } else if (mouseDown && mouseDown.mode === 'dragzoom' && !mouseDown.moved) {
    handleTap(mouseDown.originX, mouseDown.originY);
  }
  mouseDown = null;
});
chartWrap.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const rect = chartWrap.getBoundingClientRect();
  const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
  const factor = ev.deltaY > 0 ? 1.1 : 0.9;
  if (ev.shiftKey) zoomAt(px, py, 1, factor, rect); else zoomAt(px, py, factor, 1, rect);
  drawChart();
}, { passive: false });

function handleTap(px, py) {
  const vis = visibleEntries();
  if (vis.length === 0 || !lastScale) { selected = null; drawChart(); return; }
  const { xToPx } = lastScale;

  // match by horizontal distance only — tap anywhere along the column of a date, at any height, still hits that point
  let best = null, bestDist = Infinity;
  for (const e of vis) {
    const ex = xToPx(toDate(e.date).getTime());
    const d = Math.abs(ex - px);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  if (best && bestDist < 30) {
    selected = (selected && selected.date === best.date) ? null : best; // tap the same point again to close its info
  } else {
    selected = null;
  }
  drawChart();
}

window.addEventListener('resize', resizeCanvas);
document.getElementById('resetZoomBtn').addEventListener('click', resetToDefaultZoomView);

// ===================================================================
// Screen navigation
// ===================================================================
const chartScreen = document.getElementById('chartScreen');
const settingsScreen = document.getElementById('settingsScreen');
const navChart = document.getElementById('navChart');
const navSettings = document.getElementById('navSettings');
const navAdd = document.getElementById('navAdd');

function showScreen(name) {
  chartScreen.classList.toggle('active', name === 'chart');
  settingsScreen.classList.toggle('active', name === 'settings');
  navChart.classList.toggle('dim', name !== 'chart');
  navSettings.classList.toggle('dim', name !== 'settings');
  if (name === 'chart') { requestAnimationFrame(resizeCanvas); }
}
navChart.addEventListener('click', () => showScreen('chart'));
navSettings.addEventListener('click', () => showScreen('settings'));

// ===================================================================
// Settings screen wiring
// ===================================================================
const goalInput = document.getElementById('goalInput');
const heightInput = document.getElementById('heightInput');
goalInput.value = goalWeight !== null ? goalWeight : '';
heightInput.value = heightCm !== null ? heightCm : '';
goalInput.addEventListener('change', () => {
  goalWeight = goalInput.value === '' ? null : parseFloat(goalInput.value);
  saveGoal(goalWeight);
  drawChart();
});
heightInput.addEventListener('change', () => {
  heightCm = heightInput.value === '' ? null : parseFloat(heightInput.value);
  saveHeight(heightCm);
  drawChart();
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Xoá toàn bộ dữ liệu cân nặng đã nhập? Không thể hoàn tác.')) {
    entries = [];
    saveEntries(entries);
    selected = null;
    resetView();
    drawChart();
  }
});

// ---- export ----
document.getElementById('exportBtn').addEventListener('click', async () => {
  if (!entries.length) { alert('Chưa có dữ liệu để xuất.'); return; }
  const csv = entriesToCsv(entries);
  const filename = `w-tracker-${new Date().toISOString().slice(0,19).replace('T','_').replace(/:/g,'-')}.csv`;

  // Đường chính: dùng plugin Capacitor Filesystem + Share (chạy trong app Android thật)
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
    try {
      const { Filesystem, Directory } = window.Capacitor.Plugins;
      const res = await Filesystem.writeFile({ path: filename, data: csv, directory: Directory.Cache, encoding: 'utf8' });
      if (window.Capacitor.Plugins.Share) {
        await window.Capacitor.Plugins.Share.share({ title: 'Weight Tracking data', url: res.uri, dialogTitle: 'Chia sẻ file CSV' });
      } else {
        alert('Đã lưu file CSV vào bộ nhớ đệm của app, nhưng thiếu plugin Share để chia sẻ ra ngoài.');
      }
      return;
    } catch (e) {
      alert('Xuất file lỗi: ' + (e && e.message ? e.message : e));
      return;
    }
  }

  // Fallback: chỉ có tác dụng khi mở bằng trình duyệt thật (không phải WebView trong app),
  // ví dụ khi test file dist/preview.html trên máy tính.
  const blob = new Blob([csv], { type: 'text/csv' });
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'text/csv' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Weight Tracking data' });
        return;
      }
    } catch (e) { /* rơi xuống cách tải file bên dưới */ }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Không thể xuất file trong môi trường này.');
  }
});

// ---- import ----
const csvFileInput = document.getElementById('csvFileInput');
document.getElementById('importBtn').addEventListener('click', () => csvFileInput.click());
csvFileInput.addEventListener('change', () => {
  const file = csvFileInput.files[0];
  if (!file) return;
  const unit = document.getElementById('importLbsToggle').checked ? 'lbs' : 'kg';
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseCsv(String(reader.result), unit);
    if (parsed.length === 0) { alert('Không đọc được dữ liệu hợp lệ từ file này.'); return; }
    const byDate = new Map(entries.map(e => [e.date, e]));
    parsed.forEach(e => byDate.set(e.date, e));
    entries = Array.from(byDate.values());
    saveEntries(entries);
    resetView();
    drawChart();
    alert(`Đã nhập ${parsed.length} dòng dữ liệu.`);
  };
  reader.readAsText(file, 'utf-8');
  csvFileInput.value = '';
});

// ===================================================================
// Entry modal (add / edit)
// ===================================================================
const entryModal = document.getElementById('entryModal');
const dateBtnLabel = document.getElementById('dateBtnLabel');
const noteBtnLabel = document.getElementById('noteBtnLabel');
let draft = { date: null, weight: null, note: '' };

// ---------------------------------------------------------------
// Wheel picker — custom transform-driven (no native scroll), so it can loop
// infinitely (the decimal column wraps 0↔9) and has real drag-1:1 + momentum-
// fling + ease-out-snap physics for a smooth, native-picker feel.
// ---------------------------------------------------------------
const ITEM_H = 60;
const WHEEL_BUFFER = 12; // render this many slots above/below center so nothing pops in during a long fast fling
const WHEEL_FRICTION_TAU = 220; // ms — higher = the fling coasts longer before settling (was 90 — too short to loop)
const WHEEL_STOP_VELOCITY = 0.015; // index-units/ms below which momentum ends and the snap begins
const WHEEL_SNAP_MS = 180;
const WHEEL_VELOCITY_BOOST = 1.5; // amplifies the raw drag-release velocity so a fast/strong swipe can carry a full 0-9 loop
const WHEEL_MAX_VELOCITY = 7; // index-units/ms cap after boosting

function createWheel(el, min, max, loop, onChange) {
  const range = max - min + 1;
  const slots = [];
  for (let i = -WHEEL_BUFFER; i <= WHEEL_BUFFER; i++) {
    const div = document.createElement('div');
    div.className = 'wheel-item';
    el.appendChild(div);
    slots.push(div);
  }

  let position = 0; // continuous index position (0 == min)
  let velocity = 0; // index-units per ms
  let rafId = null;
  let snapAnim = null; // {from,to,start,dur} while easing to rest
  let lastEmitted = null;

  function valueAt(idx) {
    if (loop) return ((idx % range) + range) % range + min;
    const v = min + idx;
    return (v < min || v > max) ? null : v;
  }

  function render() {
    const centerIdx = Math.round(position);
    const frac = position - centerIdx;
    slots.forEach((slotEl, si) => {
      const rel = si - WHEEL_BUFFER; // -4..4
      const idx = centerIdx + rel;
      const v = valueAt(idx);
      if (v === null) { slotEl.style.opacity = '0'; return; }
      const offset = (rel - frac) * ITEM_H;
      const isCenter = Math.abs(offset) < ITEM_H * 0.5;
      slotEl.textContent = String(v);
      slotEl.style.transform = `translateY(${offset}px)`;
      slotEl.classList.toggle('center', isCenter);
      // fade + shrink toward the edges of the visible window for a subtle depth cue
      const dist = Math.min(1, Math.abs(offset) / (ITEM_H * 3));
      slotEl.style.opacity = String(1 - dist * 0.85);
      slotEl.style.display = '';
    });
    const centerValue = valueAt(centerIdx);
    if (centerValue !== null && centerValue !== lastEmitted) {
      lastEmitted = centerValue;
      onChange(centerValue);
    }
  }

  function clampBounds(p) {
    if (loop) return p;
    return Math.max(0, Math.min(range - 1, p));
  }

  function stopAnimation() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } snapAnim = null; }

  function startSnap() {
    const target = clampBounds(Math.round(position));
    snapAnim = { from: position, to: target, start: performance.now(), dur: WHEEL_SNAP_MS };
    step();
  }

  function step(ts) {
    ts = ts || performance.now();
    if (snapAnim) {
      const t = Math.min(1, (ts - snapAnim.start) / snapAnim.dur);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      position = snapAnim.from + (snapAnim.to - snapAnim.from) * eased;
      render();
      if (t < 1) { rafId = requestAnimationFrame(step); } else { position = snapAnim.to; snapAnim = null; rafId = null; render(); }
      return;
    }
    // momentum phase
    const dt = 16.7; // fixed step keeps this stable regardless of actual frame timing
    position += velocity * dt;
    velocity *= Math.exp(-dt / WHEEL_FRICTION_TAU);
    if (!loop) {
      if (position < 0) { position = 0; velocity = 0; }
      else if (position > range - 1) { position = range - 1; velocity = 0; }
    }
    render();
    if (Math.abs(velocity) < WHEEL_STOP_VELOCITY) { startSnap(); return; }
    rafId = requestAnimationFrame(step);
  }

  // ---- touch / mouse drag ----
  let drag = null; // {startY, startPosition, samples:[{t,p}]}
  function pointerDown(clientY) {
    stopAnimation();
    drag = { startY: clientY, startPosition: position, samples: [{ t: performance.now(), p: position }] };
  }
  function pointerMove(clientY) {
    if (!drag) return;
    const dy = clientY - drag.startY;
    let p = drag.startPosition - dy / ITEM_H;
    if (!loop) {
      // light rubber-band resistance past the bounds
      if (p < 0) p = p * 0.35;
      else if (p > range - 1) p = (range - 1) + (p - (range - 1)) * 0.35;
    }
    position = p;
    drag.samples.push({ t: performance.now(), p });
    if (drag.samples.length > 6) drag.samples.shift();
    render();
  }
  function pointerUp() {
    if (!drag) return;
    const now = performance.now();
    const samples = drag.samples.filter(s => now - s.t < 120);
    let v = 0;
    if (samples.length >= 2) {
      const a = samples[0], b = samples[samples.length - 1];
      const dt = b.t - a.t;
      if (dt > 0) v = (b.p - a.p) / dt;
    }
    velocity = Math.max(-WHEEL_MAX_VELOCITY, Math.min(WHEEL_MAX_VELOCITY, v * WHEEL_VELOCITY_BOOST));
    drag = null;
    if (Math.abs(velocity) < WHEEL_STOP_VELOCITY) startSnap();
    else { rafId = requestAnimationFrame(step); }
  }

  el.addEventListener('touchstart', (ev) => { ev.preventDefault(); pointerDown(ev.touches[0].clientY); }, { passive: false });
  el.addEventListener('touchmove', (ev) => { ev.preventDefault(); pointerMove(ev.touches[0].clientY); }, { passive: false });
  el.addEventListener('touchend', (ev) => { ev.preventDefault(); pointerUp(); }, { passive: false });
  el.addEventListener('mousedown', (ev) => { pointerDown(ev.clientY); const mm = (e2) => pointerMove(e2.clientY); const mu = () => { pointerUp(); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); }; window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu); });

  el.scrollToValue = (v) => {
    stopAnimation();
    position = clampBounds(v - min);
    velocity = 0;
    render();
  };
  render();
  return el;
}

const intCol = document.getElementById('intCol');
const decCol = document.getElementById('decCol');
createWheel(intCol, 20, 250, false, (v) => { draft.intPart = v; draft.weight = v + (draft.decPart||0)/10; });
createWheel(decCol, 0, 9, true, (v) => { draft.decPart = v; draft.weight = (draft.intPart||0) + v/10; });

function lastEnteredWeight() {
  const list = sortedEntries();
  return list.length ? list[list.length - 1].weight : 70.0;
}

function openModal(existing) {
  const today = toIso(new Date());
  draft = existing ? { ...existing } : { date: today, weight: null, note: '' };
  // for a new entry, start the wheel at the most recently entered weight instead of a fixed default
  // — avoids re-scrolling from scratch every time; editing an existing entry still shows its own value
  const startWeight = draft.weight ?? lastEnteredWeight();
  const [w, d] = String(startWeight.toFixed(1)).split('.');
  draft.intPart = parseInt(w, 10);
  draft.decPart = parseInt(d, 10);
  dateBtnLabel.textContent = draft.date === today ? 'Hôm nay — ' + fmtLong(draft.date) : fmtLong(draft.date);
  noteBtnLabel.textContent = draft.note ? draft.note : 'THÊM CHÚ THÍCH';
  entryModal.classList.add('active');
  requestAnimationFrame(() => {
    intCol.scrollToValue(draft.intPart);
    decCol.scrollToValue(draft.decPart);
  });
}
function closeModal() { entryModal.classList.remove('active'); }

navAdd.addEventListener('click', () => openModal(null));
document.getElementById('cancelEntryBtn').addEventListener('click', closeModal);
document.getElementById('saveEntryBtn').addEventListener('click', () => {
  const weight = (draft.intPart||0) + (draft.decPart||0)/10;
  if (!weight || weight <= 0) { alert('Vui lòng chọn cân nặng.'); return; }
  upsertEntry({ id: draft.date, date: draft.date, weight, note: draft.note || '' });
  resetView();
  selected = entries.find(e => e.date === draft.date) || null;
  closeModal();
  showScreen('chart');
  drawChart();
});

// ---- date picker: tapping the pill opens the native calendar directly (no intermediate sheet) ----
const dateSheetInput = document.getElementById('dateSheetInput');
document.getElementById('dateBtn').addEventListener('click', () => {
  dateSheetInput.value = draft.date;
  if (typeof dateSheetInput.showPicker === 'function') {
    try { dateSheetInput.showPicker(); return; } catch (e) { /* fall through to .click() below */ }
  }
  dateSheetInput.click();
});
dateSheetInput.addEventListener('change', () => {
  if (dateSheetInput.value) {
    draft.date = dateSheetInput.value;
    const today = toIso(new Date());
    dateBtnLabel.textContent = draft.date === today ? 'Hôm nay — ' + fmtLong(draft.date) : fmtLong(draft.date);
  }
});

// ---- note sheet ----
const noteOverlay = document.getElementById('noteOverlay');
const noteSheetInput = document.getElementById('noteSheetInput');
document.getElementById('noteBtn').addEventListener('click', () => {
  noteSheetInput.value = draft.note || '';
  noteOverlay.classList.add('active');
});
document.getElementById('noteCancelBtn').addEventListener('click', () => noteOverlay.classList.remove('active'));
document.getElementById('noteSaveBtn').addEventListener('click', () => {
  draft.note = noteSheetInput.value.trim();
  noteBtnLabel.textContent = draft.note ? draft.note : 'THÊM CHÚ THÍCH';
  noteOverlay.classList.remove('active');
});

// ===================================================================
// init
// ===================================================================
resizeCanvas();
drawChart();
