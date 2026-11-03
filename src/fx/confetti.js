import * as THREE from 'three';
import { PARTY_COLORS, rand } from '../core/util.js';

// Fluttering paper confetti using a single InstancedMesh.
// Each piece tumbles, catches the light, drifts and settles.
export class Confetti {
  constructor(scene, { max = 1500, size = 1, floorY = -Infinity, colors = PARTY_COLORS } = {}) {
    this.max = max;
    this.floorY = floorY;
    this.colors = colors;
    const geo = new THREE.PlaneGeometry(0.055 * size, 0.1 * size);
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.45, metalness: 0.25, envMapIntensity: 1.2 });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, white);
    scene.add(this.mesh);
    this.p = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._c = new THREE.Color();
    this._rainAcc = 0;
    this.rain = null;
  }

  _spawn(pos, vel, color, life) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({
      x: pos.x, y: pos.y, z: pos.z,
      vx: vel.x, vy: vel.y, vz: vel.z,
      rx: rand(0, 6.28), ry: rand(0, 6.28), rz: rand(0, 6.28),
      sx: rand(-9, 9), sy: rand(-6, 6), sz: rand(-9, 9),
      ph: rand(0, 6.28),
      life, age: 0,
      color: this._c.set(color).clone(),
      landed: false,
    });
  }

  burst(pos, { count = 80, speed = 5, colors = this.colors, up = 2, spread = 1, life = 3.2, dir = null } = {}) {
    for (let i = 0; i < count; i++) {
      let v;
      if (dir) {
        v = new THREE.Vector3(dir.x + rand(-spread, spread), dir.y + rand(-spread, spread), dir.z + rand(-spread, spread)).normalize().multiplyScalar(speed * rand(0.5, 1.15));
      } else {
        v = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.35, 1));
        v.y += up;
      }
      this._spawn(pos, v, colors[Math.floor(Math.random() * colors.length)], life * rand(0.7, 1.2));
    }
  }

  // Continuous rain of confetti over an area.
  setRain(rate, box = { x: [-6, 6], y: 7, z: [-4, 2] }) {
    this.rain = rate > 0 ? { rate, box } : null;
  }

  update(dt) {
    if (this.rain) {
      this._rainAcc += dt * this.rain.rate;
      const b = this.rain.box;
      while (this._rainAcc > 1) {
        this._rainAcc -= 1;
        this._spawn(new THREE.Vector3(rand(b.x[0], b.x[1]), b.y + rand(0, 1), rand(b.z[0], b.z[1])), new THREE.Vector3(rand(-0.3, 0.3), -rand(0.2, 0.8), 0), this.colors[Math.floor(Math.random() * this.colors.length)], 9);
      }
    }
    const p = this.p;
    const m = this._m, q = this._q, e = this._e, s = this._s;
    let n = 0;
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      c.age += dt;
      if (c.age > c.life) continue;
      if (!c.landed) {
        // air drag & flutter
        const drag = Math.exp(-dt * 2.6);
        c.vx *= drag;
        c.vz *= drag;
        c.vy = c.vy * Math.exp(-dt * 1.4) - 5.5 * dt;
        if (c.vy < -1.4) c.vy = -1.4 + (c.vy + 1.4) * 0.5;
        c.ph += dt * 6;
        c.x += (c.vx + Math.sin(c.ph) * 0.35) * dt;
        c.y += c.vy * dt;
        c.z += (c.vz + Math.cos(c.ph * 0.7) * 0.25) * dt;
        c.rx += c.sx * dt;
        c.ry += c.sy * dt;
        c.rz += c.sz * dt;
        if (c.y < this.floorY) {
          c.y = this.floorY + 0.002;
          c.landed = true;
          c.rx = -Math.PI / 2;
          c.rz = 0;
          c.life = Math.min(c.life, c.age + 2.5);
        }
      }
      const fade = Math.min(1, (c.life - c.age) / 0.6);
      e.set(c.rx, c.ry, c.rz);
      q.setFromEuler(e);
      s.setScalar(Math.max(0.001, fade));
      m.compose(this._v.set(c.x, c.y, c.z), q, s);
      this.mesh.setMatrixAt(n, m);
      this.mesh.setColorAt(n, c.color);
      p[n] = c;
      n++;
    }
    p.length = n;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.p.length = 0;
    this.mesh.count = 0;
  }
}
