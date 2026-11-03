// Every sound in the game is synthesised live with the Web Audio API —
// no audio files at all. Pops, chimes, party horns, fireworks and a little
// original party soundtrack (plus "Happy Birthday" on a music box).

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export const n2m = (name) => {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  return 12 * (parseInt(m[2], 10) + 1) + NOTE_INDEX[m[1]];
};

// Chord progression: C – Am – F – G (bars of 16 sixteenth-notes)
const CHORDS = [
  { bass: 48, pad: [60, 64, 67], arp: [60, 64, 67, 72] },
  { bass: 45, pad: [57, 60, 64], arp: [57, 60, 64, 69] },
  { bass: 41, pad: [57, 60, 65], arp: [53, 57, 60, 65] },
  { bass: 43, pad: [55, 59, 62], arp: [55, 59, 62, 67] },
];

// Original cheerful party melody, 8 bars: [bar, step, note, lengthInSteps]
const MELODY = [
  [0, 0, 'E5', 2], [0, 2, 'G5', 2], [0, 4, 'C6', 4], [0, 8, 'B5', 2], [0, 10, 'G5', 2], [0, 12, 'E5', 4],
  [1, 0, 'A5', 2], [1, 2, 'C6', 2], [1, 4, 'E6', 4], [1, 8, 'D6', 2], [1, 10, 'C6', 2], [1, 12, 'A5', 4],
  [2, 0, 'F5', 2], [2, 2, 'A5', 2], [2, 4, 'C6', 2], [2, 6, 'A5', 2], [2, 8, 'G5', 4], [2, 12, 'F5', 2], [2, 14, 'E5', 2],
  [3, 0, 'D5', 3], [3, 3, 'E5', 1], [3, 4, 'G5', 4], [3, 8, 'B5', 4], [3, 12, 'D6', 4],
  [4, 0, 'C6', 2], [4, 2, 'B5', 2], [4, 4, 'G5', 2], [4, 6, 'E5', 2], [4, 8, 'G5', 4], [4, 12, 'C6', 4],
  [5, 0, 'E6', 2], [5, 2, 'D6', 2], [5, 4, 'C6', 2], [5, 6, 'A5', 2], [5, 8, 'C6', 4], [5, 12, 'E6', 4],
  [6, 0, 'F6', 2], [6, 2, 'E6', 2], [6, 4, 'D6', 2], [6, 6, 'C6', 2], [6, 8, 'A5', 4], [6, 12, 'C6', 2], [6, 14, 'D6', 2],
  [7, 0, 'B5', 4], [7, 4, 'G5', 2], [7, 6, 'A5', 2], [7, 8, 'B5', 6], [7, 14, 'D6', 2],
].map(([bar, step, note, len]) => ({ at: bar * 16 + step, m: n2m(note), len }));

const STYLES = {
  title: { bpm: 108, kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', bass: 'x..x..x...x..x..', arp: 'music', lead: 'lead', melodyGain: 0.09, transpose: 0, swing: 0.08 },
  balloon: { bpm: 124, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x.x...x.x.x...x.', arp: 'pluck', lead: 'lead', melodyGain: 0.075, transpose: 2, swing: 0.1 },
  cake: { bpm: 96, kick: 'x.........x.....', snare: '....x.......x...', hat: '..x...x...x...x.', bass: 'x.......x.......', arp: 'music', lead: 'music', melodyGain: 0.1, transpose: -3, swing: 0.12 },
  dash: { bpm: 140, kick: 'x...x...x...x..x', snare: '....x.......x...', hat: 'xxx.xxx.xxx.xxx.', bass: 'x.xxx.xxx.xxx.xx', arp: 'pluck', lead: 'lead', melodyGain: 0.07, transpose: 5, swing: 0 },
  finale: { bpm: 116, kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: 'x..x..x...x..x..', arp: 'music', lead: 'lead', melodyGain: 0.09, transpose: 0, swing: 0.08 },
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    try { this.muted = localStorage.getItem('sbb-muted') === '1'; } catch { this.muted = false; }
    this.song = null;
    this._timer = null;
  }

  unlock() {
    if (!this.ctx) this._init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.85;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = 0.55;
    this.music.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.4, 2.8);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.5;
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.master);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  _impulse(dur, decay) {
    const ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * dur);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('sbb-muted', m ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  // ---------- low level helpers ----------
  _tone(type, freq, t, dur, { gain = 0.3, attack = 0.005, dest = null, slideTo = null, send = 0, detune = 0, filter = null } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type || 'lowpass';
      f.frequency.setValueAtTime(filter.freq, t);
      if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t + dur);
      f.Q.value = filter.q ?? 0.7;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest || this.sfx);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(this.reverbSend);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
    return { osc: o, gain: g };
  }

  _noise(t, dur, { gain = 0.3, type = 'bandpass', freq = 1000, to = null, q = 1, attack = 0.002, dest = null, send = 0 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest || this.sfx);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(this.reverbSend);
    }
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  _ok() {
    return this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  // ---------- sound effects ----------
  click() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._tone('sine', 900, t, 0.09, { gain: 0.18, slideTo: 1300 });
    this._tone('triangle', 1800, t, 0.05, { gain: 0.05 });
  }

  pop(pitch = 1) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const p = pitch * (0.85 + Math.random() * 0.3);
    this._noise(t, 0.09, { gain: 0.9, type: 'highpass', freq: 900 * p, q: 0.5 });
    this._noise(t, 0.05, { gain: 0.6, type: 'bandpass', freq: 3200 * p, q: 1.2 });
    this._tone('sine', 220 * p, t, 0.12, { gain: 0.45, slideTo: 60 });
  }

  chime(midi, { gain = 0.16, dur = 1.4, send = 0.5 } = {}) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const f = mtof(midi);
    this._tone('sine', f, t, dur, { gain, send });
    this._tone('sine', f * 2.0, t, dur * 0.6, { gain: gain * 0.35, send });
    this._tone('sine', f * 3.01, t, dur * 0.35, { gain: gain * 0.18, send });
    this._tone('triangle', f * 4.2, t, dur * 0.15, { gain: gain * 0.08 });
  }

  sparkle(base = 84) {
    if (!this._ok()) return;
    const notes = [0, 4, 7, 12, 16];
    notes.forEach((n, i) => setTimeout(() => this.chime(base + n, { gain: 0.08, dur: 0.9 }), i * 45));
  }

  coin(step = 0) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const up = Math.min(step, 12);
    const f1 = mtof(83 + up), f2 = mtof(88 + up);
    this._tone('square', f1, t, 0.07, { gain: 0.07, filter: { freq: 3500 } });
    this._tone('square', f2, t + 0.06, 0.22, { gain: 0.07, filter: { freq: 3500 }, send: 0.2 });
    this._tone('sine', f2 * 2, t + 0.06, 0.2, { gain: 0.04 });
  }

  whoosh(dur = 0.35, gain = 0.25) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._noise(t, dur, { gain, type: 'bandpass', freq: 400, to: 2200, q: 1.5, attack: dur * 0.4 });
  }

  plop(pitch = 1) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._tone('sine', 320 * pitch, t, 0.18, { gain: 0.5, slideTo: 110 * pitch });
    this._noise(t, 0.12, { gain: 0.25, type: 'lowpass', freq: 1200, q: 0.5 });
  }

  thud() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._tone('sine', 140, t, 0.35, { gain: 0.7, slideTo: 40 });
    this._noise(t, 0.25, { gain: 0.4, type: 'lowpass', freq: 500, q: 0.5 });
  }

  perfect(streak = 1) {
    if (!this._ok()) return;
    const base = 76 + Math.min(streak - 1, 8) * 2;
    [0, 4, 7, 12].forEach((n, i) => setTimeout(() => this.chime(base + n, { gain: 0.11, dur: 1.1 }), i * 60));
  }

  fail() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._tone('triangle', 392, t, 0.28, { gain: 0.25, slideTo: 330, filter: { freq: 2000 } });
    this._tone('triangle', 330, t + 0.28, 0.32, { gain: 0.25, slideTo: 262, filter: { freq: 2000 } });
    this._tone('triangle', 262, t + 0.6, 0.7, { gain: 0.25, slideTo: 196, filter: { freq: 1600 } });
  }

  hurt() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._tone('square', 300, t, 0.25, { gain: 0.15, slideTo: 90, filter: { freq: 1800 } });
    this._noise(t, 0.2, { gain: 0.35, type: 'lowpass', freq: 900 });
    this._tone('sine', 120, t, 0.3, { gain: 0.5, slideTo: 50 });
  }

  jump() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._tone('sine', 330, t, 0.18, { gain: 0.25, slideTo: 760 });
    this._tone('triangle', 660, t, 0.12, { gain: 0.06, slideTo: 1400 });
  }

  slide() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.3, { gain: 0.25, type: 'bandpass', freq: 1800, to: 500, q: 2 });
  }

  thunder() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 1.2, { gain: 0.6, type: 'lowpass', freq: 380, to: 80, q: 0.8, attack: 0.01 });
    this._noise(t, 0.12, { gain: 0.45, type: 'highpass', freq: 2000 });
    this._tone('sawtooth', 70, t, 0.6, { gain: 0.15, slideTo: 40, filter: { freq: 300 } });
  }

  partyHorn() {
    if (!this._ok()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(380, t);
    o.frequency.exponentialRampToValueAtTime(560, t + 0.12);
    o.frequency.setValueAtTime(560, t + 0.55);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.75);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9;
    const lg = ctx.createGain();
    lg.gain.value = 14;
    lfo.connect(lg);
    lg.connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2200;
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
    g.gain.setValueAtTime(0.16, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.85);
    lfo.stop(t + 0.85);
    this._noise(t, 0.6, { gain: 0.05, type: 'bandpass', freq: 3000, q: 4 });
  }

  tada() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const chord = [72, 76, 79, 84];
    chord.forEach((m) => {
      this._tone('sawtooth', mtof(m), t, 0.12, { gain: 0.06, filter: { freq: 3000 } });
      this._tone('sawtooth', mtof(m), t + 0.14, 1.2, { gain: 0.07, filter: { freq: 2600, to: 900 }, send: 0.3, detune: 6 });
      this._tone('sawtooth', mtof(m), t + 0.14, 1.2, { gain: 0.05, filter: { freq: 2600, to: 900 }, detune: -8 });
    });
    this.sparkle(88);
  }

  countdown(final = false) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    if (final) {
      this._tone('square', 784, t, 0.4, { gain: 0.1, filter: { freq: 3000 }, send: 0.2 });
      this._tone('square', 1046, t, 0.4, { gain: 0.08, filter: { freq: 3000 } });
    } else {
      this._tone('square', 523, t, 0.16, { gain: 0.09, filter: { freq: 2500 } });
    }
  }

  tick() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._tone('square', 1500, t, 0.03, { gain: 0.05, filter: { freq: 4000 } });
  }

  letter(i) {
    // pentatonic notes so any order of letters sounds nice
    const scale = [72, 74, 76, 79, 81, 84, 86, 88];
    this.chime(scale[i % scale.length], { gain: 0.14, dur: 1.2 });
  }

  firework(dist = 1) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const g = 1 / Math.max(1, dist);
    this._noise(t, 1.6, { gain: 0.55 * g, type: 'lowpass', freq: 600, to: 90, q: 0.7, attack: 0.005, send: 0.3 });
    this._tone('sine', 90, t, 0.6, { gain: 0.5 * g, slideTo: 35 });
    // crackles
    for (let i = 0; i < 18; i++) {
      const ct = t + 0.25 + Math.random() * 0.9;
      this._noise(ct, 0.025, { gain: 0.12 * g * Math.random(), type: 'highpass', freq: 3000 + Math.random() * 3000, q: 1 });
    }
  }

  launch() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.8, { gain: 0.06, type: 'bandpass', freq: 900, to: 2600, q: 6 });
    this._tone('sine', 700, t, 0.7, { gain: 0.03, slideTo: 1500 });
  }

  // Continuous "breath" noise for blowing out candles.
  startBreath() {
    if (!this._ok() || this._breath) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 700;
    f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start();
    this._breath = { src, g, f };
  }

  setBreath(v) {
    if (!this._breath) return;
    const t = this.ctx.currentTime;
    this._breath.g.gain.setTargetAtTime(v * 0.35, t, 0.05);
    this._breath.f.frequency.setTargetAtTime(500 + v * 900, t, 0.05);
  }

  stopBreath() {
    if (!this._breath) return;
    const b = this._breath;
    this._breath = null;
    b.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    setTimeout(() => b.src.stop(), 300);
  }

  // ---------- music ----------
  startMusic(styleName) {
    if (!this.ctx) return;
    if (this.song && this.song.styleName === styleName) return;
    this.stopMusic();
    const style = STYLES[styleName];
    if (!style) return;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + 1.2);
    out.connect(this.music);
    this.song = { styleName, style, step: 0, next: this.ctx.currentTime + 0.15, out };
    this._timer = setInterval(() => this._schedule(), 25);
  }

  stopMusic(fade = 0.6) {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    if (this.song && this.ctx) {
      const out = this.song.out;
      const t = this.ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      setTimeout(() => out.disconnect(), fade * 1000 + 200);
    }
    this.song = null;
  }

  duckMusic(amount = 0.35, time = 1.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setTargetAtTime(0.55 * amount, t, 0.08);
    this.music.gain.setTargetAtTime(0.55, t + time, 0.4);
  }

  _schedule() {
    const s = this.song;
    if (!s || !this.ctx) return;
    if (this.ctx.state !== 'running') {
      s.next = this.ctx.currentTime + 0.1;
      return;
    }
    const stepDur = 60 / s.style.bpm / 4;
    while (s.next < this.ctx.currentTime + 0.15) {
      let t = s.next;
      if (s.step % 2 === 1) t += stepDur * s.style.swing;
      this._playStep(s, s.step, t, stepDur);
      s.next += stepDur;
      s.step++;
    }
  }

  _playStep(s, step, t, stepDur) {
    const st = s.style;
    const out = s.out;
    const tr = st.transpose;
    const inBar = step % 16;
    const bar = Math.floor(step / 16);
    const chord = CHORDS[bar % 4];
    const section = Math.floor(bar / 8) % 2; // 0 = melody, 1 = groove
    const intro = bar < 2;

    // drums
    if (!intro || inBar >= 8) {
      if (st.kick[inBar] === 'x') this._kick(t, out);
      if (st.snare[inBar] === 'x') this._clap(t, out);
    }
    if (st.hat[inBar] === 'x') this._hat(t, out, inBar % 4 === 2 ? 0.05 : 0.03);

    // bass
    if (st.bass[inBar] === 'x' && !intro) {
      const fifth = inBar === 10 || inBar === 14 ? 7 : 0;
      this._bass(t, chord.bass + tr + fifth, stepDur * 1.8, out);
    }

    // pad on every bar
    if (inBar === 0) this._pad(t, chord.pad.map((m) => m + tr), stepDur * 16, out);

    // arpeggio
    if (inBar % 2 === 0 || st.arp === 'pluck') {
      const idx = [0, 1, 2, 3, 2, 1, 3, 2][(inBar >> (st.arp === 'pluck' ? 0 : 1)) % 8];
      const m = chord.arp[idx] + tr + 12;
      if (st.arp === 'pluck') this._pluck(t, m, stepDur * 1.5, out, 0.035);
      else this._musicBox(t, m, 0.6, out, 0.05);
    }

    // melody
    if (section === 0 && !intro) {
      const local = (bar - 2) % 8;
      const at = local * 16 + inBar;
      for (const n of MELODY) {
        if (n.at === at) {
          const m = n.m + tr - 12;
          if (st.lead === 'music') this._musicBox(t, m, n.len * stepDur * 2.2, out, st.melodyGain * 1.4);
          else this._lead(t, m, n.len * stepDur * 0.95, out, st.melodyGain);
        }
      }
    } else if (!intro && inBar % 4 === 0) {
      // sparkly counter-line in the groove section
      const m = chord.arp[(inBar / 4 + bar) % 4] + tr + 12;
      this._musicBox(t, m, 0.9, out, 0.045);
    }
  }

  _kick(t, out) {
    this._tone('sine', 150, t, 0.32, { gain: 0.55, slideTo: 42, dest: out });
    this._tone('triangle', 900, t, 0.02, { gain: 0.08, dest: out });
  }

  _clap(t, out) {
    for (let i = 0; i < 3; i++) this._noise(t + i * 0.011, 0.05 + (i === 2 ? 0.1 : 0), { gain: 0.16, type: 'bandpass', freq: 1500, q: 1.1, dest: out });
  }

  _hat(t, out, g) {
    this._noise(t, 0.045, { gain: g, type: 'highpass', freq: 7500, q: 0.8, dest: out });
  }

  _bass(t, m, dur, out) {
    const f = mtof(m);
    this._tone('triangle', f, t, dur, { gain: 0.22, dest: out, attack: 0.008 });
    this._tone('sine', f / 2, t, dur, { gain: 0.16, dest: out, attack: 0.008 });
  }

  _pad(t, notes, dur, out) {
    const ctx = this.ctx;
    notes.forEach((m, i) => {
      const f = mtof(m);
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        const flt = ctx.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.value = 900;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.012, t + 0.35);
        g.gain.setValueAtTime(0.012, t + dur - 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(flt);
        flt.connect(g);
        g.connect(out);
        if (i === 0) {
          const sg = ctx.createGain();
          sg.gain.value = 0.6;
          g.connect(sg);
          sg.connect(this.reverbSend);
        }
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    });
  }

  _pluck(t, m, dur, out, gain) {
    const f = mtof(m);
    this._tone('sawtooth', f, t, dur, { gain, dest: out, filter: { freq: 3200, to: 500, q: 2 }, send: 0.15 });
    this._tone('square', f * 2, t, dur * 0.5, { gain: gain * 0.25, dest: out, filter: { freq: 2500, to: 600 } });
  }

  _musicBox(t, m, dur, out, gain) {
    const f = mtof(m);
    this._tone('sine', f, t, dur, { gain, dest: out, send: 0.35 });
    this._tone('sine', f * 4, t, dur * 0.25, { gain: gain * 0.25, dest: out });
    this._tone('triangle', f * 2, t, dur * 0.4, { gain: gain * 0.2, dest: out });
  }

  _lead(t, m, dur, out, gain) {
    const f = mtof(m);
    const { osc } = this._tone('square', f, t, Math.max(0.12, dur), { gain, dest: out, attack: 0.012, filter: { freq: 2600, q: 0.8 }, send: 0.25 });
    // gentle vibrato
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const lg = this.ctx.createGain();
    lg.gain.value = f * 0.006;
    lfo.connect(lg);
    lg.connect(osc.frequency);
    lfo.start(t + 0.08);
    lfo.stop(t + Math.max(0.12, dur) + 0.05);
    this._tone('triangle', f * 2, t, Math.max(0.1, dur * 0.8), { gain: gain * 0.35, dest: out, attack: 0.01 });
  }

  // "Happy Birthday to You" (traditional, public domain) on a music box with
  // soft chords. onSyllable(i) is called as each syllable plays.
  playHappyBirthday(onSyllable, onDone) {
    this.stopMusic(0.4);
    const ctx = this.ctx;
    const syllables = [];
    if (!ctx) {
      setTimeout(() => onDone?.(), 100);
      return;
    }
    const beat = 0.56;
    const song = [
      ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
      ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
      ['G4', 0.75], ['G4', 0.25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
      ['F5', 0.75], ['F5', 0.25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 3],
    ];
    const chords = [
      // [beatOffset, notes]
      [0, null], [1, [48, 55, 64]], [4, [43, 55, 62, 65]], [7, [43, 55, 62, 65]], [10, [48, 55, 64]],
      [13, [48, 55, 64]], [16, [53, 57, 65]], [18, [53, 60, 65]], [19.5, [53, 60, 65]], [20.75, [48, 55, 64]], [21.75, [43, 55, 62, 65]], [22.75, [48, 55, 64, 72]],
    ];
    const t0 = ctx.currentTime + 0.4;
    let tb = 0;
    const muted = this.muted;
    song.forEach(([name, len], i) => {
      const t = t0 + tb * beat;
      if (!muted) {
        const m = n2m(name) + 12;
        this._musicBox(t, m, len * beat * 2.4, this.sfx, 0.16);
        this._tone('triangle', mtof(m), t, len * beat * 0.95, { gain: 0.05, attack: 0.02, send: 0.2 });
      }
      syllables.push(setTimeout(() => onSyllable?.(i), (t - ctx.currentTime) * 1000));
      tb += len;
    });
    if (!muted) {
      chords.forEach(([b, notes]) => {
        if (!notes) return;
        const t = t0 + b * beat;
        notes.forEach((m) => this._tone('sine', mtof(m), t, beat * 2.6, { gain: 0.045, attack: 0.05, send: 0.3 }));
      });
    }
    const total = (t0 - ctx.currentTime) + tb * beat;
    syllables.push(setTimeout(() => onDone?.(), total * 1000 + 300));
    this._hbTimers = syllables;
  }

  cancelHappyBirthday() {
    (this._hbTimers || []).forEach(clearTimeout);
    this._hbTimers = null;
  }
}

export const audio = new AudioEngine();
