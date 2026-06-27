import { initState } from './state.js';
import { initTabs } from './tabs.js';
import { initBook, renderRecords, renderBookSummary } from './book.js';
import { initAssets, renderAssets } from './assets.js';
import { initReport } from './report.js';

/* ===== App Entry ===== */
async function init() {
  initTabs();
  initBook();
  initAssets();
  initReport();

  await initState();
  renderBookSummary();
  renderRecords();
  renderAssets();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
