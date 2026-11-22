// Rootbound sound: everything is synthesised with Web Audio, so there are no files to download.
// Three separate switches: effects, ambience (wind, birds, an owl at night) and music.
// Audio can only start after a tap, so init() is called from the first pointer or key press.

let ctx = null, master, sfxBus, ambBus, musBus, noiseBuf;
const opts = { sfx: true, ambience: true, music: true };
let phase = 'day', scene = 'title';
const timers = [];

const now = () => ctx.currentTime;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const PENTA = [0, 2, 4, 7, 9];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp); comp.connect(ctx.destination);
  sfxBus = bus(opts.sfx ? 0.9 : 0);
  ambBus = bus(opts.ambience ? 0.35 : 0);
  musBus = bus(opts.music ? 0.32 : 0);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startAmbience();
  startMusic();
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
}
function bus(v) { const g = ctx.createGain(); g.gain.value = v; g.connect(master); return g; }

export function setOptions(next) {
  Object.assign(opts, next);
  if (!ctx) return;
  const t = now();
  sfxBus.gain.setTargetAtTime(opts.sfx ? 0.9 : 0, t, 0.05);
  ambBus.gain.setTargetAtTime(opts.ambience ? 0.35 : 0, t, 0.3);
  musBus.gain.setTargetAtTime(opts.music ? 0.32 : 0, t, 0.3);
}
export function setPhase(p) { phase = p === 'night' ? 'night' : 'day'; }
export function setScene(s) { scene = s; }

// ------------------------------------------------------------------ building blocks
function env(g, t, a, peak, d) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(out, { type = 'sine', f = 440, f2, t = now(), a = 0.005, d = 0.3, v = 0.3, filter }) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
  let node = o;
  if (filter) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; o.connect(fl); node = fl; }
  node.connect(g); g.connect(out);
  env(g, t, a, v, d);
  o.start(t); o.stop(t + a + d + 0.05);
  return o;
}
function noise(out, { t = now(), a = 0.005, d = 0.2, v = 0.3, type = 'bandpass', f = 1200, f2, q = 1 }) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true;
  fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + d);
  s.connect(fl); fl.connect(g); g.connect(out);
  env(g, t, a, v, d);
  s.start(t, Math.random()); s.stop(t + a + d + 0.05);
}

// ------------------------------------------------------------------ effects
const FX = {
  click: () => tone(sfxBus, { type: 'triangle', f: 900, f2: 600, d: 0.05, v: 0.08 }),
  dice: () => {
    const t = now();
    for (let i = 0; i < 7; i++) {
      const at = t + i * 0.055 + Math.random() * 0.03;
      noise(sfxBus, { t: at, d: 0.04, v: 0.35 - i * 0.03, f: 1800 + Math.random() * 1600, q: 6 });
      tone(sfxBus, { type: 'square', f: 220 + Math.random() * 200, t: at, d: 0.03, v: 0.04, filter: 900 });
    }
  },
  card: () => { noise(sfxBus, { d: 0.22, v: 0.25, type: 'highpass', f: 6000, f2: 1500 }); noise(sfxBus, { t: now() + 0.12, d: 0.08, v: 0.12, f: 900 }); },
  flip: () => { tone(sfxBus, { type: 'sine', f: 140, f2: 60, d: 0.18, v: 0.35 }); noise(sfxBus, { d: 0.15, v: 0.18, type: 'lowpass', f: 1500, f2: 300 }); },
  step: () => noise(sfxBus, { d: 0.07, v: 0.22, type: 'lowpass', f: 500, f2: 180 }),
  gain: () => { const t = now(), b = 72 + pick([0, 2, 4]); tone(sfxBus, { type: 'triangle', f: midi(b), t, d: 0.25, v: 0.18 }); tone(sfxBus, { type: 'triangle', f: midi(b + 7), t: t + 0.08, d: 0.35, v: 0.15 }); },
  lose: () => tone(sfxBus, { type: 'triangle', f: midi(64), f2: midi(57), d: 0.3, v: 0.15 }),
  hurt: () => { tone(sfxBus, { type: 'sawtooth', f: 260, f2: 90, d: 0.35, v: 0.18, filter: 1200 }); noise(sfxBus, { d: 0.12, v: 0.2, type: 'lowpass', f: 800 }); },
  growl: () => {
    const t = now();
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(52, t + 0.9);
    lfo.frequency.value = 23; lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency);
    fl.type = 'lowpass'; fl.frequency.value = 420;
    o.connect(fl); fl.connect(g); g.connect(sfxBus);
    env(g, t, 0.12, 0.4, 0.9);
    o.start(t); lfo.start(t); o.stop(t + 1.1); lfo.stop(t + 1.1);
    noise(sfxBus, { t, a: 0.1, d: 0.8, v: 0.12, type: 'lowpass', f: 300 });
  },
  monsterStep: () => { tone(sfxBus, { type: 'sine', f: 70, f2: 40, d: 0.2, v: 0.4 }); noise(sfxBus, { d: 0.1, v: 0.12, type: 'lowpass', f: 300 }); },
  corrupt: () => {
    const t = now();
    tone(sfxBus, { type: 'sawtooth', f: 110, f2: 98, a: 0.15, d: 0.9, v: 0.09, filter: 600, t });
    tone(sfxBus, { type: 'sawtooth', f: 116.5, f2: 92, a: 0.15, d: 0.9, v: 0.09, filter: 600, t });
    noise(sfxBus, { t, a: 0.2, d: 0.7, v: 0.08, f: 300, f2: 120, q: 4 });
  },
  cleanse: () => { const t = now(); [0, 4, 7, 12].forEach((n, i) => tone(sfxBus, { type: 'sine', f: midi(76 + n), t: t + i * 0.05, d: 0.5, v: 0.09 })); },
  quest: () => { const t = now(); [0, 4, 7, 12, 16].forEach((n, i) => tone(sfxBus, { type: 'triangle', f: midi(67 + n), t: t + i * 0.09, d: 0.6, v: 0.13 })); },
  build: () => { const t = now(); for (let i = 0; i < 3; i++) { tone(sfxBus, { type: 'square', f: 300, f2: 180, t: t + i * 0.16, d: 0.07, v: 0.08, filter: 2000 }); noise(sfxBus, { t: t + i * 0.16, d: 0.06, v: 0.2, f: 2500, q: 3 }); } },
  win: () => { const t = now(); [0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => tone(sfxBus, { type: 'triangle', f: midi(60 + n), t: t + i * 0.14, d: 0.7, v: 0.14 })); },
  over: () => { const t = now(); [12, 10, 7, 3, 0].forEach((n, i) => tone(sfxBus, { type: 'sawtooth', f: midi(52 + n), t: t + i * 0.28, a: 0.03, d: 0.9, v: 0.08, filter: 900 })); },
};
export function play(name) {
  if (!ctx || !opts.sfx || !FX[name] || ctx.state !== 'running') return;
  try { FX[name](); } catch { /* ignore audio glitches */ }
}

// ------------------------------------------------------------------ ambience
function startAmbience() {
  // wind: looping noise through a slowly wandering lowpass
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true;
  fl.type = 'lowpass'; fl.frequency.value = 400; fl.Q.value = 0.7;
  g.gain.value = 0.18;
  s.connect(fl); fl.connect(g); g.connect(ambBus); s.start();
  const gust = () => {
    if (ctx.state === 'running') {
      const t = now();
      fl.frequency.setTargetAtTime(250 + Math.random() * 600, t, 1.5);
      g.gain.setTargetAtTime(0.08 + Math.random() * 0.16, t, 1.8);
    }
    timers.push(setTimeout(gust, 2500 + Math.random() * 3000));
  };
  gust();
  // birds by day, an owl by night
  const critters = () => {
    if (ctx.state === 'running' && opts.ambience) {
      if (phase === 'day') bird(); else if (Math.random() < 0.6) owl();
    }
    // Sparse: birds every 4-10 s by day, an owl now and then at night.
    timers.push(setTimeout(critters, phase === 'day' ? 4000 + Math.random() * 6000 : 9000 + Math.random() * 12000));
  };
  critters();
}
function bird() {
  const t = now(), base = 2200 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const at = t + i * (0.09 + Math.random() * 0.05);
    tone(ambBus, { type: 'sine', f: base * (1 + Math.random() * 0.2), f2: base * (0.7 + Math.random() * 0.5), t: at, a: 0.01, d: 0.07, v: 0.035 });
  }
}
// A distant owl: two soft, low hoots.
function owl() {
  const t = now(), f = 370 + Math.random() * 40;
  [0, 0.42].forEach((d, i) => tone(ambBus, { type: 'sine', f: f * (i ? 0.94 : 1), f2: f * (i ? 0.86 : 0.93), t: t + d, a: 0.06, d: i ? 0.55 : 0.3, v: 0.05 }));
}

// ------------------------------------------------------------------ music
// A slow pad with a pentatonic pluck drifting over it. Calmer on the title, a little darker at night.
const CHORDS = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]];
function startMusic() {
  const delay = ctx.createDelay(1.5), fb = ctx.createGain(), wet = ctx.createGain();
  delay.delayTime.value = 0.42; fb.gain.value = 0.35; wet.gain.value = 0.35;
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(musBus);
  let step = 0;
  const bar = () => {
    if (ctx.state === 'running' && opts.music) {
      const t = now(), ch = CHORDS[step % CHORDS.length], dark = phase === 'night' && scene === 'game';
      for (const n of ch) {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
          o.type = 'sawtooth'; o.frequency.value = midi(n - (dark ? 2 : 0)); o.detune.value = det;
          fl.type = 'lowpass'; fl.frequency.value = dark ? 500 : 800;
          o.connect(fl); fl.connect(g); g.connect(musBus);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.022, t + 2.5); g.gain.linearRampToValueAtTime(0, t + 8.2);
          o.start(t); o.stop(t + 8.4);
        }
      }
      // plucks over the chord
      const root = ch[0] + 24 - (dark ? 2 : 0);
      const count = scene === 'title' ? 5 : 4;
      for (let i = 0; i < count; i++) {
        if (Math.random() < 0.3) continue;
        const n = root + PENTA[Math.floor(Math.random() * 5)] + (Math.random() < 0.3 ? 12 : 0);
        const at = t + 0.5 + i * (7 / count) + Math.random() * 0.2;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = midi(n);
        o.connect(g); g.connect(musBus); g.connect(delay);
        env(g, at, 0.005, 0.07, 1.4);
        o.start(at); o.stop(at + 1.5);
      }
      step++;
    }
    timers.push(setTimeout(bar, 8000));
    if (timers.length > 50) timers.splice(0, timers.length - 10);
  };
  bar();
}
