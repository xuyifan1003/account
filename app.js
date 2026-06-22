/* ===== App State ===== */
const CATEGORIES = [
  { id:'food', name:'餐饮', icon:'🍜', type:'expense' },
  { id:'transport', name:'交通', icon:'🚗', type:'expense' },
  { id:'shopping', name:'购物', icon:'🛍️', type:'expense' },
  { id:'entertainment', name:'娱乐', icon:'🎮', type:'expense' },
  { id:'daily', name:'日用', icon:'🏠', type:'expense' },
  { id:'communication', name:'通讯', icon:'📱', type:'expense' },
  { id:'medical', name:'医疗', icon:'💊', type:'expense' },
  { id:'education', name:'教育', icon:'📚', type:'expense' },
  { id:'salary', name:'工资', icon:'💰', type:'income' },
  { id:'other', name:'其他', icon:'📌', type:'expense' },
];

const DEFAULT_ASSETS = [
  { id:'asset-wx', name:'微信', icon:'💬', balance:0, sort:0 },
  { id:'asset-alipay', name:'支付宝', icon:'🔵', balance:0, sort:1 },
  { id:'asset-cash', name:'现金', icon:'💵', balance:0, sort:2 },
  { id:'asset-card', name:'银行卡', icon:'💳', balance:0, sort:3 },
];

let state = loadState();
let selectedCategory = null;
let editingAssetId = null;
let reportMonth = getTodayMonth();

/* ===== Data Persistence ===== */
function loadState() {
  try {
    const raw = localStorage.getItem('money_state');
    if (raw) {
      const s = JSON.parse(raw);
      if (!s.records) s.records = [];
      if (!s.assets || s.assets.length === 0) s.assets = JSON.parse(JSON.stringify(DEFAULT_ASSETS));
      return s;
    }
  } catch(e) {}
  return { records: [], assets: JSON.parse(JSON.stringify(DEFAULT_ASSETS)) };
}

function saveState() {
  localStorage.setItem('money_state', JSON.stringify(state));
}

/* ===== Helpers ===== */
function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function getTodayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function formatMoney(n) {
  return Number(n).toFixed(2);
}

function getCategory(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length-1];
}

function isToday(dateStr) {
  return dateStr === getToday();
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,5);
}

/* ===== Tab Switching ===== */
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${tabName}`));
  document.getElementById('header').querySelector('h1').textContent =
    tabName === 'book' ? '极简记账' : tabName === 'assets' ? '资产' : '报表';

  if (tabName === 'report') renderReport();
  if (tabName === 'assets') renderAssets();
}

/* ===== Init Category Grid ===== */
function renderCategories() {
  const grid = document.getElementById('category-grid');
  grid.innerHTML = CATEGORIES.map(c => `
    <button class="cat-btn ${c.type}" data-cat="${c.id}">
      <span class="cat-icon">${c.icon}</span>
      <span class="cat-name">${c.name}</span>
    </button>
  `).join('');

  grid.addEventListener('click', e => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    selectedCategory = btn.dataset.cat;
    openAmountModal(selectedCategory);
  });
}

/* ===== Amount Modal ===== */
function openAmountModal(catId) {
  const cat = getCategory(catId);
  document.getElementById('modal-category-name').textContent = cat.icon + ' ' + cat.name;
  document.getElementById('amount-value').textContent = '0';
  document.getElementById('input-note').value = '';
  document.getElementById('amount-modal').classList.remove('hidden');
  // reset amount display state
  modalAmount = '0';
  modalHasDecimal = false;
  modalDecimalDigits = 0;
}

function closeAmountModal() {
  document.getElementById('amount-modal').classList.add('hidden');
}

let modalAmount = '0';
let modalHasDecimal = false;
let modalDecimalDigits = 0;

function handleNumpad(key) {
  if (key === 'confirm') {
    const val = parseFloat(modalAmount);
    if (val <= 0) { shakeElement(document.querySelector('.amount-display')); return; }
    if (!selectedCategory) return;
    const cat = getCategory(selectedCategory);
    const now = getNow();
    state.records.unshift({
      id: genId(),
      category: selectedCategory,
      amount: val,
      note: document.getElementById('input-note').value.trim(),
      date: getToday(),
      time: now,
      type: cat.type,
    });
    saveState();
    closeAmountModal();
    renderRecords();
    return;
  }

  if (key === 'del') {
    if (modalAmount.length <= 1 || (modalAmount.length === 2 && modalAmount.startsWith('-'))) {
      modalAmount = '0'; modalHasDecimal = false; modalDecimalDigits = 0;
    } else {
      if (modalHasDecimal) {
        modalDecimalDigits--;
        if (modalDecimalDigits <= 0) { modalHasDecimal = false; modalDecimalDigits = 0; }
      }
      modalAmount = modalAmount.slice(0, -1);
      if (modalAmount === '-') modalAmount = '0';
    }
    updateAmountDisplay();
    return;
  }

  if (key === '.') {
    if (!modalHasDecimal) {
      modalHasDecimal = true;
      modalDecimalDigits = 0;
      modalAmount += '.';
    }
    updateAmountDisplay();
    return;
  }

  // Number key
  if (modalHasDecimal) {
    if (modalDecimalDigits >= 2) return;
    modalDecimalDigits++;
    modalAmount += key;
  } else {
    if (modalAmount === '0') {
      modalAmount = key;
    } else {
      if (modalAmount.length >= 10) return;
      modalAmount += key;
    }
  }
  updateAmountDisplay();
}

function updateAmountDisplay() {
  document.getElementById('amount-value').textContent = modalAmount;
}

function shakeElement(el) {
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake .3s ease';
}

/* Add shake keyframe dynamically */
(function() {
  const style = document.createElement('style');
  style.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}50%{transform:translateX(6px)}75%{transform:translateX(-3px)}}`;
  document.head.appendChild(style);
})();

/* ===== Render Records ===== */
function renderRecords() {
  const container = document.getElementById('records-list');
  const today = getToday();
  const todayRecords = state.records.filter(r => r.date === today);

  if (todayRecords.length === 0) {
    container.innerHTML = '<div class="empty-tip">今天还没有记录，点击上方分类开始记账</div>';
    return;
  }

  container.innerHTML = todayRecords.map(r => {
    const cat = getCategory(r.category);
    const isExpense = r.type === 'expense';
    return `
      <div class="record-item" data-id="${r.id}">
        <div class="record-icon ${r.type}">${cat.icon}</div>
        <div class="record-info">
          <div class="record-cat">${cat.name}</div>
          ${r.note ? `<div class="record-note">${r.note}</div>` : ''}
        </div>
        <div class="record-right">
          <div class="record-amount ${r.type}">${isExpense ? '-' : '+'}${formatMoney(r.amount)}</div>
          <div class="record-time">${r.time}</div>
        </div>
      </div>
    `;
  }).join('');
}

/* ===== Assets ===== */
function renderAssets() {
  const container = document.getElementById('assets-list');
  const total = state.assets.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  document.getElementById('total-assets').textContent = formatMoney(total);

  container.innerHTML = state.assets.map(a => `
    <div class="asset-item" data-id="${a.id}">
      <div class="asset-icon">${a.icon || '🏦'}</div>
      <div class="asset-info">
        <div class="asset-name">${a.name}</div>
      </div>
      <div class="asset-balance">¥${formatMoney(a.balance)}</div>
    </div>
  `).join('');

  container.querySelectorAll('.asset-item').forEach(el => {
    el.addEventListener('click', () => openAssetModal(el.dataset.id));
  });
}

function openAssetModal(id) {
  editingAssetId = id;
  const asset = state.assets.find(a => a.id === id);
  if (!asset) return;
  document.getElementById('asset-modal-title').textContent = '编辑资产';
  document.getElementById('asset-name').value = asset.name;
  document.getElementById('asset-balance').value = asset.balance;
  document.getElementById('asset-delete-row').classList.remove('hidden');
  document.getElementById('asset-modal').classList.remove('hidden');
}

function openAddAssetModal() {
  editingAssetId = null;
  document.getElementById('asset-modal-title').textContent = '添加资产';
  document.getElementById('asset-name').value = '';
  document.getElementById('asset-balance').value = '';
  document.getElementById('asset-delete-row').classList.add('hidden');
  document.getElementById('asset-modal').classList.remove('hidden');
}

function closeAssetModal() {
  document.getElementById('asset-modal').classList.add('hidden');
}

function saveAsset() {
  const name = document.getElementById('asset-name').value.trim();
  const balance = parseFloat(document.getElementById('asset-balance').value) || 0;
  if (!name) { alert('请输入资产名称'); return; }

  if (editingAssetId) {
    const asset = state.assets.find(a => a.id === editingAssetId);
    if (asset) { asset.name = name; asset.balance = balance; }
  } else {
    state.assets.push({ id: 'asset-' + genId(), name, icon: '🏦', balance, sort: state.assets.length });
  }
  saveState();
  closeAssetModal();
  renderAssets();
}

function deleteAsset() {
  if (!editingAssetId) return;
  if (!confirm('确定删除此资产？')) return;
  state.assets = state.assets.filter(a => a.id !== editingAssetId);
  saveState();
  closeAssetModal();
  renderAssets();
}

/* ===== Report ===== */
function renderReport() {
  document.getElementById('current-month').textContent = reportMonth;

  const [year, month] = reportMonth.split('-').map(Number);
  const monthRecords = state.records.filter(r => {
    const [ry, rm] = r.date.split('-').map(Number);
    return ry === year && rm === month;
  });

  const totalIncome = monthRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = monthRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  document.getElementById('r-income').textContent = formatMoney(totalIncome);
  document.getElementById('r-expense').textContent = formatMoney(totalExpense);

  // Category breakdown
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
    const pct = maxAmount > 0 ? (amount / maxAmount * 100) : 0;
    return `
      <div class="chart-row">
        <div class="chart-label">${cat.icon}</div>
        <div class="chart-bar-wrap">
          <div class="chart-bar expense" style="width:${pct}%">${pct > 30 ? '¥' + formatMoney(amount) : ''}</div>
        </div>
        <div class="chart-pct">${maxAmount > 0 ? Math.round(amount / totalExpense * 100) : 0}%</div>
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
function init() {
  // Tab bar
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Category grid
  renderCategories();

  // Records
  renderRecords();

  // Assets
  renderAssets();

  // Today display
  document.getElementById('today-display').textContent = getToday();

  // Numpad
  document.querySelectorAll('.numpad button').forEach(btn => {
    btn.addEventListener('click', () => handleNumpad(btn.dataset.key));
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeAmountModal);
  document.querySelector('#amount-modal .modal-overlay').addEventListener('click', closeAmountModal);

  // Asset modal
  document.getElementById('btn-add-asset').addEventListener('click', openAddAssetModal);
  document.getElementById('asset-close').addEventListener('click', closeAssetModal);
  document.querySelector('#asset-modal .modal-overlay').addEventListener('click', closeAssetModal);
  document.getElementById('asset-save').addEventListener('click', saveAsset);
  document.getElementById('asset-delete').addEventListener('click', deleteAsset);

  // Report
  document.getElementById('prev-month').addEventListener('click', prevMonth);
  document.getElementById('next-month').addEventListener('click', nextMonth);

  // PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
