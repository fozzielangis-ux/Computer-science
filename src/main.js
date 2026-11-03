import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { audio } from './core/audio.js';
import { UI } from './core/ui.js';
import { createPartyEnvironment } from './core/env.js';
import { TitleScene } from './scenes/title.js';
import { BalloonPopScene } from './scenes/balloonPop.js';
import { CakeTowerScene } from './scenes/cakeTower.js';
import { PresentDashScene } from './scenes/presentDash.js';
import { FinaleScene } from './scenes/finale.js';

// ---------------------------------------------------------------
//  Personalise the party here (or with ?name=…&age=…&from=… in the URL)
// ---------------------------------------------------------------
const params = new URLSearchParams(location.search);
const clean = (s, max) => (s || '').replace(/[^A-Za-z0-9 '!&.,-]/g, '').slice(0, max).trim();
export const CONFIG = {
  name: clean(params.get('name'), 12) || 'Sydelle',
  age: Math.max(0, Math.min(99, parseInt(params.get('age') || '0', 10) || 0)),
  from: clean(params.get('from'), 24),
  message: 'Wishing you the happiest birthday ever — full of cake, laughs, surprises and everything you love. Have the best year yet!',
};

const TOUR = ['balloon', 'cake', 'dash', 'finale'];
const GAME_NAMES = { balloon: 'Balloon Pop', cake: 'Cake Tower', dash: 'Present Dash', finale: 'Make a Wish' };
const MUSIC = { title: 'title', balloon: 'balloon', cake: 'cake', dash: 'dash' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

class Game {
  constructor() {
    this.config = CONFIG;
    this.state = 'loading';
    this.scenes = {};
    this.current = null;
    this.currentKey = null;
    this.tour = null;
    this.paused = false;
    this.time = 0;
    try { this.saves = JSON.parse(localStorage.getItem('sbb-saves') || '{}'); } catch { this.saves = {}; }
  }

  save() {
    try { localStorage.setItem('sbb-saves', JSON.stringify(this.saves)); } catch { /* ignore */ }
  }

  async init() {
    this.ui = new UI(document.getElementById('ui'), CONFIG);
    this.ui.loaderProgress(0.08, 'Inflating balloons…');
    await wait(30);

    // make sure the party fonts are ready before we paint any textures with them
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load('700 64px Fredoka'),
          document.fonts.load('600 32px Fredoka'),
          document.fonts.load('400 64px Pacifico'),
        ]),
        wait(2500),
      ]);
    } catch { /* fall back to system fonts */ }

    try {
      this.engine = new Engine(document.getElementById('app'));
    } catch (e) {
      this.fatal();
      return;
    }
    this.ui.loaderProgress(0.25, 'Hanging streamers…');
    await wait(30);
    this.envMap = createPartyEnvironment(this.engine.renderer);
    this.nightEnvMap = createPartyEnvironment(this.engine.renderer, { mood: 'night' });

    this.engine.onResize = () => {
      this.current?.resize(window.innerWidth, window.innerHeight);
    };

    this.ui.loaderProgress(0.4, 'Baking the cake…');
    await wait(30);
    this.registerScenes();
    const title = await this.getScene('title', (p) => this.ui.loaderProgress(0.4 + p * 0.5, 'Wrapping presents…'));
    this.ui.loaderProgress(0.95, 'Lighting the candles…');

    this.bindInput();
    this.bindUI();

    this.current = title;
    this.currentKey = 'title';
    this.engine.setView(title.scene, title.camera, title.viewOpts);
    title.resize(window.innerWidth, window.innerHeight);
    title.enter({ mode: 'title' });

    this.lastT = performance.now();
    this.engine.renderer.setAnimationLoop(() => this.loop());
    await wait(250);
    this.ui.loaderProgress(1, "Let's party!");
    await wait(250);
    this.ui.hideLoader();
    this.state = 'title';
    this.ui.show('title');
  }

  fatal() {
    const l = document.getElementById('loader');
    if (l) l.querySelector('.loader-title').textContent = 'This browser can’t show 3D graphics 😢';
    const tip = document.getElementById('loader-tip');
    if (tip) tip.textContent = 'Try opening the game in Chrome, Edge, Firefox or Safari with hardware acceleration turned on.';
  }

  registerScenes() {
    this.sceneClasses = { title: TitleScene, balloon: BalloonPopScene, cake: CakeTowerScene, dash: PresentDashScene, finale: FinaleScene };
  }

  async getScene(key, onProgress) {
    if (this.scenes[key]) return this.scenes[key];
    const S = this.sceneClasses[key];
    const s = new S(this);
    await s.build(onProgress);
    s.built = true;
    s.resize(window.innerWidth, window.innerHeight);
    // pre-compile shaders so the first frames don't stutter
    try {
      if (this.engine.renderer.compileAsync) await this.engine.renderer.compileAsync(s.scene, s.camera);
    } catch { /* not critical */ }
    this.scenes[key] = s;
    return s;
  }

  // ---------- input ----------
  bindInput() {
    const canvas = this.engine.renderer.domElement;
    const unlock = () => {
      const wasReady = audio.ctx && audio.ctx.state === 'running';
      audio.unlock();
      if (!wasReady) setTimeout(() => this.syncMusic(), 50);
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });

    canvas.addEventListener('pointerdown', (e) => {
      if (this.paused) return;
      this.current?.pointerDown(e);
    });
    window.addEventListener('pointermove', (e) => {
      if (this.paused) return;
      this.current?.pointerMove(e);
    });
    window.addEventListener('pointerup', (e) => this.current?.pointerUp(e));
    window.addEventListener('pointercancel', (e) => this.current?.pointerUp(e));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
        return;
      }
      if (this.paused) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.current?.keyDown(e.code, e);
      if ((e.code === 'Enter' || e.code === 'Space') && this.state === 'intro') this.play();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'playing') this.pause();
        if (audio.ctx) audio.ctx.suspend();
      } else if (audio.ctx) {
        audio.ctx.resume();
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  bindUI() {
    const ui = this.ui;
    ui.on('home', () => {
      if (this.state === 'playing') this.pause();
      else this.showMenu();
    });
    ui.on('startTour', () => {
      this.tour = { index: 0, scores: {} };
      this.openGame(TOUR[0]);
    });
    ui.on('menu', () => this.showMenu());
    ui.on('title', () => this.showTitle());
    ui.on('pickGame', (id) => {
      this.tour = null;
      this.openGame(id);
    });
    ui.on('play', () => this.play());
    ui.on('next', () => this.next());
    ui.on('retry', () => this.retry());
    ui.on('resume', () => this.resume());
  }

  syncMusic() {
    if (!audio.ctx) return;
    if (this.currentKey === 'finale') return;
    const m = MUSIC[this.currentKey];
    if (m) audio.startMusic(m);
  }

  // ---------- flow ----------
  async switchTo(key, opts = {}) {
    if (this._switching) return;
    this._switching = true;
    this.ui.fade(true);
    this.ui.clearPopups();
    this.ui.hud(false);
    await wait(380);
    if (this.current) this.current.exit();
    const s = await this.getScene(key);
    this.current = s;
    this.currentKey = key;
    this.paused = false;
    this.engine.setView(s.scene, s.camera, s.viewOpts);
    s.resize(window.innerWidth, window.innerHeight);
    s.enter(opts);
    // let a couple of frames render before revealing
    await wait(90);
    this.ui.fade(false);
    this._switching = false;
    this.syncMusic();
  }

  async showTitle() {
    this.state = 'title';
    this.ui.setHomeVisible(false);
    if (this.currentKey === 'title') {
      this.current.setMode('title');
    } else {
      this.ui.hideScreens();
      await this.switchTo('title', { mode: 'title' });
    }
    this.ui.show('title');
  }

  async showMenu() {
    this.state = 'menu';
    this.paused = false;
    this.ui.setHomeVisible(false);
    this.ui.updateMenu(this.saves);
    if (this.currentKey === 'title') {
      this.current.setMode('menu');
    } else {
      this.ui.hideScreens();
      await this.switchTo('title', { mode: 'menu' });
    }
    this.ui.show('menu');
  }

  async openGame(id) {
    this.ui.hideScreens();
    this.ui.setHomeVisible(true);
    if (id === 'finale') {
      this.state = 'finale';
      await this.switchTo('finale', { tour: this.tour, total: this.totalScore() });
      return;
    }
    this.state = 'intro';
    await this.switchTo(id);
    this.current.prepare();
    this.ui.showIntro(this.current.info);
  }

  async play() {
    if (this.state !== 'intro' && this.state !== 'results') return;
    this.state = 'countdown';
    this.ui.hideScreens();
    const s = this.current;
    s.prepare();
    s.showHud();
    const steps = ['3', '2', '1'];
    for (const n of steps) {
      if (this.state !== 'countdown' && this.state !== 'paused') return;
      while (this.state === 'paused') await wait(100);
      this.ui.announce(n, { duration: 800 });
      audio.countdown(false);
      await wait(700);
    }
    if (this.state !== 'countdown') return;
    this.ui.announce('GO!', { duration: 900 });
    audio.countdown(true);
    this.state = 'playing';
    s.start();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.paused = true;
    this.ui.show('pause');
    this.current?.onPause?.();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.ui.hideScreens();
    this.paused = false;
    this.state = 'playing';
    this.lastT = performance.now();
    this.current?.onResume?.();
  }

  totalScore() {
    let t = 0;
    for (const id of ['balloon', 'cake', 'dash']) {
      if (this.tour && this.tour.scores[id] != null) t += this.tour.scores[id];
      else if (!this.tour && this.saves[id]) t += this.saves[id].best || 0;
    }
    return t;
  }

  // Called by game scenes when a round ends.
  finishGame({ id, score, stars, title, lines }) {
    if (this.state !== 'playing') return;
    this.state = 'results';
    const prev = this.saves[id] || { best: 0, stars: 0 };
    const isNewBest = score > (prev.best || 0);
    this.saves[id] = { best: Math.max(prev.best || 0, score), stars: Math.max(prev.stars || 0, stars), plays: (prev.plays || 0) + 1 };
    this.save();
    if (this.tour) this.tour.scores[id] = Math.max(this.tour.scores[id] || 0, score);
    const nextId = TOUR[TOUR.indexOf(id) + 1];
    setTimeout(() => {
      this.ui.hud(false);
      this.ui.showResults({
        title,
        score,
        stars,
        best: this.saves[id].best,
        isNewBest: isNewBest && prev.best > 0,
        lines,
        nextLabel: nextId ? `${nextId === 'finale' ? '🎂 ' : ''}${GAME_NAMES[nextId]} ➜` : 'Menu',
      });
      if (stars >= 2) audio.tada();
    }, 1200);
  }

  next() {
    const id = this.currentKey;
    const nextId = TOUR[TOUR.indexOf(id) + 1];
    if (!nextId) return this.showMenu();
    if (this.tour) this.tour.index++;
    this.openGame(nextId);
  }

  retry() {
    if (this.state !== 'results') return;
    this.play();
  }

  loop() {
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (dt > 0.1) dt = 0.1;
    this.time += dt;
    if (this.current && !this.paused) this.current.update(dt, this.time);
    this.engine.render(dt, this.time);
  }
}

const game = new Game();
window.__game = game;
window.__audio = audio;
game.init().catch((e) => {
  console.error(e);
  game.fatal();
});
