import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, beats, generateCombos } from '../src/core/combinations.js';
import { cardColor, isJoker } from '../src/core/cards.js';
import { createRng } from '../src/core/shuffle.js';
import { AIPlayer, PERSONALITY_LABEL } from '../src/ai/ai-player.js';
import { DIFFICULTIES } from '../src/ai/difficulty.js';
import { playFullMatch } from '../src/ai/simulation.js';
import { applyAction } from '../src/core/game-engine.js';
import { unseenBeaters } from '../src/ai/decision.js';
import { C, engineWith } from './helpers.js';

const k = (ids) => classify(C(ids));
const SUITS = ['C', 'D', 'H', 'S'];

/* ---------- A-D: Single follows suit (pure rule) ---------- */

test('A. Single of the SAME suit and higher rank is accepted (all four suits)', () => {
  for (const s of SUITS) {
    assert.ok(beats(k(['3' + s]), k(['4' + s])), '3->4 ' + s);
    assert.ok(beats(k(['7' + s]), k(['KS'.replace('S', s)])), '7->K ' + s);
    assert.ok(beats(k(['AS'.replace('S', s)]), k(['2' + s])), 'A->2 ' + s);
  }
});

test('B. Single of a DIFFERENT suit is rejected even when its rank is higher', () => {
  for (const a of SUITS) for (const b of SUITS) {
    if (a === b) continue;
    assert.ok(!beats(k(['3' + a]), k(['2' + b])), `3${a} vs 2${b}`);
    assert.ok(!beats(k(['7' + a]), k(['A' + b])), `7${a} vs A${b}`);
  }
});

test('C. Single of EQUAL rank is rejected (any suit)', () => {
  for (const a of SUITS) for (const b of SUITS) assert.ok(!beats(k(['9' + a]), k(['9' + b])), `9${a} vs 9${b}`);
});

test('D. Single of LOWER rank is rejected, even in the same suit', () => {
  for (const s of SUITS) {
    assert.ok(!beats(k(['9' + s]), k(['8' + s])));
    assert.ok(!beats(k(['2' + s]), k(['3' + s])));
  }
});

test('engine rejects an off-suit Single and accepts the same-suit one (not just the UI)', () => {
  const e = engineWith([['3C', '9C'], ['4D', 'KD', '5C'], ['6H'], ['8S']]);
  assert.ok(e.play(0, ['3C']).ok);
  const bad = e.play(1, ['KD']); // higher rank, wrong suit
  assert.equal(bad.ok, false);
  assert.match(bad.error, /satu suit/);
  assert.equal(e.play(1, ['4D']).ok, false);
  assert.deepEqual(e.hands[1].map((c) => c.id).sort(), ['4D', '5C', 'KD']); // nothing was consumed
  assert.equal(e.tm.current, 1);
  assert.ok(e.play(1, ['5C']).ok);
});

/* ---------- E: Joker keeps its colour rule ---------- */

test('E. Joker still follows the colour rule (and is not an exact-suit rule)', () => {
  for (const [id, col] of [['5H', 'red'], ['5D', 'red'], ['5C', 'black'], ['5S', 'black']]) {
    const other = col === 'red' ? 'JB' : 'JR';
    const own = col === 'red' ? 'JR' : 'JB';
    assert.ok(beats(k([id]), k([own])), `${own} beats ${id}`);
    assert.ok(!beats(k([id]), k([other])), `${other} cannot beat ${id}`);
  }
  assert.equal(cardColor(C(['5H'])[0]), 'red');
  // a Joker may beat a card of ANY suit of its colour, and nothing ordinary beats a Joker
  assert.ok(beats(k(['KH']), k(['JR'])) && beats(k(['3D']), k(['JR'])));
  assert.ok(!beats(k(['JR']), k(['2H'])) && !beats(k(['JB']), k(['JR'])) && !beats(k(['JR']), k(['JB'])));
});

test('E. Joker colour rule is enforced by the engine inside a trick', () => {
  const e = engineWith([['3C', '5H'], ['JR', 'JB', '8D'], ['6H'], ['9S']]);
  assert.ok(e.play(0, ['3C']).ok);
  assert.equal(e.play(1, ['JR']).ok, false); // red Joker on a black card
  assert.ok(e.play(1, ['JB']).ok);
  e.pass(2); e.pass(3); e.pass(0);
  assert.equal(e.tm.leading, true);
  assert.equal(e.tm.current, 1);
  assert.ok(e.play(1, ['8D']).ok);
  assert.equal(e.play(2, ['6H']).ok, false); // off suit
});

/* ---------- F-H: other combinations are NOT suit locked ---------- */

test('F. Tris compares by triple value only (no same-suit requirement)', () => {
  assert.ok(beats(k(['5H', '5C', '5D']), k(['8S', '8H', '8D'])));
  assert.ok(!beats(k(['8S', '8H', '8D']), k(['5H', '5C', '5D'])));
  assert.ok(beats(k(['5H', '5C', 'JR']), k(['6S', '6D', '6C']))); // tris tekor too
  const e = engineWith([['3C', '5H', '5C', '5D'], ['8S', '8H', '8D'], ['4S'], ['6S']]);
  assert.ok(e.play(0, ['3C']).ok);
  e.pass(1); e.pass(2); e.pass(3);
  assert.ok(e.play(0, ['5H', '5C', '5D']).ok);
  assert.ok(e.play(1, ['8S', '8H', '8D']).ok);
});

test('G. Tris Gandengan compares by triple value only (no same-suit requirement)', () => {
  const lo = k(['5H', '5C', '5D', '3H', '3D']);
  const hi = k(['8S', '8H', '8C', '4S', '4D']);
  assert.equal(lo.type, 'trisGandengan');
  assert.ok(beats(lo, hi));
  assert.ok(!beats(hi, lo));
  const e = engineWith([['3C', '5H', '5C', '5D', '3H', '3D'], ['8S', '8H', '8C', '4S', '4D'], ['6S'], ['7S']]);
  assert.ok(e.play(0, ['3C']).ok);
  e.pass(1); e.pass(2); e.pass(3);
  assert.ok(e.play(0, ['5H', '5C', '5D', '3H', '3D']).ok);
  assert.ok(e.play(1, ['8S', '8H', '8C', '4S', '4D']).ok);
});

test('H. Tangga compares by highest card and length only (no same-suit requirement)', () => {
  const lo = k(['3H', '4H', '5H']);
  assert.ok(beats(lo, k(['4C', '5C', '6C'])));
  assert.ok(beats(lo, k(['4C', '5D', '6S']))); // mixed suits are fine too
  assert.ok(!beats(k(['4C', '5C', '6C']), lo));
  assert.ok(!beats(lo, k(['3C', '4C', '5C']))); // same top card does not beat
  assert.ok(!beats(lo, k(['4C', '5C', '6C', '7C']))); // different length never compares
  const e = engineWith([['3C', '3H', '4H', '5H'], ['4C', '5D', '6S'], ['7S'], ['8S']]);
  assert.ok(e.play(0, ['3C']).ok);
  e.pass(1); e.pass(2); e.pass(3);
  assert.ok(e.play(0, ['3H', '4H', '5H']).ok);
  assert.ok(e.play(1, ['4C', '5D', '6S']).ok);
});

/* ---------- I: the lock ends with the trick ---------- */

test('I. After everyone else passes, the new leader may lead any suit, and that lead re-locks the new trick', () => {
  const e = engineWith([['3C', '7H', '9H', 'KS'], ['4S', '5S'], ['6D'], ['8D']]);
  assert.ok(e.play(0, ['3C']).ok);
  e.pass(1); e.pass(2); e.pass(3); // trick ends, player 0 leads again
  assert.equal(e.tm.leading, true);
  assert.equal(e.table, null);
  assert.equal(e.tm.current, 0);
  assert.ok(e.legalPlays(0).some((c) => c.cards[0].suit === 'H')); // a different suit than the old trick
  assert.ok(e.play(0, ['7H']).ok);
  // the NEW trick is locked to hearts: player 1's higher spade is illegal, 2/3 hold no hearts
  assert.equal(e.play(1, ['5S']).ok, false);
  assert.deepEqual(e.legalPlays(1), []);
  assert.ok(e.pass(1).ok);
  assert.ok(e.pass(2).ok); assert.ok(e.pass(3).ok);
  assert.equal(e.tm.leading, true);
  assert.ok(e.play(0, ['KS']).ok); // free again
});

test('I. A trick that ended because the leader finished passes the free lead on, without any suit lock', () => {
  const e = engineWith([['3C'], ['4S', '8S'], ['5H', '9H'], ['6D', '10D']]);
  e.play(0, ['3C']);
  e.pass(1); e.pass(2); e.pass(3);
  assert.equal(e.tm.current, 1);
  assert.ok(e.play(1, ['8S']).ok);
});

/* ---------- J: legalPlays(), AI, simulation ---------- */

test('J. legalPlays() returns only suit-correct Singles (plus the matching-colour Joker)', () => {
  const e = engineWith([['3C', '9S'], ['4C', '5D', 'KD', '7C', 'JR', 'JB', '2S'], ['6H'], ['8S']]);
  e.play(0, ['3C']);
  const ids = e.legalPlays(1).map((c) => c.cards.map((x) => x.id).join('+')).sort();
  assert.deepEqual(ids, ['4C', '7C', 'JB']); // no 5D / KD / 2S, no red Joker
  const legalKeys = new Set(e.legalPlays(1).map((c) => c.cards.map((x) => x.id).join('+')));
  for (const c of generateCombos(e.hands[1])) {
    const ok = legalKeys.has(c.cards.map((x) => x.id).join('+'));
    const sameSuit = c.type === 'single' && !c.joker && c.cards[0].suit === 'C' && c.value > 0;
    assert.equal(ok, sameSuit || (c.joker && c.cards[0].joker === 'black'), c.cards.map((x) => x.id).join('+'));
  }
  assert.deepEqual(e.view(1).legalPlays.map((c) => c.cards[0].id).sort(), ['4C', '7C', 'JB']);
});

test('J. AI at every level and personality only ever picks suit-legal Singles', () => {
  for (const diff of DIFFICULTIES) for (const per of Object.keys(PERSONALITY_LABEL)) for (let seed = 1; seed <= 25; seed++) {
    const e = engineWith([['3C', '9C'], ['4D', 'KD', '5C', 'AD', '2D'], ['6H', 'QH'], ['8S', '10S']]);
    e.play(0, ['3C']);
    const ai = new AIPlayer(per, diff, { rng: createRng(seed) });
    const view = e.view(1);
    const a = ai.decide(view);
    assert.ok(a.type === 'pass' || (a.type === 'play' && a.ids.length === 1 && a.ids[0] === '5C'), `${diff}/${per}/${seed}: ${JSON.stringify(a)}`);
    assert.ok(applyAction(e, 1, a).ok);
  }
});

test('J. AI view never exposes opponents\' unplayed cards', () => {
  const e = engineWith([['3C', '9C'], ['4D', 'KD', '5C'], ['6H', 'QH'], ['8S', '10S']]);
  e.play(0, ['3C']);
  const json = JSON.stringify(e.view(1));
  for (const id of ['9C', '6H', 'QH', '8S', '10S']) assert.ok(!json.includes('"' + id + '"'), id + ' leaked');
});

test('J. unseenBeaters() counts only same-suit higher cards plus the matching-colour Joker', () => {
  const e = engineWith([['3C', '2C'], ['4D'], ['5D'], ['6D']]);
  const view = e.view(0);
  const combo = k(['QC']);
  // unseen beaters of QC: KC, AC (2C is in my hand) + black Joker (red Joker cannot beat black) = 3
  assert.equal(unseenBeaters(view, combo), 3);
  assert.equal(unseenBeaters(view, k(['2D'])), 1); // only the red Joker can beat 2D
});

test('J. simulated matches: every trick follows the suit lock, nothing illegal ever happens', () => {
  let singleFollows = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const r = playFullMatch({ seed, collect: true });
    assert.equal(r.errors.length, 0, `seed ${seed}: ${JSON.stringify(r.errors)}`);
    let prev = null; // previous single card in the current trick
    for (const h of r.engine.history) {
      if (h.action === 'trickEnd') { prev = null; continue; }
      if (h.action !== 'play') continue;
      if (h.type !== 'single') { prev = null; continue; }
      const card = C(h.cards)[0];
      if (prev) {
        singleFollows++;
        if (isJoker(card)) assert.equal(card.joker, cardColor(prev), `seed ${seed}: joker colour`);
        else assert.equal(card.suit, prev.suit, `seed ${seed}: ${card.id} on ${prev.id}`);
      }
      prev = card;
    }
  }
  assert.ok(singleFollows > 100, 'simulation exercised follow-up Singles: ' + singleFollows);
});
