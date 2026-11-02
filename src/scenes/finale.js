import * as THREE from 'three';
import { BaseScene } from '../core/scene.js';
import { audio } from '../core/audio.js';
import { rand, pick, clamp, damp, fitFov, skyMaterial, canvasTexture, softDotTexture, PARTY_COLORS, FOIL_COLORS, formatNumber, easeInOutCubic } from '../core/util.js';
import { createFoilWord } from '../models/foilText.js';
import { createCakeLayer, createCandle, FLAVORS } from '../models/cake.js';
import { BalloonOnString } from '../models/stringBalloon.js';
import { createTable, createCakeStand, createStringLights, createGiftBox, createBokeh } from '../models/decor.js';
import { Mascot } from '../models/mascot.js';
import { Confetti } from '../fx/confetti.js';
import { GlowParticles, Fireworks } from '../fx/particles.js';

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

let _flameTex = null;
function flameTexture() {
  if (_flameTex) return _flameTex;
  _flameTex = canvasTexture(64, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h * 0.68, 1, w / 2, h * 0.6, h * 0.55);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,240,180,1)');
    grd.addColorStop(0.45, 'rgba(255,170,60,0.85)');
    grd.addColorStop(0.75, 'rgba(255,90,30,0.25)');
    grd.addColorStop(1, 'rgba(255,60,20,0)');
    g.fillStyle = grd;
    g.beginPath();
    // teardrop
    g.moveTo(w / 2, 2);
    g.bezierCurveTo(w * 0.62, h * 0.35, w * 0.95, h * 0.62, w / 2, h - 4);
    g.bezierCurveTo(w * 0.05, h * 0.62, w * 0.38, h * 0.35, w / 2, 2);
    g.fill();
  }, { srgb: false });
  return _flameTex;
}

export class FinaleScene extends BaseScene {
  constructor(game) {
    super(game);
    this.scene.environment = game.nightEnvMap;
    this.viewOpts = { bloom: { strength: 0.85, radius: 0.45, threshold: 2.3 }, exposure: 1.0, vignette: 0.42, saturation: 1.15 };
    this.camPos = new THREE.Vector3(0, 3, 12);
    this.camLook = new THREE.Vector3(0, 2.2, 0);
  }

  async build() {
    const s = this.scene;
    const cfg = this.game.config;

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(190, 48, 24), skyMaterial([
      [-1, 0x05040c], [-0.02, 0x1a1236], [0.05, 0x2b1a4e], [0.25, 0x130d33], [1, 0x04030f],
    ], { stars: 1.2 }));
    this.sky.renderOrder = -1;
    s.add(this.sky);
    s.fog = new THREE.Fog(0x0e0820, 30, 95);
    // moon
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: new THREE.Color(1.1, 1.08, 1.0), fog: false, depthWrite: false, transparent: true }));
    moon.position.set(30, 34, -75);
    moon.scale.setScalar(6);
    s.add(moon);
    const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: new THREE.Color(0.16, 0.16, 0.28), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    moonHalo.position.copy(moon.position);
    moonHalo.scale.setScalar(28);
    s.add(moonHalo);

    // lights
    this.hemi = new THREE.HemisphereLight(0x6a5ab8, 0x141020, 0.45);
    s.add(this.hemi);
    const moonLight = new THREE.DirectionalLight(0xaab8ff, 0.7);
    moonLight.position.set(8, 14, 4);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(2048, 2048);
    Object.assign(moonLight.shadow.camera, { left: -7, right: 7, top: 7, bottom: -3, near: 1, far: 40 });
    moonLight.shadow.bias = -0.0005;
    moonLight.shadow.normalBias = 0.03;
    moonLight.shadow.radius = 5;
    s.add(moonLight);
    this.moonLight = moonLight;
    this.candleLight = new THREE.PointLight(0xffa04a, 12, 10, 1.6);
    s.add(this.candleLight);
    this.candleLight2 = new THREE.PointLight(0xff8a3a, 5, 6, 1.6);
    s.add(this.candleLight2);
    this.partyLight = new THREE.PointLight(0xff7ac0, 0, 20, 1.5);
    this.partyLight.position.set(-4, 5, 4);
    this.partyLight2 = new THREE.PointLight(0x6fd0ff, 0, 20, 1.5);
    this.partyLight2.position.set(4, 5, 4);
    s.add(this.partyLight, this.partyLight2);

    // ground
    const grassTex = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = '#25402a';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8000; i++) {
        g.fillStyle = `hsla(${rand(100, 140)}, 40%, ${rand(14, 30)}%, 0.6)`;
        g.fillRect(rand(0, w), rand(0, h), 1.5, rand(2, 6));
      }
    }, { repeat: [30, 30] });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 64), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);
    // tree silhouettes
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x0e1a16, roughness: 1 });
    for (let i = 0; i < 30; i++) {
      const a = rand(Math.PI * 0.95, Math.PI * 2.05);
      const d = rand(24, 45);
      const h = rand(4, 9);
      const tree = new THREE.Mesh(new THREE.ConeGeometry(rand(1.5, 2.8), h, 8), treeMat);
      tree.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d);
      s.add(tree);
    }

    // table + the big birthday cake
    const table = createTable({ radius: 1.9, height: 1.0, cloth: 0xfff6fb, trim: 0xffc23d });
    s.add(table);
    let y = table.userData.topY;
    const stand = createCakeStand({ radius: 1.5, height: 0.3 });
    stand.position.y = y;
    s.add(stand);
    y += stand.userData.topY;
    const tiers = [
      { r: 1.18, h: 0.62, f: FLAVORS[0] },
      { r: 0.86, h: 0.55, f: FLAVORS[2] },
      { r: 0.6, h: 0.5, f: FLAVORS[4] },
    ];
    this.cake = new THREE.Group();
    tiers.forEach((t, i) => {
      const layer = createCakeLayer({ radius: t.r, height: t.h, flavor: t.f, sprinkles: i === 2 ? 50 : 110, dripMax: 0.3 });
      layer.position.y = y;
      this.cake.add(layer);
      if (i === 0) this._nameBand(layer, t.r, t.h, y, cfg);
      y += layer.userData.topY;
    });
    s.add(this.cake);
    this.cakeTopY = y;

    // candles
    const count = cfg.age > 0 ? Math.min(cfg.age, 24) : 7;
    this.candles = [];
    const flameMat = new THREE.SpriteMaterial({ map: flameTexture(), color: new THREE.Color(3.2, 2.4, 1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const glowMat = new THREE.SpriteMaterial({ map: softDotTexture(), color: new THREE.Color(1.0, 0.55, 0.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3 });
    const candleColors = [0xffffff, 0xfff1a8, 0xd8f4ff, 0xffe1f0, 0xe6dcff];
    const rings = count > 12 ? [[Math.ceil(count * 0.6), 0.44], [count - Math.ceil(count * 0.6), 0.22]] : [[count, count === 1 ? 0 : 0.4]];
    for (const [n, rr] of rings) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (rr < 0.3 ? 0.3 : 0);
        const c = createCandle({ height: rand(0.36, 0.44), color: candleColors[i % candleColors.length] });
        c.position.set(Math.sin(a) * rr, y - 0.01, Math.cos(a) * rr);
        this.scene.add(c);
        const flame = new THREE.Sprite(flameMat.clone());
        flame.center.set(0.5, 0.12);
        flame.position.set(c.position.x, y + c.userData.wickY - 0.01, c.position.z);
        flame.scale.set(0.11, 0.22, 1);
        const glow = new THREE.Sprite(glowMat.clone());
        glow.position.copy(flame.position).add(new THREE.Vector3(0, 0.07, 0));
        glow.scale.setScalar(0.6);
        s.add(flame, glow);
        this.candles.push({ c, flame, glow, lit: true, blow: 0, need: rand(0.5, 1.3) * (1 + Math.max(0, -c.position.z) * 0.6), phase: rand(0, 10), out: 0 });
      }
    }
    this.candleMeshes = this.candles.map((k) => k.c.children[0]);

    // name in foil balloon letters behind the cake
    this.word = createFoilWord(cfg.name.toUpperCase(), { size: cfg.name.length > 8 ? 0.62 : 0.78, colors: [FOIL_COLORS.rose, FOIL_COLORS.gold, FOIL_COLORS.pink, FOIL_COLORS.purple, FOIL_COLORS.rose, FOIL_COLORS.gold, FOIL_COLORS.pink, FOIL_COLORS.purple], spacing: 0.06 });
    this.word.position.set(0, 4.5, -2.6);
    s.add(this.word);
    this.letters = this.word.userData.letters;
    this.wordGlow = new THREE.PointLight(0xffd0e8, 0, 9, 1.5);
    this.wordGlow.position.set(0, 4.4, 1.6);
    s.add(this.wordGlow);

    // decorations
    this.updaters = [];
    const poles = [[-6, -3.5], [6, -3.5], [-5, 4.5], [5, 4.5]];
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a2a40, roughness: 0.8 });
    for (const [x, z] of poles) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 8), poleMat);
      p.position.set(x, 3, z);
      s.add(p);
    }
    this.lightStrings = [];
    for (const [a, b] of [[0, 1], [2, 3], [0, 3], [1, 2], [0, 2], [1, 3]]) {
      const [x1, z1] = poles[a], [x2, z2] = poles[b];
      const l = createStringLights(new THREE.Vector3(x1, 5.9, z1), new THREE.Vector3(x2, 5.9, z2), { sag: 1.0, count: 18, bulbSize: 0.065, intensity: 3.6, colors: [0xffd27a, 0xfff2d0, 0xffb36b] });
      s.add(l);
      this.updaters.push(l.userData.update);
      this.lightStrings.push(l);
    }
    // glowing paper lanterns
    this.lanterns = [];
    const lanternColors = [0xff7ac0, 0xffb36b, 0x8fd8ff, 0xffe27a, 0xc79bff];
    for (let i = 0; i < 9; i++) {
      const col = new THREE.Color(lanternColors[i % lanternColors.length]);
      const lan = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.2, roughness: 0.8 }));
      body.scale.y = 0.85;
      lan.add(body);
      for (const yy of [-0.28, 0.28]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0x2a1c30 }));
        cap.position.y = yy;
        lan.add(cap);
      }
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.18 }));
      halo.scale.setScalar(2.2);
      lan.add(halo);
      const side = i % 2 ? 1 : -1;
      lan.position.set(side * rand(2.6, 6), rand(4.2, 5.4), rand(-3.5, 3.5));
      lan.userData.phase = rand(0, 6);
      lan.userData.baseY = lan.position.y;
      s.add(lan);
      this.lanterns.push(lan);
    }
    const bokeh = createBokeh({ count: 50, center: new THREE.Vector3(0, 5, -30), spread: new THREE.Vector3(35, 8, 6), sizeMin: 1, sizeMax: 3, opacity: 0.25, colors: [0xffc46b, 0xff7ac0, 0xffe2a8, 0x9a8cff] });
    s.add(bokeh);
    this.updaters.push(bokeh.userData.update);

    for (const [x, z, w, c] of [[-2.4, 1.6, 0.7, 0xff3d8b], [-2.9, 0.6, 0.5, 0x2fc6ff], [2.5, 1.4, 0.8, 0x9a55ff], [2.9, 0.2, 0.55, 0xffb21e], [2.2, 2.4, 0.45, 0x2bd98f]]) {
      const g = createGiftBox({ w, h: w * 0.85, d: w, color: c, ribbon: pick([0xffffff, 0xffd23d]) });
      g.position.set(x, 0, z);
      g.rotation.y = rand(-0.8, 0.8);
      s.add(g);
    }
    this.tethered = [];
    for (const [x, z] of [[-3.2, -0.8], [3.3, -0.9]]) {
      for (let i = 0; i < 5; i++) {
        const b = new BalloonOnString({ color: PARTY_COLORS[(i * 3 + (x > 0 ? 1 : 4)) % 8], scale: 0.46, length: 3.1 + rand(-0.4, 0.6), anchor: new THREE.Vector3(x, 0.05, z) });
        b.wind.set((i - 2) * 0.7, 0, rand(-0.3, 0.3));
        b.addTo(s);
        this.tethered.push(b);
      }
    }

    this.mascot = new Mascot();
    this.mascot.group.position.set(-1.9, 0, 2.3);
    this.mascot.group.rotation.y = 0.5;
    this.mascot.group.scale.setScalar(1.0);
    s.add(this.mascot.group);

    this.confetti = new Confetti(s, { max: 2200, floorY: 0.01 });
    this.glow = new GlowParticles(s, { max: 6000 });
    this.fireworks = new Fireworks(this.glow, { camera: this.camera });
  }

  _nameBand(layer, r, h, y, cfg) {
    // a fondant ribbon around the bottom tier with her name piped on
    const name = cfg.name;
    const tex = canvasTexture(2048, 160, (g, w, hh) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, hh);
      g.fillStyle = '#ffc23d';
      g.fillRect(0, 8, w, 7);
      g.fillRect(0, hh - 15, w, 7);
      g.fillStyle = '#ff4fa3';
      g.font = '400 96px Pacifico, cursive';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const label = cfg.age > 0 ? `Happy ${ordinal(cfg.age)} ${name}` : `Happy Birthday ${name}`;
      g.fillText(label, w / 2, hh / 2 + 4);
      // little hearts around the band
      g.font = '40px sans-serif';
      for (let x = 60; x < w; x += 170) {
        if (Math.abs(x - w / 2) < 520) continue;
        g.fillText('♥', x, hh / 2 + 2);
      }
    });
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.012, r + 0.012, 0.24, 96, 1, true, Math.PI, Math.PI * 2),
      new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.4, clearcoat: 0.3 })
    );
    band.position.y = h * 0.42;
    layer.add(band);
  }

  resize(w, h) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.fov = fitFov(45, aspect, 50);
    this.camera.updateProjectionMatrix();
    this.glow?.resize();
    this.portrait = aspect < 0.85;
  }

  // ---------- flow ----------
  enter(opts = {}) {
    this.opts = opts;
    this.phase = 'intro';
    this.phaseT = 0;
    this.blowStrength = 0;
    this.holding = false;
    this.celebrateT = 0;
    this.fwTimer = 0;
    this.fireworksLeft = 0;
    this.allOut = false;
    for (const k of this.candles) {
      k.lit = true;
      k.blow = 0;
      k.out = 0;
      k.flame.visible = k.glow.visible = true;
    }
    this.partyLight.intensity = this.partyLight2.intensity = 0;
    this.wordGlow.intensity = 0;
    this.hemi.intensity = 0.45;
    clearTimeout(this._timeout);
    audio.cancelHappyBirthday();
    audio.stopBreath();
    this._stopMic();
    this.confetti.clear();
    this.confetti.setRain(0);
    this.glow.clear();
    this.fireworks.rockets.length = 0;
    this.mascot.setState('idle');
    this.camPos.set(0, 3.4, 13);
    this.ui.show('finale');
    this.ui.finaleCard.classList.remove('show');
    this.ui.finaleCard.innerHTML = '';
    this.ui.finaleBottom.innerHTML = '';
    this._renderLyrics(-1);
    audio.stopMusic(0.8);
    this._timeout = setTimeout(() => this._startSong(), 1600);
  }

  exit() {
    clearTimeout(this._timeout);
    audio.cancelHappyBirthday();
    audio.stopBreath();
    this._stopMic();
    this.ui.finaleCard.classList.remove('show');
    this.ui.finaleBottom.innerHTML = '';
    this.ui.finaleLyrics.innerHTML = '';
    this.phase = 'gone';
  }

  _lyricLines() {
    const name = this.game.config.name;
    // split the name into two singable parts ("Sy" + "delle")
    let k = 1;
    const m = /^[^aeiouy]*[aeiouy]+/i.exec(name);
    if (m) k = Math.min(Math.max(1, m[0].length), name.length - 1);
    const n1 = name.slice(0, k), n2 = name.slice(k);
    return [
      [['Hap', 'py'], ['birth', 'day'], ['to'], ['you']],
      [['Hap', 'py'], ['birth', 'day'], ['to'], ['you']],
      [['Hap', 'py'], ['birth', 'day'], ['dear'], n2 ? [n1, n2] : [n1, '']],
      [['Hap', 'py'], ['birth', 'day'], ['to'], ['you!']],
    ];
  }

  _renderLyrics(idx) {
    const lines = this._lyricLines();
    const el = this.ui.finaleLyrics;
    if (idx < 0) {
      el.innerHTML = `<span class="w on">🎂 Make a wish… 🎂</span>`;
      return;
    }
    // which line is idx in?
    let count = 0, lineIdx = 0, local = idx;
    for (let l = 0; l < lines.length; l++) {
      const n = lines[l].flat().length;
      if (idx < count + n) { lineIdx = l; local = idx - count; break; }
      count += n;
    }
    let s = 0;
    const html = lines[lineIdx].map((word) => '<span style="white-space:nowrap">' + word.map((syl) => {
      const cls = s < local ? 'w done' : s === local ? 'w on' : 'w';
      s++;
      return `<span class="${cls}" style="margin:0">${syl}</span>`;
    }).join('') + '</span>').join(' ');
    el.innerHTML = html;
  }

  _startSong() {
    if (this.phase !== 'intro') return;
    this.phase = 'song';
    this.phaseT = 0;
    audio.unlock();
    this.mascot.setState('wave');
    audio.playHappyBirthday((i) => {
      this._renderLyrics(i);
      // little sparkle pulse on each note
      const l = this.letters[i % this.letters.length];
      if (l) {
        const p = new THREE.Vector3();
        l.getWorldPosition(p);
        this.glow.sparkle(p, { count: 10, color: new THREE.Color(1, 0.8, 0.9), speed: 1.5, size: 0.1, life: 0.7, intensity: 2.5 });
        l.userData.pulse = 1;
      }
    }, () => this._askWish());
  }

  _askWish() {
    if (this.phase !== 'song' && this.phase !== 'intro') return;
    this.phase = 'wish';
    this.phaseT = 0;
    this.mascot.setState('idle');
    const name = this.game.config.name;
    this.ui.finaleLyrics.innerHTML = `<span class="w on">Make a wish, ${name}! ✨</span>`;
    const micOK = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    this.ui.finaleBottom.innerHTML = `
      <div class="finale-prompt">Now blow out the candles! 🕯️<small>Blow into your microphone, hold the button, or tap the candles</small></div>
      <div class="blow-meter"><div id="blow-fill"></div></div>
      <div class="btn-row">
        ${micOK ? '<button class="btn blue" id="btn-mic">🎤 Use Microphone</button>' : ''}
        <button class="btn gold" id="btn-blow">💨 Hold to Blow</button>
      </div>`;
    const blowBtn = document.getElementById('btn-blow');
    const down = (e) => { e.preventDefault(); this.holding = true; audio.unlock(); audio.startBreath(); };
    const up = () => { this.holding = false; };
    blowBtn.addEventListener('pointerdown', down);
    blowBtn.addEventListener('pointerup', up);
    blowBtn.addEventListener('pointerleave', up);
    blowBtn.addEventListener('pointercancel', up);
    this._keyBlow = (e) => { if (e.code === 'Space') { if (e.type === 'keydown') down(e); else up(); } };
    window.addEventListener('keydown', this._keyBlow);
    window.addEventListener('keyup', this._keyBlow);
    document.getElementById('btn-mic')?.addEventListener('click', () => this._startMic());
  }

  async _startMic() {
    const btn = document.getElementById('btn-mic');
    try {
      audio.unlock();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (this.phase !== 'wish') {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ctx = audio.ctx;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      this.mic = { stream, src, an, buf: new Float32Array(an.fftSize), base: 0.02, calib: 0.6 };
      if (btn) { btn.textContent = '🎤 Listening… blow!'; btn.disabled = true; }
      audio.startBreath();
    } catch (e) {
      if (btn) { btn.textContent = '🎤 Mic unavailable'; btn.disabled = true; }
    }
  }

  _stopMic() {
    if (this.mic) {
      this.mic.stream.getTracks().forEach((t) => t.stop());
      try { this.mic.src.disconnect(); } catch { /* ignore */ }
      this.mic = null;
    }
    if (this._keyBlow) {
      window.removeEventListener('keydown', this._keyBlow);
      window.removeEventListener('keyup', this._keyBlow);
      this._keyBlow = null;
    }
  }

  _micLevel(dt) {
    const m = this.mic;
    if (!m) return 0;
    m.an.getFloatTimeDomainData(m.buf);
    let sum = 0;
    for (let i = 0; i < m.buf.length; i++) sum += m.buf[i] * m.buf[i];
    const rms = Math.sqrt(sum / m.buf.length);
    if (m.calib > 0) {
      m.calib -= dt;
      m.base = Math.max(m.base * 0.9 + rms * 0.1, 0.004);
      return 0;
    }
    const th = m.base * 2.5 + 0.03;
    return clamp((rms - th) / 0.12, 0, 1);
  }

  pointerDown(e) {
    if (this.phase === 'wish') {
      this.rayFromEvent(e);
      const hits = this.raycaster.intersectObjects([...this.candleMeshes, this.cake], true);
      if (hits.length) {
        // blow out the lit candle closest to where you tapped
        const p = hits[0].point;
        let best = null, bd = 1.2;
        for (const k of this.candles) {
          if (!k.lit) continue;
          const d = k.flame.position.distanceTo(p);
          if (d < bd) { bd = d; best = k; }
        }
        if (best) this._blowOut(best);
      }
    } else if (this.phase === 'party') {
      // tap the sky for a firework!
      const ray = this.rayFromEvent(e);
      const p = ray.origin.clone().addScaledVector(ray.direction, 28);
      this.fireworks.launch(clamp(p.x, -18, 18), -18, { height: clamp(p.y + 3, 14, 27) });
      if (this.ui.finaleCard.classList.contains('show') === false && this.cardHidden) {
        // keep watching
      }
    }
  }

  _blowOut(k) {
    k.lit = false;
    k.out = 1;
    audio.whoosh(0.25, 0.1);
    const p = k.flame.position;
    for (let i = 0; i < 14; i++) {
      this.glow.emit({ x: p.x + rand(-0.02, 0.02), y: p.y + 0.05, z: p.z, vx: rand(-0.12, 0.12), vy: rand(0.3, 0.7), vz: rand(-0.12, 0.12), r: 0.5, g: 0.48, b: 0.55, size: rand(0.08, 0.16), life: rand(1.4, 2.4), drag: 0.6, grav: 0.15, shrink: 0, fadeIn: 0.2 });
    }
    this.glow.sparkle(p, { count: 6, color: new THREE.Color(1, 0.6, 0.2), speed: 0.6, size: 0.05, life: 0.5, intensity: 3, grav: 0.5 });
    if (this.candles.every((c) => !c.lit)) this._allOut();
  }

  _allOut() {
    if (this.allOut) return;
    this.allOut = true;
    this.phase = 'dark';
    this.phaseT = 0;
    this.holding = false;
    audio.stopBreath();
    this._stopMic();
    this.ui.finaleBottom.innerHTML = '';
    this.ui.finaleLyrics.innerHTML = '<span class="w on">🌟 Yaaay! 🌟</span>';
  }

  _celebrate() {
    this.phase = 'party';
    this.phaseT = 0;
    const cfg = this.game.config;
    audio.tada();
    setTimeout(() => audio.partyHorn(), 200);
    setTimeout(() => audio.startMusic('finale'), 1600);
    this.engine.doFlash(0.6, 0xfff0f8, 1.5);
    this.mascot.setState('cheer');
    this.ui.finaleLyrics.innerHTML = `<span class="w on">Happy Birthday, ${cfg.name}!</span>`;
    // confetti cannons
    for (const side of [-1, 1]) {
      this.confetti.burst(new THREE.Vector3(side * 4, 0.5, 2), { count: 320, speed: 13, dir: new THREE.Vector3(-side * 0.45, 1, -0.2), spread: 0.35, life: 6 });
    }
    this.confetti.setRain(30, { x: [-7, 7], y: 9, z: [-4, 5] });
    // opening fireworks volley
    for (let i = 0; i < 7; i++) this.fireworks.launch(-15 + i * 5, -16 - rand(0, 8), { delay: 0.1 + i * 0.2, height: rand(20, 25), type: i === 3 ? 'heart' : null });
    this.fwTimer = 2.5;
    setTimeout(() => this._showCard(), 3200);
  }

  _showCard() {
    if (this.phase !== 'party') return;
    const cfg = this.game.config;
    const total = this.opts?.total || 0;
    const title = cfg.age > 0 ? `Happy ${ordinal(cfg.age)} Birthday, ${cfg.name}!` : `Happy Birthday, ${cfg.name}!`;
    const card = this.ui.finaleCard;
    card.innerHTML = `
      <div class="panel">
        <h2>${title}</h2>
        <div class="msg">${cfg.message}</div>
        <div class="from">${cfg.from ? `with love, ${cfg.from} 💖` : 'with lots of love 💖'}</div>
        ${total > 0 ? `<div class="party-total">🏆 Total party points: <b>${formatNumber(total)}</b></div>` : ''}
        <div class="btn-row">
          <button class="btn gold" id="fin-fw">🎆 More Fireworks!</button>
          <button class="btn ghost small" id="fin-watch">👀 Watch</button>
          <button class="btn blue small" id="fin-relight">🕯️ Relight</button>
          <button class="btn ghost small" id="fin-menu">🎮 Games</button>
        </div>
      </div>`;
    card.classList.add('show');
    this.ui.finaleLyrics.innerHTML = '';
    document.getElementById('fin-fw').addEventListener('click', () => { audio.click(); this._volley(); });
    document.getElementById('fin-watch').addEventListener('click', () => {
      audio.click();
      card.classList.remove('show');
      this.ui.finaleBottom.innerHTML = '<button class="btn ghost small" id="fin-card">💌 Show card</button><div class="finale-prompt"><small>Tap the sky to launch fireworks!</small></div>';
      document.getElementById('fin-card').addEventListener('click', () => {
        audio.click();
        card.classList.add('show');
        this.ui.finaleBottom.innerHTML = '';
      });
    });
    document.getElementById('fin-relight').addEventListener('click', () => { audio.click(); this.enter(this.opts); });
    document.getElementById('fin-menu').addEventListener('click', () => { audio.click(); this.game.showMenu(); });
  }

  _volley() {
    const types = ['peony', 'heart', 'ring', 'willow', 'crackle', 'double'];
    for (let i = 0; i < 9; i++) {
      this.fireworks.launch(rand(-17, 17), -16 - rand(0, 9), { delay: i * 0.18, height: rand(19, 26), type: pick(types) });
    }
    this.confetti.burst(new THREE.Vector3(0, 6, 0), { count: 120, speed: 6 });
  }

  // ---------- frame ----------
  update(dt, t) {
    this.phaseT += dt;

    // blowing input
    let target = 0;
    if (this.phase === 'wish') {
      if (this.holding) target = 1;
      target = Math.max(target, this._micLevel(dt));
    }
    this.blowStrength = damp(this.blowStrength, target, 10, dt);
    if (this.phase === 'wish') {
      audio.setBreath(this.blowStrength);
      const fill = document.getElementById('blow-fill');
      if (fill) {
        const lit = this.candles.filter((c) => c.lit).length;
        fill.style.width = `${(1 - lit / this.candles.length) * 100}%`;
      }
      if (this.blowStrength > 0.05) {
        // blow candles out one by one, front ones first
        for (const k of this.candles) {
          if (!k.lit) continue;
          k.blow += this.blowStrength * dt * rand(0.6, 1.4);
          if (k.blow > k.need) this._blowOut(k);
        }
      }
    }

    // flames
    let litCount = 0;
    const lean = this.blowStrength;
    for (const k of this.candles) {
      const f = k.flame;
      if (k.lit) {
        litCount++;
        const flick = 0.85 + Math.sin(t * 17 + k.phase) * 0.06 + Math.sin(t * 31 + k.phase * 2) * 0.05 + (Math.random() - 0.5) * 0.08 * (1 + lean * 3);
        f.scale.set(0.1 * (1 + lean * 0.3), 0.21 * flick * (1 - lean * 0.35), 1);
        f.material.rotation = Math.sin(t * 5 + k.phase) * 0.06 - lean * (0.9 + Math.sin(t * 25 + k.phase) * 0.3);
        k.glow.material.opacity = 0.22 + flick * 0.1 - lean * 0.12;
      } else if (k.out > 0) {
        k.out = Math.max(0, k.out - dt * 6);
        f.scale.set(0.1 * k.out, 0.21 * k.out, 1);
        k.glow.material.opacity = 0.5 * k.out;
        if (k.out === 0) f.visible = k.glow.visible = false;
        // lingering smoke wisp
      }
      if (!k.lit && this.phase !== 'party' && Math.random() < dt * 4) {
        const p = f.position;
        this.glow.emit({ x: p.x, y: p.y + 0.05, z: p.z, vx: Math.sin(t + k.phase) * 0.05, vy: rand(0.25, 0.45), r: 0.35, g: 0.33, b: 0.4, size: rand(0.06, 0.12), life: 1.6, drag: 0.4, shrink: 0, fadeIn: 0.3 });
      }
    }
    const litFrac = litCount / this.candles.length;
    const flick = 0.9 + Math.sin(t * 13) * 0.05 + Math.sin(t * 23) * 0.04;
    this.candleLight.position.set(0, this.cakeTopY + 0.6, 0.3);
    this.candleLight.intensity = 14 * litFrac * flick;
    this.candleLight2.position.set(0, this.cakeTopY + 0.3, 1.6);
    this.candleLight2.intensity = 5 * litFrac * flick;

    // phases
    if (this.phase === 'dark' && this.phaseT > 1.1) this._celebrate();
    const party = this.phase === 'party';
    const pt = party ? Math.min(1, this.phaseT / 1.5) : 0;
    this.hemi.intensity = damp(this.hemi.intensity, party ? 0.6 : this.phase === 'dark' ? 0.15 : 0.4, 2, dt);
    this.partyLight.intensity = 22 * pt * (0.8 + Math.sin(t * 2) * 0.2);
    this.partyLight2.intensity = 22 * pt * (0.8 + Math.cos(t * 2.3) * 0.2);
    this.wordGlow.intensity = damp(this.wordGlow.intensity, party ? 10 : 6, 2, dt);
    if (party) {
      this.fwTimer -= dt;
      if (this.fwTimer <= 0) {
        this.fwTimer = rand(0.5, 1.4);
        this.fireworks.launch(rand(-18, 18), -16 - rand(0, 10), { height: rand(19, 26) });
      }
    }

    // foil letters bob & pulse to the song
    this.letters.forEach((l, i) => {
      const u = l.userData;
      u.pulse = Math.max(0, (u.pulse || 0) - dt * 3);
      l.position.y = Math.sin(t * 1.4 + i * 0.7) * 0.1 + (party ? Math.abs(Math.sin(t * 4 + i * 0.5)) * 0.15 : 0);
      l.rotation.y = Math.sin(t * 0.7 + i * 0.6) * 0.25 + (party ? Math.sin(t * 2 + i) * 0.2 : 0);
      l.scale.setScalar(1 + u.pulse * 0.18);
    });

    // camera: slow dolly towards the cake, then pull back for fireworks
    let cp, cl;
    const port = this.portrait ? 1 : 0;
    if (this.phase === 'intro' || this.phase === 'song') {
      const k = easeInOutCubic(clamp(this.phaseT / (this.phase === 'song' ? 14 : 30), 0, 1));
      cp = new THREE.Vector3(Math.sin(t * 0.1) * 0.6, 3.4 - k * 0.2, (13 - k * 4.0) + port * 3.5);
      cl = new THREE.Vector3(0, 3.0 + port * 0.2, 0);
    } else if (this.phase === 'wish' || this.phase === 'dark') {
      cp = new THREE.Vector3(0, 3.5, 7.6 + port * 3.2);
      cl = new THREE.Vector3(0, 3.0, 0);
    } else {
      cp = new THREE.Vector3(Math.sin(t * 0.12) * 1.2, 2.2, 10.5 + port * 3.5);
      cl = new THREE.Vector3(0, 6.6 + port * 0.8, -6);
    }
    const lam = this.phase === 'party' ? 0.9 : 1.6;
    this.camPos.x = damp(this.camPos.x, cp.x, lam, dt);
    this.camPos.y = damp(this.camPos.y, cp.y, lam, dt);
    this.camPos.z = damp(this.camPos.z, cp.z, lam, dt);
    this.camLook.x = damp(this.camLook.x, cl.x, lam, dt);
    this.camLook.y = damp(this.camLook.y, cl.y, lam, dt);
    this.camLook.z = damp(this.camLook.z, cl.z, lam, dt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // lanterns & fireflies
    for (const lan of this.lanterns) {
      lan.position.y = lan.userData.baseY + Math.sin(t * 0.8 + lan.userData.phase) * 0.12;
      lan.rotation.y += dt * 0.2;
    }
    if (Math.random() < dt * 6) {
      this.glow.emit({ x: rand(-7, 7), y: rand(0.3, 3), z: rand(-5, 4), vx: rand(-0.2, 0.2), vy: rand(-0.1, 0.2), vz: rand(-0.2, 0.2), r: 2.2, g: 2.6, b: 0.8, size: 0.07, life: rand(2, 4), drag: 0, fadeIn: 0.8, twinkle: 0.2 });
    }

    for (const b of this.tethered) b.update(dt, t);
    for (const u of this.updaters) u(t);
    this.mascot.update(dt);
    this.sky.material.uniforms.uTime.value = t;
    this.fireworks.update(dt);
    this.confetti.update(dt);
    this.glow.update(dt);
  }
}
