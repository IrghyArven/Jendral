// Usage: node scripts/simulate.mjs [matches=500]
// Plays full AI-only matches with random personalities AND random difficulty per seat,
// checking engine invariants after every action.
import { playFullMatch } from '../src/ai/simulation.js';
import { DIFFICULTIES } from '../src/ai/difficulty.js';
import { createRng } from '../src/core/shuffle.js';

const n = Number(process.argv[2]) || 500;
const rng = createRng(12345);
const pick = (a) => a[Math.floor(rng() * a.length)];
const PERS = ['aggressive', 'strategic', 'adaptive'];
let bad = 0, jenderal = 0, steps = 0, maxSteps = 0;
const byLevel = Object.fromEntries(DIFFICULTIES.map((d) => [d, 0]));
for (let seed = 1; seed <= n; seed++) {
  const seats = [0, 1, 2, 3].map(() => ({ personality: pick(PERS), difficulty: pick(DIFFICULTIES) }));
  seats.forEach((s) => byLevel[s.difficulty]++);
  const r = playFullMatch({ seed, seats });
  steps += r.steps; maxSteps = Math.max(maxSteps, r.steps);
  if (r.result?.type === 'jenderal') jenderal++;
  if (r.errors.length) { bad++; console.error('seed', seed, JSON.stringify(seats), r.errors); }
}
console.log(`${n} pertandingan, ${bad} bermasalah, ${jenderal} berakhir Jenderal, rata-rata ${(steps / n).toFixed(0)} langkah (maks ${maxSteps})`);
console.log('kursi per tingkat:', JSON.stringify(byLevel));
process.exit(bad ? 1 : 0);
