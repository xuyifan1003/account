/* ===== Date / Time ===== */
export function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function getNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export function getTodayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

/* ===== Formatting ===== */
export function formatMoney(n) {
  const num = Number(n);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

/* ===== ID Generator ===== */
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

/* ===== Toast ===== */
export function showToast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2000);
}

/* ===== Haptic Feedback ===== */
export function haptic() {
  if (navigator.vibrate) {
    navigator.vibrate(8);
  }
}

/* ===== Shake Animation ===== */
export function shakeElement(el) {
  el.style.animation = 'none';
  el.offsetHeight; // force reflow to restart animation
  el.style.animation = 'shake .3s ease';
}
