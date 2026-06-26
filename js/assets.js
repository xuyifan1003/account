import { getState, saveState } from './state.js';
import { formatMoney, showToast, shakeElement, haptic } from './utils.js';

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
    el.addEventListener('click', () => { haptic(); openAssetModal(el.dataset.id); });
  });
}

/* ===== Asset Modal ===== */
function openAssetModal(id) {
  editingAssetId = id;
  const asset = getState().assets.find(a => a.id === id);
  if (!asset) return;
  document.getElementById('asset-modal-title').textContent = `${asset.icon || '🏦'} ${asset.name}`;
  document.getElementById('asset-amount-value').textContent = '0';
  document.getElementById('asset-modal').classList.remove('hidden');
  assetModalAmount = '0';
  assetModalHasDecimal = false;
  assetModalDecimalDigits = 0;
}

function closeAssetModal() {
  document.getElementById('asset-modal').classList.add('hidden');
}

function updateAssetDisplay() {
  document.getElementById('asset-amount-value').textContent = assetModalAmount;
}

function handleAssetNumpad(key) {
  if (key === 'confirm') {
    haptic();
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

/* ===== Init ===== */
export function initAssets() {
  renderAssets();
  document.querySelector('#page-assets .summary-card').addEventListener('click', toggleAssets);

  document.getElementById('asset-close').addEventListener('click', closeAssetModal);
  document.querySelector('#asset-modal .modal-overlay').addEventListener('click', closeAssetModal);
  document.querySelectorAll('#asset-modal .numpad button').forEach(btn => {
    btn.addEventListener('click', () => handleAssetNumpad(btn.dataset.assetKey));
  });
}
