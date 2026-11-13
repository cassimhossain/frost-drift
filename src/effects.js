import * as THREE from 'three';
import { CONFIG } from './config.js';

// Screen shake and pickup sparks. Purely cosmetic: nothing here touches rules or scoring.
export class Effects {
  constructor(scene, tier) {
    const count = CONFIG.counts.sparks;
    // Colour is pushed past 1 so the bloom pass makes sparks glow.
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CONFIG.colors.accent).multiplyScalar(4), toneMapped: false });
    this.mesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.085), mat, count);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // Pool: every spark exists from the start and is recycled, never allocated during play.
    this.sparks = Array.from({ length: count }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0 }));
    this.next = 0;
    this.dummy = new THREE.Object3D();
    this.shake = 0;
    this.offset = new THREE.Vector3();

    // Snow kicked up by the rear wheels: one pooled cloud of soft points.
    const n = tier.spray;
    this.sprayPos = new Float32Array(n * 3).fill(-999);
    this.spray = Array.from({ length: n }, () => ({ life: 0, vx: 0, vy: 0, vz: 0 }));
    this.sprayNext = 0;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const g = cv.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.sprayPos, 3));
    this.sprayMesh = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.38, map: new THREE.CanvasTexture(cv), color: '#dfe9f2', transparent: true, opacity: 0.3, depthWrite: false,
    }));
    this.sprayMesh.frustumCulled = false;
    scene.add(this.sprayMesh);
    this.reset();
  }

  // Call every frame while driving. Faster car, more snow; a sliding car throws up extra.
  kick(player, dt) {
    const v = Math.abs(player.speed);
    if (v < 6) return;
    const sin = Math.sin(player.heading), cos = Math.cos(player.heading);
    const slide = Math.abs(player.velX * cos + player.velZ * sin);
    const count = v * dt * 2.2 + slide * dt * 3;
    for (let k = Math.random() < count % 1 ? Math.ceil(count) : Math.floor(count); k > 0; k--) {
      const i = this.sprayNext, s = this.spray[i], side = Math.random() < 0.5 ? -1 : 1;
      this.sprayNext = (i + 1) % this.spray.length;
      // Rear wheels: 1.7 m behind the centre, 0.95 m either side.
      const off = side * 0.95 + (Math.random() - 0.5) * 0.3;
      this.sprayPos[i * 3] = player.x - sin * 1.7 + cos * off;
      this.sprayPos[i * 3 + 1] = 0.15;
      this.sprayPos[i * 3 + 2] = player.z + cos * 1.7 + sin * off;
      const out = side * (0.6 + Math.random() * 1.6);
      s.vx = player.velX * 0.35 + cos * out;
      s.vy = 0.6 + Math.random() * 1.6;
      s.vz = player.velZ * 0.35 + sin * out;
      s.life = 0.35 + Math.random() * 0.35;
    }
  }

  reset() {
    this.shake = 0;
    this.offset.set(0, 0, 0);
    for (const s of this.sparks) s.life = 0;
    for (const s of this.spray) s.life = 0;
    this.sprayPos.fill(-999);
    this.sprayMesh.geometry.attributes.position.needsUpdate = true;
    this.write();
  }

  // Burst of sparks at a world position. velX/velZ: the car's velocity, so sparks travel with it.
  burst(pos, velX = 0, velZ = 0, n = 12) {
    for (let i = 0; i < n; i++) {
      const s = this.sparks[this.next];
      this.next = (this.next + 1) % this.sparks.length;
      const a = Math.random() * Math.PI * 2, up = 3 + Math.random() * 5, out = 2 + Math.random() * 4;
      s.x = pos.x; s.y = pos.y; s.z = pos.z;
      s.vx = Math.cos(a) * out + velX * 0.85; s.vy = up; s.vz = Math.sin(a) * out + velZ * 0.85;
      s.life = 0.45 + Math.random() * 0.35;
      s.spin = Math.random() * 6;
    }
  }

  // Small camera shake. amount is in world units and decays quickly.
  hit(amount = 0.55) {
    this.shake = Math.max(this.shake, amount);
  }

  update(dt) {
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.vy -= 16 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      if (s.y < 0.05) { s.y = 0.05; s.vy *= -0.4; }
    }
    this.write();

    const p = this.sprayPos;
    for (let i = 0; i < this.spray.length; i++) {
      const s = this.spray[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) { p[i * 3 + 1] = -999; continue; }
      s.vy -= 4 * dt;
      p[i * 3] += s.vx * dt; p[i * 3 + 1] += s.vy * dt; p[i * 3 + 2] += s.vz * dt;
    }
    this.sprayMesh.geometry.attributes.position.needsUpdate = true;

    this.shake = Math.max(0, this.shake - dt * 1.6);
    const k = this.shake * this.shake * 3;
    this.offset.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, 0);
  }

  write() {
    const d = this.dummy;
    this.sparks.forEach((s, i) => {
      const scale = s.life > 0 ? Math.min(1, s.life * 3) : 0;
      d.position.set(s.x, s.y, s.z);
      d.rotation.set(s.spin + s.life * 9, s.spin * 2, 0);
      d.scale.setScalar(scale);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// All sound is generated here with the Web Audio API. There are no audio files.
// Browsers only allow sound after a tap or key press, so nothing starts until unlock() is called from one.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(ctx.destination);

      // Engine: two slightly detuned saws and a sub, through a filter that opens as the revs rise.
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.Q.value = 1.2;
      this.engineFilter.connect(this.engineGain).connect(this.master);
      this.engine = [['sawtooth', 1, 0.5], ['sawtooth', 1.007, 0.4], ['square', 0.5, 0.35]].map(([type, ratio, level]) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = type;
        g.gain.value = level;
        osc.connect(g).connect(this.engineFilter);
        osc.start();
        return { osc, ratio };
      });

      // One second of noise, looped: filtered low for wind and road rumble, high for tyres sliding on snow.
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
      const loop = (type, freq) => {
        const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = buf; src.loop = true;
        f.type = type; f.frequency.value = freq;
        g.gain.value = 0;
        src.connect(f).connect(g).connect(this.master);
        src.start();
        return g;
      };
      this.windGain = loop('lowpass', 420);
      this.slideGain = loop('bandpass', 2600);
    } catch (err) {
      this.ctx = null; // no sound on this device; the game carries on silently
    }
  }

  // Returns true when sound is now muted.
  toggle() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.03);
    return this.muted;
  }

  // Call every frame. speed and slide in m/s, top = the car's top speed, throttle -1..1.
  update(playing, speed = 0, top = 1, throttle = 0, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, v = Math.abs(speed), pace = Math.min(1, v / top);
    // Pretend gearbox: revs climb through each of four gears, then drop for the next.
    const gears = pace * 4, gear = Math.min(3, Math.floor(gears)), revs = gears - gear;
    const hz = playing ? 46 + gear * 9 + revs * 62 + (speed < -0.5 ? 20 : 0) : 40;
    for (const e of this.engine) e.osc.frequency.setTargetAtTime(hz * e.ratio, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(320 + pace * 900 + Math.max(0, throttle) * 500, t, 0.08);
    this.engineGain.gain.setTargetAtTime(playing ? 0.1 + Math.max(0, throttle) * 0.07 + pace * 0.05 : 0, t, 0.1);
    this.windGain.gain.setTargetAtTime(playing ? pace * pace * 0.34 : 0, t, 0.15);
    this.slideGain.gain.setTargetAtTime(playing ? Math.min(0.22, slide * 0.03) : 0, t, 0.06);
  }

  // Short bright chime for a pickup.
  pickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [[880, 0], [1318.5, 0.07], [1760, 0.14]].forEach(([hz, at]) => {
      const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      g.gain.setValueAtTime(0, t + at);
      g.gain.linearRampToValueAtTime(0.22, t + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.28);
      osc.connect(g).connect(this.master);
      osc.start(t + at);
      osc.stop(t + at + 0.3);
    });
  }

  // Dull thud with a crunch for a collision. strength 0..1.
  thud(strength = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, k = Math.max(0.2, Math.min(1, strength));
    const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    g.gain.setValueAtTime(0.7 * k, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.32);
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), ng = this.ctx.createGain();
    src.buffer = this.noise;
    f.type = 'lowpass';
    f.frequency.value = 1400;
    ng.gain.setValueAtTime(0.5 * k, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(f).connect(ng).connect(this.master);
    src.start(t, Math.random() * 0.5, 0.2);
  }
}
