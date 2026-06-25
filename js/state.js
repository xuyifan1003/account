/* ===== Categories & Default Assets ===== */
export const CATEGORIES = [
  { id:'food', name:'餐饮', icon:'🍜', type:'expense' },
  { id:'transport', name:'交通', icon:'🚗', type:'expense' },
  { id:'shopping', name:'购物', icon:'🛍️', type:'expense' },
  { id:'entertainment', name:'娱乐', icon:'🎮', type:'expense' },
  { id:'daily', name:'日用', icon:'🏠', type:'expense' },
  { id:'communication', name:'通讯', icon:'📱', type:'expense' },
  { id:'medical', name:'医疗', icon:'💊', type:'expense' },
  { id:'education', name:'教育', icon:'📚', type:'expense' },
  { id:'salary', name:'工资', icon:'💰', type:'income' },
  { id:'other', name:'其他', icon:'📌', type:'expense' },
];

const DEFAULT_ASSETS = [
  { id:'asset-wx', name:'微信', icon:'💬', iconClass:'wx', balance:0, sort:0 },
  { id:'asset-alipay', name:'支付宝', icon:'🔵', iconClass:'alipay', balance:0, sort:1 },
  { id:'asset-cash', name:'现金', icon:'💵', iconClass:'cash', balance:0, sort:2 },
  { id:'asset-card', name:'银行卡', icon:'💳', iconClass:'card', balance:0, sort:3 },
];

/* ===== State Management ===== */
let state = null;

export function initState() {
  try {
    const raw = localStorage.getItem('money_state');
    if (raw) {
      state = JSON.parse(raw);
      if (!state.records) state.records = [];
      if (!state.assets || state.assets.length === 0) {
        state.assets = JSON.parse(JSON.stringify(DEFAULT_ASSETS));
      }
      return;
    }
  } catch(e) {}
  state = { records: [], assets: JSON.parse(JSON.stringify(DEFAULT_ASSETS)) };
}

export function getState() {
  if (!state) initState();
  return state;
}

export function saveState() {
  localStorage.setItem('money_state', JSON.stringify(state));
}

/* ===== Category Lookup ===== */
export function getCategory(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}
