import { backEl } from './cards.js';

/**
 * Renders an AI seat: name, level/personality badge, card backs + count, and status tags
 * (turn, pass, finishing place, Joker/Jenderal markers).
 */
export function renderSeat(el, { name, count, isTurn, place, passed, badge, tags = [] }) {
  el.replaceChildren();
  el.classList.toggle('turn', !!isTurn);
  el.classList.toggle('done', count === 0);
  el.classList.toggle('passed', !!passed && count > 0);
  const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = name;
  const bd = document.createElement('div'); bd.className = 'badge'; bd.textContent = badge || '';
  const backs = document.createElement('div'); backs.className = 'backs';
  for (let i = 0; i < Math.min(count, 7); i++) backs.appendChild(backEl());
  const ct = document.createElement('div'); ct.className = 'ct';
  ct.textContent = count === 0 ? 'Selesai' : count + ' kartu';
  el.append(nm, bd, backs, ct);
  const all = [];
  if (place) all.push({ text: 'Juara ' + place, kind: 'place' });
  else if (isTurn) all.push({ text: 'berpikir…', kind: 'turn' });
  else if (passed) all.push({ text: 'LEWAT', kind: 'pass' });
  all.push(...tags);
  for (const t of all.slice(0, 2)) { const s = document.createElement('span'); s.className = 'tag ' + (t.kind || ''); s.textContent = t.text; el.appendChild(s); }
}
