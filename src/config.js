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

  // Paint options for the car. `variant` is the index of a material variant inside the car model.
  paints: [
    { name: 'Carmine', swatch: '#b3122a', variant: 0 },
    { name: 'Pearl', swatch: '#e9e6df', variant: 1 },
    { name: 'Graphite', swatch: '#3b3f46', variant: 2 },
  ],

  // Performance limits. See CLAUDE.md before raising any of these.
  // "high" is used on computers, "low" on phones and tablets. Add ?quality=high or ?quality=low to the URL to force one.
  quality: {
    maxPixelRatio: 2,
    maxObjects: 600,
    high: { pixelRatio: 2, shadowMapSize: 2048, bloom: true, msaa: 4, snowflakes: 1500, trees: 1 },
    low: { pixelRatio: 1.5, shadowMapSize: 1024, bloom: false, msaa: 0, snowflakes: 500, trees: 0.6 },
  },

  // Pooled object counts. Their sum must stay at or under quality.maxObjects.
  counts: { trees: 240, rocks: 24, canisters: 10, sparks: 48, buildings: 48, lamps: 14 },
};
