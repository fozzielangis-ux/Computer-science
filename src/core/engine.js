import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GlowParticles } from '../fx/particles.js';

// Final polish pass: vignette, a whisper of film grain, chromatic fringe at
// the edges and a full-screen flash used for big moments.
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.32 },
    uGrain: { value: 0.025 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uSaturation: { value: 1.08 },
    uAberration: { value: 0.0015 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uVignette, uGrain, uTime, uFlash, uSaturation, uAberration;
    uniform vec3 uFlashColor;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * r2 * uAberration * 8.0;
      vec4 c = texture2D(tDiffuse, vUv);
      c.r = texture2D(tDiffuse, vUv + off).r;
      c.b = texture2D(tDiffuse, vUv - off).b;
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSaturation);
      float v = smoothstep(0.95, 0.25, sqrt(r2) * 1.25);
      c.rgb *= mix(1.0 - uVignette, 1.0, v);
      c.rgb += (hash(vUv * 731.0 + fract(uTime) * 91.0) - 0.5) * uGrain;
      c.rgb = mix(c.rgb, uFlashColor, uFlash);
      gl_FragColor = vec4(c.rgb, 1.0);
    }`,
};

export class Engine {
  constructor(container) {
    this.container = container;
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer = renderer;
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.pixelRatio = this.maxPixelRatio;
    renderer.setPixelRatio(this.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const w = window.innerWidth, h = window.innerHeight;
    const rt = new THREE.WebGLRenderTarget(w * this.pixelRatio, h * this.pixelRatio, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);

    this.dummyScene = new THREE.Scene();
    this.dummyCamera = new THREE.PerspectiveCamera();
    this.renderPass = new RenderPass(this.dummyScene, this.dummyCamera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.7, 0.4, 2.4);
    this.outputPass = new OutputPass();
    this.finalPass = new ShaderPass(FinalShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
    this.composer.addPass(this.finalPass);

    this.scene = null;
    this.camera = null;
    this.flash = 0;
    this.flashDecay = 2.5;
    this.shake = 0;
    this._shakeOffset = new THREE.Vector3();

    // adaptive quality
    this._frames = 0;
    this._frameTime = 0;
    this._qualityTimer = 0;
    this._warmup = 1.5;
    this.lowQuality = false;

    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
  }

  setView(scene, camera, opts = {}) {
    this.scene = scene;
    this.camera = camera;
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    const b = opts.bloom || {};
    this.bloomPass.strength = b.strength ?? 0.7;
    this.bloomPass.radius = b.radius ?? 0.4;
    this.bloomPass.threshold = b.threshold ?? 2.4;
    this.renderer.toneMappingExposure = opts.exposure ?? 1.0;
    this.finalPass.uniforms.uVignette.value = opts.vignette ?? 0.32;
    this.finalPass.uniforms.uSaturation.value = opts.saturation ?? 1.08;
    this._warmup = 1.0;
    this.resize();
  }

  doFlash(strength = 0.8, color = 0xffffff, decay = 2.5) {
    this.flash = Math.max(this.flash, strength);
    this.flashDecay = decay;
    this.finalPass.uniforms.uFlashColor.value.set(color);
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  get aspect() {
    return window.innerWidth / window.innerHeight;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    GlowParticles.pixelRatio = this.pixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    if (this.camera) {
      this.onResize?.(w, h);
    }
  }

  setPixelRatio(pr) {
    pr = Math.max(0.6, Math.min(this.maxPixelRatio, pr));
    if (Math.abs(pr - this.pixelRatio) < 0.01) return;
    this.pixelRatio = pr;
    this.resize();
  }

  _adapt(dt) {
    if (this._warmup > 0) {
      this._warmup -= dt;
      this._frames = 0;
      this._frameTime = 0;
      return;
    }
    this._frames++;
    this._frameTime += dt;
    if (this._frameTime > 1.25) {
      const avg = this._frameTime / this._frames;
      if (avg > 1 / 42 && this.pixelRatio > 0.7) {
        this.setPixelRatio(this.pixelRatio - (avg > 1 / 25 ? 0.35 : 0.2));
        if (this.pixelRatio <= 1 && avg > 1 / 30 && !this.lowQuality) {
          this.lowQuality = true;
          this.bloomPass.resolution.set(256, 256);
        }
      } else if (avg < 1 / 58 && this.pixelRatio < this.maxPixelRatio) {
        this.setPixelRatio(this.pixelRatio + 0.1);
      }
      this._frames = 0;
      this._frameTime = 0;
      this._warmup = 0.4;
    }
  }

  render(dt, t) {
    if (!this.scene || !this.camera) return;
    this._adapt(dt);
    const u = this.finalPass.uniforms;
    u.uTime.value = t;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * this.flashDecay);
    u.uFlash.value = this.flash;

    // camera shake (applied temporarily around render)
    let shaken = false;
    if (this.shake > 0.001) {
      const s = this.shake * this.shake * 0.25;
      this._shakeOffset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0);
      this.camera.position.add(this._shakeOffset);
      shaken = true;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
    this.composer.render(dt);
    if (shaken) this.camera.position.sub(this._shakeOffset);
  }
}
