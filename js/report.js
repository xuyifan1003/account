import { getState, getCategory } from './state.js';
import { getToday, getTodayMonth, formatMoney, haptic } from './utils.js';

let viewMode = 'month';
let reportDate = getTodayMonth();

export function renderReport() {
  const state = getState();
  document.getElementById('current-period').textContent = formatPeriod();
  document.getElementById('report-label').textContent = viewMode === 'year' ? '全年支出' : '本月支出';

  const records = state.records.filter(r => matchPeriod(r.date));
  const expenseRecords = records.filter(r => r.type === 'expense');
  const totalExpense = expenseRecords.reduce((s, r) => s + r.amount, 0);

  document.getElementById('report-total').textContent = formatMoney(totalExpense);

  if (records.length === 0) {
    document.getElementById('report-sub').textContent = '';
    document.getElementById('report-categories').innerHTML = '';
    document.getElementById('category-empty').style.display = 'block';
    document.getElementById('report-trend').innerHTML = '';
    document.getElementById('trend-section').style.display = 'none';
    return;
  }

  document.getElementById('category-empty').style.display = 'none';

  if (viewMode === 'month') {
    const [y, m] = reportDate.split('-').map(Number);
    const now = new Date();
    const isCurrent = y === now.getFullYear() && m === now.getMonth() + 1;
    const days = isCurrent ? now.getDate() : new Date(y, m, 0).getDate();
    document.getElementById('report-sub').textContent =
      `共 ${records.length} 笔 · 日均 ¥${formatMoney(totalExpense / days)}`;
  } else {
    const y = Number(reportDate);
    const months = y === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
    document.getElementById('report-sub').textContent =
      `共 ${records.length} 笔 · 月均 ¥${formatMoney(totalExpense / months)}`;
  }

  renderCategories(expenseRecords, totalExpense);
  document.getElementById('trend-section').style.display = 'block';
  renderTrend(state);
}

function matchPeriod(dateStr) {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length < 2) return false;
  const [y, m] = parts.map(Number);
  if (isNaN(y) || isNaN(m)) return false;
  if (viewMode === 'month') {
    const [ry, rm] = reportDate.split('-').map(Number);
    return y === ry && m === rm;
  }
  return y === Number(reportDate);
}

function formatPeriod() {
  if (viewMode === 'month') {
    const [y, m] = reportDate.split('-').map(Number);
    return `${y}年${m}月`;
  }
  return `${reportDate}年`;
}

function renderCategories(expenseRecords, total) {
  const catMap = {};
  expenseRecords.forEach(r => {
    if (!catMap[r.category]) catMap[r.category] = { amount: 0, count: 0 };
    catMap[r.category].amount += r.amount;
    catMap[r.category].count++;
  });

  const entries = Object.entries(catMap).sort((a, b) => b[1].amount - a[1].amount);
  const maxAmount = entries.length > 0 ? entries[0][1].amount : 0;

  document.getElementById('report-categories').innerHTML = entries.map(([catId, { amount, count }]) => {
    const cat = getCategory(catId);
    return `
      <div class="report-cat-row">
        <div class="report-cat-icon ${catId}">${cat.icon}</div>
        <div class="report-cat-body">
          <div class="report-cat-header">
            <span class="report-cat-name">${cat.name} <span class="report-cat-count">${count} 笔</span></span>
            <span class="report-cat-amount">¥${formatMoney(amount)}</span>
          </div>
          <div class="report-cat-bar-wrap">
            <div class="report-cat-bar cat-bar ${catId}" style="width:${maxAmount > 0 ? amount / maxAmount * 100 : 0}%"></div>
          </div>
        </div>
        <div class="report-cat-pct">${total > 0 ? Math.round(amount / total * 100) : 0}%</div>
      </div>
    `;
  }).join('');
}

function renderTrend(state) {
  const data = getTrendData(state);
  const el = document.getElementById('report-trend');
  const currentPeriod = viewMode === 'month' ? getToday() : getTodayMonth();

  el.innerHTML = data.map(d => {
    const isActive = d.period === currentPeriod;
    return `
      <div class="trend-col${isActive ? ' active' : ''}" data-period="${d.period}" data-mode="${d.targetMode || 'month'}">
        <div class="trend-amount">${d.amountLabel}</div>
        <div class="trend-bar" style="height:${d.barHeight}%;background:${d.color}"></div>
        <div class="trend-label">${d.label}</div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.trend-col').forEach(col => {
    col.addEventListener('click', () => {
      haptic();
      const period = col.dataset.period;
      const mode = col.dataset.mode;
      if (period && mode !== 'day') {
        if (mode === 'year') {
          viewMode = 'year';
          reportDate = period;
        } else {
          viewMode = 'month';
          reportDate = period;
        }
        updateToggleButtons();
        renderReport();
      }
    });
  });
}

function getTrendData(state) {
  if (viewMode === 'month') {
    return buildDayTrend(state);
  }
  return buildYearTrend(state);
}

function buildDayTrend(state) {
  const today = new Date();
  const data = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const period = `${y}-${m}-${day}`;
    const expense = state.records
      .filter(r => r.date === period && r.type === 'expense')
      .reduce((s, r) => s + r.amount, 0);
    data.push({
      period,
      label: d.getDate() + '号',
      amount: expense,
      targetMode: 'day',
    });
  }

  const max = Math.max(...data.map(d => d.amount), 1);
  return data.map(d => ({
    ...d,
    barHeight: d.amount / max * 100,
    color: barColor(d.amount, max),
    amountLabel: d.amount > 0 ? (d.amount >= 10000 ? (d.amount / 10000).toFixed(1) + '万' : Math.round(d.amount).toString()) : '',
  }));
}

function buildYearTrend(state) {
  const year = Number(reportDate);
  const data = [];
  for (let m = 1; m <= 12; m++) {
    const period = `${year}-${String(m).padStart(2, '0')}`;
    const expense = state.records
      .filter(r => r.date.startsWith(period) && r.type === 'expense')
      .reduce((s, r) => s + r.amount, 0);
    data.push({
      period,
      label: m + '月',
      amount: expense,
      targetMode: 'month',
    });
  }

  const max = Math.max(...data.map(d => d.amount), 1);
  return data.map(d => ({
    ...d,
    barHeight: d.amount / max * 100,
    color: barColor(d.amount, max),
    amountLabel: d.amount > 0 ? (d.amount >= 10000 ? (d.amount / 10000).toFixed(1) + '万' : Math.round(d.amount).toString()) : '',
  }));
}

function barColor(amount, max) {
  if (amount <= 0) return 'transparent';
  const pct = amount / max;
  return `rgba(74, 74, 74, ${(0.15 + pct * 0.85).toFixed(2)})`;
}

function prevPeriod() {
  haptic();
  if (viewMode === 'month') {
    const [y, m] = reportDate.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    reportDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } else {
    reportDate = String(Number(reportDate) - 1);
  }
  renderReport();
}

function nextPeriod() {
  haptic();
  if (viewMode === 'month') {
    const [y, m] = reportDate.split('-').map(Number);
    const d = new Date(y, m, 1);
    reportDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } else {
    reportDate = String(Number(reportDate) + 1);
  }
  renderReport();
}

function updateToggleButtons() {
  document.getElementById('view-month').classList.toggle('active', viewMode === 'month');
  document.getElementById('view-year').classList.toggle('active', viewMode === 'year');
  document.getElementById('trend-section').style.display = 'block';
  if (viewMode === 'year') {
    document.getElementById('trend-title').style.display = 'none';
  } else {
    document.getElementById('trend-title').style.display = 'block';
    document.getElementById('trend-title').textContent = '近12日趋势';
  }
}

function switchView(mode) {
  if (viewMode === mode) return;
  haptic();
  viewMode = mode;
  if (mode === 'year') {
    reportDate = reportDate.split('-')[0];
  } else {
    reportDate = getTodayMonth();
  }
  updateToggleButtons();
  renderReport();
}

export function initReport() {
  updateToggleButtons();
  renderReport();

  document.getElementById('prev-period').addEventListener('click', prevPeriod);
  document.getElementById('next-period').addEventListener('click', nextPeriod);
  document.getElementById('view-month').addEventListener('click', () => switchView('month'));
  document.getElementById('view-year').addEventListener('click', () => switchView('year'));
  document.getElementById('current-period').addEventListener('click', () => {
    haptic();
    reportDate = viewMode === 'month' ? getTodayMonth() : String(new Date().getFullYear());
    renderReport();
  });
}
