import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, beats, generateCombos } from '../src/core/combinations.js';
import { C } from './helpers.js';
const k = (ids) => classify(C(ids));

test('single comparison by rank (2 highest)', () => {
  assert.ok(beats(k(['5H']), k(['6C'])));
  assert.ok(!beats(k(['6C']), k(['5H'])));
});
test('2 beats Ace', () => assert.ok(beats(k(['AS']), k(['2D']))));
test('equal rank does not beat', () => assert.ok(!beats(k(['5H']), k(['5S']))));
test('tris classification and comparison', () => {
  assert.equal(k(['5H', '5C', '5D']).type, 'tris');
  assert.ok(beats(k(['5H', '5C', '5D']), k(['8H', '8C', '8D'])));
  assert.ok(!beats(k(['8H', '8C', '8D']), k(['5H', '5C', '5D'])));
  assert.equal(k(['5H', '5C', '6D']), null);
});
test('different combination types never beat each other', () => {
  const tris = k(['5H', '5C', '5D']);
  assert.ok(!beats(tris, k(['AH'])));
  assert.ok(!beats(tris, k(['6H', '7H', '8H'])));
  assert.ok(!beats(k(['3H', '4H', '5H']), k(['KH', 'KC', 'KD'])));
});
test('tris gandengan: triple + LOWER pair, five cards', () => {
  assert.equal(k(['KH', 'KC', 'KD', '5H', '5C']).type, 'trisGandengan');
  assert.equal(k(['5H', '5C', '5D', 'KH', 'KC']), null); // pair higher than triple
  assert.equal(k(['KH', 'KC', 'KD', '5H', '6C']), null);
  assert.ok(beats(k(['5H', '5C', '5D', '3H', '3C']), k(['8H', '8C', '8D', '4H', '4C'])));
  assert.ok(!beats(k(['8H', '8C', '8D', '4H', '4C']), k(['5H', '5C', '5D', '3H', '3C'])));
  assert.ok(!beats(k(['5H', '5C', '5D']), k(['8H', '8C', '8D', '4H', '4C'])));
});
test('tris gandengan rejects Joker by default rule', () => {
  assert.equal(k(['KH', 'KC', 'JR', '5H', '5C']), null);
});
test('tangga validation: >=3 consecutive, same length, highest rank decides', () => {
  assert.equal(k(['3H', '4C', '5D']).type, 'tangga');
  assert.equal(k(['10H', 'JC', 'QD']).type, 'tangga');
  assert.equal(k(['3H', '4C', '6D']), null);
  assert.equal(k(['3H', '4C']), null);
  assert.ok(beats(k(['3H', '4C', '5D']), k(['6H', '7C', '8D'])));
  assert.ok(!beats(k(['3H', '4C', '5D']), k(['4H', '5C', '6D', '7S']))); // length differs
  assert.ok(beats(k(['3H', '4C', '5D', '6S']), k(['4H', '5C', '6D', '7S'])));
});
test('tangga cannot contain Jokers or wrap through 2', () => {
  assert.equal(k(['3H', '4C', 'JR']), null);
  assert.equal(k(['QH', 'KC', 'AD', '2S']), null);
  assert.equal(k(['KH', 'AC', '2D']), null);
});
test('generateCombos produces only classifiable combos incl. tekor', () => {
  const combos = generateCombos(C(['7H', '7C', 'JR', '9D']));
  assert.ok(combos.some((c) => c.type === 'tris' && c.tekor));
  assert.ok(combos.every((c) => classify(c.cards)));
});
