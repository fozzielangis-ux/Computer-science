import * as THREE from 'three';
import { canvasTexture, PARTY_COLORS, rand } from '../core/util.js';

// "Sprinkle" — the cupcake party mascot. Built entirely from simple shapes.
let _shared = null;
function shared() {
  if (_shared) return _shared;
  const wrapperTex = canvasTexture(512, 64, (g, w, h) => {
    const n = 28;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? '#ff5fa8' : '#ff8cc4';
      g.fillRect((i / n) * w, 0, w / n + 1, h);
    }
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(0, 0, w, 6);
  });
  const hatTex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#3fd2ff';
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(-0.6);
    for (let i = -8; i < 8; i++) {
      g.fillStyle = i % 2 ? '#ffd23d' : '#3fd2ff';
      g.fillRect(-w, i * 28, w * 2, 14);
    }
    g.restore();
    for (let i = 0; i < 26; i++) {
      g.fillStyle = ['#ffffff', '#ff5fa8', '#9a55ff'][i % 3];
      g.beginPath();
      g.arc(rand(0, w), rand(0, h), rand(4, 8), 0, Math.PI * 2);
      g.fill();
    }
  });

  // ridged wrapper
  const wrapPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.3, 0),
    new THREE.Vector2(0.34, 0.03),
    new THREE.Vector2(0.44, 0.48),
    new THREE.Vector2(0.475, 0.5),
    new THREE.Vector2(0.46, 0.52),
  ];
  const wrapGeo = new THREE.LatheGeometry(wrapPts, 84);
  const p = wrapGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const a = Math.atan2(x, z);
    const k = 1 + 0.035 * Math.cos(a * 28);
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  wrapGeo.computeVertexNormals();

  // swirled frosting (lathe through a smooth spline)
  const ctrl = [
    [0.36, 0.44], [0.5, 0.47], [0.535, 0.54], [0.5, 0.61], [0.43, 0.635], [0.445, 0.68], [0.41, 0.745],
    [0.33, 0.775], [0.335, 0.81], [0.29, 0.87], [0.19, 0.9], [0.17, 0.935], [0.11, 0.985], [0.04, 1.02], [0.001, 1.03],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const curve = new THREE.SplineCurve(ctrl);
  const frostPts = curve.getPoints(80);
  const frostGeo = new THREE.LatheGeometry(frostPts, 72);
  // slight twist so it reads as piped icing
  const fp = frostGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), y = fp.getY(i), z = fp.getZ(i);
    const a = Math.atan2(x, z);
    const r = Math.hypot(x, z);
    const k = 1 + 0.04 * Math.sin(a * 3 + y * 22);
    fp.setX(i, Math.sin(a) * r * k);
    fp.setZ(i, Math.cos(a) * r * k);
  }
  frostGeo.computeVertexNormals();

  _shared = {
    wrapperMat: new THREE.MeshPhysicalMaterial({ map: wrapperTex, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3, sheen: 0.3 }),
    frostMat: new THREE.MeshPhysicalMaterial({ color: 0xfff0f7, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.25, sheen: 1, sheenColor: 0xffc4e1, sheenRoughness: 0.5 }),
    whiteMat: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 0.6 }),
    blackMat: new THREE.MeshPhysicalMaterial({ color: 0x1a1030, roughness: 0.15, clearcoat: 1 }),
    cheekMat: new THREE.MeshStandardMaterial({ color: 0xff7aa8, roughness: 0.6, transparent: true, opacity: 0.85 }),
    hatMat: new THREE.MeshPhysicalMaterial({ map: hatTex, roughness: 0.4, clearcoat: 0.5 }),
    shoeMat: new THREE.MeshPhysicalMaterial({ color: 0x8a4dff, roughness: 0.3, clearcoat: 0.8 }),
    limbMat: new THREE.MeshPhysicalMaterial({ color: 0xffd9b0, roughness: 0.5 }),
    pomMat: new THREE.MeshPhysicalMaterial({ color: 0xffe14a, roughness: 0.8, sheen: 1, sheenColor: 0xffffff }),
    wrapGeo,
    frostGeo,
    curve,
  };
  return _shared;
}

export class Mascot {
  constructor({ shadows = true } = {}) {
    const S = shared();
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.body.position.y = 0.14;
    this.group.add(this.body);

    const wrapper = new THREE.Mesh(S.wrapGeo, S.wrapperMat);
    const frost = new THREE.Mesh(S.frostGeo, S.frostMat);
    wrapper.castShadow = frost.castShadow = shadows;
    this.body.add(wrapper, frost);

    // sprinkles on the frosting
    const sprGeo = new THREE.CapsuleGeometry(0.012, 0.045, 3, 6);
    const spr = new THREE.InstancedMesh(sprGeo, new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 1 }), 46);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const col = new THREE.Color();
    for (let i = 0; i < 46; i++) {
      const u = rand(0.08, 0.8);
      const pt = S.curve.getPoint(u);
      const a = rand(0, Math.PI * 2);
      const r = pt.x + 0.012;
      e.set(rand(0, 6), rand(0, 6), rand(0, 6));
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(Math.sin(a) * r, pt.y + 0.005, Math.cos(a) * r), q, new THREE.Vector3(1, 1, 1));
      spr.setMatrixAt(i, m);
      spr.setColorAt(i, col.set(PARTY_COLORS[i % PARTY_COLORS.length]));
    }
    this.body.add(spr);

    // face
    this.eyes = [];
    const eyeGeo = new THREE.SphereGeometry(0.085, 24, 16);
    const pupilGeo = new THREE.SphereGeometry(0.056, 20, 14);
    const hlGeo = new THREE.SphereGeometry(0.018, 10, 8);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(sx * 0.13, 0.31, 0.39);
      const white = new THREE.Mesh(eyeGeo, S.whiteMat);
      white.scale.set(1, 1.12, 0.55);
      const pupil = new THREE.Mesh(pupilGeo, S.blackMat);
      pupil.position.set(0, -0.005, 0.03);
      pupil.scale.set(1, 1.1, 0.6);
      const hl = new THREE.Mesh(hlGeo, S.whiteMat);
      hl.position.set(0.022, 0.03, 0.062);
      eye.add(white, pupil, hl);
      this.body.add(eye);
      this.eyes.push(eye);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), S.cheekMat);
      cheek.position.set(sx * 0.25, 0.21, 0.36);
      cheek.scale.set(1.2, 0.7, 0.35);
      cheek.lookAt(cheek.position.clone().multiplyScalar(2));
      this.body.add(cheek);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 20, Math.PI), S.blackMat);
    smile.position.set(0, 0.21, 0.405);
    smile.rotation.z = Math.PI;
    this.body.add(smile);
    this.smile = smile;

    // party hat
    const hat = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.34, 32, 1, true), S.hatMat);
    cone.position.y = 0.17;
    cone.castShadow = shadows;
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), S.pomMat);
    pom.position.y = 0.35;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.02, 8, 32), S.pomMat);
    rim.rotation.x = Math.PI / 2;
    hat.add(cone, pom, rim);
    hat.position.set(0.02, 0.96, 0);
    hat.rotation.z = -0.18;
    this.body.add(hat);
    this.hat = hat;

    // arms with white gloves
    this.arms = [];
    const armGeo = new THREE.CapsuleGeometry(0.04, 0.14, 4, 10);
    armGeo.translate(0, -0.09, 0);
    const handGeo = new THREE.SphereGeometry(0.06, 16, 12);
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.42, 0.32, 0);
      const arm = new THREE.Mesh(armGeo, S.limbMat);
      const hand = new THREE.Mesh(handGeo, S.whiteMat);
      hand.position.y = -0.2;
      arm.castShadow = hand.castShadow = shadows;
      pivot.add(arm, hand);
      pivot.rotation.z = sx * 0.5;
      this.body.add(pivot);
      this.arms.push(pivot);
    }

    // legs + shoes
    this.legs = [];
    const legGeo = new THREE.CapsuleGeometry(0.045, 0.07, 4, 8);
    legGeo.translate(0, -0.06, 0);
    const shoeGeo = new THREE.SphereGeometry(0.075, 16, 12);
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.13, 0.15, 0);
      const leg = new THREE.Mesh(legGeo, S.limbMat);
      const shoe = new THREE.Mesh(shoeGeo, S.shoeMat);
      shoe.position.set(0, -0.12, 0.03);
      shoe.scale.set(1, 0.6, 1.35);
      leg.castShadow = shoe.castShadow = shadows;
      pivot.add(leg, shoe);
      this.group.add(pivot);
      this.legs.push(pivot);
    }

    this.state = 'idle';
    this.t = rand(0, 10);
    this.runPhase = 0;
    this.runSpeed = 12;
    this.blinkTimer = rand(1, 4);
    this.squash = 0; // impulse for landing squash
    this.squashV = 0;
  }

  setState(s) {
    this.state = s;
  }

  bounce(amount = 0.3) {
    this.squashV -= amount * 8;
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    const [la, ra] = this.arms;
    const [ll, rl] = this.legs;

    // blink
    this.blinkTimer -= dt;
    let blink = 1;
    if (this.blinkTimer < 0.12) blink = 0.12;
    if (this.blinkTimer < 0) this.blinkTimer = rand(1.8, 4.5);
    for (const e of this.eyes) e.scale.y = THREE.MathUtils.lerp(e.scale.y, blink, Math.min(1, dt * 30));

    // spring squash
    this.squashV += (-this.squash * 160 - this.squashV * 12) * dt;
    this.squash += this.squashV * dt;

    let bob = 0, sy = 1, tilt = 0, roll = 0;
    switch (this.state) {
      case 'run': {
        this.runPhase += dt * this.runSpeed;
        const s = Math.sin(this.runPhase);
        ll.rotation.x = s * 0.9;
        rl.rotation.x = -s * 0.9;
        la.rotation.x = -s * 0.9;
        ra.rotation.x = s * 0.9;
        la.rotation.z = -0.35;
        ra.rotation.z = 0.35;
        bob = Math.abs(Math.cos(this.runPhase)) * 0.06;
        tilt = 0.12;
        roll = Math.sin(this.runPhase) * 0.04;
        break;
      }
      case 'jump':
        ll.rotation.x = -0.7;
        rl.rotation.x = 0.3;
        la.rotation.set(0, 0, -2.4);
        ra.rotation.set(0, 0, 2.4);
        tilt = 0.05;
        break;
      case 'slide':
        sy = 0.55;
        ll.rotation.x = rl.rotation.x = -1.2;
        la.rotation.set(-1.2, 0, -0.6);
        ra.rotation.set(-1.2, 0, 0.6);
        tilt = -0.15;
        break;
      case 'wave':
        la.rotation.set(0, 0, -0.45 + Math.sin(t * 2) * 0.05);
        ra.rotation.set(0, 0, 2.5 + Math.sin(t * 11) * 0.45);
        ll.rotation.x = rl.rotation.x = 0;
        sy = 1 + Math.sin(t * 4) * 0.025;
        roll = Math.sin(t * 2) * 0.05;
        break;
      case 'cheer': {
        const h = Math.abs(Math.sin(t * 7));
        bob = h * 0.18;
        la.rotation.set(0, 0, -2.6 + Math.sin(t * 14) * 0.3);
        ra.rotation.set(0, 0, 2.6 - Math.sin(t * 14) * 0.3);
        ll.rotation.x = -h * 0.4;
        rl.rotation.x = -h * 0.4;
        break;
      }
      case 'worried':
        la.rotation.set(-0.3, 0, -2.0 + Math.sin(t * 20) * 0.08);
        ra.rotation.set(-0.3, 0, 2.0 - Math.sin(t * 20) * 0.08);
        roll = Math.sin(t * 18) * 0.03;
        break;
      case 'dizzy':
        roll = Math.sin(t * 6) * 0.25;
        la.rotation.set(0, 0, -1.2 + Math.sin(t * 6) * 0.4);
        ra.rotation.set(0, 0, 1.2 + Math.sin(t * 6) * 0.4);
        break;
      default: // idle
        la.rotation.set(0, 0, -0.45 + Math.sin(t * 2) * 0.08);
        ra.rotation.set(0, 0, 0.45 - Math.sin(t * 2) * 0.08);
        ll.rotation.x = rl.rotation.x = 0;
        sy = 1 + Math.sin(t * 3) * 0.03;
        break;
    }
    const sq = THREE.MathUtils.clamp(this.squash, -0.5, 0.5);
    const fy = sy * (1 + sq);
    const fxz = 1 / Math.sqrt(Math.max(0.2, fy));
    this.body.scale.set(fxz, fy, fxz);
    this.body.position.y = 0.14 + bob;
    this.body.rotation.x = tilt;
    this.body.rotation.z = roll;
    this.hat.rotation.z = -0.18 + Math.sin(t * 5) * 0.06;
  }
}
