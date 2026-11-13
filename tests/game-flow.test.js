import test from 'node:test';
import assert from 'node:assert/strict';
import { engineWith } from './helpers.js';
import { playFullMatch } from '../src/ai/simulation.js';
import { GameEngine } from '../src/core/game-engine.js';

test('players finish in order and the last remaining player loses', () => {
  const e = engineWith([['3C'], ['4S'], ['5S', '9S'], ['6S', '10S']]);
  e.play(0, ['3C']);
  e.play(1, ['4S']);
  assert.deepEqual(e.tm.finished, [0, 1]);
  assert.equal(e.phase, 'playing');
  e.play(2, ['5S']);
  e.play(3, ['6S']);
  assert.equal(e.tm.current, 2);
  e.play(2, ['9S']);
  assert.equal(e.phase, 'over');
  assert.deepEqual(e.result.order, [0, 1, 2, 3]);
  assert.equal(e.result.winner, 0);
  assert.equal(e.result.loser, 3);
  assert.equal(e.play(3, ['10S']).ok, false);
});
test('engine rejects bypass attempts', () => {
  const e = new GameEngine({ seed: 5 });
  const starter = e.tm.current;
  const other = (starter + 1) % 4;
  assert.equal(e.play(other, [e.hands[other][0].id]).ok, false); // out of turn
  assert.equal(e.play(starter, ['XX']).ok, false); // unknown card
  const foreign = e.hands[other][0].id;
  assert.equal(e.play(starter, [foreign]).ok, false); // card not in hand
  assert.equal(e.play(starter, ['3C', '3C']).ok, false); // duplicate
  assert.equal(e.pass(starter).ok, false);
  assert.equal(e.play(starter, ['3C']).ok, true);
});
test('history records plays and passes', () => {
  const e = engineWith([['3C', '7S'], ['4S', '8S'], ['5S', '9S'], ['6S', '10S']]);
  e.play(0, ['3C']); e.pass(1);
  assert.deepEqual(e.history.map((h) => h.action), ['play', 'pass']);
});
test('200 complete simulated matches: no loops, no illegal moves, no duplicates', () => {
  let jenderal = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = playFullMatch({ seed });
    assert.deepEqual(r.errors, [], 'seed ' + seed);
    assert.ok(r.steps < 1000);
    if (r.result.type === 'jenderal') {
      jenderal++;
      assert.equal(r.result.losers.length, 3);
    } else {
      assert.equal(new Set(r.result.order).size, 4);
      assert.equal(r.result.winner, r.result.order[0]);
    }
  }
  assert.ok(jenderal >= 0);
});
