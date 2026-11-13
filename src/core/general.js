import { RANKS, isJoker } from './cards.js';

/** Ranks for which the hand holds all four real cards. */
export function fourOfKindRanks(hand) {
  const count = {};
  for (const c of hand) if (!isJoker(c)) count[c.rank] = (count[c.rank] || 0) + 1;
  return RANKS.filter((r) => count[r] === 4);
}
export const isJokerSingle = (combo) => !!combo && combo.type === 'single' && combo.joker === true;

/**
 * Who gets the chance to declare JENDERAL after a Joker single?
 * activeOrder = active players in turn order, starting after the Joker player.
 * Configurable via rules.jenderal.eligibility (see rules.js, uncertainty #5).
 */
export function jenderalCandidates({ hands, activeOrder, rules }) {
  const pool = rules.jenderal.eligibility === 'nextPlayerOnly' ? activeOrder.slice(0, 1) : activeOrder;
  return pool.filter((p) => hands[p].length > 0 && fourOfKindRanks(hands[p]).length > 0);
}
