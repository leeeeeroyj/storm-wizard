// Every tunable in one place. Units are design pixels (the 416×228 screen) and seconds unless noted.

export const WIDTH = 416;
export const HEIGHT = 228;
/** Height of the HUD's top bar. */
export const TOP = 14;
/** The grass line of the islands: cottages and towers stand on it. */
export const GROUND = 196;

/** The canvas renders at 4× the design size; the browser scales it smoothly to fit. */
export const RENDER_SCALE = 4;
/** HUD units are half a design pixel, so HUD text and icons get twice the detail. */
export const HUD_SCALE = RENDER_SCALE / 2;

export const FONT = '"Atkinson Hyperlegible Mono", ui-monospace, monospace';
export const FONT_WEIGHT = '800';
export const FONT_BODY = '"Atkinson Hyperlegible Next", "Segoe UI", system-ui, sans-serif';
export const FONT_TITLE = '"Pirata One", Georgia, serif';

export const COLORS = {
  night: 0x0a0f22,
  bar: 0x060916,
  line: 0x283361,
  panel: 0x131a35,
  ink: 0xedf1ff,
  dim: 0x9ba7d2,
  bolt: 0xffe36e,
  ice: 0xbfe9ff,
  plate: 0xf4f7ff,
  plateInk: 0x0d1330,
};

export const TEXT = {
  ink: '#edf1ff',
  dim: '#9ba7d2',
  bolt: '#ffe36e',
  ice: '#bfe9ff',
  plateInk: '#0d1330',
};

/** One 16×16 sprite per slot, exported by tools/sprites.py to assets/sprites/<slot>.png. */
export const SPRITES = ['wizard', 'tower', 'cottage', 'rubble', 'hailstone', 'splitcloud', 'crow', 'balllightning', 'gust', 'mend', 'ward'] as const;

/** Three floating islands: [left, right] edges. The centre one holds the wizard's tower. */
export const ISLANDS: ReadonlyArray<readonly [number, number]> = [[2, 186], [190, 226], [230, 414]];
/** TOWER cottage cottage cottage TOWER cottage cottage cottage TOWER. */
export const TOWERS_X = [24, 208, 392];
export const COTTAGES_X = [70, 116, 162, 254, 300, 346];
/** Where the wizard stands, on top of the centre tower. */
export const WIZARD = { x: 208, y: GROUND - 24 };

/** The answer box, bottom centre, clear of the bottom corners (touch). */
export const ANSWER_BOX = { w: 48, h: 14, y: 206 };

export const BACKDROP = {
  /** Sky gradient, top to bottom, dithered between bands. */
  bands: ['#070b1c', '#0a1026', '#0e1630', '#121c3b', '#172347', '#1c2a52', '#22325d', '#283a66'],
  stars: 50,
  /** Cloud deck drift, px/s: back and front layers. */
  cloudSpeed: [4, 9],
  rain: { drops: 70, speed: [140, 220] as const, slant: 0.25 },
};
