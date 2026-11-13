const KEY = 'jenderal.settings.v2';
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export const DEFAULTS = () => ({
  speed: 'normal', hints: true, anim: reduced() ? 'reduced' : 'full', sound: true, volume: 0.6,
  name: 'Kamu', seed: '', difficulty: 'normal', perAi: false,
  ais: [{ personality: 'aggressive', difficulty: 'normal' }, { personality: 'strategic', difficulty: 'normal' }, { personality: 'adaptive', difficulty: 'normal' }],
});

const ENUM = {
  speed: ['slow', 'normal', 'fast'], anim: ['full', 'reduced', 'off'],
  difficulty: ['easy', 'normal', 'hard', 'expert'],
};
const PERS = ['aggressive', 'strategic', 'adaptive'];

/** Defensive merge: stored data can be stale or hand-edited. */
export function sanitize(raw) {
  const d = DEFAULTS();
  if (!raw || typeof raw !== 'object') return d;
  for (const k of Object.keys(ENUM)) if (ENUM[k].includes(raw[k])) d[k] = raw[k];
  if (typeof raw.hints === 'boolean') d.hints = raw.hints;
  if (typeof raw.sound === 'boolean') d.sound = raw.sound;
  if (typeof raw.perAi === 'boolean') d.perAi = raw.perAi;
  if (typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1) d.volume = raw.volume;
  if (typeof raw.name === 'string') d.name = raw.name.slice(0, 14);
  if (typeof raw.seed === 'string' && /^\d{0,10}$/.test(raw.seed)) d.seed = raw.seed;
  if (Array.isArray(raw.ais)) {
    d.ais = d.ais.map((def, i) => {
      const a = raw.ais[i] || {};
      return { personality: PERS.includes(a.personality) ? a.personality : def.personality, difficulty: ENUM.difficulty.includes(a.difficulty) ? a.difficulty : def.difficulty };
    });
  }
  return d;
}

export function loadSettings(storage = globalThis.localStorage) {
  try { return sanitize(JSON.parse(storage.getItem(KEY))); } catch { return DEFAULTS(); }
}
export function saveSettings(s, storage = globalThis.localStorage) {
  try { storage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: settings last for this session only */ }
}

/** Final AI seat configuration for a match: [{personality, difficulty}] for seats 1..3. */
export function seatConfig(s) {
  return s.ais.map((a) => ({ personality: a.personality, difficulty: s.perAi ? a.difficulty : s.difficulty }));
}
