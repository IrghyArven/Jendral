// Card primitives. Rank order (low -> high): 3 4 5 6 7 8 9 10 J Q K A 2
export const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
export const SUITS = ['C', 'D', 'H', 'S']; // clubs, diamonds, hearts, spades
export const SUIT_SYMBOL = Object.freeze({ C: '♣', D: '♦', H: '♥', S: '♠' });
export const THREE_CLUBS_ID = '3C';
export const JOKER_VALUE = 99;

export const rankValue = (rank) => RANKS.indexOf(rank);
export const suitColor = (suit) => (suit === 'D' || suit === 'H' ? 'red' : 'black');

export function createCard(rank, suit) {
  return Object.freeze({ id: rank + suit, rank, suit, joker: null });
}
export function createJoker(color) {
  return Object.freeze({ id: color === 'red' ? 'JR' : 'JB', rank: null, suit: null, joker: color });
}
export const isJoker = (c) => c.joker !== null;
export const cardColor = (c) => (isJoker(c) ? c.joker : suitColor(c.suit));
export const cardValue = (c) => (isJoker(c) ? JOKER_VALUE : rankValue(c.rank));

/** Build a card from its id, e.g. "10H", "3C", "JR" (red joker), "JB" (black joker). */
export function cardFromId(id) {
  if (id === 'JR') return createJoker('red');
  if (id === 'JB') return createJoker('black');
  const suit = id.slice(-1);
  const rank = id.slice(0, -1);
  if (!SUITS.includes(suit) || !RANKS.includes(rank)) throw new Error('ID kartu tidak valid: ' + id);
  return createCard(rank, suit);
}
export const cardsFromIds = (ids) => ids.map(cardFromId);

export function cardLabel(c) {
  return isJoker(c) ? 'Joker' : c.rank + SUIT_SYMBOL[c.suit];
}
