<div align="center">

# Storm Wizard

**Type the answer. Strike the hail.**

An arcade math game: hail falls on the sky islands, and every stone carries a sum. Answer it and your lightning finds it. It runs in the browser with a keyboard, mouse, controller or touch screen.

### [▶ Play it now](https://leeeeeroyj.github.io/storm-wizard/)

[![Deploy](https://github.com/leeeeeroyj/storm-wizard/actions/workflows/deploy.yml/badge.svg)](https://github.com/leeeeeroyj/storm-wizard/actions/workflows/deploy.yml)
![Phaser 4](https://img.shields.io/badge/Phaser-4-8a5cf6)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

![Storm Wizard: a lightning bolt from the left tower bursts a hailstone under the cloud deck, while the wizard waits on his small cloud beside the answer box, below three floating islands with cottages and towers](docs/screenshot.png)

</div>

## About

Storm Wizard is an original arcade game inspired by the mechanics of Atari's 1980 arcade game *Missile Command*, rebuilt to drill the four math operations. The game is being built in the open; this is how it plays today.

- **Type the answer, strike the hail.** Every hailstone carries a sum on a white plate. Type its answer and the wizard's wand twinkles, then the nearest tower's lightning bolt bursts it. There's no Enter key: the bolt fires the moment the number is right.
- **Mistakes teach.** A wrong digit fizzles (the wand puffs smoke and the box clears). A stone that gets through shows its whole fact, like `7 × 8 = 56`, big over the impact, and that fact comes back a few stones later.
- **Chains.** A blast catches any hailstone or split cloud that drifts into it.
- **The storm's roster.** Each plate has its own border, so you can tell them apart without colour:

  | Threat | Plate | What it does |
  |---|---|---|
  | Hailstone | Plain | Falls straight at a cottage or tower |
  | Split cloud | Underlined | Bursts into three new stones at mid-sky unless you answer it first |
  | Ball lightning | Dashed edges | Zigzags as it falls, and blasts can't catch it |
  | Storm Crow | Double border, a diamond each side | Crosses high with a harder problem. Answer it for a gift: **Gust** slows the storm, **Mend** rebuilds a cottage, **Ward** shields one |

- **Streaks and the Thunderclap.** Every three right answers in a row raise the multiplier, up to ×8. At ×4 you can spend the streak on a Thunderclap that strikes every stone in the sky at once, or keep it and keep climbing.
- **The islands under the storm.** Three floating islands hold three towers and six cottages under a drifting cloud deck and falling rain. The Storm Wizard rides his own little cloud beside the answer box.
- **Made to be read.** Every number uses Atkinson Hyperlegible, a typeface designed so that similar letters and digits are easy to tell apart.

## How to play

1. Press **START** (Enter, A on a controller, or a click or tap).
2. Hail falls towards the cottages and towers. Read a stone's sum and type the answer. When the box matches, the bolt fires by itself.
3. If two stones have the same answer, one answer strikes both.
4. Right answers in a row build the multiplier (the pips beside ×1 fill towards the next step). From ×4 a bolt sign appears: press **Space** (Y on a controller) for a Thunderclap.
5. A digit that can't lead to any answer on screen is a misfire: the box clears and the digits pause for a moment.
6. A cottage takes two hits: first its roof, then it's rubble. A struck tower is stunned for 5 seconds and the others fire instead.
7. The storm wins when all six cottages are rubble, and the game shows the facts to practise.

Waves, settings for which facts you drill, saving what you've learned, and touch controls are on the way.

## Controls

| Action | Keyboard + mouse | Controller | Touch |
|---|---|---|---|
| Start | Enter or Space, or click START | A or Start | Tap START |
| Type a digit | 0–9 (top row or numpad) | Point the left stick at a digit on the arc (or step with the D-pad), then A | coming soon |
| Delete a digit | Backspace | B | coming soon |
| Thunderclap (at ×4 or more) | Space | Y | coming soon |
| Sound on or off | M | Back | coming soon |

## Run it locally

You need [Node.js](https://nodejs.org/) `^20.19.0` or `>=22.12.0`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check and build to dist/
```

Every push to `main` builds the game and deploys it to GitHub Pages.

## Project layout

```
assets/          served as-is: sprites/ (16×16 PNGs) and fonts/ (with their licences)
design/          concept sheet, sprite candidates and the build plan
docs/            the screenshot above
src/
  main.ts        boots Phaser, loads the fonts
  config.ts      every tunable in one place
  facts.ts       the facts, and the picker that keeps answers from being prefixes of each other
  answer.ts      the answer box's rules: match, misfire, stale prefix
  controls.ts    the keyboard and the controller's digit arc
  synth.ts       Web Audio voices; sfx.ts and music.ts play in D Dorian
  sky.ts         the sky, clouds, rain and islands, drawn in code
  islands.ts     towers, cottages and the wizard
  scenes/        Title, Sky (the game) and Hud
tools/           sprite picker (sprites.py) and the headless-Chrome tests
```

## Credits

- **Sprites:** from the CC0 [Angais/pixel-art-atlas-1.4m](https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m) collection of AI-generated pixel art, found with [Pixel Search](https://huggingface.co/spaces/cfahlgren1/pixel-search).
- **Fonts:** [Pirata One](https://fonts.google.com/specimen/Pirata+One) by Rodrigo Fuenzalida and Nicolas Massi, and [Atkinson Hyperlegible Next](https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next) and [Atkinson Hyperlegible Mono](https://fonts.google.com/specimen/Atkinson+Hyperlegible+Mono) by the Atkinson Hyperlegible Project Authors (all SIL Open Font License).
- **Engine:** [Phaser](https://phaser.io/).
- **Inspiration:** Atari's *Missile Command*. Storm Wizard is an original game and isn't affiliated with or endorsed by the original's rights holders.

## License

The code is released under the [MIT License](LICENSE). The sprites in `assets/sprites/` and `design/` are CC0 (public domain), and the fonts in `assets/fonts/` are under the SIL Open Font License.
