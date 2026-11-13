import * as THREE from 'three';
import { CONFIG } from './config.js';
import { LEVELS } from './levels.js';
import { Player } from './player.js';
import { World } from './world.js';
import { UI, Input } from './ui.js';
import { Effects } from './effects.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.quality.maxPixelRatio));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
const world = new World(scene);
const player = new Player(scene);
const input = new Input();
const effects = new Effects(scene);
const camPos = new THREE.Vector3(0, 5.5, 10);
const camLook = new THREE.Vector3(0, 1, -8);
const ui = new UI({ onRestart: restart });

let score = 0;

function restart() {
  score = 0;
  player.reset();
  world.reset();
  effects.reset();
  camPos.set(0, 5.5, 10);
  camLook.set(0, 1, -8);
  ui.setScore(score);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 75 : 60; // wider view on portrait phones
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function step(dt) {
  const level = LEVELS[0];
  const offroad = Math.abs(player.x - world.roadX(player.z)) > world.roadHalf;
  player.update(dt, input.steer, level, offroad);
  world.update(dt, player);

  const r = world.collide(player);
  if (r.hit) { player.hit(); effects.hit(); }
  for (const p of r.picked) effects.burst(p, player.speed);
  effects.update(dt);
  if (r.picked.length) {
    score += r.picked.length * CONFIG.collectible.points;
    ui.setScore(score);
  }

  // Camera follows with a slight delay sideways, pulls back and widens as speed builds.
  const pace = player.speed / level.maxSpeed;
  const k = 1 - Math.exp(-dt * 4);
  camPos.x += (player.x - camPos.x) * k;
  camPos.y += (5.2 + pace * 0.8 - camPos.y) * k;
  camPos.z = player.z + 9 + pace * 2.5;
  camLook.x += (player.x + player.vx * 0.25 - camLook.x) * (1 - Math.exp(-dt * 6));
  camLook.z = player.z - 8;
  camera.position.copy(camPos).add(effects.offset);
  camera.lookAt(camLook);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  step(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle for the console and for automated checks.
window.__game = { player, world, input, camera, renderer, scene, get score() { return score; } };
