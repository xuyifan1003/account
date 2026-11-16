/* 纳指页：实时拉取东方财富日线（2025-01-01 起，只增不减），缓存秒开，断网兜底 */
import { haptic, showToast } from './utils.js';

const CACHE_KEY = 'nasdaq-kline-v1';
const API_BASE = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=100.NDX'
  + '&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57&klt=101&fqt=1&beg=20250101';

const UP = '#e13e3e';
const DOWN = '#0a8f4c';

let chart = null;
let klines = null;      // ['date,open,close,high,low,volume,x', ...]
let stale = false;      // 当前展示的是否为离线缓存
let pendingRange = null; // fetch 成功后待恢复的缩放区间（按天数）

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

function parse(kl) {
  const dates = [], opens = [], closes = [], highs = [], lows = [], vols = [];
  for (const row of kl) {
    const p = row.split(',');
    dates.push(p[0]); opens.push(+p[1]); closes.push(+p[2]);
    highs.push(+p[3]); lows.push(+p[4]); vols.push(+p[5]);
  }
  const pcts = [null];
  for (let i = 1; i < closes.length; i++) pcts.push((closes[i] / closes[i - 1] - 1) * 100);
  return { dates, opens, closes, highs, lows, vols, pcts, n: dates.length };
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

function applyData(kl, isStale) {
  klines = kl;
  stale = isStale;
  // 页面已处于激活状态就立即（重）渲染；未激活则等 showNasdaq() 触发
  if (document.getElementById('page-nasdaq').classList.contains('active')) renderChart();
}

function refreshData() {
  if (!navigator.onLine) { markStaleIfAny(); return; }
  fetchKlines().then(kl => {
    saveCache(kl);
    applyData(kl, false);
  }).catch(() => markStaleIfAny());
}
function markStaleIfAny() {
  if (klines) {
    stale = true;
    if (chart) renderChart(); // 更新 sub 提示
  }
}

/* ===== 图表 ===== */
function ensureChart() {
  if (chart) return;
  const el = document.getElementById('nasdaq-chart');
  chart = echarts.init(el);

  chart.on('datazoom', () => {
    updateStats();
    syncPresetHighlight();
  });
}

function option(D, startIdx) {
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
      { left: 48, right: 16, top: 16, height: 176 },
      { left: 48, right: 16, top: 244, height: 64 }
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
    dataZoom: [
      { type: 'slider', xAxisIndex: [0, 1], bottom: 10, height: 20,
        backgroundColor: '#f0f2f6', borderColor: '#e2e8f0', borderRadius: 5,
        fillerColor: 'rgba(74,74,74,.10)',
        handleStyle: { color: '#fff', borderColor: '#4A4A4A' },
        moveHandleStyle: { color: '#4A4A4A', opacity: .5 },
        dataBackground: { lineStyle: { color: '#c9cdd4' }, areaStyle: { color: 'rgba(201,205,212,.25)' } },
        selectedDataBackground: { lineStyle: { color: '#4A4A4A' }, areaStyle: { color: 'rgba(74,74,74,.12)' } },
        labelFormatter: () => '', startValue: startIdx, endValue: D.n - 1 },
      { type: 'inside', xAxisIndex: [0, 1] }
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
  const startIdx = Math.max(0, D.n - 244);
  ensureChart();
  chart.setOption(option(D, startIdx));
  chart.dispatchAction({ type: 'dataZoom', startValue: startIdx, endValue: D.n - 1 });
  updateStats();
}

/* ===== 统计卡片 + 首尾日期（随缩放联动） ===== */
function visibleRange() {
  const D = parse(klines);
  const dz = chart ? chart.getOption().dataZoom[0] : { startValue: Math.max(0, D.n - 244), endValue: D.n - 1 };
  let vs = dz.startValue != null ? dz.startValue : Math.round((dz.start == null ? 0 : dz.start) / 100 * (D.n - 1));
  let ve = dz.endValue != null ? dz.endValue : Math.round((dz.end == null ? 100 : dz.end) / 100 * (D.n - 1));
  vs = Math.max(0, Math.min(D.n - 1, vs));
  ve = Math.max(0, Math.min(D.n - 1, ve));
  if (ve < vs) [vs, ve] = [ve, vs];
  return { D, vs, ve };
}

function updateStats() {
  if (!klines) return;
  const { D, vs, ve } = visibleRange();

  document.getElementById('nasdaq-rs').textContent = D.dates[vs];
  document.getElementById('nasdaq-re').textContent = D.dates[ve];

  const base = vs > 0 ? D.closes[vs - 1] : D.closes[vs];
  const ret = (D.closes[ve] / base - 1) * 100;
  const retEl = document.getElementById('nasdaq-return');
  retEl.textContent = (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%';
  retEl.style.color = ret >= 0 ? '#FCA5A5' : '#6EE7B7';

  document.getElementById('nasdaq-sub').textContent =
    `最新收盘 ${fmt(D.closes[ve])} · 截至 ${D.dates[ve]}${stale ? '（离线缓存）' : ''}`;

  let peak = D.closes[vs], dd = 0;
  const pctsWin = [];
  for (let i = vs; i <= ve; i++) {
    if (D.closes[i] > peak) peak = D.closes[i];
    const d = (D.closes[i] / peak - 1) * 100;
    if (d < dd) dd = d;
    if (i > vs && D.pcts[i] !== null) pctsWin.push(D.pcts[i]);
  }
  const ddEl = document.getElementById('nasdaq-dd');
  ddEl.textContent = dd.toFixed(2) + '%';
  ddEl.className = dd < -10 ? 'down strong' : 'down';

  const sd = stdev(pctsWin);
  document.getElementById('nasdaq-vol').textContent = sd === null ? '—' : (sd * Math.sqrt(252)).toFixed(2) + '%';
}

/* ===== 快捷区间 ===== */
function syncPresetHighlight() {
  if (!klines || !chart) return;
  const { D, vs, ve } = visibleRange();
  const span = ve - vs;
  document.querySelectorAll('.np-btn').forEach(b => {
    const n = +b.dataset.n;
    const match = n === 0 ? span >= D.n - 2 : span === n;
    b.classList.toggle('on', match);
  });
}

function setPreset(n) {
  if (!klines || !chart) return;
  const D = parse(klines);
  const end = D.n - 1;
  const start = n > 0 ? Math.max(0, D.n - n) : 0;
  chart.dispatchAction({ type: 'dataZoom', startValue: start, endValue: end });
  document.querySelectorAll('.np-btn').forEach(b => b.classList.toggle('on', +b.dataset.n === n));
}

/* ===== 对外接口 ===== */
export function initNasdaq() {
  document.querySelectorAll('.np-btn').forEach(b => {
    b.addEventListener('click', () => { haptic(); setPreset(+b.dataset.n); });
  });
  window.addEventListener('resize', () => { if (chart) chart.resize(); });

  // 秒开：先渲染缓存，再后台拉新
  const cached = loadCache();
  if (cached && cached.klines && cached.klines.length > 10) {
    applyData(cached.klines, true);
    updateStats();
  }
  refreshData();
}

export function showNasdaq() {
  if (klines) renderChart();
}
