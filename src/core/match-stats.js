import { TYPE_LABEL } from './combinations.js';

/** Derive per-player and overall statistics from engine.history (public data only). */
export function computeMatchStats(engine) {
  const n = engine.hands.length;
  const players = Array.from({ length: n }, (_, i) => ({
    player: i, name: engine.names[i], plays: 0, passes: 0, cardsPlayed: 0, jokers: 0, cardsLeft: engine.hands[i].length,
    byType: { single: 0, tris: 0, trisGandengan: 0, tangga: 0 }, jenderal: false,
  }));
  let rounds = 1, jokerSingles = 0;
  for (const h of engine.history) {
    if (h.action === 'trickEnd') { rounds++; continue; }
    const p = players[h.player];
    if (!p) continue;
    if (h.action === 'play') {
      p.plays++; p.cardsPlayed += h.cards.length; p.byType[h.type] = (p.byType[h.type] || 0) + 1;
      if (h.cards.some((id) => id === 'JR' || id === 'JB')) { p.jokers++; if (h.type === 'single') jokerSingles++; }
    } else if (h.action === 'pass') p.passes++;
    else if (h.action === 'jenderal') { p.jenderal = true; p.cardsPlayed += h.cards.length; }
  }
  const plays = players.reduce((a, p) => a + p.plays, 0);
  return { players, rounds, plays, jokerSingles, actions: engine.history.length, typeLabel: TYPE_LABEL };
}
