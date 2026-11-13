/**
 * Optional sound effects, synthesised with the Web Audio API (no audio files, nothing
 * copyrighted). If audio is unavailable or blocked the game works exactly the same.
 */
const SOUNDS = {
  select: [{ f: 880, d: 0.04, t: 'triangle', g: 0.25 }],
  card:   [{ f: 0, d: 0.07, noise: true, g: 0.6 }, { f: 220, d: 0.06, t: 'sine', g: 0.3, at: 0.01 }],
  turn:   [{ f: 660, d: 0.07, t: 'sine', g: 0.25 }, { f: 880, d: 0.09, t: 'sine', g: 0.25, at: 0.07 }],
  pass:   [{ f: 260, d: 0.14, t: 'sine', g: 0.3, slide: 150 }],
  error:  [{ f: 130, d: 0.16, t: 'square', g: 0.18 }],
  finish: [{ f: 523, d: 0.1, t: 'triangle', g: 0.3 }, { f: 784, d: 0.16, t: 'triangle', g: 0.3, at: 0.09 }],
  jenderal: [{ f: 0, d: 0.25, noise: true, g: 0.7 }, { f: 262, d: 0.2, t: 'sawtooth', g: 0.28 }, { f: 330, d: 0.2, t: 'sawtooth', g: 0.28, at: 0.14 }, { f: 392, d: 0.2, t: 'sawtooth', g: 0.28, at: 0.28 }, { f: 523, d: 0.5, t: 'sawtooth', g: 0.3, at: 0.42 }],
  win:    [523, 659, 784, 1047].map((f, i) => ({ f, d: 0.22, t: 'triangle', g: 0.32, at: i * 0.14 })),
  lose:   [392, 349, 311, 262].map((f, i) => ({ f, d: 0.3, t: 'sine', g: 0.3, at: i * 0.2 })),
};
export const SOUND_NAMES = Object.keys(SOUNDS);

export function createAudio(getSettings) {
  let ctx = null, master = null, noiseBuf = null;
  const ensure = () => {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    } catch { ctx = null; }
    return ctx;
  };
  return {
    /** Call from a user gesture (browsers block audio before the first tap/click). */
    unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {}); },
    play(name) {
      const s = getSettings();
      if (!s.sound || s.volume <= 0 || !SOUNDS[name]) return false;
      const c = ensure();
      if (!c) return false;
      try {
        master.gain.value = s.volume;
        const t0 = c.currentTime;
        for (const n of SOUNDS[name]) {
          const start = t0 + (n.at || 0);
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, start);
          g.gain.exponentialRampToValueAtTime(n.g, start + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
          g.connect(master);
          let src;
          if (n.noise) { src = c.createBufferSource(); src.buffer = noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; src.connect(f); f.connect(g); }
          else { src = c.createOscillator(); src.type = n.t; src.frequency.setValueAtTime(n.f, start); if (n.slide) src.frequency.linearRampToValueAtTime(n.slide, start + n.d); src.connect(g); }
          src.start(start); src.stop(start + n.d + 0.02);
        }
        return true;
      } catch { return false; }
    },
  };
}
