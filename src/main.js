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
import { UI, Input, Store } from './ui.js';
import { Effects, Sound } from './effects.js';

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
const store = new Store();
const sound = new Sound();
const ui = new UI({ input, onStart: start, onAgain: () => start(mode), onMenu: menu, onCar: pickCar, onView: nextView, onFinish: finish, onMute: () => ui.setMute(sound.toggle()) });

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

let assets;
try {
  assets = await loadAssets(renderer, (p) => ui.setLoading(p));
} catch (err) {
  ui.loadFailed();
  throw err;
}
const world = new World(scene, assets, tier);
const player = new Player(scene, assets);
const effects = new Effects(scene, tier);

const TOP_SPEED = LEVELS[LEVELS.length - 1].maxSpeed;
const MENU_DUSK = 0.12;      // time of day shown behind the menu
const FREE_DAY = 240;        // seconds for Free Drive to go dusk -> night -> dusk
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const rig = { ...CONFIG.views[0] }; // the view currently in use, eased toward the chosen one
let camHeading = 0;                 // direction the chase camera faces

let state = 'menu';          // 'menu' | 'playing' | 'over'
let mode = 'run';            // 'run' (timed, 3 levels) | 'free' (no timer, no saved score)
let score = 0, elapsed = 0, level = LEVELS[0], view = 0, car = 0, orbit = 0.6;

function levelAt(t) {
  let end = 0;
  for (const l of LEVELS) { end += l.duration; if (t < end) return l; }
  return LEVELS[LEVELS.length - 1];
}

function resetRun() {
  score = 0;
  elapsed = 0;
  level = LEVELS[0];
  input.clear();
  player.reset();
  world.reset(level);
  effects.reset();
  Object.assign(rig, CONFIG.views[view]);
  camHeading = 0;
  camPos.set(0, rig.up, rig.back);
  camLook.set(0, rig.lookUp, -rig.ahead);
}

function menu() {
  state = 'menu';
  resetRun();
  world.setTime(MENU_DUSK);
  player.setNight(world.night);
  ui.setCar(car);
  ui.showStart(store.best);
}

function start(nextMode) {
  mode = nextMode;
  state = 'playing';
  sound.unlock(); // allowed here because starting a run is always a tap or key press
  resetRun();
  ui.showHud(mode);
  ui.setScore(score);
  ui.setLevel(0, level.name);
  if (mode === 'run') ui.setTime(RUN_SECONDS);
  ui.setView(CONFIG.views[view].name);
  ui.banner(mode === 'run' ? 'Level 1' : 'Free drive', level.name);
}

function finish() {
  if (state !== 'playing') return;
  state = 'over';
  input.clear();
  // Only a full Timed Run can set the best score.
  const isBest = mode === 'run' && store.submit(score);
  ui.showEnd({ score, mode, best: store.best, isBest });
}

function pickCar(i) {
  car = i;
  player.setCar(CONFIG.cars[i]);
  ui.setCar(i);
}

function nextView() {
  view = (view + 1) % CONFIG.views.length;
  ui.setView(CONFIG.views[view].name);
}

const drive = { steer: 0, throttle: 0 };
const roadInfo = { centre: 0, reach: 0, tangent: 0, offroad: false };

function play(dt) {
  elapsed += dt;
  if (mode === 'run' && elapsed >= RUN_SECONDS) { finish(); return; }

  const next = levelAt(elapsed % RUN_SECONDS);
  if (next !== level) {
    level = next;
    world.setLevel(level);
    const i = LEVELS.indexOf(level);
    ui.setLevel(i, level.name);
    ui.banner(mode === 'run' ? `Level ${i + 1}` : 'Now entering', level.name);
  }
  world.setTime(mode === 'run' ? elapsed / RUN_SECONDS : 0.5 - 0.5 * Math.cos((elapsed / FREE_DAY) * Math.PI * 2));
  player.setNight(world.night);

  // On the road modes the car pulls away by itself, so steering alone is enough to play.
  // The gas and brake pedals override that whenever they are pressed.
  drive.steer = input.steer;
  drive.throttle = input.throttle || 1;
  roadInfo.centre = world.roadX(player.z);
  roadInfo.reach = world.roadHalf + world.edge;
  roadInfo.tangent = world.roadHeading(player.z);
  roadInfo.offroad = Math.abs(player.x - roadInfo.centre) > world.roadHalf;
  player.update(dt, drive, level, roadInfo);

  const r = world.collide(player);
  if (r.hit) { sound.thud(Math.abs(player.speed) / 30); player.hit(); effects.hit(); }
  for (let i = 0; i < r.count; i++) effects.burst(r.picked[i], player.velX, player.velZ);
  if (r.count) sound.pickup();
  effects.kick(player, dt);
  if (r.count) score += r.count * CONFIG.collectible.points;

  ui.setScore(score);
  ui.setSpeed(Math.abs(player.speed) * 3.6);
  if (mode === 'run') ui.setTime(RUN_SECONDS - elapsed);
  chase(dt, 0.45);
}

// Chase camera. It swings round behind the car with a slight delay, pulls back and widens as speed builds.
// follow: how much of the car's turn the camera copies (1 = stays right behind it).
function chase(dt, follow) {
  const target = CONFIG.views[view], ease = 1 - Math.exp(-dt * 5);
  for (const k of ['back', 'up', 'ahead', 'lookUp', 'lag']) rig[k] += (target[k] - rig[k]) * ease;
  const onCar = rig.back < 0.5; // bonnet view rides with the car
  let turn = player.heading * (onCar ? 1 : follow) - camHeading;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  camHeading += turn * (1 - Math.exp(-dt * rig.lag));
  const sin = Math.sin(camHeading), cos = Math.cos(camHeading);
  const pace = Math.min(1, Math.abs(player.speed) / TOP_SPEED);
  const tall = camera.aspect < 1 && !onCar ? 1.3 : 1; // step back on portrait phones
  const back = rig.back * tall + (onCar ? 0 : pace * 1.6);
  camPos.y += (rig.up * tall + pace * 0.4 - camPos.y) * (1 - Math.exp(-dt * 6));
  camPos.x = player.x - sin * back;
  camPos.z = player.z + cos * back;
  camLook.set(player.x + sin * rig.ahead, rig.lookUp, player.z - cos * rig.ahead);
  camera.position.copy(camPos).add(effects.offset);
  camera.lookAt(camLook);
  setFov((camera.aspect < 1 ? 72 : 56) + pace * 9);
}

// Menu and end screen: the camera circles the parked car.
function showroom(dt) {
  orbit += dt * 0.16;
  const wide = camera.aspect < 1 ? 10 : 8;
  camera.position.set(player.x + Math.sin(orbit) * wide, 1.5 + Math.sin(orbit * 0.7) * 0.35, player.z + Math.cos(orbit) * wide);
  camLook.set(player.x, 0.75, player.z);
  camera.lookAt(camLook);
  setFov(camera.aspect < 1 ? 62 : 42);
}

function setFov(fov) {
  if (Math.abs(fov - camera.fov) < 0.05) return;
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

function step(dt) {
  if (state === 'playing') play(dt); else showroom(dt);
  const slip = Math.abs(player.velX * Math.cos(player.heading) + player.velZ * Math.sin(player.heading));
  sound.update(state === 'playing', player.speed, TOP_SPEED, drive.throttle, slip);
  effects.update(dt);
  world.update(dt, player, camera);
}

menu();

const draw = () => { if (composer) composer.render(); else renderer.render(scene, camera); };
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  step(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle for the console and for automated checks.
window.__game = {
  player, world, input, camera, renderer, scene, tier, effects, store, sound,
  tick(n = 1, dt = 1 / 60, each) { for (let i = 0; i < n; i++) { if (each) each(); step(dt); } draw(); },
  get state() { return state; },
  get score() { return score; },
  get elapsed() { return elapsed; },
  set elapsed(v) { elapsed = v; },
};
