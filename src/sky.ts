import Phaser from 'phaser';
import { BACKDROP, GROUND, HEIGHT, ISLANDS, TOP, WIDTH } from './config';

// The backdrop, drawn in code as pixel art in three depths. The further away a layer is, the finer its pixels:
// - far (¼ design pixel, the canvas's own pixels): the sky's gradient, a dense starfield with a few twinkling, a dim
//   crescent moon, towering storm clouds on the horizon that sheet lightning lights from inside, and fine rain;
// - middle (½ design pixel): far-off floating islets and thin drifting wisps;
// - near (1 design pixel): the cloud deck, the rain and the three islands the game is played on.
// Textures are baked once per game and shared by every scene. Nothing here carries meaning: it's all atmosphere,
// kept dark behind the white plates and stones.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bake(scene: Phaser.Scene, key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  paint(tex.getContext());
  tex.refresh();
}

function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    g.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}

type RGB = [number, number, number];
const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** A pixel buffer: `put` blends a colour over what's there ("over", with alpha). */
class Px {
  readonly d: Uint8ClampedArray;
  constructor(readonly w: number, readonly h: number) {
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  put(x: number, y: number, c: RGB, a = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = (y * this.w + x) * 4, d = this.d;
    if (a >= 1) {
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
      return;
    }
    const da = d[i + 3] / 255, oa = a + da * (1 - a);
    for (let k = 0; k < 3; k++) d[i + k] = (c[k] * a + d[i + k] * da * (1 - a)) / oa;
    d[i + 3] = oa * 255;
  }
}

function bakePx(scene: Phaser.Scene, key: string, w: number, h: number, paint: (p: Px) => void) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const p = new Px(w, h);
  paint(p);
  const img = tex.getContext().createImageData(w, h);
  img.data.set(p.d);
  tex.getContext().putImageData(img, 0, 0);
  tex.refresh();
}

/** Far layers are baked at 4 texels per design pixel, middle ones at 2. */
const FAR = 4, MID = 2;
/** The moon, in design pixels. */
const MOON = { x: 340, y: 46, r: 7 };
/** The distant storm clouds span these rows (design pixels). */
const BANK = { top: 96, bottom: 214 };
/** The towers of the distant storm: centre x and height above the bank's base, design pixels. */
const TOWERS = [[34, 58], [120, 40], [200, 72], [270, 34], [354, 62]] as const;
/** The width of the lit copy around each tower, design pixels. */
const LIT_W = 100;
/** Bright stars that twinkle, in far texels. Filled by `bakeFar`. */
const twinklers: { x: number; y: number; ph: number; f: number }[] = [];

function bakeFar(scene: Phaser.Scene) {
  const W = WIDTH * FAR, H = HEIGHT * FAR;
  bakePx(scene, 'sky-far', W, H, (p) => {
    // The gradient, interpolated per row and dithered one level at the finest grain.
    const bands = BACKDROP.bands.map(rgb);
    for (let y = 0; y < H; y++) {
      const t = (y / H) * (bands.length - 1), i = Math.min(bands.length - 2, Math.floor(t));
      const c = mix(bands[i], bands[i + 1], t - i);
      for (let x = 0, i = y * W * 4; x < W; x++, i += 4) {
        const dz = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
        p.d[i] = c[0] + dz;
        p.d[i + 1] = c[1] + dz;
        p.d[i + 2] = c[2] + dz;
        p.d[i + 3] = 255;
      }
    }
    const r = mulberry32(7);
    const mx = MOON.x * FAR, my = MOON.y * FAR, mr = MOON.r * FAR;
    const nearMoon = (x: number, y: number) => Math.hypot(x - mx, y - my) < mr * 2.4;
    // A faint band of dust and dim stars, crossing the sky on a slant.
    for (let n = 0; n < 2600; n++) {
      const u = r(), v = (r() + r() + r() - 1.5) * 0.11;
      const x = u * W, y = (TOP + 10 + (u * 0.55 + 0.08 + v) * 120) * FAR;
      if (!nearMoon(x, y)) p.put(x, y, rgb('#8592c4'), 0.12 + r() * 0.22);
    }
    // The starfield: many faint, a few bright, thinning towards the horizon.
    const dim = rgb('#4e5b92'), bright = rgb('#eef2ff');
    for (let n = 0; n < 900; n++) {
      const x = r() * W, y = (TOP + 2 + r() ** 1.5 * 140) * FAR, b = r() ** 3;
      if (nearMoon(x, y)) continue;
      const c = mix(dim, bright, b), a = 0.45 + b * 0.55;
      p.put(x, y, c, a);
      if (b > 0.55) {
        p.put(x + 1, y, c, a * 0.5);
        p.put(x, y + 1, c, a * 0.5);
      }
      if (b > 0.8 && twinklers.length < 36) twinklers.push({ x: Math.round(x), y: Math.round(y), ph: r() * 6.28, f: 0.6 + r() * 1.4 });
    }
    // The moon: a soft halo, the unlit disc just showing, and a thin lit crescent facing the upper right.
    const halo = rgb('#7f8cc4');
    for (let y = my - mr * 5; y < my + mr * 5; y++)
      for (let x = mx - mr * 5; x < mx + mr * 5; x++) {
        const d = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
        if (d > mr && d < mr * 5) p.put(x, y, halo, 0.16 * (1 - (d - mr) / (mr * 4)) ** 2.2);
      }
    const lit = rgb('#c9d1ee'), shade = rgb('#232c52');
    for (let y = my - mr; y <= my + mr; y++)
      for (let x = mx - mr; x <= mx + mr; x++) {
        const d = Math.hypot(x - mx, y - my);
        if (d > mr) continue;
        const inner = Math.hypot(x - (mx - mr * 0.45), y - (my + mr * 0.35));
        if (inner > mr * 0.95) p.put(x, y, lit, Math.min(1, (inner - mr * 0.95) / 3) * (d > mr - 1 ? 0.6 : 0.85));
        else p.put(x, y, shade, 0.7);
      }
  });
}

// The distant storm: a bank of billows along the horizon with towering heads, each billow a little sphere lit by
// the moon from the upper right. A second copy, lit from inside, is what the sheet lightning shows.
const W_FAR = WIDTH * FAR;
const H2 = (BANK.bottom - BANK.top) * FAR;
let billowCache: { x: number; y: number; r: number }[] | undefined;

function stormBillows() {
  if (billowCache) return billowCache;
  const W = W_FAR;
  const billows: { x: number; y: number; r: number }[] = [];
  {
    const r = mulberry32(31);
    const base = (BANK.bottom - BANK.top - 28) * FAR;
    for (let x = -10 * FAR; x < W + 10 * FAR; x += (5 + r() * 6) * FAR) billows.push({ x, y: base + (r() * 6 - 1) * FAR, r: (8 + r() * 7) * FAR });
    for (const [tx, th] of TOWERS) {
      for (let n = 0; n < th * 2.2; n++) {
        const f = r() ** 0.8;
        // A column that narrows as it climbs, bulging into a cauliflower head near the top.
        const width = (14 - f * 6 + (f > 0.75 ? 6 : 0)) * (0.6 + th / 120);
        billows.push({ x: (tx + (r() - 0.5) * 2 * width + f * 5) * FAR, y: base - f * th * FAR, r: (2.5 + r() * (f > 0.7 ? 7 : 5)) * FAR });
      }
      // The tallest spread an anvil at the top.
      if (th > 60) for (let k = 0; k < 26; k++) {
        const u = r() * 2 - 1;
        billows.push({ x: (tx + 6 + u * 30) * FAR, y: base - (th + 2 - Math.abs(u) * 5 + r() * 3) * FAR, r: (2.5 + r() * 2.5) * FAR });
      }
    }
    // Higher billows first, so the lower ones' sunlit tops overlap the shadowed bellies above them.
    billows.sort((a, b) => a.y - b.y);
  }
  return (billowCache = billows);
}

/** Paints the storm bank; with `tower`, only that tower, lit from inside and fading out from its core. */
function paintBank(g: CanvasRenderingContext2D, [deep, body, rim]: string[], glow?: string, tower?: readonly [number, number]) {
  const off = tower ? (tower[0] - LIT_W / 2) * FAR : 0;
  // Each billow is a sphere lit by the moon from the upper right: a gradient across it, and a faint dark rim.
  const ux = 0.5 / 0.986, uy = -0.85 / 0.986;
  for (const b of stormBillows()) {
    if (tower && Math.abs(b.x / FAR - tower[0]) > LIT_W / 2 + b.r / FAR) continue;
    // The strip tiles sideways: a billow over an edge is drawn again on the other side.
    const wraps = tower ? [0] : b.x - b.r < 0 ? [0, W_FAR] : b.x + b.r >= W_FAR ? [0, -W_FAR] : [0];
    for (const w of wraps) {
      const x = b.x + w - off;
      const grad = g.createLinearGradient(x - ux * b.r, b.y - uy * b.r, x + ux * b.r, b.y + uy * b.r);
      grad.addColorStop(0, deep);
      grad.addColorStop(0.23, deep);
      grad.addColorStop(0.635, body);
      grad.addColorStop(0.905, rim);
      grad.addColorStop(1, rim);
      g.beginPath();
      g.arc(x, b.y, b.r, 0, Math.PI * 2);
      g.fillStyle = grad;
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(10, 14, 34, 0.35)';
      g.stroke();
    }
  }
  if (glow && tower) {
    // Lit from inside, brightest at the tower's core, and nothing beyond its glow.
    const cx = LIT_W / 2 * FAR, cy = H2 - (28 + tower[1] * 0.45) * FAR, r = 46 * FAR;
    g.save();
    g.translate(cx, cy);
    g.scale(1, 1 / 1.2);
    const tint = g.createRadialGradient(0, 0, 0, 0, 0, r);
    tint.addColorStop(0, glow);
    tint.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.7;
    g.fillStyle = tint;
    g.fillRect(-r, -r, r * 2, r * 2);
    const mask = g.createRadialGradient(0, 0, 0, 0, 0, r);
    mask.addColorStop(0, '#000');
    mask.addColorStop(0.55, '#000');
    mask.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.globalCompositeOperation = 'destination-in';
    g.globalAlpha = 1;
    g.fillStyle = mask;
    g.fillRect(-r * 2, -r * 2, r * 4, r * 4);
    g.restore();
    // destination-in only clears what it covers: clear the rest.
    g.globalCompositeOperation = 'destination-in';
    g.beginPath();
    g.ellipse(cx, cy, r, r * 1.2, 0, 0, Math.PI * 2);
    g.fillStyle = '#000';
    g.fill();
  }
  // The bank fades into the haze at its foot.
  const foot = g.createLinearGradient(0, H2 - 20 * FAR, 0, H2);
  foot.addColorStop(0, 'rgba(0, 0, 0, 0)');
  foot.addColorStop(1, '#000');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = foot;
  g.fillRect(0, H2 - 20 * FAR, g.canvas.width, 20 * FAR);
  g.globalCompositeOperation = 'source-over';
}

function bakeStorm(scene: Phaser.Scene) {
  bake(scene, 'storm-far', W_FAR, H2, (g) => paintBank(g, ['#0f1532', '#19234c', '#3f5089']));
}

/** One tower's lit copy for the sheet lightning. Baked one per frame after the scene starts, so loading stays quick. */
function bakeLit(scene: Phaser.Scene, i: number) {
  bake(scene, `storm-far-lit-${i}`, LIT_W * FAR, H2, (g) => paintBank(g, ['#28356a', '#44558f', '#a3b1e6'], '#cdd6ff', TOWERS[i]));
}

/** Far-off islets, in middle texels: [x, y, width] in design pixels. */
const ISLETS = [[70, 150, 26], [158, 140, 16], [306, 154, 32], [394, 138, 14]] as const;

function bakeMid(scene: Phaser.Scene) {
  const W = WIDTH * MID, H = HEIGHT * MID;
  bakePx(scene, 'islets-far', W, H, (p) => {
    const r = mulberry32(41);
    // Hazier and lighter than the near islands: far things fade into the air.
    const rock = rgb('#2a3765'), top = rgb('#3b5080'), edge = rgb('#55709a'), lamp = rgb('#f0cd86');
    for (const [ix, iy, iw] of ISLETS) {
      const x0 = (ix - iw / 2) * MID, x1 = (ix + iw / 2) * MID, y0 = iy * MID, mid = (x0 + x1) / 2, half = (x1 - x0) / 2;
      for (let x = Math.round(x0); x <= x1; x++) {
        const t = Math.abs(x - mid) / half;
        const depth = Math.round((1 - t * t) * iw * 0.55 * MID * 0.6 + r() * 3);
        for (let y = y0; y < y0 + depth; y++) p.put(x, y, y < y0 + 1 ? edge : y < y0 + 3 ? top : rock, 0.9);
        // Tiny trees and huts along the top.
        if (r() < 0.18) for (let k = 1; k <= 1 + Math.floor(r() * 3); k++) p.put(x, y0 - k, top, 0.85);
      }
      // A lit window or two.
      for (let k = 0; k < (iw > 20 ? 2 : 1); k++) p.put(mid + (r() - 0.5) * half, y0 - 1, lamp, 0.9);
    }
  });
  // Thin wisps that drift across the middle of the sky (a strip that tiles sideways).
  bakePx(scene, 'wisps', W, 70 * MID, (p) => {
    const r = mulberry32(53);
    const c = rgb('#33427a');
    for (let n = 0; n < 9; n++) {
      const cx = r() * W, cy = (8 + r() * 54) * MID, len = (30 + r() * 60) * MID, th = (1 + r() * 2.2) * MID;
      for (let x = -len; x <= len; x++) {
        const t = x / len, h = th * Math.sqrt(1 - t * t);
        for (let y = -h; y <= h; y++) {
          const a = 0.22 * (1 - Math.abs(y) / (h + 1)) * (1 - t * t);
          for (const wrap of [0, -W, W]) p.put(cx + x + wrap, cy + y + Math.sin((cx + x) / 37) * 2, c, a);
        }
      }
    }
  });
}

function bakeAll(scene: Phaser.Scene) {
  bakeFar(scene);
  bakeStorm(scene);
  bakeMid(scene);
  const clouds = (key: string, seed: number, color: string, base: number, amp: number) =>
    bake(scene, key, WIDTH, 40, (g) => {
      const r = mulberry32(seed);
      g.fillStyle = color;
      let x = 0;
      while (x < WIDTH + 30) {
        const rad = Math.round(6 + r() * amp), cy = base + r() * 4;
        disc(g, x, cy, rad);
        disc(g, x - WIDTH, cy, rad); // wraps, so the strip tiles seamlessly
        x += rad * 1.1;
      }
      g.fillRect(0, 0, WIDTH, base);
    });
  clouds('clouds-back', 3, '#1a2448', 6, 7);
  clouds('clouds-front', 11, '#232f5a', 2, 5);
  bake(scene, 'islands', WIDTH, HEIGHT, (g) => {
    const r = mulberry32(21);
    for (const [a, b] of ISLANDS) {
      const mid = (a + b) / 2, half = (b - a) / 2;
      for (let x = a; x <= b; x++) {
        const t = Math.abs(x - mid) / half;
        const depth = Math.round((1 - t * t) * (b - a > 60 ? 26 : 20) + r() * 3);
        for (let y = GROUND; y < GROUND + depth; y++) {
          const k = (y - GROUND) / Math.max(1, depth);
          g.fillStyle = y < GROUND + 2 ? '#5aa264' : y < GROUND + 3 ? '#3d7a4c' : k > 0.85 ? '#2a2a44' : (x + y) % 7 === 0 ? '#4a4567' : '#3b3856';
          g.fillRect(x, y, 1, 1);
        }
        if (r() < 0.25) {
          g.fillStyle = '#79c27c';
          g.fillRect(x, GROUND - 1, 1, 1);
        }
      }
    }
  });
  // The wizard's own little storm cloud, 24×9: a pale rim over a darker belly.
  bake(scene, 'wizcloud', 24, 9, (g) => {
    for (const [col, dy] of [['#8a9ad0', 0], ['#4d5d92', 1]] as const) {
      g.fillStyle = col;
      disc(g, 7, 5 + dy, 3);
      disc(g, 12, 4 + dy, 4);
      disc(g, 17, 5 + dy, 3);
      g.fillRect(3, 6 + dy, 18, 2);
    }
  });
}

interface Drop { x: number; y: number; s: number }

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
/** Sheet lightning's flicker: [time s, brightness] keyframes. */
const FLICKER = [[0, 0], [0.04, 0.65], [0.1, 0.12], [0.17, 0.5], [0.55, 0]] as const;
/** Seconds between distant flashes, by storm level (the wave band). */
const FLASH_GAP = [[8, 15], [5, 10], [3, 7]] as const;

/** The animated backdrop for a scene. Call `update(dt)` every frame. */
export class Backdrop {
  private back: Phaser.GameObjects.TileSprite;
  private front: Phaser.GameObjects.TileSprite;
  private wisps: Phaser.GameObjects.TileSprite;
  /** Each tower's lit copy, once baked (see `bakeLit`). */
  private lit: (Phaser.GameObjects.Image | undefined)[] = TOWERS.map(() => undefined);
  private readonly litDepth: number;
  private stars: Phaser.GameObjects.Graphics;
  private farRain: Phaser.GameObjects.Graphics;
  private rain: Phaser.GameObjects.Graphics;
  private drops: Drop[];
  private farDrops: Drop[];
  private time = 0;
  private flashIn: number;
  private flashT = -1;
  private flashing = 0;
  /** How stormy the far sky is: 0 calm (the title, waves 1–3), 1, 2. More often lightning. */
  storm = 0;

  constructor(private readonly scene: Phaser.Scene, depth = 0) {
    bakeAll(scene);
    const d = (k: number) => depth + k / 100;
    scene.add.image(0, 0, 'sky-far').setOrigin(0).setScale(1 / FAR).setDepth(d(0));
    this.stars = scene.add.graphics().setDepth(d(1));
    scene.add.image(0, BANK.top, 'storm-far').setOrigin(0).setScale(1 / FAR).setDepth(d(2));
    this.litDepth = d(3);
    this.farRain = scene.add.graphics().setDepth(d(4));
    scene.add.image(0, 0, 'islets-far').setOrigin(0).setScale(1 / MID).setDepth(d(5));
    this.wisps = scene.add.tileSprite(0, TOP + 30, WIDTH, 70, 'wisps').setOrigin(0).setTileScale(1 / MID).setDepth(d(6));
    this.back = scene.add.tileSprite(0, TOP - 2, WIDTH, 40, 'clouds-back').setOrigin(0).setDepth(d(10));
    this.front = scene.add.tileSprite(0, TOP - 6, WIDTH, 40, 'clouds-front').setOrigin(0).setDepth(d(20));
    this.rain = scene.add.graphics().setDepth(d(30));
    scene.add.image(0, 0, 'islands').setOrigin(0).setDepth(d(40));
    const [lo, hi] = BACKDROP.rain.speed;
    this.drops = Array.from({ length: BACKDROP.rain.drops }, () => ({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, s: lo + Math.random() * (hi - lo) }));
    // Far rain: finer, fainter and slower, so it reads as further away.
    this.farDrops = Array.from({ length: 110 }, () => ({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, s: (lo + Math.random() * (hi - lo)) * 0.45 }));
    this.flashIn = 2 + Math.random() * 4;
  }

  update(dt: number) {
    this.time += dt;
    // One lit tower per frame until all five are ready.
    const missing = this.lit.indexOf(undefined);
    if (missing >= 0 && !REDUCED) {
      bakeLit(this.scene, missing);
      this.lit[missing] = this.scene.add.image(TOWERS[missing][0] - LIT_W / 2, BANK.top, `storm-far-lit-${missing}`)
        .setOrigin(0).setScale(1 / FAR).setDepth(this.litDepth).setAlpha(0);
    }
    const [cb, cf] = BACKDROP.cloudSpeed;
    this.back.tilePositionX = Math.round(this.time * cb) % WIDTH;
    this.front.tilePositionX = Math.round(this.time * cf) % WIDTH;
    this.wisps.tilePositionX = (Math.round(this.time * 2.5 * MID) / MID) % WIDTH;

    // A few bright stars twinkle (held steady under reduced motion).
    const s = this.stars.clear();
    if (!REDUCED)
      for (const t of twinklers) {
        const a = 0.5 + 0.5 * Math.sin(this.time * t.f * 2 + t.ph);
        s.fillStyle(0xf4f6ff, a * 0.9).fillRect(t.x / FAR, t.y / FAR, 1 / FAR, 1 / FAR);
        if (a > 0.8) s.fillStyle(0xf4f6ff, (a - 0.8) * 2).fillRect((t.x - 1) / FAR, t.y / FAR, 3 / FAR, 1 / FAR).fillRect(t.x / FAR, (t.y - 1) / FAR, 1 / FAR, 3 / FAR);
      }

    // Sheet lightning inside one of the distant towers (never under reduced motion).
    if (!REDUCED) {
      this.flashIn -= dt;
      if (this.flashIn <= 0) {
        const [lo, hi] = FLASH_GAP[Math.max(0, Math.min(2, this.storm))];
        this.flashIn = lo + Math.random() * (hi - lo);
        this.flashT = 0;
        const ready = this.lit.flatMap((l, i) => (l ? [i] : []));
        this.flashing = ready[Math.floor(Math.random() * ready.length)] ?? -1;
      }
      if (this.flashT >= 0) {
        this.flashT += dt;
        let a = 0;
        for (let i = 1; i < FLICKER.length; i++) {
          const [t0, a0] = FLICKER[i - 1], [t1, a1] = FLICKER[i];
          if (this.flashT <= t1) {
            a = a0 + ((a1 - a0) * (this.flashT - t0)) / (t1 - t0);
            break;
          }
        }
        this.lit[this.flashing]?.setAlpha(a);
        if (this.flashT > FLICKER[FLICKER.length - 1][0]) this.flashT = -1;
      }
    }

    const fr = this.farRain.clear().fillStyle(0x8fa4dc, 0.2);
    for (const d of this.farDrops) {
      this.fall(d, dt);
      fr.fillRect(Math.round(d.x * FAR) / FAR, Math.round(d.y * FAR) / FAR, 1 / FAR, 6 / FAR);
    }
    const g = this.rain.clear().fillStyle(0x96afe6, 0.28);
    for (const d of this.drops) {
      this.fall(d, dt);
      g.fillRect(Math.round(d.x), Math.round(d.y), 1, 3);
    }
  }

  private fall(d: Drop, dt: number) {
    d.y += d.s * dt;
    d.x -= d.s * BACKDROP.rain.slant * dt;
    if (d.y > HEIGHT) {
      d.y = TOP;
      d.x = Math.random() * (WIDTH + 40);
    }
  }
}
