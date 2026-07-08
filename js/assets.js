import { getState, saveState, saveSnapshot } from './state.js';
import { formatMoney, showToast, shakeElement, haptic } from './utils.js';
import { renderAssetChart } from './chart.js';

let editingAssetId = null;
let assetsVisible = false;
let assetModalAmount = '0';
let assetModalHasDecimal = false;
let assetModalDecimalDigits = 0;

/* ===== Render Assets ===== */
export function renderAssets() {
  const container = document.getElementById('assets-list');
  const state = getState();
  const sorted = [...state.assets].sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0));
  const total = sorted.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  document.getElementById('total-assets').textContent = assetsVisible ? formatMoney(total) : '••••';

  container.innerHTML = sorted.map(a => `
    <div class="asset-item" data-id="${a.id}">
      <div class="asset-icon ${a.iconClass || 'default'}">${a.icon || '🏦'}</div>
      <div class="asset-info">
        <div class="asset-name">${a.name}</div>
      </div>
      <div class="asset-balance">${assetsVisible ? '¥' + formatMoney(a.balance) : '••••'}</div>
    </div>
  `).join('');

  container.querySelectorAll('.asset-item').forEach(el => {
    el.addEventListener('click', () => {
      haptic();
      if (!assetsVisible) { toggleAssets(); return; }
      openAssetModal(el.dataset.id);
    });
  });
  renderAssetChart();
}

/* ===== Asset Modal ===== */
function openAssetModal(id) {
  editingAssetId = id;
  const asset = getState().assets.find(a => a.id === id);
  if (!asset) return;
  document.getElementById('asset-modal-title').textContent = `${asset.icon || '🏦'} ${asset.name}`;
  document.getElementById('asset-amount-value').textContent = '0';
  const modal = document.getElementById('asset-modal');
  modal.querySelector('.modal-overlay').classList.remove('closing');
  modal.querySelector('.modal-content').classList.remove('closing');
  modal.classList.remove('hidden');
  document.documentElement.style.overscrollBehaviorX = 'contain';
  history.pushState({ modal: true }, '');
  assetModalAmount = '0';
  assetModalHasDecimal = false;
  assetModalDecimalDigits = 0;
}

function _closeAssetModalWithAnim() {
  const modal = document.getElementById('asset-modal');
  if (modal.classList.contains('hidden')) return;
  const overlay = modal.querySelector('.modal-overlay');
  const content = modal.querySelector('.modal-content');
  if (content.classList.contains('closing')) return;
  overlay.classList.add('closing');
  content.classList.add('closing');
  content.addEventListener('animationend', () => {
    modal.classList.add('hidden');
    overlay.classList.remove('closing');
    content.classList.remove('closing');
    document.documentElement.style.overscrollBehaviorX = '';
  }, { once: true });
}

function closeAssetModal() {
  _closeAssetModalWithAnim();
  if (history.state?.modal) history.back();
}

function updateAssetDisplay() {
  document.getElementById('asset-amount-value').textContent = assetModalAmount;
}

function handleAssetNumpad(key) {
  haptic();
  if (key === 'confirm') {
    const val = parseFloat(assetModalAmount);
    if (val <= 0) {
      shakeElement(document.querySelector('#asset-modal .amount-display'));
      return;
    }
    const state = getState();
    const asset = state.assets.find(a => a.id === editingAssetId);
    if (!asset) return;
    asset.balance = val;
    saveState();
    saveSnapshot();
    closeAssetModal();
    renderAssets();
    showToast(`✓ ${asset.name} ¥${formatMoney(val)}`);
    return;
  }

  if (key === 'del') {
    if (assetModalAmount.length <= 1) {
      assetModalAmount = '0';
      assetModalHasDecimal = false;
      assetModalDecimalDigits = 0;
    } else {
      if (assetModalHasDecimal) {
        assetModalDecimalDigits--;
        if (assetModalDecimalDigits <= 0) { assetModalHasDecimal = false; assetModalDecimalDigits = 0; }
      }
      assetModalAmount = assetModalAmount.slice(0, -1);
    }
    updateAssetDisplay();
    return;
  }

  if (key === '.') {
    if (!assetModalHasDecimal) {
      assetModalHasDecimal = true;
      assetModalDecimalDigits = 0;
      assetModalAmount += '.';
    }
    updateAssetDisplay();
    return;
  }

  // Number key
  if (assetModalHasDecimal) {
    if (assetModalDecimalDigits >= 2) return;
    assetModalDecimalDigits++;
    assetModalAmount += key;
  } else {
    if (assetModalAmount === '0') {
      assetModalAmount = key;
    } else {
      if (assetModalAmount.length >= 10) return;
      assetModalAmount += key;
    }
  }
  updateAssetDisplay();
}

/* ===== Toggle Visibility ===== */
function toggleAssets() {
  haptic();
  assetsVisible = !assetsVisible;
  renderAssets();
}

/* ===== Reset Visibility ===== */
export function resetAssetsVisibility() {
  assetsVisible = false;
  renderAssets();
}

/* ===== Init ===== */
export function initAssets() {
  renderAssets();
  document.querySelector('#page-assets .summary-card').addEventListener('click', toggleAssets);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && document.getElementById('page-assets').classList.contains('active')) {
      resetAssetsVisibility();
    }
  });

  document.getElementById('asset-close').addEventListener('click', closeAssetModal);
  document.querySelector('#asset-modal .modal-overlay').addEventListener('click', closeAssetModal);
  window.addEventListener('popstate', () => {
    _closeAssetModalWithAnim();
  });
  document.querySelectorAll('#asset-modal .numpad button').forEach(btn => {
    if (btn.dataset.assetKey === 'del') {
      let repeatTimer = null;
      const stop = () => clearInterval(repeatTimer);
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        handleAssetNumpad('del');
        repeatTimer = setInterval(() => handleAssetNumpad('del'), 120);
      });
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointerleave', stop);
      btn.addEventListener('pointercancel', stop);
    } else {
      btn.addEventListener('click', () => handleAssetNumpad(btn.dataset.assetKey));
    }
  });
}
