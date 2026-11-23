// Milestone 5: the music follows the storm, every sound is wired, and reduced motion holds the screen still.
// Usage: node tools/m5-test.mjs <project-dir> <out-dir>
import { session, sleep } from './cdp.mjs';

const [project = '.', out = 'm5-out'] = process.argv.slice(2);
const t = await session({ project, out, port: 5265, debugPort: 9375, width: 1664, height: 912 });
const { evaluate, until, shot, tap, check, done } = t;
const S = `__storm.scene.getScene('sky')`;
const run = (body) => evaluate(`(async () => { const s = ${S}; ${body} })()`);
const frames = (n = 3) => evaluate(`new Promise((r) => { let k = 0; const f = () => (++k >= ${n} ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); })`);
const press = async (k) => { await tap(k, 40); await frames(); };
// Records which sound effects a scene plays.
const spy = (scene) => `(() => { const x = __storm.scene.getScene('${scene}'); window.__calls = []; const fx = x.sfx;
  for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(fx))) if (k !== 'constructor' && k !== 'pluck') { const f = fx[k].bind(fx); fx[k] = (...a) => (__calls.push(k), f(...a)); } })()`;
const calls = () => evaluate(`window.__calls.slice()`);

await until(() => evaluate(`!!(window.__storm && __storm.scene.isActive('title'))`));
await evaluate(`localStorage.clear()`);

// ---- The tune, as notes ----
const tune = await evaluate(`(async () => {
  const T = await import('/src/tune.ts');
  const at = (step, st) => T.notesAt(step, { lead: false, danger: false, band: 0, ...st });
  const names = (ns) => ns.map((n) => n.inst).sort().join(',');
  return {
    calm: names(at(0, {})),
    lead: at(0, { lead: true }).find((n) => n.inst === 'flute')?.midi,
    danger: names(at(0, { danger: true }).filter((n) => ['kick', 'snare', 'hat', 'rumble'].includes(n.inst))),
    snare: at(2, { danger: true }).some((n) => n.inst === 'snare'),
    band1: at(0, { band: 1 }).filter((n) => n.inst === 'pad').map((n) => n.midi).join(),
    band0: at(0, {}).filter((n) => n.inst === 'pad').map((n) => n.midi).join(),
    busy: [at(1, { band: 2 }).find((n) => n.inst === 'arp').midi - 7, at(1, {}).find((n) => n.inst === 'arp').midi],
    bands: [1, 3, 4, 6, 7, 12].map(T.bandFor).join(),
  };
})()`);
check('the calm layer: pad chord, arpeggio and bass', tune.calm === 'arp,bass,pad,pad,pad', tune.calm);
check('the flute lead starts on A when it\'s on', tune.lead === 69);
check('the danger layer: kick, hat and rumble on the bar, snare on the backbeat', tune.danger === 'hat,kick,rumble' && tune.snare, tune.danger);
check('waves 4–6 move up a fourth', tune.band1 === tune.band0.split(',').map((m) => Number(m) + 5).join(), `${tune.band0} → ${tune.band1}`);
check('waves 7 and on get a busier arpeggio', tune.busy[0] !== tune.busy[1], JSON.stringify(tune.busy));
check('bands change every three waves', tune.bands === '0,0,1,1,2,2', tune.bands);

// ---- The title: its theme and menu sounds ----
await press('ArrowUp');
await evaluate(spy('title'));
await press('ArrowUp');
await press('ArrowRight');
check('menu steps and choices make sounds', JSON.stringify(await calls()) === JSON.stringify(['step', 'choose']), JSON.stringify(await calls()));
const audio = await evaluate(`__storm.sound.context?.state`);
await until(() => evaluate(`__storm.scene.getScene('title').music.steps > 4`), 5000).catch(() => false);
check('the title theme plays once a key unlocks the audio', (await evaluate(`__storm.scene.getScene('title').music.steps`)) > 4, `audio ${audio}`);

// ---- In the game ----
await press('Enter');
await until(() => evaluate(`__storm.scene.isActive('sky')`));
await sleep(300);
await evaluate(spy('sky'));
const clear = `for (const f of s.foes) { f.img.destroy(); f.halo?.destroy(); f.text.destroy(); f.dead = true; } s.foes = []; s.strikes = []; s.blasts = []; s.hud.buffer = '';`;
check('wave 1: calm, no flute', await run(`return !s.music.state.lead && !s.music.state.danger && s.music.state.band === 0;`));
await run(`${clear} s.spawning = false; const F = await import('/src/facts.ts'); const f = s.spawnHail({ fact: F.factsFor('x', 20, 12).find((x) => x.key === '6x7'), x: 100, y: 40 }); f.p = 0.7; f.dur = 1e6;`);
await frames();
check('a stone past 55% of its fall brings the drums in', await run(`return s.music.state.danger;`));
await run(`${clear}`);
await frames();
check('and they go when it does', await run(`return !s.music.state.danger;`));
const steps0 = await run(`return s.music.steps;`);
await sleep(800);
check('the game music runs on the audio clock', (await run(`return s.music.steps;`)) > steps0);

await press('p');
await press('p');
await run(`s.spawning = true; s.cottages = [2, 0, 0, 0, 0, 0]; s.drawCottage(0); s.spawned = s.wave.count;`);
await until(() => run(`return s.state === 'clear';`), 3000);
await frames(4);
await shot('1-clear-glow');
await run(`s.hud.score = 9990; s.addScore(20);`);
await until(() => run(`return s.wave.wave === 2;`), 8000);
await frames();
check('from wave 2 the flute joins', await run(`return s.music.state.lead;`));
await run(`s.startWave(4);`);
await frames();
check('wave 4 changes key', await run(`return s.music.state.band === 1;`));
const heard = await calls();
check('pause, resume, wave clear and rebuilding each have a sound', ['pause', 'clear', 'rebuilt'].every((k) => heard.includes(k)) && heard.filter((k) => k === 'pause').length === 2, JSON.stringify(heard));

// Game over with a new high score: the stinger, then the fanfare.
await run(`${clear} s.spawning = false; s.hud.score = 4200; s.cottages = [2, 2, 2, 2, 2, 1]; [0, 1, 2, 3, 4, 5].forEach((i) => s.drawCottage(i));
  const F = await import('/src/facts.ts'); s.spawnHail({ fact: F.factsFor('x', 20, 12).find((x) => x.key === '3x5'), x: 346, y: 186, target: { kind: 'cottage', i: 5, x: 346 } });`);
await until(() => run(`return s.state === 'over';`), 5000);
await until(() => evaluate(`__calls.includes('newHi')`), 5000).catch(() => false);
const end = await calls();
check('game over plays its phrase, then the new-high-score fanfare', end.includes('over') && end.indexOf('newHi') > end.indexOf('over'), JSON.stringify(end.slice(-4)));
check('the music holds at game over', await run(`return s.music.held;`));

// ---- Reduced motion ----
await t.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await evaluate(`location.reload()`);
await until(() => evaluate(`!!(window.__storm && __storm.scene.isActive('title'))`));
await press('Enter');
await until(() => evaluate(`__storm.scene.isActive('sky')`));
await sleep(300);
await run(`${clear} s.spawning = false; s.streak = 12; const F = await import('/src/facts.ts');
  s.spawnHail({ fact: F.factsFor('x', 20, 12).find((x) => x.key === '2x9'), x: 254, y: 186, target: { kind: 'cottage', i: 3, x: 254 } });
  s.spawnHail({ fact: F.factsFor('x', 20, 12).find((x) => x.key === '7x7'), x: 120, y: 60 });`);
await until(() => run(`return s.foes.length === 1;`), 4000);
const shook = await run(`return s.cameras.main.shakeEffect.isRunning;`);
await run(`s.streak = 12;`);
await press(' ');
await frames(2);
const flash = await run(`return s.flash.alpha;`);
// The hop is part of the gesture; the idle wizard is what reduced motion holds still.
await until(() => run(`return !s.cast;`), 8000);
const wiz = [];
for (let i = 0; i < 4; i++) { wiz.push(await run(`return s.islands.wizard.y;`)); await sleep(200); }
check('with reduced motion: no shake on a landing, no Thunderclap flash, a still wizard', !shook && flash === 0 && new Set(wiz).size === 1 && wiz[0] === 210, JSON.stringify({ shook, flash, wiz }));

done();
