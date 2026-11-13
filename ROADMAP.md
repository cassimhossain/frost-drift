# Roadmap

Ideas for what to build next, roughly in order of value for effort. Every item must respect the rules in `CLAUDE.md`, or change them on purpose first.

## Next

- **More cars**: the garage already supports any number of models. It needs realistic, freely licensed `.glb` cars without real car-maker logos; see "Add a car" in the README.
- **Open-world mode**: a city grid with junctions where the car can accelerate, brake, reverse and turn onto other roads, with solid collisions against buildings. Needs new controls (up/down arrows, on-screen pedals), so the Controls rule in `CLAUDE.md` has to change first.
- **Sound**: engine note that rises with speed, pickup chime, thud on a hit. Generate with the Web Audio API so there are no audio files. Add a mute button.
- **Traffic**: other cars on the road to weave through, copied from one model like the trees.
- **Combo multiplier**: consecutive canisters without a hit raise a multiplier.
- **Drift boost**: holding a direction through a long bend charges a short speed boost.

## Later

- **People**: pedestrians on the pavements. Needs a freely licensed, animated character model.
- **Wet road at night**: reflections of lamps and windows on the asphalt.
- **Ghost car**: replay your best run as a translucent car.
- **Daily road**: seed the road and canister layout from the date so everyone drives the same road each day.
- **More worlds**: desert canyon at sunset, coast road, selected in config.
- **Leaderboard**: needs a backend, so only when there is a real audience.

## Known limits

- Not yet tested on a real phone. The low quality tier is a best guess; the car model alone is about 210,000 triangles.
- First load downloads about 25 MB of assets.
- The share link in `config.js` is fixed text. If the game moves, update `shareUrl`.
- Best score is stored per browser. Clearing site data resets it.
- Collision is circle against circle. Buildings are not solid; the car simply cannot leave the strip beside the road.
- Fir trees are drawn with code on flat cards. They read well at speed, less so up close.
