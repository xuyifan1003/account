import { CATEGORIES, getState, saveState, getCategory, deleteRecordLocally, markRecordUpdated, getSyncStatus } from './state.js';
import { getToday, getNow, formatMoney, genId, showToast, shakeElement, haptic } from './utils.js';

/* ===== Modal State ===== */
let selectedCategory = null;
let editingId = null;
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

/* ===== Records List =====
 * opts.animateAll: 进页面/翻月时整体阶梯入场动画
 * opts.newId: 新增记录后只让新条目做入场动画，其余静默
 */
export function renderRecords(opts = {}) {
  const { animateAll = false, newId = null } = opts;
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
      const enterCls = (animateAll || r.id === newId) ? ' enter' : '';
      const delayStyle = animateAll ? ` style="animation-delay:${Math.min(itemIndex, 8) * 0.03}s"` : '';
      html += `
        <div class="record-item${enterCls}" data-id="${r.id}"${delayStyle}>
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
function _preventEdgeSwipe(e) {
  if (e.touches[0].clientX >= 30) return;
  const modal = document.getElementById('amount-modal');
  if (modal && !modal.classList.contains('hidden')) {
    e.preventDefault();
  }
}

function openAmountModal(catId, recordId = null) {
  const cat = getCategory(catId);
  const record = recordId ? getState().records.find(r => r.id === recordId) : null;
  if (recordId && !record) return;
  editingId = recordId;
  selectedCategory = catId;

  document.getElementById('modal-category-name').textContent = cat.icon + ' ' + cat.name;

  const dateRow = document.getElementById('date-row');
  const delBtn = document.getElementById('edit-delete');
  const dateInput = document.getElementById('edit-date-input');
  if (record) {
    // 编辑模式：预填金额、日期，显示删除入口
    const s = String(record.amount);
    modalAmount = s;
    modalHasDecimal = s.includes('.');
    modalDecimalDigits = modalHasDecimal ? s.split('.')[1].length : 0;
    dateRow.classList.remove('hidden');
    delBtn.classList.remove('hidden');
    dateInput.value = record.date;
    dateInput.max = getToday();
    document.getElementById('edit-date-value').textContent = record.date;
  } else {
    modalAmount = '0';
    modalHasDecimal = false;
    modalDecimalDigits = 0;
    dateRow.classList.add('hidden');
    delBtn.classList.add('hidden');
  }
  updateAmountDisplay();

  const modal = document.getElementById('amount-modal');
  modal.querySelector('.modal-overlay').classList.remove('closing');
  modal.querySelector('.modal-content').classList.remove('closing');
  modal.classList.remove('hidden');
  document.documentElement.style.overscrollBehaviorX = 'none';
  document.documentElement.style.touchAction = 'none';
  document.addEventListener('touchstart', _preventEdgeSwipe, { passive: false, capture: true });
  document.addEventListener('touchmove', _preventEdgeSwipe, { passive: false, capture: true });
  history.pushState({ modal: true }, '');
}

function _cleanupModal(modalEl) {
  modalEl.classList.add('hidden');
  const overlay = modalEl.querySelector('.modal-overlay');
  const content = modalEl.querySelector('.modal-content');
  overlay.classList.remove('closing');
  content.classList.remove('closing');
  document.documentElement.style.overscrollBehaviorX = '';
  document.documentElement.style.touchAction = '';
  document.removeEventListener('touchstart', _preventEdgeSwipe, true);
  document.removeEventListener('touchmove', _preventEdgeSwipe, true);
}

function _closeModalWithAnim(modalEl) {
  if (modalEl.classList.contains('hidden')) return;
  const overlay = modalEl.querySelector('.modal-overlay');
  const content = modalEl.querySelector('.modal-content');
  if (content.classList.contains('closing')) return;
  overlay.classList.add('closing');
  content.classList.add('closing');
  content.addEventListener('animationend', () => {
    _cleanupModal(modalEl);
  }, { once: true });
}

function closeAmountModal(instant = false) {
  const modal = document.getElementById('amount-modal');
  if (instant) _cleanupModal(modal);
  else _closeModalWithAnim(modal);
  editingId = null;
  if (history.state?.modal) history.back();
}

/* ===== Numpad ===== */
function handleNumpad(key) {
  haptic();
  if (key === 'confirm') {
    const val = parseFloat(modalAmount);
    if (isNaN(val) || val <= 0) {
      shakeElement(document.querySelector('.amount-display'));
      return;
    }
    if (!selectedCategory) return;

    const state = getState();

    if (editingId) {
      // 编辑模式：更新金额与日期
      const record = state.records.find(r => r.id === editingId);
      if (!record) return;
      record.amount = val;
      const d = document.getElementById('edit-date-input').value;
      if (d) record.date = d;
      markRecordUpdated(record.id);
      closeAmountModal();
      renderRecords();
      renderBookSummary();
      showToast(`✓ 已修改 ${formatMoney(val)} 元`);
      return;
    }

    const cat = getCategory(selectedCategory);
    const id = genId();
    state.records.unshift({
      id,
      category: selectedCategory,
      amount: val,
      note: '',
      date: getToday(),
      time: getNow(),
      type: cat.type,
    });
    saveState();
    closeAmountModal();
    renderRecords({ newId: id });
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

/* ===== Sync Status Dot ===== */
function renderSyncDot() {
  const dot = document.getElementById('sync-dot');
  if (!dot) return;
  const st = getSyncStatus();
  dot.classList.toggle('pending', !st.online || st.pending > 0);
}

/* ===== Init Book Module ===== */
export function initBook() {
  renderCategories();
  renderRecords({ animateAll: true });

  // Click record item → edit modal (amount / date / delete)
  const list = document.getElementById('records-list');
  list.addEventListener('click', e => {
    const item = e.target.closest('.record-item');
    if (!item) return;
    const id = item.dataset.id;
    const record = getState().records.find(r => r.id === id);
    if (!record) return;
    haptic();
    openAmountModal(record.category, record.id);
  });

  // Edit modal: delete button → instant close, then show confirm modal
  document.getElementById('edit-delete').addEventListener('click', () => {
    if (!editingId) return;
    const record = getState().records.find(r => r.id === editingId);
    if (!record) return;
    const cat = getCategory(record.category);
    deletingId = record.id;
    document.getElementById('delete-modal-text').textContent =
      `${cat.icon} ${cat.name}  ¥${formatMoney(record.amount)}`;
    closeAmountModal(true);
    document.getElementById('delete-modal').classList.remove('hidden');
  });

  // Delete confirm
  function closeDelete() {
    document.getElementById('delete-modal').classList.add('hidden');
    deletingId = null;
  }
  document.getElementById('delete-confirm').addEventListener('click', () => {
    if (!deletingId) return;
    const id = deletingId;
    deletingId = null;
    deleteRecordLocally(id);
    closeDelete();
    renderRecords();
    renderBookSummary();
    showToast('已删除');
  });
  document.getElementById('delete-cancel').addEventListener('click', closeDelete);
  document.querySelector('#delete-modal .modal-overlay').addEventListener('click', closeDelete);

  // Numpad
  document.querySelectorAll('#amount-modal .numpad button').forEach(btn => {
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
  document.getElementById('modal-close').addEventListener('click', () => closeAmountModal());
  document.querySelector('#amount-modal .modal-overlay').addEventListener('click', () => closeAmountModal());
  window.addEventListener('popstate', () => {
    _closeModalWithAnim(document.getElementById('amount-modal'));
  });

  // Sync status dot: tap for detail
  renderSyncDot();
  document.getElementById('sync-dot').addEventListener('click', () => {
    haptic();
    const st = getSyncStatus();
    if (!st.online) showToast(st.pending ? `离线，${st.pending} 条待同步` : '当前离线');
    else if (st.pending) showToast(`${st.pending} 条待同步…`);
    else showToast('✓ 已全部同步');
  });
  window.addEventListener('online', renderSyncDot);
  window.addEventListener('offline', renderSyncDot);
  window.addEventListener('money-sync-status', renderSyncDot);

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
