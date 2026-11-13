import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeck } from '../src/core/deck.js';
import { RANKS, rankValue, cardFromId } from '../src/core/cards.js';
import { shuffle, createRng } from '../src/core/shuffle.js';

test('deck has exactly 54 unique cards incl. 2 jokers', () => {
  const d = createDeck();
  assert.equal(d.length, 54);
  assert.equal(new Set(d.map((c) => c.id)).size, 54);
  assert.equal(d.filter((c) => c.joker).length, 2);
});
test('card ranking is 3 < ... < A < 2', () => {
  assert.deepEqual(RANKS, ['3','4','5','6','7','8','9','10','J','Q','K','A','2']);
  assert.ok(rankValue('2') > rankValue('A'));
  assert.ok(rankValue('3') < rankValue('4'));
});
test('shuffle is deterministic with a seed and keeps all cards', () => {
  const a = shuffle(createDeck(), createRng(42)).map((c) => c.id);
  const b = shuffle(createDeck(), createRng(42)).map((c) => c.id);
  const c = shuffle(createDeck(), createRng(43)).map((c) => c.id);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(new Set(a).size, 54);
});
test('cardFromId rejects garbage', () => {
  assert.throws(() => cardFromId('ZZ'));
});
