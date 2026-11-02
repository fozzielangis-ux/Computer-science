import * as THREE from 'three';
import { createBalloon } from './balloon.js';

const _up = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0);

// A balloon with a simulated (verlet) string.
//  - mode 'free':     you move the balloon; the string dangles naturally below it.
//  - mode 'tethered': the string end is tied to an anchor and the balloon floats on it.
export class BalloonOnString {
  constructor({ color = 0xff4fa3, scale = 0.5, length = 1.6, segments = 10, anchor = null, text = null, mesh = null, knotOffset = 1.24, lineColor = 0xffffff, lineOpacity = 0.75 } = {}) {
    this.scale = scale;
    this.mode = anchor ? 'tethered' : 'free';
    this.anchor = anchor ? anchor.clone() : null;
    this.group = mesh || createBalloon(color, { scale, text });
    this.knotOffset = knotOffset * scale;
    this.segLen = length / segments;
    this.n = segments + 1;
    this.pts = [];
    this.prev = [];
    for (let i = 0; i < this.n; i++) {
      this.pts.push(new THREE.Vector3());
      this.prev.push(new THREE.Vector3());
    }
    const geo = new THREE.BufferGeometry();
    this.linePos = new Float32Array(this.n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3));
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: lineOpacity }));
    this.line.frustumCulled = false;
    this.buoyancy = 4.0;
    this.wind = new THREE.Vector3();
    this.detached = false; // string falls away (after a pop)
    this.reset();
  }

  addTo(parent) {
    parent.add(this.group, this.line);
    return this;
  }

  removeFrom(parent) {
    parent.remove(this.group, this.line);
  }

  knotWorld(out = new THREE.Vector3()) {
    _up.set(0, 1, 0).applyQuaternion(this.group.quaternion);
    return out.copy(this.group.position).addScaledVector(_up, -this.knotOffset);
  }

  reset() {
    if (this.mode === 'tethered') {
      for (let i = 0; i < this.n; i++) {
        const t = i / (this.n - 1);
        this.pts[i].copy(this.anchor).add(new THREE.Vector3(0, (1 - t) * this.segLen * (this.n - 1), 0));
        this.prev[i].copy(this.pts[i]);
      }
      this._placeTethered();
    } else {
      const k = this.knotWorld(new THREE.Vector3());
      for (let i = 0; i < this.n; i++) {
        this.pts[i].copy(k).add(new THREE.Vector3(0, -i * this.segLen, 0));
        this.prev[i].copy(this.pts[i]);
      }
    }
    this.detached = false;
    this._writeLine();
  }

  _placeTethered() {
    // balloon sits above the first chain point, aligned with the string
    _up.subVectors(this.pts[0], this.pts[1]).normalize();
    _q.setFromUnitVectors(_Y, _up);
    this.group.quaternion.slerp(_q, 0.5);
    _up.set(0, 1, 0).applyQuaternion(this.group.quaternion);
    this.group.position.copy(this.pts[0]).addScaledVector(_up, this.knotOffset);
  }

  update(dt, t = 0) {
    const n = this.n;
    const dt2 = Math.min(dt, 1 / 30) ** 2;
    const pinFirst = !this.detached;
    if (this.mode === 'free' && pinFirst) this.knotWorld(this.pts[0]);
    for (let i = 0; i < n; i++) {
      if (i === 0 && pinFirst && this.mode === 'free') continue;
      if (i === n - 1 && this.mode === 'tethered' && !this.detached) continue;
      const p = this.pts[i], pr = this.prev[i];
      const vx = (p.x - pr.x) * 0.96, vy = (p.y - pr.y) * 0.96, vz = (p.z - pr.z) * 0.96;
      pr.copy(p);
      let ay = -9.8 * 0.35;
      let ax = 0, az = 0;
      if (i === 0 && this.mode === 'tethered' && !this.detached) {
        ay = this.buoyancy;
        ax = this.wind.x + Math.sin(t * 0.9 + this.anchor.x) * 0.6;
        az = this.wind.z + Math.cos(t * 0.7 + this.anchor.z) * 0.4;
      }
      p.x += vx + ax * dt2;
      p.y += vy + ay * dt2;
      p.z += vz + az * dt2;
    }
    if (this.mode === 'tethered' && !this.detached) this.pts[n - 1].copy(this.anchor);
    for (let it = 0; it < 6; it++) {
      for (let i = 0; i < n - 1; i++) {
        const a = this.pts[i], b = this.pts[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = (d - this.segLen) / d;
        let wa = 0.5, wb = 0.5;
        if (i === 0 && pinFirst && this.mode === 'free') { wa = 0; wb = 1; }
        if (i + 1 === n - 1 && this.mode === 'tethered' && !this.detached) { wa = 1; wb = 0; }
        a.x += dx * diff * wa; a.y += dy * diff * wa; a.z += dz * diff * wa;
        b.x -= dx * diff * wb; b.y -= dy * diff * wb; b.z -= dz * diff * wb;
      }
    }
    if (this.mode === 'tethered' && !this.detached) this._placeTethered();
    this._writeLine();
  }

  _writeLine() {
    for (let i = 0; i < this.n; i++) {
      this.linePos[i * 3] = this.pts[i].x;
      this.linePos[i * 3 + 1] = this.pts[i].y;
      this.linePos[i * 3 + 2] = this.pts[i].z;
    }
    this.line.geometry.attributes.position.needsUpdate = true;
  }
}
