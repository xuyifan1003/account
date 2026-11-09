import { getState } from './state.js';
import { haptic } from './utils.js';

let hitPoints = [];   // {x, y, value, date} — 点按吸附用
let selectedIdx = -1; // 当前选中的点（-1 = 无）

export function renderAssetChart() {
  const canvas = document.getElementById('asset-trend-chart');
  const container = document.getElementById('asset-chart-container');
  const { snapshots } = getState();

  if (!snapshots || snapshots.length < 2) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';

  const dpr = window.devicePixelRatio || 1;
  const cs = getComputedStyle(container);
  const padH = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const w = container.clientWidth - padH;
  const h = 150;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const raw = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const data = aggregate(raw);
  const n = data.length;
  if (selectedIdx >= n) selectedIdx = -1;

  const pad = { top: 30, right: 26, bottom: 36, left: 46 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const values = data.map(d => d.total_balance);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const paddedMin = Math.max(0, minVal - range * 0.15);
  const paddedMax = maxVal + range * 0.15;
  const paddedRange = paddedMax - paddedMin || 1;

  const prime = '#4A4A4A';
  const muted = '#94A3B8';
  const grid = '#E8ECF0';
  const plotBg = '#F8F9FA';

  // 纵轴刻度步长：范围大时 ≥1万（整数万标签），范围小时自动降级到千
  const tickStep = Math.max(niceRound(paddedRange / 4), 100);
  const yPos = v => pad.top + ch - ((v - paddedMin) / paddedRange) * ch;
  const xPos = i => pad.left + (n === 1 ? cw / 2 : (i / (n - 1)) * cw);

  ctx.clearRect(0, 0, w, h);

  // Plot area background
  ctx.fillStyle = plotBg;
  roundRect(ctx, pad.left, pad.top, cw, ch, 4);
  ctx.fill();

  // Grid lines & Y labels（范围 ≥2万 → 整数万；否则 → 千）
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '10px -apple-system, sans-serif';
  const useWan = paddedRange >= 20000;
  const yLabel = v => useWan ? Math.round(v / 10000) + '万' : Math.round(v / 1000) + '千';
  for (let v = Math.ceil(paddedMin / tickStep) * tickStep; v <= paddedMax + 0.01; v += tickStep) {
    const y = yPos(v);
    if (y < pad.top - 2 || y > pad.top + ch + 2) continue;
    ctx.beginPath();
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.fillText(yLabel(v), pad.left - 8, y);
  }

  // Gradient fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
  grad.addColorStop(0, 'rgba(74,74,74,0.22)');
  grad.addColorStop(1, 'rgba(74,74,74,0.02)');

  ctx.beginPath();
  ctx.moveTo(xPos(0), yPos(data[0].total_balance));
  for (let i = 1; i < n; i++) {
    ctx.lineTo(xPos(i), yPos(data[i].total_balance));
  }
  ctx.lineTo(xPos(n - 1), pad.top + ch);
  ctx.lineTo(xPos(0), pad.top + ch);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(xPos(0), yPos(data[0].total_balance));
  for (let i = 1; i < n; i++) {
    ctx.lineTo(xPos(i), yPos(data[i].total_balance));
  }
  ctx.strokeStyle = prime;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Dots（点多时缩小/隐藏，只留线）
  const dotR = n > 20 ? 0 : (n > 15 ? 2.5 : 4);
  if (dotR > 0) {
    data.forEach((d, i) => {
      ctx.beginPath();
      ctx.arc(xPos(i), yPos(d.total_balance), dotR, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = prime;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  // X labels: "YY.MM" 抽稀，最多 8 个，首尾必显示
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = muted;
  ctx.font = '10px -apple-system, sans-serif';
  const maxLabels = Math.max(2, Math.min(n, Math.floor(cw / 45), 8));
  const labelStep = n > 1 ? Math.ceil((n - 1) / (maxLabels - 1)) : 1;
  const shown = new Set();
  for (let i = 0; i < n; i += labelStep) shown.add(i);
  shown.add(n - 1);
  [...shown].sort((a, b) => a - b).forEach(i => {
    ctx.fillText(xLabel(data[i].date), xPos(i), pad.top + ch + 8);
  });

  // 点击吸附点缓存 + 高亮
  hitPoints = data.map((d, i) => ({
    x: xPos(i),
    y: yPos(d.total_balance),
    value: d.total_balance,
    date: d.date,
  }));

  if (selectedIdx >= 0 && selectedIdx < n) {
    drawHighlight(ctx, hitPoints[selectedIdx], pad, w);
  }

  ensureTapHandler(canvas);
}

/* ===== 聚合：点数 >30 时按时间跨度自动降粒度（日 → 月 → 季 → 年），目标 ≤12 点 ===== */
function aggregate(data) {
  if (data.length <= 30) return data;
  const d0 = new Date(data[0].date + 'T00:00:00');
  const d1 = new Date(data[data.length - 1].date + 'T00:00:00');
  const spanDays = Math.round((d1 - d0) / 86400000);
  let key;
  if (spanDays <= 365) {
    key = ds => ds.slice(0, 7);                                    // 月
  } else if (spanDays <= 365 * 3) {
    key = ds => { const [y, m] = ds.split('-').map(Number); return `${y}-Q${Math.ceil(m / 3)}`; };  // 季
  } else {
    key = ds => ds.slice(0, 4);                                    // 年
  }
  const last = new Map();
  for (const p of data) last.set(key(p.date), p);   // 每组取最后一次快照
  return [...last.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/* ===== 横坐标标签："YY.MM" ===== */
function xLabel(dateStr) {
  const [y, m] = dateStr.split('-');
  return `${y.slice(2)}.${m}`;
}

/* ===== 点按：吸附最近点，高亮 + 只显示金额（0.1万精度） ===== */
function ensureTapHandler(canvas) {
  if (canvas._tapBound) return;
  canvas._tapBound = true;
  canvas.addEventListener('click', e => {
    if (!hitPoints.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best = -1, bestD = 44 * 44;   // 44px 吸附半径
    for (let i = 0; i < hitPoints.length; i++) {
      const dx = hitPoints[i].x - x, dy = hitPoints[i].y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) {
      haptic();
      selectedIdx = (selectedIdx === best) ? -1 : best;
    } else {
      selectedIdx = -1;
    }
    renderAssetChart();
  });
}

function drawHighlight(ctx, pt, pad, w) {
  const prime = '#4A4A4A';
  // 高亮圆点
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = prime;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 金额标签（0.1万 = 精确到千），只显示金额
  const label = fmtAmount(pt.value);
  ctx.font = 'bold 11px -apple-system, sans-serif';
  const tw = ctx.measureText(label).width;
  const pillW = tw + 14;
  const pillH = 20;
  let px = Math.max(pad.left, Math.min(pt.x - pillW / 2, w - pad.right - pillW));
  let py = pt.y - pillH - 10;
  if (py < 4) py = pt.y + 12;   // 靠顶时改到点下方

  ctx.beginPath();
  roundRect(ctx, px, py, pillW, pillH, 6);
  ctx.fillStyle = prime;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, px + pillW / 2, py + pillH / 2 + 0.5);
}

function fmtAmount(v) {
  if (v >= 10000) return (v / 10000).toFixed(1) + '万';   // 0.1万 = 精确到千
  return Math.round(v / 1000) + '千';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function niceRound(v) {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const mag = Math.pow(10, exp);
  const norm = v / mag;
  if (norm <= 1.5) return mag;
  if (norm <= 3.5) return 2 * mag;
  if (norm <= 7.5) return 5 * mag;
  return 10 * mag;
}
