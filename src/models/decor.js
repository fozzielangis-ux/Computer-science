import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, PARTY_COLORS, sagCurve, bokehTexture, softDotTexture, rand, pick } from '../core/util.js';

// ---------- Bunting (pennant flags), optionally spelling out a message ----------
const _pennantTex = new Map();
function pennantTexture(letter, color) {
  const key = letter + color;
  if (_pennantTex.has(key)) return _pennantTex.get(key);
  const tex = canvasTexture(128, 160, (g, w, h) => {
    const c = '#' + new THREE.Color(color).getHexString();
    g.fillStyle = c;
    g.fillRect(0, 0, w, h);
    // little polka dots
    g.fillStyle = 'rgba(255,255,255,0.22)';
    for (let y = 10; y < h; y += 26) for (let x = (y / 26) % 2 ? 10 : 23; x < w; x += 26) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
    // folded top band
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(0, 0, w, 12);
    if (letter && letter !== ' ') {
      g.font = '700 74px Fredoka, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 8;
      g.strokeStyle = 'rgba(0,0,0,0.18)';
      g.strokeText(letter, w / 2, h * 0.36);
      g.fillStyle = '#ffffff';
      g.fillText(letter, w / 2, h * 0.36);
    }
  });
  _pennantTex.set(key, tex);
  return tex;
}

export function createBunting(a, b, { sag = 0.6, text = null, count = 14, size = 0.42, colors = PARTY_COLORS, stringColor = 0xffffff } = {}) {
  const group = new THREE.Group();
  const curve = sagCurve(a, b, sag, 40);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.012, 5, false), new THREE.MeshStandardMaterial({ color: stringColor, roughness: 0.8 }));
  group.add(tube);
  const chars = text ? Array.from(text) : new Array(count).fill('');
  const n = chars.length;
  const tri = new THREE.BufferGeometry();
  const w = size, h = size * 1.25;
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, 0, 0, w / 2, 0, 0, 0, -h, 0], 3));
  tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
  tri.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  const flags = [];
  let ci = 0;
  for (let i = 0; i < n; i++) {
    if (text && chars[i] === ' ') continue;
    const t = (i + 0.5) / n;
    const p = curve.getPointAt(t);
    const color = colors[ci++ % colors.length];
    const mat = new THREE.MeshStandardMaterial({ map: pennantTexture(chars[i], color), side: THREE.DoubleSide, roughness: 0.75 });
    const flag = new THREE.Mesh(tri, mat);
    flag.position.copy(p);
    flag.castShadow = true;
    flag.userData.phase = rand(0, Math.PI * 2);
    group.add(flag);
    flags.push(flag);
  }
  group.userData.update = (t) => {
    for (const f of flags) f.rotation.x = Math.sin(t * 1.6 + f.userData.phase) * 0.12;
  };
  return group;
}

// ---------- String of glowing fairy lights ----------
export function createStringLights(a, b, { sag = 0.8, count = 18, bulbSize = 0.06, colors = [0xffd27a, 0xff7ac0, 0x7fe0ff, 0xb3ff9a, 0xfff2d0], intensity = 6, wireColor = 0x2a2238 } = {}) {
  const group = new THREE.Group();
  const curve = sagCurve(a, b, sag, 40);
  const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.008, 4, false), new THREE.MeshStandardMaterial({ color: wireColor, roughness: 0.6 }));
  group.add(wire);
  const bulbGeo = new THREE.SphereGeometry(bulbSize, 12, 10);
  bulbGeo.scale(1, 1.3, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const bulbs = new THREE.InstancedMesh(bulbGeo, mat, count);
  const base = [];
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const p = curve.getPointAt((i + 0.5) / count);
    m.makeTranslation(p.x, p.y - bulbSize * 1.2, p.z);
    bulbs.setMatrixAt(i, m);
    const c = new THREE.Color(colors[i % colors.length]);
    base.push({ c, phase: rand(0, Math.PI * 2), speed: rand(1.5, 3.5) });
    bulbs.setColorAt(i, c.clone().multiplyScalar(intensity));
  }
  group.add(bulbs);
  // soft glow halos
  const halos = [];
  const haloMat = new THREE.SpriteMaterial({ map: softDotTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 });
  for (let i = 0; i < count; i++) {
    const p = curve.getPointAt((i + 0.5) / count);
    const s = new THREE.Sprite(haloMat.clone());
    s.material.color.copy(base[i].c);
    s.position.set(p.x, p.y - bulbSize * 1.2, p.z);
    s.scale.setScalar(bulbSize * 7);
    group.add(s);
    halos.push(s);
  }
  const tmp = new THREE.Color();
  group.userData.update = (t) => {
    for (let i = 0; i < count; i++) {
      const b = base[i];
      const k = 0.65 + 0.35 * Math.sin(t * b.speed + b.phase);
      bulbs.setColorAt(i, tmp.copy(b.c).multiplyScalar(intensity * k));
      halos[i].material.opacity = 0.22 + 0.2 * k;
    }
    bulbs.instanceColor.needsUpdate = true;
  };
  return group;
}

// ---------- Gift box with ribbon & bow ----------
const _giftTex = new Map();
function giftPaper(color, pattern) {
  const key = color + pattern;
  if (_giftTex.has(key)) return _giftTex.get(key);
  const tex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#' + new THREE.Color(color).getHexString();
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    if (pattern === 0) {
      for (let y = 16; y < h; y += 40) for (let x = (y / 40) % 2 ? 16 : 36; x < w; x += 40) { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
    } else if (pattern === 1) {
      g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 4);
      for (let i = -10; i < 10; i++) g.fillRect(-w, i * 30, w * 2, 11);
      g.restore();
    } else {
      g.font = '700 34px sans-serif';
      g.textAlign = 'center';
      for (let y = 30; y < h; y += 56) for (let x = (y / 56) % 2 ? 30 : 58; x < w + 20; x += 56) g.fillText('★', x, y + 10);
    }
  }, { repeat: [1, 1] });
  _giftTex.set(key, tex);
  return tex;
}

export function createGiftBox({ w = 0.6, h = 0.5, d = 0.6, color = pick(PARTY_COLORS), ribbon = 0xffffff, pattern = Math.floor(rand(0, 3)), shadows = true } = {}) {
  const group = new THREE.Group();
  const boxMat = new THREE.MeshPhysicalMaterial({ map: giftPaper(color, pattern), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const box = new THREE.Mesh(new RoundedBoxGeometry(w, h * 0.82, d, 3, 0.025), boxMat);
  box.position.y = h * 0.41;
  const lid = new THREE.Mesh(new RoundedBoxGeometry(w * 1.06, h * 0.2, d * 1.06, 3, 0.025), boxMat);
  lid.position.y = h * 0.86;
  box.castShadow = lid.castShadow = shadows;
  box.receiveShadow = lid.receiveShadow = true;
  group.add(box, lid);
  const ribMat = new THREE.MeshPhysicalMaterial({ color: ribbon, roughness: 0.25, metalness: 0.3, clearcoat: 1, sheen: 1, sheenColor: 0xffffff });
  const rw = Math.min(w, d) * 0.16;
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(w * 1.075, h * 1.0, rw), ribMat);
  r1.position.y = h * 0.5;
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(rw, h * 1.0, d * 1.075), ribMat);
  r2.position.y = h * 0.5;
  group.add(r1, r2);
  // bow: two loops + knot
  const loopGeo = new THREE.TorusGeometry(rw * 1.1, rw * 0.32, 10, 24);
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(loopGeo, ribMat);
    loop.position.set(s * rw * 1.0, h * 0.96 + rw * 0.9, 0);
    loop.rotation.set(0, s * 0.35, s * 0.6);
    loop.scale.set(1, 0.75, 0.6);
    loop.castShadow = shadows;
    group.add(loop);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(rw * 0.55, 12, 10), ribMat);
  knot.position.y = h * 0.97 + rw * 0.3;
  group.add(knot);
  group.userData = { w, h, d, lid };
  return group;
}

// ---------- Dreamy out-of-focus background lights ----------
export function createBokeh({ count = 40, center = new THREE.Vector3(0, 3, -12), spread = new THREE.Vector3(20, 8, 4), sizeMin = 0.6, sizeMax = 2.2, colors = [0xffc46b, 0xff7ac0, 0x7fd8ff, 0xb68cff, 0xfff1c9], opacity = 0.35 } = {}) {
  const group = new THREE.Group();
  const items = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({ map: bokehTexture(), color: pick(colors), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: opacity * rand(0.5, 1), fog: false });
    const s = new THREE.Sprite(mat);
    s.position.set(center.x + rand(-1, 1) * spread.x, center.y + rand(-1, 1) * spread.y, center.z + rand(-1, 1) * spread.z);
    const size = rand(sizeMin, sizeMax);
    s.scale.setScalar(size);
    s.userData = { base: s.position.clone(), phase: rand(0, 6.28), speed: rand(0.2, 0.6), op: mat.opacity };
    group.add(s);
    items.push(s);
  }
  group.userData.update = (t) => {
    for (const s of items) {
      const u = s.userData;
      s.position.x = u.base.x + Math.sin(t * u.speed + u.phase) * 0.3;
      s.position.y = u.base.y + Math.cos(t * u.speed * 0.8 + u.phase) * 0.25;
      s.material.opacity = u.op * (0.75 + 0.25 * Math.sin(t * u.speed * 3 + u.phase));
    }
  };
  return group;
}

// ---------- Round party table with a tablecloth ----------
export function createTable({ radius = 2.2, height = 1.0, cloth = 0xfff4fa, trim = 0xff7ac0 } = {}) {
  const group = new THREE.Group();
  const clothTex = canvasTexture(512, 64, (g, w, h) => {
    g.fillStyle = '#' + new THREE.Color(cloth).getHexString();
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#' + new THREE.Color(trim).getHexString();
    for (let i = 0; i < 32; i++) {
      g.beginPath();
      g.arc((i + 0.5) * (w / 32), h, w / 64, Math.PI, 0);
      g.fill();
    }
    g.fillRect(0, h - 6, w, 6);
  });
  // tablecloth with gentle folds
  const pts = [];
  pts.push(new THREE.Vector2(0.001, height + 0.02));
  pts.push(new THREE.Vector2(radius, height + 0.02));
  pts.push(new THREE.Vector2(radius + 0.04, height - 0.02));
  pts.push(new THREE.Vector2(radius + 0.06, height * 0.55));
  pts.push(new THREE.Vector2(radius + 0.18, 0.02));
  pts.push(new THREE.Vector2(radius + 0.17, 0.0));
  const geo = new THREE.LatheGeometry(pts, 96);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r > radius + 0.03 && y < height - 0.05) {
      const a = Math.atan2(x, z);
      const k = 1 + 0.02 * Math.sin(a * 22) * (1 - y / height);
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
  }
  geo.computeVertexNormals();
  // UVs: map the side band to the trim texture
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const y = p.getY(i);
    uv.setY(i, 1 - Math.min(1, y / height) * 0.98);
  }
  const mat = new THREE.MeshPhysicalMaterial({ map: clothTex, roughness: 0.85, sheen: 1, sheenColor: 0xffffff, sheenRoughness: 0.6, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  group.add(mesh);
  // top surface (separate so it receives clean shadows)
  const top = new THREE.Mesh(new THREE.CircleGeometry(radius + 0.02, 72), new THREE.MeshPhysicalMaterial({ color: cloth, roughness: 0.9, sheen: 1, sheenColor: 0xffffff }));
  top.rotation.x = -Math.PI / 2;
  top.position.y = height + 0.021;
  top.receiveShadow = true;
  group.add(top);
  group.userData.topY = height + 0.022;
  return group;
}

// ---------- Cake stand / plate ----------
export function createCakeStand({ radius = 1.4, height = 0.35 } = {}) {
  const pts = [
    [0.001, 0], [radius * 0.45, 0], [radius * 0.47, 0.03], [radius * 0.2, 0.07], [radius * 0.12, height * 0.5], [radius * 0.14, height - 0.06],
    [radius * 0.98, height - 0.04], [radius, height], [radius * 0.96, height + 0.02], [0.001, height + 0.015],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, 72);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.2 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.topY = height + 0.015;
  return mesh;
}

// ---------- Lollipop & candy cane (for the candy-land runner) ----------
export function createLollipop({ size = 1, colors = [0xff4fa3, 0xffffff] } = {}) {
  const group = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * size, 0.06 * size, 2.4 * size, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  stick.position.y = 1.2 * size;
  group.add(stick);
  const tex = canvasTexture(256, 256, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    g.fillStyle = '#' + new THREE.Color(colors[1]).getHexString();
    g.fillRect(0, 0, w, h);
    g.lineWidth = 22;
    g.strokeStyle = '#' + new THREE.Color(colors[0]).getHexString();
    g.beginPath();
    for (let a = 0; a < Math.PI * 9; a += 0.05) {
      const r = (a / (Math.PI * 9)) * (w / 2);
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.stroke();
  });
  const candyMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.8 * size, 0.8 * size, 0.28 * size, 40), [
    new THREE.MeshPhysicalMaterial({ color: colors[0], roughness: 0.15, clearcoat: 1 }), candyMat, candyMat,
  ]);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = 2.6 * size;
  disc.castShadow = true;
  group.add(disc);
  return group;
}

export function createCandyCane({ size = 1 } = {}) {
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push(new THREE.Vector3(0, (i / 12) * 2.2, 0));
  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    pts.push(new THREE.Vector3(0.35 - Math.cos(a) * 0.35, 2.2 + Math.sin(a) * 0.35, 0));
  }
  pts.push(new THREE.Vector3(0.7, 2.0, 0));
  const curve = new THREE.CatmullRomCurve3(pts);
  const tex = canvasTexture(64, 512, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff3355';
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(-0.9);
    for (let i = -30; i < 30; i++) g.fillRect(-w * 4, i * 26, w * 8, 11);
    g.restore();
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  const geo = new THREE.TubeGeometry(curve, 80, 0.11, 12, false);
  const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.2, clearcoat: 1 }));
  mesh.scale.setScalar(size);
  mesh.castShadow = true;
  return mesh;
}

// ---------- Pleated paper fan / rosette for walls ----------
export function createPaperFan({ radius = 0.8, color = 0xff7ad1, pleats = 28, center = 0xffffff } = {}) {
  const group = new THREE.Group();
  const segs = pleats * 2;
  const geo = new THREE.CircleGeometry(radius, segs, 0, Math.PI * 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const r = Math.hypot(x, y);
    if (r < 1e-4) continue;
    const a = Math.atan2(y, x);
    // zig-zag folds that get deeper towards the rim
    const fold = Math.abs(((a / (Math.PI * 2)) * pleats * 2) % 2 - 1);
    p.setZ(i, (fold - 0.5) * 0.14 * (r / radius));
  }
  geo.computeVertexNormals();
  const c = new THREE.Color(color);
  const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, side: THREE.DoubleSide, flatShading: true });
  const fan = new THREE.Mesh(geo, mat);
  fan.castShadow = true;
  fan.receiveShadow = true;
  group.add(fan);
  const mid = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.22, 32), new THREE.MeshStandardMaterial({ color: center, roughness: 0.6 }));
  mid.position.z = 0.08;
  group.add(mid);
  return group;
}
