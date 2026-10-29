import { initState, initStateFromCache, syncPendingOps, hasCachedState } from './state.js';
import { initTabs } from './tabs.js';
import { initBook, renderRecords, renderBookSummary } from './book.js';
import { initAssets, renderAssets } from './assets.js';
import { initReport } from './report.js';
import { showToast } from './utils.js';

/* ===== Refresh ===== */
let _refreshing = false;
let _needsRefresh = false;

function rerender() {
  renderBookSummary();
  renderRecords();
  renderAssets();
}

async function tryRefresh() {
  if (_refreshing || !navigator.onLine) return false;
  _refreshing = true;
  try {
    await initState();
    rerender();
    _needsRefresh = false;
    return true;
  } catch (e) {
    // 有缓存时静默：界面显示的是本地数据，刷新失败不影响使用
    _needsRefresh = true;
    return false;
  } finally {
    _refreshing = false;
  }
}

/* ===== App Entry ===== */
async function init() {
  initTabs();
  initBook();
  initAssets();
  initReport();

  // 无论在线离线，先用缓存初始化（修复离线冷启动显示空列表的问题）
  initStateFromCache();
  renderBookSummary();
  renderRecords({ animateAll: true });
  renderAssets();

  if (navigator.onLine) {
    const ok = await tryRefresh();
    if (!ok) {
      if (!hasCachedState()) showToast('网络错误，请检查网络连接');
      else console.warn('启动刷新失败，3 秒后自动重试');
      setTimeout(() => tryRefresh(), 3000);
    }
  } else {
    if (!hasCachedState()) showToast('网络错误，请检查网络连接');
    else console.warn('当前离线，显示本地数据');
  }

  // 网络恢复时补同步离线队列 + 补拉数据
  window.addEventListener('online', () => {
    syncPendingOps();
    if (_needsRefresh) tryRefresh();
  });
  // 回到前台时，若此前有未完成的刷新则补拉
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && _needsRefresh) tryRefresh();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
