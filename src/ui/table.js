import { cardEl } from './cards.js';
import { TYPE_LABEL } from '../core/combinations.js';

// Direction cards fly in from, per seat (0 = you at the bottom).
const FROM = ['0px,110px', '-110px,0px', '0px,-110px', '110px,0px'];

export function renderCenter(labelEl, cardsEl, view, animate) {
  cardsEl.replaceChildren();
  if (!view.table) {
    labelEl.textContent = view.phase === 'over' ? '' : view.firstMove ? 'Mulai dengan 3♣ tunggal' : 'Meja kosong — pemimpin bebas memilih kombinasi';
    return;
  }
  const { player, combo } = view.table;
  const label = TYPE_LABEL[combo.type] + (combo.tekor ? ' (tekor Joker)' : '') + (combo.type === 'tangga' ? ' ×' + combo.size : '');
  labelEl.textContent = view.names[player] + ': ' + label;
  combo.cards.forEach((c, i) => {
    const el = cardEl(c, animate ? 'fly' : '');
    if (animate) { el.style.setProperty('--from', FROM[player]); el.style.setProperty('--i', i); }
    cardsEl.appendChild(el);
  });
  // Overlap cards so long ladders always fit the table centre.
  const W = cardsEl.firstChild.offsetWidth || 38, avail = cardsEl.clientWidth || 200, n = combo.cards.length;
  const step = n > 1 ? Math.min(W - 14, (avail - W) / (n - 1)) : 0;
  [...cardsEl.children].forEach((el, i) => { if (i > 0) el.style.marginLeft = (step - W) + 'px'; });
}
