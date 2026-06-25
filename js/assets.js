import { getState, saveState } from './state.js';
import { formatMoney, genId, showToast } from './utils.js';

let editingAssetId = null;

/* ===== Render Assets ===== */
export function renderAssets() {
  const container = document.getElementById('assets-list');
  const state = getState();
  const total = state.assets.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  document.getElementById('total-assets').textContent = formatMoney(total);

  container.innerHTML = state.assets.map(a => `
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
  if (!name) { showToast('请输入资产名称'); return; }

  const state = getState();
  if (editingAssetId) {
    const asset = state.assets.find(a => a.id === editingAssetId);
    if (asset) { asset.name = name; asset.balance = balance; }
  } else {
    state.assets.push({
      id: 'asset-' + genId(),
      name, icon: '🏦', iconClass: 'default',
      balance, sort: state.assets.length,
    });
  }
  saveState();
  closeAssetModal();
  renderAssets();
}

function deleteAsset() {
  if (!editingAssetId) return;
  if (!confirm('确定删除此资产？')) return;
  const state = getState();
  state.assets = state.assets.filter(a => a.id !== editingAssetId);
  saveState();
  closeAssetModal();
  renderAssets();
}

/* ===== Init ===== */
export function initAssets() {
  renderAssets();

  document.getElementById('btn-add-asset').addEventListener('click', openAddAssetModal);
  document.getElementById('asset-close').addEventListener('click', closeAssetModal);
  document.querySelector('#asset-modal .modal-overlay').addEventListener('click', closeAssetModal);
  document.getElementById('asset-save').addEventListener('click', saveAsset);
  document.getElementById('asset-delete').addEventListener('click', deleteAsset);
}
