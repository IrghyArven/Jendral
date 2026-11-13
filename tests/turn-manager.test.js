import test from 'node:test';
import assert from 'node:assert/strict';
import { engineWith } from './helpers.js';

// All clubs: Single follows suit, so a trick can only continue within one suit.
const H = () => [['3C', '7C', 'KC'], ['4C', '8C', 'QC'], ['5C', '9C', 'AC'], ['6C', '10C', '2C']];

test('turn passes to next player and enforces ownership', () => {
  const e = engineWith(H());
  assert.equal(e.play(1, ['4C']).ok, false);
  e.play(0, ['3C']);
  assert.equal(e.tm.current, 1);
  assert.equal(e.pass(2).ok, false);
});
test('leader cannot pass; others can; trick resets to last player', () => {
  const e = engineWith(H());
  assert.equal(e.pass(0).ok, false);
  e.play(0, ['3C']);
  assert.ok(e.pass(1).ok);
  assert.ok(e.pass(2).ok);
  assert.equal(e.table.player, 0);
  assert.ok(e.pass(3).ok);
  assert.equal(e.table, null);
  assert.equal(e.tm.current, 0);
  assert.equal(e.tm.leading, true);
  assert.ok(e.play(0, ['KC']).ok); // free lead, any card
});
test('a player who passed stays out until the trick resets', () => {
  const e = engineWith(H());
  e.play(0, ['3C']);
  e.pass(1);
  e.play(2, ['5C']);
  assert.equal(e.tm.current, 3);
  e.play(3, ['6C']);
  assert.equal(e.tm.current, 0); // skips passed player 1
});
test('if the last player already finished, lead goes to next active player', () => {
  const e = engineWith([['3C'], ['4C', '8C'], ['5C', '9C'], ['6C', '10C']]);
  e.play(0, ['3C']);
  assert.deepEqual(e.tm.finished, [0]);
  e.pass(1); e.pass(2); e.pass(3);
  assert.equal(e.tm.current, 1);
  assert.equal(e.tm.leading, true);
});
