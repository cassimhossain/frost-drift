// Everything brand-facing lives here. To rebrand, change this file only.
// Game code must read names, colors and the collectible from CONFIG, never hardcode them.
export const CONFIG = {
  name: 'Frost Drift',
  tagline: 'Two minutes. One frozen road. Forest to city, dusk to night.',

  // Used by the share button. Point this at wherever the game is hosted.
  shareUrl: 'https://cassimhossain.github.io/frost-drift/',
  storageKey: 'frost-drift.best',

  colors: {
    ice: '#8fd3ff',      // icy blue: UI text and highlights
    pine: '#1f4d3a',     // deep pine green: fir needles, UI panels
    accent: '#ff8a2b',   // warm orange: collectible and UI accents
    snow: '#eef4fa',     // tint multiplied over the snow texture
    road: '#8fa3b8',     // tint multiplied over the road texture
    sun: '#ffb07a',      // low dusk sunlight
    moon: '#8fb2ff',     // night light
    lamp: '#ffc98a',     // street lamps and headlights
    nightFog: '#060a14',
  },

  // The thing the player collects. A brand can swap the name and points here;
  // the shape is drawn in World.buildCanisters().
  collectible: { name: 'turbo canister', plural: 'turbo canisters', points: 10 },

  // Car models. To add one: put a .glb in assets/models/, describe it here, then list it under `cars`.
  // faceZ: 1 if the model's nose points along +z, -1 if along -z. lift: metres to raise it so the tyres touch the road.
  // wheels: node names, front pair first. hidden: node names to hide. headlight/brakelight: material names that glow.
  carModels: {
    concept: {
      file: 'car_concept.glb', faceZ: 1, lift: 0.16, wheelRadius: 0.54,
      wheels: ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'],
      hidden: ['License_Plate', 'InteriorSteeringEmblem'],
      headlight: 'Headlight', brakelight: 'Brakelight',
    },
  },

  // The garage. `variant` picks a paint finish stored inside the model file (omit it if the model has none).
  cars: [
    { name: 'Concept GT Carmine', model: 'concept', variant: 0, swatch: '#b3122a' },
    { name: 'Concept GT Pearl', model: 'concept', variant: 1, swatch: '#e9e6df' },
    { name: 'Concept GT Graphite', model: 'concept', variant: 2, swatch: '#3b3f46' },
  ],

  // Camera views, cycled with the View button or the C key. Distances are in metres from the car.
  views: [
    { name: 'Chase', back: 7.2, up: 2.7, ahead: 7, lookUp: 1.1, lag: 4 },
    { name: 'Low', back: 5.6, up: 1.3, ahead: 10, lookUp: 0.9, lag: 6 },
    { name: 'Bonnet', back: -0.75, up: 1.22, ahead: 30, lookUp: 0.8, lag: 60 },
    { name: 'High', back: 13, up: 9.5, ahead: 14, lookUp: 0, lag: 3 },
  ],

  // Performance limits. See CLAUDE.md before raising any of these.
  // "high" is used on computers, "low" on phones and tablets. Add ?quality=high or ?quality=low to the URL to force one.
  quality: {
    maxPixelRatio: 2,
    maxObjects: 600,
    high: { pixelRatio: 2, shadowMapSize: 2048, bloom: true, msaa: 4, snowflakes: 1500, spray: 90, trees: 1 },
    low: { pixelRatio: 1.5, shadowMapSize: 1024, bloom: false, msaa: 0, snowflakes: 500, spray: 40, trees: 0.6 },
  },

  // Pooled object counts. Their sum must stay at or under quality.maxObjects.
  counts: { trees: 240, rocks: 24, canisters: 10, sparks: 48, buildings: 48, lamps: 14 },
};
