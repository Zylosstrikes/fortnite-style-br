'use strict';
/* STORMFALL ROYALE - utilities, noise, audio */
(function () {
const G = window.G = {};
G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
G.lerp = (a, b, t) => a + (b - a) * t;
G.smooth = (a, b, x) => { const t = G.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
G.rand = (a, b) => a + Math.random() * (b - a);
G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
G.angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
G.seeded = function (seed) { let s = seed >>> 0; return function () { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const SEED = 1337;
function hash2(ix, iz) { let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + SEED * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
G.noise = vnoise;
G.fbm = function (x, z, oct) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; };

/* ---------- Audio (WebAudio beeps + noise) ---------- */
G.Audio = (function () {
  let ctx = null, master = null, noiseBuf = null, muted = false, voices = 0, engine = null;
  const L = { x: 0, y: 0, z: 0, yaw: 0 };
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.45; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  function route(g, pan) {
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = G.clamp(pan || 0, -1, 1); g.connect(p); p.connect(master); } else g.connect(master);
  }
  function tone(f, dur, type, vol, slide, delay, pan) {
    if (!ctx || muted || voices > 40) return;
    const t = ctx.currentTime + (delay || 0); const o = ctx.createOscillator(); o.type = type || 'square';
    o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); route(g, pan); o.start(t); o.stop(t + dur + 0.02); voices++; o.onended = () => voices--;
  }
  function noise(dur, vol, fc, type, pan, delay, fcEnd) {
    if (!ctx || muted || voices > 40) return;
    const t = ctx.currentTime + (delay || 0); const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(fc, t);
    if (fcEnd) f.frequency.exponentialRampToValueAtTime(fcEnd, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); route(g, pan); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02); voices++; s.onended = () => voices--;
  }
  const S = {
    pistol: (v, p) => { noise(0.12, 0.5 * v, 2500, 'bandpass', p, 0, 600); tone(300, 0.08, 'square', 0.15 * v, 90, 0, p); },
    shotgun: (v, p) => { noise(0.35, 0.9 * v, 1800, 'lowpass', p, 0, 200); tone(120, 0.2, 'sawtooth', 0.3 * v, 40, 0, p); },
    ar: (v, p) => { noise(0.1, 0.55 * v, 3200, 'bandpass', p, 0, 800); tone(220, 0.07, 'square', 0.18 * v, 70, 0, p); },
    smg: (v, p) => { noise(0.07, 0.4 * v, 4000, 'bandpass', p, 0, 1200); tone(380, 0.05, 'square', 0.12 * v, 120, 0, p); },
    sniper: (v, p) => { noise(0.5, 0.9 * v, 1500, 'lowpass', p, 0, 120); tone(90, 0.4, 'sawtooth', 0.35 * v, 30, 0, p); },
    rocket: (v, p) => { noise(0.5, 0.6 * v, 900, 'lowpass', p, 0, 200); tone(150, 0.4, 'sawtooth', 0.2 * v, 60, 0, p); },
    explosion: (v, p) => { noise(1.1, 1.0 * v, 700, 'lowpass', p, 0, 60); tone(70, 0.8, 'sawtooth', 0.4 * v, 25, 0, p); },
    reload: (v, p) => { tone(900, 0.04, 'square', 0.12 * v, 0, 0, p); tone(600, 0.05, 'square', 0.12 * v, 0, 0.18, p); tone(1100, 0.04, 'square', 0.1 * v, 0, 0.5, p); },
    empty: (v, p) => tone(200, 0.05, 'square', 0.12 * v, 0, 0, p),
    pickup: (v) => { tone(660, 0.07, 'triangle', 0.25 * v); tone(990, 0.1, 'triangle', 0.25 * v, 0, 0.06); },
    chest: (v, p) => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.25 * v, 0, i * 0.08, p)); },
    hit: (v) => tone(1500, 0.05, 'square', 0.14 * v, 900),
    headshot: (v) => { tone(2000, 0.08, 'square', 0.18 * v, 1200); tone(1000, 0.1, 'triangle', 0.18 * v, 0, 0.03); },
    hurt: (v) => { tone(160, 0.18, 'sawtooth', 0.3 * v, 70); noise(0.1, 0.2 * v, 1200, 'lowpass'); },
    build: (v, p) => { noise(0.12, 0.5 * v, 500, 'lowpass', p); tone(140, 0.09, 'square', 0.18 * v, 70, 0, p); },
    harvest: (v, p) => { noise(0.08, 0.5 * v, 1800, 'bandpass', p); tone(260, 0.06, 'square', 0.12 * v, 160, 0, p); },
    break: (v, p) => { noise(0.4, 0.6 * v, 1200, 'lowpass', p, 0, 150); },
    heal: (v) => { tone(520, 0.12, 'sine', 0.22 * v); tone(780, 0.14, 'sine', 0.22 * v, 0, 0.1); },
    drink: (v) => { for (let i = 0; i < 3; i++) tone(300 + i * 40, 0.1, 'sine', 0.12 * v, 200, i * 0.12); },
    jump: (v) => tone(300, 0.15, 'sine', 0.15 * v, 600),
    glide: (v) => noise(0.6, 0.35 * v, 600, 'bandpass', 0, 0, 1800),
    splash: (v, p) => noise(0.3, 0.4 * v, 1500, 'bandpass', p, 0, 400),
    storm: (v) => { tone(220, 0.5, 'sawtooth', 0.15 * v, 160); tone(165, 0.6, 'sawtooth', 0.15 * v, 110, 0.3); },
    victory: (v) => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.28, 'triangle', 0.3 * v, 0, i * 0.15)); },
    elim: (v) => { [440, 370, 311, 247].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.22 * v, 0, i * 0.18)); },
    click: (v) => tone(800, 0.04, 'square', 0.1 * v, 600),
    emote: (v, p) => { [392, 523, 659, 523].forEach((f, i) => tone(f, 0.12, 'square', 0.12 * v, 0, i * 0.1, p)); },
    kill: (v) => { tone(880, 0.1, 'square', 0.2 * v); tone(1320, 0.18, 'square', 0.2 * v, 0, 0.09); },
    bus: (v) => { tone(180, 0.35, 'sawtooth', 0.2 * v, 0); tone(240, 0.5, 'sawtooth', 0.2 * v, 0, 0.35); },
    crash: (v, p) => { noise(0.3, 0.7 * v, 600, 'lowpass', p, 0, 120); },
    step: (v, p) => noise(0.05, 0.12 * v, 700, 'lowpass', p),
  };
  const maxD = { shotgun: 160, sniper: 300, rocket: 220, explosion: 300, ar: 180, smg: 140, pistol: 120, reload: 30, build: 60, harvest: 50, break: 90, emote: 40, crash: 80, step: 25, chest: 40, splash: 40 };
  return {
    L, init, tone, noise, get ctx() { return ctx; },
    play(name, vol, pan) { if (!ctx || muted) return; const f = S[name]; if (f) f(vol === undefined ? 1 : vol, pan || 0); },
    at(name, x, y, z, vol) {
      if (!ctx || muted) return; const dx = x - L.x, dz = z - L.z, dy = y - L.y; const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const md = maxD[name] || 100; if (d > md) return; const v = Math.pow(1 - d / md, 1.6) * (vol === undefined ? 1 : vol);
      const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw); const pan = d > 0.5 ? (dx * rx + dz * rz) / d : 0;
      const f = S[name]; if (f) f(v, pan);
    },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.45; return muted; },
    get muted() { return muted; },
    engineStart() {
      if (!ctx || engine) return; const o = ctx.createOscillator(); o.type = 'sawtooth'; const g = ctx.createGain(); g.gain.value = 0.06;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; o.connect(f); f.connect(g); g.connect(master); o.start(); engine = { o, g };
    },
    engineSet(sp) { if (engine) { engine.o.frequency.value = 50 + sp * 4; engine.g.gain.value = muted ? 0 : 0.05 + sp * 0.002; } },
    engineStop() { if (engine) { try { engine.o.stop(); } catch (e) { } engine = null; } },
    lobbyMusic() {
      if (!ctx) return; const notes = [262, 330, 392, 330, 294, 370, 440, 370]; let i = 0;
      G._music = setInterval(() => { if (muted) return; tone(notes[i % 8], 0.4, 'triangle', 0.07, 0); if (i % 4 === 0) tone(notes[i % 8] / 2, 0.8, 'sine', 0.08); i++; }, 380);
    },
    stopMusic() { clearInterval(G._music); }
  };
})();
})();
