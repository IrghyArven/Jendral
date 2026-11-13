const fx = () => document.getElementById('fx');

export function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = text;
  fx().appendChild(t);
  setTimeout(() => t.remove(), 1400);
}
export function jenderalEffect(name) {
  const root = fx();
  const flash = document.createElement('div'); flash.className = 'fx-flash';
  const txt = document.createElement('div'); txt.className = 'fx-jenderal'; txt.dataset.testid = 'fx-jenderal';
  txt.append('JENDERAL!', document.createElement('br'));
  const s = document.createElement('small'); s.textContent = name;
  txt.appendChild(s);
  root.append(flash, txt);
  document.querySelector('.table')?.classList.add('shake');
  if (navigator.vibrate) { try { navigator.vibrate([80, 40, 160]); } catch { /* ignore */ } }
  setTimeout(() => { flash.remove(); txt.remove(); document.querySelector('.table')?.classList.remove('shake'); }, 2300);
}
/** Lightweight confetti (DOM + CSS only). Skipped by CSS when animation is off. */
export function confetti(host, count = 36) {
  const colors = ['#f2c14e', '#e85d5d', '#5ec8a3', '#6aa8ff', '#fff'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    p.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${(Math.random() * 0.8).toFixed(2)}s;--dx:${Math.round(Math.random() * 120 - 60)}px`;
    host.appendChild(p);
  }
  setTimeout(() => host.querySelectorAll('.confetti').forEach((e) => e.remove()), 4200);
}
