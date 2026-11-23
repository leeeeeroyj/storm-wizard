// Milestone 1: the title, then the sky over the islands with the HUD.
// Usage: node tools/m1-test.mjs <project-dir> <out-dir>
import { session, sleep } from './cdp.mjs';

const [project = '.', out = 'm1-out'] = process.argv.slice(2);
const t = await session({ project, out, port: 5261, debugPort: 9371, width: 1664, height: 912 });
const { evaluate, until, shot, tap, check, done } = t;
const sky = `__storm.scene.getScene('sky')`;

await until(() => evaluate(`!!(window.__storm && __storm.scene.isActive('title'))`));
await sleep(1200);
await shot('1-title');
check('title scene runs', true);
check('fonts loaded', await evaluate(`document.fonts.check('800 8px "Atkinson Hyperlegible Mono"') && document.fonts.check('700 8px "Atkinson Hyperlegible Next"') && document.fonts.check('16px "Pirata One"')`));
const SPRITES = ['wizard', 'tower', 'cottage', 'rubble', 'hailstone', 'splitcloud', 'crow', 'balllightning', 'gust', 'mend', 'ward'];
const sizes = await evaluate(`${JSON.stringify(SPRITES)}.map((k) => { const f = __storm.textures.get(k).get(); return k + ':' + f.width + 'x' + f.height; })`);
check('every sprite loads at 16×16', sizes.every((s) => s.endsWith(':16x16')), sizes.join(' '));

await tap('Enter');
await until(() => evaluate(`__storm.scene.isActive('sky') && __storm.scene.isActive('hud')`));
await sleep(800);
const world = await evaluate(`(() => { const s = ${sky}; return {
  towers: s.islands.towers.map((i) => [i.x, i.y, i.texture.key]),
  cottages: s.islands.cottages.map((i) => [i.x, i.y, i.texture.key]),
  wizard: [s.islands.wizard.x, s.islands.wizard.y],
  zoom: s.cameras.main.zoom,
}; })()`);
check('three towers at 24, 208, 392', JSON.stringify(world.towers.map((x) => x[0])) === '[24,208,392]' && world.towers.every((x) => x[2] === 'tower'));
check('six cottages', world.cottages.length === 6 && world.cottages.every((x) => x[2] === 'cottage'), JSON.stringify(world.cottages.map((x) => x[0])));
check('wizard beside the answer box', world.wizard[0] + 8 <= 184 && world.wizard[1] > 196);
check('camera zooms 4×', world.zoom === 4);

// The backdrop moves: clouds drift and rain falls, measured on the scene's own clock (headless runs slowly).
const s0 = await evaluate(`(() => { const s = ${sky}; return { t: s.playTime, back: s.backdrop.back.tilePositionX, front: s.backdrop.front.tilePositionX }; })()`);
await sleep(1500);
const s1 = await evaluate(`(() => { const s = ${sky}; return { t: s.playTime, back: s.backdrop.back.tilePositionX, front: s.backdrop.front.tilePositionX }; })()`);
check('clouds drift, the front layer faster', s1.front !== s0.front && s1.back !== s0.back && s1.t > s0.t, JSON.stringify([s0, s1]));

const hud = await evaluate(`(() => { const h = __storm.scene.getScene('hud'); return { score: h.score.text, wave: h.wave.text, mult: h.mult.text }; })()`);
check('HUD shows score, streak and wave', hud.score === '000000' && hud.wave === 'WAVE 1' && hud.mult === '×1', JSON.stringify(hud));
await shot('2-sky');

// A second size: the canvas letterboxes on the background colour.
await t.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: false });
await sleep(600);
const fit = await evaluate(`(() => { const r = __storm.canvas.getBoundingClientRect(); return { w: r.width, h: r.height, left: r.left }; })()`);
check('fits a wide screen, centred', Math.abs(fit.h - 390) < 1 && Math.abs(fit.w / fit.h - 416 / 228) < 0.01 && fit.left > 0, JSON.stringify(fit));
await shot('3-wide');

done();
