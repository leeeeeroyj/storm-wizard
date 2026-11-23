import Phaser from 'phaser';
import { BACKDROP, GROUND, HEIGHT, ISLANDS, TOP, WIDTH } from './config';

// The backdrop, drawn in code as pixel art: a dithered night sky, a two-layer cloud deck that drifts, rain, and the
// three floating islands. Textures are baked once per game at 1 px per design pixel and shared by every scene.

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

function bakeAll(scene: Phaser.Scene) {
  bake(scene, 'sky', WIDTH, HEIGHT, (g) => {
    const bands = BACKDROP.bands;
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const t = (y / HEIGHT) * (bands.length - 1), i = Math.floor(t), f = t - i;
        g.fillStyle = bands[Math.min(bands.length - 1, i + (f * 16 > BAYER[(y % 4) * 4 + (x % 4)] ? 1 : 0))];
        g.fillRect(x, y, 1, 1);
      }
    }
    const r = mulberry32(7);
    for (let i = 0; i < BACKDROP.stars; i++) {
      g.fillStyle = r() < 0.2 ? '#cfd8ff' : '#6a77a8';
      g.fillRect(Math.floor(r() * WIDTH), 30 + Math.floor(r() * 120), 1, 1);
    }
  });
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

/** The animated backdrop for a scene. Call `update(dt)` every frame. */
export class Backdrop {
  private back: Phaser.GameObjects.TileSprite;
  private front: Phaser.GameObjects.TileSprite;
  private rain: Phaser.GameObjects.Graphics;
  private drops: Drop[];
  private time = 0;

  constructor(scene: Phaser.Scene, depth = 0) {
    bakeAll(scene);
    scene.add.image(0, 0, 'sky').setOrigin(0).setDepth(depth);
    this.back = scene.add.tileSprite(0, TOP - 2, WIDTH, 40, 'clouds-back').setOrigin(0).setDepth(depth + 0.1);
    this.front = scene.add.tileSprite(0, TOP - 6, WIDTH, 40, 'clouds-front').setOrigin(0).setDepth(depth + 0.2);
    this.rain = scene.add.graphics().setDepth(depth + 0.3);
    scene.add.image(0, 0, 'islands').setOrigin(0).setDepth(depth + 0.4);
    const [lo, hi] = BACKDROP.rain.speed;
    this.drops = Array.from({ length: BACKDROP.rain.drops }, () => ({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, s: lo + Math.random() * (hi - lo) }));
  }

  update(dt: number) {
    this.time += dt;
    const [cb, cf] = BACKDROP.cloudSpeed;
    this.back.tilePositionX = Math.round(this.time * cb) % WIDTH;
    this.front.tilePositionX = Math.round(this.time * cf) % WIDTH;
    const g = this.rain.clear().fillStyle(0x96afe6, 0.28);
    for (const d of this.drops) {
      d.y += d.s * dt;
      d.x -= d.s * BACKDROP.rain.slant * dt;
      if (d.y > HEIGHT) {
        d.y = TOP;
        d.x = Math.random() * (WIDTH + 40);
      }
      g.fillRect(Math.round(d.x), Math.round(d.y), 1, 3);
    }
  }
}
