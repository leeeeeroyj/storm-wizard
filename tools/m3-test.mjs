// Milestone 3: the full roster. Split cloud, ball lightning, the Storm Crow and its gifts, and the Thunderclap.
// Usage: node tools/m3-test.mjs <project-dir> <out-dir>
import { session, sleep } from './cdp.mjs';

const [project = '.', out = 'm3-out'] = process.argv.slice(2);
const t = await session({ project, out, port: 5263, debugPort: 9373, width: 1664, height: 912 });
const { evaluate, until, shot, tap, check, done } = t;
const S = `__storm.scene.getScene('sky')`;
const run = (body) => evaluate(`(async () => { const s = ${S}; ${body} })()`);
const frames = (n = 3) => evaluate(`new Promise((r) => { let k = 0; const f = () => (++k >= ${n} ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); })`);
const type = async (str) => { for (const d of str) { await tap(d, 40); await frames(); } };
const clear = `s.spawning = false; for (const f of s.foes) { f.img.destroy(); f.halo?.destroy(); f.text.destroy(); f.dead = true; } s.foes = []; s.strikes = []; s.blasts = []; s.hud.buffer = ''; s.streak = 0; s.lockout = 0;`;
const fact = (op, a, b, r = 20) => `F.factsFor('${op}', ${r}, 12).find((f) => f.key === '${a}${op}${b}')`;
const at = (kind, f, x, y, extra = '') => `s.spawn('${kind}', { fact: ${f}, x: ${x}, y: ${y} ${extra} });`;
const setup = (body) => run(`const F = await import('/src/facts.ts'); ${body}`);
const gone = (key) => until(() => run(`return !s.foes.some((f) => f.fact.key === '${key}');`), 6000);

await until(() => evaluate(`!!(window.__storm && __storm.scene.isActive('title'))`));
await tap('Enter');
await until(() => evaluate(`__storm.scene.isActive('sky') && __storm.scene.isActive('hud')`));
await sleep(300);

const kinds = await run(`return Array.from({ length: 24 }, (_, n) => s.kindFor(n));`);
check('the roster joins by spawn count: clouds, ball lightning and crows', ['cloud', 'ball', 'crow'].every((k) => kinds.includes(k)) && kinds.slice(0, 3).every((k) => k === 'hail'), kinds.join(' '));

// ---- Split cloud ----
await setup(`${clear} ${at('cloud', fact('x', 4, 6), 120, 50)}`);
let s0 = await run(`return s.hud.score;`);
await type('24');
await gone('4x6');
const cloudBlast = await run(`return Math.max(0, ...s.blasts.map((b) => b.max));`);
check('a split cloud answered scores 100 and blasts wider', (await run(`return s.hud.score;`)) - s0 === 100 && cloudBlast === 20, `blast ${cloudBlast}`);

await setup(`${clear} ${at('cloud', fact('x', 3, 7), 200, 98)}`);
await until(() => run(`return !s.foes.some((f) => f.kind === 'cloud');`), 6000);
const shards = await run(`return { n: s.foes.filter((f) => f.kind === 'hail').length, answers: s.foes.map((f) => f.fact.str), mem: s.picker.memory.get('3x7'),
  popup: s.children.list.some((o) => o.type === 'Text' && o.text === '3 × 7 = 21') };`);
const prefixPair = shards.answers.some((a, i) => shards.answers.some((b, j) => i !== j && a !== b && b.startsWith(a)));
await shot('1-split');
check('an unanswered cloud bursts into three stones with new problems', shards.n === 3 && !prefixPair, JSON.stringify(shards.answers));
check('and its fact is missed and shown', shards.mem?.missed && shards.popup);

// ---- Ball lightning ----
await setup(`${clear} ${at('ball', fact('x', 9, 9), 200, 40, `, target: { kind: 'cottage', i: 3, x: 254 }`)}`);
const path = [];
for (let i = 0; i < 6; i++) {
  path.push(await run(`const f = s.foes[0]; const p = Math.min(1, f.p); return f.x - (f.sx + (f.tx - f.sx) * p);`));
  await sleep(250);
}
check('ball lightning zigzags off its straight line', Math.max(...path.map(Math.abs)) > 3, path.map((v) => v.toFixed(1)).join(' '));
await setup(`${clear} ${at('ball', fact('x', 9, 9), 150, 60)} ${at('hail', fact('x', 4, 5), 156, 60)} s.foes.forEach((f) => (f.dur = 1e6));`);
await type('20');
await gone('4x5');
await sleep(500);
check('ball lightning is immune to chain blasts', await run(`return s.foes.some((f) => f.kind === 'ball' && !f.dead);`));
s0 = await run(`return s.hud.score;`);
await type('81');
await gone('9x9');
check('and answering it scores 150', (await run(`return s.hud.score;`)) - s0 === 150 * (await run(`return s.hud.mult;`)));

// ---- The Storm Crow ----
await setup(`${clear} ${at('crow', 'undefined', 90, 40, ', dir: 1')}`);
const crow = await run(`const f = s.foes[0]; return { key: f.fact.key, stretch: s.stretchPool.some((x) => x.key === f.fact.key), halo: !!f.halo, x0: f.x, str: f.fact.str };`);
await sleep(600);
const crowX = await run(`return s.foes[0].x;`);
await shot('2-crow');
check('the crow crosses high with a stretch problem and a halo', crow.stretch && crow.halo && crowX > crow.x0, JSON.stringify(crow));

const gift = async (kind, before, after) => {
  await setup(`${clear} ${before} s.forceGift = '${kind}'; ${at('crow', fact('x', 11, 12, 12), 200, 40, ', dir: 1')}`);
  const sc = await run(`return s.hud.score;`);
  await type('132');
  await gone('11x12');
  await sleep(100);
  return { gift: await run(`return s.lastGift;`), score: (await run(`return s.hud.score;`)) - sc, ...(await run(after)) };
};
const ward = await gift('ward', '', `return { wards: s.wards.filter(Boolean).length };`);
await shot('3-ward');
check('answering the crow scores 250 and gives a gift: Ward shields a cottage', ward.gift === 'ward' && ward.wards === 1 && ward.score === 250, JSON.stringify(ward));
const mend = await gift('mend', `s.cottages[2] = 2; s.drawCottage(2);`, `return { hits: s.cottages[2], tex: s.islands.cottages[2].texture.key };`);
check('Mend rebuilds a step of the worst cottage', mend.hits === 1 && mend.tex === 'cottage', JSON.stringify(mend));
const mend2 = await gift('mend', `s.cottages = s.cottages.map(() => 0); [0,1,2,3,4,5].forEach((i) => s.drawCottage(i));`, `return {};`);
check('or scores 500 when nothing is damaged', mend2.score === 750, JSON.stringify(mend2));
const gust = await gift('gust', '', `return { gust: s.gust };`);
await setup(`${at('hail', fact('+', 3, 4), 300, 40)}`);
const g0 = await run(`return { p: s.foes[0].p, t: s.playTime };`);
await sleep(500);
const g1 = await run(`return { p: s.foes[0].p, t: s.playTime };`);
await shot('4-gust');
await setup(`${clear} s.gust = 0; ${at('hail', fact('+', 3, 4), 300, 40)}`);
const n0 = await run(`return { p: s.foes[0].p, t: s.playTime };`);
await sleep(500);
const n1 = await run(`return { p: s.foes[0].p, t: s.playTime };`);
const rateGust = (g1.p - g0.p) / (g1.t - g0.t), rateNormal = (n1.p - n0.p) / (n1.t - n0.t);
check('Gust slows everything in the sky', gust.gift === 'gust' && gust.gust > 4 && rateGust < rateNormal * 0.8, `gust ${rateGust.toFixed(4)} vs ${rateNormal.toFixed(4)}`);

await setup(`${clear} s.wards[0] = true; ${at('hail', fact('+', 2, 6), 70, 186, `, target: { kind: 'cottage', i: 0, x: 70 }`)}`);
await gone('2+6');
check('a ward takes a hit for its cottage', await run(`return s.cottages[0] === 0 && !s.wards[0];`));

await setup(`${clear} ${at('crow', fact('x', 12, 12, 12), 150, 60, ', dir: 1')} s.foes[0].vx = 0; ${at('hail', fact('x', 4, 5), 154, 60)}`);
await type('20');
await gone('4x5');
await sleep(400);
check('the crow is immune to chain blasts', await run(`return s.foes.some((f) => f.kind === 'crow');`));
await setup(`${clear} ${at('crow', fact('x', 12, 11, 12), 425, 40, ', dir: 1')}`);
await until(() => run(`return s.foes.length === 0;`), 4000);
check('a crow that gets away leaves no mark on its fact', !(await run(`return s.picker.memory.has('12x11');`)));

// ---- The Thunderclap ----
await setup(`${clear} ${at('hail', fact('x', 6, 6), 100, 60)} ${at('hail', fact('+', 9, 8), 300, 80)} ${at('crow', fact('x', 12, 12, 12), 200, 40, ', dir: 1')} s.foes.forEach((f) => f.kind === 'crow' && (f.vx = 0));`);
await tap(' ');
await frames();
check('Space does nothing below ×4', await run(`return s.foes.length === 3 && s.cast === undefined;`));
await run(`s.streak = 9;`);
await frames();
const hudReady = await evaluate(`(() => { const h = __storm.scene.getScene('hud'); return h.clapKey.visible ? h.clapKey.text : ''; })()`);
await shot('5-ready');
check('at ×4 the HUD shows the Thunderclap is ready, and its key', hudReady === 'SPACE', hudReady);
s0 = await run(`return s.hud.score;`);
await tap(' ');
await frames(2);
await shot('6-thunderclap');
await until(() => run(`return s.foes.filter((f) => f.kind !== 'crow').length === 0;`), 4000);
const clap = await run(`return { score: s.hud.score, streak: s.streak, crow: s.foes.some((f) => f.kind === 'crow'), mem: s.picker.memory.has('6x6') || s.picker.memory.has('9+8') };`);
check('the Thunderclap strikes every stone but the crow at ×4, and spends the streak', clap.score - s0 === 400 && clap.streak === 0 && clap.crow, JSON.stringify({ ...clap, gain: clap.score - s0 }));
check('Thunderclap kills are not counted for drilling', !clap.mem);

// A controller's Y.
await evaluate(`(() => {
  const pad = { id: 'Test pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(), axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = pad;
  navigator.getGamepads = () => [pad, null, null, null];
  window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad }));
})()`);
await sleep(300);
await setup(`${clear} s.streak = 12; ${at('hail', fact('x', 7, 7), 100, 60)}`);
await evaluate(`__pad.buttons[3] = { pressed: true, touched: true, value: 1 }; __pad.timestamp = performance.now() + 1e6;`);
await sleep(250);
await evaluate(`__pad.buttons[3] = { pressed: false, touched: false, value: 0 }; __pad.timestamp = performance.now() + 1e6;`);
await until(() => run(`return s.foes.length === 0;`), 4000).catch(() => false);
const ydiag = await run(`const p = s.input.gamepad?.pad1; return { foes: s.foes.length, streak: s.streak, device: s.hud.device, pad: !!p, connected: p?.connected, total: s.input.gamepad?.total };`);
check('Y on a controller claps too', ydiag.foes === 0 && ydiag.streak === 0, JSON.stringify(ydiag));

done();
