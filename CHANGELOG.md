# Changelog

Newest first.

## 0.6.0 - Real driving

- New car handling: the steering wheel eases in and springs back, the car turns its nose into corners, slides a little on snow, leans, squats and dives.
- Gas, brake and reverse: up/down arrows (W/S) on a computer, a Brake button on phones. With no pedal pressed the car still pulls away by itself, so steering alone is enough.
- Chase camera swings round behind the car. Handling numbers are in `CONFIG.driving`.
- Controls rule in `CLAUDE.md` updated to allow the new pedals.

## 0.5.0 - Share and saved score

- Best Timed Run score is saved in the browser and shown on the start and end screens. If storage is blocked it is kept in memory for the session.
- Share button copies "I scored [score] in Frost Drift" plus the game link. If copying is blocked, the text is shown in a box to copy by hand.

## 0.4.0 - Levels, modes and screens

- Loading screen with a progress bar; start screen with the name in big letters over the live scene.
- Two modes: Timed Run (3 levels, 2 minutes, timer) and Free Drive (no timer, loops forest to city and dusk to night).
- Garage: pick a car on the start screen. Cars and their model files are listed in `src/config.js`.
- Four camera views (Chase, Low, Bonnet, High), switched with the View button or the C key.
- In-run display: score, time left, level, speed. Level banner at each change. End screen with Play again and Menu.
- Car details: brake lights flare when slowing, snow sprays from the rear wheels, a soft shadow sits under the car.

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
