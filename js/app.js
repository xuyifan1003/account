import { initState, syncPendingOps } from './state.js';
import { initTabs } from './tabs.js';
import { initBook, renderRecords, renderBookSummary } from './book.js';
import { initAssets, renderAssets } from './assets.js';
import { initReport } from './report.js';
import { showToast } from './utils.js';

/* ===== App Entry ===== */
async function init() {
  initTabs();
  initBook();
  initAssets();
  initReport();

  if (navigator.onLine) {
    const remotePromise = initState();

    renderBookSummary();
    renderRecords({ animateAll: true });
    renderAssets();

    try {
      await remotePromise;
      renderBookSummary();
      renderRecords();
      renderAssets();
    } catch (e) {
      showToast('网络错误，请检查网络连接');
    }
  } else {
    renderBookSummary();
    renderRecords({ animateAll: true });
    renderAssets();
    showToast('网络错误，请检查网络连接');
  }

  // 网络恢复时补同步离线期间的删除/修改
  window.addEventListener('online', syncPendingOps);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
