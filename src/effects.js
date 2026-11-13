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

  // Call every frame while driving. Faster car, more snow.
  kick(player, dt) {
    if (player.speed < 6) return;
    const count = player.speed * dt * 2.2 + (Math.abs(player.vx) > 6 ? 1 : 0);
    for (let k = Math.random() < count % 1 ? Math.ceil(count) : Math.floor(count); k > 0; k--) {
      const i = this.sprayNext, s = this.spray[i], side = Math.random() < 0.5 ? -1 : 1;
      this.sprayNext = (i + 1) % this.spray.length;
      this.sprayPos[i * 3] = player.x + side * 0.95 + (Math.random() - 0.5) * 0.3;
      this.sprayPos[i * 3 + 1] = 0.15;
      this.sprayPos[i * 3 + 2] = player.z + 1.7;
      s.vx = side * (0.6 + Math.random() * 1.6) - player.vx * 0.15;
      s.vy = 0.6 + Math.random() * 1.6;
      s.vz = -player.speed * 0.35;
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

  // Burst of sparks at a world position. forward: the car's speed, so sparks travel with it.
  burst(pos, forward = 0, n = 12) {
    for (let i = 0; i < n; i++) {
      const s = this.sparks[this.next];
      this.next = (this.next + 1) % this.sparks.length;
      const a = Math.random() * Math.PI * 2, up = 3 + Math.random() * 5, out = 2 + Math.random() * 4;
      s.x = pos.x; s.y = pos.y; s.z = pos.z;
      s.vx = Math.cos(a) * out; s.vy = up; s.vz = Math.sin(a) * out - forward * 0.85;
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
