import { renderReport } from './report.js';
import { renderAssets } from './assets.js';

const titles = { book:'极简记账', assets:'资产', report:'报表' };

export function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tabName)
  );
  document.querySelectorAll('.page').forEach(p =>
    p.classList.toggle('active', p.id === `page-${tabName}`)
  );

  const h1 = document.getElementById('header').querySelector('h1');
  h1.textContent = titles[tabName] || '极简记账';

  if (tabName === 'report') renderReport();
  if (tabName === 'assets') renderAssets();
}

export function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}
