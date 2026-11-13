import { RANKS, SUITS, createCard, createJoker } from './cards.js';

/** 52 standard cards + 2 Jokers = 54 unique cards. */
export function createDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(createCard(r, s));
  deck.push(createJoker('red'), createJoker('black'));
  return deck;
}
