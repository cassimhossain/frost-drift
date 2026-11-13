# Frost Drift

A realistic 3D driving game that runs in the browser. Drive a concept sports car down a frozen road from a fir forest into a city at night, collect turbo canisters, and stay off the trees and rocks.

Play it: https://cassimhossain.github.io/frost-drift/

## Modes

- **Timed Run**: 3 levels in about 2 minutes (forest, outskirts, city). Dusk turns to night as you drive. Your best score is saved.
- **Free Drive**: no timer, the road loops through all three areas. Scores are not saved.

## Controls

- Computer: left and right arrow keys steer (A and D also work). Up is gas, down is brake then reverse (W and S). C changes the camera view. Enter starts a run.
- Phone: tap or hold the left or right half of the screen to steer. Hold Brake to slow down and reverse. The View button changes the camera.
- The car pulls away by itself, so steering alone is enough to play.

## Run it locally

There is no build step. The game is plain ES modules, and Three.js loads from a CDN at a pinned version (0.170.0).

ES modules do not load from `file://`, so serve the folder:

```
cd frost-drift
python3 -m http.server 8000
```

Then open http://localhost:8000. To test on your phone, use your computer's local IP address (for example http://192.168.1.20:8000) while both are on the same Wi-Fi.

Computers get the full-quality picture and phones a lighter one. Add `?quality=high` or `?quality=low` to the address to force either.

## Change the brand

Everything brand-facing is in `src/config.js`. You should not need to touch any other file.

| What | Where in `CONFIG` |
| --- | --- |
| Game name (title, start screen, share text) | `name` |
| Line under the title | `tagline` |
| Link the share button copies | `shareUrl` |
| Colors | `colors.ice`, `colors.pine`, `colors.accent`, and the rest of `colors` |
| Collectible name and points | `collectible` |
| Cars in the garage | `cars` and `carModels` |
| Camera views | `views` |

To change the shape of the collectible, edit `buildCanisters()` in `src/world.js`.

## Add a car

1. Put the model in `assets/models/`. `.glb` is best: it keeps paint, glass, lights and separate wheels.
2. Add an entry to `carModels` in `src/config.js`: file name, which way the nose points, how far to lift it so the tyres touch the road, the names of its four wheel parts, and the names of its headlight and brake-light materials.
3. Add it to `cars` so it shows up on the start screen.
4. List its author, source and licence in `CREDITS.md`. Only CC0 or CC BY models, and no real car-maker logos.

## Files

| File | Job |
| --- | --- |
| `index.html` | Page, styles, screens, import map for Three.js |
| `src/config.js` | Brand, colors, collectible, cars, camera views, quality tiers, performance limits |
| `src/levels.js` | The 3 levels and their difficulty numbers |
| `src/main.js` | Renderer, game loop, modes, scoring, camera |
| `src/assets.js` | Loads models, textures and the sky photo |
| `src/player.js` | The car: model rig, lights and driving |
| `src/world.js` | Sky, light, terrain, road, trees, rocks, buildings, lamps, canisters, snowfall, collisions |
| `src/effects.js` | Screen shake, pickup sparks, wheel snow spray |
| `src/ui.js` | Controls, in-run display, screens, share, saved best score |
| `assets/` | Downloaded models, textures and sky. See `CREDITS.md` |

## Deploy

GitHub Pages serves the `main` branch from the repository root (Settings → Pages → Deploy from a branch → `main` / root). Push to `main` and the live game updates in about a minute. The empty `.nojekyll` file tells Pages to serve the files as they are.

See `ROADMAP.md` for next ideas, `CHANGELOG.md` for history, `CREDITS.md` for asset licences, and `CLAUDE.md` for the rules that must not be broken.
