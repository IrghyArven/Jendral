import { isJoker, cardColor } from './cards.js';
/** Joker may only beat a single card whose colour matches its own. */
export function jokerCanBeat(joker, prevCard) {
  return isJoker(joker) && !isJoker(prevCard) && cardColor(prevCard) === joker.joker;
}
