import { cardsFromIds } from '../src/core/cards.js';
import { GameEngine } from '../src/core/game-engine.js';
export const C = cardsFromIds;
/** Engine with custom hands (arrays of card ids); player holding 3C starts. */
export function engineWith(handIds, opts = {}) {
  return new GameEngine({ hands: handIds.map(C), ...opts });
}
