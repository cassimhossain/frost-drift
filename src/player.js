import * as THREE from 'three';
import { CONFIG } from './config.js';

// The car. Drives toward -z; +x is the right side of the screen.
export class Player {
  constructor(scene) {
    const c = CONFIG.colors;
    const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
    this.group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 3.8), mat(c.car));
    body.position.y = 0.7;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.8), mat(c.carDark));
    cabin.position.set(0, 1.22, 0.25);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 3.82), mat(c.accent));
    stripe.position.y = 0.985;
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.4), mat(c.accent));
    spoiler.position.set(0, 1.2, 1.75);
    this.group.add(body, cabin, stripe, spoiler);

    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = mat('#15181c');
    this.wheels = [];
    for (const [x, z] of [[-1, -1.25], [1, -1.25], [-1, 1.25], [1, 1.25]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(x, 0.42, z);
      this.wheels.push(w);
      this.group.add(w);
    }

    const lampGeo = new THREE.BoxGeometry(0.4, 0.18, 0.06);
    const headMat = new THREE.MeshBasicMaterial({ color: '#fff4c2' });
    const tailMat = new THREE.MeshBasicMaterial({ color: '#ff3b30' });
    for (const x of [-0.65, 0.65]) {
      const h = new THREE.Mesh(lampGeo, headMat); h.position.set(x, 0.75, -1.92);
      const t = new THREE.Mesh(lampGeo, tailMat); t.position.set(x, 0.75, 1.92);
      this.group.add(h, t);
    }

    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.group);

    this.radius = 1.1;
    this.reset();
  }

  reset() {
    this.x = 0; this.z = 0; this.speed = 0; this.vx = 0; this.stun = 0;
    this.sync();
  }

  // steer: -1 (left) .. 1 (right)
  update(dt, steer, level, offroad) {
    this.stun = Math.max(0, this.stun - dt);
    const max = level.maxSpeed * (offroad ? 0.6 : 1);
    this.speed = this.stun > 0 ? max * 0.3 : max;
    this.vx = steer * level.steer;
    this.x += this.vx * dt;
    this.z -= this.speed * dt;
    for (const w of this.wheels) w.rotation.x -= (this.speed * dt) / 0.42;
    this.sync();
  }

  hit() {
    this.stun = 0.6;
  }

  sync() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = -this.vx * 0.022;
    this.group.rotation.z = -this.vx * 0.006;
  }
}
