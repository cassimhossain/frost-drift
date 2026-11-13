# Changelog

Newest first.

## 0.3.0 - Realistic world

- Changed direction from low-poly to realistic, desktop-first. `CLAUDE.md` asset and performance rules rewritten to match.
- Real car model with spinning, steering wheels, headlights and three paint finishes.
- Sky photo lights the scene; one soft shadow from a low sun; fog matched to the horizon; bloom on bright lights.
- Textured snow terrain with hills, asphalt road with lane markings, falling snow.
- Fir forest built by copying one tree; scanned rocks with snow caps.
- City: high-rise blocks with lit windows and street lamps, also built by copying.
- Light shifts from dusk to night; windows, lamps and headlights brighten as it gets dark.
- Two quality tiers: high on computers, low on phones.
- Three.js pinned at 0.170.0. Assets and licences listed in `CREDITS.md`.

## 0.2.0 - Feel

- Camera follows with a slight delay and pulls back as speed builds.
- Speed builds up gradually; steering eases in and out.
- Small screen shake on a hit, sparks on a pickup.
- Forgiving collisions: obstacle hit areas are smaller than they look, pickup areas larger.

## 0.1.0 - Playable core

- Car drives down a curving snowy road; steer with arrow keys or by holding the left/right half of the screen.
- Trees and rocks are placed at random beside the road, never on it. Hitting one slows the car.
- Turbo canisters on the road add to the score.
