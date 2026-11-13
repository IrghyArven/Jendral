import { RANKS, isJoker, cardValue, cardColor, rankValue } from './cards.js';
import { DEFAULT_RULES, isRankAllowedInTangga } from './rules.js';

export const TYPES = Object.freeze({
  SINGLE: 'single', TRIS: 'tris', GANDENGAN: 'trisGandengan', TANGGA: 'tangga',
});
export const TYPE_LABEL = Object.freeze({
  single: 'Tunggal', tris: 'Tris', trisGandengan: 'Tris Gandengan', tangga: 'Tangga',
});

const byValue = (a, b) => cardValue(a) - cardValue(b) || a.id.localeCompare(b.id);

function groupByRank(cards) {
  const m = new Map();
  for (const c of cards) {
    if (isJoker(c)) continue;
    if (!m.has(c.rank)) m.set(c.rank, []);
    m.get(c.rank).push(c);
  }
  return m;
}

function gandenganParts(groups, jokerCount, rules) {
  if (jokerCount > 0 && !rules.trisGandengan.allowJoker) return null;
  if (jokerCount > 1 || groups.size !== 2) return null;
  const e = [...groups.entries()].map(([r, g]) => [rankValue(r), g.length]).sort((a, b) => b[0] - a[0]);
  const [[hv, hc], [, lc]] = e;
  const j = jokerCount;
  if ((hc + j === 3 && lc === 2) || (hc === 3 && lc + j === 2)) return { triple: hv };
  return null;
}

/** Classify a set of cards. Returns {type,size,value,cards,...} or null when not a legal combination. */
export function classify(cards, rules = DEFAULT_RULES) {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  if (new Set(cards.map((c) => c.id)).size !== cards.length) return null;
  const sorted = cards.slice().sort(byValue);
  const n = sorted.length;
  const jokers = sorted.filter(isJoker);
  const groups = groupByRank(sorted);
  const make = (type, value, extra = {}) => ({ type, size: n, value, cards: sorted, ...extra });

  if (n === 1) return make(TYPES.SINGLE, cardValue(sorted[0]), { joker: isJoker(sorted[0]) });

  // Tris (+ "tris tekor satu": two of a rank + one Joker)
  if (n === 3 && jokers.length <= 1 && groups.size === 1) {
    const [rank, g] = [...groups.entries()][0];
    if (g.length + jokers.length === 3) return make(TYPES.TRIS, rankValue(rank), { tekor: jokers.length === 1 });
  }
  // Tris gandengan: triple + lower pair
  if (n === 5) {
    const p = gandenganParts(groups, jokers.length, rules);
    if (p) return make(TYPES.GANDENGAN, p.triple, { tekor: jokers.length > 0 });
  }
  // Tangga: >= minLength consecutive distinct ranks, no Jokers
  if (n >= rules.tangga.minLength && jokers.length === 0 && groups.size === n) {
    const vals = sorted.map((c) => rankValue(c.rank));
    const consecutive = vals.every((v, i) => i === 0 || v === vals[i - 1] + 1);
    if (consecutive && sorted.every((c) => isRankAllowedInTangga(c.rank, rules))) {
      return make(TYPES.TANGGA, vals[n - 1]);
    }
  }
  return null;
}

/** Can `next` be played over `prev`? prev === null means leading (anything goes). */
export function beats(prev, next) {
  if (!next) return false;
  if (!prev) return true;
  if (prev.type !== next.type) return false;
  switch (next.type) {
    case TYPES.SINGLE: {
      const p = prev.cards[0];
      const c = next.cards[0];
      if (isJoker(p)) return false; // ordinary cards (and the other Joker) cannot beat a Joker
      if (isJoker(c)) return cardColor(p) === c.joker; // Joker only beats a card of its own colour
      return next.value > prev.value;
    }
    case TYPES.TANGGA:
      return next.size === prev.size && next.value > prev.value;
    default:
      return next.value > prev.value;
  }
}

export function choose(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const out = [];
  (function rec(start, cur) {
    if (cur.length === k) return void out.push(cur.slice());
    for (let i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
  })(0, []);
  return out;
}

const MAX_LADDER_VARIANTS = 24;

/** Every classifiable combination in a hand (ignores the table). */
export function generateCombos(hand, rules = DEFAULT_RULES) {
  const out = [];
  const add = (cs) => { const c = classify(cs, rules); if (c) out.push(c); };
  const groups = groupByRank(hand);
  const jokers = hand.filter(isJoker);

  hand.forEach((c) => add([c]));
  for (const [, g] of groups) {
    if (g.length >= 3) choose(g, 3).forEach(add);
    if (g.length >= 2) for (const pair of choose(g, 2)) for (const j of jokers) add([...pair, j]);
  }
  for (const [r, g] of groups) {
    if (g.length < 3) continue;
    for (const [r2, g2] of groups) {
      if (rankValue(r2) >= rankValue(r) || g2.length < 2) continue;
      for (const t of choose(g, 3)) for (const p of choose(g2, 2)) add([...t, ...p]);
    }
  }
  const min = rules.tangga.minLength;
  const vals = [...groups.keys()].filter((r) => isRankAllowedInTangga(r, rules)).map(rankValue).sort((a, b) => a - b);
  for (let i = 0; i < vals.length; i++) {
    for (let j = i + min - 1; j < vals.length; j++) {
      if (vals[j] - vals[i] !== j - i) break;
      let prods = [[]];
      for (const v of vals.slice(i, j + 1)) {
        prods = prods.flatMap((p) => groups.get(RANKS[v]).map((c) => [...p, c])).slice(0, MAX_LADDER_VARIANTS);
      }
      prods.forEach(add);
    }
  }
  return out;
}
