import { isJoker, THREE_CLUBS_ID } from './cards.js';
import { createDeck } from './deck.js';
import { createRng, shuffle } from './shuffle.js';
import { deal, findStarter, sortHand } from './distribution.js';
import { classify, beats, generateCombos } from './combinations.js';
import { mergeRules } from './rules.js';
import { fourOfKindRanks, isJokerSingle, jenderalCandidates } from './general.js';
import { TurnManager } from './turn-manager.js';
import { PHASE, DEFAULT_NAMES, fail } from './game-state.js';

/**
 * Authoritative game engine. ALL rule checks live here; UI and AI only call
 * play / pass / general / declineGeneral and receive {ok, error}.
 * Options: seed, rules, names, and (tests only) hands = custom deal.
 */
export class GameEngine {
  constructor({ seed, rules, names, hands } = {}) {
    this.seed = (seed ?? Date.now()) >>> 0;
    this.rules = mergeRules(rules);
    this.names = names ? names.slice() : DEFAULT_NAMES.slice();
    this.hands = hands
      ? hands.map((h) => sortHand(h))
      : deal(shuffle(createDeck(), createRng(this.seed)), 4);
    this.tm = new TurnManager(4);
    this.table = null; // { player, combo } currently on the table
    this.phase = PHASE.PLAYING;
    this.firstMove = true;
    this.generalQueue = [];
    this.jokerPlayer = null;
    this.result = null;
    this.history = [];
    this.playedCards = [];
    this.starter = findStarter(this.hands);
    if (this.starter < 0) throw new Error('Tidak ada pemain yang memegang 3♣');
    this.tm.current = this.starter;
  }

  /** Player who must act now (also during the Jenderal window), or null when over. */
  actor() {
    if (this.phase === PHASE.PLAYING) return this.tm.current;
    if (this.phase === PHASE.JENDERAL) return this.generalQueue[0];
    return null;
  }

  log(entry) { this.history.push({ n: this.history.length, ...entry }); }

  #comboError(combo) {
    if (this.firstMove) {
      return combo.type === 'single' && combo.cards[0].id === THREE_CLUBS_ID ? null : 'Langkah pertama harus 3♣ tunggal';
    }
    if (this.tm.leading) return null;
    return beats(this.table.combo, combo) ? null : 'Tidak bisa mengalahkan kartu di meja';
  }

  validatePlay(player, ids) {
    if (this.phase !== PHASE.PLAYING) return fail('Sekarang bukan fase bermain');
    if (player !== this.tm.current) return fail('Bukan giliranmu');
    if (!Array.isArray(ids) || ids.length === 0) return fail('Pilih kartu dulu');
    if (new Set(ids).size !== ids.length) return fail('Kartu ganda');
    const cards = ids.map((id) => this.hands[player].find((c) => c.id === id));
    if (cards.some((c) => !c)) return fail('Kartu tidak ada di tanganmu');
    const combo = classify(cards, this.rules);
    if (!combo) return fail('Bukan kombinasi yang sah');
    const err = this.#comboError(combo);
    return err ? fail(err) : { ok: true, combo };
  }

  legalPlays(player) {
    if (this.phase !== PHASE.PLAYING || player !== this.tm.current) return [];
    return generateCombos(this.hands[player], this.rules).filter((c) => this.#comboError(c) === null);
  }

  play(player, ids) {
    const v = this.validatePlay(player, ids);
    if (!v.ok) return v;
    const idset = new Set(ids);
    this.hands[player] = this.hands[player].filter((c) => !idset.has(c.id));
    this.table = { player, combo: v.combo };
    this.firstMove = false;
    this.playedCards.push(...v.combo.cards);
    this.log({ player, action: 'play', type: v.combo.type, cards: ids.slice() });
    let finished = false;
    if (this.hands[player].length === 0) { this.tm.playerFinished(player); finished = true; }
    // Record the play before checking whether the normal match can end. A final
    // Joker may still be intercepted by the last active opponent's Jenderal.
    this.tm.recordPlay(player);
    if (isJokerSingle(v.combo)) {
      const queue = jenderalCandidates({
        hands: this.hands, activeOrder: this.tm.activeOrderAfter(player), rules: this.rules,
      });
      if (queue.length) {
        this.phase = PHASE.JENDERAL;
        this.generalQueue = queue;
        this.jokerPlayer = player;
        return { ok: true, combo: v.combo, finished, over: false, jenderalWindow: true };
      }
    }

    const active = this.tm.activePlayers();
    if (active.length <= 1) {
      if (active.length === 1) this.tm.playerFinished(active[0]); // last player = loser
      this.#endNormal();
      return { ok: true, combo: v.combo, finished, over: true };
    }
    return { ok: true, combo: v.combo, finished, over: false };
  }

  pass(player) {
    if (this.phase !== PHASE.PLAYING) return fail('Sekarang bukan fase bermain');
    if (player !== this.tm.current) return fail('Bukan giliranmu');
    if (this.tm.leading) return fail('Pemimpin putaran tidak boleh lewat');
    const r = this.tm.recordPass(player);
    this.log({ player, action: 'pass' });
    if (r.trickEnded) { this.table = null; this.log({ action: 'trickEnd', leader: r.leader }); }
    return { ok: true, ...r };
  }

  general(player, rank) {
    if (this.phase !== PHASE.JENDERAL) return fail('Jenderal hanya bisa setelah Joker tunggal dimainkan');
    if (player !== this.generalQueue[0]) return fail('Bukan kesempatanmu untuk Jenderal');
    const ranks = fourOfKindRanks(this.hands[player]);
    const r = rank ?? ranks[0];
    if (!ranks.includes(r)) return fail('Kamu tidak punya empat kartu sama');
    const cards = this.hands[player].filter((c) => !isJoker(c) && c.rank === r);
    this.hands[player] = this.hands[player].filter((c) => !cards.includes(c));
    this.playedCards.push(...cards);
    this.log({ player, action: 'jenderal', rank: r, cards: cards.map((c) => c.id) });
    this.phase = PHASE.OVER;
    this.generalQueue = [];
    const others = [0, 1, 2, 3].filter((p) => p !== player);
    this.result = { type: 'jenderal', winner: player, rank: r, jokerPlayer: this.jokerPlayer, order: [player, ...others], losers: others };
    return { ok: true, rank: r };
  }

  declineGeneral(player) {
    if (this.phase !== PHASE.JENDERAL) return fail('Tidak ada kesempatan Jenderal');
    if (player !== this.generalQueue[0]) return fail('Bukan kesempatanmu');
    this.generalQueue.shift();
    this.log({ player, action: 'declineJenderal' });
    if (this.generalQueue.length === 0) {
      this.phase = PHASE.PLAYING;
      const active = this.tm.activePlayers();
      if (active.length <= 1) {
        if (active.length === 1) this.tm.playerFinished(active[0]);
        this.#endNormal();
      }
    }
    return { ok: true, over: this.phase === PHASE.OVER };
  }

  #endNormal() {
    this.phase = PHASE.OVER;
    const order = this.tm.finished.slice();
    this.result = { type: 'normal', order, winner: order[0], loser: order[order.length - 1] };
  }

  /** What a player is allowed to know: own hand + public info. Never opponents' cards. */
  view(player) {
    const queueHead = this.phase === PHASE.JENDERAL ? this.generalQueue[0] : null;
    return {
      player, phase: this.phase, names: this.names.slice(), rules: this.rules,
      hand: this.hands[player].slice(),
      handCounts: this.hands.map((h) => h.length),
      current: this.tm.current, leading: this.tm.leading, firstMove: this.firstMove,
      table: this.table ? { player: this.table.player, combo: this.table.combo } : null,
      passed: [...this.tm.passed], finished: this.tm.finished.slice(),
      playedCards: this.playedCards.slice(), history: this.history.slice(),
      jenderalActor: queueHead, jokerPlayer: this.jokerPlayer,
      canJenderal: queueHead === player,
      jenderalRanks: queueHead === player ? fourOfKindRanks(this.hands[player]) : [],
      legalPlays: this.legalPlays(player),
    };
  }
}

/** Single entry point used by UI and AI: {type:'play'|'pass'|'general'|'declineGeneral'}. */
export function applyAction(engine, player, a) {
  switch (a && a.type) {
    case 'play': return engine.play(player, a.ids);
    case 'pass': return engine.pass(player);
    case 'general': return engine.general(player, a.rank);
    case 'declineGeneral': return engine.declineGeneral(player);
    default: return fail('Aksi tidak dikenal');
  }
}
