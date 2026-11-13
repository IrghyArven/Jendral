import { comboValue, hasJoker, breakPenalty, opponentCounts, unseenBeaters, argmin, rankCounts } from './decision.js';
import { planHand, controllers } from './hand-plan.js';
import { unseenInfo, jenderalRisk } from './knowledge.js';
import { fourOfKindRanks } from '../core/general.js';

/**
 * Personality = style (independent of difficulty). value/brk/joker are cost weights,
 * sizeLead/sizeFollow reward dumping more cards, passRelaxed = opponents' minimum
 * card count above which the AI is willing to pass instead of spending a strong card.
 */
export const PERSONALITIES = Object.freeze({
  aggressive: { value: 0.4, brk: 0.2, joker: 6, sizeLead: 4,   sizeFollow: 4, passRelaxed: Infinity, passCost: Infinity, rush: 1 },
  strategic:  { value: 1,   brk: 1,   joker: 8, sizeLead: 2.2, sizeFollow: 2.2, passRelaxed: 9,      passCost: 12,       rush: 0 },
  adaptive:   { value: 1,   brk: 1,   joker: 8, sizeLead: 2.2, sizeFollow: 2.2, passRelaxed: 9,      passCost: Infinity, rush: 1 },
});

function pick(list, rng) { return list[Math.floor(rng() * list.length)]; }

/**
 * Returns the chosen combo, or null to pass. Input is the AI's own view only.
 * brain = { personality, caps }.
 */
export function chooseMove(view, plays, brain, rng = Math.random) {
  const K = brain.caps, P = PERSONALITIES[brain.personality];
  const hand = view.hand, leading = view.leading;

  const finishers = plays.filter((c) => c.size === hand.length);
  if (finishers.length && rng() < K.finishRecog) return finishers[0];
  if (rng() < K.noise) return pick(leading ? plays : [...plays, null], rng);

  if (K.greedy) { // Easy: take the cheapest-looking play, no hand management
    return argmin(plays, (c) => comboValue(c) - c.size * 0.8 + (hasJoker(c) ? 2 : 0) * K.jokerCare);
  }

  const opp = opponentCounts(view);
  const minOpp = opp.length ? Math.min(...opp) : 99;
  const info = K.track || K.risk || K.keep4 ? unseenInfo(view) : null;
  const risk = K.risk >= 2 && info ? jenderalRisk(view, info) : 0;
  const coarseRisk = K.risk === 1 && info ? Object.values(info.rankUnseen).some((n) => n === 4) && opp.some((n) => n >= 4) : false;
  const keep = new Set(K.keep4 && info && info.jokersUnseen > 0 ? fourOfKindRanks(hand) : []);

  const cost = (c) => {
    let brk = breakPenalty(c, hand) * P.brk * K.breakCare;
    if (keep.size) for (const r of Object.keys(rankCounts(c.cards))) if (keep.has(r)) brk += 6; // a live four-of-a-kind can still win via Jenderal
    let s = P.value * comboValue(c) + brk + P.joker * K.jokerCare * (hasJoker(c) ? 1 : 0);
    s -= (leading ? P.sizeLead : P.sizeFollow) * c.size;
    if (K.track && unseenBeaters(view, c) === 0) s -= 4; // nothing unseen can beat it
    if (c.joker) { if (K.risk >= 2) s += 60 * risk; else if (coarseRisk) s += 5; }
    if (K.plan) {
      const used = new Set(c.cards.map((x) => x.id));
      s += K.plan * planHand(hand.filter((x) => !used.has(x.id)));
    }
    return s;
  };

  // Opponent on one card can only go out with a single: lead groups, otherwise lead/answer high.
  const nearOut = (K.threat ? minOpp <= 1 : P.rush > 0 && K.oppAware && minOpp <= P.rush);
  if (leading) {
    if (nearOut) {
      const multi = plays.filter((c) => c.size > 1);
      return multi.length ? argmin(multi, cost) : argmin(plays, (c) => -comboValue(c));
    }
    return argmin(plays, cost);
  }
  if (nearOut && minOpp <= 2) return argmin(plays, (c) => -comboValue(c));
  const best = argmin(plays, cost);

  if (P.passRelaxed === Infinity || !K.oppAware) return best;
  const relaxed = opp.every((n) => n >= P.passRelaxed);
  const bestCost = cost(best);
  if (K.smartPass) {
    const used = new Set(best.cards.map((x) => x.id));
    const progress = planHand(hand) - planHand(hand.filter((x) => !used.has(x.id)));
    if (!nearOut && (hasJoker(best) || comboValue(best) >= 11) && progress <= 1 && hand.length > 4 && minOpp >= 4) return null;
    if (relaxed && controllers(hand) <= 1 && comboValue(best) >= 10 && progress <= 1) return null;
    return best;
  }
  if (relaxed && (hasJoker(best) || comboValue(best) >= 11 || bestCost > P.passCost)) return null;
  return best;
}
