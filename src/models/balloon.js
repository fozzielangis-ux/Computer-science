import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture } from '../core/util.js';

let _balloonGeo = null;
let _knotGeo = null;

// Classic latex balloon silhouette (unit size: ~1 wide, ~2.3 tall, knot at y = -1.15)
export function balloonGeometry() {
  if (_balloonGeo) return _balloonGeo;
  const pts = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const th = s * Math.PI;
    // pinch the bottom into a teardrop and keep the top round
    const pinch = 0.62 + 0.38 * Math.pow(Math.sin(Math.min(1, s * 1.35) * Math.PI * 0.5), 0.8);
    const r = Math.sin(th) * pinch;
    const y = -Math.cos(th) * 1.12 + (s < 0.5 ? 0 : 0);
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  // small neck going into the knot
  pts[0].set(0.035, -1.12);
  const geo = new THREE.LatheGeometry(pts, 48, -Math.PI, Math.PI * 2);
  geo.computeVertexNormals();
  _balloonGeo = geo;
  return geo;
}

export function knotGeometry() {
  if (_knotGeo) return _knotGeo;
  const pts = [
    new THREE.Vector2(0.001, -0.02),
    new THREE.Vector2(0.06, 0.0),
    new THREE.Vector2(0.11, -0.05),
    new THREE.Vector2(0.09, -0.11),
    new THREE.Vector2(0.04, -0.13),
    new THREE.Vector2(0.001, -0.135),
  ];
  _knotGeo = new THREE.LatheGeometry(pts, 16);
  _knotGeo.translate(0, -1.1, 0);
  return _knotGeo;
}

export function latexMaterial(color, { map = null } = {}) {
  const c = new THREE.Color(color);
  return new THREE.MeshPhysicalMaterial({
    color: map ? 0xffffff : c,
    map,
    roughness: 0.22,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    sheen: 0.6,
    sheenRoughness: 0.35,
    sheenColor: c.clone().lerp(new THREE.Color(0xffffff), 0.5),
    emissive: c.clone().multiplyScalar(0.12),
    envMapIntensity: 1.25,
  });
}

export function foilMaterial(color, { roughness = 0.2, envMapIntensity = 1.6 } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 1.0,
    roughness,
    clearcoat: 0.5,
    clearcoatRoughness: 0.12,
    envMapIntensity,
  });
}

// Latex balloon with a letter/text printed on it.
const _printTex = new Map();
export function printedBalloonTexture(text, color, { textColor = '#ffffff', font = 700 } = {}) {
  const key = text + '|' + color + '|' + textColor;
  if (_printTex.has(key)) return _printTex.get(key);
  const tex = canvasTexture(512, 256, (g, w, h) => {
    const c = new THREE.Color(color);
    g.fillStyle = '#' + c.getHexString();
    g.fillRect(0, 0, w, h);
    // subtle highlight banding so the texture isn't flat
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(0,0,0,0.12)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const size = text.length > 1 ? 96 : 150;
    g.font = `${font} ${size}px Fredoka, 'Trebuchet MS', sans-serif`;
    g.lineWidth = 12;
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    // printed letter sits at u = 0.5 (faces the camera), v ≈ 0.55
    const y = h * 0.42;
    g.save();
    g.translate(w / 2, y);
    g.scale(0.55, 1); // lathe u-span is wider than tall, compensate
    g.strokeText(text, 0, 0);
    g.fillStyle = textColor;
    g.fillText(text, 0, 0);
    g.restore();
  });
  _printTex.set(key, tex);
  return tex;
}

// A single balloon (body + knot). Returns a Group with userData.body.
export function createBalloon(color, { scale = 1, text = null, textColor } = {}) {
  const group = new THREE.Group();
  const map = text ? printedBalloonTexture(text, color, { textColor }) : null;
  const mat = latexMaterial(color, { map });
  const body = new THREE.Mesh(balloonGeometry(), mat);
  body.castShadow = true;
  const knot = new THREE.Mesh(knotGeometry(), mat);
  group.add(body, knot);
  group.scale.setScalar(scale);
  group.userData.body = body;
  group.userData.material = mat;
  return group;
}

// ---------- foil shapes ----------
let _heartGeo = null, _starGeo = null;

export function heartGeometry() {
  if (_heartGeo) return _heartGeo;
  const s = new THREE.Shape();
  const x = 0, y = 0;
  s.moveTo(x, y + 0.35);
  s.bezierCurveTo(x, y + 0.35, x - 0.05, y + 0.85, x - 0.5, y + 0.85);
  s.bezierCurveTo(x - 1.05, y + 0.85, x - 1.05, y + 0.2, x - 1.05, y + 0.2);
  s.bezierCurveTo(x - 1.05, y - 0.2, x - 0.65, y - 0.62, x, y - 1.0);
  s.bezierCurveTo(x + 0.65, y - 0.62, x + 1.05, y - 0.2, x + 1.05, y + 0.2);
  s.bezierCurveTo(x + 1.05, y + 0.2, x + 1.05, y + 0.85, x + 0.5, y + 0.85);
  s.bezierCurveTo(x + 0.05, y + 0.85, x, y + 0.35, x, y + 0.35);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.28, bevelSize: 0.16, bevelSegments: 8, curveSegments: 28 });
  geo.center();
  geo.computeVertexNormals();
  _heartGeo = geo;
  return geo;
}

export function starGeometry() {
  if (_starGeo) return _starGeo;
  const s = new THREE.Shape();
  const spikes = 5, outer = 1.0, inner = 0.48;
  for (let i = 0; i <= spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (spikes * 2)) * Math.PI * 2 + Math.PI / 2;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) s.moveTo(px, py);
    else s.lineTo(px, py);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.12, bevelSegments: 6, curveSegments: 4 });
  geo.center();
  geo.computeVertexNormals();
  _starGeo = geo;
  return geo;
}

let _cloudGeo = null;
export function cloudGeometry() {
  if (_cloudGeo) return _cloudGeo;
  const parts = [
    [0, 0.1, 0, 0.62], [-0.55, -0.05, 0.05, 0.45], [0.55, -0.02, 0.0, 0.48], [-0.25, 0.42, -0.05, 0.42],
    [0.3, 0.38, 0.0, 0.4], [0.0, -0.25, 0.15, 0.42], [-0.85, -0.2, 0, 0.3], [0.88, -0.18, 0, 0.32],
  ];
  const geos = parts.map(([x, y, z, r]) => {
    const g = new THREE.SphereGeometry(r, 24, 16);
    g.translate(x, y, z);
    return g;
  });
  _cloudGeo = mergeGeometries(geos);
  geos.forEach((g) => g.dispose());
  return _cloudGeo;
}

// A grumpy storm cloud balloon (avoid popping these!)
export function createStormCloud(scale = 1) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x8a90a8, roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.8, emissive: 0x1a1d2a });
  const body = new THREE.Mesh(cloudGeometry(), mat);
  body.castShadow = true;
  group.add(body);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1b1530, roughness: 0.3 });
  const eyeGeo = new THREE.SphereGeometry(0.075, 16, 12);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(sx * 0.2, 0.12, 0.6);
    eye.scale.set(1, 1.2, 0.6);
    group.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), eyeMat);
    brow.position.set(sx * 0.21, 0.27, 0.6);
    brow.rotation.z = sx * 0.45;
    group.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 16, Math.PI), eyeMat);
  mouth.position.set(0, -0.08, 0.62);
  group.add(mouth);
  // lightning bolt hanging below
  const bolt = new THREE.Shape();
  bolt.moveTo(0.05, 0);
  bolt.lineTo(-0.12, -0.3);
  bolt.lineTo(0.0, -0.3);
  bolt.lineTo(-0.08, -0.6);
  bolt.lineTo(0.16, -0.22);
  bolt.lineTo(0.03, -0.22);
  bolt.lineTo(0.15, 0);
  bolt.closePath();
  const boltGeo = new THREE.ExtrudeGeometry(bolt, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
  const boltMesh = new THREE.Mesh(boltGeo, new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffc000, emissiveIntensity: 1.6, roughness: 0.3 }));
  boltMesh.position.set(-0.02, -0.55, 0.1);
  group.add(boltMesh);
  group.scale.setScalar(scale);
  group.userData.body = body;
  group.userData.material = mat;
  return group;
}
