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
const DEADLINE_KEY = 'wt_deadline_v1'; // hạn chót đạt mục tiêu 'YYYY-MM-DD'
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
  if (window.__wtOnDataChanged) window.__wtOnDataChanged(); // đồng bộ Firebase (sync.js)
}
// Ngày đã bị xoá (để máy khác cũng xoá khi đồng bộ): { 'YYYY-MM-DD': thời điểm xoá (ms) }
const DELETED_KEY = 'wt_deleted_v1';
function loadDeleted() { try { return JSON.parse(localStorage.getItem(DELETED_KEY) || '{}') || {}; } catch (e) { return {}; } }
function saveDeleted(map) { try { localStorage.setItem(DELETED_KEY, JSON.stringify(map)); } catch (e) { /* ignore */ } }
function markDeleted(dates) {
  const m = loadDeleted(), now = Date.now();
  dates.forEach(d => { m[d] = now; });
  saveDeleted(m);
}
function unmarkDeleted(dates) {
  const m = loadDeleted();
  let changed = false;
  dates.forEach(d => { if (d in m) { delete m[d]; changed = true; } });
  if (changed) saveDeleted(m);
}
// Mục tiêu + chiều cao: thời điểm sửa gần nhất (để đồng bộ)
const SETTINGS_TS_KEY = 'wt_settings_ts_v1';
function touchSettings() {
  try { localStorage.setItem(SETTINGS_TS_KEY, String(Date.now())); } catch (e) { /* ignore */ }
  if (window.__wtOnDataChanged) window.__wtOnDataChanged();
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
function loadDeadline() {
  const v = localStorage.getItem(DEADLINE_KEY);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
function saveDeadline(v) {
  if (!v) localStorage.removeItem(DEADLINE_KEY);
  else localStorage.setItem(DEADLINE_KEY, v);
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
if (loadDeadline() === null && window.__WT_SEED_DEADLINE__) saveDeadline(window.__WT_SEED_DEADLINE__);

let entries = loadEntries(); // {id, date:'YYYY-MM-DD', weight:Number, note:String}
let goalWeight = loadGoal();
let heightCm = loadHeight();
let goalDeadline = loadDeadline();

function sortedEntries() {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}
function upsertEntry(entry) {
  entry = { ...entry, updatedAt: Date.now() }; // thời điểm sửa → bản mới nhất thắng khi đồng bộ
  unmarkDeleted([entry.date]);
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
    if (unit === 'lbs') weight = Math.round((weight / LBS_PER_KG) * 10) / 10;
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

// Kế hoạch: đi từ lần cân mới nhất tới (hạn chót, mục tiêu) với tốc độ đều
function computePlan(list) {
  if (!goalWeight || !goalDeadline || !list.length) return null;
  const last = list[list.length - 1];
  const startT = toDate(last.date).getTime(), endT = toDate(goalDeadline).getTime();
  const days = daysBetween(startT, endT);
  if (days < 1) return null; // hạn đã qua (hoặc là hôm nay) → không vẽ
  return { startT, startW: last.weight, endT, endW: goalWeight, perWeek: (goalWeight - last.weight) / days * 7, days };
}
// tốc độ mỗi ngày: dưới 1 kg thì ghi bằng gam cho dễ hình dung (vd "−57 g/ngày")
function fmtDaily(perDay) {
  const sign = perDay > 0.0005 ? '+' : perDay < -0.0005 ? '−' : '';
  const a = Math.abs(perDay);
  return a < 1 ? `${sign}${Math.round(a * 1000)} g/ngày` : `${sign}${a.toFixed(2).replace('.', ',')} kg/ngày`;
}
function fmtPace(perWeek) {
  return `${perWeek > 0.005 ? '+' : perWeek < -0.005 ? '−' : ''}${Math.abs(perWeek).toFixed(1).replace('.', ',')} kg/tuần`;
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

const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NUM_FONT = '"Barlow Condensed","Roboto Condensed","Arial Narrow",sans-serif';
const C = { grid: '#212c3b', axis: '#72859a', line: '#3cc4b2', wash: '60,196,178', mon: '#e6483f', label: '#a7b4c1',
            labelLast: '#e9edf1', goal: '#4fd6c4', trend: '#72859a', surface: '#121a26', plan: '#e6483f' };

// bước chia trục "đẹp" (0,1 · 0,2 · 0,25 · 0,5 · 1 · 2 · 5 ...)
function niceStep(span, target) {
  const raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

// dấu "!" màu vàng cạnh số của mốc có ghi chú
const NOTE_MARK_W = 9;
function drawNoteMark(x, base, size) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = `700 ${size}px ${NUM_FONT}`;
  ctx.fillStyle = '#F2B84B';
  ctx.fillText('!', x, base);
  ctx.restore();
}

// số của mốc đang chọn: nhún 1 cái rồi to lên (lò xo tắt dần), giữ to trong lúc đang chọn
let selPop = { date: null, start: 0 };
let popRaf = null;
function drawSelectedLabel(px, py) {
  if (selPop.date !== selected.date) selPop = { date: selected.date, start: performance.now() };
  const t = REDUCED_MOTION ? 5 : (performance.now() - selPop.start) / 1000;
  const decay = Math.exp(-7 * t);
  const scale = 1.3 - 0.3 * decay * Math.cos(17 * t);           // 1 → vọt ~1.5 → về 1.3
  const lift = -4 * (1 - decay) + 6 * decay * Math.sin(17 * t);  // nhún xuống rồi bật lên
  const text = selected.weight.toFixed(1).replace('.', ',');
  ctx.save();
  ctx.translate(px, py - 12 + lift);
  ctx.scale(scale, scale);
  ctx.font = `700 17px ${NUM_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4; ctx.strokeStyle = C.surface; ctx.strokeText(text, 0, 0);
  ctx.fillStyle = C.labelLast; ctx.fillText(text, 0, 0);
  if (selected.note) {
    const w = ctx.measureText(text).width;
    ctx.font = `700 17px ${NUM_FONT}`; ctx.textAlign = 'left';
    ctx.strokeText('!', w / 2 + 2, 0);
    ctx.fillStyle = '#F2B84B'; ctx.fillText('!', w / 2 + 2, 0);
  }
  ctx.restore();
  if (t < 1 && !popRaf) popRaf = requestAnimationFrame(() => { popRaf = null; drawChart(); });
}

function drawYearMarks(W, H, xToPx) {
  const left = PAD.l, right = W - PAD.r, top = PAD.t, bottom = H - PAD.b;
  const y0 = new Date(view.xMin).getFullYear(), y1 = new Date(view.xMax).getFullYear();
  if (y1 - y0 > 60) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(left, 0, right - left, bottom); ctx.clip();
  // dải nền: năm lẻ sáng hơn 1 chút → nhìn xa vẫn thấy từng năm
  for (let y = y0; y <= y1; y++) {
    if (y % 2 === 0) continue;
    const xa = Math.max(left, xToPx(new Date(y, 0, 1).getTime()));
    const xb = Math.min(right, xToPx(new Date(y + 1, 0, 1).getTime()));
    if (xb > xa) { ctx.fillStyle = 'rgba(167,180,193,0.045)'; ctx.fillRect(xa, top - 18, xb - xa, bottom - top + 18); }
  }
  // vạch đầu năm + nhãn năm
  ctx.font = `600 13px ${NUM_FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  let firstMarkX = Infinity;
  for (let y = y0 + 1; y <= y1; y++) {
    const x = Math.round(xToPx(new Date(y, 0, 1).getTime())) + 0.5;
    if (x < left || x > right) continue;
    firstMarkX = Math.min(firstMarkX, x);
    ctx.strokeStyle = 'rgba(167,180,193,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, top - 16); ctx.lineTo(x, bottom); ctx.stroke();
    ctx.fillStyle = '#8b9bab';
    ctx.fillText(String(y), x + 4, top - 6);
  }
  // nhãn năm đang xem, ghim ở góc trái (ẩn nếu sắp đụng nhãn năm kế tiếp)
  if (firstMarkX - left > 44) {
    ctx.fillStyle = '#6f8195';
    ctx.fillText(String(y0), left + 4, top - 6);
  }
  ctx.restore();
}

function drawChart() {
  const rect = chartWrap.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  ctx.clearRect(0, 0, W, H);
  ensureView();
  refreshSideUI();

  const list = sortedEntries();
  emptyState.classList.toggle('hidden', list.length > 0);
  if (list.length === 0) { tooltip.style.display = 'none'; return; }

  const vis = visibleEntries();
  const trend = computeTrend(list);
  const yMin = view.yMin, yMax = view.yMax;

  const xToPx = (t) => PAD.l + (t - view.xMin) / (view.xMax - view.xMin) * (W - PAD.l - PAD.r);
  const yToPx = (v) => H - PAD.b - (v - yMin) / (yMax - yMin) * (H - PAD.t - PAD.b);
  lastScale = { xToPx, yToPx }; // reused by tap-hit-testing so it matches exactly what was drawn

  // ---- mốc năm: dải nền xen kẽ theo năm + vạch 1/1 kèm nhãn năm ----
  drawYearMarks(W, H, xToPx);

  // ---- grid + y labels (bước chia tròn số) ----
  ctx.font = `500 14px ${NUM_FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  const yStep = niceStep(yMax - yMin, H > 420 ? 6 : 4);
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax + 1e-9; v += yStep) {
    const py = yToPx(v);
    ctx.beginPath(); ctx.moveTo(PAD.l, py); ctx.lineTo(W - PAD.r, py);
    ctx.lineWidth = 1; ctx.strokeStyle = C.grid; ctx.stroke();
    ctx.fillStyle = C.axis;
    ctx.fillText((yStep < 1 ? v.toFixed(yStep < 0.5 ? 2 : 1).replace(/0$/, '') : v.toFixed(0)).replace('.', ','), PAD.l - 8, py);
  }

  // ---- x labels: mốc ngày tròn (thứ Hai / đầu tháng) theo độ zoom ----
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const spanD = (view.xMax - view.xMin) / 86400000;
  const xStepD = spanD <= 10 ? 1 : spanD <= 45 ? 7 : spanD <= 120 ? 14 : spanD <= 420 ? 61 : spanD <= 1100 ? 122 : 365;
  const t0 = new Date(view.xMin); t0.setHours(0, 0, 0, 0);
  if (xStepD === 7 || xStepD === 14) while (t0.getDay() !== 1) t0.setDate(t0.getDate() + 1);
  if (xStepD >= 61) { t0.setDate(1); t0.setMonth(t0.getMonth() + 1); if (xStepD === 365) t0.setMonth(0); }
  let minX = -Infinity;
  for (let d = new Date(t0); d.getTime() <= view.xMax; ) {
    const px = xToPx(d.getTime());
    if (px > PAD.l + 8 && px < W - PAD.r - 8 && px > minX) {
      const lab = xStepD === 365 ? String(d.getFullYear())
                : xStepD >= 61 ? `T${d.getMonth() + 1}${d.getMonth() === 0 ? '/' + String(d.getFullYear()).slice(2) : ''}`
                : `${d.getDate()}/${d.getMonth() + 1}`;
      ctx.fillStyle = C.axis;
      ctx.fillText(lab, px, H - PAD.b + 8);
      minX = px + 42;
    }
    if (xStepD >= 61) d.setMonth(d.getMonth() + Math.round(xStepD / 30.5)); else d.setDate(d.getDate() + xStepD);
  }

  // plot area clip
  ctx.save();
  ctx.beginPath(); ctx.rect(PAD.l, 0, W - PAD.l - PAD.r, H - PAD.b); ctx.clip();

  // ---- goal dashed line (xanh = mục tiêu) ----
  if (goalWeight) {
    const py = yToPx(goalWeight);
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.globalAlpha = .6;
    ctx.strokeStyle = C.goal; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PAD.l, py); ctx.lineTo(W - PAD.r, py); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = C.axis;
    ctx.font = `500 13px ${NUM_FONT}`;
    ctx.textBaseline = 'alphabetic';
    // có hạn chót → đầu đường kế hoạch nằm trên vạch này ở bên phải, nên ghi nhãn sang trái
    const left = !!computePlan(list);
    ctx.textAlign = left ? 'left' : 'right';
    ctx.fillText(`mục tiêu ${goalWeight.toFixed(1).replace('.', ',')}`, left ? PAD.l + 6 : W - PAD.r - 4, py - 6);
  }

  // ---- area wash + solid line through actual points ----
  const pts = vis.map(e => [xToPx(toDate(e.date).getTime()), yToPx(e.weight)]);
  if (pts.length) {
    const grad = ctx.createLinearGradient(0, PAD.t, 0, H - PAD.b);
    grad.addColorStop(0, `rgba(${C.wash},.16)`); grad.addColorStop(1, `rgba(${C.wash},0)`);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], H - PAD.b);
    pts.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(pts[pts.length - 1][0], H - PAD.b);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
  }

  // ---- prediction dashed line (capped to PROJECTION_DAYS ahead, independent of zoom) ----
  if (trend) {
    const proj = projectedTrendPoint(trend);
    const startPx = xToPx(proj.lastT), startPy = yToPx(proj.startW);
    const endPx = xToPx(proj.endT), endPy = yToPx(proj.endW);
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = C.trend; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(startPx, startPy); ctx.lineTo(endPx, endPy); ctx.stroke();
    ctx.restore();
    const perWeek = trend.slopePerDay * 7;
    ctx.fillStyle = C.axis;
    ctx.font = `500 13px ${NUM_FONT}`;
    ctx.textBaseline = 'alphabetic';
    const label = `${perWeek >= 0 ? '+' : '−'}${Math.abs(perWeek).toFixed(1).replace('.', ',')} kg/tuần`;
    // keep the label inside the visible chart area even if the projected endpoint is off-screen
    const lx = Math.min(Math.max(endPx, PAD.l + 70), W - PAD.r - 4);
    ctx.textAlign = 'right';
    ctx.fillText(label, lx, Math.min(Math.max(endPy, PAD.t + 14), H - PAD.b - 4) - 10);
  }

  // ---- đường kế hoạch (đỏ, chấm đứt): từ lần cân mới nhất tới mục tiêu vào ngày hạn chót ----
  const plan = computePlan(list);
  if (plan) {
    const sx = xToPx(plan.startT), sy = yToPx(plan.startW), ex = xToPx(plan.endT), ey = yToPx(plan.endW);
    ctx.save();
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = C.plan; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]);
    // mốc hạn chót: vòng đỏ + cờ nhỏ
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2);
    ctx.fillStyle = C.surface; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
    // nhãn tốc độ cần đạt, đặt dưới đầu đường (đường dự đoán xám ghi nhãn phía trên → không đè)
    const d = toDate(goalDeadline);
    const label = `${fmtPace(plan.perWeek)} · ${d.getDate()}/${d.getMonth() + 1}`;
    ctx.font = `600 13px ${NUM_FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    const lw = ctx.measureText(label).width;
    const lx = Math.min(Math.max(ex + lw / 2, PAD.l + lw + 4), W - PAD.r - 4);
    const ly = Math.min(Math.max((ex > W - PAD.r ? sy + (ey - sy) * ((W - PAD.r - sx) / (ex - sx)) : ey) + 10, PAD.t), H - PAD.b - 34);
    const daily = fmtDaily(plan.perWeek / 7);
    ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = C.surface;
    ctx.strokeText(label, lx, ly); ctx.strokeText(daily, lx, ly + 16);
    ctx.fillStyle = C.plan; ctx.fillText(label, lx, ly); ctx.fillText(daily, lx, ly + 16);
  }

  // ---- points: viền màu nền để chấm tách khỏi đường; ẩn khi quá dày (zoom xa) ----
  const dense = pts.length > (W - PAD.l - PAD.r) / 7;
  if (!dense) vis.forEach((e, i) => {
    const mon = isMonday(e.date);
    ctx.beginPath();
    ctx.arc(pts[i][0], pts[i][1], mon ? 4.5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = mon ? C.mon : C.line; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = C.surface; ctx.stroke();
  });
  ctx.restore(); // end plot clip

  // ---- weight value labels above points ----
  // Ưu tiên: lần cân mới nhất > thứ Hai > còn lại. Một số chỉ bị ẩn khi ô chữ của nó thật sự đè lên
  // ô chữ khác theo cả chiều ngang lẫn chiều dọc. Khi zoom quá xa (dày) chỉ hiện số mới nhất + thứ Hai.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const LABEL_GAP = 3, LABEL_H = 13;
  const lastIdx = vis.length - 1;
  const lastIsLatest = vis.length && vis[lastIdx].date === list[list.length - 1].date;
  // zoom xa (dày): chỉ số mới nhất + cao nhất + thấp nhất trong khung; bình thường: mới nhất > thứ Hai > còn lại
  let hiIdx = 0, loIdx = 0;
  vis.forEach((e, i) => { if (e.weight > vis[hiIdx].weight) hiIdx = i; if (e.weight < vis[loIdx].weight) loIdx = i; });
  const rank = i => (i === lastIdx && lastIsLatest ? 2
                   : dense ? (i === hiIdx || i === loIdx ? 1 : 0)
                   : isMonday(vis[i].date) ? 1 : 0);
  const order = vis.map((e, i) => i).sort((a, b) => rank(b) - rank(a) || b - a);
  const placed = [];
  order.forEach(i => {
    const [px, py] = pts[i];
    if (px < PAD.l || px > W - PAD.r) return;
    if (py - 10 - LABEL_H < PAD.t - 12) return; // too close to the top edge
    const r = rank(i);
    if (dense && r === 0) return;
    if (selected && vis[i].date === selected.date) return; // số của mốc đang chọn vẽ riêng ở dưới (có hiệu ứng)
    const text = vis[i].weight.toFixed(1).replace('.', ',');
    ctx.font = r === 2 ? `600 17px ${NUM_FONT}` : `500 15px ${NUM_FONT}`;
    const w = ctx.measureText(text).width, base = py - 10;
    const noteW = vis[i].note ? NOTE_MARK_W : 0; // chỗ cho dấu "!" khi mốc có ghi chú
    const box = { left: px - w / 2, right: px + w / 2 + noteW, top: base - LABEL_H, bottom: base + 2 };
    if (placed.some(b => !(box.right + LABEL_GAP < b.left || box.left - LABEL_GAP > b.right ||
                           box.bottom + LABEL_GAP < b.top || box.top - LABEL_GAP > b.bottom))) return;
    placed.push(box);
    ctx.fillStyle = r === 2 ? C.labelLast : C.label;
    ctx.fillText(text, px, base);
    if (noteW) drawNoteMark(px + w / 2 + 2, base, r === 2 ? 17 : 15);
  });
  ctx.textAlign = 'left';

  // ---- selection: vertical rule + ringed marker ----
  if (selected) {
    const px = xToPx(toDate(selected.date).getTime());
    const py = yToPx(selected.weight);
    ctx.beginPath(); ctx.moveTo(px, PAD.t); ctx.lineTo(px, H - PAD.b);
    ctx.strokeStyle = C.axis; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = isMonday(selected.date) ? C.mon : C.line; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = C.surface; ctx.stroke();
    drawSelectedLabel(px, py);
    positionTooltip(px, py);
  } else {
    tooltip.style.display = 'none';
  }

  scheduleSaveView();
}

// debounce the localStorage write so a drag/pinch/fling in progress doesn't write on every single frame
let viewSaveTimer = null;
function scheduleSaveView() {
  clearTimeout(viewSaveTimer);
  viewSaveTimer = setTimeout(saveViewState, 400);
}

const WD_LONG = ['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
const WD_SHORT = ['CN','T2','T3','T4','T5','T6','T7'];
const fmtKg = v => v.toFixed(1).replace('.', ',');
const fmtSigned = v => (v > 0.04 ? '+' : v < -0.04 ? '−' : '±') + Math.abs(v).toFixed(1).replace('.', ',');
const deltaCls = v => (Math.abs(v) < 0.05 ? 'flat' : v > 0 ? 'up' : 'down');

function positionTooltip(px, py) {
  // số kg đã hiện to ngay trên điểm, nên bảng info chỉ cần ngày + nút sửa (+ ghi chú nếu có)
  const d = toDate(selected.date);
  tooltip.querySelector('.d').textContent = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  const noteEl = tooltip.querySelector('.n');
  if (selected.note) { noteEl.textContent = selected.note; noteEl.style.display = 'block'; }
  else noteEl.style.display = 'none';
  tooltip.style.display = 'block';
  const rect = chartWrap.getBoundingClientRect();
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  // chừa chỗ phía trên điểm cho con số đang "nhún" to lên
  let left = px - tw/2, top = py - th - 44;
  left = Math.max(4, Math.min(rect.width - tw - 4, left));
  if (top < 4) top = py + 18;
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

// ---------------------------------------------------------------
// Thước cân (tape) + dòng thông tin nhỏ + nhật ký — vẽ lại khi dữ liệu/mục tiêu/chiều cao đổi
// ---------------------------------------------------------------
const tapeWrap = document.getElementById('tapeWrap');
const tapeSvg = document.getElementById('tapeSvg');
const tapeTag = document.getElementById('tapeTag');
const PX_PER_KG = 120;
let tapeRange = null;        // {min, max} kg đang vẽ trên băng
let tapeShownKg = null;      // số kim đang chỉ
let sideSig = null;          // chữ ký dữ liệu lần vẽ trước — tránh vẽ lại khi chỉ pan/zoom

function buildTape(min, max) {
  const W = (max - min) * PX_PER_KG;
  let s = '';
  for (let i = 0; i <= (max - min) * 10; i++) {
    const x = i * PX_PER_KG / 10, major = i % 10 === 0, half = i % 5 === 0;
    s += `<line x1="${x}" x2="${x}" y1="0" y2="${major ? 30 : half ? 21 : 13}" stroke="${major ? '#2b2a26' : '#8b8577'}" stroke-width="${major ? 2 : 1}"/>`;
    if (major) s += `<text x="${x}" y="56" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-size="22" font-weight="600" fill="#2b2a26">${min + i/10}</text>`;
  }
  tapeSvg.setAttribute('width', W);
  tapeSvg.setAttribute('viewBox', `0 0 ${W} 70`);
  tapeSvg.innerHTML = s + '<g id="tapeMarks"></g>';
  tapeRange = { min, max };
}
function tapeMark(kg, color) {
  const x = (kg - tapeRange.min) * PX_PER_KG;
  return `<path d="M${x-6},70 L${x+6},70 L${x},60 Z" fill="${color}"/>`;
}
function placeTape(kg, animate) {
  if (!tapeRange || kg == null) return;
  tapeSvg.style.transition = animate ? 'transform 1.1s cubic-bezier(.2,.8,.2,1)' : 'none';
  tapeSvg.style.transform = `translateX(${tapeWrap.clientWidth/2 - (kg - tapeRange.min) * PX_PER_KG}px)`;
  tapeShownKg = kg;
  if (animate) wakeNeedle();
}
new ResizeObserver(() => placeTape(tapeShownKg, false)).observe(tapeWrap);

// ---- kéo thước cân bằng tay: kim đung đưa theo tốc độ kéo, buông tay thì thước lò xo về chỗ cũ ----
const needleEl = tapeWrap.querySelector('.needle');
let tapeHomeKg = null;               // số cân mới nhất — vị trí "nhà" của thước
let tapeTagHome = '';                // nội dung nhãn đỏ lúc bình thường
let tapeDrag = null;
const needleSim = { ang: 0, vel: 0, lastX: null, raf: null, calm: 0 };
function tapeX() { return new DOMMatrixReadOnly(getComputedStyle(tapeSvg).transform).m41; }
function needleLoop() {
  const x = tapeX();
  const v = needleSim.lastX === null ? 0 : x - needleSim.lastX; // px thước chạy trong 1 khung hình
  needleSim.lastX = x;
  // tâm xoay của kim nằm rất xa phía trên (CSS transform-origin) → góc nhỏ nhưng cả cây kim lia ngang theo cung tròn lớn
  const target = Math.max(-2.6, Math.min(2.6, -v * 0.12)); // kim bị thước "kéo" lệch theo hướng chạy
  needleSim.vel += (target - needleSim.ang) * 0.11;      // lò xo kéo kim về (cần dài → lắc chậm hơn chút)
  needleSim.vel *= 0.85;                                 // giảm chấn → nảy vài cái rồi đứng
  needleSim.ang += needleSim.vel;
  needleEl.style.transform = `rotate(${needleSim.ang.toFixed(3)}deg)`;
  const still = Math.abs(needleSim.ang) < 0.005 && Math.abs(needleSim.vel) < 0.005 && Math.abs(v) < 0.05;
  needleSim.calm = still ? needleSim.calm + 1 : 0;
  if (tapeDrag || needleSim.calm < 12) needleSim.raf = requestAnimationFrame(needleLoop);
  else { needleSim.raf = null; needleSim.lastX = null; needleEl.style.transform = ''; }
}
function wakeNeedle() {
  if (REDUCED_MOTION || needleSim.raf) return;
  needleSim.lastX = null; needleSim.calm = 0;
  needleSim.raf = requestAnimationFrame(needleLoop);
}
// Kéo thước có "nấc" kiểu cơ khí: thước nối với ngón tay bằng 1 lò xo mềm, còn mỗi vạch 0,1 kg là 1 hõm
// hút thước vào. Kéo chậm thì thước kẹt ở nấc, tới lúc lò xo đủ căng thì bật "tách" sang nấc kế.
const NOTCH = PX_PER_KG / 10;   // 12 px = 0,1 kg
const DRAG_SPRING = 0.24;       // độ cứng lò xo ngón tay → thước
const NOTCH_PULL = 1.25;        // lực hút của hõm (lớn hơn lò xo → có hiện tượng kẹt-rồi-bật)
const DRAG_DAMP = 0.62;         // giảm chấn: bật sang nấc mới gọn, không rung lâu
let tapeTickAt = 0;
function tapeKgAt(x) { return tapeRange.min + (tapeWrap.clientWidth / 2 - x) / PX_PER_KG; }
function showDragKg(x) {
  const kg10 = Math.round(tapeKgAt(x) * 10);
  if (kg10 === tapeDrag.kg10) return;
  tapeDrag.kg10 = kg10;
  tapeTag.innerHTML = `${fmtKg(kg10 / 10)}<small>kg</small>`;
  const now = performance.now(); // rung nhẹ mỗi nấc (máy Android), không rung dồn khi kéo rất nhanh
  if (now - tapeTickAt > 35 && navigator.vibrate) { try { navigator.vibrate(4); } catch (e) { /* ignore */ } }
  tapeTickAt = now;
}
function tapeDragLoop() {
  const d = tapeDrag;
  if (!d) return;
  const half = tapeWrap.clientWidth / 2;
  const phase = (d.p - half) / NOTCH * 2 * Math.PI;   // 0 đúng vạch, ±π giữa 2 vạch
  d.v += (d.target - d.p) * DRAG_SPRING - Math.sin(phase) * NOTCH_PULL;
  d.v *= DRAG_DAMP;
  d.p += d.v;
  const minX = half - (tapeRange.max - tapeRange.min) * PX_PER_KG;
  d.p = Math.max(minX, Math.min(half, d.p));
  tapeSvg.style.transform = `translateX(${d.p}px)`;
  showDragKg(d.p);
  d.raf = requestAnimationFrame(tapeDragLoop);
}
tapeWrap.addEventListener('pointerdown', (ev) => {
  if (!tapeRange || tapeHomeKg === null) return;
  tapeWrap.setPointerCapture(ev.pointerId);
  const x0 = tapeX();
  tapeSvg.style.transition = 'none';
  tapeSvg.style.transform = `translateX(${x0}px)`; // đang chạy hiệu ứng thì "chụp" lại đúng chỗ đó
  tapeDrag = { id: ev.pointerId, startX: ev.clientX, x0, target: x0, p: x0, v: 0, kg10: Math.round(tapeKgAt(x0) * 10), raf: null };
  tapeWrap.classList.add('dragging');
  if (!REDUCED_MOTION) tapeDrag.raf = requestAnimationFrame(tapeDragLoop);
  wakeNeedle();
});
tapeWrap.addEventListener('pointermove', (ev) => {
  if (!tapeDrag || ev.pointerId !== tapeDrag.id) return;
  const half = tapeWrap.clientWidth / 2;
  const minX = half - (tapeRange.max - tapeRange.min) * PX_PER_KG, maxX = half;
  tapeDrag.target = Math.max(minX, Math.min(maxX, tapeDrag.x0 + (ev.clientX - tapeDrag.startX)));
  if (REDUCED_MOTION) { // không hiệu ứng: nhảy thẳng tới vạch gần nhất
    const x = half - Math.round((half - tapeDrag.target) / NOTCH) * NOTCH;
    tapeSvg.style.transform = `translateX(${x}px)`;
    showDragKg(x);
  }
});
function endTapeDrag(ev) {
  if (!tapeDrag || ev.pointerId !== tapeDrag.id) return;
  if (tapeDrag.raf) cancelAnimationFrame(tapeDrag.raf);
  tapeDrag = null;
  tapeWrap.classList.remove('dragging');
  // về chỗ cũ có nảy nhẹ (đường cong vượt quá rồi quay lại)
  tapeSvg.style.transition = 'transform .8s cubic-bezier(.34,1.42,.64,1)';
  tapeSvg.style.transform = `translateX(${tapeWrap.clientWidth/2 - (tapeHomeKg - tapeRange.min) * PX_PER_KG}px)`;
  tapeShownKg = tapeHomeKg;
  tapeTag.innerHTML = tapeTagHome;
  wakeNeedle();
}
tapeWrap.addEventListener('pointerup', endTapeDrag);
tapeWrap.addEventListener('pointercancel', endTapeDrag);

let journalLimit = 60;
const journalRows = document.getElementById('journalRows');
function renderJournal(list) {
  document.getElementById('journalCount').textContent = list.length ? `${list.length} lần cân` : '';
  const out = [];
  for (let i = list.length - 1; i >= Math.max(0, list.length - journalLimit); i--) {
    const e = list[i], d = toDate(e.date);
    const dv = i > 0 ? e.weight - list[i-1].weight : 0;
    out.push(`<button class="entry" data-date="${e.date}">
      <span class="day">${d.getDate()}/${d.getMonth()+1}<small class="${isMonday(e.date) ? 'mon' : ''}">${WD_SHORT[d.getDay()]}${d.getFullYear() !== new Date().getFullYear() ? ' · ' + d.getFullYear() : ''}</small></span>
      <span class="w">${fmtKg(e.weight)} <span>kg</span></span>
      <span class="dl ${i > 0 ? deltaCls(dv) : 'flat'}">${i > 0 ? fmtSigned(dv) : ''}</span>
      ${e.note ? `<span class="note">${e.note.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</span>` : ''}
    </button>`);
  }
  if (list.length > journalLimit) out.push(`<button class="more" id="journalMore">Xem thêm ${Math.min(100, list.length - journalLimit)} lần cân cũ hơn</button>`);
  journalRows.innerHTML = out.join('');
}
journalRows.addEventListener('click', (ev) => {
  if (ev.target.closest('#journalMore')) { journalLimit += 100; renderJournal(sortedEntries()); return; }
  const row = ev.target.closest('.entry');
  if (!row) return;
  const e = entries.find(x => x.date === row.dataset.date);
  if (e) openModal(e);
});

function refreshSideUI() {
  const list = sortedEntries();
  const sig = JSON.stringify([entries.length, list.length && list[list.length-1], goalWeight, goalDeadline, heightCm, list.reduce((a, e) => a + e.weight + (e.note || '').length, 0)]);
  if (sig === sideSig) return;
  sideSig = sig;
  renderJournal(list);
  const goalLine = document.getElementById('goalLine'), bmiLine = document.getElementById('bmiLine'), weekLine = document.getElementById('weekLine');
  const dl = goalDeadline ? toDate(goalDeadline) : null;
  goalLine.innerHTML = goalWeight ? `<i></i>Mục tiêu ${fmtKg(goalWeight)}${dl ? ` · ${dl.getDate()}/${dl.getMonth() + 1}` : ''}` : '';
  refreshPlanNote(list);
  if (!list.length) { tapeTag.innerHTML = '--<small>kg</small>'; bmiLine.textContent = ''; weekLine.textContent = ''; return; }
  const last = list[list.length - 1], lastT = toDate(last.date).getTime();
  tapeTagHome = `${fmtKg(last.weight)}<small>kg</small>`;
  tapeHomeKg = last.weight;
  if (!tapeDrag) tapeTag.innerHTML = tapeTagHome;
  bmiLine.textContent = heightCm ? `BMI ${(last.weight / ((heightCm/100)**2)).toFixed(1).replace('.', ',')}` : '';
  let wk = null;
  for (const e of list) if (toDate(e.date).getTime() <= lastT - 7*86400000) wk = e;
  if (wk) { const dv = last.weight - wk.weight; weekLine.className = deltaCls(dv); weekLine.textContent = `${fmtSigned(dv)} kg so với tuần trước`; }
  else weekLine.textContent = '';

  // băng thước: đủ rộng để chứa mọi số cân + mục tiêu, dư 4 kg mỗi bên
  const ws = list.map(e => e.weight).concat(goalWeight ? [goalWeight] : []);
  const min = Math.floor(Math.min(...ws)) - 4, max = Math.ceil(Math.max(...ws)) + 4;
  const firstTime = tapeShownKg === null;
  if (!tapeRange || tapeRange.min !== min || tapeRange.max !== max) {
    const keep = tapeShownKg;
    buildTape(min, max);
    if (keep !== null) placeTape(keep, false);
  }
  document.getElementById('tapeMarks').innerHTML =
    (goalWeight ? tapeMark(goalWeight, '#1f9e8d') : '') + tapeMark(last.weight, '#e6483f');
  if (firstTime) {
    // lần mở app: băng trượt từ lần cân trước tới hôm nay
    placeTape(list.length > 1 ? list[list.length - 2].weight : last.weight, false);
    requestAnimationFrame(() => requestAnimationFrame(() => placeTape(last.weight, true)));
  } else if (tapeShownKg !== last.weight) {
    placeTape(last.weight, true);
  }
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
  clearRangeTab();
  const { w, h } = plotRect(rect);
  const dt = -dxPx * (view.xMax - view.xMin) / w;
  const dv = dyPx * (view.yMax - view.yMin) / h; // screen-down (+dyPx) = value down
  view.xMin += dt; view.xMax += dt;
  view.yMin += dv; view.yMax += dv;
}

function zoomAt(anchorPxX, anchorPxY, scaleX, scaleY, rect) {
  clearRangeTab();
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

// ---- trôi theo quán tính sau khi kéo (fling) ----
const FLING_TAU = 330;          // ms — càng lớn càng trôi xa
let flingId = null;
function stopFling() { if (flingId) { cancelAnimationFrame(flingId); flingId = null; } }
function panVelocity(samples) { // px/ms từ các điểm chạm trong ~100ms cuối
  const now = performance.now();
  const s2 = samples.filter(p => now - p.t < 100);
  if (s2.length < 2) return [0, 0];
  const a = s2[0], b = s2[s2.length - 1], dt = b.t - a.t;
  return dt > 0 ? [(b.x - a.x) / dt, (b.y - a.y) / dt] : [0, 0];
}
function startFling(vx, vy) {
  stopFling();
  if (REDUCED_MOTION || Math.hypot(vx, vy) < 0.15) return;
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(40, now - last); last = now;
    const rect = chartWrap.getBoundingClientRect();
    panBy(vx * dt, vy * dt, rect);
    const k = Math.exp(-dt / FLING_TAU);
    vx *= k; vy *= k;
    drawChart();
    flingId = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(tick) : null;
  };
  flingId = requestAnimationFrame(tick);
}

const fromTooltip = ev => !!(ev.target && ev.target.closest && ev.target.closest('#tooltip'));
chartWrap.addEventListener('touchstart', (ev) => {
  if (fromTooltip(ev)) return;
  ev.preventDefault();
  stopFling();
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
                     moved: false, startTouchX: x - rect.left, startTouchY: y - rect.top,
                     samples: [{ t: performance.now(), x, y }] };
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
  if (fromTooltip(ev)) return;
  ev.preventDefault();
  if (!touchState) return;
  const rect = chartWrap.getBoundingClientRect();
  if (touchState.mode === 'pan' && ev.touches.length === 1) {
    const x = ev.touches[0].clientX, y = ev.touches[0].clientY;
    const dxPx = x - touchState.lastX, dyPx = y - touchState.lastY;
    if (Math.abs(x - touchState.startX) > 3 || Math.abs(y - touchState.startY) > 3) touchState.moved = true;
    panBy(dxPx, dyPx, rect);
    touchState.lastX = x; touchState.lastY = y;
    touchState.samples.push({ t: performance.now(), x, y });
    if (touchState.samples.length > 8) touchState.samples.shift();
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
  if (touchState && touchState.mode === 'pan' && touchState.moved && ev.touches.length === 0) {
    const [vx, vy] = panVelocity(touchState.samples);
    startFling(vx, vy);
  }
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
  if (fromTooltip(ev)) return;
  stopFling();
  const rect = chartWrap.getBoundingClientRect();
  const isSecondClick = pendingClick && (Date.now() - pendingClick.time < DOUBLE_TAP_MS) &&
    Math.hypot(ev.clientX - pendingClick.x, ev.clientY - pendingClick.y) < DOUBLE_TAP_PX;
  pendingClick = null;
  if (isSecondClick) {
    mouseDown = { mode: 'dragzoom', originX: ev.clientX - rect.left, originY: ev.clientY - rect.top, baseline: { ...view }, moved: false };
  } else {
    mouseDown = { mode: 'pan', x: ev.clientX, y: ev.clientY, lastX: ev.clientX, lastY: ev.clientY, moved: false,
                  samples: [{ t: performance.now(), x: ev.clientX, y: ev.clientY }] };
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
    mouseDown.samples.push({ t: performance.now(), x: ev.clientX, y: ev.clientY });
    if (mouseDown.samples.length > 8) mouseDown.samples.shift();
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
  if (mouseDown && mouseDown.mode === 'pan' && mouseDown.moved) {
    const [vx, vy] = panVelocity(mouseDown.samples);
    startFling(vx, vy);
  }
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
new ResizeObserver(() => resizeCanvas()).observe(chartWrap); // nhật ký thu/mở → biểu đồ giãn theo

// ---- nút khoảng thời gian: Tuần / Tháng / 3 tháng / Năm / Tất cả ----
const RANGE_KEY = 'wt_range_v1';
const rangeTabs = document.getElementById('rangeTabs');
const rangeInd = document.createElement('span');
rangeInd.className = 'tab-ind';
rangeTabs.appendChild(rangeInd);
// thanh gạch dưới tab: trượt sang tab đang chọn (ẩn khi đang zoom/kéo tay)
function moveRangeIndicator() {
  const on = rangeTabs.querySelector('button.on');
  if (!on) { rangeInd.style.opacity = '0'; return; }
  rangeInd.style.opacity = '1';
  rangeInd.style.transform = `translateX(${on.offsetLeft}px)`;
  rangeInd.style.width = on.offsetWidth + 'px';
}
new ResizeObserver(moveRangeIndicator).observe(rangeTabs);

// ---- chuyển khung xem có hiệu ứng: trượt + zoom mượt (zoom theo tỉ lệ để không bị "giật" khi khung chênh lệch lớn) ----
let viewAnimId = null;
function stopViewAnim() { if (viewAnimId) { cancelAnimationFrame(viewAnimId); viewAnimId = null; } }
function animateView(to, dur = 520) {
  stopViewAnim();
  const from = { ...view };
  if ([from.xMin, from.xMax, from.yMin, from.yMax].some(v => v === null || !isFinite(v)) || REDUCED_MOTION) {
    view = { ...to }; saveViewState(); drawChart(); return;
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const axis = (a0, a1, b0, b1, e) => {
    const c = lerp((a0 + a1) / 2, (b0 + b1) / 2, e);
    const span = (a1 - a0) * Math.pow((b1 - b0) / (a1 - a0), e);
    return [c - span / 2, c + span / 2];
  };
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const e = 1 - Math.pow(1 - t, 4); // ease-out quart
    const [xMin, xMax] = axis(from.xMin, from.xMax, to.xMin, to.xMax, e);
    const [yMin, yMax] = axis(from.yMin, from.yMax, to.yMin, to.yMax, e);
    view = { xMin, xMax, yMin, yMax };
    drawChart();
    if (t < 1) viewAnimId = requestAnimationFrame(tick);
    else { viewAnimId = null; view = { ...to }; saveViewState(); drawChart(); }
  };
  viewAnimId = requestAnimationFrame(tick);
}

function clearRangeTab() {
  stopViewAnim();
  rangeTabs.querySelectorAll('button.on').forEach(b => b.classList.remove('on'));
  moveRangeIndicator();
  try { localStorage.removeItem(RANGE_KEY); } catch (e) { /* ignore */ }
}
function setRange(days, animate) {
  stopFling();
  const list = sortedEntries();
  if (!list.length) return;
  const DAY = 86400000;
  const lastT = toDate(list[list.length-1].date).getTime(), firstT = toDate(list[0].date).getTime();
  const xMin = days ? lastT - days * DAY : firstT - 2 * DAY;
  let xMax = lastT + (days ? Math.min(30, Math.max(1, days / 7)) : 14) * DAY;
  const plan = days ? null : computePlan(list); // "Tất cả": thấy trọn đường kế hoạch tới hạn chót
  if (plan) xMax = Math.max(xMax, plan.endT + Math.max(7, (plan.endT - firstT) / DAY * 0.1) * DAY);
  const ws = list.filter(e => { const t = toDate(e.date).getTime(); return t >= xMin && t <= xMax; }).map(e => e.weight);
  if (plan) ws.push(plan.endW);
  let lo = Math.min(...ws), hi = Math.max(...ws);
  const pad = Math.max(0.4, (hi - lo) * 0.15);
  const target = { xMin, xMax, yMin: lo - pad, yMax: hi + pad + 0.2 };
  selected = null;
  rangeTabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.days === days));
  moveRangeIndicator();
  try { localStorage.setItem(RANGE_KEY, String(days)); } catch (e) { /* ignore */ }
  if (animate) animateView(target);
  else { view = target; saveViewState(); drawChart(); }
}
rangeTabs.addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (b) setRange(+b.dataset.days, true);
});

document.getElementById('tooltipEditBtn').addEventListener('click', (ev) => {
  ev.stopPropagation();
  if (!selected) return;
  const e = entries.find(x => x.date === selected.date);
  if (e) openModal(e);
});

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
  navChart.classList.toggle('on', name === 'chart');
  navSettings.classList.toggle('on', name === 'settings');
  document.getElementById('topTitle').textContent = name === 'settings' ? 'Cài đặt' : 'Weight Tracking';
  document.getElementById('todayLabel').style.visibility = name === 'chart' ? 'visible' : 'hidden';
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
  touchSettings();
  drawChart();
});
const deadlineInput = document.getElementById('deadlineInput');
const deadlineClear = document.getElementById('deadlineClear');
deadlineInput.value = goalDeadline || '';
deadlineClear.hidden = !goalDeadline;
deadlineInput.addEventListener('change', () => {
  goalDeadline = /^\d{4}-\d{2}-\d{2}$/.test(deadlineInput.value) ? deadlineInput.value : null;
  saveDeadline(goalDeadline);
  deadlineClear.hidden = !goalDeadline;
  touchSettings();
  drawChart();
});
deadlineClear.addEventListener('click', () => {
  deadlineInput.value = '';
  deadlineInput.dispatchEvent(new Event('change'));
});
// dòng giải thích dưới ô hạn chót: cần giảm/tăng bao nhiêu mỗi tuần
function refreshPlanNote(list) {
  const planNote = document.getElementById('planNote'), clearBtn = document.getElementById('deadlineClear');
  if (!planNote) return;
  clearBtn.hidden = !goalDeadline;
  if (!goalDeadline) { planNote.textContent = 'Chọn ngày để hiện đường kế hoạch màu đỏ trên biểu đồ.'; planNote.className = 'sub'; return; }
  if (!goalWeight) { planNote.textContent = 'Nhập mục tiêu cân nặng ở trên để tính tốc độ.'; planNote.className = 'sub'; return; }
  if (!list.length) { planNote.textContent = 'Chưa có lần cân nào để tính.'; planNote.className = 'sub'; return; }
  const plan = computePlan(list);
  if (!plan) { planNote.textContent = 'Ngày này đã qua, hãy chọn ngày mới.'; planNote.className = 'sub warn'; return; }
  const diff = plan.endW - plan.startW, weeks = plan.days / 7;
  const verb = diff < 0 ? 'giảm' : 'tăng';
  planNote.className = 'sub plan';
  planNote.textContent = Math.abs(diff) < 0.05
    ? 'Bạn đang ở đúng mục tiêu, chỉ cần giữ cân.'
    : `Cần ${verb} ${fmtKg(Math.abs(diff))} kg trong ${weeks >= 2 ? Math.round(weeks) + ' tuần' : Math.round(plan.days) + ' ngày'} → ${fmtPace(plan.perWeek)}`
      + (Math.abs(plan.perWeek) > 1 ? ' (khá gắt, nên ≤ 1 kg/tuần)' : '')
      + `\nMỗi ngày cần ${verb} ${fmtDaily(Math.abs(plan.perWeek) / 7).replace(/^[+−]/, '').replace('/ngày', '')}`
      + ` (${(Math.abs(plan.perWeek) / 7).toFixed(3).replace('.', ',')} kg)`;
}
heightInput.addEventListener('change', () => {
  heightCm = heightInput.value === '' ? null : parseFloat(heightInput.value);
  saveHeight(heightCm);
  touchSettings();
  drawChart();
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Xoá toàn bộ dữ liệu cân nặng đã nhập? Không thể hoàn tác.')) {
    markDeleted(entries.map(e => e.date)); // đã đăng nhập Firebase thì máy khác cũng xoá theo
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
      const { Filesystem } = window.Capacitor.Plugins;
      // Lưu ý: Directory là hằng số của gói @capacitor/filesystem khi import qua bundler,
      // không tồn tại dưới Capacitor.Plugins ở JS thuần — dùng thẳng chuỗi 'CACHE'.
      const res = await Filesystem.writeFile({ path: filename, data: csv, directory: 'CACHE', encoding: 'utf8' });
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
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result);
    let parsed = parseCsv(text, 'kg');
    if (parsed.length === 0) { alert('Không đọc được dữ liệu hợp lệ từ file này.'); return; }
    // Tự nhận đơn vị: file do app này xuất ra luôn là kg. Chỉ khi số liệu lớn bất thường
    // (trung vị > 110, vd file cũ từ app khác tính theo lbs) mới hỏi có đổi lbs → kg không.
    const sortedW = parsed.map(e => e.weight).sort((a, b) => a - b);
    const median = sortedW[Math.floor(sortedW.length / 2)];
    if (median > 110 && confirm(`Số liệu trong file có vẻ đang tính theo lbs (vd: ${median}). Đổi sang kg khi nhập?`)) {
      parsed = parseCsv(text, 'lbs');
    }
    const byDate = new Map(entries.map(e => [e.date, e]));
    const now = Date.now();
    parsed.forEach(e => byDate.set(e.date, { ...e, updatedAt: now }));
    unmarkDeleted(parsed.map(e => e.date));
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
const WHEEL_FRICTION_TAU = 260; // ms — higher = the fling coasts longer before settling (was 90 — too short to loop)
const WHEEL_STOP_VELOCITY = 0.015; // index-units/ms below which momentum ends and the snap begins
const WHEEL_SNAP_MS = 240; // thời gian tối thiểu của đoạn trượt vào số
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

  let position = 0;   // vị trí liên tục (0 == min)
  let rafId = null;
  let glide = null;   // {from, to, start, dur} — trượt chậm dần tới đúng 1 số
  let lastEmitted = null;

  function valueAt(idx) {
    if (loop) return ((idx % range) + range) % range + min;
    const v = min + idx;
    return (v < min || v > max) ? null : v;
  }

  // vẽ như 1 cái trống xoay: càng xa tâm càng nghiêng, nhỏ và mờ dần — số ở giữa to và sáng, đổi liên tục không giật
  const DIM = [74, 90, 107], LIT = [233, 237, 241];
  function render() {
    const centerIdx = Math.round(position);
    const frac = position - centerIdx;
    slots.forEach((slotEl, si) => {
      const rel = si - WHEEL_BUFFER;
      const v = valueAt(centerIdx + rel);
      const off = rel - frac;              // khoảng cách tới tâm, tính theo số ô
      const d = Math.abs(off);
      if (v === null || d > 3.6) { slotEl.style.opacity = '0'; return; }
      const near = Math.max(0, 1 - d);     // 1 ở tâm → 0 khi lệch 1 ô
      const scale = d < 1 ? 0.62 + 0.38 * near : Math.max(0.4, 0.62 - (d - 1) * 0.07);
      const c = DIM.map((a, k) => Math.round(a + (LIT[k] - a) * near));
      slotEl.textContent = String(v);
      slotEl.style.transform = `translateY(${(off * ITEM_H).toFixed(2)}px) rotateX(${(-off * 17).toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      slotEl.style.opacity = String(Math.max(0, 1 - d * 0.27));
      slotEl.style.color = `rgb(${c.join(',')})`;
      slotEl.style.fontWeight = near > 0.5 ? '600' : '500';
    });
    const centerValue = valueAt(centerIdx);
    if (centerValue !== null && centerValue !== lastEmitted) {
      lastEmitted = centerValue;
      onChange(centerValue);
    }
  }

  function clampBounds(p) { return loop ? p : Math.max(0, Math.min(range - 1, p)); }
  function stopAnimation() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } glide = null; }

  function step(now) {
    const t = Math.min(1, (now - glide.start) / glide.dur);
    const e = 1 - Math.pow(1 - t, 3); // ease-out: chạy nhanh rồi chậm dần, dừng êm đúng số
    position = glide.from + (glide.to - glide.from) * e;
    render();
    if (t < 1) rafId = requestAnimationFrame(step);
    else { position = glide.to; glide = null; rafId = null; render(); }
  }
  // trượt tới số đích; v = tốc độ lúc buông tay (ô/ms) để đoạn trượt nối liền, không bị khựng
  function glideTo(target, v) {
    const dist = Math.abs(target - position);
    let dur = Math.abs(v) > 1e-4 ? (3 * dist) / Math.abs(v) : 0; // ease-out cubic bắt đầu với tốc độ = 3·dist/dur
    dur = Math.max(WHEEL_SNAP_MS, Math.min(1500, dur));
    if (REDUCED_MOTION) dur = 1;
    glide = { from: position, to: target, start: performance.now(), dur };
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
      if (b.t - a.t > 0) v = (b.p - a.p) / (b.t - a.t);
    }
    v = Math.max(-WHEEL_MAX_VELOCITY, Math.min(WHEEL_MAX_VELOCITY, v * WHEEL_VELOCITY_BOOST));
    drag = null;
    // đoán trước chỗ bánh xe sẽ dừng theo quán tính, làm tròn về số gần nhất rồi trượt thẳng tới đó
    const target = clampBounds(Math.round(position + v * WHEEL_FRICTION_TAU));
    glideTo(target, target === Math.round(position + v * WHEEL_FRICTION_TAU) ? v : v * 0.5);
  }

  el.addEventListener('touchstart', (ev) => { ev.preventDefault(); pointerDown(ev.touches[0].clientY); }, { passive: false });
  el.addEventListener('touchmove', (ev) => { ev.preventDefault(); pointerMove(ev.touches[0].clientY); }, { passive: false });
  el.addEventListener('touchend', (ev) => { ev.preventDefault(); pointerUp(); }, { passive: false });
  el.addEventListener('mousedown', (ev) => { pointerDown(ev.clientY); const mm = (e2) => pointerMove(e2.clientY); const mu = () => { pointerUp(); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); }; window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu); });

  el.scrollToValue = (v) => {
    stopAnimation();
    position = clampBounds(v - min);
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
  draft = existing ? { ...existing, origDate: existing.date } : { date: today, weight: null, note: '' };
  document.getElementById('modalTitle').textContent = existing ? 'Sửa lần cân' : 'Cân hôm nay';
  // for a new entry, start the wheel at the most recently entered weight instead of a fixed default
  // — avoids re-scrolling from scratch every time; editing an existing entry still shows its own value
  const startWeight = draft.weight ?? lastEnteredWeight();
  const [w, d] = String(startWeight.toFixed(1)).split('.');
  draft.intPart = parseInt(w, 10);
  draft.decPart = parseInt(d, 10);
  dateBtnLabel.textContent = draft.date === today ? 'Hôm nay — ' + fmtLong(draft.date) : fmtLong(draft.date);
  noteBtnLabel.textContent = draft.note ? draft.note : 'Thêm ghi chú';
  // nút ✓ và ↩ tách ra 2 bên từ chỗ nút + ở giữa
  entryModal.classList.remove('leaving', 'entering');
  void entryModal.offsetWidth; // chạy lại hiệu ứng mỗi lần mở
  entryModal.classList.add('active', 'entering');
  requestAnimationFrame(() => {
    intCol.scrollToValue(draft.intPart);
    decCol.scrollToValue(draft.decPart);
  });
}
// đóng: 2 nút gộp lại vào giữa rồi bảng mờ đi
let modalCloseTimer = null;
function closeModal() {
  if (!entryModal.classList.contains('active') || entryModal.classList.contains('leaving')) return;
  if (REDUCED_MOTION) { entryModal.classList.remove('active', 'entering'); return; }
  entryModal.classList.remove('entering');
  entryModal.classList.add('leaving');
  clearTimeout(modalCloseTimer);
  modalCloseTimer = setTimeout(() => entryModal.classList.remove('active', 'leaving'), 330);
}

navAdd.addEventListener('click', () => openModal(null));
document.getElementById('cancelEntryBtn').addEventListener('click', closeModal);
document.getElementById('saveEntryBtn').addEventListener('click', () => {
  const weight = (draft.intPart||0) + (draft.decPart||0)/10;
  if (!weight || weight <= 0) { alert('Vui lòng chọn cân nặng.'); return; }
  // sửa một lần cân mà đổi sang ngày khác → bỏ bản ghi ở ngày cũ
  if (draft.origDate && draft.origDate !== draft.date) {
    entries = entries.filter(e => e.date !== draft.origDate);
    markDeleted([draft.origDate]);
  }
  upsertEntry({ id: draft.date, date: draft.date, weight, note: draft.note || '' });
  // Giữ nguyên zoom/pan hiện tại thay vì reset về toàn cảnh mỗi lần thêm số đo mới
  selected = entries.find(e => e.date === draft.date) || null;
  const fromPlus = !draft.origDate;
  closeModal();
  showScreen('chart');
  drawChart();
  // nhập mới bằng nút + → báo tăng/giảm so với lần cân trước (đợi bảng nhập đóng xong)
  if (fromPlus) setTimeout(() => showResult(draft.date, weight), REDUCED_MOTION ? 0 : 380);
});

// ---- bảng kết quả: trượt lên có nhún, chạm bất kỳ đâu để trượt xuống ----
const resultSheet = document.getElementById('resultSheet');
const resultCatcher = document.getElementById('resultCatcher');
const RESULT_ICONS = {
  good: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M5 13l7 7 7-7"/></svg>',
  bad:  '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V4M5 11l7-7 7 7"/></svg>',
  same: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M5 9h14M5 15h14"/></svg>',
};
let resultHideTimer = null;
function showResult(date, weight) {
  const prev = sortedEntries().filter(e => e.date < date).pop();
  if (!prev) return; // lần cân đầu tiên — chưa có gì để so
  const diff = Math.round((weight - prev.weight) * 10) / 10;
  const kind = diff < 0 ? 'good' : diff > 0 ? 'bad' : 'same';
  const pd = toDate(prev.date);
  document.getElementById('resultIcon').innerHTML = RESULT_ICONS[kind];
  document.getElementById('resultTitle').innerHTML =
    kind === 'good' ? `Chúc mừng! Bạn đã giảm <b>${fmtKg(-diff)} kg</b>`
    : kind === 'bad' ? `Xin chia buồn, bạn đã tăng <b>${fmtKg(diff)} kg</b>`
    : 'Cân nặng của bạn không thay đổi';
  document.getElementById('resultSub').textContent =
    `So với lần cân trước (${pd.getDate()}/${pd.getMonth()+1}: ${fmtKg(prev.weight)} kg)`;
  clearTimeout(resultHideTimer);
  resultSheet.className = '';
  void resultSheet.offsetWidth; // chạy lại hiệu ứng nếu bảng đang hiện
  resultSheet.className = `${kind} show`;
  resultCatcher.classList.add('on');
}
function hideResult() {
  if (!resultSheet.classList.contains('show')) return;
  resultCatcher.classList.remove('on');
  resultSheet.classList.replace('show', 'hide');
  resultHideTimer = setTimeout(() => { resultSheet.className = ''; }, 500);
}
resultCatcher.addEventListener('pointerdown', (ev) => { ev.preventDefault(); hideResult(); });

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
  noteBtnLabel.textContent = draft.note ? draft.note : 'Thêm ghi chú';
  noteOverlay.classList.remove('active');
});

// ===================================================================
// Tự cập nhật: mỗi lần mở app, hỏi GitHub xem có bản build mới hơn không.
// Bản APK mới được GitHub Actions đăng lên Releases của repo public UPDATE_REPO (chính repo app) với tag
// "build-<số build>"; app so số build đó với versionCode đang cài.
// ===================================================================
const UPDATE_REPO = 'satthupc00/Weight_Tracking';
const UPDATE_SKIP_KEY = 'wt_update_skip_v1';
const updateOverlay = document.getElementById('updateOverlay');
const updateTitle = document.getElementById('updateTitle');
const updateText = document.getElementById('updateText');
const updateActions = document.getElementById('updateActions');
const updateNowBtn = document.getElementById('updateNowBtn');
const appVersionLabel = document.getElementById('appVersionLabel');
let pendingUpdate = null;

function appUpdater() {
  return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AppUpdater;
}

async function fetchLatestRelease() {
  const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, { cache: 'no-store' });
  if (!res.ok) throw new Error('GitHub trả về mã ' + res.status);
  const rel = await res.json();
  const m = /^build-(\d+)$/.exec(rel.tag_name || '');
  const apk = (rel.assets || []).find(a => /\.apk$/i.test(a.name));
  if (!m || !apk) return null;
  return { build: parseInt(m[1], 10), name: rel.name || rel.tag_name, notes: (rel.body || '').trim(), url: apk.browser_download_url };
}

function showUpdateSheet(title, text, canUpdate) {
  updateTitle.textContent = title;
  updateText.textContent = text;
  updateActions.style.display = '';
  updateNowBtn.style.display = canUpdate ? '' : 'none';
  document.getElementById('updateLaterBtn').textContent = canUpdate ? 'Để sau' : 'Đóng';
  updateOverlay.classList.add('active');
}

async function checkForUpdate(manual) {
  const updater = appUpdater();
  if (!updater) {
    if (manual) alert('Chỉ kiểm tra cập nhật được trong app Android đã cài.');
    return;
  }
  try {
    const cur = await updater.getVersion();
    appVersionLabel.textContent = 'v' + cur.versionName;
    const latest = await fetchLatestRelease();
    if (!latest || latest.build <= cur.versionCode) {
      if (manual) showUpdateSheet('Đã là bản mới nhất', `Bạn đang dùng bản ${cur.versionName}.`, false);
      return;
    }
    // Đã bấm "Để sau" cho đúng bản này thì không tự hỏi lại (vẫn kiểm tra tay được).
    if (!manual && localStorage.getItem(UPDATE_SKIP_KEY) === String(latest.build)) return;
    pendingUpdate = latest;
    showUpdateSheet('Có bản cập nhật mới',
      `Bản mới: ${latest.name}\nĐang dùng: ${cur.versionName}` + (latest.notes ? `\n\n${latest.notes}` : '') +
      '\n\nDữ liệu cân nặng vẫn được giữ nguyên.', true);
  } catch (e) {
    if (manual) alert('Không kiểm tra được bản mới (kiểm tra kết nối mạng).\n' + (e && e.message ? e.message : e));
  }
}

document.getElementById('checkUpdateBtn').addEventListener('click', () => checkForUpdate(true));
document.getElementById('updateLaterBtn').addEventListener('click', () => {
  if (pendingUpdate) localStorage.setItem(UPDATE_SKIP_KEY, String(pendingUpdate.build));
  pendingUpdate = null;
  updateOverlay.classList.remove('active');
});
updateNowBtn.addEventListener('click', async () => {
  const updater = appUpdater();
  if (!updater || !pendingUpdate) return;
  updateTitle.textContent = 'Đang tải bản cập nhật...';
  updateText.textContent = '0%';
  updateActions.style.display = 'none';
  const listener = await updater.addListener('downloadProgress', p => { updateText.textContent = p.percent + '%'; });
  try {
    await updater.downloadAndInstall({ url: pendingUpdate.url });
    updateOverlay.classList.remove('active');
  } catch (e) {
    showUpdateSheet('Cập nhật lỗi', (e && e.message ? e.message : String(e)) + '\n\nThử lại sau nhé.', true);
  } finally {
    listener.remove();
  }
});

// ===================================================================
// Nhật ký thu/mở — nhớ riêng cho màn hình ngoài (mặc định thu) và màn hình trong (mặc định mở)
// ===================================================================
const journalSide = document.getElementById('journalSide');
const journalHead = document.getElementById('journalHead');
const wideMQ = window.matchMedia('(min-width:640px)');
const journalKey = () => wideMQ.matches ? 'wt_journal_open_wide' : 'wt_journal_open_narrow';
function applyJournalState() {
  let open = wideMQ.matches;
  try { const v = localStorage.getItem(journalKey()); if (v !== null) open = v === '1'; } catch (e) { /* ignore */ }
  journalSide.classList.toggle('closed', !open);
  journalHead.setAttribute('aria-expanded', String(open));
}
journalHead.addEventListener('click', () => {
  const open = journalSide.classList.toggle('closed') === false;
  journalHead.setAttribute('aria-expanded', String(open));
  try { localStorage.setItem(journalKey(), open ? '1' : '0'); } catch (e) { /* ignore */ }
});
wideMQ.addEventListener('change', applyJournalState);
applyJournalState();

(function setTodayLabel() {
  const d = new Date();
  document.getElementById('todayLabel').textContent = `${WD_LONG[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth()+1}`;
})();

// ===================================================================
// init
// ===================================================================
resizeCanvas();
(function restoreRange() {
  let saved = null;
  try { saved = localStorage.getItem(RANGE_KEY); } catch (e) { /* ignore */ }
  if (saved !== null) setRange(+saved);          // lần trước chọn 1 nút khoảng thời gian → giữ nút đó
  else if (!loadViewState()) setRange(31);        // lần đầu mở app → 1 tháng gần nhất
  else drawChart();                               // đang ở zoom/pan tự chỉnh → giữ nguyên
})();
// font đóng gói tải xong → vẽ lại biểu đồ cho đúng font số
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => drawChart());
checkForUpdate(false);
