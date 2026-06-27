import { getState } from './state.js';
import { formatMoney } from './utils.js';

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
  const w = container.clientWidth;
  const h = 180;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const data = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

  const pad = { top: 24, right: 16, bottom: 32, left: 52 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const values = data.map(d => d.total_balance);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const paddedMin = Math.max(0, minVal - range * 0.15);
  const paddedMax = maxVal + range * 0.15;
  const paddedRange = paddedMax - paddedMin || 1;

  const prime = '#8B83FF';
  const muted = '#94A3B8';
  const grid = '#E8ECF0';

  const tickCount = 4;
  const tickStep = paddedRange / tickCount;
  const niceStep = niceRound(tickStep);
  const niceMin = Math.floor(paddedMin / niceStep) * niceStep;
  const niceMax = Math.ceil(paddedMax / niceStep) * niceStep;
  const niceRange = niceMax - niceMin;

  const yPos = v => pad.top + ch - ((v - niceMin) / niceRange) * ch;
  const xPos = i => pad.left + (i / (data.length - 1)) * cw;

  ctx.clearRect(0, 0, w, h);

  // Grid lines & Y labels
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '11px -apple-system, sans-serif';

  for (let v = niceMin; v <= niceMax + 0.01; v += niceStep) {
    const y = yPos(v);
    ctx.beginPath();
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();

    ctx.fillStyle = muted;
    ctx.fillText(v >= 10000 ? (v / 10000).toFixed(1) + '万' : Math.round(v).toString(), pad.left - 8, y);
  }

  // Gradient fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
  grad.addColorStop(0, 'rgba(139,131,255,0.25)');
  grad.addColorStop(1, 'rgba(139,131,255,0.02)');

  ctx.beginPath();
  ctx.moveTo(xPos(0), yPos(data[0].total_balance));
  for (let i = 1; i < data.length; i++) {
    const xc = (xPos(i) + xPos(i - 1)) / 2;
    const yc = (yPos(data[i].total_balance) + yPos(data[i - 1].total_balance)) / 2;
    ctx.quadraticCurveTo(xPos(i - 1), yPos(data[i - 1].total_balance), xc, yc);
  }
  ctx.lineTo(xPos(data.length - 1), pad.top + ch);
  ctx.lineTo(xPos(0), pad.top + ch);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(xPos(0), yPos(data[0].total_balance));
  for (let i = 1; i < data.length; i++) {
    const xc = (xPos(i) + xPos(i - 1)) / 2;
    const yc = (yPos(data[i].total_balance) + yPos(data[i - 1].total_balance)) / 2;
    ctx.quadraticCurveTo(xPos(i - 1), yPos(data[i - 1].total_balance), xc, yc);
  }
  ctx.strokeStyle = prime;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Dots
  data.forEach((d, i) => {
    const x = xPos(i);
    const y = yPos(d.total_balance);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = prime;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // X labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = muted;
  ctx.font = '11px -apple-system, sans-serif';

  const maxLabels = Math.max(2, Math.min(data.length, Math.floor(cw / 55)));
  const step = data.length > 1 ? Math.max(1, Math.floor((data.length - 1) / (maxLabels - 1))) : 1;

  data.forEach((d, i) => {
    if (i === 0 || i === data.length - 1 || i % step === 0) {
      ctx.fillText(d.date.slice(5), xPos(i), pad.top + ch + 8);
    }
  });

  // First & last value labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = '600 11px -apple-system, sans-serif';
  ctx.fillStyle = prime;
  ctx.fillText('¥' + formatMoney(data[0].total_balance), xPos(0), yPos(data[0].total_balance) - 8);
  ctx.fillText('¥' + formatMoney(data[data.length - 1].total_balance), xPos(data.length - 1), yPos(data[data.length - 1].total_balance) - 8);
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
