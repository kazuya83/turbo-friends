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

// 足音（カート以外のキャラ）
let stepAlt = false;
export function footstep(kind = 'light') {
  if (!ctx) return;
  stepAlt = !stepAlt;
  const t = ctx.currentTime;
  const base = kind === 'heavy' ? 70 : kind === 'paw' ? 520 : 300;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = kind === 'heavy' ? 'sine' : 'triangle';
  o.frequency.setValueAtTime(base * (stepAlt ? 1 : 1.12), t);
  o.frequency.exponentialRampToValueAtTime(base * 0.5, t + 0.07);
  const vol = kind === 'heavy' ? 0.35 : kind === 'paw' ? 0.09 : 0.13;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'heavy' ? 0.18 : 0.08));
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2);
  if (kind === 'heavy') noise(0.12, 0.12, 300);
}

// ---------- BGM（コースごとのチップチューン） ----------
const SONGS = {
  meadow: {
    bpm: 132, wave: 'square', leadVol: 0.05, kit: 'pop',
    roots: ['C3', 'G2', 'A2', 'F2'],
    melody: [
      'E5 - G5 - C6 - B5 - A5 - G5 - E5 - - -',
      'D5 - G5 - B5 - A5 - G5 - - - D5 - - -',
      'C5 - E5 - A5 - G5 - E5 - C5 - E5 - G5 -',
      'F5 - A5 - C6 - A5 - G5 - - - - - . .',
    ],
  },
  desert: {
    bpm: 116, wave: 'triangle', leadVol: 0.09, kit: 'tabla',
    roots: ['D3', 'Eb3', 'D3', 'C3'],
    melody: [
      'D5 - Eb5 - F#5 - G5 - A5 - - - G5 - F#5 -',
      'Eb5 - - - D5 - Eb5 - F#5 - - - - - . .',
      'A5 - Bb5 - A5 - G5 - F#5 - G5 - A5 - - -',
      'G5 - F#5 - Eb5 - F#5 - D5 - - - - - . .',
    ],
  },
  city: {
    bpm: 124, wave: 'sawtooth', leadVol: 0.035, kit: 'four',
    roots: ['A2', 'F2', 'C3', 'G2'],
    melody: [
      'A4 - C5 - E5 - A5 - G5 - E5 - C5 - E5 -',
      'F5 - - - E5 - C5 - A4 - - - . . . .',
      'G5 - E5 - C5 - E5 - G5 - C6 - B5 - G5 -',
      'B5 - - - A5 - G5 - D5 - - - - - . .',
    ],
  },
  snow: {
    bpm: 112, wave: 'triangle', leadVol: 0.09, kit: 'pop',
    roots: ['D3', 'B2', 'G2', 'A2'],
    melody: [
      'F#5 - A5 - D6 - - - C#6 - A5 - B5 - - -',
      'D5 - F#5 - B5 - - - A5 - F#5 - D5 - - -',
      'G5 - B5 - D6 - B5 - A5 - G5 - F#5 - - -',
      'E5 - G5 - A5 - C#6 - D6 - - - . . . .',
    ],
  },
  beach: {
    bpm: 140, wave: 'square', leadVol: 0.045, kit: 'calypso',
    roots: ['F2', 'Bb2', 'C3', 'F2'],
    melody: [
      'A5 . C6 . A5 - F5 - G5 . A5 . F5 - - -',
      'D6 . C6 . Bb5 - D6 - C6 - Bb5 - A5 - - -',
      'G5 . A5 . Bb5 - C6 - E5 - G5 - C6 - - -',
      'A5 - G5 - F5 - A5 - F5 - - - . . . .',
    ],
  },
};
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freq(name) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  const n = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * Math.pow(2, (n - 69) / 12);
}
function compile(song) {
  const lead = [], bass = [];
  song.melody.forEach((bar, b) => {
    const tok = bar.trim().split(/\s+/);
    tok.forEach((t, i) => {
      if (t === '-' || t === '.') return;
      let len = 1;
      while (tok[i + len] === '-') len++;
      lead.push({ step: b * 16 + i, f: freq(t), len });
    });
    const r = freq(song.roots[b]);
    [0, 2, 4, 6, 8, 10, 12, 14].forEach((s, j) => bass.push({ step: b * 16 + s, f: r * [1, 1, 1.5, 1, 2, 1, 1.5, 1][j], len: 1.6 }));
  });
  return { ...song, lead, bass, len: song.melody.length * 16 };
}

let bgm = null, bgmGain = null;
export function bgmStart(id) {
  if (!ctx) return;
  bgmStop();
  const song = SONGS[id];
  if (!song) return;
  if (!bgmGain) { bgmGain = ctx.createGain(); bgmGain.gain.value = 0.7; bgmGain.connect(master); }
  const s = compile(song);
  bgm = { s, step: 0, next: ctx.currentTime + 0.1, stepDur: 60 / s.bpm / 4, rate: 1 };
  bgm.timer = setInterval(bgmTick, 25);
}
export function bgmRate(r) { if (bgm) bgm.rate = r; }
export function bgmStop() {
  if (!bgm) return;
  clearInterval(bgm.timer);
  bgm = null;
}
function bgmTick() {
  if (!bgm) return;
  const b = bgm;
  if (b.next < ctx.currentTime - 0.5) b.next = ctx.currentTime + 0.05;
  while (b.next < ctx.currentTime + 0.15) {
    playStep(b.s, b.step, b.next, b.stepDur / b.rate);
    b.next += b.stepDur / b.rate;
    b.step = (b.step + 1) % b.s.len;
  }
}
function tone(type, f, t, dur, vol, cutoff) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (cutoff) {
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff;
    o.connect(fl); fl.connect(g);
  } else o.connect(g);
  g.connect(bgmGain); o.start(t); o.stop(t + dur + 0.05);
}
function drum(kind, t) {
  if (kind === 'kick') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(bgmGain); o.start(t); o.stop(t + 0.2);
    return;
  }
  const dur = kind === 'hat' ? 0.04 : 0.12;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = kind === 'hat' ? 'highpass' : 'bandpass';
  f.frequency.value = kind === 'hat' ? 7000 : kind === 'tom' ? 400 : 1800;
  const g = ctx.createGain(); g.gain.value = kind === 'hat' ? 0.05 : 0.12;
  src.connect(f); f.connect(g); g.connect(bgmGain); src.start(t);
}
const KITS = {
  pop: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] },
  tabla: { kick: [0, 6, 8], snare: [12], tom: [3, 4, 10, 14], hat: [2, 7, 11] },
  four: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14, 15] },
  calypso: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [2, 3, 6, 10, 11, 14], tom: [7, 15] },
};
function playStep(s, step, t, sd) {
  for (const n of s.lead) if (n.step === step) tone(s.wave, n.f, t, n.len * sd * 0.95, s.leadVol, s.wave === 'sawtooth' ? 2200 : 0);
  for (const n of s.bass) if (n.step === step) tone('triangle', n.f, t, sd * n.len, 0.12);
  const kit = KITS[s.kit], i = step % 16;
  for (const k of Object.keys(kit)) if (kit[k].includes(i)) drum(k, t);
}
