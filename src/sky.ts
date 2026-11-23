import Phaser from 'phaser';
import { BACKDROP, GROUND, HEIGHT, ISLANDS, TOP, WIDTH } from './config';

// The backdrop, drawn in code as pixel art in three depths. The further away a layer is, the finer its pixels:
// - far (¼ design pixel, the canvas's own pixels): the sky's gradient, a dense starfield with a few twinkling, a dim
//   crescent moon and fine rain;
// - middle (½ design pixel): thin drifting wisps;
// - near (1 design pixel): the cloud deck, the rain and the three islands the game is played on, drawn like the
//   sprites, with more detail: grass, soil, layered rock lit by the moon, and roots and vines hanging below.
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

function bakeMid(scene: Phaser.Scene) {
  const W = WIDTH * MID;
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

/** The island palette: the sprites' kind of colours, a few shades each. */
const ISLE = {
  tuft: rgb('#8fd18a'), grass: rgb('#6cb86e'), grassMid: rgb('#4f9a5c'), grassDark: rgb('#3a7a4c'),
  soil: rgb('#5c4838'), soilDark: rgb('#45352b'), pebble: rgb('#7a6a5c'),
  // Rock, lightest (moonlit, upper right) to deepest (the underside).
  rock: ['#5b567e', '#48446a', '#3a3758', '#2d2a46', '#221f37'].map(rgb),
  outline: rgb('#16142a'), root: rgb('#4a362c'), rootDark: rgb('#33251f'), leaf: rgb('#5aa264'),
  flower: [rgb('#f3e9a8'), rgb('#eef2ff'), rgb('#f2b8c6')],
};

/**
 * The three islands the game stands on, at 1 px per design pixel like the sprites: a grass top with tufts and the
 * odd flower, a band of soil with pebbles, then layered rock lit by the moon from the upper right and shaded into the
 * underside (a 2×2 dither between shades, as 16-bit art did), outlined, with roots and vines hanging below.
 */
function bakeIslands(scene: Phaser.Scene) {
  bakePx(scene, 'islands', WIDTH, HEIGHT, (p) => {
    const r = mulberry32(21);
    for (const [a, b] of ISLANDS) {
      const mid = (a + b) / 2, half = (b - a) / 2, big = b - a > 60;
      const maxD = big ? 27 : 19;
      // The underside: a rounded point with a rough, rocky edge and a few hanging spurs.
      const depth: number[] = [];
      const ph1 = r() * 6, ph2 = r() * 6;
      const spurs = Array.from({ length: big ? 4 : 1 }, () => ({ x: a + 10 + r() * (b - a - 20), w: 2 + r() * 3, h: 3 + r() * 5 }));
      for (let x = a; x <= b; x++) {
        const t = Math.abs(x - mid) / half;
        let d = Math.max(4, (1 - t ** 1.8) ** 0.9 * maxD);
        d += Math.sin(x * 0.31 + ph1) * 1.4 + Math.sin(x * 0.11 + ph2) * 1.8;
        for (const sp of spurs) d += Math.max(0, sp.h * (1 - Math.abs(x - sp.x) / sp.w));
        depth.push(Math.max(3, Math.round(d)));
      }
      const dAt = (x: number) => (x < a || x > b ? 0 : depth[x - a]);
      // A wobbly line every few rows: the rock's layers.
      const strata = (x: number, y: number) => (y - GROUND + Math.round(Math.sin(x * 0.13 + ph1) * 1.5 + Math.sin(x * 0.37) * 0.6)) % 6 === 5;

      for (let x = a; x <= b; x++) {
        const d = dAt(x), side = (x - mid) / half;
        // The turf hangs over the soil in a ragged edge.
        const grassDrip = 3 + (r() < 0.45 ? 1 : 0) + (r() < 0.15 ? 1 : 0);
        const soilEnd = grassDrip + 4;
        for (let k = 0; k < d; k++) {
          const y = GROUND + k;
          let c: RGB;
          if (k === 0) c = r() < 0.15 ? ISLE.tuft : ISLE.grass;
          else if (k === 1) c = ISLE.grass;
          else if (k === 2) c = ISLE.grassMid;
          else if (k < grassDrip) c = ISLE.grassDark;
          else if (k < soilEnd) c = r() < 0.04 ? ISLE.pebble : k === soilEnd - 1 || (x * 7 + k * 3) % 11 === 0 ? ISLE.soilDark : ISLE.soil;
          else {
            // Light falls from the upper right and fades towards the underside; layers catch it on their top edge.
            let v = 1.4 - side * 0.9 + ((k - soilEnd) / Math.max(1, d - soilEnd)) * 2.6;
            if (strata(x, y)) v += 1;
            else if (strata(x, y + 1)) v -= 0.6;
            if (r() < 0.04) v += 0.8;
            const lo = Math.max(0, Math.min(ISLE.rock.length - 1, Math.floor(v)));
            const hi = Math.min(ISLE.rock.length - 1, lo + 1);
            // A 2×2 checker between neighbouring shades.
            c = v - lo > 0.5 && (x + y) % 2 === 0 ? ISLE.rock[hi] : ISLE.rock[lo];
          }
          // The outline: the underside, and the sides where the next column is shorter.
          if (k >= 2 && (k === d - 1 || k >= dAt(x - 1) || k >= dAt(x + 1))) c = ISLE.outline;
          p.put(x, y, c);
        }
        // Grass curls over the edges at either end.
        if (x === a || x === b) p.put(x, GROUND - 1, ISLE.grassMid);
        // Tufts, taller tufts and the odd flower along the top.
        const roll = r();
        if (roll < 0.3) p.put(x, GROUND - 1, ISLE.grass);
        else if (roll < 0.38) {
          p.put(x, GROUND - 1, ISLE.grass);
          p.put(x, GROUND - 2, ISLE.tuft);
        } else if (roll < 0.41) {
          p.put(x, GROUND - 1, ISLE.grassMid);
          p.put(x, GROUND - 2, ISLE.flower[Math.floor(r() * ISLE.flower.length)]);
        }
      }
      // Roots and vines hanging from the underside, drifting a little as they go.
      for (let n = 0; n < (big ? 9 : 3); n++) {
        let x = Math.round(a + 6 + r() * (b - a - 12));
        const vine = r() < 0.45, len = 3 + Math.floor(r() * (vine ? 9 : 6));
        let y = GROUND + dAt(x) - 1;
        for (let k = 0; k < len; k++) {
          y++;
          if (r() < 0.3) x += r() < 0.5 ? -1 : 1;
          if (y >= HEIGHT) break;
          p.put(x, y, vine ? ISLE.grassDark : k % 3 === 2 ? ISLE.rootDark : ISLE.root);
          if (vine && k % 3 === 1) p.put(x + (k % 2 ? 1 : -1), y, ISLE.leaf);
        }
      }
    }
  });
}

function bakeAll(scene: Phaser.Scene) {
  bakeFar(scene);
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
  bakeIslands(scene);
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

/** The animated backdrop for a scene. Call `update(dt)` every frame. */
export class Backdrop {
  private back: Phaser.GameObjects.TileSprite;
  private front: Phaser.GameObjects.TileSprite;
  private wisps: Phaser.GameObjects.TileSprite;
  private stars: Phaser.GameObjects.Graphics;
  private farRain: Phaser.GameObjects.Graphics;
  private rain: Phaser.GameObjects.Graphics;
  private drops: Drop[];
  private farDrops: Drop[];
  private time = 0;

  constructor(scene: Phaser.Scene, depth = 0) {
    bakeAll(scene);
    const d = (k: number) => depth + k / 100;
    scene.add.image(0, 0, 'sky-far').setOrigin(0).setScale(1 / FAR).setDepth(d(0));
    this.stars = scene.add.graphics().setDepth(d(1));
    this.farRain = scene.add.graphics().setDepth(d(4));
    this.wisps = scene.add.tileSprite(0, TOP + 30, WIDTH, 70, 'wisps').setOrigin(0).setTileScale(1 / MID).setDepth(d(6));
    this.back = scene.add.tileSprite(0, TOP - 2, WIDTH, 40, 'clouds-back').setOrigin(0).setDepth(d(10));
    this.front = scene.add.tileSprite(0, TOP - 6, WIDTH, 40, 'clouds-front').setOrigin(0).setDepth(d(20));
    this.rain = scene.add.graphics().setDepth(d(30));
    scene.add.image(0, 0, 'islands').setOrigin(0).setDepth(d(40));
    const [lo, hi] = BACKDROP.rain.speed;
    this.drops = Array.from({ length: BACKDROP.rain.drops }, () => ({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, s: lo + Math.random() * (hi - lo) }));
    // Far rain: finer, fainter and slower, so it reads as further away.
    this.farDrops = Array.from({ length: 110 }, () => ({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, s: (lo + Math.random() * (hi - lo)) * 0.45 }));
  }

  update(dt: number) {
    this.time += dt;
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
