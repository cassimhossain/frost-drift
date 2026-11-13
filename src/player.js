import * as THREE from 'three';
import { CONFIG } from './config.js';

// The car. Drives toward -z; +x is the right side of the screen.
export class Player {
  constructor(scene, assets) {
    this.group = new THREE.Group(); // position and heading
    this.body = new THREE.Group();  // roll and pitch
    this.group.add(this.body);

    // One rig per car model, built once. Picking a car in the garage only switches which rig is shown.
    this.rigs = {};
    for (const [key, def] of Object.entries(CONFIG.carModels)) this.rigs[key] = this.buildRig(assets.cars[key], def);
    this.rig = null;

    // Soft dark patch under the car. Keeps it planted on the road when the sun shadow is faint.
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d'), grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.75)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.4)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 5.9).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })
    );
    patch.position.y = 0.07;
    this.group.add(patch);

    // Headlights: one spotlight, no shadow, brighter as night falls.
    this.beam = new THREE.SpotLight(CONFIG.colors.lamp, 0, 120, 0.62, 0.75, 1.35);
    this.beam.position.set(0, 0.8, -1.6);
    this.beam.target.position.set(0, -0.6, -30);
    this.group.add(this.beam, this.beam.target);

    scene.add(this.group);
    this.radius = 1.1;
    this.spin = 0;
    this.night = 0;
    this.braking = false;
    this.x = 0; this.z = 0; this.speed = 0; this.vx = 0; this.stun = 0;
    this.setCar(CONFIG.cars[0]);
  }

  buildRig(model, def) {
    const root = new THREE.Group();
    model.rotation.y = def.faceZ > 0 ? Math.PI : 0; // the game drives toward -z
    model.position.y = def.lift;
    root.add(model);
    root.updateMatrixWorld(true);

    const head = [], brake = [];
    const fix = (m) => {
      if (m.transmission > 0) {
        // Real glass refraction needs a second render of the whole scene. Tinted glass looks close and costs nothing.
        m.transmission = 0; m.transparent = true; m.opacity = 0.62; m.color.set('#0b1118');
        m.roughness = 0.04; m.metalness = 0.9; m.depthWrite = false;
      }
      if (m.name === def.headlight && !head.includes(m)) head.push(m);
      if (m.name === def.brakelight && !brake.includes(m)) brake.push(m);
    };
    model.traverse((o) => {
      if (def.hidden.includes(o.name)) o.visible = false;
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      fix(o.material);
      if (o.userData.paints) Object.values(o.userData.paints).forEach(fix);
    });

    // Put each wheel on a pivot at its hub so it can spin and steer.
    const wheels = def.wheels.map((name, i) => {
      const wheel = model.getObjectByName(name);
      const pivot = new THREE.Group();
      pivot.rotation.order = 'YXZ';
      new THREE.Box3().setFromObject(wheel).getCenter(pivot.position);
      root.add(pivot);
      pivot.updateMatrixWorld(true);
      pivot.attach(wheel);
      return { pivot, front: i < 2 };
    });

    root.visible = false;
    this.body.add(root);
    return { root, model, wheels, head, brake, radius: def.wheelRadius };
  }

  // car: one entry of CONFIG.cars.
  setCar(car) {
    if (this.rig) this.rig.root.visible = false;
    this.rig = this.rigs[car.model];
    this.rig.root.visible = true;
    if (car.variant !== undefined) {
      this.rig.model.traverse((o) => {
        const m = o.isMesh && o.userData.paints && o.userData.paints[car.variant];
        if (m) o.material = m;
      });
    }
    this.sync();
  }

  // n: 0 = dusk, 1 = night.
  setNight(n) {
    this.night = n;
    this.beam.intensity = 80 + n * 560;
  }

  reset() {
    this.x = 0; this.z = 0; this.speed = 0; this.vx = 0; this.stun = 0; this.braking = false;
    this.sync();
  }

  // steer: -1 (left) .. 1 (right). centre: road centre at the car. reach: how far from it the car may stray.
  update(dt, steer, level, offroad, centre, reach) {
    this.stun = Math.max(0, this.stun - dt);
    // Speed builds up gradually; off the road or just after a hit the car can only crawl.
    const max = level.maxSpeed * (offroad ? 0.6 : 1) * (this.stun > 0 ? 0.45 : 1);
    this.braking = this.stun > 0 || this.speed > max + 0.5;
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
    this.spin -= (this.speed * dt) / this.rig.radius;
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
    for (const w of this.rig.wheels) {
      w.pivot.rotation.x = this.spin;
      w.pivot.rotation.y = w.front ? -this.vx * 0.022 : 0;
    }
    // Lamps glow harder at night; brake lights flare while the car is slowing.
    for (const m of this.rig.head) m.emissiveIntensity = 1.5 + this.night * 5;
    for (const m of this.rig.brake) m.emissiveIntensity = 1 + this.night * 2 + (this.braking ? 9 : 0);
  }
}
