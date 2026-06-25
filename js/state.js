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
