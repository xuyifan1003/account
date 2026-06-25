import { initState } from './state.js';
import { getToday } from './utils.js';
import { initTabs } from './tabs.js';
import { initBook } from './book.js';
import { initAssets } from './assets.js';
import { initReport } from './report.js';

/* ===== App Entry ===== */
function init() {
  // Load data
  initState();

  // Display today
  document.getElementById('today-display').textContent = getToday();

  // Init modules
  initTabs();
  initBook();
  initAssets();
  initReport();

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
