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
/** The answer box, bottom centre, clear of the bottom corners (touch). */
export const ANSWER_BOX = { w: 48, h: 14, y: 206 };
/** The wizard rides a small storm cloud just left of the answer box, wand towards it. */
export const WIZARD = { x: 164, y: 210 };
/** The wand's tip, from the wizard's centre (the sprite is flipped so the wand faces the box). */
export const WAND = { x: 6, y: -6 };

/** Fall time for a stone from the cloud deck to the ground, the spawn gap multiplier and the most on screen. */
export const PACE = {
  breeze: { fall: 18, gap: 1.4, cap: 3 },
  gale: { fall: 12, gap: 1.0, cap: 5 },
  tempest: { fall: 8, gap: 0.75, cap: 7 },
} as const;
export type Pace = keyof typeof PACE;

/** Points per threat, before the streak multiplier. */
export const POINTS = { hail: 50, cloud: 100, ball: 150, crow: 250, chain: 25 } as const;
/** The streak multiplier: ×(1 + correct-in-a-row ÷ 3), whole steps, capped. */
export const multFor = (streak: number) => Math.min(8, 1 + Math.floor(streak / 3));

export const PLAY = {
  /** The wand twinkles this long before the towers fire. */
  twinkle: 0.12,
  /** A misfire locks the digits out this long. */
  lockout: 0.4,
  /** A struck tower can't fire for this long. */
  stun: 5,
  /** Answered above this fraction of the fall counts as quick (the fact moves up a box). */
  quick: 0.6,
  /** Blast radius, its growth (px/s) and life. */
  blast: { r: 15, grow: 60, life: 0.75 },
  /** A landed fact shows over the impact this long. */
  factLife: 2.2,
  /** Cottages take two hits. */
  cottageHits: 2,
  /** Stones appear just under the cloud deck, with room for their plate above. */
  spawnY: TOP + 22,
};

/** The controller's digit arc, opening upwards over the answer box, clear of the wizard. */
export const ARC = { cx: 208, cy: 216, r: 30 };
export const ARC_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export const BACKDROP = {
  /** Sky gradient, top to bottom, dithered between bands. */
  bands: ['#070b1c', '#0a1026', '#0e1630', '#121c3b', '#172347', '#1c2a52', '#22325d', '#283a66'],
  stars: 50,
  /** Cloud deck drift, px/s: back and front layers. */
  cloudSpeed: [4, 9],
  rain: { drops: 70, speed: [140, 220] as const, slant: 0.25 },
};
