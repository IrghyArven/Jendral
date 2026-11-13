import { RANKS, isJoker } from '../core/cards.js';
import { createDeck } from '../core/deck.js';

const ALL_CARDS = createDeck();

/** Cards neither in my hand nor already played (public). Never reads opponents' hands. */
export function unseenInfo(view) {
  const known = new Set([...view.hand, ...view.playedCards].map((c) => c.id));
  const rankUnseen = {};
  let jokersUnseen = 0, total = 0;
  for (const c of ALL_CARDS) {
    if (known.has(c.id)) continue;
    total++;
    if (isJoker(c)) jokersUnseen++; else rankUnseen[c.rank] = (rankUnseen[c.rank] || 0) + 1;
  }
  return { rankUnseen, jokersUnseen, total };
}

/** Opponents who would get a Jenderal chance after my Joker, using public info only. */
function eligibleOpponents(view) {
  const n = view.handCounts.length;
  const out = [];
  for (let i = 1; i < n; i++) {
    const p = (view.player + i) % n;
    if (view.handCounts[p] > 0) out.push(p);
  }
  return view.rules?.jenderal?.eligibility === 'nextPlayerOnly' ? out.slice(0, 1) : out;
}

/**
 * Rough probability that some eligible opponent holds all four cards of a rank
 * (only ranks that are completely unseen can be a four-of-a-kind in an opponent hand).
 */
export function jenderalRisk(view, info = unseenInfo(view)) {
  const opps = eligibleOpponents(view).filter((p) => view.handCounts[p] >= 4);
  if (!opps.length || info.total < 4) return 0;
  let risk = 0;
  for (const r of RANKS) {
    if (info.rankUnseen[r] !== 4) continue;
    for (const p of opps) {
      let pr = 1;
      for (let k = 0; k < 4; k++) pr *= (view.handCounts[p] - k) / (info.total - k);
      risk += pr;
    }
  }
  return Math.min(1, risk);
}
