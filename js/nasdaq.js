/* 纳指页：实时拉取东方财富日线（纳斯达克100，2025-01-01 起，只增不减），缓存秒开，断网兜底
   交互：双指捏合调窗口大小（低灵敏度）、底部隐形手势区左右滑=平移
   下图：回撤曲线（距区间新高的百分比），替代无参考价值的成交额 */
import { haptic, showToast } from './utils.js';

const CACHE_KEY = 'nasdaq-kline-v1';
const API_BASE = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=100.NDX100'
  + '&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&beg=20250101';

const UP = '#e13e3e';
const DOWN = '#0a8f4c';
const MIN_SPAN = 5;        // 窗口最小天数
const DEFAULT_SPAN = 244;  // 默认近一年
const PINCH_EASE = 0.55;   // <1 = 双指缩放灵敏度调低
const GRID_LEFT = 48, GRID_RIGHT = 16;

let chart = null;
let klines = null;         // ['date,open,close,high,low,volume,x', ...]
let stale = false;
let win = null;            // { vs, ve } 可见窗口下标
let lastN = 0;
let touch = null;          // 手势状态
let thumbDragging = false;

/* ===== 工具 ===== */
function stdev(arr) {
  if (arr.length < 2) return null;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length - 1);
  return Math.sqrt(v);
}
function fmt(n) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function parse(kl) {
  const dates = [], closes = [], highs = [], lows = [], dd = [];
  let peak = -Infinity;
  for (const row of kl) {
    const p = row.split(',');
    const close = +p[2];
    dates.push(p[0]); closes.push(close);
    highs.push(+p[3]); lows.push(+p[4]);
    if (close > peak) peak = close;
    dd.push((close / peak - 1) * 100);   // 距区间新高的百分比（全量数据口径）
  }
  const pcts = [null];
  for (let i = 1; i < closes.length; i++) pcts.push((closes[i] / closes[i - 1] - 1) * 100);
  return { dates, closes, highs, lows, dd, pcts, n: dates.length };
}

/* ===== 数据获取与缓存 ===== */
function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function saveCache(kl) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), klines: kl })); }
  catch (e) { /* 存储失败不影响使用 */ }
}
function tomorrowYmd() {
  const d = new Date(Date.now() + 86400000);
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}
async function fetchKlines() {
  const res = await fetch(`${API_BASE}&end=${tomorrowYmd()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  const kl = json && json.data && json.data.klines;
  if (!kl || kl.length < 10) throw new Error('bad data');
  return kl;
}

function resetWindow(n) {
  win = { vs: Math.max(0, n - DEFAULT_SPAN), ve: n - 1 };
}

function applyData(kl, isStale) {
  klines = kl;
  stale = isStale;
  const n = parse(kl).n;
  // 数据长度变化或窗口越界时重置为默认近一年
  if (!win || lastN !== n || win.ve >= n || win.vs >= n) resetWindow(n);
  lastN = n;
  updateStats();
  updateThumb();
  syncPresetHighlight();
  // 页面已激活就立即渲染；未激活等 showNasdaq() 触发
  if (document.getElementById('page-nasdaq').classList.contains('active')) renderChart();
}

function markStaleIfAny() {
  if (klines) {
    stale = true;
    updateStats();
  }
}

function refreshData() {
  if (!navigator.onLine) { markStaleIfAny(); return; }
  fetchKlines().then(kl => {
    saveCache(kl);
    applyData(kl, false);
  }).catch(() => markStaleIfAny());
}

/* ===== 图表布局（随容器高度自适应，撑满画布）
   成交额图压小（约15%），主图吸收剩余空间（参考桌面版主图:成交额≈10:3的压缩关系） ===== */
function layoutFor(h) {
  const mainTop = 10;
  const volH = Math.max(40, Math.round(h * 0.15));
  const volTop = h - 10 - volH;
  const datesTop = volTop - 22;
  const mainH = Math.max(120, datesTop - mainTop - 7);
  return { mainTop, mainH, datesTop, volTop, volH };
}

function ensureChart() {
  if (chart) return;
  chart = echarts.init(document.getElementById('nasdaq-chart'));
  bindGestures();
  window.addEventListener('resize', () => { if (chart) chart.resize(); });
}

function option(D, L) {
  return {
    animation: false,
    tooltip: {
      show: tooltipOn,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#c9cdd4', type: 'dashed' } },
      backgroundColor: 'rgba(255,255,255,.5)',
      borderColor: 'rgba(229,230,235,.4)',
      textStyle: { color: '#1f2329', fontSize: 12 },
      extraCssText: 'backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,.05);',
      confine: true,
      position: (point, params, dom, rect, size) => {
        const x = Math.min(Math.max(point[0] - size.contentSize[0] / 2, 6), size.viewSize[0] - size.contentSize[0] - 6);
        const y = point[1] - size.contentSize[1] - 16;
        return [x, y >= 6 ? y : point[1] + 16];
      },
      formatter: params => {
        const i = params[0].dataIndex;
        const pct = D.pcts[i];
        const dd = D.dd[i];
        const cls = pct > 0 ? UP : pct < 0 ? DOWN : '#4e5969';
        return `<b>${D.dates[i]}</b><br/>`
          + `涨跌幅：<b style="color:${cls}">${pct === null ? '—' : (pct > 0 ? '+' : '') + pct.toFixed(2) + '%'}</b><br/>`
          + `距新高：<b style="color:${DOWN}">${dd.toFixed(2) + '%'}</b>`;
      }
    },
    axisPointer: { link: [{ xAxisIndex: 'all' }], label: { show: false } },
    grid: [
      { left: GRID_LEFT, right: GRID_RIGHT, top: L.mainTop, height: L.mainH },
      { left: GRID_LEFT, right: GRID_RIGHT, top: L.volTop, height: L.volH }
    ],
    xAxis: [
      { type: 'category', gridIndex: 0, data: D.dates, boundaryGap: false,
        axisLine: { lineStyle: { color: '#e2e8f0' } }, axisLabel: { show: false }, axisTick: { show: false } },
      { type: 'category', gridIndex: 1, data: D.dates, boundaryGap: false,
        axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false }, axisLabel: { show: false } }
    ],
    yAxis: [
      { gridIndex: 0, scale: true, splitLine: { lineStyle: { color: '#f0f1f3' } },
        axisLabel: { color: '#94a3b8', fontSize: 10 } },
      { gridIndex: 1, min: -10, max: 0, splitLine: { show: false }, axisLabel: { show: false } }
    ],
    series: [
      {
        name: '收盘价', type: 'line', xAxisIndex: 0, yAxisIndex: 0,
        data: D.closes, showSymbol: false, lineStyle: { width: 1.5, color: UP },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(225,62,62,.16)' },
            { offset: 1, color: 'rgba(225,62,62,.02)' }])
        }
      },
      {
        name: '回撤', type: 'line', xAxisIndex: 1, yAxisIndex: 1,
        data: D.dd, showSymbol: false, lineStyle: { width: 1.2, color: DOWN },
        areaStyle: {
          origin: 'start',
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(10,143,76,.02)' },
            { offset: 1, color: 'rgba(10,143,76,.32)' }])
        }
      }
    ]
  };
}

function renderChart() {
  if (!klines) return;
  const D = parse(klines);
  ensureChart();
  const L = layoutFor(chart.getHeight());
  const rangeEl = document.querySelector('.nasdaq-range');
  if (rangeEl) rangeEl.style.top = L.datesTop + 'px';
  chart.setOption(option(D, L));
  applyWindow();
  updateStats();
  updateThumb();
}

/* ===== 窗口状态 ===== */
function niceBounds(lo, hi) {
  if (!isFinite(lo) || !isFinite(hi) || hi <= lo) { hi = lo + 1; }
  const pad = (hi - lo) * 0.06 || hi * 0.01;
  lo -= pad; hi += pad;
  const raw = (hi - lo) / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step };
}

function setWindow(vs, ve) {
  const n = lastN;
  const span = clamp(ve - vs, MIN_SPAN, n - 1);
  vs = clamp(vs, 0, n - 1 - span);
  win = { vs, ve: vs + span };
  applyWindow();
  updateStats();
  updateThumb();
  syncPresetHighlight();
}

function applyWindow() {
  if (!chart || !win) return;
  const D = parse(klines);
  // y 轴按可见区间重算：价格取区间内最低/最高，回撤取区间内最深值
  let lo = Infinity, hi = -Infinity, ddMin = 0;
  for (let i = win.vs; i <= win.ve; i++) {
    if (D.lows[i] < lo) lo = D.lows[i];
    if (D.highs[i] > hi) hi = D.highs[i];
    if (D.dd[i] < ddMin) ddMin = D.dd[i];
  }
  const b = niceBounds(lo, hi);
  chart.setOption({
    xAxis: [{ min: win.vs, max: win.ve }, { min: win.vs, max: win.ve }],
    yAxis: [
      { min: b.min, max: b.max },
      { min: Math.min(ddMin * 1.2, -1), max: 0 }
    ]
  });
}

/* ===== 统计卡片 + 首尾日期 ===== */
function updateStats() {
  if (!klines || !win) return;
  const D = parse(klines);
  const { vs, ve } = win;

  document.getElementById('nasdaq-rs').textContent = D.dates[vs];
  document.getElementById('nasdaq-re').textContent = D.dates[ve];

  const base = vs > 0 ? D.closes[vs - 1] : D.closes[vs];
  const ret = (D.closes[ve] / base - 1) * 100;
  const retEl = document.getElementById('nasdaq-return');
  retEl.textContent = (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%';
  retEl.style.color = ret >= 0 ? '#FCA5A5' : '#6EE7B7';

  document.getElementById('nasdaq-sub').textContent =
    `收盘 ${fmt(D.closes[ve])} · 截至 ${D.dates[ve]}${stale ? '（离线缓存）' : ''}`;

  let peak = D.closes[vs], dd = 0;
  const pctsWin = [];
  for (let i = vs; i <= ve; i++) {
    if (D.closes[i] > peak) peak = D.closes[i];
    const d = (D.closes[i] / peak - 1) * 100;
    if (d < dd) dd = d;
    if (i > vs && D.pcts[i] !== null) pctsWin.push(D.pcts[i]);
  }
  document.getElementById('nasdaq-dd').textContent = dd.toFixed(2) + '%';

  const sd = stdev(pctsWin);
  document.getElementById('nasdaq-vol').textContent = sd === null ? '—' : (sd * Math.sqrt(252)).toFixed(2) + '%';
}

/* ===== 快捷区间 ===== */
let activePreset = 244; // 当前选中的快捷按钮（-1 = 无，手动捏合/拖动后清空）

function syncPresetHighlight() {
  document.querySelectorAll('.np-btn').forEach(b => {
    b.classList.toggle('on', +b.dataset.n === activePreset);
  });
}

function setPreset(n) {
  if (!klines) return;
  activePreset = n;
  const end = lastN - 1;
  const start = n > 0 ? Math.max(0, lastN - n) : 0;
  setWindow(start, end);
}

/* ===== 底部滑动条（拖动 = 平移区间） ===== */
function updateThumb() {
  if (!klines || !win) return;
  const n = lastN;
  const thumb = document.getElementById('nasdaq-thumb');
  if (!thumb) return;
  const leftPct = win.vs / (n - 1) * 100;
  const widthPct = (win.ve - win.vs) / (n - 1) * 100;
  thumb.style.left = leftPct + '%';
  thumb.style.width = 'calc(' + widthPct + '% - 8px)';
}

/* ===== 底部平移手势区（滑动期间及之后悬浮框保持隐藏，触摸图表才恢复） ===== */
let tooltipOn = true;
function setTooltipEnabled(on) {
  tooltipOn = on;
  if (!chart) return;
  if (on) {
    chart.setOption({ tooltip: { show: true } });
  } else {
    chart.dispatchAction({ type: 'hideTip' });
    chart.setOption({ tooltip: { show: false } });
  }
}

function bindSlider() {
  const slider = document.getElementById('nasdaq-slider');
  if (!slider) return;
  const dragTo = e => {
    if (!klines || !win) return;
    activePreset = -1;
    const rect = slider.getBoundingClientRect();
    const frac = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const span = win.ve - win.vs;
    const center = frac * (lastN - 1);
    const vs = clamp(Math.round(center - span / 2), 0, lastN - 1 - span);
    setWindow(vs, vs + span);
  };
  slider.addEventListener('pointerdown', e => {
    e.preventDefault();
    thumbDragging = true;
    try { slider.setPointerCapture(e.pointerId); } catch (err) {}
    haptic();
    setTooltipEnabled(false);   // 按下即隐藏，松手不恢复
    dragTo(e);
  });
  slider.addEventListener('pointermove', e => { if (thumbDragging) dragTo(e); });
  const end = () => { thumbDragging = false; };
  slider.addEventListener('pointerup', end);
  slider.addEventListener('pointercancel', end);
}

/* ===== 图表手势：仅双指捏合调窗口大小（低灵敏度）；平移只通过底部滑动条 ===== */
function bindGestures() {
  const el = document.getElementById('nasdaq-chart');
  const dist2 = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const pinchBaseline = t => ({ d0: dist2(t), span0: win.ve - win.vs, center0: (win.vs + win.ve) / 2 });

  el.addEventListener('touchstart', e => {
    if (!klines || !win) return;
    if (!tooltipOn) setTooltipEnabled(true);   // 触摸图表时恢复悬浮框
    // 只在双指落下时进入捏合模式；单指不响应（平移归底部滑动条）
    touch = e.touches.length >= 2 && klines && win ? pinchBaseline(e.touches) : null;
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (!touch || !klines || !win) return;
    if (e.touches.length < 2) { touch = null; return; }
    e.preventDefault();
    const d = dist2(e.touches);
    if (d < 10) return;
    activePreset = -1;
    const span = clamp(Math.round(touch.span0 * Math.pow(touch.d0 / d, PINCH_EASE)), MIN_SPAN, lastN - 1);
    const vs = clamp(Math.round(touch.center0 - span / 2), 0, lastN - 1 - span);
    setWindow(vs, vs + span);
  }, { passive: false });

  el.addEventListener('touchend', e => {
    touch = e.touches.length >= 2 && win ? pinchBaseline(e.touches) : null;
  });
  el.addEventListener('touchcancel', () => { touch = null; });
}

/* ===== 对外接口 ===== */
export function initNasdaq() {
  document.querySelectorAll('.np-btn').forEach(b => {
    b.addEventListener('click', () => { haptic(); setPreset(+b.dataset.n); });
  });
  bindSlider();

  // 秒开：先渲染缓存，再后台拉新
  const cached = loadCache();
  if (cached && cached.klines && cached.klines.length > 10) {
    applyData(cached.klines, true);
  }
  refreshData();
}

export function showNasdaq() {
  if (!klines) return;
  requestAnimationFrame(() => {
    if (chart) chart.resize();
    renderChart();
  });
}
