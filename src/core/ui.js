// All HTML overlay UI: HUD, menus, intro cards, results and popups.
import { audio } from './audio.js';
import { formatNumber } from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);

const ICON_HOME = '<svg viewBox="0 0 24 24"><path d="M12 3.2 2.5 11h2.7v9h5.3v-6h3v6h5.3v-9h2.7z"/></svg>';
const ICON_SOUND = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
const ICON_MUTE = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zm15.6 3 2.2-2.2-1.4-1.4-2.2 2.2-2.2-2.2-1.4 1.4 2.2 2.2-2.2 2.2 1.4 1.4 2.2-2.2 2.2 2.2 1.4-1.4z"/></svg>';

export class UI {
  constructor(root, config) {
    this.root = root;
    this.config = config;
    this.handlers = {};
    this._build();
  }

  on(name, fn) {
    this.handlers[name] = fn;
  }

  _emit(name, ...args) {
    audio.unlock();
    audio.click();
    this.handlers[name]?.(...args);
  }

  _build() {
    const name = this.config.name;
    const html = `
      <div class="topbar">
        <button class="icon-btn hidden" id="btn-home" aria-label="Home">${ICON_HOME}</button>
        <button class="icon-btn" id="btn-sound" aria-label="Sound">${audio.muted ? ICON_MUTE : ICON_SOUND}</button>
      </div>
      <div id="hud" class="hidden">
        <div class="hud-left">
          <div class="hud-pill" id="hud-score-pill"><span class="label">Score</span><span class="value" id="hud-score">0</span></div>
        </div>
        <div class="combo off" id="hud-combo">x2</div>
        <div class="hud-center">
          <div class="timer hidden" id="hud-timer">
            <svg viewBox="0 0 68 68"><circle class="track" cx="34" cy="34" r="29"/><circle class="ring" id="hud-ring" cx="34" cy="34" r="29" stroke-dasharray="182.2" stroke-dashoffset="0"/></svg>
            <div class="num" id="hud-time">60</div>
          </div>
          <div class="hud-pill hidden" id="hud-alt-pill" style="text-align:center"><span class="label" id="hud-alt-label">Height</span><span class="value" id="hud-alt">0</span></div>
          <div class="letters hidden" id="hud-letters"></div>
        </div>
        <div class="hud-right">
          <div class="lives hidden" id="hud-lives"></div>
        </div>
        <div class="hud-hint hidden" id="hud-hint"></div>
      </div>
      <div id="popups"></div>
      <div id="announce"></div>

      <section class="screen" id="screen-title">
        <h1 class="title-sub">Birthday Bash!</h1>
        <div class="title-tag">A party game made just for you, ${name} 💖</div>
        <div class="btn-row">
          <button class="btn big" id="btn-start">🎉 Start the Party</button>
          <button class="btn ghost" id="btn-games">Pick a Game</button>
        </div>
      </section>

      <section class="screen" id="screen-menu">
        <div class="menu-head">
          <h2>Pick a Party Game</h2>
          <div class="total" id="menu-total"></div>
        </div>
        <div class="menu-grid">
          <button class="card c1" data-game="balloon">
            <div class="card-emoji">🎈</div>
            <div class="card-title">Balloon Pop</div>
            <div class="card-desc">Pop balloons & spell ${name.toUpperCase()}!</div>
            <div class="card-stars" data-stars="balloon"></div>
            <div class="card-best" data-best="balloon">Not played yet</div>
          </button>
          <button class="card c2" data-game="cake">
            <div class="card-emoji">🎂</div>
            <div class="card-title">Cake Tower</div>
            <div class="card-desc">Stack the tallest birthday cake ever.</div>
            <div class="card-stars" data-stars="cake"></div>
            <div class="card-best" data-best="cake">Not played yet</div>
          </button>
          <button class="card c3" data-game="dash">
            <div class="card-emoji">🎁</div>
            <div class="card-title">Present Dash</div>
            <div class="card-desc">Run with Sprinkle through Candy Land!</div>
            <div class="card-stars" data-stars="dash"></div>
            <div class="card-best" data-best="dash">Not played yet</div>
          </button>
          <button class="card c4" data-game="finale">
            <div class="card-emoji">🕯️</div>
            <div class="card-title">Make a Wish</div>
            <div class="card-desc">Blow out your birthday candles!</div>
            <div class="card-stars"></div>
            <div class="card-best">✨ The big finale ✨</div>
          </button>
        </div>
        <button class="btn ghost small" id="btn-menu-back">← Back</button>
      </section>

      <section class="screen" id="screen-intro">
        <div class="panel">
          <div class="panel-emoji" id="intro-emoji">🎈</div>
          <h2 id="intro-title">Balloon Pop</h2>
          <p id="intro-desc"></p>
          <ul class="howto" id="intro-howto"></ul>
          <div class="btn-row"><button class="btn gold big" id="btn-play">Let's Go!</button></div>
        </div>
      </section>

      <section class="screen" id="screen-results">
        <div class="panel">
          <h2 id="res-title">Amazing!</h2>
          <div class="stars"><span class="star">⭐</span><span class="star">⭐</span><span class="star">⭐</span></div>
          <div class="result-score" id="res-score">0</div>
          <div class="result-best" id="res-best"></div>
          <div class="result-lines" id="res-lines"></div>
          <div class="btn-row">
            <button class="btn gold" id="btn-next">Next ➜</button>
            <button class="btn blue small" id="btn-retry">↻ Again</button>
            <button class="btn ghost small" id="btn-res-menu">Menu</button>
          </div>
        </div>
      </section>

      <section class="screen" id="screen-pause">
        <div class="panel pause-panel">
          <div class="panel-emoji">⏸️</div>
          <h2>Paused</h2>
          <div class="btn-row">
            <button class="btn gold" id="btn-resume">▶ Resume</button>
            <button class="btn ghost small" id="btn-quit">Quit to Menu</button>
          </div>
        </div>
      </section>

      <section class="screen" id="screen-finale">
        <div class="lyrics" id="lyrics"></div>
        <div class="finale-bottom" id="finale-bottom"></div>
        <div class="finale-card" id="finale-card"></div>
      </section>

      <div id="fade"></div>
    `;
    this.root.insertAdjacentHTML('beforeend', html);

    $('#btn-sound').addEventListener('click', () => {
      audio.unlock();
      audio.setMuted(!audio.muted);
      $('#btn-sound').innerHTML = audio.muted ? ICON_MUTE : ICON_SOUND;
      if (!audio.muted) audio.click();
    });
    $('#btn-home').addEventListener('click', () => this._emit('home'));
    $('#btn-start').addEventListener('click', () => this._emit('startTour'));
    $('#btn-games').addEventListener('click', () => this._emit('menu'));
    $('#btn-menu-back').addEventListener('click', () => this._emit('title'));
    this.root.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => this._emit('pickGame', c.dataset.game)));
    $('#btn-play').addEventListener('click', () => this._emit('play'));
    $('#btn-next').addEventListener('click', () => this._emit('next'));
    $('#btn-retry').addEventListener('click', () => this._emit('retry'));
    $('#btn-res-menu').addEventListener('click', () => this._emit('menu'));
    $('#btn-resume').addEventListener('click', () => this._emit('resume'));
    $('#btn-quit').addEventListener('click', () => this._emit('menu'));

    this.scoreEl = $('#hud-score');
    this.scorePill = $('#hud-score-pill');
    this.comboEl = $('#hud-combo');
    this.timerEl = $('#hud-timer');
    this.timeEl = $('#hud-time');
    this.ringEl = $('#hud-ring');
    this.lettersEl = $('#hud-letters');
    this.livesEl = $('#hud-lives');
    this.altPill = $('#hud-alt-pill');
    this.popups = $('#popups');
    this.announceEl = $('#announce');
  }

  // ---------- screens ----------
  show(id) {
    this.root.querySelectorAll('.screen').forEach((s) => s.classList.toggle('show', s.id === 'screen-' + id));
    this.current = id;
  }

  hideScreens() {
    this.root.querySelectorAll('.screen').forEach((s) => s.classList.remove('show'));
    this.current = null;
  }

  setHomeVisible(v) {
    $('#btn-home').classList.toggle('hidden', !v);
  }

  fade(on) {
    $('#fade').classList.toggle('on', on);
  }

  loaderProgress(p, tip) {
    const f = document.getElementById('loader-fill');
    if (f) f.style.width = Math.round(p * 100) + '%';
    if (tip) {
      const t = document.getElementById('loader-tip');
      if (t) t.textContent = tip;
    }
  }

  hideLoader() {
    const l = document.getElementById('loader');
    if (!l) return;
    l.classList.add('done');
    setTimeout(() => l.remove(), 800);
  }

  updateMenu(saves) {
    let total = 0;
    for (const id of ['balloon', 'cake', 'dash']) {
      const s = saves[id];
      const best = this.root.querySelector(`[data-best="${id}"]`);
      const stars = this.root.querySelector(`[data-stars="${id}"]`);
      if (s && s.best > 0) {
        best.textContent = 'Best: ' + formatNumber(s.best);
        stars.textContent = '⭐'.repeat(s.stars || 0) + '☆'.repeat(3 - (s.stars || 0));
        total += s.best;
      } else {
        best.textContent = 'Not played yet';
        stars.textContent = '';
      }
    }
    $('#menu-total').textContent = total > 0 ? `🏆 Total party points: ${formatNumber(total)}` : `Play them all, then make a wish! ✨`;
  }

  showIntro(info) {
    $('#intro-emoji').textContent = info.emoji;
    $('#intro-title').textContent = info.title;
    $('#intro-desc').innerHTML = info.desc;
    $('#intro-howto').innerHTML = info.howto.map(([ico, text]) => `<li><span class="ico">${ico}</span><span>${text}</span></li>`).join('');
    this.show('intro');
  }

  showResults({ title, score, stars, best, isNewBest, lines, nextLabel }) {
    $('#res-title').textContent = title;
    $('#btn-next').textContent = nextLabel || 'Next ➜';
    const starEls = this.root.querySelectorAll('#screen-results .star');
    starEls.forEach((s) => s.classList.remove('on'));
    const bestEl = $('#res-best');
    bestEl.textContent = isNewBest ? '🎉 New best score! 🎉' : `Best: ${formatNumber(best)}`;
    bestEl.classList.toggle('new', !!isNewBest);
    $('#res-lines').innerHTML = lines.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    this.show('results');
    // count up the score
    const el = $('#res-score');
    const start = performance.now();
    const dur = Math.min(1600, 500 + score * 0.6);
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      el.textContent = formatNumber(score * e);
      if (t < 1 && this.current === 'results') requestAnimationFrame(step);
      else el.textContent = formatNumber(score);
    };
    step();
    starEls.forEach((s, i) => {
      if (i < stars) setTimeout(() => {
        s.classList.add('on');
        audio.chime(79 + i * 4, { gain: 0.15 });
      }, 500 + i * 380);
    });
  }

  // ---------- HUD ----------
  hud(on, opts = {}) {
    $('#hud').classList.toggle('hidden', !on);
    if (!on) return;
    this.timerEl.classList.toggle('hidden', !opts.timer);
    this.lettersEl.classList.toggle('hidden', !opts.letters);
    this.livesEl.classList.toggle('hidden', !opts.lives);
    this.altPill.classList.toggle('hidden', !opts.alt);
    if (opts.alt) $('#hud-alt-label').textContent = opts.alt;
    this.setCombo(0);
    this.setScore(0, false);
    const hint = $('#hud-hint');
    if (opts.hint) {
      hint.textContent = opts.hint;
      hint.classList.remove('hidden');
      hint.style.opacity = '0.9';
      clearTimeout(this._hintTimer);
      this._hintTimer = setTimeout(() => (hint.style.opacity = '0'), 6000);
    } else hint.classList.add('hidden');
  }

  setScore(v, bump = true) {
    this.scoreEl.textContent = formatNumber(v);
    if (bump) {
      this.scorePill.classList.remove('bump');
      void this.scorePill.offsetWidth;
      this.scorePill.classList.add('bump');
    }
  }

  setAlt(v) {
    $('#hud-alt').textContent = v;
  }

  setTime(t, total) {
    const s = Math.max(0, Math.ceil(t));
    if (this.timeEl.textContent !== String(s)) this.timeEl.textContent = s;
    const frac = Math.max(0, t / total);
    this.ringEl.setAttribute('stroke-dashoffset', String(182.2 * (1 - frac)));
    this.timerEl.classList.toggle('low', t <= 10);
  }

  setCombo(mult) {
    if (mult <= 1) {
      this.comboEl.classList.add('off');
      this._lastCombo = 1;
      return;
    }
    this.comboEl.classList.remove('off');
    if (mult !== this._lastCombo) {
      this.comboEl.textContent = `x${mult} COMBO!`;
      this.comboEl.classList.remove('pop');
      void this.comboEl.offsetWidth;
      this.comboEl.classList.add('pop');
      this._lastCombo = mult;
    }
  }

  setLetters(word, got, colors) {
    const chars = Array.from(word);
    if (this.lettersEl.children.length !== chars.length) {
      this.lettersEl.innerHTML = chars.map((c) => `<div class="lt">${c}</div>`).join('');
    }
    [...this.lettersEl.children].forEach((el, i) => {
      el.classList.toggle('got', i < got);
      el.classList.toggle('next', i === got);
      el.style.background = i < got ? colors[i % colors.length] : '';
    });
  }

  setLives(n, max, icon = '❤️') {
    let html = '';
    for (let i = 0; i < max; i++) html += `<span class="${i < n ? '' : 'lost'}">${icon}</span>`;
    this.livesEl.innerHTML = html;
  }

  popup(x, y, text, { color = '#fff', cls = '' } = {}) {
    const el = document.createElement('div');
    el.className = 'popup ' + cls;
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = color;
    this.popups.appendChild(el);
    setTimeout(() => el.remove(), cls.includes('huge') ? 1700 : 1100);
  }

  announce(text, { small = false, duration = 1000 } = {}) {
    const el = document.createElement('div');
    el.className = 'ann' + (small ? ' small' : '');
    el.textContent = text;
    el.style.animationDuration = duration + 'ms';
    this.announceEl.innerHTML = '';
    this.announceEl.appendChild(el);
    setTimeout(() => el.remove(), duration + 50);
  }

  clearPopups() {
    this.popups.innerHTML = '';
    this.announceEl.innerHTML = '';
  }

  // ---------- finale ----------
  get finaleLyrics() { return $('#lyrics'); }
  get finaleBottom() { return $('#finale-bottom'); }
  get finaleCard() { return $('#finale-card'); }
}
