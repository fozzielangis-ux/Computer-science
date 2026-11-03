import * as THREE from 'three';
import { rand, pick } from '../core/util.js';
import { audio } from '../core/audio.js';

// GPU point sprites with additive glow. Used for sparkles, magic dust,
// firework bursts, rocket trails and candle embers.
export class GlowParticles {
  static pixelRatio = 1;

  constructor(scene, { max = 4000, sizeScale = 1 } = {}) {
    this.sizeScale = sizeScale;
    this.max = max;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: window.innerHeight * 0.5 * sizeScale * GlowParticles.pixelRatio } },
      vertexShader: /* glsl */`
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        uniform float uScale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(size * uScale / -mv.z, 1.0, 256.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d) * 2.0;
          float core = exp(-r * r * 9.0);
          float halo = exp(-r * r * 2.5) * 0.35;
          float a = (core + halo) * vAlpha * smoothstep(1.0, 0.7, r);
          gl_FragColor = vec4(vColor * a, a);
        }`,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this.geo = geo;
    this.list = [];
  }

  resize() {
    this.material.uniforms.uScale.value = window.innerHeight * 0.5 * this.sizeScale * GlowParticles.pixelRatio;
  }

  emit(o) {
    if (this.list.length >= this.max) return null;
    const p = {
      x: o.x, y: o.y, z: o.z,
      vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      r: o.r ?? 1, g: o.g ?? 1, b: o.b ?? 1,
      size: o.size ?? 0.1,
      life: o.life ?? 1,
      age: 0,
      drag: o.drag ?? 1,
      grav: o.grav ?? 0,
      twinkle: o.twinkle || 0,
      shrink: o.shrink ?? 1,
      trail: o.trail || 0,
      trailAcc: 0,
      fadeIn: o.fadeIn || 0,
    };
    this.list.push(p);
    return p;
  }

  // A quick burst of glittering sparkles.
  sparkle(pos, { count = 30, color = new THREE.Color(1, 0.9, 0.5), speed = 2.5, size = 0.12, life = 0.9, intensity = 3, grav = -2 } = {}) {
    const colors = Array.isArray(color) ? color : [color];
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.3, 1));
      const c = pick(colors);
      this.emit({ x: pos.x, y: pos.y, z: pos.z, vx: v.x, vy: v.y, vz: v.z, r: c.r * intensity, g: c.g * intensity, b: c.b * intensity, size: size * rand(0.6, 1.3), life: life * rand(0.6, 1.2), drag: 3, grav, twinkle: 0.5 });
    }
  }

  // Expanding ring of light on the ground/plane.
  ring(pos, { count = 40, color = new THREE.Color(1, 0.9, 0.6), speed = 3, size = 0.1, intensity = 3, axis = 'y' } = {}) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const vx = Math.cos(a) * speed, vz = Math.sin(a) * speed;
      this.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx, vy: axis === 'y' ? 0 : vz, vz: axis === 'y' ? vz : 0,
        r: color.r * intensity, g: color.g * intensity, b: color.b * intensity, size, life: 0.6, drag: 4,
      });
    }
  }

  update(dt) {
    this.resize();
    const L = this.list;
    let n = 0;
    const pos = this.pos, col = this.col, size = this.size, alpha = this.alpha;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d; p.vz *= d;
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.trail > 0) {
        p.trailAcc += dt * p.trail;
        while (p.trailAcc > 1 && L.length < this.max) {
          p.trailAcc -= 1;
          L.push({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, r: p.r * 0.6, g: p.g * 0.5, b: p.b * 0.4, size: p.size * 0.7, life: 0.5, age: 0, drag: 1, grav: -0.5, twinkle: 0.3, shrink: 1, trail: 0, trailAcc: 0, fadeIn: 0 });
        }
      }
      const t = p.age / p.life;
      let a = 1 - t;
      a = a * a * (3 - 2 * a) * (3 - 2 * a) * 0.6 + a * 0.4;
      if (p.fadeIn) a *= Math.min(1, p.age / p.fadeIn);
      if (p.twinkle) a *= 1 - p.twinkle + p.twinkle * (Math.random() < 0.5 ? 1 : 0.2);
      pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
      col[n * 3] = p.r; col[n * 3 + 1] = p.g; col[n * 3 + 2] = p.b;
      size[n] = p.size * (p.shrink ? 1 - t * 0.6 : 1);
      alpha[n] = a;
      L[n] = p;
      n++;
    }
    L.length = n;
    this.geo.setDrawRange(0, n);
    const at = this.geo.attributes;
    at.position.needsUpdate = at.color.needsUpdate = at.size.needsUpdate = at.alpha.needsUpdate = true;
  }

  clear() {
    this.list.length = 0;
    this.geo.setDrawRange(0, 0);
  }
}

const FW_COLORS = [
  [1.0, 0.35, 0.65], [1.0, 0.8, 0.3], [0.35, 0.8, 1.0], [0.7, 0.45, 1.0], [0.4, 1.0, 0.6], [1.0, 0.5, 0.25], [1.0, 1.0, 1.0],
];

// Fireworks show built on GlowParticles.
export class Fireworks {
  constructor(particles, { camera = null } = {}) {
    this.P = particles;
    this.rockets = [];
    this.camera = camera;
  }

  launch(x, z, { y0 = 0, height = rand(9, 13), type = null, color = null, delay = 0 } = {}) {
    this.rockets.push({ x, y: y0, z, vy: Math.sqrt(2 * 9 * height) * 0.92, vx: rand(-0.6, 0.6), vz: rand(-0.3, 0.3), type: type || pick(['peony', 'peony', 'ring', 'heart', 'willow', 'crackle', 'double']), color: color || pick(FW_COLORS), delay, launched: false, acc: 0 });
  }

  explode(x, y, z, type, color) {
    const P = this.P;
    const I = 4.6;
    const c2 = pick(FW_COLORS);
    let dist = 1;
    if (this.camera) dist = Math.max(1, this.camera.position.distanceTo(new THREE.Vector3(x, y, z)) / 14);
    audio.firework(dist);
    // flash
    P.emit({ x, y, z, r: 3, g: 2.6, b: 2.2, size: 3.0, life: 0.18, drag: 0 });
    const emit = (vx, vy, vz, col, o = {}) => P.emit({ x, y, z, vx, vy, vz, r: col[0] * I, g: col[1] * I, b: col[2] * I, size: o.size ?? 0.75, life: o.life ?? rand(1.5, 2.3), drag: o.drag ?? 1.35, grav: o.grav ?? -2.4, twinkle: o.twinkle ?? 0.15, trail: o.trail ?? 0 });
    if (type === 'ring') {
      const n = 90;
      const axis = new THREE.Vector3(rand(-0.4, 0.4), 1, rand(-0.4, 0.4)).normalize();
      const u = new THREE.Vector3(1, 0, 0).cross(axis).normalize();
      const w = axis.clone().cross(u).normalize();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const v = u.clone().multiplyScalar(Math.cos(a)).add(w.clone().multiplyScalar(Math.sin(a))).multiplyScalar(12);
        emit(v.x, v.y, v.z, color);
      }
      for (let i = 0; i < 40; i++) {
        const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(1, 3));
        emit(v.x, v.y, v.z, c2, { size: 0.55 });
      }
    } else if (type === 'heart') {
      const n = 110;
      // heart facing the camera (xy plane)
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        emit(hx * 0.75, hy * 0.75, rand(-0.3, 0.3), [1.0, 0.3, 0.55], { grav: -1.2, drag: 1.6, size: 0.85 });
      }
    } else if (type === 'willow') {
      for (let i = 0; i < 110; i++) {
        const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(8, 11));
        emit(v.x, v.y, v.z, [1.0, 0.75, 0.35], { life: rand(2.4, 3.2), drag: 2.2, grav: -3.2, trail: 22, size: 0.6 });
      }
    } else if (type === 'crackle') {
      for (let i = 0; i < 160; i++) {
        const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(5, 12));
        emit(v.x, v.y, v.z, Math.random() < 0.5 ? [1, 1, 0.85] : color, { twinkle: 0.85, size: 0.6 });
      }
    } else if (type === 'double') {
      for (let i = 0; i < 120; i++) {
        const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(12);
        emit(v.x, v.y, v.z, color);
      }
      for (let i = 0; i < 60; i++) {
        const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(6);
        emit(v.x, v.y, v.z, c2, { size: 0.6 });
      }
    } else {
      // peony: sphere with slight randomness
      for (let i = 0; i < 180; i++) {
        const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(10, 12.5));
        emit(v.x, v.y, v.z, Math.random() < 0.85 ? color : c2, { trail: Math.random() < 0.3 ? 8 : 0 });
      }
    }
  }

  update(dt) {
    const P = this.P;
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      if (r.delay > 0) {
        r.delay -= dt;
        continue;
      }
      if (!r.launched) {
        r.launched = true;
        audio.launch();
      }
      r.vy -= 9 * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.z += r.vz * dt;
      r.acc += dt * 70;
      while (r.acc > 1) {
        r.acc -= 1;
        P.emit({ x: r.x + rand(-0.03, 0.03), y: r.y, z: r.z, vx: rand(-0.3, 0.3), vy: rand(-1, 0), vz: rand(-0.3, 0.3), r: 3, g: 2.2, b: 1.2, size: 0.28, life: rand(0.3, 0.6), drag: 2, grav: -1, twinkle: 0.4 });
      }
      if (r.vy <= 1.2) {
        this.explode(r.x, r.y, r.z, r.type, r.color);
        this.rockets.splice(i, 1);
      }
    }
  }
}
