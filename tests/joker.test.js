import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, beats } from '../src/core/combinations.js';
import { C } from './helpers.js';
const k = (ids) => classify(C(ids));

test('red Joker beats red single only; black Joker beats black single only', () => {
  assert.ok(beats(k(['2H']), k(['JR'])));
  assert.ok(beats(k(['3D']), k(['JR'])));
  assert.ok(!beats(k(['2S']), k(['JR'])));
  assert.ok(beats(k(['3C']), k(['JB'])));
  assert.ok(beats(k(['AS']), k(['JB'])));
  assert.ok(!beats(k(['AH']), k(['JB'])));
});
test('ordinary cards and the other Joker cannot beat a Joker', () => {
  assert.ok(!beats(k(['JR']), k(['2S'])));
  assert.ok(!beats(k(['JR']), k(['JB'])));
  assert.ok(!beats(k(['JB']), k(['JR'])));
});
test('tris tekor satu: two of a rank + Joker (either colour)', () => {
  for (const j of ['JR', 'JB']) {
    const c = k(['7H', '7C', j]);
    assert.equal(c.type, 'tris');
    assert.equal(c.tekor, true);
    assert.equal(c.value, k(['7H', '7C', '7D']).value);
  }
  assert.equal(k(['7H', '8C', 'JR']), null);
  assert.equal(k(['7H', 'JB', 'JR']), null);
  assert.ok(beats(k(['7H', '7C', 'JR']), k(['9H', '9C', '9D'])));
});
