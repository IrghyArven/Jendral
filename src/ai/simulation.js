import { GameEngine, applyAction } from '../core/game-engine.js';
import { AIPlayer } from './ai-player.js';
import { createRng } from '../core/shuffle.js';
import { breakPenalty, comboValue } from './decision.js';
import { fourOfKindRanks } from '../core/general.js';

const DEFAULT_PERSONALITIES = ['aggressive', 'strategic', 'adaptive', 'strategic'];
const newMetrics = () => ({ decisions: 0, plays: 0, passes: 0, jokerSingles: 0, jokerWaste: 0, jenderalGift: 0, overkill: 0, structureBreak: 0, missedFinish: 0, jenderalDeclined: 0, jenderalWins: 0 });

/** Judge one decision with full engine knowledge (the AI itself never sees this). */
function judge(engine, actor, action, m) {
  m.decisions++;
  if (action.type === 'pass') {
    m.passes++;
    if (engine.legalPlays(actor).some((c) => c.size === engine.hands[actor].length)) m.missedFinish++;
    return;
  }
  if (action.type === 'declineGeneral') { m.jenderalDeclined++; return; }
  if (action.type === 'general') { m.jenderalWins++; return; }
  m.plays++;
  const legal = engine.legalPlays(actor);
  const hand = engine.hands[actor];
  const chosen = legal.find((c) => c.cards.length === action.ids.length && c.cards.every((x) => action.ids.includes(x.id)));
  if (!chosen) return;
  if (chosen.size === hand.length) return; // finishing is always fine
  if (legal.some((c) => c.size === hand.length)) m.missedFinish++;
  if (chosen.joker) {
    m.jokerSingles++;
    if (legal.some((c) => !c.joker && c.type === 'single')) m.jokerWaste++;
    if (engine.hands.some((h, i) => i !== actor && fourOfKindRanks(h).length > 0)) m.jenderalGift++;
  }
  const same = legal.filter((c) => c.type === chosen.type && !c.joker);
  if (same.length > 1 && !chosen.joker) {
    const cheapest = Math.min(...same.map(comboValue));
    if (comboValue(chosen) - cheapest >= 5 && !engine.tm.leading) m.overkill++;
  }
  if (legal.some((c) => breakPenalty(c, hand) === 0) && breakPenalty(chosen, hand) >= 4) m.structureBreak++;
}

/**
 * Play a whole match with AI in all seats, checking invariants after every action.
 * seats: [{personality, difficulty}] x4 (or legacy `personalities` array, Normal level).
 */
export function playFullMatch({ seed, seats, personalities = DEFAULT_PERSONALITIES, difficulty = 'normal', maxSteps = 5000, rules, collect = false } = {}) {
  const engine = new GameEngine({ seed, rules });
  const rng = createRng(((seed ?? 1) * 2654435761) >>> 0 || 7);
  const cfg = seats || personalities.map((personality) => ({ personality, difficulty }));
  const ais = cfg.map((s) => new AIPlayer(s.personality, s.difficulty ?? difficulty, { rng }));
  const metrics = cfg.map(newMetrics);
  const errors = [];
  let steps = 0;
  while (engine.phase !== 'over') {
    if (++steps > maxSteps) { errors.push('Melebihi batas langkah (kemungkinan loop)'); break; }
    const actor = engine.actor();
    if (actor == null) { errors.push('Tidak ada pemain yang harus bertindak'); break; }
    const action = ais[actor].decide(engine.view(actor));
    if (collect) judge(engine, actor, action, metrics[actor]);
    const res = applyAction(engine, actor, action);
    if (!res.ok) { errors.push(`Aksi ilegal pemain ${actor}: ${JSON.stringify(action)} -> ${res.error}`); break; }
    const ids = [...engine.hands.flat(), ...engine.playedCards].map((c) => c.id);
    if (ids.length !== 54 || new Set(ids).size !== 54) { errors.push('Kartu duplikat atau hilang'); break; }
  }
  const r = engine.result;
  if (!r) errors.push('Tidak ada hasil akhir');
  else if (r.type === 'normal' && new Set(r.order).size !== 4) errors.push('Urutan selesai tidak lengkap');
  return { engine, steps, errors, result: r, metrics };
}
