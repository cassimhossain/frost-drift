# Rules for working on Frost Drift

These rules must never be broken. If a request conflicts with one, say so and ask before changing anything.

## Performance limits

- Must stay smooth on a mid-range phone.
- Renderer pixel ratio is capped at 2 (`CONFIG.quality.maxPixelRatio`). Do not raise it.
- At most 200 objects on screen (`CONFIG.quality.maxObjects`). An object is one tree, rock, canister or spark. `World` throws at startup if `CONFIG.counts` adds up to more.
- Trees, rocks and sparks use `InstancedMesh`. Do not create one mesh per tree or rock.
- Simple shadows only: one directional light, one shadow map of at most 1024 px. No extra shadow-casting lights.
- Pool and recycle objects. Do not allocate meshes, geometries or materials during play.

## Assets

- No image files, no textures, no model files, no audio files. Everything is drawn or generated with code.
- No build step. Plain ES modules only. No bundler, no npm dependencies at runtime.
- Three.js loads from a CDN at a pinned version through the import map in `index.html`. Change the version on purpose, never to a floating tag.

## Controls

- Computer: left and right arrow keys.
- Phone: tap or hold the left or right half of the screen.
- Both must always work. Never add a feature that needs a control one of them lacks.

## Game rules

- One run lasts about 2 minutes: 3 levels that get harder (`src/levels.js`).
- Goal: collect turbo canisters, avoid trees and rocks.
- Trees and rocks are placed at random but never on the road.
- A hit slows the car; it never ends the run.
- Collisions forgive near misses: obstacle hit areas are smaller than they look, pickup areas larger.
- "Feel" changes (camera, shake, sparks, easing) must not change the rules or scoring.

## Structure

- Name, colors, collectible and share link live in `src/config.js` only. Game code reads them from `CONFIG`; never hardcode brand values elsewhere.
- Keep the file layout: `index.html`, `src/config.js`, `main.js`, `player.js`, `world.js`, `levels.js`, `ui.js`, `effects.js`.
- Best score is saved in the browser with a fallback when storage is blocked. Storage access must always be wrapped in try/catch.
- The share button copies "I scored [score] in [name]" plus `CONFIG.shareUrl`. If copying is blocked, the text is shown so the player can copy it by hand.

## Before finishing any change

- The game loads with no console errors.
- Touch steering works.
- Play again restarts cleanly.
- Best score survives a reload.
- Add a line to `CHANGELOG.md`.
