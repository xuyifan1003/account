import { renderReport } from './report.js';
import { resetAssetsVisibility } from './assets.js';
import { haptic } from './utils.js';

let currentTab = 'book';

export function switchTab(tabName) {
  if (tabName === currentTab) return;
  currentTab = tabName;
  haptic();
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tabName)
  );
  document.querySelectorAll('.page').forEach(p =>
    p.classList.toggle('active', p.id === `page-${tabName}`)
  );

  if (tabName === 'report') renderReport();
  if (tabName === 'assets') resetAssetsVisibility();
}

export function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}
