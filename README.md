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

![Storm Wizard: a lightning bolt from the middle tower bursts a hailstone for 150 points. Above it, a storm crow carries 11 × 12 between two diamonds, a split cloud carries 8 + 5 over an underline, ball lightning carries 9 × 3 between dashed lines, and hailstones carry 7 × 8 and 9 + 6. Behind them, a finely drawn starry sky with a crescent moon and thin wisps. Below, three floating islands of grass, soil and layered rock with roots and vines hanging underneath hold towers and blue cottages facing the middle, one without its roof and one in rubble, and the wizard waits on his small cloud beside the answer box](docs/screenshot.png)

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
- **A sky with depth.** The further away something is, the finer it's drawn: chunky pixels for the islands and cloud deck, half-size pixels for drifting wisps, and the screen's own pixels for the stars, the moon and distant rain. The islands are drawn like the sprites, with turf, soil, moonlit layers of rock, and roots and vines hanging below.
- **Music that follows the storm.** Whimsical harp and flute in D Dorian, played live in the browser. A flute joins from wave 2, drums come in while a stone is close to landing, and the key rises every three waves. Every sound effect is in the same key. **M** turns it all off.
- **Calm when you ask for it.** With your system's reduced-motion setting on, the screen doesn't shake or flash, and nothing on it bobs or blinks.
- **Made to be read.** Every number uses Atkinson Hyperlegible, a typeface designed so that similar letters and digits are easy to tell apart.

## How to play

1. **Choose what to practise** on the title screen: any mix of + − × ÷, how big the numbers get (+ and − within 10, 20 or 100; × and ÷ tables up to 5, 10 or 12), and the pace (Breeze, Gale or Tempest). Your choices are remembered.
2. Press **START**. Hail falls towards the cottages and towers. Read a stone's sum and type the answer. When the box matches, the bolt fires by itself.
3. If two stones have the same answer, one answer strikes both.
4. Right answers in a row build the multiplier (the pips beside ×1 fill towards the next step). From ×4 a bolt sign appears: press **Space** (Y on a controller) for a Thunderclap.
5. A digit that can't lead to any answer on screen is a misfire: the box clears and the digits pause for a moment.
6. A cottage takes two hits: first its roof, then it's rubble. A struck tower is stunned for 5 seconds and the others fire instead. Every 10,000 points rebuilds a cottage.
7. Clear a wave for a bonus for every standing cottage. Each wave is longer and faster, and brings more of the storm's roster.
8. The storm wins when all six cottages are rubble. The game shows your score, the facts to practise, and one press tries again.

**It learns what you know.** Every fact has a box from 0 to 4. A quick right answer moves it up, and a miss sends it back to 0 and brings it round again a few stones later. Facts you're still learning come up more often. The title screen's grid shows them all: a dot for a fact you haven't met, a square that fills as you learn it, and a slash for one you missed last time. All of this stays in your browser.

**On a phone or tablet** the number keys appear beside the game (1–5 and ⌫ on the left, 6–0 and ⚡ on the right) or, on a squarer screen, in a row below it. Turn a phone sideways to play.

## Controls

| Action | Keyboard + mouse | Controller | Touch |
|---|---|---|---|
| Change a setting | Arrows to move, Space to change, or click it | D-pad or stick to move, A to change | Tap it |
| Start | Enter, or click START | Start, or A on START | Tap START |
| Type a digit | 0–9 (top row or numpad) | Point the left stick at a digit on the arc (or step with the D-pad), then A | Tap a number key |
| Delete a digit | Backspace | B | Tap ⌫ |
| Thunderclap (at ×4 or more) | Space | Y | Tap ⚡ (solid when ready, dashed until then) |
| Pause | P or Esc, or click **II** | Start | Tap **II** |
| Back to the title (paused, or after a game) | Esc | B | Tap **TITLE** |
| Try again | Enter or Space, or click the panel | A or Start | Tap the panel |
| Sound on or off | M, or click the speaker | Back | Tap the speaker |

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
  waves.ts       each wave's size, speed and roster
  memory.ts      the saved boxes and settings, checked field by field when loaded
  mastery.ts     the title screen's grid of what you know
  controls.ts    the keyboard, menus and the controller's digit arc
  synth.ts       Web Audio voices; sfx.ts and music.ts play in D Dorian
  tune.ts        the music as notes: layers, the flute line, a key per wave band
  sky.ts         the sky, clouds, rain and islands, drawn in code
  islands.ts     towers, cottages and the wizard
  touch.ts       the touch number keys, and fitting the game into the room they leave
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
