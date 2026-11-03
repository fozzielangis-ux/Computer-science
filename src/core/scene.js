import * as THREE from 'three';

// Base class for every 3D scene in the game.
export class BaseScene {
  constructor(game) {
    this.game = game;
    this.engine = game.engine;
    this.ui = game.ui;
    this.scene = new THREE.Scene();
    this.scene.environment = game.envMap;
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 400);
    this.viewOpts = { bloom: { strength: 0.7, radius: 0.4, threshold: 2.4 }, exposure: 1.0, vignette: 0.32 };
    this.built = false;
    this.raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
  }

  build() {}
  enter() {}
  exit() {}
  update() {}
  resize() {}
  pointerDown() {}
  pointerMove() {}
  pointerUp() {}
  keyDown() {}

  rayFromEvent(ev) {
    this._ndc.set((ev.clientX / window.innerWidth) * 2 - 1, -(ev.clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this._ndc, this.camera);
    return this.raycaster.ray;
  }

  // world position → screen pixels
  toScreen(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight };
  }
}
