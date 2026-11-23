// Milestone 6: touch. Number keys beside the game on a phone held sideways and below it on a tablet, the II and
// speaker as thumb targets, a way back to the title without Escape, and the cottages facing the middle.
// Usage: node tools/m6-test.mjs <project-dir> <out-dir> [phone|tablet] (both, one after the other, if left out)
import { spawnSync } from 'node:child_process';
import { session, sleep } from './cdp.mjs';

const [project = '.', out = 'm6-out'] = process.argv.slice(2);
const SIZES = [{ name: 'phone', width: 844, height: 390, mode: 'side', port: 5266, debugPort: 9376 }, { name: 'tablet', width: 1024, height: 768, mode: 'bottom', port: 5269, debugPort: 9379 }];
const only = process.argv[4];
if (!only) {
  // The harness ends the process when a session is done, so each size runs as its own process.
  let ok = true;
  for (const s of SIZES) ok = spawnSync(process.execPath, [process.argv[1], project, out, s.name], { stdio: 'inherit' }).status === 0 && ok;
  process.exit(ok ? 0 : 1);
}

{
  const size = SIZES.find((s) => s.name === only);
  const t = await session({ project, out, port: size.port, debugPort: size.debugPort, width: size.width, height: size.height, touch: true, mobile: true });
  const { evaluate, until, shot, press, lift, check } = t;
  const S = `__storm.scene.getScene('sky')`;
  const run = (body) => evaluate(`(async () => { const s = ${S}; ${body} })()`);
  const frames = (n = 3) => evaluate(`new Promise((r) => { let k = 0; const f = () => (++k >= ${n} ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); })`);
  let finger = 1;
  const touchAt = async (x, y) => { const f = finger++; await press(f, x, y); await sleep(40); await lift(f); await frames(); };
  /** A tap on a point in design pixels. */
  const tapGame = async (x, y) => {
    const r = await evaluate(`(() => { const r = document.querySelector('#game canvas').getBoundingClientRect(); return { x: r.left, y: r.top, k: r.width / 416 }; })()`);
    await touchAt(r.x + x * r.k, r.y + y * r.k);
  };
  /** A tap on a touch key. */
  const key = async (k) => {
    const r = await evaluate(`(() => { const r = document.querySelector('[data-key="${k}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await touchAt(r.x, r.y);
  };
  const keysShown = () => evaluate(`[...document.querySelectorAll('[data-key]')].filter((e) => e.style.display !== 'none').length`);
  const tag = `${size.name} ${size.width}×${size.height}:`;

  await until(() => evaluate(`!!(window.__storm && __storm.scene.isActive('title'))`));
  await evaluate(`localStorage.clear()`);
  await sleep(600);

  check(`${tag} no keys on the title`, (await keysShown()) === 0);
  await shot(`${size.name}-1-title`);

  // ---- Start with a tap and answer with the keys ----
  await tapGame(110, 162);
  await until(() => evaluate(`__storm.scene.isActive('sky')`), 5000);
  await sleep(400);
  check(`${tag} the keys show in play`, (await keysShown()) === 12);
  const lay = await evaluate(`(() => {
    const l = __touch.current, c = document.querySelector('#game canvas').getBoundingClientRect();
    const keys = [...document.querySelectorAll('[data-key]')].map((e) => e.getBoundingClientRect());
    const inside = (r) => r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
    const overlap = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    return { mode: l.mode, canvas: [c.left, c.top, c.width, c.height].map(Math.round), n: keys.length,
      small: keys.filter((r) => r.width < 48 || r.height < 48).length, out: keys.filter((r) => !inside(r)).length,
      over: keys.filter((r) => overlap(r, c)).length };
  })()`);
  check(`${tag} the keys go ${size.mode === 'side' ? 'beside' : 'below'} the game`, lay.mode === size.mode, JSON.stringify(lay));
  check(`${tag} twelve keys, each at least thumb-sized, on screen and clear of the game`, lay.n === 12 && !lay.small && !lay.out && !lay.over, JSON.stringify(lay));
  const flips = await run(`return s.islands.cottages.map((c) => (c.flipX ? 'L' : 'R')).join('');`);
  check(`${tag} the cottages face the middle (left three flipped)`, flips === 'LLLRRR', flips);
  const spawn = (k, x, y = 40) => `{ const F = await import('/src/facts.ts'); const f = s.spawnHail({ fact: F.factsFor('x', 20, 12).find((x) => x.key === '${k}'), x: ${x}, y: ${y} }); f.dur = 1e6; }`;
  const clear = `for (const f of s.foes) { f.img.destroy(); f.halo?.destroy(); f.text.destroy(); f.dead = true; } s.foes = []; s.strikes = []; s.blasts = []; s.hud.buffer = '';`;
  await run(`${clear} s.spawning = false; ${spawn('4x4', 120)} ${spawn('7x8', 300)}`);
  await key('5');
  await key('undo');
  check(`${tag} ⌫ deletes a digit`, (await run(`return s.hud.buffer;`)) === '');
  await key('1');
  await shot(`${size.name}-2-typing`);
  await key('6');
  await until(() => run(`return !s.foes.some((f) => f.fact.key === '4x4');`), 3000).catch(() => {});
  check(`${tag} tapping 1 then 6 strikes 4 × 4`, await run(`return !s.foes.some((f) => f.fact.key === '4x4') && s.foes.some((f) => f.fact.key === '7x8') && s.hud.device === 'touch';`));
  check(`${tag} ⚡ is dimmed and dashed until ×4`, await evaluate(`(() => { const e = document.querySelector('[data-key="clap"]'); return e.style.opacity === '0.35' && e.style.borderStyle === 'dashed'; })()`));
  await run(`s.streak = 12; s.hud.mult = 5;`);
  await frames();
  await shot(`${size.name}-3-clap-ready`);
  check(`${tag} and solid when ready`, await evaluate(`document.querySelector('[data-key="clap"]').style.borderStyle === 'solid'`));
  await key('clap');
  await until(() => run(`return s.foes.length === 0;`), 3000).catch(() => {});
  check(`${tag} ⚡ fires the Thunderclap`, await run(`return s.foes.length === 0 && s.streak === 0;`));

  // ---- Pause and the way back ----
  await tapGame(416 - 28, 7);
  check(`${tag} tapping II pauses, and the keys go`, (await run(`return s.paused;`)) && (await keysShown()) === 0);
  await shot(`${size.name}-4-paused`);
  await tapGame(208 - 45, 125);
  check(`${tag} RESUME resumes`, await run(`return !s.paused;`));
  await tapGame(416 - 6, 7);
  check(`${tag} tapping the speaker mutes`, await run(`return s.hud.muted;`));
  await tapGame(416 - 6, 7);
  await tapGame(416 - 28, 7);
  await tapGame(208 + 45, 125);
  await until(() => evaluate(`__storm.scene.isActive('title')`), 4000).catch(() => {});
  check(`${tag} TITLE goes back to the title`, await evaluate(`__storm.scene.isActive('title')`));

  // ---- Game over's TITLE button ----
  await sleep(500);
  await tapGame(110, 162);
  await until(() => evaluate(`__storm.scene.isActive('sky')`), 5000);
  await sleep(400);
  await run(`${clear} s.spawning = false; s.hud.device = 'touch'; s.cottages = [2, 2, 2, 2, 2, 1]; [0, 1, 2, 3, 4, 5].forEach((i) => s.drawCottage(i));
    const F = await import('/src/facts.ts'); s.spawnHail({ fact: F.factsFor('x', 20, 12).find((x) => x.key === '3x5'), x: 346, y: 186, target: { kind: 'cottage', i: 5, x: 346 } });`);
  await until(() => run(`return s.state === 'over' && s.stateT > 1.1;`), 6000);
  check(`${tag} no keys at game over`, (await keysShown()) === 0);
  await shot(`${size.name}-5-over`);
  await tapGame(208 + 108, 150);
  await until(() => evaluate(`__storm.scene.isActive('title')`), 4000).catch(() => {});
  check(`${tag} game over's TITLE button goes to the title`, await evaluate(`__storm.scene.isActive('title')`));

  t.done();
}
