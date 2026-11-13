import { isJoker, cardColor, SUIT_SYMBOL } from '../core/cards.js';

const SUIT_NAME = { C: 'keriting', D: 'wajik', H: 'hati', S: 'sekop' };

/** Build a card element with textContent only (no HTML injection). */
export function cardEl(card, extra = '') {
  const el = document.createElement('div');
  el.className = 'card ' + (cardColor(card) === 'red' ? 'red ' : '') + (isJoker(card) ? 'joker ' : '') + extra;
  el.dataset.id = card.id;
  const top = document.createElement('span');
  const bottom = document.createElement('span');
  if (isJoker(card)) {
    top.className = 'rk'; top.textContent = 'JOKER';
    bottom.className = 'st'; bottom.textContent = '★';
    el.setAttribute('aria-label', 'Joker ' + (card.joker === 'red' ? 'merah' : 'hitam'));
  } else {
    top.className = 'rk'; top.textContent = card.rank;
    bottom.className = 'st'; bottom.textContent = SUIT_SYMBOL[card.suit];
    el.setAttribute('aria-label', card.rank + ' ' + SUIT_NAME[card.suit]);
  }
  el.append(top, bottom);
  return el;
}
export function backEl() { const d = document.createElement('span'); d.className = 'back'; return d; }
