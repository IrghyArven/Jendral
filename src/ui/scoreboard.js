import { DIFFICULTY_LABEL } from '../ai/difficulty.js';

const KEY = 'jenderal.stats.v1';
const empty = () => ({ games: 0, wins: 0, losses: 0, jenderalWins: 0, jenderalLosses: 0, places: [0, 0, 0, 0], byDiff: {} });

export function loadStats(storage = globalThis.localStorage) {
  try {
    const s = JSON.parse(storage.getItem(KEY));
    if (s && Array.isArray(s.places) && s.places.length === 4) return { ...empty(), ...s, byDiff: s.byDiff && typeof s.byDiff === 'object' ? s.byDiff : {} };
  } catch { /* ignore */ }
  return empty();
}
function save(s, storage = globalThis.localStorage) { try { storage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

/** diffKey: one of the difficulty ids, or 'mixed' when the AIs differ. */
export function recordResult(result, human = 0, diffKey = null, storage) {
  const s = loadStats(storage);
  s.games++;
  let won = false;
  if (result.type === 'jenderal') {
    if (result.winner === human) { s.wins++; s.jenderalWins++; s.places[0]++; won = true; }
    else { s.losses++; s.jenderalLosses++; s.places[3]++; }
  } else {
    const place = result.order.indexOf(human);
    s.places[place]++;
    if (place === 0) { s.wins++; won = true; }
    if (place === 3) s.losses++;
  }
  if (diffKey) {
    const b = s.byDiff[diffKey] || { games: 0, wins: 0 };
    b.games++; if (won) b.wins++;
    s.byDiff[diffKey] = b;
  }
  save(s, storage);
}
export function resetStats(storage) { save(empty(), storage); }

export function renderStats(dl) {
  const s = loadStats();
  const rows = [
    ['Pertandingan', s.games], ['Menang (juara 1 / Jenderal)', s.wins], ['Kalah (terakhir / kalah Jenderal)', s.losses],
    ['Menang lewat Jenderal', s.jenderalWins], ['Kalah oleh Jenderal', s.jenderalLosses],
    ['Juara 1', s.places[0]], ['Juara 2', s.places[1]], ['Juara 3', s.places[2]], ['Juara 4 (kalah)', s.places[3]],
    ['Persentase menang', s.games ? Math.round((s.wins / s.games) * 100) + '%' : '-'],
  ];
  for (const k of ['easy', 'normal', 'hard', 'expert', 'mixed']) {
    const b = s.byDiff[k];
    if (b) rows.push([`Tingkat ${k === 'mixed' ? 'Campuran' : DIFFICULTY_LABEL[k]}`, `${b.wins}/${b.games} menang`]);
  }
  dl.replaceChildren();
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = String(v);
    dl.append(dt, dd);
  }
}
