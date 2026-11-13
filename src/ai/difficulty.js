/**
 * Difficulty profiles. A level changes ONLY how well the AI decides (information it
 * uses, mistakes it makes, how deep it evaluates); it never changes the rules, and the
 * engine still validates every action. Personality (strategy.js) is independent.
 */
export const DIFFICULTIES = Object.freeze(['easy', 'normal', 'hard', 'expert']);
export const DIFFICULTY_LABEL = Object.freeze({ easy: 'Mudah', normal: 'Normal', hard: 'Sulit', expert: 'Ahli' });
export const DIFFICULTY_INFO = Object.freeze({
  easy: 'Strategi dasar: sering memilih langkah sederhana, kadang keliru, Joker dipakai kurang hemat.',
  normal: 'Strategi standar: menjaga kombinasi, menyimpan kartu besar dan Joker, membaca jumlah kartu lawan.',
  hard: 'Lebih strategis: mengejar penyelesaian kartu, melacak kartu yang sudah keluar, mengelola Joker dan Jenderal.',
  expert: 'Paling optimal dari informasi legal: perencanaan sisa kartu, risiko Jenderal terukur, mengantisipasi lawan hampir habis.',
});

export const CAPS = Object.freeze({
  easy:   { noise: 0.35, finishRecog: 0.65, breakCare: 0.3, jokerCare: 0.25, jenderalTake: 0.75, greedy: true,  oppAware: false, track: false, keep4: false, risk: 0, plan: 0,   threat: false, smartPass: false },
  normal: { noise: 0.06, finishRecog: 1,    breakCare: 1,   jokerCare: 1,    jenderalTake: 1,    greedy: false, oppAware: true,  track: false, keep4: false, risk: 0, plan: 0,   threat: false, smartPass: false },
  hard:   { noise: 0.02, finishRecog: 1,    breakCare: 1,   jokerCare: 1,    jenderalTake: 1,    greedy: false, oppAware: true,  track: true,  keep4: true,  risk: 1, plan: 0.8, threat: false, smartPass: false },
  expert: { noise: 0,    finishRecog: 1,    breakCare: 1,   jokerCare: 1,    jenderalTake: 1,    greedy: false, oppAware: true,  track: true,  keep4: true,  risk: 2, plan: 2,   threat: true,  smartPass: true },
});

export function isDifficulty(d) { return DIFFICULTIES.includes(d); }
