import { CATEGORIES, getState, saveState, getCategory } from './state.js';
import { getToday, getNow, formatMoney, genId, showToast, shakeElement } from './utils.js';

/* ===== Modal State ===== */
let selectedCategory = null;
let modalAmount = '0';
let modalHasDecimal = false;
let modalDecimalDigits = 0;

/* ===== Book Summary: Monthly Expense ===== */
export function renderBookSummary() {
  const state = getState();
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const totalExpense = state.records
    .filter(r => r.date.startsWith(monthPrefix) && r.type === 'expense')
    .reduce((s, r) => s + r.amount, 0);

  document.getElementById('monthly-expense').textContent = formatMoney(totalExpense);
}

/* ===== Categories Grid ===== */
export function renderCategories() {
  const grid = document.getElementById('category-grid');
  grid.innerHTML = CATEGORIES.map(c => `
    <button class="cat-btn" data-cat="${c.id}">
      <div class="cat-icon-wrap ${c.id}">${c.icon}</div>
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

/* ===== Records List ===== */
export function renderRecords() {
  const container = document.getElementById('records-list');
  const todayRecords = getState().records.filter(r => r.date === getToday());

  if (todayRecords.length === 0) {
    container.innerHTML = '<div class="empty-tip">今天还没有记录<br>点击上方分类开始记账</div>';
    return;
  }

  container.innerHTML = todayRecords.map((r, i) => {
    const cat = getCategory(r.category);
    const isExpense = r.type === 'expense';
    return `
      <div class="record-item" style="animation-delay:${i * 0.03}s">
        <div class="record-icon-wrap ${r.type}">${cat.icon}</div>
        <div class="record-info">
          <div class="record-cat">${cat.name}</div>
          ${r.note ? `<div class="record-note">${r.note}</div>` : ''}
        </div>
        <div class="record-right">
          <div class="record-amount ${r.type}">${isExpense ? '−' : '+'}${formatMoney(r.amount)}</div>
          <div class="record-time">${r.time}</div>
        </div>
      </div>
    `;
  }).join('');
}

/* ===== Amount Modal ===== */
function openAmountModal(catId) {
  const cat = getCategory(catId);
  document.getElementById('modal-category-name').textContent = cat.icon + ' ' + cat.name;
  document.getElementById('amount-value').textContent = '0';
  document.getElementById('input-note').value = '';
  document.getElementById('amount-modal').classList.remove('hidden');
  // Reset numpad state
  modalAmount = '0';
  modalHasDecimal = false;
  modalDecimalDigits = 0;
}

function closeAmountModal() {
  document.getElementById('amount-modal').classList.add('hidden');
}

/* ===== Numpad ===== */
function handleNumpad(key) {
  if (key === 'confirm') {
    const val = parseFloat(modalAmount);
    if (val <= 0) {
      shakeElement(document.querySelector('.amount-display'));
      return;
    }
    if (!selectedCategory) return;

    const cat = getCategory(selectedCategory);
    const state = getState();
    state.records.unshift({
      id: genId(),
      category: selectedCategory,
      amount: val,
      note: document.getElementById('input-note').value.trim(),
      date: getToday(),
      time: getNow(),
      type: cat.type,
    });
    saveState();
    closeAmountModal();
    renderRecords();
    renderBookSummary();
    showToast(`✓ ${cat.name} ${formatMoney(val)} 元`);
    return;
  }

  if (key === 'del') {
    if (modalAmount.length <= 1 || (modalAmount.length === 2 && modalAmount.startsWith('-'))) {
      modalAmount = '0';
      modalHasDecimal = false;
      modalDecimalDigits = 0;
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

/* ===== Init Book Module ===== */
export function initBook() {
  renderCategories();
  renderRecords();

  // Numpad
  document.querySelectorAll('.numpad button').forEach(btn => {
    btn.addEventListener('click', () => handleNumpad(btn.dataset.key));
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeAmountModal);
  document.querySelector('#amount-modal .modal-overlay').addEventListener('click', closeAmountModal);

  // Auto-refresh records every minute
  setInterval(() => {
    renderRecords();
    renderBookSummary();
  }, 60000);
}
