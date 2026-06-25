import { initState } from './state.js';
import { initTabs } from './tabs.js';
import { initBook, renderBookSummary } from './book.js';
import { initAssets } from './assets.js';
import { initReport } from './report.js';

/* ===== App Entry ===== */
function init() {
  // Load data
  initState();

  // Init modules
  initTabs();
  initBook();
  initAssets();
  initReport();

  // Render book summary card
  renderBookSummary();

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
