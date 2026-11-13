import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG } from './config.js';
import { LEVELS, RUN_SECONDS } from './levels.js';
import { loadAssets } from './assets.js';
import { Player } from './player.js';
import { World } from './world.js';
import { UI, Input } from './ui.js';
import { Effects } from './effects.js';

// Computers get the full picture; phones and tablets get a lighter one. ?quality=high|low forces a tier.
const forced = new URLSearchParams(location.search).get('quality');
const phone = window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600;
const tier = CONFIG.quality[forced === 'high' || forced === 'low' ? forced : phone ? 'low' : 'high'];

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !tier.bloom, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.pixelRatio, CONFIG.quality.maxPixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.3, 600);
const input = new Input();
const ui = new UI({ onRestart: restart });

let composer = null;
if (tier.bloom) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: tier.msaa });
  composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.55, 1.0));
  composer.addPass(new OutputPass());
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const assets = await loadAssets(renderer);
const world = new World(scene, assets, tier);
const player = new Player(scene, assets);
const effects = new Effects(scene);
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();

let score = 0, elapsed = 0, level = LEVELS[0];

function restart() {
  score = 0;
  elapsed = 0;
  level = LEVELS[0];
  player.reset();
  world.reset(level);
  effects.reset();
  camPos.set(0, 3, 9);
  camLook.set(0, 1, -8);
  ui.setScore(score);
}

function levelAt(t) {
  let end = 0;
  for (const l of LEVELS) { end += l.duration; if (t < end) return l; }
  return LEVELS[LEVELS.length - 1];
}

function step(dt) {
  elapsed = (elapsed + dt) % RUN_SECONDS;
  const next = levelAt(elapsed);
  if (next !== level) { level = next; world.setLevel(level); }
  world.setTime(elapsed / RUN_SECONDS);
  player.setNight(world.night);

  const centre = world.roadX(player.z);
  const offroad = Math.abs(player.x - centre) > world.roadHalf;
  player.update(dt, input.steer, level, offroad, centre, world.roadHalf + world.edge);

  const r = world.collide(player);
  if (r.hit) { player.hit(); effects.hit(); }
  for (let i = 0; i < r.count; i++) effects.burst(r.picked[i], player.speed);
  effects.update(dt);
  if (r.count) {
    score += r.count * CONFIG.collectible.points;
    ui.setScore(score);
  }

  // Camera follows with a slight delay sideways, pulls back and widens as speed builds.
  const pace = player.speed / LEVELS[LEVELS.length - 1].maxSpeed;
  const portrait = camera.aspect < 1;
  const k = 1 - Math.exp(-dt * 4);
  camPos.x += (player.x - player.vx * 0.12 - camPos.x) * k;
  camPos.y += ((portrait ? 3.6 : 2.7) + pace * 0.5 - camPos.y) * k;
  camPos.z = player.z + (portrait ? 9.5 : 7.2) + pace * 1.6;
  camLook.x += (player.x + player.vx * 0.3 - camLook.x) * (1 - Math.exp(-dt * 6));
  camLook.y = 1.1;
  camLook.z = player.z - 7;
  camera.position.copy(camPos).add(effects.offset);
  camera.lookAt(camLook);
  const fov = (portrait ? 72 : 56) + pace * 9;
  if (Math.abs(fov - camera.fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }

  world.update(dt, player, camera);
}

restart();

let last = performance.now();
const draw = () => { if (composer) composer.render(); else renderer.render(scene, camera); };
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  step(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle for the console and for automated checks.
window.__game = { player, world, input, camera, renderer, scene, tier,
  tick(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) step(dt); draw(); }, get score() { return score; }, get elapsed() { return elapsed; }, set elapsed(v) { elapsed = v; } };
