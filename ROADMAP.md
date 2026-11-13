# Roadmap

Ideas for what to build next, roughly in order of value for effort. Every item must respect the rules in `CLAUDE.md`.

## Next

- **Sound**: engine hum that rises with speed, a pickup chime, a thud on a hit. Generate with the Web Audio API so there are still no asset files. Add a mute button.
- **Combo multiplier**: consecutive canisters without a hit raise a multiplier. Gives skilled players a reason to replay.
- **Drift boost**: holding a direction through a long bend charges a short speed boost. Makes the name mean something.
- **Tilt steering**: optional phone tilt control, off by default.

## Later

- **Brand skin**: a second `config.js` preset to prove the brand swap works end to end (name, colors, collectible shape).
- **Ghost car**: replay your best run as a translucent car.
- **Daily road**: seed the road and canister layout from the date so everyone drives the same road each day.
- **More worlds**: desert canyon at sunset, neon city at night, selected in config.
- **Leaderboard**: needs a backend, so only when there is a real audience.

## Known limits

- The share link in `config.js` is fixed text. If the game moves, update `shareUrl`.
- Best score is stored per browser. Clearing site data resets it.
- Collision is circle against circle. Good enough at this scale; revisit if obstacles get long or thin.
