import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';

const VIEW_AHEAD = 200;   // how far ahead of the car objects exist
const VIEW_BEHIND = 26;   // objects further behind than this get recycled
const ROAD_HALF = 5;      // half the road width
const EDGE = 6;           // how far past the road edge the car can stray (deep snow beyond)
const FLAT = 11;          // ground stays level this far past the road edge, then hills begin
const ROAD_SEGS = 110;
const CELL = 4;           // terrain grid spacing
const T_COLS = 97, T_ROWS = 68;
const FACADE_TILE = 36;   // metres covered by one repeat of a facade texture
const SUNK = 8;           // how far buildings extend below ground so hills never expose their base

// Forgiving on purpose: obstacles are smaller than they look, pickups are bigger.
const HIT_SCALE = 0.68;   // multiplies obstacle hit radius
const PICK_RADIUS = 2.3;  // canister pickup distance

const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

export class World {
  constructor(scene, assets, tier) {
    this.scene = scene;
    this.assets = assets;
    this.tier = tier;
    this.roadHalf = ROAD_HALF;
    this.edge = EDGE;
    this.level = null;
    this.time = 0;
    this.night = 0;
    this.dummy = new THREE.Object3D();
    this.result = { hit: false, picked: [], count: 0 };
    for (let i = 0; i < CONFIG.counts.canisters; i++) this.result.picked.push(new THREE.Vector3());

    const total = Object.values(CONFIG.counts).reduce((a, b) => a + b, 0);
    if (total > CONFIG.quality.maxObjects) {
      throw new Error('Object budget exceeded: see CONFIG.quality.maxObjects');
    }

    this.buildSky();
    this.buildGround();
    this.buildTrees();
    this.buildRocks();
    this.buildBuildings();
    this.buildLamps();
    this.buildCanisters();
    this.buildSnowfall();
  }

  // Centre of the road at depth z. Bends get wider the further you drive.
  roadX(z) {
    const d = Math.abs(z);
    const amp = 4 + Math.min(d / 3500, 1) * 7;
    return amp * (Math.sin(z * 0.014) + 0.5 * Math.sin(z * 0.031 + 1.3));
  }

  // Direction the road points at depth z, as a heading: 0 is straight ahead, positive bends right.
  roadHeading(z) {
    return Math.atan(-this.roadSlope(z));
  }

  roadSlope(z) {
    return (this.roadX(z - 1) - this.roadX(z + 1)) / -2;
  }

  // Ground height. Level on and beside the road, rolling hills further out.
  height(x, z, centre = this.roadX(z)) {
    const d = Math.abs(x - centre) - ROAD_HALF - FLAT;
    if (d <= 0) return 0;
    const s = smooth(Math.min(1, d / 80));
    const n = 0.5 + 0.5 * Math.sin(x * 0.021 + z * 0.013);
    const m = 0.5 + 0.5 * Math.sin(x * 0.047 - z * 0.035 + 2);
    return s * (1.5 + 10 * n + 4 * m);
  }

  // ---------- sky, light, fog ----------

  buildSky() {
    const a = this.assets, c = CONFIG.colors;
    // Sun sits ahead and to the left, low over the trees, so shadows rake across the road.
    const az = THREE.MathUtils.degToRad(58), el = THREE.MathUtils.degToRad(17);
    this.sunDir = new THREE.Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    // Turn the sky photo so its sunset glow lines up with that direction.
    const turn = a.sunAzimuth - Math.atan2(this.sunDir.z, this.sunDir.x);
    this.scene.background = a.sky;
    this.scene.environment = a.env;
    this.scene.backgroundRotation.y = turn;
    this.scene.environmentRotation.y = turn;

    this.fog = new THREE.Fog(0xffffff, 60, VIEW_AHEAD + 15);
    this.scene.fog = this.fog;

    this.sunColor = new THREE.Color(c.sun);
    this.moonColor = new THREE.Color(c.moon);
    this.nightFog = new THREE.Color(c.nightFog);
    this.sun = new THREE.DirectionalLight(c.sun, 3);
    this.sun.castShadow = true;
    const sh = this.sun.shadow, size = this.tier.shadowMapSize;
    sh.mapSize.set(size, size);
    sh.camera.left = -85; sh.camera.right = 85; sh.camera.top = 85; sh.camera.bottom = -85;
    sh.camera.near = 20; sh.camera.far = 420;
    sh.bias = -0.0005;
    sh.normalBias = 0.35;
    this.scene.add(this.sun, this.sun.target);
  }

  // t: 0 = dusk, 1 = full night.
  setTime(t) {
    const n = smooth(Math.max(0, Math.min(1, t)));
    this.night = n;
    const sky = lerp(0.5, 0.035, n);
    this.scene.backgroundIntensity = sky;
    this.scene.environmentIntensity = lerp(0.62, 0.13, n);
    this.fog.color.copy(this.assets.horizon).multiplyScalar(sky * 0.8).lerp(this.nightFog, n * 0.6);
    this.sun.color.copy(this.sunColor).lerp(this.moonColor, n);
    this.sun.intensity = lerp(3.6, 0.55, n);
    for (const m of this.facadeMats) m.emissiveIntensity = lerp(0.35, 1.5, n);
    this.lampGlow.material.opacity = lerp(0.05, 0.5, n);
    this.lampBulbMat.color.copy(this.lampColor).multiplyScalar(lerp(1.5, 6, n));
    this.canisterMat.emissiveIntensity = lerp(0.5, 1.4, n);
  }

  // ---------- ground and road ----------

  buildGround() {
    const c = CONFIG.colors, t = this.assets.tex;

    // Snowy terrain: a grid that is re-laid around the car as it drives.
    const verts = T_COLS * T_ROWS;
    const geo = new THREE.BufferGeometry();
    this.terrainPos = new Float32Array(verts * 3);
    this.terrainUv = new Float32Array(verts * 2);
    const index = [];
    for (let r = 0; r < T_ROWS - 1; r++) {
      for (let k = 0; k < T_COLS - 1; k++) {
        const a = r * T_COLS + k, b = a + 1, d = a + T_COLS, e = d + 1;
        index.push(a, b, d, b, e, d);
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.terrainPos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.terrainUv, 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    geo.setIndex(index);
    this.snowMat = new THREE.MeshStandardMaterial({
      color: c.snow, map: t.snow.map, normalMap: t.snow.normalMap, roughnessMap: t.snow.roughnessMap,
      normalScale: new THREE.Vector2(1.4, 1.4), roughness: 1, metalness: 0,
    });
    this.terrain = new THREE.Mesh(geo, this.snowMat);
    this.terrain.frustumCulled = false;
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
    this.terrainKey = '';

    // Road, centre dashes and edge lines: ribbons re-laid along roadX() every frame.
    const roadMat = new THREE.MeshStandardMaterial({
      color: c.road, map: t.road.map, normalMap: t.road.normalMap, roughnessMap: t.road.roughnessMap,
      normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, metalness: 0,
    });
    const paint = (dashed) => new THREE.MeshStandardMaterial({
      color: '#e9e6da', map: dashed ? this.makeDashTexture() : null, transparent: true, opacity: 0.85,
      roughness: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    this.strips = [
      this.makeStrip(0, ROAD_HALF, 0.04, roadMat, 2, 1 / 6),
      this.makeStrip(0, 0.09, 0.055, paint(true), 1, 1 / 12),
      this.makeStrip(-ROAD_HALF + 0.35, 0.07, 0.055, paint(false), 1, 1),
      this.makeStrip(ROAD_HALF - 0.35, 0.07, 0.055, paint(false), 1, 1),
    ];
  }

  makeDashTexture() {
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 4, 26);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  makeStrip(offset, half, y, material, uScale, vScale) {
    const verts = (ROAD_SEGS + 1) * 2;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(verts * 3), uv = new Float32Array(verts * 2), nor = new Float32Array(verts * 3);
    for (let i = 0; i < verts; i++) nor[i * 3 + 1] = 1;
    const index = [];
    for (let i = 0; i < ROAD_SEGS; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setIndex(index);
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return { mesh, pos, uv, offset, half, y, uScale, vScale };
  }

  layRoad(player) {
    const z0 = player.z + VIEW_BEHIND + 10, len = VIEW_AHEAD + VIEW_BEHIND + 40;
    for (const s of this.strips) {
      for (let i = 0; i <= ROAD_SEGS; i++) {
        const z = z0 - (i / ROAD_SEGS) * len, cx = this.roadX(z) + s.offset, o = i * 6, u = i * 4;
        s.pos[o] = cx - s.half; s.pos[o + 1] = s.y; s.pos[o + 2] = z;
        s.pos[o + 3] = cx + s.half; s.pos[o + 4] = s.y; s.pos[o + 5] = z;
        s.uv[u] = 0; s.uv[u + 1] = z * s.vScale;
        s.uv[u + 2] = s.uScale; s.uv[u + 3] = z * s.vScale;
      }
      s.mesh.geometry.attributes.position.needsUpdate = true;
      s.mesh.geometry.attributes.uv.needsUpdate = true;
    }
  }

  layTerrain(player) {
    const ox = Math.round(player.x / CELL) * CELL, oz = Math.round(player.z / CELL) * CELL;
    const key = ox + ':' + oz;
    if (key === this.terrainKey) return;
    this.terrainKey = key;
    const p = this.terrainPos, uv = this.terrainUv, half = (T_COLS - 1) / 2;
    let i = 0, j = 0;
    for (let r = 0; r < T_ROWS; r++) {
      const z = oz + 36 - r * CELL, cx = this.roadX(z);
      for (let k = 0; k < T_COLS; k++) {
        const x = ox + (k - half) * CELL;
        p[i++] = x; p[i++] = this.height(x, z, cx); p[i++] = z;
        uv[j++] = x / 7; uv[j++] = z / 7;
      }
    }
    const g = this.terrain.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.uv.needsUpdate = true;
    g.computeVertexNormals();
  }

  // ---------- trees ----------

  // A fir bough drawn with code: stem, twigs, needles and a dusting of snow.
  makeBoughTexture() {
    const S = 512, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const hsl = new THREE.Color(CONFIG.colors.pine).getHSL({});
    const hue = hsl.h * 360, sat = Math.max(28, hsl.s * 70);
    g.lineCap = 'round';
    const snow = [];
    const line = (x0, y0, x1, y1, width, style) => {
      g.strokeStyle = style; g.lineWidth = width;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    };
    const twigs = [];
    const mid = S / 2;
    for (let x = 22; x < 450; x += 24) {
      const reach = 46 + 175 * Math.sin(Math.PI * Math.min(1, (x + 70) / 540)) * (1 - x / 640);
      for (const side of [-1, 1]) twigs.push([x, mid, side * rand(0.6, 0.92), reach * rand(0.8, 1.1), false]);
    }
    twigs.push([4, mid, 0, 500, true]);
    // Pass 1: a solid dark body under every twig so the bough stays opaque when seen from far away.
    for (const [x0, y0, ang, len, main] of twigs) {
      line(x0, y0, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len, main ? 30 : 20, `hsl(${hue}, ${sat}%, 8%)`);
    }
    // Pass 2: needles.
    for (const [x0, y0, ang, len, main] of twigs) {
      const steps = Math.floor(len / 2);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, px = x0 + Math.cos(ang) * len * t, py = y0 + Math.sin(ang) * len * t;
        for (const side of [-1, 1]) {
          const a = ang + side * rand(0.5, 1.1), nl = (main ? 24 : 17) * (1 - 0.4 * t) * rand(0.7, 1.3);
          line(px, py, px + Math.cos(a) * nl, py + Math.sin(a) * nl, rand(1.8, 3),
            `hsl(${hue + rand(-16, 8)}, ${sat + rand(-8, 10)}%, ${rand(10, 27)}%)`);
        }
        if (Math.random() < (main ? 0.22 : 0.1)) snow.push([px, py, (main ? rand(6, 11) : rand(3, 7)) * (1 - 0.4 * t)]);
      }
    }
    // Pass 3: snow lying along the top of the twigs.
    for (const [x, y, r] of snow) {
      g.fillStyle = `rgba(${228 + rand(0, 16)}, ${236 + rand(0, 12)}, 250, ${rand(0.7, 0.95)})`;
      g.beginPath(); g.ellipse(x, y, r * 1.4, r * 0.8, rand(0, 3), 0, Math.PI * 2); g.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  // One fir: whorls of drooping boughs, each a flat card plus an upright card so it reads from any angle.
  makeFoliageGeometry() {
    const pos = [], uv = [], nor = [], idx = [];
    const card = (b, t, s, n) => {
      const i = pos.length / 3;
      pos.push(b.x - s.x, b.y - s.y, b.z - s.z, t.x - s.x, t.y - s.y, t.z - s.z,
        t.x + s.x, t.y + s.y, t.z + s.z, b.x + s.x, b.y + s.y, b.z + s.z);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      for (let k = 0; k < 4; k++) nor.push(n.x, n.y, n.z);
      idx.push(i, i + 1, i + 2, i, i + 2, i + 3, i, i + 2, i + 1, i, i + 3, i + 2); // both faces, shared soft normals
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const levels = 16;
    for (let k = 0; k < levels; k++) {
      const t = k / (levels - 1), y = 1.5 + t * 7.6, L = lerp(3.3, 0.6, Math.pow(t, 0.85));
      const n = k < 10 ? 7 : 5;
      for (let b = 0; b < n; b++) {
        const a = (b / n) * Math.PI * 2 + k * 0.9 + rand(-0.15, 0.15);
        const len = L * rand(0.85, 1.12), droop = len * rand(0.3, 0.45), W = len * 0.5;
        const dir = V(Math.cos(a), 0, Math.sin(a)), side = V(-Math.sin(a), 0, Math.cos(a));
        const base = dir.clone().multiplyScalar(0.05).setY(y), tip = dir.clone().multiplyScalar(len).setY(y - droop);
        const soft = dir.clone().multiplyScalar(0.75).setY(0.7).normalize();
        card(base, tip, side.clone().multiplyScalar(W), soft);
        card(base, tip, V(0, W * 0.42, 0), soft);
      }
    }
    const up = V(0, 1, 0);
    card(V(0, 8.5, 0), V(0, 10.5, 0), V(0.75, 0, 0), up);
    card(V(0, 8.5, 0), V(0, 10.5, 0), V(0, 0, 0.75), up);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setIndex(idx);
    return geo;
  }

  buildTrees() {
    const count = CONFIG.counts.trees, t = this.assets.tex;
    const trunk = new THREE.CylinderGeometry(0.06, 0.27, 9.8, 7, 1, true).translate(0, 4.9, 0);
    const tuv = trunk.attributes.uv;
    for (let i = 0; i < tuv.count; i++) tuv.setXY(i, tuv.getX(i) * 2, tuv.getY(i) * 5);
    const barkMat = new THREE.MeshStandardMaterial({ map: t.bark.map, normalMap: t.bark.normalMap, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ map: this.makeBoughTexture(), alphaTest: 0.3, roughness: 0.88 });
    this.treeMeshes = [
      new THREE.InstancedMesh(trunk, barkMat, count),
      new THREE.InstancedMesh(this.makeFoliageGeometry(), leafMat, count),
    ];
    for (const m of this.treeMeshes) {
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    }
    this.trees = Array.from({ length: count }, () => ({ x: 0, z: 0, r: 0, hit: false }));
  }

  // Trees and rocks are only ever placed beyond the road edge, never on the road.
  placeTree(i, z) {
    const t = this.trees[i], lv = this.level;
    const side = Math.random() < 0.5 ? -1 : 1;
    let s = rand(0.75, 1.55);
    t.z = z;
    t.x = this.roadX(z) + side * (ROAD_HALF + lv.shoulder + s * 0.9 + Math.pow(Math.random(), 1.5) * lv.spread);
    t.hit = false;
    const planted = Math.random() < lv.trees * this.tier.trees && !this.insideBuilding(t.x, t.z, 3 * s);
    if (!planted) s = 0;
    t.r = 0.9 * s;
    this.dummy.position.set(t.x, this.height(t.x, t.z) - 0.2, t.z);
    this.dummy.rotation.set(rand(-0.04, 0.04), rand(0, Math.PI * 2), rand(-0.04, 0.04));
    this.dummy.scale.set(s, s * rand(0.9, 1.15), s);
    this.dummy.updateMatrix();
    for (const m of this.treeMeshes) { m.setMatrixAt(i, this.dummy.matrix); m.instanceMatrix.needsUpdate = true; }
  }

  // ---------- rocks ----------

  // Adds a cap of snow to whatever faces the sky.
  snowCap(material) {
    material.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vSnowUp;')
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
          #ifdef USE_INSTANCING
            vSnowUp = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal).y;
          #else
            vSnowUp = normalize(mat3(modelMatrix) * objectNormal).y;
          #endif`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vSnowUp;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.95), smoothstep(0.35, 0.75, vSnowUp));`);
    };
    return material;
  }

  buildRocks() {
    const count = CONFIG.counts.rocks, t = this.assets.tex;
    // Scale the scanned rock so it is about 2.4 m long and sits on the ground.
    const geo = this.assets.rockGeometry.clone();
    geo.computeBoundingBox();
    const b = geo.boundingBox, size = b.getSize(new THREE.Vector3()), mid = b.getCenter(new THREE.Vector3());
    const k = 2.4 / Math.max(size.x, size.z);
    geo.translate(-mid.x, -b.min.y, -mid.z).scale(k, k, k);
    const mat = this.snowCap(new THREE.MeshStandardMaterial({ map: t.rock.map, normalMap: t.rock.normalMap, roughness: 0.92 }));
    this.rockMesh = new THREE.InstancedMesh(geo, mat, count);
    this.rockMesh.frustumCulled = false;
    this.rockMesh.castShadow = true;
    this.rockMesh.receiveShadow = true;
    this.scene.add(this.rockMesh);
    this.rocks = Array.from({ length: count }, () => ({ x: 0, z: 0, r: 1, hit: false }));
  }

  placeRock(i, z) {
    const r = this.rocks[i];
    const side = Math.random() < 0.5 ? -1 : 1;
    const s = rand(0.7, 1.35);
    r.z = z;
    r.x = this.roadX(z) + side * (ROAD_HALF + 0.7 + s + rand(0, 5.5));
    r.r = 0.9 * s;
    r.hit = false;
    this.dummy.position.set(r.x, this.height(r.x, r.z) - 0.18 * s, r.z);
    this.dummy.rotation.set(rand(-0.15, 0.15), rand(0, Math.PI * 2), rand(-0.15, 0.15));
    this.dummy.scale.set(s, s * rand(0.8, 1.2), s);
    this.dummy.updateMatrix();
    this.rockMesh.setMatrixAt(i, this.dummy.matrix);
    this.rockMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- buildings ----------

  buildBuildings() {
    const t = this.assets.tex;
    const facades = [t.facadeA, t.facadeB, t.facadeC];
    // [width, height, depth] for a low and a tall block per facade.
    const sizes = [[[20, 15, 16], [24, 46, 20]], [[16, 21, 16], [26, 66, 22]], [[22, 12, 18], [22, 54, 20]]];
    const per = Math.floor(CONFIG.counts.buildings / 6);
    const roof = new THREE.MeshStandardMaterial({ color: CONFIG.colors.snow, map: t.snow.map, roughness: 1 });
    this.facadeMats = [];
    this.buildings = [];
    facades.forEach((f, fi) => {
      const mat = new THREE.MeshStandardMaterial({
        map: f.map, normalMap: f.normalMap, roughnessMap: f.roughnessMap, roughness: 1, metalness: 0.15,
        emissiveMap: f.emissiveMap, emissive: '#ffffff', emissiveIntensity: 0.4,
      });
      this.facadeMats.push(mat);
      sizes[fi].forEach(([w, h, d], tall) => {
        const full = h + SUNK;
        const geo = new THREE.BoxGeometry(w, full, d).translate(0, full / 2 - SUNK, 0);
        // Repeat the facade by real size so windows are the same scale on every block.
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
          const face = Math.floor(i / 4); // +x, -x, +y, -y, +z, -z
          const across = face < 2 ? d : w, updown = face === 2 || face === 3 ? d / 8 : full / FACADE_TILE;
          uv.setXY(i, uv.getX(i) * (face === 2 || face === 3 ? w / 8 : across / FACADE_TILE), uv.getY(i) * updown);
        }
        const mesh = new THREE.InstancedMesh(geo, [mat, mat, roof, roof, mat, mat], per);
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        for (let i = 0; i < per; i++) {
          this.buildings.push({ mesh, index: i, w, d, tall: tall === 1, x: 0, z: 0, r: 0, active: false });
        }
      });
    });
    this.plotZ = [0, 0];
  }

  hideBuilding(b) {
    b.active = false;
    this.dummy.position.set(0, -500, 0);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    b.mesh.setMatrixAt(b.index, this.dummy.matrix);
    b.mesh.instanceMatrix.needsUpdate = true;
  }

  insideBuilding(x, z, r) {
    for (const b of this.buildings) {
      if (!b.active) continue;
      const dx = b.x - x, dz = b.z - z, reach = b.r + r;
      if (dx * dx + dz * dz < reach * reach) return true;
    }
    return false;
  }

  // Fill roadside plots ahead of the car, reusing blocks that have fallen behind it.
  layBuildings(player) {
    const far = player.z - VIEW_AHEAD - 30, behind = player.z + VIEW_BEHIND + 30, lv = this.level;
    for (let side = 0; side < 2; side++) {
      let guard = 0;
      while (this.plotZ[side] > far && guard++ < 6) {
        const z = this.plotZ[side];
        let b = null;
        if (Math.random() < lv.buildings) {
          const wantTall = lv.tall && Math.random() < 0.65, start = Math.floor(Math.random() * this.buildings.length);
          for (let k = 0; k < this.buildings.length && !b; k++) {
            const c = this.buildings[(start + k) % this.buildings.length];
            if ((!c.active || c.z > behind) && c.tall === wantTall) b = c;
          }
        }
        if (!b) { this.plotZ[side] -= rand(16, 30); continue; }
        const sign = side ? 1 : -1, zc = z - b.w / 2, slope = this.roadSlope(zc);
        b.active = true;
        b.z = zc;
        b.x = this.roadX(zc) + sign * (ROAD_HALF + EDGE + 7 + b.d / 2 + rand(0, lv.tall ? 3 : 10));
        b.r = Math.max(b.w, b.d) * 0.62;
        this.dummy.position.set(b.x, 0, b.z);
        // Turn the block so its width runs along the road and its depth runs away from it.
        this.dummy.rotation.set(0, Math.atan(slope) + Math.PI / 2, 0);
        this.dummy.scale.set(1, rand(0.85, 1.15), 1);
        this.dummy.updateMatrix();
        b.mesh.setMatrixAt(b.index, this.dummy.matrix);
        b.mesh.instanceMatrix.needsUpdate = true;
        this.plotZ[side] -= b.w + rand(3, lv.tall ? 8 : 22);
      }
    }
  }

  // ---------- street lamps ----------

  buildLamps() {
    const n = CONFIG.counts.lamps;
    this.lampColor = new THREE.Color(CONFIG.colors.lamp);
    const pole = mergeGeometries([
      new THREE.CylinderGeometry(0.08, 0.13, 9, 8).translate(0, 4.5, 0),
      new THREE.BoxGeometry(4.3, 0.12, 0.14).translate(2.1, 8.95, 0),
      new THREE.BoxGeometry(1.0, 0.16, 0.4).translate(4.2, 8.9, 0),
    ]);
    this.lampPoles = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: '#2b3036', roughness: 0.5, metalness: 0.8 }), n);
    this.lampPoles.castShadow = true;
    this.lampBulbMat = new THREE.MeshBasicMaterial({ color: this.lampColor.clone(), toneMapped: false });
    this.lampBulbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.86, 0.06, 0.3).translate(4.2, 8.79, 0), this.lampBulbMat, n);
    // Pool of light on the road under each lamp: a soft additive disc, far cheaper than a real light.
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    this.lampGlow = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(26, 26).rotateX(-Math.PI / 2).translate(6, 0.09, 0),
      new THREE.MeshBasicMaterial({
        color: this.lampColor, map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }), n);
    for (const m of [this.lampPoles, this.lampBulbs, this.lampGlow]) { m.frustumCulled = false; this.scene.add(m); }
    this.lampNext = 0;
    this.lampZ = 0;
  }

  setLamp(i, x, z, turn, on) {
    this.dummy.position.set(x, on ? 0 : -500, z);
    this.dummy.rotation.set(0, turn, 0);
    this.dummy.scale.setScalar(on ? 1 : 0);
    this.dummy.updateMatrix();
    for (const m of [this.lampPoles, this.lampBulbs, this.lampGlow]) { m.setMatrixAt(i, this.dummy.matrix); m.instanceMatrix.needsUpdate = true; }
  }

  layLamps(player) {
    const far = player.z - VIEW_AHEAD - 10;
    let guard = 0;
    while (this.lampZ > far && guard++ < 4) {
      if (this.level.lamps) {
        const i = this.lampNext, side = i % 2 ? 1 : -1, z = this.lampZ;
        this.lampNext = (i + 1) % CONFIG.counts.lamps;
        // The arm (local +x) points back toward the road.
        this.setLamp(i, this.roadX(z) + side * (ROAD_HALF + EDGE + 1), z, side > 0 ? Math.PI : 0, true);
      }
      this.lampZ -= 30;
    }
  }

  // ---------- canisters ----------

  // The collectible. Swap these shapes to change what the player picks up.
  buildCanisters() {
    const c = CONFIG.colors;
    const bodyGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.9, 20);
    const bandGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.1, 20);
    const neckGeo = new THREE.CylinderGeometry(0.13, 0.22, 0.26, 16).translate(0, 0.58, 0);
    this.canisterMat = new THREE.MeshStandardMaterial({ color: c.accent, emissive: c.accent, emissiveIntensity: 0.6, roughness: 0.28, metalness: 0.85 });
    const steel = new THREE.MeshStandardMaterial({ color: '#cfd6dc', roughness: 0.22, metalness: 1 });
    this.canisters = [];
    for (let i = 0; i < CONFIG.counts.canisters; i++) {
      const g = new THREE.Group();
      const top = new THREE.Mesh(bandGeo, steel), bottom = new THREE.Mesh(bandGeo, steel);
      top.position.y = 0.3; bottom.position.y = -0.3;
      g.add(new THREE.Mesh(bodyGeo, this.canisterMat), new THREE.Mesh(neckGeo, steel), top, bottom);
      g.traverse((o) => { o.castShadow = true; });
      g.rotation.z = 0.3;
      this.scene.add(g);
      this.canisters.push({ mesh: g, x: 0, z: 0 });
    }
  }

  placeCanister(c, minZ) {
    this.nextCanisterZ = Math.min(this.nextCanisterZ, minZ);
    c.z = this.nextCanisterZ;
    c.x = this.roadX(c.z) + 3.3 * Math.sin(c.z * 0.05);
    c.mesh.visible = true;
    this.nextCanisterZ -= this.level.canisterGap * rand(0.8, 1.2);
  }

  // ---------- snowfall ----------

  buildSnowfall() {
    const n = this.tier.snowflakes;
    this.flakes = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.flakes[i * 3] = rand(-45, 45);
      this.flakes[i * 3 + 1] = rand(0, 32);
      this.flakes[i * 3 + 2] = rand(-90, 12);
    }
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const g = cv.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.flakes, 3));
    this.snowfall = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.16, map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true,
    }));
    this.snowfall.frustumCulled = false;
    this.scene.add(this.snowfall);
  }

  updateSnowfall(dt, cam) {
    const f = this.flakes;
    for (let i = 0; i < f.length; i += 3) {
      f[i] += (1.2 + Math.sin(this.time + i) * 0.6) * dt;
      f[i + 1] -= (2.2 + (i % 7) * 0.25) * dt;
      // Keep every flake inside a box that travels with the camera.
      if (f[i + 1] < 0) f[i + 1] += 32;
      if (f[i] > cam.x + 45) f[i] -= 90; else if (f[i] < cam.x - 45) f[i] += 90;
      if (f[i + 2] > cam.z + 12) f[i + 2] -= 102; else if (f[i + 2] < cam.z - 90) f[i + 2] += 102;
    }
    this.snowfall.geometry.attributes.position.needsUpdate = true;
  }

  // ---------- run control ----------

  setLevel(level) {
    this.level = level;
  }

  reset(level) {
    this.level = level;
    this.nextCanisterZ = -40;
    this.plotZ[0] = this.plotZ[1] = -40;
    this.lampZ = -30;
    this.lampNext = 0;
    this.terrainKey = '';
    for (const b of this.buildings) this.hideBuilding(b);
    for (let i = 0; i < CONFIG.counts.lamps; i++) this.setLamp(i, 0, 0, 0, false);
    this.trees.forEach((_, i) => this.placeTree(i, rand(-VIEW_AHEAD, VIEW_BEHIND)));
    this.rocks.forEach((_, i) => this.placeRock(i, rand(-VIEW_AHEAD, VIEW_BEHIND)));
    this.canisters.forEach((c) => this.placeCanister(c, -40));
  }

  update(dt, player, camera) {
    this.time += dt;
    this.layTerrain(player);
    this.layRoad(player);
    this.layBuildings(player);
    this.layLamps(player);

    // Recycle anything that fell behind the car to the far end of the view.
    const behind = player.z + VIEW_BEHIND, far = player.z - VIEW_AHEAD;
    for (let i = 0; i < this.trees.length; i++) if (this.trees[i].z > behind) this.placeTree(i, far - rand(0, 10));
    for (let i = 0; i < this.rocks.length; i++) if (this.rocks[i].z > behind) this.placeRock(i, far - rand(0, 10));
    for (let i = 0; i < this.canisters.length; i++) {
      const c = this.canisters[i];
      if (c.z > player.z + 8) this.placeCanister(c, player.z - 45);
      c.mesh.position.set(c.x, 1.05 + Math.sin(this.time * 3 + i) * 0.15, c.z);
      c.mesh.rotation.y += dt * 2.5;
    }
    this.updateSnowfall(dt, camera.position);

    // The shadow-casting light follows the car in coarse steps so shadow edges do not crawl.
    const tx = Math.round(player.x / 8) * 8, tz = Math.round((player.z - 45) / 8) * 8;
    this.sun.target.position.set(tx, 0, tz);
    this.sun.position.set(tx, 0, tz).addScaledVector(this.sunDir, 220);
  }

  // Returns { hit, picked, count } for this frame. The result object is reused, never allocated during play.
  collide(player) {
    const result = this.result;
    result.hit = false;
    result.count = 0;
    for (const list of [this.trees, this.rocks]) {
      for (const o of list) {
        if (o.hit || o.r === 0) continue;
        const dz = o.z - player.z;
        if (Math.abs(dz) > 5) continue;
        const dx = o.x - player.x, reach = (o.r + player.radius) * HIT_SCALE;
        if (dx * dx + dz * dz < reach * reach) { o.hit = true; result.hit = true; }
      }
    }
    for (const c of this.canisters) {
      if (!c.mesh.visible) continue;
      const dx = c.x - player.x, dz = c.z - player.z;
      if (dx * dx + dz * dz < PICK_RADIUS * PICK_RADIUS) {
        result.picked[result.count++].set(c.x, 1, c.z);
        c.mesh.visible = false;
        c.z = Infinity; // recycled on the next update
      }
    }
    return result;
  }
}
