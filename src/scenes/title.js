import * as THREE from 'three';
import { BaseScene } from '../core/scene.js';
import { audio } from '../core/audio.js';
import { rand, pick, damp, skyMaterial, fitFov, PARTY_COLORS, FOIL_COLORS, easeOutCubic } from '../core/util.js';
import { createFoilWord } from '../models/foilText.js';
import { createBalloon } from '../models/balloon.js';
import { BalloonOnString } from '../models/stringBalloon.js';
import { Mascot } from '../models/mascot.js';
import { createBunting, createStringLights, createGiftBox, createBokeh } from '../models/decor.js';
import { Confetti } from '../fx/confetti.js';
import { GlowParticles } from '../fx/particles.js';

const WORD_COLORS = [FOIL_COLORS.pink, FOIL_COLORS.gold, FOIL_COLORS.purple, FOIL_COLORS.teal, FOIL_COLORS.rose, FOIL_COLORS.blue, FOIL_COLORS.gold, FOIL_COLORS.pink];

export class TitleScene extends BaseScene {
  constructor(game) {
    super(game);
    this.viewOpts = { bloom: { strength: 0.8, radius: 0.45, threshold: 2.2 }, exposure: 1.0, vignette: 0.36 };
    this.mode = 'title';
    this.pointer = new THREE.Vector2();
    this.camPos = new THREE.Vector3(0, 2.2, 10.5);
    this.camLook = new THREE.Vector3(0, 2.0, 0);
  }

  async build(onProgress = () => {}) {
    const s = this.scene;
    const name = this.game.config.name.toUpperCase();

    // sky
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), skyMaterial([
      [-1, 0x12082a], [-0.05, 0x3a1452], [0.06, 0xb8407a], [0.2, 0x5a2a8a], [0.55, 0x1d0e4a], [1, 0x0b0624],
    ], { stars: 1 }));
    this.sky.renderOrder = -1;
    s.add(this.sky);
    s.fog = new THREE.Fog(0x4a1a5e, 16, 60);

    // lights
    s.add(new THREE.HemisphereLight(0xc4a8ff, 0x3a1850, 0.9));
    const key = new THREE.DirectionalLight(0xfff0e0, 2.6);
    key.position.set(4, 10, 9);
    key.target.position.set(0, 1.5, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -9; key.shadow.camera.right = 9;
    key.shadow.camera.top = 8; key.shadow.camera.bottom = -4;
    key.shadow.camera.near = 1; key.shadow.camera.far = 30;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    s.add(key, key.target);
    const pinkRim = new THREE.PointLight(0xff4fa3, 60, 20, 2);
    pinkRim.position.set(-6, 4.5, -2.5);
    const cyanRim = new THREE.PointLight(0x3fd2ff, 55, 20, 2);
    cyanRim.position.set(6, 4.5, -2.5);
    const warm = new THREE.PointLight(0xffb36b, 30, 14, 2);
    warm.position.set(0, 1.2, 4.5);
    s.add(pinkRim, cyanRim, warm);
    this.rims = [pinkRim, cyanRim];

    // stage
    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(7.2, 7.5, 0.4, 96),
      new THREE.MeshPhysicalMaterial({ color: 0x1e0c3a, roughness: 0.3, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.6 })
    );
    stage.position.y = -0.2;
    stage.receiveShadow = true;
    s.add(stage);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(80, 64), new THREE.MeshStandardMaterial({ color: 0x1a0b33, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.4;
    floor.receiveShadow = true;
    s.add(floor);
    // marquee bulbs around the stage
    const bulbN = 72;
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), bulbN);
    const m = new THREE.Matrix4();
    for (let i = 0; i < bulbN; i++) {
      const a = (i / bulbN) * Math.PI * 2;
      m.makeTranslation(Math.sin(a) * 7.36, -0.12, Math.cos(a) * 7.36);
      bulbs.setMatrixAt(i, m);
      bulbs.setColorAt(i, new THREE.Color(0xffd27a).multiplyScalar(5));
    }
    s.add(bulbs);
    this.marquee = bulbs;
    onProgress(0.2);

    // the name in giant foil balloon letters
    this.word = createFoilWord(name, { size: name.length > 8 ? 1.0 : 1.35, colors: WORD_COLORS, spacing: 0.07 });
    this.word.position.set(0, 2.75, 0);
    s.add(this.word);
    this.letters = this.word.userData.letters;
    this.letterHits = this.letters.map((l) => l.userData.mesh);
    this.letters.forEach((l) => (l.userData.spin = 0));
    // ribbons hanging from each letter
    this.ribbons = this.letters.map((l, i) => {
      const n = 18;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(WORD_COLORS[i % WORD_COLORS.length]).lerp(new THREE.Color(0xffffff), 0.3) }));
      line.frustumCulled = false;
      s.add(line);
      const weight = createGiftBox({ w: 0.22, h: 0.18, d: 0.22, color: PARTY_COLORS[i % PARTY_COLORS.length] });
      weight.position.set(this.word.position.x + l.position.x + rand(-0.15, 0.15), 0, rand(0.2, 0.5));
      weight.rotation.y = rand(-0.5, 0.5);
      s.add(weight);
      return { line, n, weight };
    });
    onProgress(0.45);

    // balloon bunches tied to gift boxes
    this.tethered = [];
    const bunch = (x, z, count, height) => {
      const box = createGiftBox({ w: 0.8, h: 0.7, d: 0.8, color: pick(PARTY_COLORS) });
      box.position.set(x, 0, z);
      box.rotation.y = rand(-0.6, 0.6);
      s.add(box);
      for (let i = 0; i < count; i++) {
        const anchor = new THREE.Vector3(x + rand(-0.1, 0.1), 0.78, z + rand(-0.1, 0.1));
        const b = new BalloonOnString({ color: PARTY_COLORS[(i * 3 + Math.floor(x)) & 7], scale: rand(0.38, 0.48), length: height + rand(-0.6, 0.8), segments: 10, anchor });
        b.buoyancy = rand(3.5, 5);
        b.wind.set((i - count / 2) * 0.8, 0, rand(-0.4, 0.4));
        b.addTo(s);
        this.tethered.push(b);
      }
    };
    bunch(-5.4, -0.8, 5, 2.6);
    bunch(5.5, -0.6, 5, 2.4);
    bunch(-6.8, -3.5, 3, 3.2);
    bunch(6.9, -3.2, 3, 3.4);

    const g1 = createGiftBox({ w: 0.9, h: 0.75, d: 0.9, color: 0x9a55ff, ribbon: 0xffd23d });
    g1.position.set(-3.9, 0, 2.6);
    g1.rotation.y = 0.4;
    const g2 = createGiftBox({ w: 0.6, h: 0.5, d: 0.6, color: 0x2fc6ff, ribbon: 0xffffff });
    g2.position.set(-3.9, 0.75, 2.6);
    g2.rotation.y = -0.2;
    const g3 = createGiftBox({ w: 0.7, h: 0.9, d: 0.7, color: 0xff3d8b, ribbon: 0xffffff });
    g3.position.set(-2.8, 0, 3.4);
    g3.rotation.y = 0.9;
    const g4 = createGiftBox({ w: 1.0, h: 0.6, d: 0.8, color: 0x2bd98f, ribbon: 0xff3d8b });
    g4.position.set(4.3, 0, 2.3);
    g4.rotation.y = -0.5;
    s.add(g1, g2, g3, g4);
    onProgress(0.6);

    // Sprinkle the mascot
    this.mascot = new Mascot();
    this.mascot.group.position.set(2.9, 0, 3.0);
    this.mascot.group.rotation.y = -0.35;
    this.mascot.group.scale.setScalar(1.05);
    this.mascot.setState('wave');
    s.add(this.mascot.group);

    // decorations overhead
    this.updaters = [];
    const lights1 = createStringLights(new THREE.Vector3(-11, 7.2, -5), new THREE.Vector3(11, 7.2, -5), { sag: 1.6, count: 30, bulbSize: 0.08, intensity: 7 });
    const lights2 = createStringLights(new THREE.Vector3(-10, 6.6, -1.5), new THREE.Vector3(10, 6.9, -2), { sag: 1.3, count: 26, bulbSize: 0.07, intensity: 7 });
    const bunting = createBunting(new THREE.Vector3(-10, 6.2, -6.5), new THREE.Vector3(10, 6.2, -6.5), { sag: 1.1, count: 26, size: 0.5 });
    s.add(lights1, lights2, bunting);
    this.updaters.push(lights1.userData.update, lights2.userData.update, bunting.userData.update);
    const bokeh = createBokeh({ count: 46, center: new THREE.Vector3(0, 5, -26), spread: new THREE.Vector3(32, 9, 4), sizeMin: 1.2, sizeMax: 3.6, opacity: 0.32 });
    s.add(bokeh);
    this.updaters.push(bokeh.userData.update);

    // drifting background balloons (pop them for fun!)
    this.floaters = [];
    for (let i = 0; i < 12; i++) {
      const b = new BalloonOnString({ color: PARTY_COLORS[i % PARTY_COLORS.length], scale: rand(0.35, 0.55), length: 1.4, segments: 8, lineOpacity: 0.5 });
      b.group.position.set(rand(-12, 12), rand(-2, 12), rand(-14, -7));
      b.speed = rand(0.35, 0.7);
      b.phase = rand(0, 6.28);
      b.reset();
      b.addTo(s);
      this.floaters.push(b);
    }
    onProgress(0.8);

    this.confetti = new Confetti(s, { max: 900, floorY: 0.005 });
    this.confetti.setRain(16, { x: [-8, 8], y: 8, z: [-3, 5] });
    this.glow = new GlowParticles(s, { max: 1500 });
    // pre-warm confetti so it is already falling
    for (let i = 0; i < 120; i++) this.confetti.update(1 / 20);
    onProgress(1);
  }

  setMode(mode) {
    this.mode = mode;
  }

  enter(opts = {}) {
    this.mode = opts.mode || 'title';
    this.introT = 0;
  }

  resize(w, h) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.fov = fitFov(38, aspect, aspect < 0.8 ? 50 : 56);
    this.camera.updateProjectionMatrix();
    this.glow?.resize();
    // on tall screens push the word a bit higher so the buttons have room
    this.portrait = aspect < 0.8;
  }

  pointerMove(e) {
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  }

  pointerDown(e) {
    this.pointerMove(e);
    const ray = this.rayFromEvent(e);
    const hits = this.raycaster.intersectObjects(this.letterHits, false);
    if (hits.length) {
      const mesh = hits[0].object;
      const l = this.letters.find((x) => x.userData.mesh === mesh);
      if (l) {
        l.userData.spin = 1;
        audio.letter(l.userData.index);
        const p = new THREE.Vector3();
        l.getWorldPosition(p);
        this.glow.sparkle(p, { count: 40, color: new THREE.Color(l.userData.color), speed: 3.5, size: 0.14 });
        this.confetti.burst(p, { count: 30, speed: 4 });
        return;
      }
    }
    // pop background balloons
    let best = null, bestT = Infinity;
    for (const b of this.floaters) {
      if (b.popped) continue;
      const c = b.group.position;
      const r = 1.2 * b.scale + 0.15;
      if (ray.distanceSqToPoint(c) < r * r) {
        const t = ray.origin.distanceTo(c);
        if (t < bestT) { bestT = t; best = b; }
      }
    }
    if (best) {
      audio.pop();
      this.confetti.burst(best.group.position, { count: 45, speed: 5, colors: [best.group.userData.material.color.getHex(), 0xffffff, 0xffd23d] });
      best.popped = true;
      best.group.visible = false;
      best.detached = true;
      setTimeout(() => {
        best.popped = false;
        best.group.visible = true;
        best.group.position.set(rand(-12, 12), -3, rand(-14, -7));
        best.reset();
      }, 2500);
    }
  }

  update(dt, t) {
    this.introT += dt;
    // camera: slow drift + parallax
    const menu = this.mode === 'menu';
    const portraitLift = this.portrait ? 0.9 : 0;
    const tx = Math.sin(t * 0.15) * 0.8 + this.pointer.x * 0.7;
    const ty = (menu ? 3.6 : 2.3) + this.pointer.y * 0.25 - portraitLift * 0.3;
    const tz = menu ? 11 : 8.4 + (this.portrait ? 0.8 : 0);
    const intro = easeOutCubic(Math.min(1, this.introT / 2.5));
    this.camPos.set(damp(this.camPos.x, tx, 2, dt), damp(this.camPos.y, ty, 2, dt), damp(this.camPos.z, tz + (1 - intro) * 4, 2, dt));
    this.camera.position.copy(this.camPos);
    this.camLook.set(0, menu ? 3.4 : 2.05 - portraitLift * 0.75, 0);
    this.camera.lookAt(this.camLook);

    // foil letters bob, sway and spin when tapped
    this.letters.forEach((l, i) => {
      const u = l.userData;
      l.position.y = Math.sin(t * 1.5 + i * 0.7) * 0.13 + portraitLift * 0.35;
      if (u.spin > 0) u.spin = Math.max(0, u.spin - dt * 1.1);
      const spinAngle = u.spin > 0 ? easeOutCubic(1 - u.spin) * Math.PI * 2 : 0;
      l.rotation.y = Math.sin(t * 0.8 + i * 0.6) * 0.28 + spinAngle;
      l.rotation.z = Math.sin(t * 1.1 + i) * 0.05;
      l.scale.setScalar(1 + (u.spin > 0 ? Math.sin(u.spin * Math.PI) * 0.25 : 0));
    });

    // ribbons
    const wp = new THREE.Vector3();
    this.ribbons.forEach((r, i) => {
      const l = this.letters[i];
      wp.set(0, -0.62 * (this.word.userData.width > 8 ? 1 : 1.2), 0);
      l.localToWorld(wp);
      const a = r.weight.position;
      const top = new THREE.Vector3(a.x, 0.2, a.z);
      const arr = r.line.geometry.attributes.position.array;
      for (let k = 0; k < r.n; k++) {
        const s = k / (r.n - 1);
        const x = THREE.MathUtils.lerp(wp.x, top.x, s) + Math.sin(s * 14 + i) * 0.04 * s;
        const y = THREE.MathUtils.lerp(wp.y, top.y, s);
        const z = THREE.MathUtils.lerp(wp.z, top.z, s) + Math.cos(s * 14 + i) * 0.04 * s;
        arr[k * 3] = x; arr[k * 3 + 1] = y; arr[k * 3 + 2] = z;
      }
      r.line.geometry.attributes.position.needsUpdate = true;
    });

    for (const b of this.tethered) b.update(dt, t);
    for (const b of this.floaters) {
      if (!b.popped) {
        b.group.position.y += b.speed * dt;
        b.group.position.x += Math.sin(t * 0.5 + b.phase) * 0.15 * dt;
        b.group.rotation.z = Math.sin(t * 0.8 + b.phase) * 0.12;
        if (b.group.position.y > 14) {
          b.group.position.set(rand(-12, 12), -3, rand(-14, -7));
          b.reset();
        }
      }
      b.update(dt, t);
    }

    // marquee chase
    const c = new THREE.Color();
    const n = this.marquee.count;
    for (let i = 0; i < n; i++) {
      const on = (Math.floor(t * 8) + i) % 4 === 0;
      c.set(i % 2 ? 0xffd27a : 0xff7ac0).multiplyScalar(on ? 7 : 1.6);
      this.marquee.setColorAt(i, c);
    }
    this.marquee.instanceColor.needsUpdate = true;
    this.rims[0].intensity = 50 + Math.sin(t * 1.3) * 18;
    this.rims[1].intensity = 50 + Math.cos(t * 1.1) * 18;

    this.mascot.update(dt);
    for (const u of this.updaters) u(t);
    this.sky.material.uniforms.uTime.value = t;
    this.confetti.update(dt);
    this.glow.update(dt);

    // occasional sparkle glints on the letters
    if (Math.random() < dt * 3) {
      const l = pick(this.letters);
      const p = new THREE.Vector3(rand(-0.4, 0.4), rand(-0.3, 0.5), 0.35);
      l.localToWorld(p);
      this.glow.emit({ x: p.x, y: p.y, z: p.z, r: 5, g: 4.5, b: 4, size: rand(0.25, 0.45), life: 0.5, drag: 0 });
    }
  }
}
