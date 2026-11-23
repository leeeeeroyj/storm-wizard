# Storm Wizard: build plan

A math-drill arcade game re-imagined from the mechanics of Atari's *Missile Command* (1980). Hail falls on six cottages on floating sky islands, and every stone carries a problem (addition, subtraction, multiplication or division). Type the answer and the wizard's lightning strikes that stone. Concept, rules, roster, sprite picks and a playable mockup: `design/concept-sheet.html`.

## The original, researched

From the Wikipedia article (read 2026-11-22):
- **Loop.** Six cities are under an endless stream of ballistic missiles, some splitting into several warheads. The player moves a crosshair with a trackball and presses one of three buttons to fire from the matching battery.
- **Fireballs.** A counter-missile explodes at the crosshair, and the fireball lasts several seconds, destroying anything that flies into it.
- **Batteries.** Three, with 10 missiles each. A battery is useless once empty or destroyed. The centre battery's missiles are faster.
- **Later levels** add smart bombs (which evade a poorly placed blast), plus bombers and satellites that cross the screen launching missiles.
- **A level ends** when every enemy weapon is destroyed or has landed.
- **Bonuses.** Remaining missiles and cities score a bonus. Bonus cities are earned at score thresholds and placed at the end of a level.
- **Multiplier.** Starts at ×1, rises every second level and caps at ×6.
- **Difficulty.** Enemies get faster and more numerous each level.
- **No win state.** The game ends when every city is gone, with "The End" rather than "Game Over".
- **Ports** include the Atari 2600 (1981), Atari 8-bit and 5200, Game Boy, *Missile Command 3D* and *Recharged* (2020). The article doesn't say how they differ mechanically, so nothing here depends on a port.

## The fun, deconstructed

- **The essence:**
  - **Triage under pressure.** Several threats fall at once, and you choose which one to deal with first.
  - **The blast gamble.** Waiting until threats bunch up lets one blast take several, but waiting is risky.
- **The drill:** recalling a fact on sight is the skill being trained. Flash cards make that dull. Here, each recall saves a cottage, and the stones you haven't answered yet keep up the pressure.
- **What frustrates today's players, and what we change:**
  - Running out of ammo and losing control for the rest of the level: there's no ammo here.
  - Losing a battery for the whole level: towers are stunned for 5 s instead.
  - Cities lost to one hit: cottages take two.
  - The trackball, and aim that must be pixel-exact: you type instead, and the bolt always finds its stone.
  - "The End": a soft "The storm wins this time", with facts to practise and one press to try again.
- **For learners:**
  - A wrong answer must never feel like a punishment, so it only fizzles.
  - A missed fact must teach, so it is shown big with its answer and asked again soon.
  - Players with different skills must both have fun, which is what the settings and adaptive drilling are for.
- **Risk and reward, close together:**
  - The streak multiplier, and the choice to spend it on a Thunderclap or keep it.
  - Chain blasts, which reward letting stones bunch up.
  - The Storm Crow's harder problem, which you can take on or ignore.
- **A beginner's path:** Breeze pace with only the facts they're learning. Answer the lowest stone, one at a time. The sky is slow and there is nothing to aim.
- **An expert's path:**
  - Tempest pace with all four operations.
  - Let clusters form for chains, bank a ×8 streak, and save the Thunderclap for the moment it's needed.
  - Answer the crow for gifts.

## Philosophy checklist (review gate, 2026-11-22)

- [x] **Could a complete beginner enjoy this within a minute?**
  - Yes. Type the number you see.
  - Breeze gives about 18 s per stone, with at most two on screen in wave 1.
  - The answer box and the plates use Atkinson Hyperlegible.
- [x] **Can a skilled player find depth?**
  - Triage order, chains, banking the streak against spending it, crow gifts, and Tempest pace.
- [x] **Are risk and reward clear and close together?**
  - The streak and Thunderclap sit side by side in the top bar.
  - Chains pay at once, and the crow pays at once.
- [x] **Are the controls simple and open to mastery?**
  - One verb: digits, plus one extra key (Thunderclap).
  - Speed of recall is the mastery.
- [x] **Deconstructed and rebuilt, not copied?**
  - Aiming becomes recall; missiles become a storm; ammo becomes misfires.
  - Adaptive drilling is new.
- [x] **Does every system serve the player's fun?**
  - The prefix rule exists so the player never has to press Enter.
  - The drill is invisible until you look at the mastery grid.
- [x] **Does it feel good moment to moment?**
  - Every digit plays a note in key, and correct answers climb with the streak.
  - Lightning, blasts, rings and sparks, with music that rises with the danger.
- [x] **Is failure quick and fair?**
  - A misfire costs 0.4 s and the streak.
  - Landings are marked ahead with a chevron and a thickening plate outline.
  - Game over is one press from a new game.

## Scope

**v1**
- **One fixed screen** at 416×228. A cloud deck runs along the top, rain falls, and three floating islands sit along the bottom: `TOWER cottage cottage cottage TOWER cottage cottage cottage TOWER`. The wizard rides a small cloud just left of the answer box (moved there at the user's request after milestone 1).
- **The verb.** Typing digits fills the answer box.
  - When the box equals a live answer, a bolt strikes every stone with that answer, from the nearest working tower.
  - When the box can no longer lead to any live answer, it misfires: the box clears, the streak resets, and digits are locked out for 0.4 s.
  - Backspace undoes a digit.
- **The prefix rule.** The problem picker never puts two answers on screen where one is a strict prefix of the other (5 and 56). Equal answers are allowed. When a stone leaves the sky, a typed prefix that no longer leads anywhere clears silently, so the player is never punished for it.
- **Blasts** grow to radius 15 (20 for a split cloud) over 0.25 s and last 0.75 s. Any hailstone or split cloud that drifts in is caught for 25 × streak. Ball lightning and the crow are immune.
- **Points:**

  | Threat | Points |
  |---|---|
  | Hailstone | 50 |
  | Split cloud | 100 |
  | Ball lightning | 150 |
  | Storm Crow | 250 |
  | Chain catch | 25 |

  Every value is multiplied by the streak: ×(1 + correct-in-a-row ÷ 3), capped at ×8.
- **Thunderclap.** At ×4 or more, Space, Y or ⚡ strikes every stone except the crow and resets the streak.
- **Roster:**

  | Threat | Arrives | Behaviour |
  |---|---|---|
  | Hailstone | Wave 1 | Falls in a straight line at a cottage or tower |
  | Split cloud | Wave 2 | Bursts into three hailstones with new problems at mid-sky |
  | Storm Crow | Wave 2, once a wave | Crosses high and never attacks. Carries a "stretch" problem from one range up, and answering it gives a gift |
  | Ball lightning | Wave 3 | Zigzags as it falls and is immune to chain blasts |

- **Gifts, picked at random:**
  - **Gust:** everything in the sky moves at 40% for 6 s.
  - **Mend:** the most damaged cottage is rebuilt one step, or +500 if none is damaged.
  - **Ward:** a dome over the most threatened cottage that takes one hit.
- **Defences:**
  - Cottages take two hits: roof gone (cropped sprite and smoke), then rubble.
  - Towers are stunned for 5 s.
  - Every 10,000 points rebuilds a cottage.
  - The game ends when all six cottages are rubble.
- **Waves** come from a pure `waves.ts`:
  - count = 6 + 2·wave;
  - on screen at once = min(pace cap, 2 + ⌊wave/2⌋);
  - fall time = pace fall ÷ (1 + 0.06·(wave−1));
  - spawn gap = max(1.2, 3.2 − 0.2·wave) × pace gap;
  - at wave end, +100 × streak for each standing cottage.

  | Pace | Fall time | Gap × | On-screen cap |
  |---|---|---|---|
  | Breeze (default) | 18 s | 1.4 | 3 |
  | Gale | 12 s | 1.0 | 5 |
  | Tempest | 8 s | 0.75 | 7 |

- **Settings** (the title screen, saved in `storm-wizard-settings`):
  - Operations: toggles for + − × ÷, at least one on.
  - \+ and −: within 10, 20 or 100. Subtraction never goes below 0.
  - × and ÷: up to 5×5, 10×10 or 12×12. Division is always exact.
  - Pace: Breeze, Gale or Tempest.
- **Adaptive drilling** (`facts.ts`, `memory.ts`). Each fact has a Leitner box, saved in `storm-wizard-facts`.
  - **Weights** for picking a problem: new 3, missed 6, box 1: 4, box 2: 2, box 3: 1, box 4: 0.4.
  - **Moving between boxes:**
    - Answered in the upper 60% of the sky: +1 box.
    - Answered lower: at least box 1.
    - Landed, or a split cloud that burst: box 0, and requeued to return 2–4 spawns later.
  - Stones caught in someone else's blast and stones cleared by a Thunderclap aren't counted either way.
  - **Mastery grid** on the title screen, one per operation (×, and ÷ by factor pair, as 12×12; + and − within 20 as a grid; within 100 as box counts). Each cell's box shows by fill height, and a miss as a slash, never by colour.
  - The game-over panel lists the last three missed facts with their answers.
- **Teaching on a miss:** the full fact (`7 × 8 = 56`) appears in big text over the impact for 2.2 s, drawn behind the threats.
- **Warnings before harm:**
  - Every stone past halfway shows a chevron on its landing spot, blinking in the last 20% (steady under reduced motion).
  - Plate outlines thicken past 60%.
  - The crow caws as it appears, and ball lightning crackles.
- **Sound:** live synthesis and a lookahead sequencer (below).
- **Arcade essentials:** pause, a high score (`storm-wizard-hi`) and an attract mode.
- **Controls:** keyboard + mouse, controller (digit arc) and touch (number keys in the letterbox bars). Deployed to GitHub Pages.

**Later**
- More gifts and a boss storm every fifth wave.
- A "practise this table" mode from the mastery grid.
- Negative numbers and remainders.
- Number bonds and doubles as their own sets.
- Several players on one device (the user chose one player per device for v1).
- An option to turn the time pressure off entirely.

**Dropped from the original:**
- ammo and losing a battery for the level;
- aiming (the trackball and crosshair);
- the three fire buttons;
- nuclear and cold-war imagery;
- "The End";
- every name, sprite, sound and layout of the original.

## Architecture

Vite 8 + Phaser 4 + TypeScript, at the versions the other games use and current on 2026-11-22 (`npm view`): `phaser ^4.2.1`, `vite ^8.3.8`, `typescript ^7.0.2`. Node must be `^20.19.0 || >=22.12.0` (Vite's `engines`). `assets/` is Vite's public dir. The internal resolution is 416×228, rendered at 4×.

**Scenes:**
- **Title:** settings, the mastery grid, HI and START.
- **Sky:** the game.
- **Hud:** the top bar, the answer box, the digit arc, and the pause and game-over panels.

**World model: one fixed screen, no physics.** Threats move by interpolation along their fall line, and blasts are circles. Collision is a distance check. Everything lives in game coordinates; the camera never moves.

**Modules:**

| Module | Role | Source |
|---|---|---|
| `config.ts` | All tunables: pace table, points, radii, weights | new |
| `facts.ts` | Fact pools per operation and range, and the prefix-safe weighted picker. Pure, so tests import it straight from the dev server | new |
| `memory.ts` | The Leitner save: versioned, checked field by field | after Heroic Crusader's `save.ts` |
| `waves.ts` | Pure function of wave and pace | after Sentinel's `waves.ts` |
| `answer.ts` | The typed buffer: match, misfire and stale-prefix rules. Pure | new |
| `pilot.ts` | The mockup's autopilot | the concept sheet |
| `controls.ts` | Digits, Backspace, Space, P, M, keys latched until read, the gamepad digit arc | Overtone's latching |
| `touch.ts` | Number keys laid out by the letterbox shape | new |
| `synth.ts`, `music.ts`, `sfx.ts` | Sound | Overtone |
| `main.ts`, `view.ts`, `text.ts`, `attract.ts`, `hi.ts`, `effects.ts` | Shared plumbing | Overtone |
| `tools/cdp.mjs`, `pause-hi-test.mjs`, `attract-test.mjs` | Test harness | Overtone |

**Sprites:** 16×16 from the sheet picks, drawn flat at 1×. The crow gets a 1 px pale halo so it reads against the night sky (found in the mockup). A damaged cottage is the cottage sprite with its top 6 rows cropped, plus smoke. The islands, sky, clouds, rain, lightning and blasts are drawn in code.

**Type:** self-hosted in `assets/fonts/` with their licences.
- **In-game:** Atkinson Hyperlegible Mono (800) for every number and word; Atkinson Hyperlegible Next for longer text on the title screen.
- **Title:** Pirata One, the user's pick.
- All are SIL OFL. Confirm each licence file when downloading.

**localStorage** (every access in try/catch; nothing is written in attract mode):

| Key | Holds |
|---|---|
| `storm-wizard-hi` | The high score |
| `storm-wizard-muted` | The mute setting |
| `storm-wizard-settings` | Operations, ranges and pace |
| `storm-wizard-facts` | The versioned box map |

## Sound and music

- **Key and tempo:** D Dorian at 110 BPM, with a lookahead sequencer on the audio clock (a 25 ms timer scheduling 120 ms ahead).
- **Calm layer:** plucked harp arpeggios over Dm–G–C–Am (the G's B natural is the Dorian colour), a soft pad and a triangle bass.
- **Flute lead:** an 8-bar line that joins from wave 2.
- **Danger layer:** kick, snare, hats and a low noise rumble. It switches in on the next bar line whenever the lowest stone is past 55% of its fall, and out again when it isn't.
- **A mood per wave band:**
  - waves 1–3: D Dorian;
  - waves 4–6: up a fourth, to G Dorian;
  - waves 7+: A Dorian, with a busier arpeggio.
- **Title theme:** the flute line over the calm layer, slower.
- **Stingers:** wave clear, game over and new high score.
- **Sound effects:** all in key, all played at once (not quantised; answers must feel instant):
  - a digit tick (each digit is a scale degree);
  - a correct answer, which climbs with the streak;
  - a double strike;
  - a misfire (a detuned square fizz);
  - blast, landing, cottage lost, ward pop and Thunderclap;
  - the crow gift chime, the crow's caw and the ball-lightning crackle;
  - the split cloud's whoosh;
  - pause and resume, and menu steps and confirms.
- **The mix:** sound effects sit over the music bus at 0.55.
- **Mute** with M or the speaker icon (a cross when muted). Pause holds the music; game over stops it and plays its stinger. Attract mode makes no sound and creates no AudioContext.

## Milestones

Each one ends playable, tested, committed, pushed and live.

1. **Skeleton + publishing.**
   - Vite + Phaser project, self-hosted fonts and a title scene.
   - The Sky scene with the islands, sky and rain, and the chosen sprites on screen.
   - `tools/cdp.mjs`, `m1-test` and the deploy workflow.
   - Create and lock down the repo (C3–C4), Pages, MIT licence and README.
2. **First playable.**
   - Hailstones with plates, and `facts.ts` with the prefix rule.
   - `answer.ts`: typing, match and misfire.
   - Bolts, blasts, chains, cottages and towers, landings with the fact popup, and score.
   - Controller digit arc.
   - Sounds: digits, correct, misfire, blast, landing, and a rough calm music loop.
   - Run the philosophy checklist.
3. **Full roster.** Split cloud, Storm Crow and gifts (Gust, Mend, Ward), ball lightning, the streak multiplier and the Thunderclap, each with its sounds.
4. **Structure.**
   - Settings on the title screen, `waves.ts`, `memory.ts` with the mastery grid, and the facts to practise.
   - Wave clear and its bonus, rebuilding every 10,000.
   - Game over and retry, **pause and the high score.**
5. **HUD, music and feedback.**
   - The full music (layers, moods per wave band, title theme, stingers) and every sound wired.
   - Landing chevrons, juice (rings, sparks, flash), and reduced motion.
6. **Touch and mobile.**
   - Number keys in the side bars at 844×390 (1–5 and ⌫ left, 6–0 and ⚡ right).
   - A bottom row on 4:3 screens.
   - II and speaker tap targets, landscape lock, the CDP touch test at two phone sizes, then a real phone (needs the user).
7. **Attract mode and Arcadia.**
   - `?attract`, with the mockup's pilot typing answers.
   - Seeds pick a later wave, mixed operations and a busy sky.
   - `attract-test.mjs`, the Arcadia entry, still and phone loop.
8. **Polish.**
   - Balance from the user's play, especially Breeze for young players and the spawn gaps.
   - The philosophy checklist once more, the README and the hero screenshot.

**Definition of done for each:** its test and all earlier tests pass; screenshots looked at; Status and README updated; C2 checks clean; commit; push; the deploy is green.

## Testing

- `tools/mN-test.mjs` drives the real game over CDP (Overtone's harness).
- **Dev hooks** (dev builds only): spawn a threat with a given fact at a given progress, clear the sky, set the streak, skip a wave, and set settings and memory.
- **Pure-module checks** through `await import('/src/facts.ts')`:
  - the prefix rule over thousands of random skies;
  - every fact in every range is valid (no negatives, exact division);
  - the weights favour missed facts;
  - `answer.ts`'s state table: partial, exact, double, misfire, and a stale prefix after a stone leaves.
- **Fairness probe:** the pilot at a realistic typing speed (one digit per 0.35 s, 1.5 s to think) must clear waves 1–5 on Breeze without losing a cottage, and the slowest Tempest spawn must be answerable in time.
- **Standing tests:** `pause-hi-test.mjs`, the audio check (every sound wired, music stops on pause and game over, mute persists) and `attract-test.mjs`.

## Decisions

- **2026-11-22 Audience: all ages, adjustable,** chosen by the user over fixed early-elementary, upper-elementary and teen presets.
- **2026-11-22 The verb: type the answer,** chosen by the user over aiming at the right answer (recognition) and aim-then-pick (two steps). It is recall, like real flash cards.
- **2026-11-22 Setting: storm wizard,** chosen by the user over a cozy meteor shower, a neon space colony and an undersea reef.
- **2026-11-22 Adaptive drilling** (spaced repetition per fact), chosen by the user over a fixed ramp and over two separate modes.
- **2026-11-22 Name: Storm Wizard,** the user's own choice over the proposed Hailcaster, Sumstorm and Nimbus Numbers. Searches on the day found:
  - no video game with that exact title;
  - a "Storm Wizard" unit in Supercell's *Clash Mini*;
  - "storm wizard" as a common player term in *Wizard101*, which has a Storm school of magic;
  - a US mark STORMWIZARD held by Stormwizard, LLC for stormwater-engineering software.

  That is a different field, but it is software, so the user should confirm the name at the review gate. The risk looks low for a free, non-commercial browser game.
- **2026-11-22 Music: whimsical, rising with the storm,** chosen by the user over driving arcade chiptune and a calm study beat.
- **2026-11-22 One player per device,** chosen by the user over up to four named profiles.
- **2026-11-22 On a miss, show the fact and keep playing,** chosen by the user over pausing to copy it and over a recap at wave end.
- **2026-11-22 No Enter key; the prefix rule instead.** Auto-fire on an exact match only works if no live answer is a prefix of another, so the picker enforces that. Equal answers are allowed on purpose: one answer strikes both, which shows that 3 × 4 and 6 × 2 are the same number.
- **2026-11-22 A stale prefix clears silently.** If the stone you were typing for is caught or lands, a prefix that now leads nowhere is dropped without a misfire.
- **2026-11-22 Six cottages,** as in the original. The first layout sketch showed four; the sheet and this plan use six.
- **2026-11-22 Chain catches and Thunderclap kills don't count for drilling.** A fact you didn't answer teaches nothing, so it neither moves up nor down.
- **2026-11-22 The crow gets a pale halo.** The mockup showed the black crow vanishing against the night sky.
- **2026-11-22 Banners and the missed-fact popup draw behind the threats,** so they never hide a stone.

- **2026-11-22 Concept approved.** The user confirmed the name Storm Wizard (after the STORMWIZARD note), said Breeze is slow enough, and accepted the range presets. The user created the empty public repo `leeeeeroyj/storm-wizard` on GitHub.
- **2026-11-22 Picks from the user:** wizard 233226, tower 1389231, cottage 289731, rubble 1030835, hailstone 563486, split cloud 1275566, crow 308460, ball lightning 403422, gust 432476, mend 569877, ward 416199. **Title face: Pirata One.** Ball lightning and towers stay for now and get revisited in play if they don't feel right.
- **2026-11-22 Working rhythm:** the runbook default. Each milestone is shown before it's committed, and the file list is shown before the first push.

- **2026-11-22 Pirata One ships as the unmodified TTF.** Its licence reserves the name 'Pirata' for unmodified copies, and a subset is arguably a modification. The Atkinson fonts reserve no name, so their Google Fonts latin subsets are fine.
- **2026-11-22 Working rhythm, updated.** After milestone 1 the user said to commit and push it, then keep building. Each verified milestone is now committed and pushed without waiting, and the work stops for clarifying questions, taste decisions and the real-phone test.
- **2026-11-22 The wizard moves beside the answer box** (the user's request after seeing milestone 1: a wizard on the centre tower didn't explain itself). He rides a small storm cloud just left of the box, flipped so his wand faces it.
  - **Right answer:** his wand twinkles (a four-pointed star that grows for 0.12 s) and he hops a pixel. Then each struck stone takes a bolt from the nearest working tower, whose top flashes the same star. The stones hold still during the twinkle and are out of play at once, so the delay can't cost a landing or a second answer. The correct-answer sound plays at once, so typing still feels instant.
  - **Misfire:** a different gesture by shape and motion, not just colour. He shakes side to side, round grey smoke puffs rise from the wand with a few falling grey sparks, and the answer box goes dark with the wrong digits struck through.
- **2026-11-22 Stones start just under the cloud deck** (y = TOP + 22), not at the top bar, so the plate above a new stone never covers it. Fall times scale with the shorter drop, so speeds are unchanged.
- **2026-11-22 No zero operands in + and −.** `14 + 0` teaches nothing. Answers of 0 (`5 − 5`) stay.
- **2026-11-22 The controller arc's x radius shrank to 30** so its 1 and 0 sit beside the answer box, clear of the wizard.
- **2026-11-22 The crow's badge moved outside its plate.** The mockup's star, and then a diamond, read as a plus sign in front of the first number (`✚12 × 12`). The crow's plate now has its double border and a white diamond stud on each side, clear of the digits.
- **2026-11-22 Plate marks outside the plate are white.** The mockup drew ball lightning's zigzag edge and the split cloud's underline in dark ink, which vanished against the night sky.
- **2026-11-22 Plates never overlap.** Lowest stones keep their plates in place, and a plate that would cover another steps up above it (or below its stone at the top of the sky). Burst shards spread 24 px apart and stagger, and the burst cloud's fact shows above them.
- **2026-11-22 The Thunderclap scores at the multiplier it spends,** and the twinkle and hop are twice the size. Strikes carry the multiplier from the moment of the answer, so a landing during the twinkle can't change the points.
- **2026-11-22 Until waves arrived, the roster joined by spawn count** (milestone 3 only). Milestone 4 replaced it with `waves.ts`. The crow still doesn't count towards the on-screen cap.
- **2026-11-22 The title screen's menu.** Rows for operations, the + − range, the × ÷ range, pace, START and the grid's tabs. The arrows (D-pad or stick) move. Space (A) changes the focused item, and Enter (Start) begins from anywhere. Every item is also a click or tap target. Chosen items are filled white with dark ink, unchosen ones are outlines, and focus is a thick frame with a caret. The cursor keeps its column when moving between rows. The last operation can't be turned off; a note says why.
- **2026-11-22 Game over waits for the player.** Retry is one press (Enter, Space, A, Start, or a tap on the panel) after a one-second guard, and Escape or B goes to the title. Attract mode still restarts by itself.
- **2026-11-22 Escape pauses in play and leaves for the title from the pause panel.** P and Start toggle the pause, the II icon and a tap on the panel do too, and hiding the tab pauses. Pausing, quitting, wave clear and game over save the boxes.
- **2026-11-22 The mute state lives in `synth.ts`, not in `sound.mute`.** Phaser applies `sound.mute` through a gain that only updates on the audio thread, so reading it back straight after setting it gives the old value. The toggle copied from Overtone saved the opposite of what it set. Overtone has the same code, and its fix is left to that repo.
- **2026-11-22 The music is composed in a pure `tune.ts`** (notes per step, given the lead, danger and band) and voiced by `music.ts`, so tests check the composition without audio. Danger is latched at bar lines.
- **2026-11-22 Under reduced motion the wizard's twinkle-hop stays;** it's part of answering and only 1–2 px. The idle bob, the START pulse and the cursor blink stop, along with shake and flash.
- **2026-11-23 The cottage is #289704** (the user's pick after playing), a blue cottage whose door faces left. The three left of the middle tower are flipped so every door faces the middle.
- **2026-11-23 The touch keys are page elements, not canvas drawings,** so they sit beside or below the game instead of over the sky. On a touch screen the game is fitted into the room the keys leave, so nothing moves when they appear. `layoutFor` picks side columns or a bottom row, whichever leaves the game bigger; keys are 56–96 CSS px. Pressed keys turn over (light with dark ink), ⚡ is dashed and faint until ×4 and solid after, and the digits dim during a misfire's lockout. Shape and contrast, never hue alone.
- **2026-11-23 Touch gets a way back to the title:** RESUME and TITLE buttons on the pause panel, and a TITLE button on the game-over panel. The II and speaker take a thumb-sized area around them.
- **2026-11-22 A new banner replaces the last** (wave start, wave clear, Thunderclap), so two never overlap.

## Open questions

- **Ball lightning and towers.** The user kept the current picks and will revisit them if they don't feel right in play.

## Status (2026-11-23: milestone 6 built and verified in emulation; a real phone and tablet next)

- **Done:** Part A, and milestones 1–6. Milestone 5 is live at https://leeeeeroyj.github.io/storm-wizard/.
- **Milestone 6 (touch and mobile):**
  - **`touch.ts`:** number keys beside the game on a phone held sideways (1–5 and ⌫ left, 6–0 and ⚡ right), and a row below it on a tablet.
  - **Pause and game over on touch:** RESUME and TITLE buttons on the pause panel, a TITLE button at game over, and bigger II and speaker targets.
  - **The cottage:** the user's new pick, facing the middle.
- **Verified:**
  - `m6-test` 17/17 at 844×390 (side keys) and 17/17 at 1024×768 (bottom row):
    - the layout, key sizes, and keys on screen and clear of the game;
    - no keys on the title, in pause or at game over;
    - typing, ⌫ and striking with the keys;
    - ⚡ dashed then solid, and the Thunderclap;
    - II, RESUME, the speaker, TITLE, and game over's TITLE;
    - the cottages facing the middle.
  - `m1`–`m5` tests 11/11, 23/23, 21/21, 35/35 and 19/19. `m2` failed once on a timing check under load and passed on both reruns.
  - Screenshots looked at.
- **Next:** the user tries a real phone and tablet. Then milestone 7, attract mode with the pilot, and Arcadia's demo and phone loop.
