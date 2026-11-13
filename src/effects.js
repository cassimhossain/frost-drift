import * as THREE from 'three';
import { CONFIG } from './config.js';

// Screen shake and pickup sparks. Purely cosmetic: nothing here touches rules or scoring.
export class Effects {
  constructor(scene) {
    const count = CONFIG.counts.sparks;
    // Colour is pushed past 1 so the bloom pass makes sparks glow.
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CONFIG.colors.accent).multiplyScalar(4), toneMapped: false });
    this.mesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.14), mat, count);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // Pool: every spark exists from the start and is recycled, never allocated during play.
    this.sparks = Array.from({ length: count }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0 }));
    this.next = 0;
    this.dummy = new THREE.Object3D();
    this.shake = 0;
    this.offset = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.shake = 0;
    this.offset.set(0, 0, 0);
    for (const s of this.sparks) s.life = 0;
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
