import { cardValue, THREE_CLUBS_ID } from './cards.js';

export function sortHand(hand) {
  return hand.slice().sort((a, b) => cardValue(a) - cardValue(b) || a.id.localeCompare(b.id));
}
/** Deal every card round-robin: 54 cards / 4 players => 14, 14, 13, 13. */
export function deal(deck, players = 4) {
  const hands = Array.from({ length: players }, () => []);
  deck.forEach((card, i) => hands[i % players].push(card));
  return hands.map(sortHand);
}
export function findStarter(hands) {
  return hands.findIndex((h) => h.some((c) => c.id === THREE_CLUBS_ID));
}
