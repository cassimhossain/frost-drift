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
    window.addEventListener('blur', () => { this.keys.left = this.keys.right = false; this.touches.clear(); });
  }

  get steer() {
    let s = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    for (const v of this.touches.values()) s += v;
    return Math.max(-1, Math.min(1, s));
  }
}

export class UI {
  constructor(handlers) {
    const root = document.documentElement.style;
    root.setProperty('--ice', CONFIG.colors.ice);
    root.setProperty('--pine', CONFIG.colors.pine);
    root.setProperty('--accent', CONFIG.colors.accent);
    document.title = CONFIG.name;

    $('restart').addEventListener('click', handlers.onRestart);
  }

  setScore(v) { $('score').textContent = v; }
}
