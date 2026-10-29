import { api } from './db.js';
import { showToast, getToday } from './utils.js';

/* ===== Categories & Default Assets ===== */
export const CATEGORIES = [
  { id:'food', name:'餐饮', icon:'🍜', type:'expense' },
  { id:'daily', name:'日用', icon:'🧴', type:'expense' },
  { id:'transport', name:'交通', icon:'🚗', type:'expense' },
  { id:'clothing', name:'服饰', icon:'👗', type:'expense' },
  { id:'entertainment', name:'娱乐', icon:'🎮', type:'expense' },

  { id:'medical', name:'医疗', icon:'💊', type:'expense' },
  { id:'housing', name:'住房', icon:'🏡', type:'expense' },
  { id:'study', name:'学习', icon:'📝', type:'expense' },
  { id:'social', name:'人情', icon:'🤝', type:'expense' },
];

const DEFAULT_ASSETS = [
  { id:'asset-wx', name:'微信', icon:'💬', iconClass:'wx', balance:0, sort:0 },
  { id:'asset-alipay', name:'支付宝', icon:'🔵', iconClass:'alipay', balance:0, sort:1 },
  { id:'asset-icbc', name:'工商银行', icon:'🏦', iconClass:'icbc', balance:0, sort:2 },
  { id:'asset-boc', name:'中国银行', icon:'🏦', iconClass:'boc', balance:0, sort:3 },
  { id:'asset-nfjj', name:'南方基金', icon:'📈', iconClass:'nfjj', balance:0, sort:4 },
  { id:'asset-zfbjj', name:'支付宝基金', icon:'📊', iconClass:'zfbjj', balance:0, sort:5 },
  { id:'asset-gold', name:'黄金', icon:'🥇', iconClass:'gold', balance:0, sort:6 },
];

/* ===== Pending Ops (offline delete/update queue) ===== */
const PENDING_KEY = 'money-book-pending-ops';

function loadPendingOps() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (data && Array.isArray(data.deletes) && Array.isArray(data.updates)) return data;
  } catch (e) { /* ignore */ }
  return { deletes: [], updates: [] };
}

function savePendingOps(p) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
  // 通知 UI 更新同步状态灯
  window.dispatchEvent(new Event('money-sync-status'));
}

export function getSyncStatus() {
  const p = loadPendingOps();
  return { online: navigator.onLine, pending: p.deletes.length + p.updates.length };
}

function removePending(kind, id) {
  const p = loadPendingOps();
  p[kind] = p[kind].filter(x => x !== id);
  savePendingOps(p);
}

let _syncing = false;

export function syncPendingOps() {
  if (_syncing || !navigator.onLine) return;
  const pending = loadPendingOps();
  if (!pending.deletes.length && !pending.updates.length) return;

  const state = getState();
  // 更新队列里已不存在的记录（后来被删了）直接出队
  pending.updates = pending.updates.filter(id => state.records.some(r => r.id === id));
  savePendingOps(pending);
  if (!pending.deletes.length && !pending.updates.length) return;

  _syncing = true;
  const tasks = pending.deletes.map(id =>
    api('DELETE', 'records', null, `id=eq.${id}`)
      .then(() => removePending('deletes', id))
      .catch(() => {})
  );
  const updRecords = state.records.filter(r => pending.updates.includes(r.id)).map(normalizeRecord);
  if (updRecords.length) {
    tasks.push(
      api('POST', 'records', updRecords, 'on_conflict=id')
        .then(() => pending.updates.forEach(id => removePending('updates', id)))
        .catch(() => {})
    );
  }
  Promise.all(tasks).catch(() => {}).finally(() => {
    _syncing = false;
    window.dispatchEvent(new Event('money-sync-status'));
  });
}

export function deleteRecordLocally(id) {
  const state = getState();
  state.records = state.records.filter(r => r.id !== id);
  const p = loadPendingOps();
  if (!p.deletes.includes(id)) p.deletes.push(id);
  savePendingOps(p);
  saveCachedState();
  syncPendingOps();
}

export function markRecordUpdated(id) {
  const p = loadPendingOps();
  if (!p.updates.includes(id)) p.updates.push(id);
  savePendingOps(p);
  saveCachedState();
  syncPendingOps();
}

/* ===== Cache ===== */
const STATE_KEY = 'money-book-state-v1';

function loadCachedState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.records && data.assets) {
        state = data;
        return true;
      }
    }
  } catch (e) { /* ignore */ }
  return false;
}

function saveCachedState() {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
  catch (e) { /* ignore */ }
}

/* ===== State Management ===== */
let state = null;

function mapAssetFromDb(a) {
  return { id: a.id, name: a.name, icon: a.icon, iconClass: a.icon_class, balance: a.balance, sort: a.sort };
}

function mapAssetToDb(a) {
  return { id: a.id, name: a.name, icon: a.icon, icon_class: a.iconClass, balance: a.balance, sort: a.sort };
}

export function initState() {
  loadCachedState();

  return (async () => {
    try {
      const [serverRecords, assetsData, snapshots] = await Promise.all([
        api('GET', 'records', null, 'order=date.desc&order=time.desc'),
        api('GET', 'assets', null, 'order=sort.asc'),
        api('GET', 'asset_snapshots', null, 'order=date.asc').catch(() => []),
      ]);

      const assets = assetsData.length ? assetsData.map(mapAssetFromDb)
        : JSON.parse(JSON.stringify(DEFAULT_ASSETS));
      const snap = snapshots.map(s => ({ id: s.id, total_balance: s.total_balance, date: s.date }));

      // 合并本地已有记录，避免覆盖用户在 initState 完成前添加的数据
      // 待删记录从服务端结果中剔除，防止离线删除后复活；待更新记录以本地版本为准
      const pending = loadPendingOps();
      let records = serverRecords.filter(r => !pending.deletes.includes(r.id));
      if (state && state.records.length > 0) {
        const serverIds = new Set(records.map(r => r.id));
        const localOnly = state.records.filter(r => !serverIds.has(r.id));
        records = [...localOnly, ...records];
        if (pending.updates.length) {
          records = records.map(r =>
            pending.updates.includes(r.id)
              ? (state.records.find(l => l.id === r.id) || r)
              : r
          );
        }
      }

      // 迁移旧分类：数码/通讯 → 日用
      records.forEach(r => {
        if (r.category === 'digital' || r.category === 'communication') {
          r.category = 'daily';
        }
      });
      api('PATCH', 'records', { category: 'daily' }, 'category=eq.digital').catch(() => {});
      api('PATCH', 'records', { category: 'daily' }, 'category=eq.communication').catch(() => {});

      state = { records, assets, snapshots: snap };

      if (assetsData.length === 0) {
        api('POST', 'assets', state.assets.map(mapAssetToDb), 'on_conflict=id').catch(() => {});
      }

      saveCachedState();
      syncPendingOps();
    } catch(e) {
      console.warn('Supabase read failed:', e);
      if (!state) state = { records: [], assets: JSON.parse(JSON.stringify(DEFAULT_ASSETS)), snapshots: [] };
      throw e;
    }
  })();
}

export function getState() {
  if (!state) {
    state = { records: [], assets: JSON.parse(JSON.stringify(DEFAULT_ASSETS)), snapshots: [] };
  }
  return state;
}

function normalizeRecord(r) {
  return {
    id: r.id, category: r.category, amount: r.amount,
    note: r.note || '', date: r.date, time: r.time || '', type: r.type,
  };
}

export function saveState() {
  saveCachedState();
  let failed = false;
  const warn = (label, e) => { console.warn(label, e); failed = true; };
  Promise.all([
    api('POST', 'records', state.records.map(normalizeRecord), 'on_conflict=id').catch(e => warn('save records:', e)),
    api('POST', 'assets', state.assets.map(mapAssetToDb), 'on_conflict=id').catch(e => warn('save assets:', e)),
  ]).then(() => {
    if (failed) showToast('同步失败，请检查网络');
  }).catch(() => {});
}

export function saveSnapshot() {
  const today = getToday();
  const total = state.assets.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const snap = { id: today, total_balance: total, date: today };

  const i = state.snapshots.findIndex(s => s.id === today);
  if (i >= 0) {
    state.snapshots[i] = snap;
  } else {
    state.snapshots.push(snap);
  }

  saveCachedState();
  api('POST', 'asset_snapshots', snap, 'on_conflict=id').catch(e => console.warn('save snapshot:', e));
}

/* ===== Category Lookup ===== */
export function getCategory(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}
