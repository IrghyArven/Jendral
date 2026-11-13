import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitize, DEFAULTS, loadSettings, saveSettings, seatConfig } from '../src/ui/settings.js';
import { loadStats, recordResult, resetStats } from '../src/ui/scoreboard.js';
import { createAudio, SOUND_NAMES } from '../src/ui/audio.js';
import { computeMatchStats } from '../src/core/match-stats.js';
import { playFullMatch } from '../src/ai/simulation.js';
import { engineWith } from './helpers.js';

const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), raw: m }; };

test('settings: defaults, sanitising of corrupt/hostile stored data, persistence', () => {
  const d = DEFAULTS();
  assert.equal(d.difficulty, 'normal'); assert.equal(d.perAi, false); assert.equal(d.ais.length, 3);
  const s = sanitize({ difficulty: 'godmode', anim: 'turbo', volume: 9, speed: 'fast', name: 'x'.repeat(50), seed: 'abc', ais: [{ personality: 'evil', difficulty: 'expert' }, null, 7] });
  assert.equal(s.difficulty, 'normal'); assert.equal(s.anim, d.anim); assert.equal(s.volume, d.volume);
  assert.equal(s.speed, 'fast'); assert.equal(s.name.length, 14); assert.equal(s.seed, '');
  assert.deepEqual(s.ais[0], { personality: 'aggressive', difficulty: 'expert' });
  assert.deepEqual(sanitize(null), DEFAULTS()); assert.deepEqual(sanitize('zzz'), DEFAULTS());
  const st = memStore();
  saveSettings({ ...d, difficulty: 'hard', perAi: true, volume: 0.2 }, st);
  const back = loadSettings(st);
  assert.equal(back.difficulty, 'hard'); assert.equal(back.volume, 0.2);
  st.setItem('jenderal.settings.v2', '{broken json');
  assert.deepEqual(loadSettings(st), DEFAULTS());
});

test('seatConfig: one level for all AIs, or a separate level per AI', () => {
  const s = DEFAULTS();
  s.difficulty = 'hard';
  s.ais[1].difficulty = 'easy'; s.ais[2].difficulty = 'expert';
  assert.deepEqual(seatConfig(s).map((x) => x.difficulty), ['hard', 'hard', 'hard']);
  s.perAi = true;
  assert.deepEqual(seatConfig(s).map((x) => x.difficulty), ['normal', 'easy', 'expert']);
  assert.deepEqual(seatConfig(s).map((x) => x.personality), ['aggressive', 'strategic', 'adaptive']);
});

test('scoreboard: wins, Jenderal results, per-difficulty buckets, corrupt storage, reset', () => {
  const st = memStore();
  recordResult({ type: 'normal', order: [0, 1, 2, 3], winner: 0, loser: 3 }, 0, 'hard', st);
  recordResult({ type: 'normal', order: [1, 2, 3, 0], winner: 1, loser: 0 }, 0, 'hard', st);
  recordResult({ type: 'jenderal', winner: 2, order: [2, 0, 1, 3], losers: [0, 1, 3] }, 0, 'mixed', st);
  recordResult({ type: 'jenderal', winner: 0, order: [0, 1, 2, 3], losers: [1, 2, 3] }, 0, 'expert', st);
  const s = loadStats(st);
  assert.equal(s.games, 4); assert.equal(s.wins, 2); assert.equal(s.losses, 2);
  assert.equal(s.jenderalWins, 1); assert.equal(s.jenderalLosses, 1);
  assert.deepEqual(s.places, [2, 0, 0, 2]);
  assert.deepEqual(s.byDiff.hard, { games: 2, wins: 1 });
  st.setItem('jenderal.stats.v1', 'nope');
  assert.equal(loadStats(st).games, 0);
  resetStats(st);
  assert.equal(loadStats(st).games, 0);
});

test('audio is optional: silent no-op without Web Audio, respects mute and volume', () => {
  let settings = { sound: true, volume: 0.5 };
  const a = createAudio(() => settings);
  assert.ok(SOUND_NAMES.includes('jenderal') && SOUND_NAMES.includes('win') && SOUND_NAMES.includes('lose') && SOUND_NAMES.includes('pass') && SOUND_NAMES.includes('card') && SOUND_NAMES.includes('turn'));
  assert.doesNotThrow(() => a.unlock());
  assert.equal(a.play('card'), false); // no AudioContext in Node: must not throw
  settings = { sound: false, volume: 0.5 };
  assert.equal(a.play('card'), false);
  assert.equal(a.play('does-not-exist'), false);
});

test('audio plays through a fake Web Audio context and honours the master volume', () => {
  const calls = [];
  const node = () => ({ connect() {}, start: (t) => calls.push(['start', t]), stop() {}, frequency: { setValueAtTime() {}, linearRampToValueAtTime() {}, value: 0 }, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 1 }, type: '' });
  globalThis.AudioContext = class { constructor() { this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; this.state = 'running'; } createGain() { const n = node(); calls.push(['gain', n]); return n; } createOscillator() { return node(); } createBufferSource() { return node(); } createBiquadFilter() { return node(); } createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; } resume() { return Promise.resolve(); } };
  try {
    const settings = { sound: true, volume: 0.4 };
    const a = createAudio(() => settings);
    assert.equal(a.play('jenderal'), true);
    assert.ok(calls.filter((c) => c[0] === 'start').length >= 4);
    const master = calls.find((c) => c[0] === 'gain'); // first gain created is the master
    assert.equal(master[1].gain.value, 0.4);
    settings.volume = 0;
    assert.equal(a.play('card'), false);
  } finally { delete globalThis.AudioContext; }
});

test('match statistics are derived from the public history', () => {
  const e = engineWith([['3C', '7C', '9C'], ['4C', '8C'], ['5C', '10C'], ['6C', 'JC']]);
  e.play(0, ['3C']); e.play(1, ['4C']); e.play(2, ['5C']); e.play(3, ['6C']); e.play(0, ['7C']);
  e.pass(1); e.pass(2); e.pass(3);
  const s = computeMatchStats(e);
  assert.equal(s.players[0].plays, 2); assert.equal(s.players[1].passes, 1);
  assert.equal(s.players[0].cardsPlayed, 2); assert.equal(s.rounds, 2);
  assert.equal(s.plays, 5);
  const full = playFullMatch({ seed: 3 }).engine;
  const fs = computeMatchStats(full);
  assert.equal(fs.players.reduce((a, p) => a + p.cardsPlayed + p.cardsLeft, 0), 54);
});
