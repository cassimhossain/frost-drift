import * as THREE from 'three';
import { CONFIG } from './config.js';
import { LEVELS } from './levels.js';
import { Player } from './player.js';
import { World } from './world.js';
import { UI, Input } from './ui.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.quality.maxPixelRatio));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
const world = new World(scene);
const player = new Player(scene);
const input = new Input();
const ui = new UI({ onRestart: restart });

let score = 0;

function restart() {
  score = 0;
  player.reset();
  world.reset();
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
  if (r.hit) player.hit();
  if (r.picked.length) {
    score += r.picked.length * CONFIG.collectible.points;
    ui.setScore(score);
  }

  camera.position.set(player.x, 5.5, player.z + 10);
  camera.lookAt(player.x, 1, player.z - 8);
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
