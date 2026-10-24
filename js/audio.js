// 効果音（WebAudioで作る。音声ファイルなし）
let ctx = null, master = null, eng = null, muted = false;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.45; master.connect(ctx.destination);
  } catch (e) { ctx = null; }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.45;
  return muted;
}

export function beep(freq, dur = 0.15, type = 'square', vol = 0.18, slideTo = null) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

export function noise(dur = 0.3, vol = 0.25, freq = 1200) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master); src.start(t);
}

export function engineOn() {
  if (!ctx || eng) return;
  const o = ctx.createOscillator(), o2 = ctx.createOscillator();
  const f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o2.type = 'square';
  f.type = 'lowpass'; f.frequency.value = 600;
  g.gain.value = 0;
  o.connect(f); o2.connect(f); f.connect(g); g.connect(master);
  o.start(); o2.start();
  eng = { o, o2, f, g };
}

export function engineUpdate(ratio, boost) {
  if (!eng) return;
  const t = ctx.currentTime;
  const fr = 55 + ratio * 120 + (boost ? 40 : 0);
  eng.o.frequency.setTargetAtTime(fr, t, 0.05);
  eng.o2.frequency.setTargetAtTime(fr * 0.5, t, 0.05);
  eng.f.frequency.setTargetAtTime(400 + ratio * 900, t, 0.05);
  eng.g.gain.setTargetAtTime(0.05 + ratio * 0.05, t, 0.05);
}

export function engineOff() {
  if (!eng) return;
  const e = eng; eng = null;
  e.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  setTimeout(() => { try { e.o.stop(); e.o2.stop(); } catch (er) { /* 無視 */ } }, 300);
}

export const sfx = {
  menu: () => beep(660, 0.06, 'square', 0.08),
  select: () => { beep(660, 0.07, 'square', 0.1); setTimeout(() => beep(990, 0.09, 'square', 0.1), 60); },
  count: () => beep(440, 0.25, 'square', 0.18),
  go: () => beep(880, 0.5, 'square', 0.2),
  item: () => { for (let i = 0; i < 4; i++) setTimeout(() => beep(500 + i * 180, 0.06, 'triangle', 0.12), i * 50); },
  roll: () => beep(800 + Math.random() * 400, 0.03, 'square', 0.04),
  boost: () => { noise(0.45, 0.2, 2500); beep(300, 0.4, 'sawtooth', 0.08, 900); },
  throw: () => beep(700, 0.15, 'triangle', 0.12, 300),
  hit: () => { noise(0.5, 0.35, 900); beep(300, 0.4, 'square', 0.1, 80); },
  shield: () => beep(500, 0.3, 'sine', 0.15, 1000),
  lap: () => { beep(784, 0.12, 'square', 0.12); setTimeout(() => beep(1046, 0.2, 'square', 0.12), 120); },
  finish: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'square', 0.14), i * 140)),
  jump: () => beep(380, 0.18, 'triangle', 0.12, 760),
  bump: () => noise(0.12, 0.15, 600),
};
