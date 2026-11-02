import * as THREE from 'three';
import { BaseScene } from '../core/scene.js';
import { audio } from '../core/audio.js';
import { rand, pick, clamp, damp, fitFov, skyMaterial, canvasTexture, softDotTexture, PARTY_COLORS, FOIL_COLORS } from '../core/util.js';
import { createBalloon, foilMaterial, starGeometry, cloudGeometry } from '../models/balloon.js';
import { createGiftBox, createLollipop, createCandyCane, createBunting } from '../models/decor.js';
import { createCakeLayer, FLAVORS } from '../models/cake.js';
import { Mascot } from '../models/mascot.js';
import { Confetti } from '../fx/confetti.js';
import { GlowParticles } from '../fx/particles.js';

const LANES = [-1.7, 0, 1.7];
const TILE_LEN = 6;
const TILE_COUNT = 18;
const SPAWN_Z = -92;
const MAX_LIVES = 3;
const JUMP_V = 9.6;
const GRAVITY = 27;

export class PresentDashScene extends BaseScene {
  constructor(game) {
    super(game);
    this.viewOpts = { bloom: { strength: 0.7, radius: 0.5, threshold: 2.2 }, exposure: 1.0, vignette: 0.34, saturation: 1.1 };
    this.swipe = null;
  }

  get info() {
    return {
      emoji: '🎁',
      title: 'Present Dash',
      desc: 'Run with <b>Sprinkle</b> across Candy Cloud Land! Grab stars and presents and dodge the party obstacles.',
      howto: [
        ['↔️', '<b>Swipe</b> left / right or use the <b>arrow keys</b> to change lanes'],
        ['⬆️', '<b>Swipe up</b>, <b>tap</b> or press <b>Space</b> to jump over presents'],
        ['⬇️', '<b>Swipe down</b> or press <b>↓</b> to slide under banners'],
        ['🎈', 'Grab the <b>balloons</b> to float over everything!'],
        ['❤️', 'You have 3 hearts — how far can you run?'],
      ],
    };
  }

  async build() {
    const s = this.scene;
    // ---- sky: dreamy sunset over a sea of clouds ----
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), skyMaterial([
      [-1, 0xffc6dc], [-0.08, 0xffaec2], [0.02, 0xffc48a], [0.12, 0xff86b8], [0.35, 0x9a72ff], [0.7, 0x5560ee], [1, 0x343fc0],
    ]));
    this.sky.renderOrder = -1;
    s.add(this.sky);
    s.fog = new THREE.Fog(0xffb6c2, 55, 165);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: new THREE.Color(1.0, 0.75, 0.55).multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    sun.position.set(0, 9, -170);
    sun.scale.setScalar(90);
    s.add(sun);
    const sunCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: new THREE.Color(1.0, 0.95, 0.8).multiplyScalar(4), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    sunCore.position.set(0, 9, -169);
    sunCore.scale.setScalar(26);
    s.add(sunCore);

    s.add(new THREE.HemisphereLight(0xffeaf5, 0x8f6cff, 0.85));
    const light = new THREE.DirectionalLight(0xffe2c4, 2.9);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, { left: -6, right: 6, top: 8, bottom: -10, near: 1, far: 40 });
    light.shadow.bias = -0.0006;
    light.shadow.normalBias = 0.03;
    light.shadow.radius = 3;
    s.add(light, light.target);
    this.light = light;

    // ---- the track: a giant cake runway ----
    const topTex = canvasTexture(512, 512, (g, w, h) => {
      const cols = ['#ffb0d4', '#ffe7c2', '#cdb8ff'];
      for (let i = 0; i < 3; i++) {
        g.fillStyle = cols[i];
        g.fillRect((i / 3) * w, 0, w / 3, h);
      }
      g.fillStyle = 'rgba(255,255,255,0.95)';
      for (const x of [w / 3, (2 * w) / 3]) for (let y = 0; y < h; y += 64) g.fillRect(x - 4, y + 8, 8, 40);
      for (let i = 0; i < 160; i++) {
        g.fillStyle = pick(['#ff4fa3', '#ffc23d', '#3fd2ff', '#9a55ff', '#3fe0a2']);
        g.save();
        g.translate(rand(0, w), rand(0, h));
        g.rotate(rand(0, Math.PI));
        g.fillRect(-7, -2, 14, 4);
        g.restore();
      }
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 10, h);
      g.fillRect(w - 10, 0, 10, h);
    });
    const sideTex = canvasTexture(256, 128, (g, w, h) => {
      g.fillStyle = '#ff8cc4';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      for (let i = 0; i < 40; i++) g.fillRect(rand(0, w), rand(h * 0.45, h), 3, 3);
      g.fillStyle = '#fff6fb';
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(w, 0);
      for (let x = w; x >= 0; x -= 8) {
        const d = h * (0.22 + 0.18 * Math.max(0, Math.sin(x * 0.11) * Math.sin(x * 0.037 + 1)));
        g.lineTo(x, d);
      }
      g.closePath();
      g.fill();
    }, { repeat: [3, 1] });
    const topMat = new THREE.MeshPhysicalMaterial({ map: topTex, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: 0xffffff });
    const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.6 });
    const bottomMat = new THREE.MeshStandardMaterial({ color: 0xf2b37a, roughness: 0.8 });
    const slabGeo = new THREE.BoxGeometry(6, 0.9, TILE_LEN);
    slabGeo.translate(0, -0.45, 0);
    const railTex = canvasTexture(64, 256, (g, w, h) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ff3d6e';
      g.save();
      g.translate(w / 2, h / 2);
      g.rotate(-0.8);
      for (let i = -20; i < 20; i++) g.fillRect(-w * 4, i * 22, w * 8, 10);
      g.restore();
    }, { repeat: [1, 3] });
    const railMat = new THREE.MeshPhysicalMaterial({ map: railTex, roughness: 0.2, clearcoat: 1 });
    const railGeo = new THREE.CylinderGeometry(0.11, 0.11, TILE_LEN, 12);
    railGeo.rotateX(Math.PI / 2);
    this.tiles = [];
    for (let i = 0; i < TILE_COUNT; i++) {
      const tile = new THREE.Group();
      const slab = new THREE.Mesh(slabGeo, [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat]);
      slab.receiveShadow = true;
      tile.add(slab);
      for (const sx of [-1, 1]) {
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(sx * 2.95, 0.14, 0);
        rail.castShadow = true;
        tile.add(rail);
      }
      tile.position.z = -i * TILE_LEN + TILE_LEN;
      s.add(tile);
      this.tiles.push(tile);
    }

    // ---- sea of clouds below ----
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffc8de, emissiveIntensity: 0.35 });
    this.clouds = [];
    for (let i = 0; i < 46; i++) {
      const c = new THREE.Mesh(cloudGeometry(), cloudMat);
      this._placeCloud(c, rand(-130, 20));
      s.add(c);
      this.clouds.push(c);
    }

    // ---- side decorations (recycled) ----
    this.decor = [];
    const lollyColors = [[0xff4fa3, 0xffffff], [0x3fd2ff, 0xffffff], [0xffc23d, 0xff4fa3], [0x9a55ff, 0xfff3a0], [0x3fe0a2, 0xffffff]];
    for (let i = 0; i < 12; i++) {
      const l = createLollipop({ size: rand(1.4, 2.2), colors: lollyColors[i % lollyColors.length] });
      l.userData.kind = 'lolly';
      this.decor.push(l);
    }
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Group();
      const cane = createCandyCane({ size: rand(1.6, 2.4) });
      c.add(cane);
      c.userData.kind = 'cane';
      this.decor.push(c);
    }
    for (let i = 0; i < 4; i++) {
      const cake = new THREE.Group();
      let y = 0;
      [1.7, 1.25, 0.85].forEach((r, k) => {
        const layer = createCakeLayer({ radius: r, height: 0.7, flavor: FLAVORS[(i + k) % FLAVORS.length], sprinkles: 90, dripMax: 0.35, shadows: false });
        layer.position.y = y;
        y += layer.userData.topY;
        cake.add(layer);
      });
      const base = new THREE.Mesh(cloudGeometry(), cloudMat);
      base.scale.set(2.6, 1.2, 2.6);
      base.position.y = -0.4;
      cake.add(base);
      cake.userData.kind = 'cake';
      this.decor.push(cake);
    }
    for (let i = 0; i < 6; i++) {
      const bunch = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const b = createBalloon(pick(PARTY_COLORS), { scale: rand(0.5, 0.7) });
        b.position.set(rand(-0.7, 0.7), rand(0, 1.4), rand(-0.5, 0.5));
        b.rotation.z = rand(-0.3, 0.3);
        b.userData.body.castShadow = false;
        bunch.add(b);
      }
      bunch.userData.kind = 'bunch';
      this.decor.push(bunch);
    }
    this.decor.forEach((d, i) => {
      this._placeDecor(d, -i * (130 / this.decor.length) - rand(0, 4));
      s.add(d);
    });

    // ---- balloon arches with the birthday girl's name ----
    this.arches = [];
    const name = this.game.config.name.toUpperCase();
    for (let i = 0; i < 2; i++) {
      const arch = new THREE.Group();
      const n = 34;
      const bGeo = new THREE.SphereGeometry(0.42, 20, 14);
      const mats = PARTY_COLORS.slice(0, 4).map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.2, clearcoat: 1, sheen: 0.5, sheenColor: 0xffffff }));
      for (let k = 0; k < n; k++) {
        const a = (k / (n - 1)) * Math.PI;
        const m = new THREE.Mesh(bGeo, mats[k % 4]);
        m.position.set(Math.cos(a) * 3.6, Math.sin(a) * 4.4 - 0.2, (k % 2) * 0.25);
        m.scale.setScalar(k % 2 ? 0.85 : 1);
        arch.add(m);
      }
      const banner = createBunting(new THREE.Vector3(-2.6, 3.6, 0.1), new THREE.Vector3(2.6, 3.6, 0.1), { sag: 0.5, text: name.length <= 9 ? name : 'PARTY!', size: 0.55 });
      arch.add(banner);
      arch.userData.banner = banner;
      arch.position.z = -60 - i * 90;
      s.add(arch);
      this.arches.push(arch);
    }

    // ---- obstacle & pickup pools ----
    this.pool = { tall: [], low: [], barLane: [], barAll: [], star: [], present: [], power: [] };
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      const b1 = createGiftBox({ w: 1.25, h: 1.05, d: 1.1, color: pick(PARTY_COLORS) });
      const b2 = createGiftBox({ w: 1.0, h: 0.85, d: 0.9, color: pick(PARTY_COLORS), ribbon: 0xffd23d });
      b2.position.y = 1.05;
      b2.rotation.y = rand(-0.4, 0.4);
      g.add(b1, b2);
      if (i % 2) {
        const b3 = createGiftBox({ w: 0.6, h: 0.5, d: 0.6, color: pick(PARTY_COLORS) });
        b3.position.y = 1.9;
        b3.rotation.y = rand(-0.6, 0.6);
        g.add(b3);
      }
      this._addPool('tall', g, { d: 1.1, h: 2.3 });
    }
    for (let i = 0; i < 10; i++) {
      const g = createGiftBox({ w: 1.45, h: 0.72, d: 0.95, color: pick(PARTY_COLORS), ribbon: pick([0xffffff, 0xffd23d]) });
      this._addPool('low', g, { d: 0.95, h: 0.72 });
    }
    const poleMat = railMat;
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.3, 10);
    const mkBar = (width, letters) => {
      const g = new THREE.Group();
      for (const sx of [-1, 1]) {
        const p = new THREE.Mesh(poleGeo, poleMat);
        p.position.set((sx * width) / 2, 1.15, 0);
        p.castShadow = true;
        g.add(p);
        const top = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), foilMaterial(FOIL_COLORS.gold));
        top.position.set((sx * width) / 2, 2.32, 0);
        g.add(top);
      }
      // banner board
      const boardTex = canvasTexture(512, 96, (gg, w, h) => {
        const grd = gg.createLinearGradient(0, 0, w, 0);
        grd.addColorStop(0, '#ff4fa3');
        grd.addColorStop(0.5, '#9a55ff');
        grd.addColorStop(1, '#3fd2ff');
        gg.fillStyle = grd;
        gg.fillRect(0, 0, w, h);
        gg.font = '700 58px Fredoka, sans-serif';
        gg.textAlign = 'center';
        gg.textBaseline = 'middle';
        gg.fillStyle = '#ffffff';
        gg.fillText(letters, w / 2, h / 2 + 3);
      });
      const board = new THREE.Mesh(new THREE.BoxGeometry(width - 0.1, 0.62, 0.08), new THREE.MeshPhysicalMaterial({ map: boardTex, roughness: 0.4, clearcoat: 0.5 }));
      board.position.y = 1.62;
      board.castShadow = true;
      g.add(board);
      // dangling streamers
      for (let k = 0; k < Math.round(width * 3); k++) {
        const st = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.4), new THREE.MeshStandardMaterial({ color: pick(PARTY_COLORS), side: THREE.DoubleSide }));
        st.position.set(-width / 2 + 0.2 + (k / (width * 3)) * (width - 0.3), 1.12, 0.05);
        g.add(st);
      }
      return g;
    };
    for (let i = 0; i < 6; i++) this._addPool('barLane', mkBar(1.65, 'DUCK!'), { d: 0.3 });
    for (let i = 0; i < 4; i++) this._addPool('barAll', mkBar(5.6, 'PARTY TIME!'), { d: 0.3 });
    const starMat = foilMaterial(0xffc850, { roughness: 0.15, envMapIntensity: 2 });
    starMat.emissive.set(0xffa21e);
    starMat.emissiveIntensity = 0.35;
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(starGeometry(), starMat);
      m.scale.setScalar(0.3);
      m.castShadow = true;
      this._addPool('star', m, {});
    }
    for (let i = 0; i < 4; i++) {
      const g = createGiftBox({ w: 0.55, h: 0.5, d: 0.55, color: 0xff3d8b, ribbon: 0xffd23d });
      this._addPool('present', g, {});
    }
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const b = createBalloon([0xff3d8b, 0x2fc6ff, 0xffb21e][k], { scale: 0.32 });
        b.position.set((k - 1) * 0.32, 0.6 + (k === 1 ? 0.2 : 0), 0);
        b.rotation.z = (1 - k) * 0.25;
        g.add(b);
      }
      this._addPool('power', g, {});
    }
    this.objects = [];

    // ---- Sprinkle ----
    this.mascot = new Mascot();
    this.mascot.group.scale.setScalar(0.95);
    this.mascot.group.rotation.y = Math.PI; // run away from camera
    s.add(this.mascot.group);
    // balloons Sprinkle holds when flying
    this.flyBalloons = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const b = createBalloon([0xff3d8b, 0x2fc6ff, 0xffb21e][k], { scale: 0.42 });
      b.position.set((k - 1) * 0.45, 2.3 + (k === 1 ? 0.3 : 0), 0);
      b.rotation.z = (1 - k) * 0.3;
      this.flyBalloons.add(b);
    }
    const strGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.45, 1.75, 0), new THREE.Vector3(0, 0.95, 0), new THREE.Vector3(0, 2.05, 0), new THREE.Vector3(0, 0.95, 0), new THREE.Vector3(0.45, 1.75, 0), new THREE.Vector3(0, 0.95, 0),
    ]);
    this.flyBalloons.add(new THREE.Line(strGeo, new THREE.LineBasicMaterial({ color: 0xffffff })));
    this.flyBalloons.visible = false;
    this.mascot.group.add(this.flyBalloons);
    // soft blob shadow for depth while jumping
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: 0x5a2a6a, transparent: true, opacity: 0.25, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.01;
    s.add(this.blob);

    this.confetti = new Confetti(s, { max: 1400 });
    this.glow = new GlowParticles(s, { max: 3000 });
  }

  _addPool(type, obj, props) {
    obj.visible = false;
    obj.userData.type = type;
    Object.assign(obj.userData, props);
    this.scene.add(obj);
    this.pool[type].push(obj);
  }

  _take(type) {
    const obj = this.pool[type].find((o) => !o.visible);
    if (!obj) return null;
    obj.visible = true;
    obj.rotation.set(0, 0, 0);
    obj.scale.setScalar(type === 'star' ? 0.3 : 1);
    return obj;
  }

  _placeCloud(c, z) {
    const side = Math.random() < 0.5 ? -1 : 1;
    c.position.set(side * rand(2, 45), rand(-9, -4.5), z);
    const sc = rand(2.5, 6);
    c.scale.set(sc * rand(1, 1.8), sc * rand(0.5, 0.8), sc);
  }

  _placeDecor(d, z) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const k = d.userData.kind;
    if (k === 'lolly') d.position.set(side * rand(4.2, 8), rand(-5, -2.5), z);
    else if (k === 'cane') d.position.set(side * rand(4.0, 7), rand(-4.5, -2.5), z);
    else if (k === 'cake') d.position.set(side * rand(9, 15), rand(-4, -2), z);
    else d.position.set(side * rand(4.5, 9), rand(0.5, 3), z);
    d.rotation.y = k === 'cane' ? (side > 0 ? Math.PI : 0) : rand(0, Math.PI * 2);
    if (k === 'lolly') d.rotation.z = side * rand(0.05, 0.2);
  }

  resize(w, h) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.baseFov = fitFov(58, aspect, 64);
    this.camera.fov = this.baseFov;
    this.camera.far = 400;
    this.camera.updateProjectionMatrix();
    this.glow?.resize();
  }

  // ---------- state ----------
  enter() {
    this.prepare();
  }

  prepare() {
    for (const o of this.objects) o.visible = false;
    this.objects = [];
    this.mode = 'attract';
    this.score = 0;
    this.distance = 0;
    this.starsGot = 0;
    this.presentsGot = 0;
    this.lives = MAX_LIVES;
    this.speed = 9;
    this.lane = 1;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.sliding = 0;
    this.flying = 0;
    this.invuln = 0;
    this.hurtT = 0;
    this.nextRow = 20;
    this.nextPower = 260;
    this.elapsed = 0;
    this.starStreak = 0;
    this.starStreakT = 0;
    this.deadT = 0;
    this.camX = 0;
    this.camRoll = 0;
    this.flyBalloons.visible = false;
    this.confetti.clear();
    this.glow.clear();
    this.mascot.setState('run');
    this.mascot.group.visible = true;
  }

  showHud() {
    this.ui.hud(true, { lives: true, alt: 'Meters', hint: 'Swipe or use arrow keys ⬅️ ⬆️ ⬇️ ➡️' });
    this.ui.setLives(this.lives, MAX_LIVES, '❤️');
    this.ui.setAlt(0);
  }

  start() {
    this.mode = 'play';
    this.speed = 11;
    this.nextRow = 6;
  }

  exit() {
    this.mode = 'attract';
  }

  // ---------- input ----------
  keyDown(code) {
    if (this.mode !== 'play') return;
    if (code === 'ArrowLeft' || code === 'KeyA') this._move(-1);
    else if (code === 'ArrowRight' || code === 'KeyD') this._move(1);
    else if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') this._jump();
    else if (code === 'ArrowDown' || code === 'KeyS') this._slide();
  }

  pointerDown(e) {
    this.swipe = { x: e.clientX, y: e.clientY, t: performance.now(), used: false };
  }

  pointerMove(e) {
    const sw = this.swipe;
    if (!sw || sw.used || this.mode !== 'play') return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    const th = Math.max(28, Math.min(window.innerWidth, window.innerHeight) * 0.05);
    if (Math.abs(dx) > th || Math.abs(dy) > th) {
      sw.used = true;
      if (Math.abs(dx) > Math.abs(dy)) this._move(dx > 0 ? 1 : -1);
      else if (dy < 0) this._jump();
      else this._slide();
    }
  }

  pointerUp() {
    const sw = this.swipe;
    this.swipe = null;
    if (!sw || sw.used || this.mode !== 'play') return;
    if (performance.now() - sw.t < 350) this._jump();
  }

  _move(dir) {
    const nl = clamp(this.lane + dir, 0, 2);
    if (nl === this.lane) return;
    this.lane = nl;
    audio.whoosh(0.18, 0.12);
  }

  _jump() {
    if (this.flying > 0) return;
    if (this.y <= 0.01) {
      this.vy = JUMP_V;
      this.sliding = 0;
      audio.jump();
    }
  }

  _slide() {
    if (this.flying > 0) return;
    if (this.y > 0.05) this.vy = -16; // slam down
    this.sliding = 0.62;
    audio.slide();
  }

  // ---------- spawning ----------
  _spawnObj(type, lane, z, y = 0) {
    const o = this._take(type);
    if (!o) return null;
    o.userData.lane = lane;
    o.userData.alive = true;
    o.userData.baseY = y;
    o.position.set(lane === null ? 0 : LANES[lane], y, z);
    if (type === 'low' || type === 'tall') o.rotation.y = rand(-0.15, 0.15);
    this.objects.push(o);
    return o;
  }

  _starLine(lane, z, count = 5, spacing = 2.2, arc = false, y = 0.7) {
    for (let i = 0; i < count; i++) {
      let yy = y;
      if (arc) yy = y + Math.sin((i / (count - 1)) * Math.PI) * 1.5;
      this._spawnObj('star', lane, z - i * spacing, yy);
    }
  }

  _spawnRow(z) {
    const d = clamp(this.elapsed / 90, 0, 1); // difficulty 0..1
    if (this.mode !== 'play') {
      this._starLine(Math.floor(rand(0, 3)), z, 5);
      return 14;
    }
    if (this.flying > 0) {
      // sky stars while floating
      this._starLine(Math.floor(rand(0, 3)), z, 6, 2.2, false, 2.9);
      return 13;
    }
    if (this.elapsed > 4 && this.distance > this.nextPower) {
      this.nextPower = this.distance + rand(320, 450);
      this._spawnObj('power', Math.floor(rand(0, 3)), z, 0.2);
      return 12;
    }
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const r = Math.random();
    const gap = 13 + this.speed * 0.32;
    if (r < 0.1) {
      // breather: zig-zag stars, maybe a present
      let l = Math.floor(rand(0, 3));
      for (let i = 0; i < 7; i++) {
        this._spawnObj('star', l, z - i * 2.2, 0.7);
        if (i % 2 === 1) l = clamp(l + pick([-1, 1]), 0, 2);
      }
      if (Math.random() < 0.4) this._spawnObj('present', pick([0, 1, 2]), z - 18, 0.1);
      return gap + 8;
    }
    if (r < 0.32) {
      // single obstacle + stars elsewhere
      const t = pick(['tall', 'low', 'low', 'barLane']);
      this._spawnObj(t, lanes[0], z);
      if (t === 'low') this._starLine(lanes[0], z + 3.5, 4, 2.3, true, 0.7);
      this._starLine(lanes[1], z, 4);
      return gap;
    }
    if (r < 0.52) {
      // two tall stacks, one free lane
      this._spawnObj('tall', lanes[0], z);
      this._spawnObj(d > 0.3 && Math.random() < 0.5 ? 'low' : 'tall', lanes[1], z);
      this._starLine(lanes[2], z + 2, 4);
      if (Math.random() < 0.15) this._spawnObj('present', lanes[2], z - 6, 0.1);
      return gap + 2;
    }
    if (r < 0.66) {
      // jump over a full row of presents
      for (const l of [0, 1, 2]) this._spawnObj('low', l, z);
      this._starLine(1, z + 4, 5, 2.0, true, 0.7);
      return gap + 2;
    }
    if (r < 0.8) {
      // slide under the big banner
      this._spawnObj('barAll', null, z);
      this._starLine(lanes[0], z + 3, 4, 2, false, 0.45);
      return gap + 2;
    }
    // mixed row: jump, slide or dodge
    this._spawnObj('low', lanes[0], z);
    this._spawnObj('barLane', lanes[1], z);
    if (d > 0.25) this._spawnObj('tall', lanes[2], z);
    else this._starLine(lanes[2], z, 3);
    return gap + 3;
  }

  // ---------- gameplay ----------
  _hit(o) {
    o.userData.alive = false;
    o.visible = false;
    this.lives--;
    this.ui.setLives(this.lives, MAX_LIVES, '❤️');
    audio.hurt();
    this.engine.addShake(0.6);
    this.engine.doFlash(0.25, 0xff9ab8, 3);
    const p = new THREE.Vector3(this.x, 0.8, 0);
    this.confetti.burst(p.clone().add(new THREE.Vector3(0, 0, -0.8)), { count: 60, speed: 6 });
    this.speed *= 0.72;
    this.invuln = 1.6;
    this.hurtT = 0.7;
    this.starStreak = 0;
    if (this.lives <= 0) this._die();
    else {
      const scr = this.toScreen(p.clone().add(new THREE.Vector3(0, 1.2, 0)));
      this.ui.popup(scr.x, scr.y, 'Ouch!', { cls: 'big bad' });
    }
  }

  _die() {
    this.mode = 'dead';
    this.deadT = 0;
    this.mascot.setState('dizzy');
    audio.fail();
    const score = Math.round(this.score);
    const stars = score >= 3000 ? 3 : score >= 1500 ? 2 : score >= 600 ? 1 : 0;
    setTimeout(() => {
      this.game.finishGame({
        id: 'dash',
        score,
        stars,
        title: stars >= 3 ? 'Speedy Superstar! 🏃‍♀️' : stars === 2 ? 'Awesome Run!' : stars === 1 ? 'Great Dash!' : 'Nice Try!',
        lines: [
          ['🏃 Distance', `${Math.round(this.distance)} m`],
          ['⭐ Stars grabbed', this.starsGot],
          ['🎁 Presents', this.presentsGot],
        ],
      });
    }, 1300);
  }

  _collect(o) {
    o.userData.alive = false;
    o.visible = false;
    const type = o.userData.type;
    const wp = o.position.clone();
    if (type === 'star') {
      this.starsGot++;
      this.starStreakT = 0.6;
      this.starStreak++;
      this.score += 10;
      audio.coin(this.starStreak % 8);
      this.glow.sparkle(wp, { count: 12, color: new THREE.Color(1, 0.85, 0.4), speed: 2.5, size: 0.1, life: 0.5 });
    } else if (type === 'present') {
      this.presentsGot++;
      this.score += 50;
      audio.sparkle(84);
      this.glow.sparkle(wp, { count: 50, color: [new THREE.Color(1, 0.5, 0.8), new THREE.Color(1, 0.9, 0.4)], speed: 4, size: 0.14 });
      this.confetti.burst(wp, { count: 40, speed: 5 });
      const scr = this.toScreen(wp.clone().add(new THREE.Vector3(0, 1, 0)));
      this.ui.popup(scr.x, scr.y, '🎁 +50', { cls: 'big', color: '#ffd0ec' });
    } else if (type === 'power') {
      this.flying = 5.5;
      this.flyBalloons.visible = true;
      this.sliding = 0;
      audio.partyHorn();
      audio.sparkle(79);
      this.ui.announce('Up, up & away!', { small: true, duration: 1300 });
      this.glow.sparkle(wp, { count: 60, color: [new THREE.Color(1, 0.4, 0.7), new THREE.Color(0.4, 0.8, 1)], speed: 4 });
      // clear the obstacles ahead so the float feels great
    }
    this.ui.setScore(Math.round(this.score), type !== 'star');
  }

  update(dt, t) {
    const playing = this.mode === 'play';
    const dead = this.mode === 'dead';
    if (playing) {
      this.elapsed += dt;
      const target = Math.min(24, 11 + this.elapsed * 0.16);
      this.speed = damp(this.speed, target, this.hurtT > 0 ? 0.5 : 1.2, dt);
    } else if (dead) {
      this.deadT += dt;
      this.speed = damp(this.speed, 0, 3, dt);
    } else {
      this.speed = damp(this.speed, 9, 2, dt);
    }
    const dz = this.speed * dt;
    if (playing) {
      this.distance += dz;
      this.score += dz;
      this.ui.setAlt(Math.round(this.distance));
      this.ui.setScore(Math.round(this.score), false);
    }

    // ---- player ----
    if (this.flying > 0) {
      this.flying -= dt;
      this.y = damp(this.y, 2.6 + Math.sin(t * 3) * 0.15, 3, dt);
      this.vy = 0;
      if (this.flying <= 0) {
        this.flyBalloons.visible = false;
        this.vy = 0;
        audio.whoosh(0.5, 0.15);
      }
    } else {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        if (this.vy < -6) this.mascot.bounce(0.18);
        this.y = 0;
        this.vy = 0;
      }
    }
    if (this.sliding > 0) this.sliding -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.starStreakT > 0) {
      this.starStreakT -= dt;
      if (this.starStreakT <= 0) this.starStreak = 0;
    }
    const tx = LANES[this.lane];
    const prevX = this.x;
    this.x = damp(this.x, tx, 16, dt);
    const m = this.mascot;
    if (!dead) {
      if (this.flying > 0) m.setState('jump');
      else if (this.sliding > 0 && this.y < 0.1) m.setState('slide');
      else if (this.y > 0.05) m.setState('jump');
      else if (this.hurtT > 0) m.setState('dizzy');
      else m.setState('run');
    }
    m.runSpeed = 7 + this.speed * 0.6;
    m.group.position.set(this.x, this.y, 0);
    m.group.rotation.z = (this.x - prevX) / Math.max(dt, 1e-3) * -0.02;
    if (dead) m.group.rotation.y = Math.PI + Math.min(this.deadT * 4, Math.PI * 3);
    m.group.visible = this.invuln > 0 ? Math.floor(t * 14) % 2 === 0 : true;
    m.update(dt);
    this.blob.position.set(this.x, 0.012, 0);
    const bs = 1 / (1 + this.y * 0.5);
    this.blob.scale.setScalar(bs);
    this.blob.material.opacity = 0.25 * bs;

    // ---- world scroll ----
    for (const tile of this.tiles) {
      tile.position.z += dz;
      if (tile.position.z > TILE_LEN * 2) tile.position.z -= TILE_COUNT * TILE_LEN;
    }
    for (const c of this.clouds) {
      c.position.z += dz;
      if (c.position.z > 25) this._placeCloud(c, c.position.z - 150);
    }
    for (const d of this.decor) {
      d.position.z += dz;
      if (d.userData.kind === 'bunch') d.position.y += Math.sin(t + d.position.x) * 0.002;
      if (d.position.z > 18) this._placeDecor(d, d.position.z - 150);
    }
    for (const a of this.arches) {
      a.position.z += dz;
      if (a.position.z > 12) a.position.z -= 180;
      a.userData.banner.userData.update(t);
    }

    // ---- spawn rows ----
    this.nextRow -= dz;
    if (this.nextRow <= 0 && !dead) this.nextRow = this._spawnRow(SPAWN_Z);

    // ---- objects ----
    const px = this.x, py = this.y;
    const height = this.sliding > 0 && this.y < 0.2 ? 0.7 : 1.35;
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      o.position.z += dz;
      const u = o.userData;
      if (u.type === 'star') {
        o.rotation.y += dt * 4;
        o.position.y = u.baseY + Math.sin(t * 4 + o.position.z * 0.3) * 0.08;
      } else if (u.type === 'present' || u.type === 'power') {
        o.rotation.y += dt * 2;
        o.position.y = u.baseY + Math.sin(t * 3) * 0.15;
      }
      if (u.alive && playing && Math.abs(o.position.z) < 1.2) {
        const laneX = u.lane === null ? 0 : LANES[u.lane];
        const dxl = Math.abs(px - laneX);
        const zHalf = (u.d || 0.6) / 2 + 0.3;
        const inZ = Math.abs(o.position.z) < zHalf;
        if (u.type === 'star' || u.type === 'present' || u.type === 'power') {
          const dy = Math.abs(o.position.y + 0.3 - (py + 0.7));
          if (dxl < 0.95 && Math.abs(o.position.z) < 0.9 && dy < 1.25) this._collect(o);
        } else if (inZ && this.invuln <= 0 && this.flying <= 0) {
          const laneHit = u.lane === null ? true : dxl < 1.05;
          if (laneHit) {
            let hit = false;
            if (u.type === 'tall') hit = true;
            else if (u.type === 'low') hit = py < u.h - 0.05;
            else if (u.type === 'barLane' || u.type === 'barAll') hit = height > 0.9 || py > 0.25;
            if (hit) this._hit(o);
          }
        }
      }
      if (o.position.z > 8) {
        o.visible = false;
        this.objects.splice(i, 1);
      }
    }

    // ---- camera ----
    this.camX = damp(this.camX, this.x * 0.55, 5, dt);
    this.camRoll = damp(this.camRoll, (tx - this.x) * -0.03, 6, dt);
    const camY = 3.3 + this.y * 0.45;
    this.camera.position.set(this.camX, camY, 6.4);
    this.camera.lookAt(this.camX * 0.6, 0.9 + this.y * 0.35, -8);
    this.camera.rotation.z += this.camRoll;
    const fov = this.baseFov + clamp((this.speed - 11) / 13, 0, 1) * 7;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    // speed lines of sparkle when fast
    if (this.speed > 16 && Math.random() < dt * (this.speed - 14)) {
      this.glow.emit({ x: rand(-4, 4), y: rand(0.5, 4), z: -6, vz: this.speed * 1.5, r: 2, g: 1.8, b: 2.2, size: 0.05, life: 0.5, drag: 0 });
    }
    // sparkles trailing behind while flying
    if (this.flying > 0 && Math.random() < dt * 30) {
      this.glow.emit({ x: this.x + rand(-0.3, 0.3), y: this.y + rand(0.2, 0.8), z: 0.3, vz: this.speed * 0.6, vy: -0.5, r: 3, g: 2, b: 3.2, size: 0.12, life: 0.6, drag: 1 });
    }

    this.light.position.set(this.x - 3, 10, -9);
    this.light.target.position.set(this.x, 0, -2);
    this.confetti.update(dt);
    this.glow.update(dt);
  }
}
