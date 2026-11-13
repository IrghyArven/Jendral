import { isJoker, rankValue } from '../core/cards.js';
import { classify, beats } from '../core/combinations.js';
import { createDeck } from '../core/deck.js';

const ALL_CARDS = createDeck();
export const comboValue = (c) => Math.min(c.value, 14);
export const hasJoker = (c) => c.cards.some(isJoker);

export function rankCounts(cards) {
  const m = {};
  for (const c of cards) if (!isJoker(c)) m[c.rank] = (m[c.rank] || 0) + 1;
  return m;
}
/** Cost of splitting existing pairs/tris/four-of-a-kind in hand by playing this combo. */
export function breakPenalty(combo, hand) {
  const total = rankCounts(hand);
  const used = rankCounts(combo.cards);
  let p = 0;
  for (const r of Object.keys(used)) {
    const left = total[r] - used[r];
    if (left <= 0) continue;
    p += total[r] === 4 ? 5 : total[r] === 3 ? 4 : 2.5;
  }
  return p;
}
/** Opponent card counts (public info), excluding finished players. */
export function opponentCounts(view) {
  return view.handCounts.filter((n, i) => i !== view.player && n > 0);
}
/**
 * How many cards that could still beat this single are neither in my hand nor played (public + own info only).
 * Mirrors beats(): same suit + higher rank, or a Joker of the same colour as the card (suit lock).
 */
export function unseenBeaters(view, combo) {
  if (combo.type !== 'single' || combo.joker) return 0;
  const seen = new Set([...view.hand, ...view.playedCards].map((c) => c.id));
  return ALL_CARDS.filter((c) => !seen.has(c.id) && beats(combo, classify([c]))).length;
}
export function argmin(items, score) {
  let best = null, bs = Infinity;
  for (const it of items) { const s = score(it); if (s < bs) { bs = s; best = it; } }
  return best;
}
export { rankValue };
