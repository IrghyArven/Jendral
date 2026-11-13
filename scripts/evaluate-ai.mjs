// Usage: node scripts/evaluate-ai.mjs [seeds=100] [personality=strategic|aggressive|adaptive|all]
import { runLadder } from '../src/ai/evaluate.js';
const seeds = Number(process.argv[2]) || 100;
const arg = process.argv[3] || 'all';
const list = arg === 'all' ? ['aggressive', 'strategic', 'adaptive'] : [arg];
let bad = 0;
for (const personality of list) {
  const t0 = Date.now();
  const r = runLadder({ seeds, personality });
  console.log(`\n== ${personality}: ${r.matches} pertandingan (${r.jenderal} Jenderal), ${((Date.now() - t0) / 1000).toFixed(1)} dtk`);
  for (const [d, v] of Object.entries(r.levels)) {
    bad += v.errors;
    console.log(d.padEnd(7), `rata-rata peringkat ${v.avgPlace} | menang ${(v.winRate * 100).toFixed(1)}% | terakhir ${(v.lastRate * 100).toFixed(1)}%`, JSON.stringify(v.per100Decisions));
  }
}
process.exit(bad ? 1 : 0);
