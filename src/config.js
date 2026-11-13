// Everything brand-facing lives here. To rebrand, change this file only.
// Game code must read names, colors and the collectible from CONFIG, never hardcode them.
export const CONFIG = {
  name: 'Frost Drift',
  tagline: 'Two minutes. One snowy road. Grab every canister.',

  // Used by the share button. Point this at wherever the game is hosted.
  shareUrl: 'https://cassimhossain.github.io/frost-drift/',
  storageKey: 'frost-drift.best',

  colors: {
    ice: '#8fd3ff',      // icy blue: UI text, car glass glow
    pine: '#1f4d3a',     // deep pine green: trees, UI panels
    accent: '#ff8a2b',   // warm orange: collectible and UI accents
    snow: '#eaf3f9',
    road: '#b4cfe2',
    car: '#2a8fd8',
    carDark: '#10202e',
    rock: '#6f7f8c',
    trunk: '#5a3d2b',
    duskTop: '#27336b',
    duskHorizon: '#f0a070',
    nightTop: '#040816',
    nightHorizon: '#14244a',
  },

  // The thing the player collects. A brand can swap the name and points here;
  // the shape is drawn in World.buildCanisters().
  collectible: { name: 'turbo canister', plural: 'turbo canisters', points: 10 },

  // Performance limits. See CLAUDE.md before raising any of these.
  quality: { maxPixelRatio: 2, shadowMapSize: 1024, maxObjects: 200 },

  // Pooled object counts. Their sum must stay at or under quality.maxObjects.
  counts: { trees: 64, rocks: 24, canisters: 10, sparks: 48 },
};
