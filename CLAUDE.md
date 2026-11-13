# Rules for working on Frost Drift

These rules must never be broken. If a request conflicts with one, say so and ask before changing anything.

## Look

- Realistic, not cartoon: real models, photo textures, physically based materials, sky-photo lighting, soft shadows, fog.
- Desktop-first. Computers get the "high" quality tier, phones and tablets the "low" tier (`CONFIG.quality`). The game must still be playable on a phone.

## Performance limits

- Renderer pixel ratio is capped at 2 (`CONFIG.quality.maxPixelRatio`). Do not raise it.
- At most 600 pooled objects (`CONFIG.quality.maxObjects`). An object is one tree, rock, building, lamp, canister or spark. `World` throws at startup if `CONFIG.counts` adds up to more.
- Scenery is built by copying one model many times: trees, rocks, buildings, lamps and sparks use `InstancedMesh`. Do not create one mesh per tree, rock or building.
- One shadow-casting light (the sun/moon), one shadow map of at most 2048 px. Headlights and street lamps cast no shadows.
- No real glass refraction (`transmission`) and no second full-scene render passes other than bloom.
- Pool and recycle objects. Do not allocate meshes, geometries or materials during play.

## Assets

- Downloaded assets are allowed only if their licence is CC0 or CC BY. Every one must be listed in `CREDITS.md` with source, author and licence.
- No logos or trademarks of real companies or car makers in the game.
- All assets live in `assets/` and are loaded once, before play, by `src/assets.js`. No audio files yet.
- Keep the whole `assets/` folder under 40 MB.
- No build step. Plain ES modules only. No bundler, no npm dependencies at runtime.
- Three.js and its addons load from a CDN at a pinned version through the import map in `index.html`. Change the version on purpose, never to a floating tag.

## Controls

- Computer: left and right arrow keys.
- Phone: tap or hold the left or right half of the screen.
- Both must always work. Never add a feature that needs a control one of them lacks.

## Game rules

- Timed Run lasts about 2 minutes: 3 levels that get harder (`src/levels.js`), forest to outskirts to city, dusk to night.
- Free Drive has no timer and never saves a score.
- Goal: collect turbo canisters, avoid trees and rocks.
- Trees and rocks are placed at random but never on the road. Buildings and lamps stand beyond the strip the car can reach.
- A hit slows the car; it never ends the run.
- Collisions forgive near misses: obstacle hit areas are smaller than they look, pickup areas larger.
- "Feel" changes (camera, shake, sparks, easing) must not change the rules or scoring.

## Structure

- Name, colors, collectible, paint options and share link live in `src/config.js` only. Game code reads them from `CONFIG`; never hardcode brand values elsewhere.
- Keep the file layout: `index.html`, `src/config.js`, `main.js`, `assets.js`, `player.js`, `world.js`, `levels.js`, `ui.js`, `effects.js`, plus `assets/`.
- Best score is saved in the browser with a fallback when storage is blocked. Storage access must always be wrapped in try/catch.
- The share button copies "I scored [score] in [name]" plus `CONFIG.shareUrl`. If copying is blocked, the text is shown so the player can copy it by hand.

## Before finishing any change

- The game loads with no console errors.
- Touch steering works.
- Play again restarts cleanly.
- Best score survives a reload.
- Add a line to `CHANGELOG.md`.
