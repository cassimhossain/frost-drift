// Three levels, 40 seconds each, so one run lasts about 2 minutes.
// maxSpeed/accel/steer are in world units per second (1 unit = 1 metre).
// canisterGap: distance between canisters. shoulder: clear gap between road edge and trees.
// trees: share of the tree pool that is planted. spread: how far from the road trees reach.
// buildings: chance that a roadside plot gets a building. tall: allow high-rises. lamps: street lamps.
export const LEVELS = [
  { name: 'Pine Run',        duration: 40, maxSpeed: 27, accel: 5, steer: 15, canisterGap: 26, shoulder: 2.6,
    trees: 1.0,  spread: 62, buildings: 0,    tall: false, lamps: false },
  { name: 'Frozen Outskirts', duration: 40, maxSpeed: 35, accel: 6, steer: 18, canisterGap: 22, shoulder: 1.7,
    trees: 0.55, spread: 46, buildings: 0.45, tall: false, lamps: true },
  { name: 'Midnight City',   duration: 40, maxSpeed: 43, accel: 7, steer: 21, canisterGap: 18, shoulder: 1.0,
    trees: 0.22, spread: 5,  buildings: 1,    tall: true,  lamps: true },
];

export const RUN_SECONDS = LEVELS.reduce((sum, l) => sum + l.duration, 0);
