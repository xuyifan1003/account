/* 行情页：纳指100 / 黄金9999 两个品种共用一套引擎，页内顶部切换
   每个品种各自持有数据、窗口与图表实例，切回来保持上次的区间 */
import { createQuote } from './quote.js';
import { haptic } from './utils.js';

const ACTIVE_KEY = 'quote-active-v1';

const VARIANTS = {
  ndx: {
    secid: '100.NDX100',
    cacheKey: 'nasdaq-kline-v1',     // 沿用旧缓存键，升级后首屏无需重新拉取
    unit: '点',
    lineColor: '#e13e3e',
    areaColors: ['rgba(225,62,62,.16)', 'rgba(225,62,62,.02)'],
  },
  gold: {
    secid: '118.AU9999',
    cacheKey: 'gold-kline-v1',
    unit: '元/克',
    lineColor: '#C8942B',
    areaColors: ['rgba(200,148,43,.20)', 'rgba(200,148,43,.02)'],
  },
};

let current = 'ndx';
const instances = {};

function panels() {
  return Array.from(document.querySelectorAll('#page-quote .quote-panel'));
}

function syncSwitch() {
  document.querySelectorAll('#page-quote .qs-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.q === current);
  });
  panels().forEach(p => p.classList.toggle('active', p.dataset.q === current));
}

function select(key, silent) {
  if (!VARIANTS[key] || key === current) return;
  current = key;
  if (!silent) haptic();
  try { localStorage.setItem(ACTIVE_KEY, key); } catch (e) {}
  syncSwitch();
  if (instances[key]) instances[key].show();
}

export function initQuotes() {
  panels().forEach(p => {
    const cfg = VARIANTS[p.dataset.q];
    if (!cfg) return;
    const inst = createQuote({ ...cfg, root: p });
    instances[p.dataset.q] = inst;
    inst.init();
  });

  // 还原上次停留的品种
  let saved = null;
  try { saved = localStorage.getItem(ACTIVE_KEY); } catch (e) {}
  if (saved && VARIANTS[saved] && saved !== 'ndx') select(saved, true);
  else syncSwitch();

  document.querySelectorAll('#page-quote .qs-btn').forEach(b => {
    b.addEventListener('click', () => select(b.dataset.q));
  });
}

export function showQuotes() {
  const inst = instances[current];
  if (inst) inst.show();
}
