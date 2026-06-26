import { CATEGORIES, getState, saveState, getCategory } from './state.js';
import { getToday, getNow, formatMoney, genId, showToast, shakeElement, haptic } from './utils.js';

/* ===== Modal State ===== */
let selectedCategory = null;
let editingRecordId = null;
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
    haptic();
    selectedCategory = btn.dataset.cat;
    openAmountModal(selectedCategory);
  });
}

/* ===== Records List ===== */
export function renderRecords() {
  const container = document.getElementById('records-list');
  const todayRecords = getState().records.filter(r => r.date === getToday());

  if (todayRecords.length === 0) {
    container.innerHTML = '<div class="empty-tip">今天还没有记录<br>长按已有记录可修改或删除</div>';
    return;
  }

  container.innerHTML = todayRecords.map((r, i) => {
    const cat = getCategory(r.category);
    return `
      <div class="record-item" data-id="${r.id}" style="animation-delay:${i * 0.03}s">
        <div class="record-icon-wrap ${r.category}">${cat.icon}</div>
        <div class="record-info">
          <div class="record-cat">${cat.name}</div>
          ${r.note ? `<div class="record-note">${r.note}</div>` : ''}
        </div>
        <div class="record-right">
          <div class="record-amount">¥${formatMoney(r.amount)}</div>
          <div class="record-time">${r.time}</div>
        </div>
      </div>
    `;
  }).join('');
}

/* ===== Amount Modal ===== */
function openAmountModal(catId, editRecord = null) {
  if (editRecord) {
    editingRecordId = editRecord.id;
    selectedCategory = editRecord.category;
    const cat = getCategory(editRecord.category);
    document.getElementById('modal-category-name').textContent = cat.icon + ' ' + cat.name;
    modalAmount = String(editRecord.amount);
    modalHasDecimal = modalAmount.includes('.');
    modalDecimalDigits = modalHasDecimal ? modalAmount.split('.')[1].length : 0;
    document.getElementById('amount-value').textContent = modalAmount;
    document.getElementById('input-note').value = editRecord.note || '';
    document.getElementById('record-delete-row').style.display = 'block';
  } else {
    editingRecordId = null;
    selectedCategory = catId;
    const cat = getCategory(catId);
    document.getElementById('modal-category-name').textContent = cat.icon + ' ' + cat.name;
    document.getElementById('amount-value').textContent = '0';
    document.getElementById('input-note').value = '';
    document.getElementById('record-delete-row').style.display = 'none';
    modalAmount = '0';
    modalHasDecimal = false;
    modalDecimalDigits = 0;
  }
  document.getElementById('amount-modal').classList.remove('hidden');
}

function closeAmountModal() {
  document.getElementById('amount-modal').classList.add('hidden');
  editingRecordId = null;
}

/* ===== Numpad ===== */
function handleNumpad(key) {
  if (key === 'confirm') {
    haptic();
    const val = parseFloat(modalAmount);
    if (val <= 0) {
      shakeElement(document.querySelector('.amount-display'));
      return;
    }

    const state = getState();
    if (editingRecordId) {
      const record = state.records.find(r => r.id === editingRecordId);
      if (record) {
        record.amount = val;
        record.note = document.getElementById('input-note').value.trim();
      }
      editingRecordId = null;
      saveState();
      closeAmountModal();
      renderRecords();
      renderBookSummary();
      showToast('已保存');
      return;
    }

    if (!selectedCategory) return;
    const cat = getCategory(selectedCategory);
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

  // Long press on record items → edit/delete
  let lpTimer = null;
  const list = document.getElementById('records-list');
  list.addEventListener('pointerdown', e => {
    const item = e.target.closest('.record-item');
    if (!item) return;
    const id = item.dataset.id;
    if (!id) return;
    lpTimer = setTimeout(() => {
      haptic();
      const record = getState().records.find(r => r.id === id);
      if (record) openAmountModal(record.category, record);
    }, 500);
  });
  list.addEventListener('pointermove', () => { clearTimeout(lpTimer); });
  list.addEventListener('pointerup', () => { clearTimeout(lpTimer); });
  list.addEventListener('pointercancel', () => { clearTimeout(lpTimer); });

  // Delete button inside modal
  document.getElementById('record-modal-delete').addEventListener('click', () => {
    if (!editingRecordId) return;
    const state = getState();
    state.records = state.records.filter(r => r.id !== editingRecordId);
    editingRecordId = null;
    saveState();
    closeAmountModal();
    renderRecords();
    renderBookSummary();
    showToast('已删除');
  });

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
