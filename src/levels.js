// Three levels, 40 seconds each, so one run lasts about 2 minutes.
// maxSpeed/accel/steer are in world units per second.
// canisterGap: distance between canisters. shoulder: clear gap between road edge and trees.
export const LEVELS = [
  { name: 'Pine Run',       duration: 40, maxSpeed: 26, accel: 5, steer: 15, canisterGap: 26, shoulder: 2.6 },
  { name: 'Frozen Bends',   duration: 40, maxSpeed: 34, accel: 6, steer: 18, canisterGap: 22, shoulder: 1.7 },
  { name: 'Night Blizzard', duration: 40, maxSpeed: 42, accel: 7, steer: 21, canisterGap: 18, shoulder: 1.0 },
];

export const RUN_SECONDS = LEVELS.reduce((sum, l) => sum + l.duration, 0);
