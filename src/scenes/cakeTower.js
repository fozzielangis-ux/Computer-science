import * as THREE from 'three';
import { BaseScene } from '../core/scene.js';
import { audio } from '../core/audio.js';
import { rand, pick, clamp, damp, fitFov, skyMaterial, canvasTexture, smoothstep, PARTY_COLORS } from '../core/util.js';
import { createCakeLayer, FLAVORS } from '../models/cake.js';
import { BalloonOnString } from '../models/stringBalloon.js';
import { createTable, createCakeStand, createStringLights, createBokeh, createGiftBox } from '../models/decor.js';
import { cloudGeometry } from '../models/balloon.js';
import { Mascot } from '../models/mascot.js';
import { Confetti } from '../fx/confetti.js';
import { GlowParticles } from '../fx/particles.js';

const R = 1.0;
const SPONGE_H = 0.34;
const STEP = SPONGE_H + 0.06;
const PLATE_R = 1.3;
const PERFECT = 0.12;
const MAX_LIVES = 3;
const DROP_GAP = 1.45;

export class CakeTowerScene extends BaseScene {
  constructor(game) {
    super(game);
    this.viewOpts = { bloom: { strength: 0.55, radius: 0.4, threshold: 2.6 }, exposure: 1.0, vignette: 0.3, saturation: 1.1 };
    this.camTarget = new THREE.Vector3();
    this.camPos = new THREE.Vector3(6, 4, 6);
    this.yaw = Math.PI / 4;
  }

  get info() {
    return {
      emoji: '🎂',
      title: 'Cake Tower',
      desc: 'The party balloons are delivering cake! Drop each layer to build the <b>tallest birthday cake ever</b>.',
      howto: [
        ['👆', '<b>Tap</b>, <b>click</b> or press <b>Space</b> to drop the layer'],
        ['🎯', 'Line it up exactly for a <b>PERFECT</b> bonus'],
        ['⚖️', 'Keep it balanced — lean too far and the tower <b>topples!</b>'],
        ['🍒', 'Miss the cake 3 times and the round is over'],
      ],
    };
  }

  async build() {
    const s = this.scene;
    // golden-hour garden party
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(180, 48, 24), skyMaterial([
      [-1, 0xf3c9a8], [0.0, 0xffd2a6], [0.08, 0xffb7a8], [0.3, 0xb9a6ff], [0.65, 0x7aa6ff], [1, 0x5b86f0],
    ]));
    this.sky.renderOrder = -1;
    s.add(this.sky);
    s.fog = new THREE.Fog(0xffc8b0, 25, 120);

    s.add(new THREE.HemisphereLight(0xcfe0ff, 0x9bc97a, 1.0));
    const sun = new THREE.DirectionalLight(0xffe2bf, 2.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 40 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 4;
    s.add(sun, sun.target);
    this.sun = sun;
    const rim = new THREE.DirectionalLight(0xff9ad1, 0.9);
    rim.position.set(-6, 5, -8);
    s.add(rim);

    // lawn
    const grassTex = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = '#7fbf5a';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const l = rand(32, 52);
        g.fillStyle = `hsla(${rand(88, 110)}, 50%, ${l}%, 0.5)`;
        g.fillRect(rand(0, w), rand(0, h), 1.5, rand(2, 6));
      }
    }, { repeat: [24, 24] });
    const lawn = new THREE.Mesh(new THREE.CircleGeometry(120, 64), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.receiveShadow = true;
    s.add(lawn);

    // trees & hedges in the distance
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x4f9a5a, roughness: 0.9 });
    const treeMat2 = new THREE.MeshStandardMaterial({ color: 0x6bb36a, roughness: 0.9 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.9 });
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(22, 40);
      const tree = new THREE.Group();
      const h = rand(3, 6);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, h * 0.4, 8), trunkMat);
      trunk.position.y = h * 0.2;
      tree.add(trunk);
      for (let k = 0; k < 3; k++) {
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.2, 2) * (h / 4.5), 1), Math.random() < 0.5 ? treeMat : treeMat2);
        blob.position.set(rand(-0.6, 0.6), h * 0.45 + k * 0.7, rand(-0.6, 0.6));
        blob.castShadow = false;
        tree.add(blob);
      }
      tree.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      s.add(tree);
    }

    // party table & cake stand
    this.table = createTable({ radius: 2.1, height: 1.0, cloth: 0xffffff, trim: 0xff7ac0 });
    s.add(this.table);
    this.baseY = this.table.userData.topY;
    const stand = createCakeStand({ radius: 1.45, height: 0.32 });
    stand.position.y = this.baseY;
    s.add(stand);
    this.baseY += stand.userData.topY;

    this.tower = new THREE.Group();
    this.tower.position.y = this.baseY;
    s.add(this.tower);

    // garden decorations: poles with string lights, gifts on the lawn
    this.updaters = [];
    const poles = [[-7, 4.5], [-2.5, -7.8], [6.2, -5]];
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    for (const [x, z] of poles) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 10), poleMat);
      pole.position.set(x, 2.1, z);
      pole.castShadow = true;
      s.add(pole);
    }
    for (let i = 0; i < 2; i++) {
      const [x1, z1] = poles[i], [x2, z2] = poles[i + 1];
      const l = createStringLights(new THREE.Vector3(x1, 4.1, z1), new THREE.Vector3(x2, 4.1, z2), { sag: 0.9, count: 16, bulbSize: 0.07, intensity: 5 });
      s.add(l);
      this.updaters.push(l.userData.update);
    }
    for (const [x, z, w] of [[-2.8, 1.8, 0.7], [-3.4, 0.9, 0.5], [2.9, -2.2, 0.8], [-2.6, -2.8, 0.6]]) {
      const g = createGiftBox({ w, h: w * 0.8, d: w, color: pick(PARTY_COLORS) });
      g.position.set(x, 0, z);
      g.rotation.y = rand(0, 3);
      s.add(g);
    }
    // balloon bunches tied to the table legs
    this.decor = [];
    for (const [x, z] of [[-1.6, 1.4], [1.5, -1.5]]) {
      for (let i = 0; i < 3; i++) {
        const b = new BalloonOnString({ color: PARTY_COLORS[(i * 3 + (x > 0 ? 2 : 5)) % 8], scale: 0.38, length: 2.4 + i * 0.3, anchor: new THREE.Vector3(x * 1.3, 1.02, z * 1.3) });
        b.wind.set(x > 0 ? 0.5 : -0.5, 0, z > 0 ? 0.6 : -0.6);
        b.addTo(s);
        this.decor.push(b);
      }
    }

    // fluffy clouds you reach as the tower grows
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffe6f0, emissiveIntensity: 0.25 });
    this.clouds = [];
    for (let i = 0; i < 18; i++) {
      const c = new THREE.Mesh(cloudGeometry(), cloudMat);
      const a = rand(0, Math.PI * 2), d = rand(7, 16);
      c.position.set(Math.cos(a) * d, rand(7, 22), Math.sin(a) * d);
      c.scale.set(rand(1.6, 3), rand(1, 1.6), rand(1.4, 2.2));
      c.userData.speed = rand(0.05, 0.15);
      s.add(c);
      this.clouds.push(c);
    }
    const bokeh = createBokeh({ count: 30, center: new THREE.Vector3(-14, 6, -14), spread: new THREE.Vector3(14, 6, 6), sizeMin: 1, sizeMax: 2.6, opacity: 0.22, colors: [0xffe2a8, 0xffb0d0, 0xffffff] });
    s.add(bokeh);
    this.updaters.push(bokeh.userData.update);

    // mascot cheering from the table
    this.mascot = new Mascot();
    this.mascot.group.scale.setScalar(0.8);
    this.mascot.group.position.set(1.35, this.table.userData.topY, 1.0);
    s.add(this.mascot.group);

    this.confetti = new Confetti(s, { max: 1400, floorY: 0.01 });
    this.glow = new GlowParticles(s, { max: 2500 });

    // landing guide ring (where the layer will land)
    this.guide = new THREE.Mesh(
      new THREE.RingGeometry(R * 0.93, R * 1.0, 72),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    );
    this.guide.rotation.x = -Math.PI / 2;
    this.guide.renderOrder = 5;
    this.guide.visible = false;
    s.add(this.guide);
    this.guideDot = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), this.guide.material);
    this.guideDot.rotation.x = -Math.PI / 2;
    this.guideDot.renderOrder = 5;
    s.add(this.guideDot);

    // reusable bow for the carried layer
    const bowMat = new THREE.MeshPhysicalMaterial({ color: 0xff3d8b, roughness: 0.3, clearcoat: 1, sheen: 1, sheenColor: 0xffffff });
    this.bowMat = bowMat;
  }

  resize(w, h) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.fov = fitFov(42, aspect, 46);
    this.camera.updateProjectionMatrix();
    this.glow?.resize();
  }

  // ---------- state ----------
  prepare() {
    // clear old tower & debris
    this.tower.clear();
    for (const d of this.debris || []) {
      this.scene.remove(d.obj);
      (d.pieces || []).forEach((p) => this.scene.remove(p.g));
    }
    for (const b of this.flying || []) b.removeFrom(this.scene);
    if (this.current) {
      this.scene.remove(this.current.group);
      (this.current.balloons || []).forEach((b) => b.removeFrom(this.scene));
    }
    this.layers = [];
    this.debris = [];
    this.flying = [];
    this.maxHeight = 0;
    this.timers = [];
    this.current = null;
    this.mode = 'attract';
    this.score = 0;
    this.lives = MAX_LIVES;
    this.perfects = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.misses = 0;
    this.sway = 0;
    this.swayV = 0;
    this.leanDir = new THREE.Vector2();
    this.instability = 0;
    this.flavorIdx = Math.floor(rand(0, FLAVORS.length));
    this.timeScale = 1;
    this.slowT = 0;
    this.overT = 0;
    this.confetti.clear();
    this.glow.clear();
    this.mascot.setState('idle');
    this._newCarrier(true);
  }

  _after(sec, fn) {
    this.timers.push({ t: sec, fn });
  }

  showHud() {
    this.ui.hud(true, { lives: true, alt: 'Layers', hint: 'Tap to drop the cake layer! 🎂' });
    this.ui.setLives(this.lives, MAX_LIVES, '🍒');
    this.ui.setAlt(0);
  }

  enter() {
    this.prepare();
  }

  start() {
    this.mode = 'play';
  }

  exit() {
    this.mode = 'attract';
  }

  get topY() {
    return this.layers.length * STEP;
  }

  _supportAt(k) {
    // returns {x, z, r} for support level k (-1 = the cake stand)
    if (k < 0) return { x: 0, z: 0, r: PLATE_R };
    const l = this.layers[k];
    return { x: l.x, z: l.z, r: R };
  }

  _newCarrier(initial = false) {
    const flavor = FLAVORS[this.flavorIdx++ % FLAVORS.length];
    const group = createCakeLayer({ radius: R, height: SPONGE_H, flavor, sprinkles: 70, dripMax: 0.22 });
    // little bow where the strings are tied
    const bow = new THREE.Group();
    const loop = new THREE.TorusGeometry(0.09, 0.03, 8, 20);
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(loop, this.bowMat);
      m.position.set(sx * 0.08, 0.06, 0);
      m.rotation.set(0, 0, sx * 0.7);
      m.scale.set(1, 0.7, 0.6);
      bow.add(m);
    }
    bow.position.y = group.userData.topY;
    group.add(bow);
    this.scene.add(group);
    const n = this.layers.length;
    const axisIsX = n % 2 === 0;
    const amp = 1.75;
    const speed = Math.min(3.3, 1.45 + n * 0.075);
    const cur = {
      group, flavor, bow,
      axis: axisIsX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1),
      amp, speed,
      phase: -Math.PI / 2 + (Math.random() < 0.5 ? Math.PI : 0),
      state: 'enter',
      enterT: 0,
      x: 0, z: 0, y: 0, vy: 0,
      landT: 0,
    };
    // centre of the swing follows the top of the tower so it stays fair
    const top = this.layers[n - 1];
    cur.cx = top ? top.x * 0.6 : 0;
    cur.cz = top ? top.z * 0.6 : 0;
    this.current = cur;
    // three balloons carrying it
    const colors = [pick(PARTY_COLORS), pick(PARTY_COLORS), pick(PARTY_COLORS)];
    cur.balloons = [
      new BalloonOnString({ color: colors[0], scale: 0.4, length: 1.2, segments: 8 }),
      new BalloonOnString({ color: colors[1], scale: 0.42, length: 1.2, segments: 8 }),
      new BalloonOnString({ color: colors[2], scale: 0.38, length: 1.2, segments: 8 }),
    ];
    cur.offsets = [new THREE.Vector3(-0.5, 2.05, 0.15), new THREE.Vector3(0.48, 2.15, -0.1), new THREE.Vector3(0.02, 2.55, -0.35)];
    cur.balloons.forEach((b) => b.addTo(this.scene));
    this._placeCarrier(0, initial ? 1 : 0);
    cur.balloons.forEach((b) => b.reset());
  }

  _placeCarrier(t, enter) {
    const cur = this.current;
    const off = Math.sin(cur.phase) * cur.amp;
    cur.x = cur.cx + cur.axis.x * off;
    cur.z = cur.cz + cur.axis.z * off;
    const e = 1 - Math.pow(1 - clamp(enter, 0, 1), 3);
    cur.y = this.baseY + this.topY + DROP_GAP + (1 - e) * 5 + Math.sin(t * 2.2) * 0.05;
    cur.group.position.set(cur.x, cur.y, cur.z);
    cur.group.rotation.z = Math.cos(cur.phase) * cur.axis.x * 0.06;
    cur.group.rotation.x = -Math.cos(cur.phase) * cur.axis.z * 0.06;
    const attach = new THREE.Vector3(cur.x, cur.y + cur.group.userData.topY + 0.08, cur.z);
    const k = new THREE.Vector3();
    cur.balloons.forEach((b, i) => {
      const o = cur.offsets[i];
      b.group.position.set(cur.x + o.x + Math.sin(t * 1.3 + i) * 0.05, cur.y + o.y + Math.sin(t * 1.7 + i * 2) * 0.06, cur.z + o.z);
      b.group.rotation.z = -o.x * 0.35 + Math.sin(t + i) * 0.05;
      b.group.rotation.x = o.z * 0.3;
      // taut straight strings down to the bow
      b.knotWorld(k);
      for (let j = 0; j < b.n; j++) {
        const s = j / (b.n - 1);
        b.pts[j].lerpVectors(k, attach, s);
        b.prev[j].copy(b.pts[j]);
      }
      b._writeLine();
    });
  }

  // ---------- input ----------
  pointerDown() {
    this.drop();
  }

  keyDown(code) {
    if (code === 'Space' || code === 'Enter' || code === 'ArrowDown') this.drop();
  }

  drop() {
    if (this.mode !== 'play') return;
    const cur = this.current;
    if (!cur || cur.state !== 'carry') return;
    cur.state = 'drop';
    cur.vy = 0;
    audio.whoosh(0.3, 0.15);
    // release balloons: they float off into the sky
    cur.balloons.forEach((b, i) => {
      b.detachedFly = { vy: 2.2 + i * 0.4, vx: rand(-0.6, 0.6), vz: rand(-0.6, 0.6) };
      this.flying.push(b);
    });
    cur.balloons = [];
    cur.group.remove(cur.bow);
  }

  _land() {
    const cur = this.current;
    const n = this.layers.length;
    const sup = this._supportAt(n - 1);
    let dx = cur.x - sup.x, dz = cur.z - sup.z;
    let d = Math.hypot(dx, dz);
    const worldPos = new THREE.Vector3(cur.x, this.baseY + this.topY, cur.z);

    if (d > sup.r * 0.97) {
      // missed! the layer tips over the edge and falls
      this._tipOff(cur, sup, dx, dz, d);
      this.current = null;
      this.lives--;
      this.misses++;
      this.streak = 0;
      this.ui.setLives(this.lives, MAX_LIVES, '🍒');
      audio.fail();
      const scr = this.toScreen(worldPos);
      this.ui.popup(scr.x, scr.y - 40, 'Whoops!', { cls: 'big bad' });
      this.mascot.setState('worried');
      this._after(1.2, () => this.mode === 'play' && this.mascot.setState('idle'));
      if (this.lives <= 0) {
        this._after(0.9, () => this._gameOver(false));
      } else {
        this._after(0.65, () => this.mode === 'play' && this._newCarrier());
      }
      return;
    }

    let perfect = false;
    if (d < PERFECT) {
      perfect = true;
      cur.x = sup.x;
      cur.z = sup.z;
      dx = dz = d = 0;
    }
    // add to tower (tower-local coords)
    this.scene.remove(cur.group);
    cur.group.position.set(cur.x, this.topY, cur.z);
    cur.group.rotation.set(0, cur.group.rotation.y, 0);
    this.tower.add(cur.group);
    const layer = { group: cur.group, x: cur.x, z: cur.z, landT: 0, flavor: cur.flavor };
    this.layers.push(layer);
    this.current = null;

    const h = this.layers.length;
    this.maxHeight = Math.max(this.maxHeight, h);
    this.ui.setAlt(h);
    let pts = 10;
    const scr = this.toScreen(worldPos);
    audio.plop(1 + Math.min(h, 30) * 0.02);
    if (perfect) {
      this.perfects++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      pts += 25 + (this.streak - 1) * 10;
      audio.perfect(this.streak);
      this.ui.popup(scr.x, scr.y - 30, this.streak > 1 ? `PERFECT x${this.streak}!` : 'PERFECT!', { cls: 'big', color: '#ffe27a' });
      this.glow.ring(worldPos, { count: 48, color: new THREE.Color(1, 0.85, 0.4), speed: 3.5, size: 0.12, intensity: 4 });
      this.glow.sparkle(worldPos.clone().add(new THREE.Vector3(0, 0.3, 0)), { count: 40, color: [new THREE.Color(1, 0.9, 0.5), new THREE.Color(1, 0.6, 0.85)], speed: 3, size: 0.12 });
      this.mascot.setState('cheer');
      this._after(0.9, () => this.mode === 'play' && this.mascot.setState('idle'));
    } else {
      this.streak = 0;
      const label = d < 0.35 ? 'Great!' : d < 0.6 ? 'Good' : 'Wobbly!';
      this.ui.popup(scr.x, scr.y - 30, `${label} +${pts}`, { color: '#ffffff' });
    }
    // crumbs puff
    this.confetti.burst(worldPos, { count: 14, speed: 2.5, colors: [cur.flavor.sponge, cur.flavor.frosting, 0xffffff], up: 1, life: 1.5 });
    // tower reaction
    this.swayV += d * 0.6 + 0.08;
    this.score += pts;

    if (h % 5 === 0) {
      const bonus = 50;
      this.score += bonus;
      this._after(0.2, () => {
        this.ui.announce(`${h} layers!`, { small: true, duration: 1300 });
        audio.partyHorn();
      });
      const top = new THREE.Vector3(0, this.baseY + this.topY + 1, 0);
      for (const side of [-1, 1]) {
        this.confetti.burst(top.clone().add(new THREE.Vector3(side * 2.5, -1, 0)), { count: 90, speed: 8, dir: new THREE.Vector3(-side * 0.5, 1, 0), spread: 0.4 });
      }
    }
    this.ui.setScore(this.score);

    // stability check: does any level have its load hanging past the edge?
    let failK = null;
    let worst = 0;
    for (let k = h - 2; k >= -1; k--) {
      let cx = 0, cz = 0;
      for (let j = k + 1; j < h; j++) { cx += this.layers[j].x; cz += this.layers[j].z; }
      const cnt = h - (k + 1);
      cx /= cnt; cz /= cnt;
      const sp = this._supportAt(k);
      const dist = Math.hypot(cx - sp.x, cz - sp.z);
      const ratio = dist / sp.r;
      if (ratio > worst) {
        worst = ratio;
        this.leanDir.set(cx - sp.x, cz - sp.z).normalize();
      }
      if (ratio > 1.0) failK = k;
    }
    this.instability = worst;
    if (failK !== null) {
      this._after(0.38, () => this._collapse(failK));
      this.mode = 'collapsing';
      return;
    }
    if (worst > 0.8) {
      this.mascot.setState('worried');
      this.ui.popup(scr.x, scr.y + 30, 'Careful! 😬', { color: '#ffd0d8' });
    } else if (this.mascot.state === 'worried') this.mascot.setState('idle');
    this._after(0.38, () => this.mode === 'play' && this._newCarrier());
  }

  _tipOff(cur, sup, dx, dz, d) {
    const dir = new THREE.Vector3(dx / d, 0, dz / d);
    const y = this.baseY + this.topY;
    const pivotPos = new THREE.Vector3(sup.x, y, sup.z).addScaledVector(dir, sup.r);
    this._makeDebris([cur.group], pivotPos, dir, 1.0, false);
  }

  // Turn a set of layer groups into a tumbling chunk pivoting over an edge.
  _makeDebris(groups, pivotPos, dir, delay, breakApart) {
    const pivot = new THREE.Group();
    pivot.position.copy(pivotPos);
    this.scene.add(pivot);
    for (const g of groups) {
      const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
      g.getWorldPosition(wp);
      g.getWorldQuaternion(wq);
      g.parent?.remove(g);
      pivot.add(g);
      g.position.copy(wp.sub(pivotPos));
      g.quaternion.copy(wq);
    }
    const axis = new THREE.Vector3(0, 1, 0).cross(dir).normalize().negate();
    this.debris.push({ obj: pivot, axis, angle: 0, w: 0.6, state: 'tip', breakApart, dir, groups, t: 0 });
  }

  _collapse(k) {
    const h = this.layers.length;
    const sp = this._supportAt(k);
    let cx = 0, cz = 0;
    for (let j = k + 1; j < h; j++) { cx += this.layers[j].x; cz += this.layers[j].z; }
    cx /= h - (k + 1); cz /= h - (k + 1);
    const dir = new THREE.Vector3(cx - sp.x, 0, cz - sp.z).normalize();
    const y = this.baseY + (k + 1) * STEP;
    const pivotPos = new THREE.Vector3(sp.x, y, sp.z).addScaledVector(dir, sp.r);
    const fallen = this.layers.splice(k + 1);
    this.tower.rotation.set(0, 0, 0);
    this._makeDebris(fallen.map((l) => l.group), pivotPos, dir, 0, true);
    audio.thud();
    this._after(0.3, () => audio.fail());
    this.engine.addShake(0.5);
    this.slowT = 1.1;
    this.mascot.setState('worried');
    this.ui.announce('TIMBER!', { small: true, duration: 1400 });
    this._after(1.8, () => this._gameOver(true));
  }

  _gameOver(collapsed) {
    if (this.mode === 'over') return;
    this.mode = 'over';
    this.overT = 0;
    this.mascot.setState(this.maxHeight >= 10 ? 'cheer' : 'idle');
    const best = this.maxHeight;
    const stars = best >= 20 ? 3 : best >= 12 ? 2 : best >= 5 ? 1 : 0;
    this.game.finishGame({
      id: 'cake',
      score: this.score,
      stars,
      title: collapsed ? (best >= 12 ? 'What a Tower!' : 'Timber! 🎂') : stars >= 2 ? 'Master Baker! 👩‍🍳' : 'Yummy Tower!',
      lines: [
        ['🎂 Tallest tower', `${best} layers`],
        ['🎯 Perfect drops', this.perfects],
        ['🔥 Best perfect streak', this.bestStreak],
        ['🍒 Missed layers', this.misses],
      ],
    });
  }

  // ---------- frame ----------
  update(dt, t) {
    if (this.slowT > 0) {
      this.slowT -= dt;
      this.timeScale = damp(this.timeScale, 0.35, 10, dt);
    } else this.timeScale = damp(this.timeScale, 1, 6, dt);
    const pdt = dt * this.timeScale;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) {
        this.timers.splice(i, 1);
        tm.fn();
      }
    }

    const cur = this.current;
    if (cur) {
      if (cur.state === 'enter' || cur.state === 'carry') {
        cur.phase += cur.speed * pdt * (this.mode === 'attract' ? 0.6 : 1);
        if (cur.state === 'enter') {
          cur.enterT += pdt / 0.55;
          if (cur.enterT >= 1) cur.state = 'carry';
        }
        this._placeCarrier(t, cur.enterT);
      } else if (cur.state === 'drop') {
        cur.vy -= 24 * pdt;
        cur.y += cur.vy * pdt;
        cur.group.position.y = cur.y;
        cur.group.rotation.x *= 0.9;
        cur.group.rotation.z *= 0.9;
        if (cur.y <= this.baseY + this.topY) {
          cur.y = this.baseY + this.topY;
          this._land();
        }
      }
    }
    // landing guide
    const showGuide = this.mode === 'play' && cur && (cur.state === 'carry' || cur.state === 'enter' || cur.state === 'drop');
    this.guide.visible = this.guideDot.visible = !!showGuide;
    if (showGuide) {
      const sup = this._supportAt(this.layers.length - 1);
      const d = Math.hypot(cur.x - sup.x, cur.z - sup.z);
      const gy = this.baseY + this.topY + 0.075;
      this.guide.position.set(cur.x, gy, cur.z);
      this.guideDot.position.set(cur.x, gy + 0.001, cur.z);
      const col = d < PERFECT ? 0xffd34d : d > sup.r * 0.97 ? 0xff5c7a : 0xffffff;
      this.guide.material.color.set(col);
      this.guide.material.opacity = d < PERFECT ? 0.95 : 0.55 + Math.sin(t * 6) * 0.1;
    }

    // landing squash for recent layers
    for (const l of this.layers) {
      if (l.landT < 1) {
        l.landT += dt;
        const k = l.landT;
        const sy = 1 - 0.22 * Math.exp(-k * 9) * Math.cos(k * 28);
        const sxz = 1 / Math.sqrt(sy);
        l.group.scale.set(sxz, sy, sxz);
      }
    }

    // tower sway spring (+ lean when unstable)
    const lean = smoothstep(0.55, 1.0, this.instability) * 0.035;
    this.swayV += (-this.sway * 40 - this.swayV * 4) * dt;
    this.sway += this.swayV * dt;
    const wob = this.sway * 0.05 + lean * (1 + Math.sin(t * 7) * 0.25 * smoothstep(0.75, 1, this.instability));
    this.tower.rotation.x = this.leanDir.y * wob;
    this.tower.rotation.z = -this.leanDir.x * wob;

    // debris physics
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.t += pdt;
      if (d.state === 'tip') {
        d.w += 7 * pdt;
        d.angle += d.w * pdt;
        d.obj.quaternion.setFromAxisAngle(d.axis, d.angle);
        if (d.angle > (d.breakApart ? 0.55 : 0.9)) {
          // switch every piece to free fall
          d.state = 'fall';
          d.pieces = d.groups.map((g, idx) => {
            const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
            g.getWorldPosition(wp);
            g.getWorldQuaternion(wq);
            d.obj.remove(g);
            this.scene.add(g);
            g.position.copy(wp);
            g.quaternion.copy(wq);
            const spread = d.breakApart ? idx * 0.35 : 0;
            return {
              g,
              v: d.dir.clone().multiplyScalar(1.6 + spread + rand(0, 0.6)).add(new THREE.Vector3(rand(-0.5, 0.5), rand(-0.5, 1), rand(-0.5, 0.5))),
              axis: d.axis.clone().add(new THREE.Vector3(rand(-0.3, 0.3), 0, rand(-0.3, 0.3))).normalize(),
              w: d.w * (0.8 + rand(0, 0.6)),
              landed: false,
            };
          });
          this.scene.remove(d.obj);
        }
      } else {
        let alive = false;
        for (const p of d.pieces) {
          if (p.landed) {
            p.fade = (p.fade || 0) + pdt;
            if (p.fade > 2.5) { p.g.visible = false; continue; }
            alive = true;
            continue;
          }
          alive = true;
          p.v.y -= 20 * pdt;
          p.g.position.addScaledVector(p.v, pdt);
          p.g.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(p.axis, p.w * pdt));
          const r = Math.hypot(p.g.position.x, p.g.position.z);
          const floorY = r < 2.1 ? this.table.userData.topY + 0.2 : 0.3;
          if (p.g.position.y < floorY && p.v.y < 0) {
            if (Math.abs(p.v.y) > 4) {
              audio.plop(0.6);
              this.confetti.burst(p.g.position, { count: 20, speed: 3, colors: [0xffffff, 0xffd3e2, 0xf3dca6], up: 1.5, life: 2 });
              p.v.y *= -0.25;
              p.v.x *= 0.5;
              p.v.z *= 0.5;
              p.w *= 0.5;
            } else {
              p.landed = true;
              p.g.position.y = floorY;
            }
          }
        }
        if (!alive) {
          d.pieces.forEach((p) => this.scene.remove(p.g));
          this.debris.splice(i, 1);
        }
      }
    }

    // released balloons drift up and away
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const b = this.flying[i];
      const f = b.detachedFly;
      f.vy += 0.8 * dt;
      b.group.position.x += f.vx * dt;
      b.group.position.y += f.vy * dt;
      b.group.position.z += f.vz * dt;
      b.group.rotation.z = Math.sin(t * 2 + i) * 0.15;
      b.update(dt, t);
      if (b.group.position.y > this.baseY + this.topY + 18) {
        b.removeFrom(this.scene);
        this.flying.splice(i, 1);
      }
    }

    // camera follows the top of the tower
    const h = this.layers.length;
    const over = this.mode === 'over' || this.mode === 'collapsing';
    if (this.mode === 'over') this.overT += dt;
    const towerH = h * STEP;
    let dist, lookY;
    if (this.mode === 'over' && this.overT > 0.5) {
      dist = Math.max(8.5, towerH * 1.3 + 4);
      lookY = this.baseY + towerH * 0.5;
    } else {
      dist = 9.0;
      lookY = this.baseY + towerH + 1.5;
    }
    if (this.mode === 'attract') this.yaw += dt * 0.08;
    else this.yaw = damp(this.yaw, Math.PI / 4, 1.5, dt);
    const camY = lookY + (over ? 1.5 : 1.6);
    this.camTarget.set(0, damp(this.camTarget.y, lookY, 3, dt), 0);
    const cp = new THREE.Vector3(Math.sin(this.yaw) * dist, camY, Math.cos(this.yaw) * dist);
    this.camPos.x = damp(this.camPos.x, cp.x, 3, dt);
    this.camPos.y = damp(this.camPos.y, cp.y, 3, dt);
    this.camPos.z = damp(this.camPos.z, cp.z, 3, dt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    // sun follows so shadows stay crisp around the top of the tower
    const top = this.baseY + towerH;
    this.sun.position.set(5, top + 8, 4);
    this.sun.target.position.set(0, top - 1.5, 0);

    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 18) c.position.x = -18;
    }
    for (const b of this.decor) b.update(dt, t);
    for (const u of this.updaters) u(t);
    this.mascot.update(dt);
    this.confetti.update(dt);
    this.glow.update(dt);
  }
}
