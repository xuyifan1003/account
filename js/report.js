import { getState, getCategory } from './state.js';
import { getTodayMonth, formatMoney } from './utils.js';

let reportMonth = getTodayMonth();

/* ===== Render Report ===== */
export function renderReport() {
  document.getElementById('current-month').textContent = reportMonth;

  const [year, month] = reportMonth.split('-').map(Number);
  const monthRecords = getState().records.filter(r => {
    const [ry, rm] = r.date.split('-').map(Number);
    return ry === year && rm === month;
  });

  const totalIncome = monthRecords.filter(r => r.type === 'income')
    .reduce((s, r) => s + r.amount, 0);
  const totalExpense = monthRecords.filter(r => r.type === 'expense')
    .reduce((s, r) => s + r.amount, 0);

  document.getElementById('r-income').textContent = formatMoney(totalIncome);
  document.getElementById('r-expense').textContent = formatMoney(totalExpense);

  const chartEl = document.getElementById('report-chart');
  const emptyEl = document.getElementById('report-empty');

  // Group by category (expense only)
  const catMap = {};
  monthRecords.filter(r => r.type === 'expense').forEach(r => {
    if (!catMap[r.category]) catMap[r.category] = 0;
    catMap[r.category] += r.amount;
  });

  const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const maxAmount = entries.length > 0 ? entries[0][1] : 0;

  if (entries.length === 0) {
    chartEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  chartEl.innerHTML = entries.map(([catId, amount]) => {
    const cat = getCategory(catId);
    const barPct = maxAmount > 0 ? (amount / maxAmount * 100) : 0;
    const totalPct = totalExpense > 0 ? Math.round(amount / totalExpense * 100) : 0;
    return `
      <div class="chart-row">
        <div class="chart-icon ${catId}">${cat.icon}</div>
        <div class="chart-bar-wrap">
          <div class="chart-bar expense" style="width:${barPct}%">
            ${barPct > 25 ? '¥' + formatMoney(amount) : ''}
          </div>
        </div>
        <div class="chart-pct">${totalPct}%</div>
      </div>
    `;
  }).join('');
}

function prevMonth() {
  const [y, m] = reportMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  reportMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  renderReport();
}

function nextMonth() {
  const [y, m] = reportMonth.split('-').map(Number);
  const d = new Date(y, m, 1);
  reportMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  renderReport();
}

/* ===== Init ===== */
export function initReport() {
  document.getElementById('prev-month').addEventListener('click', prevMonth);
  document.getElementById('next-month').addEventListener('click', nextMonth);
}
