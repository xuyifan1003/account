import { renderReport } from './report.js';
import { renderAssets } from './assets.js';

export function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tabName)
  );
  document.querySelectorAll('.page').forEach(p =>
    p.classList.toggle('active', p.id === `page-${tabName}`)
  );

  if (tabName === 'report') renderReport();
  if (tabName === 'assets') renderAssets();
}

export function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}
