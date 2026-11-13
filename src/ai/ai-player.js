import { PERSONALITIES, chooseMove } from './strategy.js';
import { CAPS, DIFFICULTIES, DIFFICULTY_LABEL, isDifficulty } from './difficulty.js';

export const PERSONALITY_LABEL = { aggressive: 'Agresif', strategic: 'Strategis', adaptive: 'Adaptif' };
export { DIFFICULTIES, DIFFICULTY_LABEL };

/**
 * AI sees only engine.view(player) (own hand + public info) and every action it
 * returns is validated by the same engine as human actions.
 * personality = style, difficulty = decision quality (separate axes).
 */
export class AIPlayer {
  constructor(personality = 'strategic', difficulty = 'normal', { rng = Math.random } = {}) {
    if (!PERSONALITIES[personality]) throw new Error('Kepribadian AI tidak dikenal: ' + personality);
    if (!isDifficulty(difficulty)) throw new Error('Tingkat kesulitan AI tidak dikenal: ' + difficulty);
    this.personality = personality;
    this.difficulty = difficulty;
    this.caps = CAPS[difficulty];
    this.rng = rng;
  }
  get label() { return `${DIFFICULTY_LABEL[this.difficulty]} · ${PERSONALITY_LABEL[this.personality]}`; }
  decide(view) {
    if (view.phase === 'jenderal') {
      if (!view.canJenderal) return { type: 'declineGeneral' };
      return this.rng() < this.caps.jenderalTake ? { type: 'general', rank: view.jenderalRanks[0] } : { type: 'declineGeneral' };
    }
    if (!view.legalPlays.length) return { type: 'pass' };
    const choice = chooseMove(view, view.legalPlays, this, this.rng);
    if (!choice) return view.leading ? { type: 'play', ids: view.legalPlays[0].cards.map((c) => c.id) } : { type: 'pass' };
    return { type: 'play', ids: choice.cards.map((c) => c.id) };
  }
}
