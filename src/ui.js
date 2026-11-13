import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);

// Controls.
// Computer: left/right arrows steer (A/D too); up/down arrows are gas and brake/reverse (W/S too).
// Phone: tap or hold the left or right half of the screen to steer; hold the Brake button to slow, then reverse.
export class Input {
  constructor() {
    this.keys = { left: false, right: false, up: false, down: false };
    this.touches = new Map(); // pointerId -> -1 | 1
    this.pedals = new Map();  // pointerId -> -1 (brake) | 1 (gas)
    this.touch = window.matchMedia('(pointer: coarse)').matches;

    const names = {
      ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
      ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
    };
    const key = (e, down) => {
      const k = names[e.key];
      if (!k) return;
      this.keys[k] = down;
      e.preventDefault();
    };
    window.addEventListener('keydown', (e) => key(e, true));
    window.addEventListener('keyup', (e) => key(e, false));

    const side = (e) => (e.clientX < window.innerWidth / 2 ? -1 : 1);
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || (e.target.closest && e.target.closest('button, textarea'))) return;
      this.touches.set(e.pointerId, side(e));
    });
    window.addEventListener('pointermove', (e) => {
      if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, side(e));
    });
    const end = (e) => { this.touches.delete(e.pointerId); this.pedals.delete(e.pointerId); };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', () => this.clear());
  }

  // Makes an on-screen button act as a pedal while it is held. value: 1 for gas, -1 for brake/reverse.
  pedal(el, value) {
    el.addEventListener('pointerdown', (e) => { this.pedals.set(e.pointerId, value); e.preventDefault(); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  clear() {
    this.keys.left = this.keys.right = this.keys.up = this.keys.down = false;
    this.touches.clear();
    this.pedals.clear();
  }

  // -1 (brake, then reverse) .. 1 (gas). 0 means no pedal is pressed.
  get throttle() {
    let t = (this.keys.up ? 1 : 0) - (this.keys.down ? 1 : 0);
    for (const v of this.pedals.values()) t += v;
    return Math.max(-1, Math.min(1, t));
  }

  get steer() {
    let s = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    for (const v of this.touches.values()) s += v;
    return Math.max(-1, Math.min(1, s));
  }
}

// Best score, saved in the browser. If storage is blocked (private mode, embedded frames) the score
// is kept in memory instead, so the game still works; it just will not survive a reload.
export class Store {
  constructor() {
    this.memory = 0;
  }

  get best() {
    try {
      const v = parseInt(window.localStorage.getItem(CONFIG.storageKey), 10);
      if (Number.isFinite(v)) return Math.max(v, this.memory);
    } catch (err) { /* storage blocked: fall back to memory */ }
    return this.memory;
  }

  // Returns true when the score is a new best.
  submit(score) {
    if (score <= this.best) return false;
    this.memory = score;
    try { window.localStorage.setItem(CONFIG.storageKey, String(score)); } catch (err) { /* keep it in memory */ }
    return true;
  }
}

const clock = (sec) => {
  const s = Math.max(0, Math.ceil(sec));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

// Screens and the in-run display. Every name, colour and label comes from CONFIG.
export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.last = {};
    const root = document.documentElement.style;
    root.setProperty('--ice', CONFIG.colors.ice);
    root.setProperty('--pine', CONFIG.colors.pine);
    root.setProperty('--accent', CONFIG.colors.accent);
    document.title = CONFIG.name;

    // Title in big letters: last word in the accent colour.
    const words = CONFIG.name.split(' ');
    for (const el of document.querySelectorAll('.title')) {
      el.textContent = '';
      words.forEach((w, i) => {
        const span = document.createElement(i === words.length - 1 && words.length > 1 ? 'span' : 'b');
        span.textContent = w;
        el.append(span, i < words.length - 1 ? document.createElement('br') : '');
      });
    }
    $('tagline').textContent = CONFIG.tagline;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    $('hint').textContent = `${touch
      ? 'Hold the left or right side of the screen to steer. Hold Brake to slow down and reverse.'
      : 'Arrow keys: left and right steer, down brakes and reverses, up is gas. C changes the view, M mutes.'} Collect ${CONFIG.collectible.plural}, stay off the trees and rocks.`;
    this.touch = touch;
    handlers.input.pedal($('brake'), -1);

    // Car picker.
    this.carButtons = CONFIG.cars.map((car, i) => {
      const b = document.createElement('button');
      b.className = 'car';
      const dot = document.createElement('i');
      dot.style.background = car.swatch;
      b.append(dot, car.name);
      b.addEventListener('click', () => this.h.onCar(i));
      $('cars').append(b);
      return b;
    });

    $('playRun').addEventListener('click', () => this.h.onStart('run'));
    $('playFree').addEventListener('click', () => this.h.onStart('free'));
    $('again').addEventListener('click', () => this.h.onAgain());
    $('menu').addEventListener('click', () => this.h.onMenu());
    $('view').addEventListener('click', () => this.h.onView());
    $('finish').addEventListener('click', () => this.h.onFinish());
    $('mute').addEventListener('click', () => this.h.onMute());
    $('share').addEventListener('click', () => this.share());
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.key === 'c' || e.key === 'C') this.h.onView();
      if (e.key === 'm' || e.key === 'M') this.h.onMute();
      if (e.key === 'Enter') {
        if (!$('start').hidden) this.h.onStart('run');
        else if (!$('end').hidden) this.h.onAgain();
      }
    });
  }

  show(id) {
    for (const s of ['loading', 'start', 'end']) $(s).hidden = s !== id;
    const playing = id === 'hud';
    $('hud').hidden = !playing;
    $('speed').hidden = !playing;
    $('brake').hidden = !(playing && this.touch);
    if (!playing) $('banner').classList.remove('on');
  }

  setLoading(p) { $('bar').firstElementChild.style.width = Math.round(p * 100) + '%'; }
  loadFailed() { $('loadText').textContent = 'Could not load the game files. Check your connection and reload.'; }

  showStart(best) {
    this.show('start');
    $('best').textContent = best > 0 ? `Best score ${best}` : 'No best score yet';
  }
  setCar(i) { this.carButtons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i))); }

  showHud(mode) {
    this.show('hud');
    this.last = {};
    $('timePill').hidden = mode !== 'run';
    $('finish').hidden = mode !== 'free';
  }

  // Each setter only touches the page when the value actually changed.
  set(id, value) {
    if (this.last[id] === value) return;
    this.last[id] = value;
    $(id).textContent = value;
  }
  setScore(v) { this.set('score', String(v)); }
  setTime(sec) { this.set('time', clock(sec)); }
  setLevel(index, name) { this.set('level', `${index + 1}/3 ${name}`); }
  setSpeed(kmh) { this.set('kmh', String(Math.round(kmh))); }
  setView(name) { this.set('view', 'View: ' + name); }
  setMute(muted) { $('mute').textContent = muted ? 'Sound: Off' : 'Sound: On'; }

  banner(small, big) {
    const el = $('banner');
    el.textContent = big;
    const s = document.createElement('small');
    s.textContent = small;
    el.prepend(s);
    el.classList.add('on');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => el.classList.remove('on'), 2200);
  }

  showEnd({ score, mode, best, isBest }) {
    this.show('end');
    this.shareText = `I scored ${score} in ${CONFIG.name} ${CONFIG.shareUrl}`;
    $('endLabel').textContent = mode === 'run' ? (isBest ? 'New best score' : 'Run complete') : 'Free drive';
    $('endScore').textContent = score;
    const n = score / CONFIG.collectible.points;
    const what = `You collected ${n} ${n === 1 ? CONFIG.collectible.name : CONFIG.collectible.plural}.`;
    $('endText').textContent = mode === 'run' ? `${what} Best: ${best}.` : `${what} Free Drive scores are not saved.`;
    $('shareNote').textContent = '';
    $('shareBox').hidden = true;
  }

  // Copies the share text. If the browser blocks copying, shows the text so it can be copied by hand.
  async share() {
    try {
      await navigator.clipboard.writeText(this.shareText);
      $('shareNote').textContent = 'Copied. Paste it anywhere.';
    } catch (err) {
      const box = $('shareBox');
      box.hidden = false;
      box.value = this.shareText;
      box.focus();
      box.select();
      $('shareNote').textContent = 'Copying is blocked here. Select the text and copy it yourself.';
    }
  }
}
