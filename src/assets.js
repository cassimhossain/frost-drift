import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// Loads every downloaded asset once, before play starts. Sources and licences are in CREDITS.md.
const BASE = new URL('../assets/', import.meta.url).href;

const TEXTURES = {
  snow: ['snow_diff', 'snow_nor', 'snow_rough'],
  road: ['road_diff', 'road_nor', 'road_rough'],
  bark: ['bark_diff', 'bark_nor'],
  rock: ['rock_diff', 'rock_nor'],
  facadeA: ['facade_a_color', 'facade_a_nor', 'facade_a_rough', 'facade_a_emit'],
  facadeB: ['facade_b_color', 'facade_b_nor', 'facade_b_rough', 'facade_b_emit'],
  facadeC: ['facade_c_color', 'facade_c_nor', 'facade_c_rough', 'facade_c_emit'],
};
const SLOTS = ['map', 'normalMap', 'roughnessMap', 'emissiveMap'];

export async function loadAssets(renderer, onProgress = () => {}) {
  const jobs = [];
  let done = 0;
  const track = (p) => {
    jobs.push(p);
    p.then(() => onProgress(++done / jobs.length), () => {});
    return p;
  };

  const texLoader = new THREE.TextureLoader();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = {};
  for (const [name, files] of Object.entries(TEXTURES)) {
    tex[name] = {};
    files.forEach((file, i) => {
      track(texLoader.loadAsync(`${BASE}textures/${file}.jpg`).then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = aniso;
        if (SLOTS[i] === 'map' || SLOTS[i] === 'emissiveMap') t.colorSpace = THREE.SRGBColorSpace;
        tex[name][SLOTS[i]] = t;
      }));
    });
  }

  const gltf = new GLTFLoader();
  const out = { tex };
  track(gltf.loadAsync(`${BASE}models/car_concept.glb`).then(async (g) => {
    // The model ships three paint jobs as material variants. Resolve them now so swapping is instant.
    const pending = [];
    g.scene.traverse((o) => {
      const maps = o.isMesh && o.userData.gltfExtensions?.KHR_materials_variants?.mappings;
      if (!maps) return;
      o.userData.paints = {};
      for (const m of maps) {
        pending.push(g.parser.getDependency('material', m.material).then((mat) => {
          for (const v of m.variants) o.userData.paints[v] = mat;
        }));
      }
    });
    await Promise.all(pending);
    out.car = g.scene;
  }));
  track(gltf.loadAsync(`${BASE}models/rock_07.gltf`).then((g) => {
    let geo;
    g.scene.traverse((o) => { if (o.isMesh) geo = o.geometry; });
    out.rockGeometry = geo;
  }));
  track(new RGBELoader().loadAsync(`${BASE}sky/winter_lake_01_2k.hdr`).then((hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    out.sky = hdr;
    Object.assign(out, analyseSky(hdr));
    const pmrem = new THREE.PMREMGenerator(renderer);
    out.env = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
  }));

  await Promise.all(jobs);
  return out;
}

// Finds where the sun glow sits in the sky photo and the average colour just above the horizon,
// so the scene's sunlight and fog can match the photo.
function analyseSky(hdr) {
  const { data, width, height } = hdr.image;
  const f = data instanceof Uint16Array ? THREE.DataUtils.fromHalfFloat : (v) => v;
  let best = -1, bu = 0, bv = 0;
  const horizon = new THREE.Color(0, 0, 0);
  let n = 0;
  for (let y = 0; y < height; y += 4) {
    const band = y > height * 0.43 && y < height * 0.49;
    for (let x = 0; x < width; x += 4) {
      const i = (y * width + x) * 4;
      const r = f(data[i]), g = f(data[i + 1]), b = f(data[i + 2]);
      const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
      if (lum > best) { best = lum; bu = x / width; bv = y / height; }
      if (band) { horizon.r += Math.min(r, 4); horizon.g += Math.min(g, 4); horizon.b += Math.min(b, 4); n++; }
    }
  }
  horizon.multiplyScalar(1 / n);
  // Azimuth of the sun in the photo, in the same convention Three.js uses to look up the sky.
  const sunAzimuth = (bu - 0.5) * Math.PI * 2;
  return { horizon, sunAzimuth, sunRow: bv };
}
