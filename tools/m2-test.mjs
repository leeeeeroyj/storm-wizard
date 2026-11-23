// Milestone 2: hail with problems, typing, the wand's twinkle, bolts, blasts, chains, landings and the digit arc.
// Usage: node tools/m2-test.mjs <project-dir> <out-dir>
import { session, sleep } from './cdp.mjs';

const [project = '.', out = 'm2-out'] = process.argv.slice(2);
const t = await session({ project, out, port: 5262, debugPort: 9372, width: 1664, height: 912 });
const { evaluate, until, shot, tap, check, done } = t;
const S = `__storm.scene.getScene('sky')`;
const run = (body) => evaluate(`(async () => { const s = ${S}; ${body} })()`);
// Waits for the game to run a few frames, so it has read the keys just sent.
const frames = (n = 3) => evaluate(`new Promise((r) => { let k = 0; const f = () => (++k >= ${n} ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); })`);
const type = async (str) => { for (const d of str) { await tap(d, 40); await frames(); } };

// ---- The pure modules, straight from the dev server ----
await until(() => evaluate(`!!(window.__storm && __storm.scene.isActive('title'))`));
const pure = await evaluate(`(async () => {
  const F = await import('/src/facts.ts');
  const A = await import('/src/answer.ts');
  const out = {};
  const sub = F.factsFor('-', 20, 10), div = F.factsFor('/', 20, 12);
  out.noNegatives = sub.every((f) => f.ans >= 0 && f.a - f.b === f.ans);
  out.exactDivision = div.every((f) => Number.isInteger(f.ans) && f.b * f.ans === f.a) && div.length === 144;
  out.within10 = F.factsFor('+', 10, 5).every((f) => f.ans <= 10);
  // A long run of the picker against a churning sky: no answer is ever a strict prefix of another.
  let seed = 9; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const p = new F.Picker(F.poolFor({ ops: ['+', '-', 'x', '/'], addR: 100, mulR: 12, pace: 'gale' }), new Map(), rand);
  let live = [], bad = 0, picks = 0;
  for (let i = 0; i < 3000; i++) {
    if (live.length >= 6 || (live.length && rand() < 0.4)) live.splice(Math.floor(rand() * live.length), 1);
    const f = p.pick(live.map((x) => x.str), new Set(live.map((x) => x.key)));
    if (!f) continue;
    picks++;
    for (const o of live) if (o.str !== f.str && (o.str.startsWith(f.str) || f.str.startsWith(o.str))) bad++;
    if (live.some((o) => o.key === f.key)) bad++;
    live.push(f);
  }
  out.prefix = { bad, picks };
  // A missed fact comes back within 2–4 spawns.
  const q = new F.Picker(F.poolFor(F.DEFAULT_SETTINGS), new Map(), rand);
  const missed = F.factsFor('x', 20, 10).find((f) => f.key === '7x8');
  q.miss(missed);
  let back = -1;
  for (let i = 0; i < 6 && back < 0; i++) if (q.pick([], new Set())?.key === '7x8') back = i + 1;
  out.requeue = back;
  out.box = { ...q.memory.get('7x8') };
  q.credit(missed, true); out.quick = q.memory.get('7x8').box;
  q.credit(missed, false); out.slow = q.memory.get('7x8').box;
  const r = (b, d, l) => A.typeDigit(b, d, l);
  out.answer = [r('', '5', ['56']).typed.kind, r('5', '6', ['56', '7']).typed.kind, r('', '9', ['56']).typed.kind, A.staleClear('5', ['72']), A.staleClear('5', ['56'])];
  return out;
})()`);
check('subtraction never goes below 0; division is exact', pure.noNegatives && pure.exactDivision && pure.within10);
check('the picker never puts a prefix pair in the sky', pure.prefix.bad === 0 && pure.prefix.picks > 2000, JSON.stringify(pure.prefix));
check('a missed fact returns 2–4 spawns later, in box 0', pure.requeue >= 2 && pure.requeue <= 4 && pure.box.box === 0 && pure.box.missed, JSON.stringify([pure.requeue, pure.box]));
check('quick answers move a box up; slow ones hold at least box 1', pure.quick === 1 && pure.slow === 1);
check('answer rules: partial, match, misfire, stale clear', JSON.stringify(pure.answer) === JSON.stringify(['partial', 'match', 'misfire', '', '5']), JSON.stringify(pure.answer));

// ---- The game ----
await tap('Enter');
await until(() => evaluate(`__storm.scene.isActive('sky') && __storm.scene.isActive('hud')`));
const wiz = await run(`const w = s.islands.wizard; return { x: w.x, y: w.y, flip: w.flipX };`);
check('the wizard rides his cloud beside the answer box, wand towards it', wiz.x + 8 <= 184 && Math.abs(wiz.y - 213) <= 6 && wiz.flip, JSON.stringify(wiz));

await until(() => run(`return s.foes.length > 0;`), 20000);
await sleep(300);
const first = await run(`const f = s.foes[0]; return { str: f.fact.str, label: f.text.text, x: f.x, y: f.y };`);
check('hail falls carrying a problem', /^\d+ [+−×÷] \d+$/.test(first.label), first.label);
await shot('1-hail');

// Answer the first stone by typing: the wand twinkles, then the nearest tower fires.
await type(first.str);
const mid = await run(`return { cast: s.cast?.kind, doomed: s.foes.find((f) => f.fact.str === '${first.str}')?.doomed ?? null };`);
await shot('2-twinkle');
check('typing the answer twinkles the wand and holds the stone', mid.cast === 'twinkle' && mid.doomed !== false, JSON.stringify(mid));
await until(() => run(`return !s.foes.some((f) => f.fact.str === '${first.str}') && s.hud.score > 0;`), 5000);
const struck = await run(`return { score: s.hud.score, bolt: s.lastBolt, streak: s.streak };`);
const nearest = [24, 208, 392].reduce((b, x, i) => (Math.abs(x - struck.bolt.x) < Math.abs([24, 208, 392][b] - struck.bolt.x) ? i : b), 0);
check('then a bolt from the nearest tower strikes it for 50', struck.score === 50 && struck.bolt.tower === nearest && struck.streak === 1, JSON.stringify(struck));

// From here the sky is set up by hand.
const clear = `s.spawning = false; for (const f of s.foes) { f.img.destroy(); f.text.destroy(); f.dead = true; } s.foes = []; s.hud.buffer = '';`;
const fact = (op, a, b) => `F.factsFor('${op}', 20, 12).find((f) => f.key === '${a}${op}${b}')`;
const spawn = (op, a, b, x, y, target = `{ kind: 'cottage', i: 1, x: 116 }`) =>
  `s.spawnHail({ fact: ${fact(op, a, b)}, x: ${x}, y: ${y}, target: ${target} });`;
const setup = (body) => run(`const F = await import('/src/facts.ts'); ${body}`);

await setup(`${clear} ${spawn('x', 7, 8, 100, 40)}`);
await sleep(200);
// Hold the game clock still while the misfire is inspected, so the 0.4 s lockout can't run out mid-check.
await type('9');
await run(`s.scene.pause();`);
const mis = await run(`return { box: s.hud.buffer, misfire: s.hud.misfire, t: s.hud.misfireT, cast: s.cast?.kind, lock: s.lockout, streak: s.streak };`);
await shot('3-misfire');
check('a digit that leads nowhere misfires: box cleared, streak reset, wand fizzles', mis.box === '' && mis.misfire === '9' && mis.t > 0 && mis.cast === 'fizzle' && mis.lock > 0 && mis.streak === 0, JSON.stringify(mis));
await run(`s.lockout = 0.4; s.scene.resume();`);
await type('5');
check('digits are locked out just after a misfire', (await run(`return s.hud.buffer;`)) === '');
await until(() => run(`return s.lockout === 0;`));
await type('5');
const partial = await run(`return s.hud.buffer;`);
await tap('Backspace');
await frames();
check('a partial answer waits, and Backspace takes it back', partial === '5' && (await run(`return s.hud.buffer;`)) === '');

// Equal answers strike together.
await setup(`${clear} ${spawn('x', 3, 4, 60, 40)} ${spawn('x', 6, 2, 330, 40)}`);
const before = await run(`return s.hud.score;`);
await type('12');
await until(() => run(`return s.foes.length === 0;`), 5000);
check('one answer strikes every stone that equals it', (await run(`return s.hud.score;`)) - before === 100);

// A blast catches a neighbour: a chain.
await setup(`${clear} ${spawn('x', 4, 5, 150, 70)} ${spawn('-', 19, 12, 160, 74)}`);
const b2 = await run(`return s.hud.score;`);
await type('20');
await until(() => run(`return s.foes.length === 0;`), 5000);
const gain = (await run(`return s.hud.score;`)) - b2;
check('a blast catches a stone beside it as a chain', gain === 50 + 25, `+${gain}`);
check('a caught stone is not counted for drilling', !(await run(`return s.picker.memory.has('19-12');`)));

// A landing: the cottage loses its roof, the streak resets, and the fact shows big.
await setup(`${clear} s.streak = 4; ${spawn('x', 6, 7, 70, 186, `{ kind: 'cottage', i: 0, x: 70 }`)}`);
await until(() => run(`return s.foes.length === 0;`), 5000);
await sleep(100);
const landed = await run(`return { hits: s.cottages[0], streak: s.streak, mem: s.picker.memory.get('6x7'),
  fact: s.children.list.some((o) => o.type === 'Text' && o.text === '6 × 7 = 42' && o.visible), tex: s.islands.cottages[0].texture.key };`);
await shot('4-landed');
check('a landing damages the cottage and resets the streak', landed.hits === 1 && landed.streak === 0 && landed.tex === 'cottage', JSON.stringify(landed));
check('the full fact shows over the impact, and goes back to box 0', landed.fact && landed.mem.box === 0 && landed.mem.missed);

// A struck tower is stunned, and the next nearest fires instead.
await setup(`${clear} ${spawn('+', 2, 5, 24, 186, `{ kind: 'tower', i: 0, x: 24 }`)}`);
await until(() => run(`return s.foes.length === 0;`), 5000);
await setup(`${spawn('+', 3, 6, 30, 60)}`);
await type('9');
await until(() => run(`return s.foes.length === 0;`), 5000);
const stun = await run(`return { stun: s.stun[0], tower: s.lastBolt.tower };`);
check('a struck tower is stunned; the next nearest fires', stun.stun > 0 && stun.tower === 1, JSON.stringify(stun));

// A stone that lands while you're mid-answer clears the box without a penalty.
await setup(`${clear} s.streak = 2; ${spawn('x', 7, 8, 162, 170, `{ kind: 'cottage', i: 2, x: 162 }`)} ${spawn('x', 9, 9, 300, 30)}`);
await type('5');
await until(() => run(`return s.foes.length === 1;`), 5000);
const stale = await run(`return { box: s.hud.buffer, misfire: s.hud.misfireT, cast: s.cast?.kind ?? null };`);
check('a typed prefix whose stone has gone clears silently', stale.box === '' && stale.misfire === 0 && stale.cast !== 'fizzle', JSON.stringify(stale));

// The controller: point the stick at a digit on the arc, press A.
await evaluate(`(() => {
  const pad = { id: 'Test pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(), axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = pad;
  navigator.getGamepads = () => [pad, null, null, null];
  window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad }));
})()`);
await sleep(300);
await setup(`${clear} ${spawn('x', 3, 3, 250, 40)}`);
await evaluate(`__pad.axes = [Math.cos(Math.PI / 9), -Math.sin(Math.PI / 9), 0, 0]; __pad.timestamp = performance.now() + 1e6;`);
await until(() => run(`return s.hud.arc === 8 && s.hud.device === 'pad';`), 3000).catch(() => false);
const arc = await run(`return { arc: s.hud.arc, device: s.hud.device };`);
await shot('5-arc');
await evaluate(`__pad.axes = [0, 0, 0, 0]; __pad.buttons[0] = { pressed: true, touched: true, value: 1 }; __pad.timestamp = performance.now() + 1e6;`);
await sleep(250);
await evaluate(`__pad.buttons[0] = { pressed: false, touched: false, value: 0 }; __pad.timestamp = performance.now() + 1e6;`);
await until(() => run(`return s.foes.length === 0;`), 5000).catch(() => false);
check('the stick picks 9 on the arc and A enters it', arc.arc === 8 && arc.device === 'pad' && (await run(`return s.foes.length;`)) === 0, JSON.stringify(arc));
await evaluate(`navigator.getGamepads = () => [null, null, null, null]; window.dispatchEvent(Object.assign(new Event('gamepaddisconnected'), { gamepad: __pad }));`);

// A busy sky for the screenshot, then the last cottage falls.
await setup(`${clear} s.spawning = true;`);
await sleep(6000);
await shot('6-busy');
await setup(`${clear} s.cottages = [2, 2, 2, 2, 2, 1]; [0, 1, 2, 3, 4, 5].forEach((i) => s['drawCottage'](i)); ${spawn('x', 8, 8, 346, 186, `{ kind: 'cottage', i: 5, x: 346 }`)}`);
await until(() => run(`return s.state === 'over';`), 5000);
await sleep(400);
await shot('7-over');
check('when every cottage is rubble, the storm wins', await run(`return s.hud.over && s.picker.missedRecent.length > 0;`));
await until(() => evaluate(`__storm.scene.isActive('title')`), 30000);
check('and the game returns to the title', true);

done();
