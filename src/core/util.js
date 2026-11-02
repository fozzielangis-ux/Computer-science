import * as THREE from 'three';

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutElastic = (t) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// A bright, happy palette used all over the party.
export const PARTY_COLORS = [
  0xff3d8b, // hot pink
  0xffb21e, // marigold
  0x2fc6ff, // sky
  0x9a55ff, // violet
  0x2bd98f, // mint
  0xff6a3d, // coral
  0xff7ad1, // bubblegum
  0x5a7bff, // periwinkle
];

export const FOIL_COLORS = {
  gold: 0xffc75a,
  rose: 0xf7a0a8,
  pink: 0xff6fb8,
  purple: 0xb07bff,
  teal: 0x52e3d9,
  silver: 0xe8ecf5,
  blue: 0x6fb2ff,
};

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function canvasTexture(w, h, draw, { srgb = true, repeat = null, anisotropy = 8, mipmaps = true } = {}) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = mipmaps;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

let _softDot = null;
// Soft round sprite texture used for glows, bokeh and sparkles.
export function softDotTexture() {
  if (_softDot) return _softDot;
  _softDot = canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.25)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }, { srgb: false });
  return _softDot;
}

let _bokeh = null;
// Out-of-focus light disc (bright rim, soft middle) for dreamy backgrounds.
export function bokehTexture() {
  if (_bokeh) return _bokeh;
  _bokeh = canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.72, 'rgba(255,255,255,0.7)');
    grd.addColorStop(0.86, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.95, 'rgba(255,255,255,0.3)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }, { srgb: false });
  return _bokeh;
}

let _sparkle = null;
// Four-point star sparkle.
export function sparkleTexture() {
  if (_sparkle) return _sparkle;
  _sparkle = canvasTexture(128, 128, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.15, 'rgba(255,255,255,0.6)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.08)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    for (const [sx, sy] of [[1, 0.06], [0.06, 1]]) {
      const lg = g.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
      lg.addColorStop(0, 'rgba(255,255,255,1)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.save();
      g.translate(cx, cy);
      g.scale(sx, sy);
      g.fillStyle = lg;
      g.beginPath();
      g.arc(0, 0, w / 2, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }, { srgb: false });
  return _sparkle;
}

// Choose a vertical FOV so that at least `minHFovDeg` of horizontal view is
// always visible (important for tall phone screens).
export function fitFov(baseFovDeg, aspect, minHFovDeg) {
  const minH = THREE.MathUtils.degToRad(minHFovDeg);
  const needV = 2 * Math.atan(Math.tan(minH / 2) / aspect);
  return Math.max(baseFovDeg, THREE.MathUtils.radToDeg(needV));
}

// A catenary-ish sagging curve between two points (for strings of lights / bunting).
export function sagCurve(a, b, sag, segments = 32) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}

// Gradient sky dome material.
export function skyMaterial(stops, { exponent = 1, stars = 0 } = {}) {
  // stops: [[t, color], ...] where t from -1 (bottom) to 1 (top) of view direction y
  const n = stops.length;
  const colors = stops.map((s) => new THREE.Color(s[1]));
  const ts = stops.map((s) => s[0]);
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uColors: { value: colors },
      uTs: { value: ts },
      uExp: { value: exponent },
      uStars: { value: stars },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColors[${n}];
      uniform float uTs[${n}];
      uniform float uExp;
      uniform float uStars;
      uniform float uTime;
      varying vec3 vDir;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main() {
        float y = sign(vDir.y) * pow(abs(vDir.y), uExp);
        vec3 col = uColors[0];
        for (int i = 1; i < ${n}; i++) {
          float t = clamp((y - uTs[i - 1]) / max(uTs[i] - uTs[i - 1], 1e-4), 0.0, 1.0);
          t = t * t * (3.0 - 2.0 * t);
          col = mix(col, uColors[i], step(uTs[i - 1], y) * t);
        }
        if (uStars > 0.0) {
          vec3 d = normalize(vDir) * 260.0;
          vec3 cell = floor(d);
          float h = hash(cell);
          vec3 f = fract(d) - 0.5;
          float star = smoothstep(0.12, 0.0, length(f)) * step(0.985, h) * smoothstep(0.0, 0.25, vDir.y);
          float tw = 0.6 + 0.4 * sin(uTime * (1.5 + h * 4.0) + h * 40.0);
          col += vec3(1.0, 0.95, 0.9) * star * tw * uStars * 2.5;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => m.dispose());
    }
  });
}

export function formatNumber(n) {
  return Math.round(n).toLocaleString('en-US');
}
