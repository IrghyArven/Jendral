import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/core/game-engine.js';

test('distribution is 14/14/13/13 with all 54 cards unique', () => {
  const e = new GameEngine({ seed: 7 });
  assert.deepEqual(e.hands.map((h) => h.length), [14, 14, 13, 13]);
  assert.equal(new Set(e.hands.flat().map((c) => c.id)).size, 54);
});
test('holder of 3 of Clubs starts and must open with it as a single', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const e = new GameEngine({ seed });
    const holder = e.hands.findIndex((h) => h.some((c) => c.id === '3C'));
    assert.equal(e.tm.current, holder);
    const other = e.hands[holder].find((c) => c.id !== '3C');
    assert.equal(e.play(holder, [other.id]).ok, false);
    assert.equal(e.play(holder, ['3C']).ok, true);
  }
});
