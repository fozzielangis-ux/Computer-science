import * as THREE from 'three';
import { BaseScene } from '../core/scene.js';
import { audio } from '../core/audio.js';
import { rand, pick, clamp, damp, fitFov, canvasTexture, PARTY_COLORS, FOIL_COLORS, formatNumber } from '../core/util.js';
import { createBalloon, foilMaterial, heartGeometry, starGeometry, createStormCloud } from '../models/balloon.js';
import { BalloonOnString } from '../models/stringBalloon.js';
import { createBunting, createStringLights, createGiftBox, createPaperFan } from '../models/decor.js';
import { Confetti } from '../fx/confetti.js';
import { GlowParticles } from '../fx/particles.js';

const DURATION = 60;
const LETTER_COLORS = ['#ff3d8b', '#ffb21e', '#2fc6ff', '#9a55ff', '#2bd98f', '#ff6a3d', '#ff7ad1', '#5a7bff', '#ff3d8b', '#ffb21e', '#2fc6ff', '#9a55ff'];

export class BalloonPopScene extends BaseScene {
  constructor(game) {
    super(game);
    this.viewOpts = { bloom: { strength: 0.65, radius: 0.4, threshold: 2.4 }, exposure: 1.0, vignette: 0.3 };
    this.word = game.config.name.toUpperCase().replace(/[^A-Z]/g, '') || 'SYDELLE';
    this.balloons = [];
    this.mode = 'attract';
  }

  get info() {
    return {
      emoji: '🎈',
      title: 'Balloon Pop',
      desc: 'The party balloons are floating away! Pop as many as you can in <b>60 seconds</b>.',
      howto: [
        ['👆', '<b>Tap</b> or <b>click</b> balloons to pop them'],
        ['🔤', `Pop letters <b>in order</b> to spell <b>${this.word}</b> for a huge bonus`],
        ['⭐', '<b>Gold stars</b> are worth 50 · <b>+5s</b> balloons add time'],
        ['⛈️', 'Don’t pop the <b>grumpy storm clouds!</b>'],
        ['🔥', 'Pop quickly in a row to build a <b>combo</b>'],
      ],
    };
  }

  async build() {
    const s = this.scene;
    // ---- room ----
    const wallTex = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = '#ffd6e8';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? '#ffe6f1' : '#ffc9e0';
        g.fillRect(i * 64, 0, 64, h);
      }
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (let y = 16; y < h; y += 32) for (let x = (y / 32) % 2 ? 16 : 48; x < w; x += 64) {
        g.beginPath();
        g.arc(x, y, 4, 0, Math.PI * 2);
        g.fill();
      }
    }, { repeat: [6, 5] });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(44, 36), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.92 }));
    wall.position.set(0, 10, -4.2);
    wall.receiveShadow = true;
    s.add(wall);
    const wains = new THREE.Mesh(new THREE.BoxGeometry(44, 1.7, 0.12), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, clearcoat: 0.6 }));
    wains.position.set(0, -0.35, -4.12);
    wains.receiveShadow = true;
    s.add(wains);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(44, 0.1, 0.22), new THREE.MeshPhysicalMaterial({ color: 0xff8cc4, roughness: 0.3, clearcoat: 0.8 }));
    rail.position.set(0, 0.5, -4.08);
    s.add(rail);
    const floorTex = canvasTexture(512, 512, (g, w, h) => {
      for (let i = 0; i < 8; i++) {
        const l = 58 + Math.random() * 10;
        g.fillStyle = `hsl(28, 45%, ${l}%)`;
        g.fillRect(0, i * 64, w, 64);
        g.fillStyle = 'rgba(90,50,20,0.35)';
        g.fillRect(0, i * 64, w, 2);
        const off = Math.random() * w;
        g.fillRect(off, i * 64, 2, 64);
        for (let k = 0; k < 30; k++) {
          g.fillStyle = `rgba(120,70,30,${Math.random() * 0.12})`;
          g.fillRect(0, i * 64 + Math.random() * 64, w, 1);
        }
      }
    }, { repeat: [5, 5] });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 24), new THREE.MeshPhysicalMaterial({ map: floorTex, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.15 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -1.2, 6);
    floor.receiveShadow = true;
    s.add(floor);

    // ---- lights ----
    s.add(new THREE.HemisphereLight(0xfff4fa, 0xffc4d8, 1.1));
    const key = new THREE.DirectionalLight(0xfff2e2, 2.4);
    key.position.set(4, 9, 8);
    key.target.position.set(0, 2, -3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -4, near: 1, far: 30 });
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.03;
    key.shadow.radius = 5;
    s.add(key, key.target);
    const fill = new THREE.PointLight(0x9fd8ff, 25, 18, 2);
    fill.position.set(-6, 4, 3);
    s.add(fill);

    // ---- decorations ----
    this.updaters = [];
    const banner = createBunting(new THREE.Vector3(-7, 6.3, -3.9), new THREE.Vector3(7, 6.3, -3.9), { sag: 1.1, text: `HAPPY BIRTHDAY ${this.word}!`, size: 0.5 });
    s.add(banner);
    this.updaters.push(banner.userData.update);
    for (const [a, b, sag, n] of [[[-11, 8.6, -3.95], [11, 8.6, -3.95], 1.6, 34], [[-11, 5.2, -3.95], [-3, 7.4, -3.95], 0.7, 12], [[3, 7.4, -3.95], [11, 5.2, -3.95], 0.7, 12]]) {
      const l = createStringLights(new THREE.Vector3(...a), new THREE.Vector3(...b), { sag, count: n, bulbSize: 0.075, intensity: 7 });
      s.add(l);
      this.updaters.push(l.userData.update);
    }
    // pleated paper fans on the wall
    for (const [x, y, r, c] of [[-5.7, 3.6, 1.0, 0xff7ad1], [5.9, 3.3, 1.1, 0x7fd8ff], [-6.9, 1.6, 0.6, 0xffd23d], [7.0, 5.2, 0.65, 0xb08cff], [-7.2, 5.6, 0.75, 0x6fe3b5], [7.1, 1.4, 0.55, 0xff9a6b]]) {
      const fan = createPaperFan({ radius: r, color: c });
      fan.position.set(x, y, -4.05);
      fan.rotation.z = rand(0, 1);
      s.add(fan);
    }
    // gift piles in the corners
    const gifts = [[-5.2, -1.2, -1.6, 1.0, 0.8], [-4.2, -1.2, -0.6, 0.7, 0.6], [-5.0, -0.4, -1.6, 0.6, 0.5], [5.0, -1.2, -1.2, 1.1, 0.7], [4.0, -1.2, -0.2, 0.6, 0.7], [5.4, -0.5, -1.2, 0.55, 0.45]];
    for (const [x, y, z, w, h] of gifts) {
      const g = createGiftBox({ w, h, d: w, color: pick(PARTY_COLORS), ribbon: pick([0xffffff, 0xffd23d, 0xff3d8b]) });
      g.position.set(x, y, z);
      g.rotation.y = rand(-0.6, 0.6);
      s.add(g);
    }
    // decorative tethered bunches at the far sides
    this.decorBalloons = [];
    for (const [x, z] of [[-7.4, -3.2], [7.4, -3.2]]) {
      for (let i = 0; i < 4; i++) {
        const b = new BalloonOnString({ color: PARTY_COLORS[(i * 2 + (x > 0 ? 1 : 0)) % 8], scale: 0.5, length: 4 + rand(-0.4, 0.6), anchor: new THREE.Vector3(x, -1.2, z) });
        b.wind.set(x > 0 ? -0.8 + i * 0.5 : 0.8 - i * 0.5, 0, 0.3);
        b.addTo(s);
        this.decorBalloons.push(b);
      }
    }

    this.confetti = new Confetti(s, { max: 1800, floorY: -1.19 });
    this.glow = new GlowParticles(s, { max: 3000 });

    // shared shapes for special balloons
    this.heartGeo = heartGeometry();
    this.starGeo = starGeometry();
  }

  resize(w, h) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.fov = fitFov(46, aspect, 54);
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 2.4, 9.5);
    this.camera.lookAt(0, 2.4, 0);
    const halfV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 9.5;
    const halfH = halfV * aspect;
    this.spawnY = 2.4 - halfV - 1.6;
    this.exitY = 2.4 + halfV + 2.0;
    this.spawnX = Math.min(4.6, halfH * 0.82);
    this.glow?.resize();
  }

  // ---------- game state ----------
  prepare() {
    for (const b of this.balloons) this._remove(b);
    this.balloons = [];
    this.confetti.clear();
    this.glow.clear();
    this.mode = 'attract';
    this.score = 0;
    this.timeLeft = DURATION;
    this.combo = 0;
    this.lastPopT = -10;
    this.bestCombo = 1;
    this.popped = 0;
    this.nameIdx = 0;
    this.wordsDone = 0;
    this.spawnT = 0;
    this.letterT = 1.5;
    this.elapsed = 0;
    this.lastTick = 99;
    this.stormHits = 0;
    this.stars = 0;
    // fill the screen with a few balloons immediately
    for (let i = 0; i < 9; i++) {
      const b = this._spawn('normal');
      b.obj.group.position.y = rand(this.spawnY + 1, this.exitY - 2);
      b.str?.reset();
    }
  }

  showHud() {
    this.ui.hud(true, { timer: true, letters: true, hint: `Tap the balloons! Spell ${this.word} in order 🔤` });
    this.ui.setTime(DURATION, DURATION);
    this.ui.setLetters(this.word, 0, LETTER_COLORS);
  }

  enter() {
    this.prepare();
  }

  start() {
    this.mode = 'play';
    this.elapsed = 0;
    this.engine.renderer.domElement.style.cursor = 'crosshair';
  }

  exit() {
    this.engine.renderer.domElement.style.cursor = '';
    this.mode = 'attract';
  }

  _remove(b) {
    if (b.str) b.str.removeFrom(this.scene);
    else this.scene.remove(b.obj.group);
  }

  _spawn(kind, letter = null) {
    const x = rand(-this.spawnX, this.spawnX);
    const z = rand(-2.6, 1.2);
    let group, str = null, radius, knot = 1.24;
    const color = pick(PARTY_COLORS);
    let scale = rand(0.48, 0.6);
    if (kind === 'letter') {
      const idx = this.word.indexOf(letter);
      const col = LETTER_COLORS[(idx >= 0 ? idx : 0) % LETTER_COLORS.length];
      scale = 0.62;
      group = createBalloon(col, { scale, text: letter });
      radius = 1.05 * scale;
    } else if (kind === 'clock') {
      scale = 0.55;
      group = createBalloon(0x2fc6ff, { scale, text: '+5s' });
      radius = 1.05 * scale;
    } else if (kind === 'heart') {
      scale = rand(0.45, 0.55);
      group = new THREE.Group();
      const m = new THREE.Mesh(this.heartGeo, foilMaterial(pick([0xff4f8b, 0xff7ad1, 0xf7a0a8])));
      m.castShadow = true;
      group.add(m);
      group.userData.material = m.material;
      group.scale.setScalar(scale);
      knot = 1.02;
      radius = 1.0 * scale;
    } else if (kind === 'gold') {
      scale = 0.5;
      group = new THREE.Group();
      const mat = foilMaterial(0xffc850, { roughness: 0.15, envMapIntensity: 2 });
      mat.emissive.set(0xffa21e);
      mat.emissiveIntensity = 0.35;
      const m = new THREE.Mesh(this.starGeo, mat);
      m.castShadow = true;
      group.add(m);
      group.userData.material = m.material;
      group.scale.setScalar(scale);
      knot = 0.58;
      radius = 1.05 * scale;
    } else if (kind === 'storm') {
      scale = rand(0.85, 1.0);
      group = createStormCloud(scale);
      radius = 0.95 * scale;
    } else {
      group = createBalloon(color, { scale });
      radius = 1.05 * scale;
    }
    group.position.set(x, this.spawnY, z);
    let b;
    if (kind === 'storm') {
      this.scene.add(group);
      b = { obj: { group }, str: null };
    } else {
      str = new BalloonOnString({ mesh: group, scale, length: 1.5 + rand(0, 0.6), segments: 9, knotOffset: knot, lineOpacity: 0.7 });
      str.reset();
      str.addTo(this.scene);
      b = { obj: str, str };
    }
    const progress = clamp(this.elapsed / DURATION, 0, 1);
    const speedMul = this.mode === 'play' ? 1 + progress * 0.7 : 0.6;
    const base = { normal: [1.15, 1.85], heart: [1.2, 1.8], letter: [1.15, 1.5], gold: [2.6, 3.2], clock: [1.5, 1.9], storm: [0.95, 1.35] }[kind];
    Object.assign(b, {
      kind, letter, radius,
      vy: rand(base[0], base[1]) * speedMul,
      vx: rand(-0.25, 0.25),
      phase: rand(0, Math.PI * 2),
      alive: true,
      spin: kind === 'gold' ? rand(1.5, 2.5) : 0,
      color: group.userData.material ? group.userData.material.color.getHex() : color,
      glintT: 0,
    });
    if (kind === 'letter' || kind === 'clock') b.color = new THREE.Color(kind === 'clock' ? 0x2fc6ff : LETTER_COLORS[Math.max(0, this.word.indexOf(letter)) % LETTER_COLORS.length]).getHex();
    this.balloons.push(b);
    return b;
  }

  _chooseSpawn() {
    const progress = this.elapsed / DURATION;
    if (this.letterT <= 0) {
      this.letterT = rand(2.0, 3.2);
      const need = this.word[this.nameIdx];
      const onScreenNeeded = this.balloons.some((b) => b.alive && b.kind === 'letter' && b.letter === need);
      const letter = !onScreenNeeded || Math.random() < 0.35 ? need : pick(Array.from(this.word));
      return this._spawn('letter', letter);
    }
    const r = Math.random();
    if (r < 0.045) return this._spawn('gold');
    if (r < 0.08 && !this.balloons.some((b) => b.alive && b.kind === 'clock') && this.timeLeft < 50) return this._spawn('clock');
    if (r < 0.08 + 0.06 + progress * 0.07 && this.elapsed > 4) return this._spawn('storm');
    if (r < 0.3) return this._spawn('heart');
    return this._spawn('normal');
  }

  // ---------- input ----------
  pointerDown(e) {
    if (this.mode !== 'play') return;
    const ray = this.rayFromEvent(e);
    let best = null, bestT = Infinity;
    const tmp = new THREE.Vector3();
    for (const b of this.balloons) {
      if (!b.alive) continue;
      const c = b.obj.group.position;
      const pad = 0.18;
      const r = b.radius + pad;
      if (ray.distanceSqToPoint(c) < r * r) {
        const t = tmp.subVectors(c, ray.origin).dot(ray.direction);
        if (t < bestT) { bestT = t; best = b; }
      }
    }
    if (best) this._pop(best, e.clientX, e.clientY);
  }

  _pop(b, sx, sy, silent = false) {
    b.alive = false;
    b.popT = 0;
    const g = b.obj.group;
    const pos = g.position.clone();
    const scr = sx != null ? { x: sx, y: sy } : this.toScreen(pos);
    const colorObj = new THREE.Color(b.color);
    if (b.str) b.str.detached = true;

    if (silent) {
      audio.pop(1.1);
      this.confetti.burst(pos, { count: 26, speed: 4.5, colors: [b.color, 0xffffff, 0xffd23d] });
      return;
    }

    if (b.kind === 'storm') {
      audio.thunder();
      this.engine.addShake(0.7);
      this.engine.doFlash(0.35, 0xdfe8ff, 2);
      this.confetti.burst(pos, { count: 40, speed: 4, colors: [0x8a90a8, 0x5d6378, 0xc9d0e6] });
      for (let i = 0; i < 70; i++) {
        this.glow.emit({ x: pos.x + rand(-0.7, 0.7), y: pos.y + rand(-0.3, 0.2), z: pos.z + rand(-0.3, 0.3), vy: -rand(4, 7), r: 0.6, g: 0.8, b: 1.6, size: 0.06, life: rand(0.5, 0.9), drag: 0, grav: -12 });
      }
      const lost = Math.min(this.score, 30);
      this.score -= lost;
      this.combo = 0;
      this.stormHits++;
      this.ui.setScore(this.score);
      this.ui.setCombo(0);
      this.ui.popup(scr.x, scr.y, lost > 0 ? `-${lost}` : 'Oops!', { cls: 'big bad' });
      return;
    }

    audio.pop(b.kind === 'gold' ? 1.3 : 1);
    this.popped++;
    // combo
    if (this.elapsed - this.lastPopT < 1.0) this.combo++;
    else this.combo = 1;
    this.lastPopT = this.elapsed;
    const mult = Math.min(5, 1 + Math.floor((this.combo - 1) / 4));
    this.bestCombo = Math.max(this.bestCombo, mult);
    this.ui.setCombo(mult);

    let pts = 10, label = null, cls = '', color = '#' + colorObj.getHexString();
    this.confetti.burst(pos, { count: 38, speed: 5, colors: [b.color, b.color, 0xffffff, 0xffd23d] });
    this.glow.ring(pos, { count: 26, color: colorObj, speed: 3.2, size: 0.09, intensity: 3.5, axis: 'z' });

    if (b.kind === 'heart') pts = 15;
    if (b.kind === 'gold') {
      pts = 50;
      cls = 'big';
      label = '⭐ +' + 50 * mult;
      color = '#ffd34d';
      this.stars++;
      audio.sparkle(84);
      this.glow.sparkle(pos, { count: 70, color: [new THREE.Color(1, 0.85, 0.35), new THREE.Color(1, 1, 0.9)], speed: 4.5, size: 0.14, life: 1.1 });
    }
    if (b.kind === 'clock') {
      this.timeLeft = Math.min(this.timeLeft + 5, DURATION + 15);
      label = '+5 sec ⏱';
      cls = 'big';
      color = '#7fe0ff';
      audio.chime(88, { gain: 0.14 });
      this.glow.sparkle(pos, { count: 40, color: new THREE.Color(0.5, 0.9, 1), speed: 3 });
    }
    if (b.kind === 'letter') {
      pts = 20;
      const need = this.word[this.nameIdx];
      if (b.letter === need) {
        audio.letter(this.nameIdx);
        this.nameIdx++;
        pts += 30;
        label = b.letter + '!';
        cls = 'big';
        this.glow.sparkle(pos, { count: 50, color: colorObj, speed: 3.5, size: 0.13 });
        if (this.nameIdx >= this.word.length) {
          this._wordComplete(pos);
        }
        this.ui.setLetters(this.word, this.nameIdx, LETTER_COLORS);
      }
    }
    const gained = pts * mult;
    this.score += gained;
    this.ui.setScore(this.score);
    this.ui.popup(scr.x, scr.y, label || `+${gained}`, { color, cls });
  }

  _wordComplete(pos) {
    this.wordsDone++;
    const bonus = 300 + (this.wordsDone - 1) * 100;
    this.score += bonus;
    this.nameIdx = 0;
    setTimeout(() => this.ui.announce(`${this.word}!`, { duration: 1500 }), 150);
    setTimeout(() => {
      const scr = this.toScreen(new THREE.Vector3(0, 1.2, 0));
      this.ui.popup(scr.x, scr.y, `+${bonus} BONUS!`, { cls: 'huge', color: '#ffe27a' });
    }, 500);
    audio.partyHorn();
    setTimeout(() => audio.tada(), 250);
    this.engine.doFlash(0.3, 0xfff0f8, 2.5);
    // confetti cannons from both bottom corners
    for (const side of [-1, 1]) {
      this.confetti.burst(new THREE.Vector3(side * this.spawnX * 1.1, -0.8, 0.5), { count: 160, speed: 11, dir: new THREE.Vector3(-side * 0.45, 1, 0), spread: 0.35, life: 4 });
    }
    this.glow.sparkle(pos, { count: 90, color: [new THREE.Color(1, 0.5, 0.8), new THREE.Color(1, 0.9, 0.4), new THREE.Color(0.5, 0.9, 1)], speed: 6, size: 0.15, life: 1.4 });
  }

  _endRound() {
    this.mode = 'ending';
    this.engine.renderer.domElement.style.cursor = '';
    this.ui.announce("Time's up!", { small: true, duration: 1400 });
    audio.partyHorn();
    // pop everything left in a happy cascade
    const alive = this.balloons.filter((b) => b.alive);
    alive.forEach((b, i) => setTimeout(() => { if (b.alive) this._pop(b, null, null, true); }, 150 + i * 70));
    const stars = this.score >= 2600 ? 3 : this.score >= 1400 ? 2 : this.score >= 500 ? 1 : 0;
    setTimeout(() => {
      this.game.finishGame({
        id: 'balloon',
        score: this.score,
        stars,
        title: stars >= 3 ? 'Pop Superstar! 🌟' : stars === 2 ? 'Fantastic Popping!' : stars === 1 ? 'Nice Popping!' : 'Good Try!',
        lines: [
          ['🎈 Balloons popped', this.popped],
          [`🔤 ${this.word} spelled`, this.wordsDone + (this.nameIdx > 0 ? ` (+${this.nameIdx} letters)` : '')],
          ['⭐ Gold stars', this.stars],
          ['🔥 Best combo', 'x' + this.bestCombo],
        ],
      });
    }, 400 + alive.length * 70);
  }

  // ---------- frame ----------
  update(dt, t) {
    const playing = this.mode === 'play';
    if (playing) {
      this.elapsed += dt;
      this.timeLeft -= dt;
      this.ui.setTime(this.timeLeft, DURATION);
      if (this.timeLeft <= 10 && Math.ceil(this.timeLeft) !== this.lastTick && this.timeLeft > 0) {
        this.lastTick = Math.ceil(this.timeLeft);
        audio.tick();
      }
      if (this.elapsed - this.lastPopT > 1.0 && this.combo > 0) {
        this.combo = 0;
        this.ui.setCombo(0);
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.ui.setTime(0, DURATION);
        this._endRound();
      }
    }

    // spawning
    if (playing || this.mode === 'attract') {
      const progress = clamp(this.elapsed / DURATION, 0, 1);
      const interval = playing ? THREE.MathUtils.lerp(0.55, 0.28, progress) : 1.1;
      this.spawnT -= dt;
      if (playing) this.letterT -= dt;
      const aliveCount = this.balloons.reduce((n, b) => n + (b.alive ? 1 : 0), 0);
      if (this.spawnT <= 0 && aliveCount < 30) {
        this.spawnT = interval * rand(0.7, 1.3);
        if (playing) this._chooseSpawn();
        else this._spawn(Math.random() < 0.2 ? 'heart' : 'normal');
      }
    }

    // move balloons
    const need = this.word[this.nameIdx];
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      const g = b.obj.group;
      if (b.alive) {
        g.position.y += b.vy * dt;
        g.position.x += (b.vx + Math.sin(t * 0.9 + b.phase) * 0.22) * dt;
        g.rotation.z = Math.sin(t * 1.3 + b.phase) * 0.12;
        g.rotation.x = Math.sin(t * 0.8 + b.phase) * 0.08;
        if (b.kind === 'gold') g.rotation.y += b.spin * dt;
        else if (b.kind === 'heart' || b.kind === 'storm') g.rotation.y = Math.sin(t * 0.7 + b.phase) * 0.5;
        else g.rotation.y = Math.sin(t * 0.5 + b.phase) * 0.35;
        // sparkle hint around the letter you need next
        if (playing && b.kind === 'letter' && b.letter === need) {
          b.glintT -= dt;
          if (b.glintT <= 0) {
            b.glintT = 0.12;
            const a = rand(0, Math.PI * 2);
            const r = b.radius * 1.15;
            this.glow.emit({ x: g.position.x + Math.cos(a) * r, y: g.position.y + Math.sin(a) * r * 1.2, z: g.position.z + 0.3, vy: 0.3, r: 4, g: 3.6, b: 2.4, size: rand(0.12, 0.2), life: 0.6, drag: 0.5, twinkle: 0.3 });
          }
        }
        if (b.kind === 'gold' && Math.random() < dt * 12) {
          this.glow.emit({ x: g.position.x + rand(-0.4, 0.4), y: g.position.y + rand(-0.4, 0.4), z: g.position.z + 0.2, vy: -0.5, r: 4, g: 3.2, b: 1.2, size: 0.12, life: 0.7, drag: 0.5 });
        }
        if (g.position.y > this.exitY) {
          this._remove(b);
          this.balloons.splice(i, 1);
          continue;
        }
      } else {
        // popping: quick scale-up flash then vanish; the string falls away
        b.popT += dt;
        if (b.popT < 0.05) g.scale.multiplyScalar(1 + dt * 6);
        else g.visible = false;
        if (b.str) {
          b.str.line.material.opacity = Math.max(0, 0.7 - b.popT * 0.5);
        }
        if (b.popT > 1.6) {
          this._remove(b);
          this.balloons.splice(i, 1);
          continue;
        }
      }
      if (b.str) b.str.update(dt, t);
    }

    for (const b of this.decorBalloons) b.update(dt, t);
    for (const u of this.updaters) u(t);
    this.confetti.update(dt);
    this.glow.update(dt);
  }
}
