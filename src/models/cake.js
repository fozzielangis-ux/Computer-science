import * as THREE from 'three';
import { canvasTexture, PARTY_COLORS, rand } from '../core/util.js';

export const FLAVORS = [
  { name: 'Strawberry', sponge: 0xf59ab0, frosting: 0xffd3e2, piping: 0xff7aa8 },
  { name: 'Chocolate', sponge: 0x6e3b22, frosting: 0x4a2414, piping: 0xf3d9b8, glossy: true },
  { name: 'Vanilla', sponge: 0xf3dca6, frosting: 0xfff4de, piping: 0xffd36b },
  { name: 'Mint', sponge: 0xa9ead0, frosting: 0xe2fff2, piping: 0x55d6a4 },
  { name: 'Blueberry', sponge: 0xb9a3ff, frosting: 0xece4ff, piping: 0x8a6cff },
  { name: 'Lemon', sponge: 0xffe98a, frosting: 0xfffbe2, piping: 0xffc93c },
  { name: 'Red Velvet', sponge: 0xc4374a, frosting: 0xfff7f0, piping: 0xff5a7a },
];

let _crumbTex = null;
function crumbTexture() {
  if (_crumbTex) return _crumbTex;
  _crumbTex = canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) {
      const v = Math.floor(rand(205, 255));
      g.fillStyle = `rgba(${v},${v},${v},${rand(0.3, 0.9)})`;
      const r = rand(0.5, 2.6);
      g.beginPath();
      g.arc(rand(0, w), rand(0, h), r, 0, Math.PI * 2);
      g.fill();
    }
    // jam/cream line through the middle of the layer
    g.fillStyle = 'rgba(255,255,255,1)';
    g.fillRect(0, h * 0.47, w, h * 0.07);
  }, { repeat: [3, 1] });
  return _crumbTex;
}

// Frosting cap with organic drips running down the side.
export function dripFrostingGeometry(R, yTop, { thick = 0.06, dripMin = 0.04, dripMax = 0.24, drips = 11, segments = 120 } = {}) {
  const dripCenters = [];
  for (let k = 0; k < drips; k++) {
    dripCenters.push({ a: rand(0, Math.PI * 2), w: rand(0.12, 0.3), len: rand(dripMax * 0.35, dripMax) });
  }
  const dripLen = (a) => {
    let L = dripMin;
    for (const d of dripCenters) {
      let da = Math.abs(a - d.a);
      da = Math.min(da, Math.PI * 2 - da);
      if (da < d.w) {
        const x = da / d.w;
        const bump = Math.pow(Math.cos(x * Math.PI * 0.5), 1.6);
        L = Math.max(L, dripMin + (d.len - dripMin) * bump);
      }
    }
    // small wobble everywhere
    return L + Math.sin(a * 9) * 0.006 + Math.sin(a * 23) * 0.004;
  };

  // Profile (r, y) points from top centre, around the rounded lip, down the side.
  const profile = (L) => {
    const pts = [];
    const topY = yTop + thick;
    const rings = 5;
    for (let i = 0; i <= rings; i++) pts.push([(R - thick) * (i / rings), topY]);
    const arcN = 6;
    for (let i = 1; i <= arcN; i++) {
      const th = (i / arcN) * Math.PI * 0.5;
      pts.push([R - thick + Math.sin(th) * (thick * 1.6), yTop + Math.cos(th) * thick]);
    }
    const sideN = 7;
    const rOut = R + thick * 0.6;
    for (let i = 1; i <= sideN; i++) {
      const s = i / sideN;
      const y = yTop - L * s;
      const bulge = s > 0.75 ? Math.cos(((s - 0.75) / 0.25) * Math.PI * 0.5) : 1;
      pts.push([R + 0.004 + (rOut - R) * (0.55 + 0.45 * bulge) * (s > 0.92 ? 0.6 : 1), y]);
    }
    pts.push([R + 0.002, yTop - L - 0.012]);
    return pts;
  };

  const P = profile(0.1).length;
  const positions = [];
  const uvs = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const L = dripLen(a % (Math.PI * 2));
    const prof = profile(L);
    const sa = Math.sin(a), ca = Math.cos(a);
    for (let j = 0; j < P; j++) {
      const [r, y] = prof[j];
      positions.push(sa * r, y, ca * r);
      uvs.push(i / segments, j / (P - 1));
    }
  }
  const index = [];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < P - 1; j++) {
      const a = i * P + j, b = (i + 1) * P + j, c = (i + 1) * P + j + 1, d = i * P + j + 1;
      index.push(a, b, d, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

let _dollopGeo = null;
function dollopGeometry() {
  if (_dollopGeo) return _dollopGeo;
  const ctrl = [[0.001, 0], [0.09, 0.0], [0.1, 0.035], [0.075, 0.06], [0.07, 0.085], [0.045, 0.11], [0.03, 0.14], [0.001, 0.16]].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(new THREE.SplineCurve(ctrl).getPoints(24), 12);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(x, z);
    const k = 1 + 0.18 * Math.max(0, Math.cos(a * 6 + y * 40));
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  _dollopGeo = geo;
  return geo;
}

let _sprinkleGeo = null;
function sprinkleGeometry() {
  if (!_sprinkleGeo) _sprinkleGeo = new THREE.CapsuleGeometry(0.014, 0.055, 3, 6);
  return _sprinkleGeo;
}

const _sprinkleMat = new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });

// One round cake layer: sponge + drippy frosting + piping + sprinkles.
// Origin at the bottom centre of the layer.
export function createCakeLayer({ radius = 1, height = 0.4, flavor = FLAVORS[0], piping = true, sprinkles = 60, dripMax = 0.2, shadows = true } = {}) {
  const group = new THREE.Group();
  const spongeH = height;
  const spongeMat = new THREE.MeshStandardMaterial({ color: flavor.sponge, map: crumbTexture(), roughness: 0.85 });
  const sponge = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, spongeH, 72, 1, false), spongeMat);
  sponge.position.y = spongeH / 2;
  sponge.castShadow = shadows;
  sponge.receiveShadow = true;
  group.add(sponge);

  const frostMat = new THREE.MeshPhysicalMaterial({
    color: flavor.frosting,
    roughness: flavor.glossy ? 0.18 : 0.38,
    clearcoat: flavor.glossy ? 1 : 0.4,
    clearcoatRoughness: flavor.glossy ? 0.05 : 0.3,
    sheen: flavor.glossy ? 0 : 0.6,
    sheenColor: 0xffffff,
  });
  const thick = Math.min(0.07, radius * 0.06);
  const frost = new THREE.Mesh(dripFrostingGeometry(radius, spongeH, { thick, dripMax: Math.min(dripMax, spongeH * 0.7), dripMin: spongeH * 0.08 }), frostMat);
  frost.castShadow = shadows;
  frost.receiveShadow = true;
  group.add(frost);

  const topY = spongeH + thick;
  if (piping) {
    const n = Math.max(10, Math.round(radius * 18));
    const pipeMat = new THREE.MeshPhysicalMaterial({ color: flavor.piping, roughness: 0.4, clearcoat: 0.5, sheen: 0.5, sheenColor: 0xffffff });
    const inst = new THREE.InstancedMesh(dollopGeometry(), pipeMat, n);
    const m = new THREE.Matrix4();
    const s = Math.min(1.4, 0.7 + radius * 0.5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = radius - thick * 1.4 - 0.05 * s;
      m.makeRotationY(a * 3);
      m.scale(new THREE.Vector3(s, s, s));
      m.setPosition(Math.sin(a) * r, topY - 0.01, Math.cos(a) * r);
      inst.setMatrixAt(i, m);
    }
    inst.castShadow = shadows;
    group.add(inst);
  }
  if (sprinkles > 0) {
    const inst = new THREE.InstancedMesh(sprinkleGeometry(), _sprinkleMat, sprinkles);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const c = new THREE.Color();
    for (let i = 0; i < sprinkles; i++) {
      const rr = Math.sqrt(Math.random()) * (radius - thick * 2.5 - (piping ? 0.12 : 0));
      const a = rand(0, Math.PI * 2);
      e.set(Math.PI / 2, 0, rand(0, Math.PI * 2));
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(Math.sin(a) * rr, topY + 0.012, Math.cos(a) * rr), q, new THREE.Vector3(1, 1, 1));
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, c.set(PARTY_COLORS[i % PARTY_COLORS.length]));
    }
    group.add(inst);
  }
  group.userData = { radius, height: topY, topY, flavor, frostMat, spongeMat };
  return group;
}

// Candle with a separate flame object returned for animation.
let _candleTex = null;
function candleTexture() {
  if (_candleTex) return _candleTex;
  _candleTex = canvasTexture(64, 256, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(-0.5);
    for (let i = -12; i < 12; i++) {
      g.fillStyle = '#ff5fa8';
      g.fillRect(-w * 2, i * 22, w * 4, 9);
    }
    g.restore();
  });
  return _candleTex;
}

export function createCandle({ height = 0.42, radius = 0.035, color = 0xffffff } = {}) {
  const group = new THREE.Group();
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 16),
    new THREE.MeshPhysicalMaterial({ color, map: candleTexture(), roughness: 0.35, clearcoat: 0.4 })
  );
  stick.position.y = height / 2;
  stick.castShadow = true;
  group.add(stick);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  wick.position.y = height + 0.02;
  group.add(wick);
  group.userData = { height, wickY: height + 0.045 };
  return group;
}
