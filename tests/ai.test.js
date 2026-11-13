import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, applyAction } from '../src/core/game-engine.js';
import { AIPlayer } from '../src/ai/ai-player.js';
import { playFullMatch } from '../src/ai/simulation.js';

for (const p of ['aggressive', 'strategic', 'adaptive']) {
  test(`AI ${p} always makes legal moves (validated by the engine)`, () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = playFullMatch({ seed, personalities: [p, p, p, p] });
      assert.deepEqual(r.errors, [], `${p} seed ${seed}`);
    }
  });
}
test('AI opens with 3 of Clubs when it holds it', () => {
  const e = new GameEngine({ seed: 11 });
  const s = e.tm.current;
  const a = new AIPlayer('strategic').decide(e.view(s));
  assert.deepEqual(a, { type: 'play', ids: ['3C'] });
  assert.ok(applyAction(e, s, a).ok);
});
test('AI view never exposes other players hands', () => {
  const e = new GameEngine({ seed: 3 });
  const v = e.view(1);
  assert.equal(v.hands, undefined);
  assert.equal(v.hand.length, e.hands[1].length);
  assert.ok(Array.isArray(v.handCounts));
  assert.deepEqual(v.legalPlays, e.tm.current === 1 ? v.legalPlays : []);
});
test('AI always declares Jenderal when holding four of a kind and given the chance', () => {
  const ai = new AIPlayer('adaptive');
  const view = { phase: 'jenderal', canJenderal: true, jenderalRanks: ['9'] };
  assert.deepEqual(ai.decide(view), { type: 'general', rank: '9' });
  assert.deepEqual(ai.decide({ phase: 'jenderal', canJenderal: false }), { type: 'declineGeneral' });
});
