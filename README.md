# Frost Drift

A small 3D browser game for car fans. Drive a low-poly car down a snowy forest road, collect turbo canisters, and stay off the trees and rocks. One run lasts about 2 minutes across 3 levels.

Play it: https://cassimhossain.github.io/frost-drift/

## Controls

- Computer: left and right arrow keys (A and D also work).
- Phone: tap or hold the left or right half of the screen.

## Run it locally

There is no build step. The game is plain ES modules, and Three.js loads from a CDN at a pinned version (0.160.0).

ES modules do not load from `file://`, so serve the folder:

```
cd frost-drift
python3 -m http.server 8000
```

Then open http://localhost:8000. To test on your phone, use your computer's local IP address (for example http://192.168.1.20:8000) while both are on the same Wi-Fi.

## Change the brand

Everything brand-facing is in `src/config.js`. You should not need to touch any other file.

| What | Where in `CONFIG` |
| --- | --- |
| Game name (title, start screen, share text) | `name` |
| Line under the title | `tagline` |
| Link the share button copies | `shareUrl` |
| Colors | `colors.ice`, `colors.pine`, `colors.accent`, and the rest of `colors` |
| Collectible name and points | `collectible` |

To change the shape of the collectible, edit `buildCanisters()` in `src/world.js`. Draw it with code; the project uses no image files.

## Files

| File | Job |
| --- | --- |
| `index.html` | Page, styles, screens, import map for Three.js |
| `src/config.js` | Brand, colors, collectible, performance limits |
| `src/levels.js` | The 3 levels and their difficulty numbers |
| `src/main.js` | Game loop, state, scoring, camera |
| `src/player.js` | The car: model and driving |
| `src/world.js` | Road, trees, rocks, canisters, sky, light, collisions |
| `src/effects.js` | Screen shake and pickup sparks |
| `src/ui.js` | Controls, HUD, screens, share, saved best score |

## Deploy

GitHub Pages serves the `main` branch from the repository root. Push to `main` and the live game updates in about a minute.

See `ROADMAP.md` for next ideas, `CHANGELOG.md` for history, and `CLAUDE.md` for the rules that must not be broken.
