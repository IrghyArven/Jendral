import { GameEngine, applyAction } from '../core/game-engine.js';
import { AIPlayer, PERSONALITY_LABEL } from '../ai/ai-player.js';
import { DIFFICULTIES, DIFFICULTY_LABEL, DIFFICULTY_INFO } from '../ai/difficulty.js';
import { createRng } from '../core/shuffle.js';
import { cardsFromIds } from '../core/cards.js';
import { renderHand } from './hand.js';
import { renderSeat } from './player.js';
import { renderCenter } from './table.js';
import { toast, jenderalEffect, confetti } from './effects.js';
import { recordResult, renderStats, resetStats } from './scoreboard.js';
import { TYPE_LABEL } from '../core/combinations.js';
import { computeMatchStats } from '../core/match-stats.js';
import { loadSettings, saveSettings, seatConfig } from './settings.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const DELAY = { slow: 1500, normal: 900, fast: 350 };
const AI_NAMES = ['', 'Budi', 'Sari', 'Dewa'];

let settings = loadSettings();
const audio = createAudio(() => settings);
let engine = null, ais = [], timer = null, paused = false, recorded = false, lastShown = -1;
let gameId = 0, busy = false, dealing = false, seats = [], matchSeed = 0, seedFixed = false, lastHumanTurn = false;
const selected = new Set();

// ---------- navigation & settings ----------
function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
  if (name === 'stats') renderStats($('stats-list'));
  if (name === 'new') refreshNewScreen();
}
function applySettings() {
  $('app').dataset.anim = settings.anim;
  document.querySelectorAll('[data-setting]').forEach((el) => {
    const k = el.dataset.setting;
    if (el.type === 'checkbox') el.checked = !!settings[k];
    else if (k === 'volume') el.value = String(Math.round(settings.volume * 100));
    else el.value = settings[k];
  });
}
function bindSettings() {
  document.querySelectorAll('[data-setting]').forEach((el) => {
    el.addEventListener('change', () => {
      const k = el.dataset.setting;
      settings[k] = el.type === 'checkbox' ? el.checked : k === 'volume' ? Number(el.value) / 100 : el.value;
      saveSettings(settings); applySettings();
      if (k === 'hints' && engine) render();
      if (k === 'volume' || k === 'sound') audio.play('select');
    });
  });
}

function refreshNewScreen() {
  $('in-name').value = settings.name;
  $('in-seed').value = settings.seed;
  $('in-perai').checked = settings.perAi;
  document.querySelectorAll('#seg-diff .segbtn').forEach((b) => {
    const on = b.dataset.diff === settings.difficulty;
    b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
  });
  $('diff-info').textContent = settings.perAi ? 'Setiap AI memakai tingkat kesulitannya sendiri (lihat di bawah).' : DIFFICULTY_INFO[settings.difficulty];
  document.getElementById('seg-diff').classList.toggle('disabled', settings.perAi);
  const host = $('ai-config');
  host.replaceChildren();
  settings.ais.forEach((a, i) => {
    const row = document.createElement('div'); row.className = 'airow';
    const nm = document.createElement('strong'); nm.textContent = AI_NAMES[i + 1];
    const mk = (labels, current, onChange, label) => {
      const sel = document.createElement('select'); sel.setAttribute('aria-label', `${label} ${AI_NAMES[i + 1]}`);
      for (const [v, t] of Object.entries(labels)) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); }
      sel.value = current; sel.addEventListener('change', () => { onChange(sel.value); saveSettings(settings); }); return sel;
    };
    row.append(nm, mk(PERSONALITY_LABEL, a.personality, (v) => { a.personality = v; }, 'Kepribadian'));
    if (settings.perAi) row.append(mk(DIFFICULTY_LABEL, a.difficulty, (v) => { a.difficulty = v; }, 'Kesulitan'));
    host.appendChild(row);
  });
}

// ---------- game lifecycle ----------
function freshSeed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }

function beginMatch(engineOpts, { seed, fixed }) {
  clearTimeout(timer); gameId++;
  matchSeed = seed; seedFixed = fixed;
  seats = seatConfig(settings);
  engine = new GameEngine({ ...engineOpts, seed, names: [settings.name || 'Kamu', ...AI_NAMES.slice(1)] });
  const rng = createRng((seed * 2654435761) >>> 0 || 7);
  ais = [null, ...seats.map((s) => new AIPlayer(s.personality, s.difficulty, { rng }))];
  selected.clear(); paused = false; recorded = false; lastShown = -1; busy = false; lastHumanTurn = false; dealing = true;
  $('overlay-pause').classList.add('hidden'); $('overlay-jenderal').classList.add('hidden');
  show('game');
  render();
  audio.play('card');
  setTimeout(() => { dealing = false; }, 1200);
  toast(engine.names[engine.starter] + ' memulai dengan 3♣');
  schedule();
}

function startGame() {
  settings.name = ($('in-name').value.trim() || 'Kamu').slice(0, 14);
  const raw = $('in-seed').value.trim();
  settings.seed = /^\d{1,10}$/.test(raw) ? raw : '';
  saveSettings(settings);
  const fixed = settings.seed !== '';
  beginMatch({}, { seed: fixed ? Number(settings.seed) >>> 0 : freshSeed(), fixed });
}
function rematch() { beginMatch({}, { seed: seedFixed ? (matchSeed + 1) >>> 0 : freshSeed(), fixed: seedFixed }); }

function leaveGame() {
  clearTimeout(timer); gameId++; paused = true; engine = null; busy = false;
  $('overlay-pause').classList.add('hidden'); $('overlay-jenderal').classList.add('hidden');
  show('menu');
}

// ---------- rendering ----------
const placeOf = (view, p) => { const i = view.finished.indexOf(p); return i >= 0 ? i + 1 : 0; };
const seatBadge = (p) => `${DIFFICULTY_LABEL[seats[p - 1].difficulty]} · ${PERSONALITY_LABEL[seats[p - 1].personality]}`;

function jenderalChip(view) {
  const chip = $('jen-chip');
  const last = engine.history[engine.history.length - 1];
  let kind = 'closed', text = 'Jenderal: tertutup';
  if (view.phase === 'jenderal') { kind = 'open'; text = `Jenderal: TERBUKA (${view.names[view.jenderalActor]})`; }
  else if (view.phase === 'over' && engine.result?.type === 'jenderal') { kind = 'won'; text = 'JENDERAL!'; }
  else if (last && last.action === 'declineJenderal') { kind = 'declined'; text = 'Jenderal: tidak dipakai'; }
  chip.className = 'jen-chip ' + kind; chip.textContent = text;
}

function statusText(view) {
  if (view.phase === 'over') return 'Pertandingan selesai';
  if (view.phase === 'jenderal') return view.jenderalActor === 0 ? 'Joker dimainkan — kamu bisa JENDERAL!' : `Joker dimainkan — ${view.names[view.jenderalActor]} mempertimbangkan Jenderal…`;
  if (view.finished.includes(0)) return `Kamu sudah selesai (Juara ${placeOf(view, 0)}). Menunggu yang lain…`;
  if (view.current !== 0) return `${view.names[view.current]} sedang bermain…`;
  if (selected.size) {
    const v = engine.validatePlay(0, [...selected]);
    return v.ok ? `Siap dimainkan: ${TYPE_LABEL[v.combo.type]}` : v.error;
  }
  return view.leading ? (view.firstMove ? 'Giliranmu: mainkan 3♣' : 'Giliranmu memimpin: pilih kartu bebas') : 'Giliranmu: kalahkan meja atau lewat';
}

function render() {
  if (!engine) return;
  const view = engine.view(0);
  [1, 2, 3].forEach((p) => {
    const tags = [];
    if (view.phase === 'jenderal' && view.jokerPlayer === p) tags.push({ text: 'JOKER', kind: 'joker' });
    if (view.phase === 'jenderal' && view.jenderalActor === p) tags.push({ text: 'Jenderal?', kind: 'jen' });
    renderSeat($('seat-' + p), {
      name: view.names[p], count: view.handCounts[p], isTurn: view.phase === 'playing' && view.current === p,
      place: placeOf(view, p), passed: view.passed.includes(p), badge: seatBadge(p), tags,
    });
  });
  const animate = engine.history.length !== lastShown; lastShown = engine.history.length;
  renderCenter($('table-label'), $('table-cards'), view, animate);
  jenderalChip(view);

  const myTurn = view.phase === 'playing' && view.current === 0;
  $('seat-0').classList.toggle('turn', myTurn);
  $('you-info').replaceChildren();
  const a = document.createElement('span'); a.textContent = view.names[0] + (placeOf(view, 0) ? ` · Juara ${placeOf(view, 0)}` : '') + (view.passed.includes(0) ? ' · lewat' : '');
  const b = document.createElement('span'); b.textContent = view.hand.length + ' kartu';
  $('you-info').append(a, b);

  const legalIds = myTurn ? new Set(view.legalPlays.flatMap((c) => c.cards.map((x) => x.id))) : null;
  renderHand($('hand'), view.hand, { selected, legalIds, hints: settings.hints && myTurn, onToggle: toggleCard, dealing });

  const valid = myTurn && selected.size > 0 ? engine.validatePlay(0, [...selected]) : null;
  const st = $('status');
  st.textContent = statusText(view);
  st.classList.toggle('warn', !!valid && !valid.ok);
  $('btn-play').disabled = busy || !(valid && valid.ok);
  $('btn-pass').disabled = busy || !(myTurn && !view.leading);
  $('btn-clear').disabled = !selected.size;
  if (myTurn && !lastHumanTurn) audio.play('turn');
  lastHumanTurn = myTurn;
}

function toggleCard(id) {
  if (!engine || busy || engine.phase !== 'playing' || engine.tm.current !== 0) return;
  selected.has(id) ? selected.delete(id) : selected.add(id);
  audio.play('select');
  render();
}

function describe(player, a, res) {
  const n = engine.names[player];
  if (a.type === 'pass') return n + ' lewat';
  if (a.type === 'play') return `${n}: ${TYPE_LABEL[res.combo.type]}${res.combo.joker ? ' JOKER' : ''}`;
  if (a.type === 'declineGeneral') return n + ' tidak memakai Jenderal';
  return '';
}

function doAction(player, a) {
  if (!engine || busy || engine.actor() !== player) return false;
  busy = true;
  try {
    const res = applyAction(engine, player, a);
    if (!res.ok) { audio.play('error'); toast(res.error); render(); return false; }
    if (a.type === 'general') { audio.play('jenderal'); jenderalEffect(engine.names[player]); }
    else {
      audio.play(a.type === 'pass' ? 'pass' : a.type === 'play' ? 'card' : 'select');
      if (res.finished) setTimeout(() => audio.play('finish'), 250);
      if (a.type === 'play' && res.combo.joker) toast(`${engine.names[player]}: JOKER`);
      else if (player !== 0 || a.type === 'pass') toast(describe(player, a, res));
    }
    selected.clear();
    return true;
  } finally {
    busy = false;
    render();
    schedule();
  }
}

function delay() { return engine && engine.tm.finished.includes(0) && engine.phase !== 'over' ? DELAY.fast : (DELAY[settings.speed] || 900); }

function fallbackMove(actor) {
  if (engine.phase === 'jenderal') return { type: 'declineGeneral' };
  const plays = engine.legalPlays(actor);
  return engine.tm.leading && plays.length ? { type: 'play', ids: plays[0].cards.map((c) => c.id) } : { type: 'pass' };
}

function schedule() {
  clearTimeout(timer);
  $('overlay-jenderal').classList.add('hidden');
  if (!engine || paused) return;
  if (engine.phase === 'over') return finish();
  const actor = engine.actor();
  if (actor === 0) {
    if (engine.phase === 'jenderal') {
      $('jen-text').textContent = `${engine.names[engine.jokerPlayer]} memainkan Joker. Kamu punya empat kartu ${engine.view(0).jenderalRanks[0]} — pakai sekarang untuk langsung menang!`;
      $('overlay-jenderal').classList.remove('hidden');
    }
    return;
  }
  const gid = gameId;
  timer = setTimeout(() => {
    if (gid !== gameId || !engine || paused) return;
    const action = ais[actor].decide(engine.view(actor));
    if (!doAction(actor, action)) doAction(actor, fallbackMove(actor)); // safety net: never leave the game stuck
  }, delay());
}

// ---------- results ----------
function finish() {
  if (recorded) return;
  recorded = true;
  const r = engine.result;
  const diffs = new Set(seats.map((s) => s.difficulty));
  recordResult(r, 0, diffs.size === 1 ? [...diffs][0] : 'mixed');
  const gid = gameId;
  setTimeout(() => { if (gid === gameId && engine) showResults(r); }, r.type === 'jenderal' ? 2400 : 900);
}

function showResults(r) {
  const names = engine.names;
  const place = r.type === 'jenderal' ? (r.winner === 0 ? 0 : 3) : r.order.indexOf(0);
  const screen = $('screen-results');
  screen.classList.remove('res-win', 'res-mid', 'res-lose');
  screen.classList.add(place === 0 ? 'res-win' : place === 3 ? 'res-lose' : 'res-mid');
  $('res-title').textContent = place === 0 ? '🏆 Kamu Menang!' : place === 3 ? (r.type === 'jenderal' ? 'Kalah oleh Jenderal' : 'Kamu Kalah') : `Juara ${place + 1}`;
  $('res-sub').textContent = r.type === 'jenderal'
    ? `${names[r.winner]} melakukan JENDERAL dengan empat ${r.rank} dan langsung memenangkan pertandingan!`
    : `Pemenang: ${names[r.winner]} · Kalah: ${names[r.loser]}`;
  const list = $('res-list');
  list.replaceChildren();
  r.order.forEach((p, i) => {
    const li = document.createElement('li');
    li.textContent = names[p] + (p > 0 ? ` (${seatBadge(p)})` : '') + (r.type === 'jenderal' ? (i === 0 ? ' — JENDERAL (menang)' : ' — kalah') : i === 3 ? ' — kalah' : '');
    if (p === 0) li.className = 'me';
    if (r.type === 'jenderal' ? i > 0 : i === 3) li.classList.add('lose');
    list.appendChild(li);
  });
  renderMatchStats($('res-stats'));
  show('results');
  audio.play(place === 3 ? 'lose' : 'win');
  if (place === 0) confetti($('res-confetti'));
}

function renderMatchStats(table) {
  const s = computeMatchStats(engine);
  table.replaceChildren();
  const row = (cells, head) => { const tr = document.createElement('tr'); cells.forEach((c) => { const td = document.createElement(head ? 'th' : 'td'); td.textContent = String(c); tr.appendChild(td); }); table.appendChild(tr); };
  row(['Pemain', 'Main', 'Lewat', 'Kartu keluar', 'Joker', 'Sisa'], true);
  s.players.forEach((p) => row([p.name, p.plays, p.passes, p.cardsPlayed, p.jokers, p.cardsLeft]));
  const cap = document.createElement('caption'); cap.textContent = `${s.rounds} putaran · ${s.plays} kombinasi dimainkan · ${s.jokerSingles} Joker tunggal`;
  table.appendChild(cap);
}

function pause(on) {
  if (!engine || engine.phase === 'over') return;
  paused = on;
  $('overlay-pause').classList.toggle('hidden', !on);
  if (on) clearTimeout(timer); else schedule();
}

// ---------- wiring ----------
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
$('btn-start').addEventListener('click', startGame);
$('btn-again').addEventListener('click', rematch);
$('btn-menu-results').addEventListener('click', leaveGame);
$('btn-play').addEventListener('click', () => { if (selected.size) doAction(0, { type: 'play', ids: [...selected] }); });
$('btn-pass').addEventListener('click', () => doAction(0, { type: 'pass' }));
$('btn-clear').addEventListener('click', () => { selected.clear(); render(); });
$('btn-pause').addEventListener('click', () => pause(true));
$('btn-resume').addEventListener('click', () => pause(false));
$('btn-quit').addEventListener('click', leaveGame);
$('btn-jenderal').addEventListener('click', () => { $('overlay-jenderal').classList.add('hidden'); doAction(0, { type: 'general', rank: engine.view(0).jenderalRanks[0] }); });
$('btn-jen-skip').addEventListener('click', () => { $('overlay-jenderal').classList.add('hidden'); doAction(0, { type: 'declineGeneral' }); });
$('btn-reset-stats').addEventListener('click', () => { resetStats(); renderStats($('stats-list')); });
document.querySelectorAll('#seg-diff .segbtn').forEach((b) => b.addEventListener('click', () => {
  if (settings.perAi) return;
  settings.difficulty = b.dataset.diff; saveSettings(settings); refreshNewScreen(); audio.play('select');
}));
$('in-perai').addEventListener('change', (e) => { settings.perAi = e.target.checked; saveSettings(settings); refreshNewScreen(); });
window.addEventListener('resize', () => { if (engine && engine.phase !== 'over') render(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && engine && engine.phase !== 'over' && !paused && $('screen-game').classList.contains('active')) pause(true);
});

bindSettings();
applySettings();
refreshNewScreen();

// Test hook, only enabled with ?e2e=1: lets browser tests start a match from fixed hands and
// read the human's own view. It exposes nothing a player could not already see on screen.
if (new URLSearchParams(location.search).get('e2e') === '1') {
  window.__jenderal = {
    DIFFICULTIES,
    startWithHands(handIds, { seed = 1, speed = 'fast' } = {}) {
      settings.speed = speed;
      beginMatch({ hands: handIds.map(cardsFromIds) }, { seed, fixed: true });
    },
    humanView() {
      if (!engine) return null;
      const v = engine.view(0);
      return { phase: v.phase, current: v.current, leading: v.leading, finished: v.finished, hand: v.hand.map((c) => c.id), legal: v.legalPlays.map((c) => c.cards.map((x) => x.id)), canJenderal: v.canJenderal, result: engine.result };
    },
    seats: () => seats.slice(),
  };
}
