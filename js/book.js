import { CATEGORIES, getState, saveState, getCategory } from './state.js';
import { getToday, getNow, formatMoney, genId, showToast, shakeElement, haptic } from './utils.js';
import { api } from './db.js';

/* ===== Modal State ===== */
let selectedCategory = null;
let deletingId = null;
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
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthRecords = getState().records.filter(r => r.date.startsWith(monthPrefix));

  if (monthRecords.length === 0) {
    container.innerHTML = '<div class="empty-tip">当月还没有记录<br>点击上方分类开始记账</div>';
    return;
  }

  monthRecords.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  const todayStr = getToday();
  const groups = new Map();
  monthRecords.forEach(r => {
    if (!groups.has(r.date)) groups.set(r.date, []);
    groups.get(r.date).push(r);
  });

  let html = '';
  let itemIndex = 0;
  groups.forEach((records, date) => {
    const label = date === todayStr ? '今天' : date.slice(5);
    html += `<div class="date-divider">${label}</div>`;
    records.forEach(r => {
      const cat = getCategory(r.category);
      html += `
        <div class="record-item" data-id="${r.id}" style="animation-delay:${itemIndex * 0.03}s">
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
      itemIndex++;
    });
  });
  container.innerHTML = html;
}

/* ===== Amount Modal ===== */
function openAmountModal(catId) {
  const cat = getCategory(catId);
  document.getElementById('modal-category-name').textContent = cat.icon + ' ' + cat.name;
  document.getElementById('amount-value').textContent = '0';
  document.getElementById('input-note').value = '';
  const modal = document.getElementById('amount-modal');
  modal.querySelector('.modal-overlay').classList.remove('closing');
  modal.querySelector('.modal-content').classList.remove('closing');
  modal.classList.remove('hidden');
  document.documentElement.style.overscrollBehaviorX = 'contain';
  history.pushState({ modal: true }, '');
  modalAmount = '0';
  modalHasDecimal = false;
  modalDecimalDigits = 0;
}

function _closeModalWithAnim(modalEl) {
  if (modalEl.classList.contains('hidden')) return;
  const overlay = modalEl.querySelector('.modal-overlay');
  const content = modalEl.querySelector('.modal-content');
  if (content.classList.contains('closing')) return;
  overlay.classList.add('closing');
  content.classList.add('closing');
  content.addEventListener('animationend', () => {
    modalEl.classList.add('hidden');
    overlay.classList.remove('closing');
    content.classList.remove('closing');
    document.documentElement.style.overscrollBehaviorX = '';
  }, { once: true });
}

function closeAmountModal() {
  _closeModalWithAnim(document.getElementById('amount-modal'));
  if (history.state?.modal) history.back();
}

/* ===== Numpad ===== */
function handleNumpad(key) {
  haptic();
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

  // Long press on record items → delete
  let lpTimer = null;
  let lpItem = null;
  const list = document.getElementById('records-list');

  function clearLp() {
    clearTimeout(lpTimer);
    if (lpItem) { lpItem.classList.remove('pressing'); lpItem = null; }
  }

  list.addEventListener('pointerdown', e => {
    clearLp();
    const item = e.target.closest('.record-item');
    if (!item) return;
    const id = item.dataset.id;
    if (!id) return;
    lpItem = item;
    item.classList.add('pressing');
    lpTimer = setTimeout(() => {
      item.classList.remove('pressing');
      lpItem = null;
      haptic();
      const record = getState().records.find(r => r.id === id);
      if (!record) return;
      deletingId = id;
      const cat = getCategory(record.category);
      document.getElementById('delete-modal-text').textContent =
        `${cat.icon} ${cat.name}  ¥${formatMoney(record.amount)}`;
      document.getElementById('delete-modal').classList.remove('hidden');
    }, 500);
  });
  list.addEventListener('pointermove', clearLp);
  list.addEventListener('pointerup', clearLp);
  list.addEventListener('pointercancel', clearLp);
  list.addEventListener('pointerleave', clearLp);

  // Delete confirm
  function closeDelete() {
    document.getElementById('delete-modal').classList.add('hidden');
    deletingId = null;
  }
  document.getElementById('delete-confirm').addEventListener('click', () => {
    if (!deletingId) return;
    const state = getState();
    state.records = state.records.filter(r => r.id !== deletingId);
    const id = deletingId;
    deletingId = null;
    saveState();
    api('DELETE', 'records', null, `id=eq.${id}`).catch(e => console.warn('delete failed:', e));
    closeDelete();
    renderRecords();
    renderBookSummary();
    showToast('已删除');
  });
  document.getElementById('delete-cancel').addEventListener('click', closeDelete);
  document.querySelector('#delete-modal .modal-overlay').addEventListener('click', closeDelete);

  // Numpad
  document.querySelectorAll('.numpad button').forEach(btn => {
    if (btn.dataset.key === 'del') {
      let repeatTimer = null;
      const stop = () => clearInterval(repeatTimer);
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        handleNumpad('del');
        repeatTimer = setInterval(() => handleNumpad('del'), 120);
      });
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointerleave', stop);
      btn.addEventListener('pointercancel', stop);
    } else {
      btn.addEventListener('click', () => handleNumpad(btn.dataset.key));
    }
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeAmountModal);
  document.querySelector('#amount-modal .modal-overlay').addEventListener('click', closeAmountModal);
  window.addEventListener('popstate', () => {
    _closeModalWithAnim(document.getElementById('amount-modal'));
  });

  // Auto-refresh on month rollover only
  let _monthKey = null;
  setInterval(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth()}`;
    if (key !== _monthKey) {
      _monthKey = key;
      renderRecords();
      renderBookSummary();
    }
  }, 60000);
}
