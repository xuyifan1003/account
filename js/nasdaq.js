/* 纳指页：实时拉取东方财富日线（2025-01-01 起，只增不减），缓存秒开，断网兜底
   交互：双指捏合调窗口大小（低灵敏度）、单指左右拖平移、底部滑动条平移 */
import { haptic, showToast } from './utils.js';

const CACHE_KEY = 'nasdaq-kline-v1';
const API_BASE = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=100.NDX'
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
function fmtVol(v) { return (v / 1e9).toFixed(2); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function parse(kl) {
  const dates = [], opens = [], closes = [], highs = [], lows = [], vols = [];
  for (const row of kl) {
    const p = row.split(',');
    dates.push(p[0]); opens.push(+p[1]); closes.push(+p[2]);
    highs.push(+p[3]); lows.push(+p[4]); vols.push(+p[5]);
  }
  const pcts = [null];
  for (let i = 1; i < closes.length; i++) pcts.push((closes[i] / closes[i - 1] - 1) * 100);
  return { dates, closes, highs, lows, vols, pcts, n: dates.length };
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

/* ===== 图表布局（随容器高度自适应） ===== */
function layoutFor(h) {
  const mainTop = 10;
  const mainH = Math.round(h * 0.42);
  const datesTop = mainTop + mainH + 8;
  const volTop = datesTop + 24;
  const volH = Math.max(36, Math.round(h * 0.15));
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
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#c9cdd4', type: 'dashed' } },
      backgroundColor: 'rgba(255,255,255,.78)',
      borderColor: 'rgba(229,230,235,.6)',
      textStyle: { color: '#1f2329', fontSize: 12 },
      extraCssText: 'backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,.06);',
      confine: true,
      position: (point, params, dom, rect, size) => {
        const x = Math.min(Math.max(point[0] - size.contentSize[0] / 2, 6), size.viewSize[0] - size.contentSize[0] - 6);
        const y = point[1] - size.contentSize[1] - 16;
        return [x, y >= 6 ? y : point[1] + 16];
      },
      formatter: params => {
        const i = params[0].dataIndex;
        const pct = D.pcts[i];
        const cls = pct > 0 ? UP : pct < 0 ? DOWN : '#4e5969';
        return `<b>${D.dates[i]}</b><br/>`
          + `涨跌幅：<b style="color:${cls}">${pct === null ? '—' : (pct > 0 ? '+' : '') + pct.toFixed(2) + '%'}</b><br/>`
          + `成交额：${fmtVol(D.vols[i])} 十亿美元`;
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
      { gridIndex: 1, splitLine: { show: false }, axisLabel: { show: false }, min: 0 }
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
        name: '成交额', type: 'bar', xAxisIndex: 1, yAxisIndex: 1,
        data: D.vols.map((v, i) => ({
          value: v,
          itemStyle: { color: D.pcts[i] >= 0 ? 'rgba(225,62,62,.55)' : 'rgba(10,143,76,.55)' }
        })),
        barWidth: '60%', barMaxWidth: 14
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
  chart.setOption({ xAxis: [{ min: win.vs, max: win.ve }, { min: win.vs, max: win.ve }] });
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
function syncPresetHighlight() {
  if (!klines || !win) return;
  const span = win.ve - win.vs;
  document.querySelectorAll('.np-btn').forEach(b => {
    const n = +b.dataset.n;
    const match = n === 0 ? span >= lastN - 2 : span === n;
    b.classList.toggle('on', match);
  });
}

function setPreset(n) {
  if (!klines) return;
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

function bindSlider() {
  const slider = document.getElementById('nasdaq-slider');
  if (!slider) return;
  const dragTo = e => {
    if (!klines || !win) return;
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
    dragTo(e);
  });
  slider.addEventListener('pointermove', e => { if (thumbDragging) dragTo(e); });
  const end = () => { thumbDragging = false; };
  slider.addEventListener('pointerup', end);
  slider.addEventListener('pointercancel', end);
}

/* ===== 图表手势：单指平移 / 双指捏合缩放（低灵敏度） ===== */
function bindGestures() {
  const el = document.getElementById('nasdaq-chart');
  const dist2 = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const baseline = t => t.length === 1
    ? { mode: 'pan', x: t[0].clientX, vs: win.vs, span: win.ve - win.vs }
    : { mode: 'pinch', d0: dist2(t), span0: win.ve - win.vs, center0: (win.vs + win.ve) / 2 };

  el.addEventListener('touchstart', e => {
    if (!klines || !win || thumbDragging) return;
    e.preventDefault();
    const t = e.touches;
    touch = baseline(t);
  }, { passive: false });

  el.addEventListener('touchmove', e => {
    if (!touch || !klines || !win) return;
    e.preventDefault();
    const t = e.touches;
    if (touch.mode === 'pan' && t.length === 1) {
      const plotW = chart.getWidth() - GRID_LEFT - GRID_RIGHT;
      const ipp = (win.ve - win.vs) / Math.max(plotW, 1);   // 每 px 对应天数
      const dx = t[0].clientX - touch.x;
      const vs = clamp(Math.round(touch.vs - dx * ipp), 0, lastN - 1 - touch.span);
      setWindow(vs, vs + touch.span);
    } else if (touch.mode === 'pinch' && t.length >= 2) {
      const d = dist2(t);
      if (d < 10) return;
      const span = clamp(Math.round(touch.span0 * Math.pow(touch.d0 / d, PINCH_EASE)), MIN_SPAN, lastN - 1);
      const vs = clamp(Math.round(touch.center0 - span / 2), 0, lastN - 1 - span);
      setWindow(vs, vs + span);
    } else {
      // 手指数变化，重建基线
      touch = baseline(t);
    }
  }, { passive: false });

  el.addEventListener('touchend', e => {
    touch = e.touches.length ? baseline(e.touches) : null;
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
