import { playFullMatch } from './simulation.js';
import { DIFFICULTIES } from './difficulty.js';

/**
 * Ladder tournament: the four difficulty levels sit at one table (all four seats), rotated
 * through every seat so seat/deal luck cancels out. Reports placement AND decision-quality metrics.
 */
export function runLadder({ seeds = 100, personality = 'strategic', levels = DIFFICULTIES, seedOffset = 0 } = {}) {
  const stats = Object.fromEntries(levels.map((d) => [d, { games: 0, placeSum: 0, wins: 0, losses: 0, steps: 0, errors: 0, m: {} }]));
  let matches = 0, jenderal = 0;
  for (let s = 1; s <= seeds; s++) {
    for (let rot = 0; rot < 4; rot++) {
      const seats = [0, 1, 2, 3].map((i) => ({ personality, difficulty: levels[(i + rot) % levels.length] }));
      const r = playFullMatch({ seed: seedOffset + s, seats, collect: true });
      matches++;
      if (r.result?.type === 'jenderal') jenderal++;
      seats.forEach((seat, i) => {
        const st = stats[seat.difficulty];
        st.games++; st.errors += r.errors.length ? 1 : 0; st.steps += r.steps;
        const place = r.result.order.indexOf(i);
        const placed = r.result.type === 'jenderal' ? (i === r.result.winner ? 0 : 3) : place;
        st.placeSum += placed;
        if (placed === 0) st.wins++;
        if (placed === 3) st.losses++;
        for (const [k, v] of Object.entries(r.metrics[i])) st.m[k] = (st.m[k] || 0) + v;
      });
    }
  }
  const out = {};
  for (const d of levels) {
    const st = stats[d];
    const dec = st.m.decisions || 1;
    out[d] = {
      games: st.games, avgPlace: +(st.placeSum / st.games + 1).toFixed(3), winRate: +(st.wins / st.games).toFixed(3), lastRate: +(st.losses / st.games).toFixed(3),
      per100Decisions: Object.fromEntries(Object.entries(st.m).filter(([k]) => k !== 'decisions').map(([k, v]) => [k, +(v * 100 / dec).toFixed(2)])),
      errors: st.errors,
    };
  }
  return { matches, jenderal, personality, levels: out };
}
