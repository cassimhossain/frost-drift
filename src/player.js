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
    this.x = 0; this.z = 0; this.heading = 0; this.wheel = 0; this.roll = 0; this.pitch = 0;
    this.setCar(CONFIG.cars[0]);
    this.reset();
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
    this.x = 0; this.z = 0;
    this.heading = 0;            // radians; 0 points down the road (-z), positive turns right
    this.speed = 0;              // forward speed along the heading, negative in reverse
    this.velX = 0; this.velZ = 0; // actual velocity; differs from the heading while the car slides
    this.wheel = 0;              // steering wheel, -1..1, eased
    this.yawRate = 0;
    this.roll = 0; this.pitch = 0;
    this.stun = 0; this.braking = false;
    this.furthest = 0;           // road modes: how far down the road the car has been
    this.sync();
  }

  get vx() { return this.velX; }

  // drive: { steer, throttle } each -1..1.
  // tune: { maxSpeed, accel } plus the handling numbers in CONFIG.driving.
  // road: null in the open world; in road modes { centre, reach, tangent, offroad } keeps the car on its strip.
  update(dt, drive, tune, road) {
    const d = CONFIG.driving;
    this.stun = Math.max(0, this.stun - dt);

    // Steering wheel eases toward the input instead of snapping, and returns to centre a little faster.
    const turnRate = drive.steer === 0 ? d.wheelReturn : d.wheelTurn;
    this.wheel += (drive.steer - this.wheel) * (1 - Math.exp(-dt * turnRate));

    // Split the current velocity into forward and sideways parts.
    let sin = Math.sin(this.heading), cos = Math.cos(this.heading);
    let fwd = this.velX * sin - this.velZ * cos;
    let side = this.velX * cos + this.velZ * sin;

    // Engine, brakes, reverse.
    const max = tune.maxSpeed * (road && road.offroad ? 0.6 : 1) * (this.stun > 0 ? 0.45 : 1);
    const before = fwd;
    if (drive.throttle > 0) {
      if (fwd < 0) fwd = Math.min(0, fwd + d.brake * dt);
      else if (fwd < max) fwd = Math.min(max, fwd + tune.accel * drive.throttle * (1 - 0.55 * fwd / max) * dt);
    } else if (drive.throttle < 0) {
      if (fwd > 0.4) fwd = Math.max(0, fwd - d.brake * dt);
      else fwd = Math.max(-d.reverseSpeed, fwd - d.reverseAccel * dt);
    } else {
      fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), (d.coast + 0.012 * fwd * fwd) * dt);
    }
    if (fwd > max) fwd += (max - fwd) * Math.min(1, dt * 2.5);
    this.braking = this.stun > 0 || (drive.throttle < 0 && before > 0.4) || fwd < before - 6 * dt;

    // Turning. The car needs to be rolling to turn, and turns less sharply the faster it goes.
    const rolling = Math.min(1, Math.abs(fwd) / d.turnSpeed);
    const lock = d.yawSlow + (d.yawFast - d.yawSlow) * Math.min(1, Math.abs(fwd) / 40);
    const old = this.heading;
    if (road) {
      // On the road modes the car aims along the road and the wheel swings it to either side,
      // so letting go straightens up on its own.
      const aim = road.tangent + this.wheel * d.roadSwing * (0.35 + 0.65 * rolling) * Math.sign(fwd || 1);
      this.heading += (aim - this.heading) * (1 - Math.exp(-dt * d.roadAlign));
    } else {
      this.heading += this.wheel * lock * rolling * Math.sign(fwd || 1) * dt;
    }
    this.yawRate = (this.heading - old) / Math.max(dt, 1e-4);

    // Tyres pull the sideways slide back to zero: quickly on tarmac, slowly on snow.
    const grip = road && road.offroad ? d.gripSnow : d.gripRoad;
    side *= Math.exp(-grip * dt);

    sin = Math.sin(this.heading); cos = Math.cos(this.heading);
    this.speed = fwd;
    this.velX = sin * fwd + cos * side;
    this.velZ = -cos * fwd + sin * side;
    this.x += this.velX * dt;
    this.z += this.velZ * dt;

    if (road) {
      // Deep snow beyond the verge stops the car drifting off into the scenery.
      const off = this.x - road.centre;
      if (Math.abs(off) > road.reach) { this.x = road.centre + Math.sign(off) * road.reach; this.velX *= 0.3; }
      // The road behind is cleared away as the car drives, so it can only back up a short way.
      this.furthest = Math.min(this.furthest, this.z);
      if (this.z > this.furthest + d.backUp) { this.z = this.furthest + d.backUp; this.velZ = Math.min(0, this.velZ); }
    }

    // Body leans out of corners, squats under power and dives under brakes.
    const ease = 1 - Math.exp(-dt * 6);
    this.roll += (Math.max(-0.07, Math.min(0.07, this.yawRate * fwd * 0.0016)) - this.roll) * ease;
    this.pitch += (Math.max(-0.035, Math.min(0.035, (fwd - before) / Math.max(dt, 1e-4) * 0.0022)) - this.stun * 0.045 - this.pitch) * ease;
    this.spin -= (fwd * dt) / this.rig.radius;
    this.sync();
  }

  // A hit slows the car. It never ends the run.
  hit() {
    this.stun = 0.7;
    this.velX *= 0.45;
    this.velZ *= 0.45;
    this.speed *= 0.45;
  }

  sync() {
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = -this.heading;
    this.body.rotation.z = this.roll;
    this.body.rotation.x = this.pitch;
    for (const w of this.rig.wheels) {
      w.pivot.rotation.x = this.spin;
      w.pivot.rotation.y = w.front ? -this.wheel * 0.42 : 0;
    }
    // Lamps glow harder at night; brake lights flare while the car is slowing.
    for (const m of this.rig.head) m.emissiveIntensity = 1.5 + this.night * 5;
    for (const m of this.rig.brake) m.emissiveIntensity = 1 + this.night * 2 + (this.braking ? 9 : 0);
  }
}
