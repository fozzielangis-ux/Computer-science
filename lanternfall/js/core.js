// Lanternfall — core: namespace, constants, math, RNG, input, audio
'use strict';
var LF = globalThis.LF || (globalThis.LF = {});

LF.T = 32;            // tile size in px
LF.CW = 32;           // cell width in tiles (one screen)
LF.CH = 18;           // cell height in tiles
LF.VW = 1024;         // view width
LF.VH = 576;          // view height

// ---------- math ----------
LF.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
LF.lerp = (a, b, t) => a + (b - a) * t;
LF.sign = (v) => v < 0 ? -1 : v > 0 ? 1 : 0;
LF.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
LF.approach = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
LF.overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
LF.ease = { outCubic: t => 1 - Math.pow(1 - t, 3), inOut: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 };

LF.hash = function (str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
LF.rng = function (seed) {
  let a = typeof seed === 'string' ? LF.hash(seed) : seed >>> 0;
  const r = function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  r.range = (lo, hi) => lo + r() * (hi - lo);
  r.int = (lo, hi) => Math.floor(lo + r() * (hi - lo + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  return r;
};
LF.R = LF.rng(Date.now() & 0xffffffff); // runtime (non-deterministic) rng for fx

// ---------- input ----------
(function () {
  if (typeof window === 'undefined') return;
  const PRESETS = {
    arrows: {
      left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
      jump: ['KeyZ', 'Space'], attack: ['KeyX'], dash: ['KeyC', 'ShiftLeft'], spell: ['KeyA'], heal: ['KeyS'],
      interact: ['ArrowUp', 'KeyE'], inv: ['Tab', 'KeyI'], map: ['KeyM'], pause: ['Escape', 'KeyP'], confirm: ['Enter', 'KeyZ', 'Space'], back: ['Escape', 'Backspace', 'KeyX'],
      tabL: ['KeyQ'], tabR: ['KeyW']
    },
    wasd: {
      left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
      jump: ['Space', 'KeyK'], attack: ['KeyJ'], dash: ['KeyL', 'ShiftLeft'], spell: ['KeyU'], heal: ['KeyH'],
      interact: ['KeyW', 'KeyE'], inv: ['Tab', 'KeyI'], map: ['KeyM'], pause: ['Escape', 'KeyP'], confirm: ['Enter', 'Space', 'KeyK'], back: ['Escape', 'Backspace', 'KeyJ'],
      tabL: ['KeyQ'], tabR: ['KeyR']
    }
  };
  const I = LF.input = {
    preset: 'arrows', map: PRESETS.arrows, PRESETS,
    down: new Set(), pressed: new Set(), released: new Set(),
    pad: { down: new Set(), prev: new Set() }, lastDevice: 'kb', anyKey: false,
    setPreset(p) { this.preset = PRESETS[p] ? p : 'arrows'; this.map = PRESETS[this.preset]; },
    held(a) { const ks = this.map[a] || []; for (const k of ks) if (this.down.has(k)) return true; return this.pad.down.has(a); },
    hit(a) { const ks = this.map[a] || []; for (const k of ks) if (this.pressed.has(k)) return true; return this.pad.down.has(a) && !this.pad.prev.has(a); },
    rel(a) { const ks = this.map[a] || []; for (const k of ks) if (this.released.has(k)) return true; return !this.pad.down.has(a) && this.pad.prev.has(a); },
    keyName(a) {
      if (this.lastDevice === 'pad') return ({ jump: 'A', attack: 'X', dash: 'RT', spell: 'B', heal: 'Y', interact: '↑', inv: 'Select', map: 'LB', pause: 'Start' })[a] || a;
      const k = (this.map[a] || [''])[0];
      return k.replace('Key', '').replace('Arrow', '').replace('Left', '').replace('Escape', 'Esc').replace('Space', 'Space');
    },
    endFrame() { this.pressed.clear(); this.released.clear(); this.pad.prev = new Set(this.pad.down); },
    pollPad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const p = pads && [...pads].find(x => x && x.connected);
      const d = this.pad.down; d.clear();
      if (!p) return;
      const b = (i) => p.buttons[i] && p.buttons[i].pressed;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (ax < -0.4 || b(14)) d.add('left'); if (ax > 0.4 || b(15)) d.add('right');
      if (ay < -0.5 || b(12)) { d.add('up'); d.add('interact'); } if (ay > 0.5 || b(13)) d.add('down');
      if (b(0)) { d.add('jump'); d.add('confirm'); } if (b(2)) d.add('attack'); if (b(1)) { d.add('spell'); d.add('back'); }
      if (b(3)) d.add('heal'); if (b(7) || b(5)) d.add('dash'); if (b(4)) d.add('map'); if (b(8)) d.add('inv'); if (b(9)) d.add('pause');
      if (b(6)) d.add('tabL');
      if (d.size) { this.lastDevice = 'pad'; this.anyKey = true; }
    }
  };
  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (!I.down.has(e.code)) I.pressed.add(e.code);
    I.down.add(e.code); I.lastDevice = 'kb'; I.anyKey = true;
    LF.audio && LF.audio.unlock();
  });
  window.addEventListener('keyup', e => { I.down.delete(e.code); I.released.add(e.code); });
  window.addEventListener('blur', () => { I.down.clear(); });
  window.addEventListener('pointerdown', () => { LF.audio && LF.audio.unlock(); });
})();

// ---------- audio ----------
(function () {
  if (typeof window === 'undefined') return;
  const A = LF.audio = {
    ctx: null, master: null, sfxGain: null, musicGain: null, verb: null,
    vol: { master: 0.8, music: 0.6, sfx: 0.8 },
    track: null, nextTrack: null, schedT: 0, step: 0, noiseBuf: null,
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.vol.master;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfxGain = c.createGain(); this.sfxGain.gain.value = this.vol.sfx; this.sfxGain.connect(this.master);
      this.musicGain = c.createGain(); this.musicGain.gain.value = this.vol.music * 0.55; this.musicGain.connect(this.master);
      // reverb
      const len = c.sampleRate * 3.2, ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      this.verb = c.createConvolver(); this.verb.buffer = ir;
      const vg = c.createGain(); vg.gain.value = 0.55; this.verb.connect(vg); vg.connect(this.master);
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.schedT = c.currentTime + 0.1;
      setInterval(() => this.schedule(), 60);
      if (this.wantTrack) this.playMusic(this.wantTrack, true);
    },
    setVol(k, v) {
      this.vol[k] = v; if (!this.ctx) return;
      if (k === 'master') this.master.gain.value = v;
      if (k === 'sfx') this.sfxGain.gain.value = v;
      if (k === 'music') this.musicGain.gain.value = v * 0.55;
    },
    // --- primitives ---
    env(g, t, a, peak, d, sustain = 0.0001) {
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
    },
    tone(type, f0, f1, dur, vol, dest, opt = {}) {
      const c = this.ctx, t = opt.t || c.currentTime;
      const o = c.createOscillator(), g = c.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
      if (opt.detune) o.detune.value = opt.detune;
      this.env(g, t, opt.a || 0.005, vol, dur);
      let node = o;
      if (opt.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opt.lp; f.Q.value = opt.q || 0.7; o.connect(f); node = f; }
      node.connect(g); g.connect(dest || this.sfxGain); if (opt.verb) g.connect(this.verb);
      o.start(t); o.stop(t + dur + 0.05);
    },
    noise(dur, vol, type, f0, f1, dest, opt = {}) {
      const c = this.ctx, t = opt.t || c.currentTime;
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = type || 'bandpass'; f.Q.value = opt.q || 1;
      f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = c.createGain(); this.env(g, t, opt.a || 0.004, vol, dur);
      s.connect(f); f.connect(g); g.connect(dest || this.sfxGain); if (opt.verb) g.connect(this.verb);
      s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    play(name, p = 1) {
      if (!this.ctx) return;
      const r = (a, b) => a + Math.random() * (b - a);
      switch (name) {
        case 'slash': this.noise(0.13, 0.35, 'bandpass', r(3800, 4600), 700, null, { q: 1.6 }); this.tone('triangle', r(900, 1100), 300, 0.08, 0.05); break;
        case 'slash2': this.noise(0.15, 0.4, 'bandpass', 2600, 500, null, { q: 1.4 }); break;
        case 'hit': this.tone('sine', 220 * p, 50, 0.16, 0.5); this.noise(0.06, 0.4, 'highpass', 3000, 1500); break;
        case 'clank': this.tone('square', 1800, 1700, 0.12, 0.08); this.tone('sine', 2600, 2500, 0.3, 0.12, null, { verb: true }); this.noise(0.05, 0.3, 'highpass', 5000); break;
        case 'kill': this.noise(0.35, 0.45, 'lowpass', 2200, 200); this.tone('sawtooth', 300, 60, 0.3, 0.12, null, { lp: 1200 }); break;
        case 'jump': this.noise(0.12, 0.12, 'highpass', 1800, 3800); break;
        case 'djump': for (let i = 0; i < 3; i++) this.noise(0.05, 0.18, 'bandpass', 1400, 900, null, { t: this.ctx.currentTime + i * 0.04 }); break;
        case 'land': this.tone('sine', 120, 50, 0.1, 0.25); this.noise(0.06, 0.12, 'lowpass', 900); break;
        case 'dash': this.noise(0.22, 0.32, 'bandpass', 600, 3200, null, { q: 0.8 }); break;
        case 'veil': this.noise(0.3, 0.3, 'bandpass', 300, 2400, null, { q: 2, verb: true }); this.tone('sine', 200, 800, 0.3, 0.1, null, { verb: true }); break;
        case 'hurt': this.tone('square', 400, 90, 0.35, 0.2, null, { lp: 1800 }); this.noise(0.25, 0.5, 'lowpass', 1500, 200); break;
        case 'heal': [0, 4, 7, 12].forEach((s, i) => this.tone('sine', 440 * Math.pow(2, s / 12), 0, 0.5, 0.12, null, { t: this.ctx.currentTime + i * 0.06, verb: true })); break;
        case 'focus': this.tone('sine', 220, 440, 0.9, 0.06, null, { a: 0.3, verb: true }); break;
        case 'spell': this.noise(0.4, 0.4, 'bandpass', 900, 300, null, { q: 0.7, verb: true }); this.tone('sawtooth', 160, 80, 0.35, 0.15, null, { lp: 900 }); break;
        case 'nova': this.noise(0.6, 0.5, 'lowpass', 3000, 300, null, { verb: true }); this.tone('sawtooth', 120, 600, 0.5, 0.12, null, { lp: 2000 }); break;
        case 'coin': this.tone('sine', r(1500, 1700), 0, 0.09, 0.1); this.tone('sine', r(2200, 2500), 0, 0.12, 0.07, null, { t: this.ctx.currentTime + 0.04 }); break;
        case 'item': [0, 4, 7, 11, 14].forEach((s, i) => this.tone('triangle', 523 * Math.pow(2, s / 12), 0, 0.9, 0.12, null, { t: this.ctx.currentTime + i * 0.08, verb: true })); break;
        case 'ability': [0, 7, 12, 16, 19, 24].forEach((s, i) => this.tone('sine', 262 * Math.pow(2, s / 12), 0, 1.8, 0.14, null, { t: this.ctx.currentTime + i * 0.12, verb: true })); this.noise(2, 0.1, 'bandpass', 800, 4000, null, { verb: true, a: 0.5 }); break;
        case 'ui': this.tone('sine', 880, 0, 0.05, 0.06); break;
        case 'uiOk': this.tone('triangle', 660, 0, 0.1, 0.08); this.tone('triangle', 990, 0, 0.14, 0.06, null, { t: this.ctx.currentTime + 0.05 }); break;
        case 'uiNo': this.tone('square', 200, 150, 0.12, 0.05, null, { lp: 800 }); break;
        case 'bench': [0, 7, 12, 16].forEach((s, i) => this.tone('sine', 196 * Math.pow(2, s / 12), 0, 2.2, 0.1, null, { t: this.ctx.currentTime + i * 0.15, verb: true, a: 0.05 })); break;
        case 'break': this.noise(0.6, 0.6, 'lowpass', 1800, 120); this.tone('sine', 90, 40, 0.4, 0.4); break;
        case 'slam': this.noise(0.8, 0.7, 'lowpass', 1200, 60); this.tone('sine', 80, 30, 0.6, 0.6); break;
        case 'charge': this.tone('sine', 300, 900, 0.5, 0.06); break;
        case 'cleave': this.noise(0.3, 0.6, 'bandpass', 2000, 300, null, { q: 0.8, verb: true }); this.tone('sawtooth', 220, 55, 0.3, 0.2, null, { lp: 2400 }); break;
        case 'roar': this.noise(1.6, 0.6, 'lowpass', 600, 120, null, { a: 0.1, verb: true }); this.tone('sawtooth', 70, 45, 1.5, 0.3, null, { lp: 400, a: 0.1 }); break;
        case 'boom': this.noise(1.0, 0.7, 'lowpass', 900, 50, null, { verb: true }); this.tone('sine', 60, 25, 1.0, 0.6); break;
        case 'shot': this.tone('square', 700, 250, 0.12, 0.06, null, { lp: 1600 }); break;
        case 'zap': this.tone('sawtooth', 1200, 200, 0.25, 0.08, null, { lp: 3000 }); this.noise(0.2, 0.1, 'highpass', 4000); break;
        case 'bell': [1, 2.76, 5.4].forEach((m, i) => this.tone('sine', 220 * p * m, 0, 2.5 / (i + 1), 0.15 / (i + 1), null, { verb: true })); break;
        case 'splash': this.noise(0.4, 0.3, 'bandpass', 1500, 400, null, { q: 0.6 }); break;
        case 'door': this.tone('sine', 110, 70, 0.8, 0.3); this.noise(0.8, 0.25, 'lowpass', 600, 100); break;
        case 'death': this.tone('sawtooth', 400, 40, 2.0, 0.2, null, { lp: 1200, verb: true }); this.noise(1.5, 0.4, 'lowpass', 2000, 80, null, { verb: true }); break;
        case 'step': this.noise(0.03, 0.05, 'lowpass', 700); break;
        case 'wisp': [12, 16, 19].forEach((s, i) => this.tone('sine', 523 * Math.pow(2, s / 12), 0, 0.6, 0.07, null, { t: this.ctx.currentTime + i * 0.05, verb: true })); break;
        case 'talk': this.tone('triangle', r(300, 420) * p, 0, 0.05, 0.035); break;
      }
    },
    // --- music: generative, per-region ---
    playMusic(id, force) {
      this.wantTrack = id;
      if (!this.ctx) return;
      if (!force && this.track && this.track.id === id) return;
      const def = LF.MUSIC && LF.MUSIC[id]; if (!def) { this.track = null; return; }
      if (this.track && this.track.bus) {
        const old = this.track.bus; old.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.6);
        setTimeout(() => old.disconnect(), 3000);
      }
      const bus = this.ctx.createGain(); bus.gain.value = 0.0001; bus.connect(this.musicGain);
      bus.gain.setTargetAtTime(1, this.ctx.currentTime + 0.3, 0.8);
      const wet = this.ctx.createGain(); wet.gain.value = def.wet || 0.8; bus.connect(wet); wet.connect(this.verb);
      this.track = { id, def, bus, step: 0, rng: LF.rng(id + 'm') };
      this.schedT = Math.max(this.schedT, this.ctx.currentTime + 0.1);
    },
    stopMusic() { this.wantTrack = null; if (this.track && this.ctx) { this.track.bus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.5); } this.track = null; },
    schedule() {
      const c = this.ctx; if (!c || !this.track) return;
      const tr = this.track, d = tr.def, spb = 60 / d.bpm / 2; // eighth notes
      while (this.schedT < c.currentTime + 0.25) {
        this.musicStep(tr, d, this.schedT, spb);
        tr.step++; this.schedT += spb;
      }
    },
    nf(root, deg, scale) { const o = Math.floor(deg / scale.length), i = ((deg % scale.length) + scale.length) % scale.length; return root * Math.pow(2, (scale[i] + 12 * o) / 12); },
    musicStep(tr, d, t, spb) {
      const s = tr.step, bar = Math.floor(s / 8), beat = s % 8, R = tr.rng, bus = tr.bus;
      const chord = d.prog[bar % d.prog.length];
      if (beat === 0 && bar % (d.padBars || 1) === 0) {
        // pad chord
        const dur = spb * 8 * (d.padBars || 1);
        [0, 2, 4, d.seventh ? 6 : 7].forEach((deg, i) => {
          const f = this.nf(d.root, chord + deg, d.scale) * (i === 0 ? 0.5 : 1);
          [-7, 7].forEach(dt => this.tone(d.pad || 'sawtooth', f, f, dur, d.padVol || 0.022, bus, { t, a: dur * 0.35, lp: d.padLp || 900, detune: dt }));
        });
      }
      if (d.bass && beat % (d.bassEvery || 8) === 0) {
        const f = this.nf(d.root, chord, d.scale) * 0.25;
        this.tone('sine', f, f, spb * (d.bassEvery || 8) * 0.95, d.bassVol || 0.12, bus, { t, a: 0.02 });
      }
      if (d.arp && R() < (d.arpDensity || 0.8)) {
        const pat = d.arp, deg = chord + pat[s % pat.length];
        const f = this.nf(d.root * (d.arpOct || 2), deg, d.scale);
        this.tone(d.arpWave || 'triangle', f, f, spb * (d.arpLen || 1.6), d.arpVol || 0.035, bus, { t, a: 0.005 });
      }
      if (d.bells && beat === 0 && R() < d.bells) {
        const f = this.nf(d.root * 4, chord + R.pick([0, 2, 4, 7]), d.scale);
        [1, 2.76].forEach((m, i) => this.tone('sine', f * m, f * m, 2.6 / (i + 1), 0.03 / (i + 1), bus, { t }));
      }
      if (d.melody && (beat === 0 || beat === 3 || beat === 6) && R() < d.melody) {
        const f = this.nf(d.root * 2, chord + R.pick([0, 1, 2, 4, 5, 7]), d.scale);
        this.tone(d.melWave || 'sine', f, f * (R() < 0.2 ? 0.94 : 1), spb * R.pick([2, 3, 4]), d.melVol || 0.045, bus, { t, a: 0.04, lp: 2400 });
      }
      if (d.drums) {
        const k = d.drums;
        if (k.kick && k.kick.includes(beat)) { this.tone('sine', 140, 40, 0.25, 0.35, bus, { t }); }
        if (k.snare && k.snare.includes(beat)) { this.noise(0.18, 0.18, 'bandpass', 1800, 900, bus, { t }); }
        if (k.hat && k.hat.includes(beat)) { this.noise(0.04, 0.05, 'highpass', 8000, 0, bus, { t }); }
        if (k.tom && beat === 7 && bar % 2 === 1) { this.tone('sine', 200, 80, 0.3, 0.2, bus, { t }); }
      }
      if (d.drone && beat === 0 && bar % 4 === 0) {
        this.tone('sine', d.root * 0.25, d.root * 0.25, spb * 32, 0.06, bus, { t, a: 2 });
      }
    }
  };
})();
