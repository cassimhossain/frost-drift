import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);

// Controls: arrow keys (or A/D) on a computer, tap or hold the left/right half of the screen on a phone.
export class Input {
  constructor() {
    this.keys = { left: false, right: false };
    this.touches = new Map(); // pointerId -> -1 | 1

    const key = (e, down) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = down;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = down;
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', (e) => key(e, true));
    window.addEventListener('keyup', (e) => key(e, false));

    const side = (e) => (e.clientX < window.innerWidth / 2 ? -1 : 1);
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || e.target.closest('button, textarea')) return;
      this.touches.set(e.pointerId, side(e));
    });
    window.addEventListener('pointermove', (e) => {
      if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, side(e));
    });
    const end = (e) => this.touches.delete(e.pointerId);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', () => this.clear());
  }

  clear() {
    this.keys.left = this.keys.right = false;
    this.touches.clear();
  }

  get steer() {
    let s = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    for (const v of this.touches.values()) s += v;
    return Math.max(-1, Math.min(1, s));
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
    $('hint').textContent = `${touch ? 'Hold the left or right side of the screen to steer.' : 'Steer with the left and right arrow keys. C changes the view.'} Collect ${CONFIG.collectible.plural}, stay off the trees and rocks.`;

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
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.key === 'c' || e.key === 'C') this.h.onView();
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
    if (!playing) $('banner').classList.remove('on');
  }

  setLoading(p) { $('bar').firstElementChild.style.width = Math.round(p * 100) + '%'; }
  loadFailed() { $('loadText').textContent = 'Could not load the game files. Check your connection and reload.'; }

  showStart() { this.show('start'); }
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

  showEnd({ score, mode }) {
    this.show('end');
    $('endLabel').textContent = mode === 'run' ? 'Run complete' : 'Free drive';
    $('endScore').textContent = score;
    const n = score / CONFIG.collectible.points;
    $('endText').textContent = `You collected ${n} ${n === 1 ? CONFIG.collectible.name : CONFIG.collectible.plural}.`;
  }
}
