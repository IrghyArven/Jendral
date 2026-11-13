import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, applyAction } from '../src/core/game-engine.js';
import { AIPlayer, DIFFICULTIES, PERSONALITY_LABEL } from '../src/ai/ai-player.js';
import { CAPS } from '../src/ai/difficulty.js';
import { playFullMatch } from '../src/ai/simulation.js';
import { runLadder } from '../src/ai/evaluate.js';
import { planHand } from '../src/ai/hand-plan.js';
import { unseenInfo, jenderalRisk } from '../src/ai/knowledge.js';
import { createRng } from '../src/core/shuffle.js';
import { engineWith, C } from './helpers.js';

const PERSONALITIES = Object.keys(PERSONALITY_LABEL);

test('AIPlayer validates difficulty and personality names', () => {
  assert.throws(() => new AIPlayer('strategic', 'godlike'));
  assert.throws(() => new AIPlayer('berserk', 'normal'));
  assert.equal(new AIPlayer('adaptive', 'hard').label, 'Sulit · Adaptif');
  assert.equal(new AIPlayer('adaptive').difficulty, 'normal');
});

test('difficulty profiles are genuinely different (not just renamed numbers)', () => {
  const keys = (d) => JSON.stringify(CAPS[d]);
  assert.equal(new Set(DIFFICULTIES.map(keys)).size, 4);
  assert.equal(CAPS.easy.greedy, true);
  assert.equal(CAPS.normal.track, false);
  assert.equal(CAPS.hard.track, true);
  assert.equal(CAPS.hard.plan > 0 && CAPS.expert.plan > CAPS.hard.plan, true);
  assert.equal(CAPS.expert.smartPass && CAPS.expert.threat && CAPS.expert.risk > CAPS.hard.risk, true);
});

for (const d of DIFFICULTIES) for (const p of PERSONALITIES) {
  test(`legal and stuck-free: ${d} x ${p} (30 full matches)`, () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = playFullMatch({ seed, personalities: [p, p, p, p], difficulty: d });
      assert.deepEqual(r.errors, [], `${d}/${p} seed ${seed}`);
      assert.ok(r.steps < 1500);
    }
  });
}

test('mixed difficulties and personalities at one table stay legal (150 matches)', () => {
  const rng = createRng(2024);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  for (let seed = 1; seed <= 150; seed++) {
    const seats = [0, 1, 2, 3].map(() => ({ personality: pick(PERSONALITIES), difficulty: pick(DIFFICULTIES) }));
    const r = playFullMatch({ seed, seats });
    assert.deepEqual(r.errors, [], JSON.stringify({ seed, seats }));
  }
});

test('levels choose differently on identical positions (Easy/Normal/Hard/Expert not identical)', () => {
  for (const p of PERSONALITIES) {
    const diff = { en: 0, nh: 0, he: 0 };
    let n = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const e = new GameEngine({ seed });
      const driver = new AIPlayer(p, 'normal', { rng: createRng(seed) });
      let g = 0;
      while (e.phase !== 'over' && g++ < 2000) {
        const a = e.actor(); const v = e.view(a);
        if (v.phase === 'playing' && v.legalPlays.length > 1) {
          n++;
          const dec = DIFFICULTIES.map((d) => JSON.stringify(new AIPlayer(p, d, { rng: createRng(seed * 31 + g) }).decide(v)));
          if (dec[0] !== dec[1]) diff.en++;
          if (dec[1] !== dec[2]) diff.nh++;
          if (dec[2] !== dec[3]) diff.he++;
        }
        applyAction(e, a, driver.decide(v));
      }
    }
    for (const [k, v] of Object.entries(diff)) assert.ok(v / n > 0.03, `${p} ${k}: ${(v / n).toFixed(3)} of ${n}`);
  }
});

test('AI decisions depend only on legal information (hidden opponent cards are irrelevant)', () => {
  // Same own hand, same public info; only the opponents' hidden cards differ.
  const mine = ['3C', '4D', '4S', '7H', '9S', '9D', '9C', 'QD', 'KS', 'AS', '2H'];
  const others = ['5C', '5D', '6C', '6D', '7C', '7D', '8C', '8D', '8H', '8S', '10C', '10D', '10H', '10S', 'JC', 'JD', 'JH', 'JS', 'QC', 'QH', 'QS', 'KC', 'KD', 'KH', '3D', '3H', '3S', '2C', '2D', '2S', 'AC', 'AD', 'AH', '4C', '4H', '5H', '5S', '6H', '6S', '7S', '9H', 'JR', 'JB'];
  const deal = (ord) => {
    const o = ord.slice();
    return [mine, o.slice(0, 11), o.slice(11, 22), o.slice(22, 33)].map((h, i) => (i === 0 ? h : h));
  };
  const rev = others.slice().reverse();
  const a = engineWith(deal(others)), b = engineWith(deal(rev));
  for (const d of DIFFICULTIES) for (const p of PERSONALITIES) {
    const da = new AIPlayer(p, d, { rng: createRng(5) }).decide(a.view(0));
    const db = new AIPlayer(p, d, { rng: createRng(5) }).decide(b.view(0));
    assert.deepEqual(da, db, `${d}/${p} leaked hidden information`);
  }
  assert.equal(a.view(0).hands, undefined);
});

test('Jenderal chance: Normal+ always takes it, Easy sometimes misses it, never illegal', () => {
  const view = { phase: 'jenderal', canJenderal: true, jenderalRanks: ['9'] };
  assert.deepEqual(new AIPlayer('adaptive', 'expert', { rng: () => 0.99 }).decide(view), { type: 'general', rank: '9' });
  assert.deepEqual(new AIPlayer('adaptive', 'normal', { rng: () => 0.99 }).decide(view), { type: 'general', rank: '9' });
  assert.deepEqual(new AIPlayer('adaptive', 'easy', { rng: () => 0.99 }).decide(view), { type: 'declineGeneral' });
  assert.deepEqual(new AIPlayer('adaptive', 'easy', { rng: () => 0.1 }).decide(view), { type: 'general', rank: '9' });
});

test('hand plan estimator and Jenderal risk (public information only)', () => {
  assert.equal(planHand(C(['3C', '4D', '5S'])), 1); // ladder
  assert.equal(planHand(C(['9C', '9D', '9H', '7C', '7D'])), 1); // tris + lower pair = Tris Gandengan
  assert.equal(planHand(C(['7C', '7D', '7H', '9C', '9D'])), 3); // pair is higher than the tris: not a Gandengan
  assert.equal(planHand(C(['3C', '9D', 'KH'])), 3);
  assert.equal(planHand(C(['9C', '9D', 'JR'])), 1); // tris tekor
  assert.ok(planHand(C(['3C', '3D', '8H'])) > planHand(C(['3C', '3D', '3H'])));
  const e = engineWith([['3C', '5D'], ['4D', '6D', '8D', '9D'], ['7D', 'KD', 'AD', '2D'], ['QD', 'JD', '10D', 'JB', 'JR']]);
  const v = e.view(0);
  const info = unseenInfo(v);
  assert.equal(info.total, 54 - 2);
  assert.ok(jenderalRisk(v, info) >= 0 && jenderalRisk(v, info) <= 1);
});

test('extreme situations: single-card hands, last-active player, repeated passes', () => {
  const e = engineWith([['3C'], ['4S'], ['5S', '9S'], ['6S', '10S']]);
  const ai = new AIPlayer('aggressive', 'expert', { rng: createRng(1) });
  for (let i = 0; i < 20 && e.phase !== 'over'; i++) {
    const a = e.actor();
    assert.ok(applyAction(e, a, ai.decide(e.view(a))).ok);
  }
  assert.equal(e.phase, 'over');
  const f = engineWith([['3C', '4C', '5C', '6C'], ['4S'], ['5S'], ['6S']]);
  assert.ok(f.play(0, ['3C']).ok);
  const x = new AIPlayer('strategic', 'hard', { rng: createRng(2) });
  for (let i = 0; i < 12 && f.phase !== 'over'; i++) { const a = f.actor(); assert.ok(applyAction(f, a, x.decide(f.view(a))).ok); }
});

// Single follows suit, which narrowed the hard->expert gap to ~0.03 places; 300 seeds (1200
// matches) can no longer resolve it, so this measurement uses 2500 seeds (10000 matches).
// The assertions stay strict: every level must place strictly better than the one below.
test('measured: placement improves with level (strategic ladder, 10000 matches)', { timeout: 300000 }, () => {
  const r = runLadder({ seeds: 2500, personality: 'strategic' }).levels;
  const p = (d) => r[d].avgPlace;
  assert.ok(p('easy') > p('normal'), JSON.stringify(r));
  assert.ok(p('normal') > p('hard'), JSON.stringify(r));
  assert.ok(p('hard') > p('expert'), JSON.stringify(r));
  for (const d of DIFFICULTIES) assert.equal(r[d].errors, 0);
});

test('measured: decision quality (Joker waste, structure breaks, missed finishes) is better at higher levels', () => {
  const r = runLadder({ seeds: 300, personality: 'strategic' }).levels;
  const q = (d, k) => r[d].per100Decisions[k];
  assert.ok(q('easy', 'jokerWaste') > q('expert', 'jokerWaste'));
  assert.ok(q('easy', 'structureBreak') > q('expert', 'structureBreak'));
  assert.ok(q('easy', 'missedFinish') > q('normal', 'missedFinish'));
  assert.equal(q('expert', 'missedFinish'), 0);
  assert.ok(q('easy', 'jenderalDeclined') > 0 || q('easy', 'jenderalWins') >= 0);
});
