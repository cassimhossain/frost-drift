import * as THREE from 'three';
import { CONFIG } from './config.js';

const VIEW_AHEAD = 190;   // how far ahead of the car objects exist
const VIEW_BEHIND = 14;   // objects further behind than this get recycled
const ROAD_HALF = 5;      // half the road width
const ROAD_SEGS = 64;

// Collision tuning.
const HIT_SCALE = 1;      // multiplies obstacle hit radius
const PICK_RADIUS = 1.5;  // canister pickup distance

const rand = (a, b) => a + Math.random() * (b - a);

export class World {
  constructor(scene) {
    this.scene = scene;
    this.roadHalf = ROAD_HALF;
    this.shoulder = 2.6;
    this.canisterGap = 26;
    this.time = 0;
    this.dummy = new THREE.Object3D();

    const n = CONFIG.counts;
    if (n.trees + n.rocks + n.canisters + n.sparks > CONFIG.quality.maxObjects) {
      throw new Error('Object budget exceeded: see CONFIG.quality.maxObjects');
    }

    this.buildLights();
    this.buildGround();
    this.buildTrees();
    this.buildRocks();
    this.buildCanisters();
    this.reset();
  }

  // Centre of the road at depth z. Bends get wider the further you drive.
  roadX(z) {
    const d = Math.abs(z);
    const amp = 4 + Math.min(d / 3500, 1) * 7;
    return amp * (Math.sin(z * 0.014) + 0.5 * Math.sin(z * 0.031 + 1.3));
  }

  buildLights() {
    this.scene.background = new THREE.Color(CONFIG.colors.ice);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#8aa0b4', 0.9);
    this.sun = new THREE.DirectionalLight('#ffffff', 1.2);
    this.sun.position.set(30, 50, 20);
    this.scene.add(this.hemi, this.sun);
  }

  buildGround() {
    const c = CONFIG.colors;
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshLambertMaterial({ color: c.snow })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Road: a ribbon whose vertices are re-laid along roadX() every frame.
    const verts = (ROAD_SEGS + 1) * 2;
    const geo = new THREE.BufferGeometry();
    this.roadPos = new Float32Array(verts * 3);
    const normals = new Float32Array(verts * 3);
    for (let i = 0; i < verts; i++) normals[i * 3 + 1] = 1;
    const index = [];
    for (let i = 0; i < ROAD_SEGS; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.roadPos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setIndex(index);
    this.road = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c.road }));
    this.road.frustumCulled = false;
    this.road.receiveShadow = true;
    this.scene.add(this.road);
  }

  buildTrees() {
    const c = CONFIG.colors, count = CONFIG.counts.trees;
    const trunk = new THREE.CylinderGeometry(0.25, 0.35, 1.2, 6).translate(0, 0.6, 0);
    const leaves = new THREE.ConeGeometry(1.5, 4, 7).translate(0, 3.2, 0);
    const cap = new THREE.ConeGeometry(0.72, 1.7, 7).translate(0, 4.41, 0);
    const lam = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    this.treeMeshes = [
      new THREE.InstancedMesh(trunk, lam(c.trunk), count),
      new THREE.InstancedMesh(leaves, lam(c.pine), count),
      new THREE.InstancedMesh(cap, lam(c.snow), count),
    ];
    for (const m of this.treeMeshes) { m.frustumCulled = false; this.scene.add(m); }
    this.treeMeshes[1].castShadow = true;
    this.trees = Array.from({ length: count }, () => ({ x: 0, z: 0, r: 1, hit: false }));
  }

  buildRocks() {
    const count = CONFIG.counts.rocks;
    this.rockMesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: CONFIG.colors.rock, flatShading: true }),
      count
    );
    this.rockMesh.frustumCulled = false;
    this.rockMesh.castShadow = true;
    this.scene.add(this.rockMesh);
    this.rocks = Array.from({ length: count }, () => ({ x: 0, z: 0, r: 1, hit: false }));
  }

  // The collectible. Swap these shapes to change what the player picks up.
  buildCanisters() {
    const c = CONFIG.colors;
    const bodyGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.95, 8);
    const capGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.28, 8).translate(0, 0.6, 0);
    const bodyMat = new THREE.MeshLambertMaterial({ color: c.accent, emissive: c.accent, emissiveIntensity: 0.55, flatShading: true });
    const capMat = new THREE.MeshLambertMaterial({ color: c.snow, flatShading: true });
    this.canisters = [];
    for (let i = 0; i < CONFIG.counts.canisters; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(bodyGeo, bodyMat), new THREE.Mesh(capGeo, capMat));
      g.rotation.z = 0.35;
      this.scene.add(g);
      this.canisters.push({ mesh: g, x: 0, z: 0 });
    }
  }

  setLevel(level) {
    this.shoulder = level.shoulder;
    this.canisterGap = level.canisterGap;
  }

  // Trees and rocks are only ever placed beyond the road edge, never on the road.
  placeTree(i, z) {
    const t = this.trees[i];
    const side = Math.random() < 0.5 ? -1 : 1;
    const s = rand(0.8, 1.5);
    t.z = z;
    t.x = this.roadX(z) + side * (ROAD_HALF + this.shoulder + s + Math.random() ** 2 * 34);
    t.r = 0.9 * s;
    t.hit = false;
    this.dummy.position.set(t.x, 0, t.z);
    this.dummy.rotation.set(0, rand(0, Math.PI * 2), 0);
    this.dummy.scale.setScalar(s);
    this.dummy.updateMatrix();
    for (const m of this.treeMeshes) { m.setMatrixAt(i, this.dummy.matrix); m.instanceMatrix.needsUpdate = true; }
  }

  placeRock(i, z) {
    const r = this.rocks[i];
    const side = Math.random() < 0.5 ? -1 : 1;
    const s = rand(0.6, 1.3);
    r.z = z;
    r.x = this.roadX(z) + side * (ROAD_HALF + 0.6 + s + rand(0, 6));
    r.r = 0.9 * s;
    r.hit = false;
    this.dummy.position.set(r.x, 0.3 * s, r.z);
    this.dummy.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    this.dummy.scale.set(s, s * rand(0.6, 0.9), s);
    this.dummy.updateMatrix();
    this.rockMesh.setMatrixAt(i, this.dummy.matrix);
    this.rockMesh.instanceMatrix.needsUpdate = true;
  }

  placeCanister(c, minZ) {
    this.nextCanisterZ = Math.min(this.nextCanisterZ, minZ);
    c.z = this.nextCanisterZ;
    c.x = this.roadX(c.z) + 3.3 * Math.sin(c.z * 0.05);
    c.mesh.visible = true;
    this.nextCanisterZ -= this.canisterGap * rand(0.8, 1.2);
  }

  reset() {
    this.nextCanisterZ = -40;
    this.trees.forEach((_, i) => this.placeTree(i, rand(-VIEW_AHEAD, VIEW_BEHIND)));
    this.rocks.forEach((_, i) => this.placeRock(i, rand(-VIEW_AHEAD, VIEW_BEHIND)));
    this.canisters.forEach((c) => this.placeCanister(c, -40));
  }

  update(dt, player) {
    this.time += dt;
    this.ground.position.set(player.x, 0, player.z - 100);

    // Lay the road ribbon from just behind the car out to the fog.
    const p = this.roadPos;
    const z0 = player.z + VIEW_BEHIND + 6, len = VIEW_AHEAD + VIEW_BEHIND + 30;
    for (let i = 0; i <= ROAD_SEGS; i++) {
      const z = z0 - (i / ROAD_SEGS) * len, cx = this.roadX(z), o = i * 6;
      p[o] = cx - ROAD_HALF; p[o + 1] = 0.03; p[o + 2] = z;
      p[o + 3] = cx + ROAD_HALF; p[o + 4] = 0.03; p[o + 5] = z;
    }
    this.road.geometry.attributes.position.needsUpdate = true;

    // Recycle anything that fell behind the car to the far end of the view.
    const behind = player.z + VIEW_BEHIND, far = player.z - VIEW_AHEAD;
    this.trees.forEach((t, i) => { if (t.z > behind) this.placeTree(i, far - rand(0, 8)); });
    this.rocks.forEach((r, i) => { if (r.z > behind) this.placeRock(i, far - rand(0, 8)); });
    this.canisters.forEach((c, i) => {
      if (c.z > player.z + 6) this.placeCanister(c, player.z - 45);
      c.mesh.position.set(c.x, 1.05 + Math.sin(this.time * 3 + i) * 0.15, c.z);
      c.mesh.rotation.y += dt * 3;
    });
  }

  // Returns { hit: bool, picked: [Vector3] } for this frame.
  collide(player) {
    const result = { hit: false, picked: [] };
    const test = (o) => {
      if (o.hit) return;
      const dz = o.z - player.z;
      if (Math.abs(dz) > 4) return;
      const dx = o.x - player.x, reach = (o.r + player.radius) * HIT_SCALE;
      if (dx * dx + dz * dz < reach * reach) { o.hit = true; result.hit = true; }
    };
    this.trees.forEach(test);
    this.rocks.forEach(test);
    for (const c of this.canisters) {
      if (!c.mesh.visible) continue;
      const dx = c.x - player.x, dz = c.z - player.z;
      if (dx * dx + dz * dz < PICK_RADIUS * PICK_RADIUS) {
        result.picked.push(new THREE.Vector3(c.x, 1, c.z));
        c.mesh.visible = false;
        c.z = Infinity; // recycled on the next update
      }
    }
    return result;
  }
}
