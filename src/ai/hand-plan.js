import { isJoker, rankValue } from '../core/cards.js';

/**
 * Cheap estimate of how many plays are needed to empty a hand (lower = better).
 * Heuristic only: ladders from ranks that hold 1-2 copies, then Tris (+ lower pair as
 * Gandengan), Joker "tekor" on a pair, then singles. Pairs alone are NOT a legal
 * combination, so an unattached pair costs two plays.
 */
export function planHand(hand) {
  const counts = new Array(13).fill(0);
  let jokers = 0;
  for (const c of hand) { if (isJoker(c)) jokers++; else counts[rankValue(c.rank)]++; }
  let plays = 0;
  for (;;) {
    let start = -1, len = 0;
    for (let i = 0; i < 12;) {
      if (counts[i] >= 1 && counts[i] <= 2) {
        let j = i;
        while (j + 1 < 12 && counts[j + 1] >= 1 && counts[j + 1] <= 2) j++;
        if (j - i + 1 >= 3 && j - i + 1 > len) { len = j - i + 1; start = i; }
        i = j + 1;
      } else i++;
    }
    if (start < 0) break;
    for (let k = start; k < start + len; k++) counts[k]--;
    plays++;
  }
  const trisAt = [], pairAt = [];
  let singles = 0;
  counts.forEach((n, i) => {
    if (n >= 3) { trisAt.push(i); if (n === 4) singles++; } else if (n === 2) pairAt.push(i); else if (n === 1) singles++;
  });
  // A Gandengan needs a pair of LOWER rank than its tris: match each tris (high to low) with the highest lower pair.
  let pairs = pairAt.length;
  const free = pairAt.slice().sort((a, b) => b - a);
  for (const t of trisAt.slice().sort((a, b) => b - a)) {
    const k = free.findIndex((q) => q < t);
    if (k >= 0) { free.splice(k, 1); pairs--; }
  }
  plays += trisAt.length;
  const tekor = Math.min(jokers, pairs);
  plays += tekor; pairs -= tekor; jokers -= tekor;
  return plays + pairs * 2 + singles + jokers;
}

/** Strong "controller" cards: Jokers, 2s and Aces. */
export function controllers(hand) {
  return hand.filter((c) => isJoker(c) || c.rank === '2' || c.rank === 'A').length;
}
