import * as THREE from 'three';
import { CONFIG } from './config.js';

const WHEEL_RADIUS = 0.54;
const WHEELS = ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'];
const HIDDEN = ['License_Plate', 'InteriorSteeringEmblem']; // parts carrying the model author's logos

// The car. Drives toward -z; +x is the right side of the screen.
export class Player {
  constructor(scene, assets) {
    this.group = new THREE.Group(); // position and heading
    this.body = new THREE.Group();  // roll and pitch
    this.group.add(this.body);

    const model = assets.car;
    model.rotation.y = Math.PI; // the model faces +z; the game drives toward -z
    model.position.y = 0.16;    // rest the tyres on the road
    this.body.add(model);
    this.model = model;
    this.group.updateMatrixWorld(true);

    this.lamps = [];
    const fix = (m) => {
      if (m.transmission > 0) {
        // Real glass refraction needs a second render of the whole scene. Tinted glass looks close and costs nothing.
        m.transmission = 0; m.transparent = true; m.opacity = 0.62; m.color.set('#0b1118');
        m.roughness = 0.04; m.metalness = 0.9; m.depthWrite = false;
      }
      if ((m.name === 'Headlight' || m.name === 'Brakelight') && !this.lamps.includes(m)) this.lamps.push(m);
    };
    model.traverse((o) => {
      if (HIDDEN.includes(o.name)) o.visible = false;
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      fix(o.material);
      if (o.userData.paints) Object.values(o.userData.paints).forEach(fix);
    });

    // Put each wheel on a pivot at its hub so it can spin and steer.
    this.wheels = WHEELS.map((name, i) => {
      const wheel = model.getObjectByName(name);
      const pivot = new THREE.Group();
      pivot.rotation.order = 'YXZ';
      new THREE.Box3().setFromObject(wheel).getCenter(pivot.position);
      this.body.add(pivot);
      pivot.updateMatrixWorld(true);
      pivot.attach(wheel);
      return { pivot, front: i < 2 };
    });

    // Headlights: one spotlight, no shadow, brighter as night falls.
    this.beam = new THREE.SpotLight(CONFIG.colors.lamp, 0, 120, 0.62, 0.75, 1.35);
    this.beam.position.set(0, 0.8, -1.6);
    this.beam.target.position.set(0, -0.6, -30);
    this.group.add(this.beam, this.beam.target);

    scene.add(this.group);
    this.radius = 1.1;
    this.spin = 0;
    this.reset();
  }

  setPaint(variant) {
    this.model.traverse((o) => {
      const m = o.isMesh && o.userData.paints && o.userData.paints[variant];
      if (m) o.material = m;
    });
  }

  // n: 0 = dusk, 1 = night.
  setNight(n) {
    this.beam.intensity = 80 + n * 560;
    for (const m of this.lamps) m.emissiveIntensity = 1.5 + n * 5;
  }

  reset() {
    this.x = 0; this.z = 0; this.speed = 0; this.vx = 0; this.stun = 0;
    this.sync();
  }

  // steer: -1 (left) .. 1 (right). centre: road centre at the car. reach: how far from it the car may stray.
  update(dt, steer, level, offroad, centre, reach) {
    this.stun = Math.max(0, this.stun - dt);
    // Speed builds up gradually; off the road or just after a hit the car can only crawl.
    const max = level.maxSpeed * (offroad ? 0.6 : 1) * (this.stun > 0 ? 0.45 : 1);
    if (this.speed < max) this.speed = Math.min(max, this.speed + level.accel * dt);
    else this.speed += (max - this.speed) * Math.min(1, dt * 2.5);
    // Steering eases in and out instead of snapping.
    const grip = 0.35 + 0.65 * Math.min(1, this.speed / 12);
    this.vx += (steer * level.steer * grip - this.vx) * Math.min(1, dt * 7);
    this.x += this.vx * dt;
    // Deep snow beyond the verge stops the car drifting off into the scenery.
    const off = this.x - centre;
    if (Math.abs(off) > reach) { this.x = centre + Math.sign(off) * reach; this.vx *= 0.5; }
    this.z -= this.speed * dt;
    this.spin -= (this.speed * dt) / WHEEL_RADIUS;
    this.sync();
  }

  // A hit slows the car. It never ends the run.
  hit() {
    this.stun = 0.7;
    this.speed *= 0.45;
  }

  sync() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = -this.vx * 0.016;
    this.body.rotation.z = this.vx * 0.0035;
    this.body.rotation.x = -this.stun * 0.045;
    for (const w of this.wheels) {
      w.pivot.rotation.x = this.spin;
      w.pivot.rotation.y = w.front ? -this.vx * 0.022 : 0;
    }
  }
}
