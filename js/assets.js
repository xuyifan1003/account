import { getState, saveState } from './state.js';
import { formatMoney, showToast } from './utils.js';

let editingAssetId = null;

/* ===== Render Assets Header ===== */
export function renderAssetsHeader() {
  const state = getState();
  const total = state.assets.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  document.getElementById('header').querySelector('h1').textContent = '总资产';
  document.getElementById('header-expense').textContent = `¥${formatMoney(total)}`;
  document.getElementById('header-expense').classList.remove('hidden');
}

/* ===== Render Assets ===== */
export function renderAssets() {
  const container = document.getElementById('assets-list');
  const state = getState();
  const sorted = [...state.assets].sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0));
  const total = sorted.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  document.getElementById('total-assets').textContent = formatMoney(total);

  container.innerHTML = sorted.map(a => `
    <div class="asset-item" data-id="${a.id}">
      <div class="asset-icon ${a.iconClass || 'default'}">${a.icon || '🏦'}</div>
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

/* ===== Asset Modal ===== */
function openAssetModal(id) {
  editingAssetId = id;
  const asset = getState().assets.find(a => a.id === id);
  if (!asset) return;
  document.getElementById('asset-modal-title').textContent = '编辑资产';
  document.getElementById('asset-name-display').innerHTML = `${asset.icon || '🏦'} ${asset.name}`;
  document.getElementById('asset-balance').value = asset.balance;
  document.getElementById('asset-modal').classList.remove('hidden');
}

function closeAssetModal() {
  document.getElementById('asset-modal').classList.add('hidden');
}

function saveAsset() {
  const balance = parseFloat(document.getElementById('asset-balance').value) || 0;
  const state = getState();
  const asset = state.assets.find(a => a.id === editingAssetId);
  if (asset) {
    asset.balance = balance;
    saveState();
    closeAssetModal();
    renderAssets();
    renderAssetsHeader();
    showToast(`✓ ${asset.name} ¥${formatMoney(balance)}`);
  }
}

/* ===== Init ===== */
export function initAssets() {
  renderAssets();

  document.getElementById('asset-close').addEventListener('click', closeAssetModal);
  document.querySelector('#asset-modal .modal-overlay').addEventListener('click', closeAssetModal);
  document.getElementById('asset-save').addEventListener('click', saveAsset);
}
