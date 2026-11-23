// Milestone 4: structure. Settings, waves, the saved boxes and mastery grid, wave clear, rebuilding, pause, game
// over, retry and the high score.
// Usage: node tools/m4-test.mjs <project-dir> <out-dir>
import { session, sleep } from './cdp.mjs';

const [project = '.', out = 'm4-out'] = process.argv.slice(2);
const t = await session({ project, out, port: 5264, debugPort: 9374, width: 1664, height: 912 });
const { evaluate, until, shot, tap, click, check, done } = t;
const S = `__storm.scene.getScene('sky')`;
const T = `__storm.scene.getScene('title')`;
const run = (body) => evaluate(`(async () => { const s = ${S}; ${body} })()`);
const title = (body) => evaluate(`(async () => { const s = ${T}; ${body} })()`);
const frames = (n = 3) => evaluate(`new Promise((r) => { let k = 0; const f = () => (++k >= ${n} ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); })`);
const press = async (k) => { await tap(k, 40); await frames(); };
const store = (key) => evaluate(`localStorage.getItem('${key}')`);
// The canvas fills the 1664×912 window exactly: one design pixel is 4 CSS pixels.
const clickAt = (x, y) => click(x * 4, y * 4);

await until(() => evaluate(`!!(window.__storm && __storm.scene.isActive('title'))`));
await evaluate(`localStorage.clear()`);

// ---- The pure modules ----
const pure = await evaluate(`(async () => {
  const W = await import('/src/waves.ts'), M = await import('/src/memory.ts'), G = await import('/src/mastery.ts'), F = await import('/src/facts.ts');
  const out = {};
  out.w1 = W.waveDef(1, 'breeze'); out.w4 = W.waveDef(4, 'gale');
  out.kinds = [1, 2, 3].map((w) => Array.from({ length: 10 }, (_, n) => W.kindFor(w, n)).join(','));
  out.rebuild = [W.crossesRebuild(9990, 10040), W.crossesRebuild(10040, 10090)];
  M.saveMemory(new Map([['7x8', { box: 3, missed: false }], ['12-5', { box: 0, missed: true }]]));
  out.round = [...M.loadMemory()].map(([k, v]) => k + ':' + v.box + (v.missed ? 'm' : ''));
  localStorage.setItem('storm-wizard-facts', JSON.stringify({ v: 1, facts: { '7x8': [9, 0], 'evil': [1, 0], '3+4': [2, 1], '2x2': ['1', 0] } }));
  out.filtered = [...M.loadMemory().keys()];
  localStorage.setItem('storm-wizard-facts', JSON.stringify({ v: 2, facts: { '3+4': [2, 0] } }));
  out.wrongVersion = M.loadMemory().size;
  localStorage.setItem('storm-wizard-settings', JSON.stringify({ v: 1, ops: ['x', 'bogus'], addR: 50, mulR: 12, pace: 'hurricane' }));
  out.settings = M.loadSettings();
  localStorage.clear();
  const mem = new Map([['3+4', { box: 2, missed: false }], ['42/6', { box: 4, missed: false }]]);
  const add = G.masteryFor('+', { ...F.DEFAULT_SETTINGS, addR: 10 }, mem);
  out.addGrid = [add.rows.length, add.cells[2][3]?.box, add.cells[8][8] === null];
  const div = G.masteryFor('/', { ...F.DEFAULT_SETTINGS, mulR: 10 }, mem);
  out.divCell = div.cells[5][6]?.box;
  const big = G.masteryFor('-', { ...F.DEFAULT_SETTINGS, addR: 100 }, mem);
  out.counts = big.kind === 'counts' && big.fresh === F.factsFor('-', 100, 10).length;
  return out;
})()`);
check('waves: count, cap, fall and gap from the wave and pace', pure.w1.count === 8 && pure.w1.cap === 2 && pure.w1.fall === 18 && Math.abs(pure.w1.gap - 4.2) < 1e-9 && pure.w1.crowAt === -1 && pure.w4.cap === 4 && pure.w4.crowAt === 7, JSON.stringify([pure.w1, pure.w4]));
check('waves: hail first, clouds from wave 2, ball lightning from wave 3', !pure.kinds[0].includes('cloud') && pure.kinds[1].includes('cloud') && !pure.kinds[1].includes('ball') && pure.kinds[2].includes('ball'), pure.kinds.join(' | '));
check('a cottage is rebuilt each time the score crosses 10,000', pure.rebuild[0] && !pure.rebuild[1]);
check('the boxes save and load', JSON.stringify(pure.round) === JSON.stringify(['7x8:3', '12-5:0m']), JSON.stringify(pure.round));
check('a damaged save is checked field by field, and a wrong version ignored', JSON.stringify(pure.filtered) === JSON.stringify(['3+4']) && pure.wrongVersion === 0, JSON.stringify(pure.filtered));
check('bad settings fall back field by field', JSON.stringify(pure.settings) === JSON.stringify({ ops: ['x'], addR: 20, mulR: 12, pace: 'breeze' }), JSON.stringify(pure.settings));
check('the mastery grid: + as a grid, ÷ by factor pair, within 100 as counts', pure.addGrid[0] === 9 && pure.addGrid[1] === 2 && pure.addGrid[2] && pure.divCell === 4 && pure.counts, JSON.stringify(pure));

// ---- The title's settings ----
await evaluate(`location.reload()`);
await until(() => evaluate(`!!(window.__storm && __storm.scene.isActive('title'))`));
await sleep(800);
await shot('1-title');
check('the title opens with START focused', (await title(`return [s.focus, s.cursor];`)).join() === '4,0');
await press('ArrowUp');
await press('ArrowRight');
check('the arrows change the pace, and it is saved', JSON.parse(await store('storm-wizard-settings'))?.pace === 'gale');
await press('ArrowUp');
await press('ArrowRight');
check('and the times-table range', JSON.parse(await store('storm-wizard-settings')).mulR === 12);
for (let i = 0; i < 2; i++) await press('ArrowUp');
check('the operations row is reached, keeping the column', (await title(`return [s.focus, s.cursor].join();`)) === '0,1');
// Back to +, then turn off + and −, leaving ×; then try to turn × off too.
for (let i = 0; i < 2; i++) await press('ArrowLeft');
await press(' ');
await press('ArrowRight');
await press(' ');
check('Space toggles operations', JSON.stringify(await title(`return s.settings.ops;`)) === JSON.stringify(['x']));
await press('ArrowRight');
await press(' ');
const warn = await title(`return { ops: s.settings.ops, warn: s.warn.visible };`);
await shot('2-keep-one');
check('the last operation can\'t be turned off', JSON.stringify(warn.ops) === JSON.stringify(['x']) && warn.warn, JSON.stringify(warn));
// The mouse: click "5" on the tables row and BREEZE on the pace row.
await clickAt(88 + 13, 106 + 6);
await clickAt(88 + 18, 126 + 6);
await frames();
const clicked = JSON.parse(await store('storm-wizard-settings'));
check('a click changes a setting', clicked.mulR === 5 && clicked.pace === 'breeze', JSON.stringify(clicked));

// Start: only × facts up to 5 × 5.
await press('Enter');
await until(() => evaluate(`__storm.scene.isActive('sky')`));
await sleep(300);
const pool = await run(`return { n: s.picker.pool.length, ok: s.picker.pool.every((f) => f.op === 'x' && f.a <= 5 && f.b <= 5), wave: s.hud.wave, pace: s.settings.pace };`);
check('the game uses the chosen settings', pool.n === 25 && pool.ok && pool.pace === 'breeze', JSON.stringify(pool));
check('and starts at wave 1 with its banner', pool.wave === 1 && (await run(`return s.children.list.some((o) => o.type === 'Text' && o.text === 'WAVE 1');`)));

// ---- Waves ----
const clear = `for (const f of s.foes) { f.img.destroy(); f.halo?.destroy(); f.text.destroy(); f.dead = true; } s.foes = []; s.strikes = []; s.blasts = []; s.hud.buffer = '';`;
await run(`${clear} s.streak = 3; s.cottages = [2, 0, 0, 1, 0, 0]; [0, 3].forEach((i) => s.drawCottage(i)); s.spawned = s.wave.count;`);
await until(() => run(`return s.state === 'clear';`), 3000);
const cleared = await run(`return { score: s.hud.score, text: s.children.list.find((o) => o.type === 'Text' && /CLEAR/.test(o.text))?.text };`);
await shot('3-wave-clear');
check('a cleared wave pays 100 per standing cottage times the streak', cleared.score === 5 * 100 * 2 && /WAVE 1 CLEAR\s+\+1000/.test(cleared.text), JSON.stringify(cleared));
await until(() => run(`return s.hud.wave === 2 && s.state === 'play';`), 8000);
check('then the next wave starts, faster', await run(`return s.wave.wave === 2 && s.wave.fall < 18 && s.wave.crowAt === 5;`));

// ---- Rebuilding ----
await run(`s.hud.score = 9990; s.addScore(50);`);
check('crossing 10,000 rebuilds the most damaged cottage', await run(`return s.cottages[0] === 0 && s.islands.cottages[0].texture.key === 'cottage';`));

// ---- Pause ----
await run(`${clear} s.spawning = false; const F = await import('/src/facts.ts'); s.spawnHail({ fact: F.factsFor('x', 20, 12).find((f) => f.key === '4x4'), x: 200, y: 40 });`);
await press('p');
const p0 = await run(`return s.foes[0].p;`);
await sleep(600);
const paused = await run(`return { p: s.foes[0].p, paused: s.paused, hud: __storm.scene.getScene('hud').pauseTitle.visible };`);
await shot('4-paused');
check('P pauses: the sky holds still and the panel shows', paused.paused && paused.hud && paused.p === p0, JSON.stringify(paused));
await press('5');
check('typing does nothing while paused', (await run(`return s.hud.buffer;`)) === '');
await press('p');
await sleep(300);
check('P resumes', await run(`return !s.paused && s.foes[0].p > ${p0};`));
await clickAt(416 - 24, 6);
await frames();
check('the II icon pauses too', await run(`return s.paused;`));
await clickAt(200, 120);
await frames();
check('and a click on the panel resumes', await run(`return !s.paused;`));
await clickAt(416 - 8, 6);
await frames();
const muted = { mute: await run(`return s.hud.muted;`), stored: await store('storm-wizard-muted') };
check('the speaker icon mutes, and it is remembered', muted.mute && muted.stored === '1', JSON.stringify(muted));
await clickAt(416 - 8, 6);
await frames();
await evaluate(`__storm.events.emit('hidden')`);
await frames();
check('hiding the tab pauses', await run(`return s.paused;`));
await press('p');

// Learning is saved: answer the 4 × 4, then pause.
await press('1');
await press('6');
await until(() => run(`return s.foes.length === 0;`), 4000);
await press('p');
check('pausing saves the boxes', JSON.parse(await store('storm-wizard-facts'))?.facts?.['4x4']?.[0] >= 1);
await press('Escape');
await until(() => evaluate(`__storm.scene.isActive('title')`), 4000);
check('Escape while paused goes back to the title', true);
await sleep(500);
const grid = await title(`return s.gridOp;`);
await shot('5-title-after');
check('the title\'s grid shows the times tables', grid === 'x');

// ---- Game over, the high score and retry ----
await press('Enter');
await until(() => evaluate(`__storm.scene.isActive('sky')`));
await sleep(300);
await evaluate(`localStorage.removeItem('storm-wizard-hi')`);
await run(`${clear} s.spawning = false; s.hud.score = 7350; s.cottages = [2, 2, 2, 2, 2, 1]; [0, 1, 2, 3, 4, 5].forEach((i) => s.drawCottage(i));
  const F = await import('/src/facts.ts'); s.spawnHail({ fact: F.factsFor('x', 20, 12).find((f) => f.key === '3x5'), x: 346, y: 186, target: { kind: 'cottage', i: 5, x: 346 } });`);
await until(() => run(`return s.state === 'over';`), 5000);
check('the storm wins when the last cottage falls; the high score is saved', (await store('storm-wizard-hi')) === '7350' && (await run(`return s.newHi;`)));
await press('Enter');
check('a retry needs a moment, so a stray key can\'t skip the panel', await run(`return s.state === 'over';`));
await until(() => run(`return s.stateT > 1.1;`), 5000);
await shot('6-over');
check('the panel shows the score, NEW HIGH SCORE and the facts to practise', await run(`return ['NEW HIGH SCORE', '3 × 5 = 15'].every((t) => s.children.list.some((o) => o.type === 'Text' && o.text === t && o.visible));`));
await press('Enter');
await until(() => run(`return s.state === 'play' && s.hud.score === 0;`), 4000);
check('Enter tries again from wave 1', await run(`return s.hud.wave === 1 && s.cottages.every((h) => h === 0) && !s.hud.over;`));
check('and the HUD shows the saved high score', await run(`return s.hud.hi === 7350;`));

done();
