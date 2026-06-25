import { getDb } from './db.js';

/* ===== Categories & Default Assets ===== */
export const CATEGORIES = [
  { id:'food', name:'餐饮', icon:'🍜', type:'expense' },
  { id:'daily', name:'日用', icon:'🧴', type:'expense' },
  { id:'transport', name:'交通', icon:'🚗', type:'expense' },
  { id:'clothing', name:'服饰', icon:'👗', type:'expense' },
  { id:'entertainment', name:'娱乐', icon:'🎮', type:'expense' },
  { id:'communication', name:'通讯', icon:'📱', type:'expense' },
  { id:'digital', name:'数码', icon:'💻', type:'expense' },
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

/* ===== State Management ===== */
let state = null;

function mapAssetFromDb(a) {
  return { id: a.id, name: a.name, icon: a.icon, iconClass: a.icon_class, balance: a.balance, sort: a.sort };
}

function mapAssetToDb(a) {
  return { id: a.id, name: a.name, icon: a.icon, icon_class: a.iconClass, balance: a.balance, sort: a.sort };
}

export async function initState() {
  try {
    const db = await getDb();
    const [recordsRes, assetsRes] = await Promise.all([
      db.from('records').select('*').order('date', { ascending: false }).order('time', { ascending: false }),
      db.from('assets').select('*').order('sort', { ascending: true }),
    ]);

    if (!recordsRes.error && !assetsRes.error) {
      const records = recordsRes.data || [];
      const assets = (assetsRes.data || []).map(mapAssetFromDb);

      if (assets.length === 0) {
        state = { records, assets: JSON.parse(JSON.stringify(DEFAULT_ASSETS)) };
        db.from('assets').upsert(state.assets.map(mapAssetToDb), { onConflict: 'id' }).catch(() => {});
      } else {
        state = { records, assets };
      }
      return;
    }
  } catch(e) {}

  state = { records: [], assets: JSON.parse(JSON.stringify(DEFAULT_ASSETS)) };
}

export function getState() {
  if (!state) {
    state = { records: [], assets: JSON.parse(JSON.stringify(DEFAULT_ASSETS)) };
  }
  return state;
}

export function saveState() {
  getDb().then(db => {
    db.from('records').upsert(state.records, { onConflict: 'id' }).catch(() => {});
    db.from('assets').upsert(state.assets.map(mapAssetToDb), { onConflict: 'id' }).catch(() => {});
  }).catch(() => {});
}

/* ===== Category Lookup ===== */
export function getCategory(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}
