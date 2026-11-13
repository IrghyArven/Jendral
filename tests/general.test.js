import test from 'node:test';
import assert from 'node:assert/strict';
import { engineWith } from './helpers.js';
import { fourOfKindRanks } from '../src/core/general.js';
import { C } from './helpers.js';

const HANDS = () => [['3C', '5D'], ['JB', '4D'], ['9C', '9D', '9H', '9S'], ['6C', '7C']];

test('fourOfKindRanks detects four of a rank', () => {
  assert.deepEqual(fourOfKindRanks(C(['9C', '9D', '9H', '9S', 'JR'])), ['9']);
  assert.deepEqual(fourOfKindRanks(C(['9C', '9D', '9H', 'JR'])), []);
});
test('Jenderal interception ends the whole match immediately', () => {
  const e = engineWith(HANDS());
  assert.ok(e.play(0, ['3C']).ok);
  assert.ok(e.play(1, ['JB']).ok); // black Joker over black 3C
  assert.equal(e.phase, 'jenderal');
  assert.equal(e.actor(), 2);
  assert.equal(e.play(2, ['9C']).ok, false); // must respond to the Jenderal window first
  const r = e.general(2);
  assert.ok(r.ok);
  assert.equal(e.phase, 'over');
  assert.equal(e.result.type, 'jenderal');
  assert.equal(e.result.winner, 2);
  assert.deepEqual(e.result.losers.sort(), [0, 1, 3]);
});
test('Jenderal not available without a Joker single, or without four of a kind', () => {
  const e = engineWith(HANDS());
  assert.equal(e.general(2).ok, false);
  e.play(0, ['3C']);
  e.play(1, ['JB']);
  assert.equal(e.general(3).ok, false); // 3 is not eligible / not in queue
  assert.equal(e.general(1).ok, false);
});
test('declining Jenderal resumes normal play with the correct player', () => {
  const e = engineWith(HANDS());
  e.play(0, ['3C']);
  e.play(1, ['JB']);
  assert.ok(e.declineGeneral(2).ok);
  assert.equal(e.phase, 'playing');
  assert.equal(e.tm.current, 2);
});
test('Tris tekor with Joker does not open a Jenderal window', () => {
  const e = engineWith([['3C', '7H', '7C', 'JR', '9D'], ['4D', '9H', '9C', '9S', '9D'].slice(0, 4), ['5D'], ['6D']]);
  e.play(0, ['3C']);
  e.pass(1); e.pass(2); e.pass(3);
  assert.ok(e.play(0, ['7H', '7C', 'JR']).ok);
  assert.equal(e.phase, 'playing');
});
test('nextPlayerOnly rule variant is honoured', () => {
  const hands = [['3C', '5D'], ['JB', '4D'], ['6D'], ['9C', '9D', '9H', '9S']];
  const e = engineWith(hands, { rules: { jenderal: { eligibility: 'nextPlayerOnly' } } });
  e.play(0, ['3C']);
  e.play(1, ['JB']);
  assert.equal(e.phase, 'playing'); // next player (2) has no four of a kind
});


test('final Joker opens Jenderal window before normal end when only one opponent remains', () => {
  const hands = [['3C'], ['4S', 'JB'], ['9C', '9D', '9H', '9S'], ['6S']];
  const e = engineWith(hands);
  assert.ok(e.play(0, ['3C']).ok);
  assert.ok(e.play(1, ['4S']).ok);
  assert.ok(e.pass(2).ok);
  assert.ok(e.play(3, ['6S']).ok); // player 3 finishes
  assert.equal(e.tm.current, 1);
  const finalJoker = e.play(1, ['JB']);
  assert.ok(finalJoker.ok);
  assert.equal(finalJoker.over, false);
  assert.equal(e.phase, 'jenderal');
  assert.equal(e.actor(), 2);
  assert.deepEqual(e.generalQueue, [2]);
  assert.ok(e.general(2).ok);
  assert.equal(e.result.type, 'jenderal');
  assert.equal(e.result.winner, 2);
});

test('declining the final Jenderal chance ends the normal match immediately', () => {
  const hands = [['3C'], ['4S', 'JB'], ['9C', '9D', '9H', '9S'], ['6S']];
  const e = engineWith(hands);
  e.play(0, ['3C']);
  e.play(1, ['4S']);
  e.pass(2);
  e.play(3, ['6S']);
  e.play(1, ['JB']);
  const declined = e.declineGeneral(2);
  assert.ok(declined.ok);
  assert.equal(declined.over, true);
  assert.equal(e.phase, 'over');
  assert.equal(e.result.type, 'normal');
  assert.equal(e.result.loser, 2);
});
