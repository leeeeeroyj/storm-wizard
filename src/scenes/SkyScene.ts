import Phaser from 'phaser';
import { staleClear, typeDigit } from '../answer';
import { COLORS, COTTAGES_X, GROUND, multFor, PACE, PLAY, POINTS, RENDER_SCALE, TEXT, TOP, TOWERS_X, WAND, WIDTH, WIZARD } from '../config';
import { Controls, type Device } from '../controls';
import { DEFAULT_SETTINGS, Picker, poolFor, type Box, type Fact, type Settings } from '../facts';
import { loadHi } from '../hi';
import { placeIslands, type Islands } from '../islands';
import { Music } from '../music';
import { Sfx } from '../sfx';
import { Backdrop, mulberry32 } from '../sky';
import { restoreMute, Synth, toggleMute } from '../synth';
import { label } from '../text';
import { fitCamera } from '../view';

/** What the HUD draws, shared through the registry under `hud`. */
export interface HudState {
  score: number;
  hi: number;
  mult: number;
  wave: number;
  buffer: string;
  /** The digits that misfired, shown struck through while `misfireT` runs. */
  misfire: string;
  misfireT: number;
  attract: boolean;
  muted: boolean;
  device: Device;
  /** The controller arc's digit. */
  arc: number;
  over: boolean;
}

export interface Target {
  kind: 'cottage' | 'tower';
  i: number;
  x: number;
}

export interface Foe {
  kind: 'hail';
  fact: Fact;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  x: number;
  y: number;
  /** Progress along the fall, 0..1. */
  p: number;
  /** Seconds for the whole fall. */
  dur: number;
  target: Target;
  img: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
  dead: boolean;
  /** Answered: it holds still while the wand twinkles, then the bolt arrives. */
  doomed: boolean;
}

interface Bolt { x0: number; y0: number; x1: number; y1: number; life: number; seed: number }
interface Blast { x: number; y: number; r: number; max: number; life: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: number; gravity: number }
interface Ring { x: number; y: number; r: number; dr: number; life: number }
interface Puff { x: number; y: number; r: number; life: number }
interface Popup { text: Phaser.GameObjects.Text; life: number; max: number; rise: number; y0: number }
/** The wizard's gesture: a twinkle at the wand tip when right, a shake and a puff of smoke when wrong. */
export interface Cast { kind: 'twinkle' | 'fizzle'; t: number }

const TAU = Math.PI * 2;
const lerp = Phaser.Math.Linear;
const clamp = Phaser.Math.Clamp;
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
/** Where a tower's bolt leaves from: its top. */
const TOWER_TOP = GROUND - 17;
const TWINKLE_END = PLAY.twinkle + 0.2;
const FIZZLE_END = 0.5;

/** The game: one fixed screen of sky over the islands. */
export class SkyScene extends Phaser.Scene {
  backdrop!: Backdrop;
  islands!: Islands;
  attract = false;
  /** Seconds of play, on the scene's own clock. */
  playTime = 0;
  hud!: HudState;
  settings: Settings = DEFAULT_SETTINGS;
  picker!: Picker;
  controls!: Controls;
  foes: Foe[] = [];
  /** Answers waiting for the wand's twinkle to finish. */
  strikes: { foes: Foe[]; t: number }[] = [];
  bolts: Bolt[] = [];
  /** The last bolt fired, for tests: which tower, at which stone. */
  lastBolt: { tower: number; x: number; y: number } | undefined;
  blasts: Blast[] = [];
  cast: Cast | undefined;
  streak = 0;
  /** Hits taken per cottage: 1 loses the roof, 2 leaves rubble. */
  cottages: number[] = [];
  /** Seconds each tower is still stunned. */
  stun: number[] = [];
  lockout = 0;
  /** The spawner runs (tests switch it off to set up a sky by hand). */
  spawning = true;
  state: 'play' | 'over' = 'play';
  private overT = 0;
  private nextSpawn = 0;
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  private puffs: Puff[] = [];
  private popups: Popup[] = [];
  private towerFlash: number[] = [];
  private rand: () => number = Math.random;
  private fx!: Phaser.GameObjects.Graphics;
  private plates!: Phaser.GameObjects.Graphics;
  private top!: Phaser.GameObjects.Graphics;
  private synth!: Synth;
  private sfx!: Sfx;
  private music!: Music;

  constructor() {
    super('sky');
  }

  create(data: { attract?: number } = {}) {
    this.attract = data.attract !== undefined;
    this.rand = this.attract ? mulberry32(data.attract!) : Math.random;
    this.playTime = 0;
    this.foes = [];
    this.strikes = [];
    this.bolts = [];
    this.blasts = [];
    this.sparks = [];
    this.rings = [];
    this.puffs = [];
    this.popups = [];
    this.cast = undefined;
    this.lastBolt = undefined;
    this.streak = 0;
    this.lockout = 0;
    this.spawning = !this.attract;
    this.state = 'play';
    this.nextSpawn = 1.5;
    this.cottages = COTTAGES_X.map(() => 0);
    this.stun = TOWERS_X.map(() => 0);
    this.towerFlash = TOWERS_X.map(() => 0);
    this.picker = new Picker(poolFor(this.settings), new Map<string, Box>(), this.rand);

    fitCamera(this, RENDER_SCALE);
    this.backdrop = new Backdrop(this);
    this.islands = placeIslands(this);
    this.fx = this.add.graphics().setDepth(2);
    this.plates = this.add.graphics().setDepth(5);
    this.top = this.add.graphics().setDepth(6);

    restoreMute(this);
    this.synth = new Synth(this);
    this.sfx = new Sfx(this.synth);
    this.music = new Music(this.synth);
    if (!this.attract) {
      this.controls = new Controls(this);
      this.music.start();
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.music.stop());

    this.hud = {
      score: 0, hi: loadHi(), mult: 1, wave: 1, buffer: '', misfire: '', misfireT: 0,
      attract: this.attract, muted: this.sound.mute, device: this.controls?.device ?? 'kbm', arc: 4, over: false,
    };
    this.registry.set('hud', this.hud);
    this.scene.launch('hud');
    this.cameras.main.fadeIn(this.attract ? 0 : 250);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    this.playTime += dt;
    this.backdrop.update(dt);
    if (this.controls) this.handleInput(this.controls.read(dt));

    this.lockout = Math.max(0, this.lockout - dt);
    this.hud.misfireT = Math.max(0, this.hud.misfireT - dt);
    for (let i = 0; i < this.stun.length; i++) {
      this.stun[i] = Math.max(0, this.stun[i] - dt);
      this.towerFlash[i] = Math.max(0, this.towerFlash[i] - dt);
    }
    if (this.state === 'over') {
      this.overT += dt;
      if (this.overT > 5) this.leave();
    } else this.spawnTick(dt);

    this.moveFoes(dt);
    this.runStrikes(dt);
    this.runBlasts(dt);
    this.tickEffects(dt);
    this.drawWorld();
    this.hud.mult = multFor(this.streak);
  }

  // ---- Input ----

  private handleInput(input: ReturnType<Controls['read']>) {
    this.hud.device = input.device;
    this.hud.arc = this.controls.arc;
    if (input.mute) {
      toggleMute(this);
      this.hud.muted = this.sound.mute;
    }
    if (this.state !== 'play') return;
    for (let i = 0; i < input.undo; i++) {
      if (!this.hud.buffer) continue;
      this.hud.buffer = this.hud.buffer.slice(0, -1);
      this.sfx.undo();
    }
    for (const d of input.digits) this.type(d);
  }

  /** One digit into the answer box: it may strike, wait for more, or misfire. */
  type(d: string) {
    if (this.state !== 'play' || this.lockout > 0) return;
    this.sfx.digit(Number(d));
    const { buffer, typed } = typeDigit(this.hud.buffer, d, this.liveAnswers());
    this.hud.buffer = buffer;
    if (typed.kind === 'match') this.answer(typed.answer);
    else if (typed.kind === 'misfire') this.misfire(typed.typed);
  }

  private live() {
    return this.foes.filter((f) => !f.dead && !f.doomed);
  }

  liveAnswers() {
    return this.live().map((f) => f.fact.str);
  }

  /** Right: every stone with this answer holds still, the wand twinkles, then the towers fire. */
  private answer(answer: string) {
    const hit = this.live().filter((f) => f.fact.str === answer);
    for (const f of hit) {
      f.doomed = true;
      this.picker.credit(f.fact, (f.y - TOP) / (GROUND - TOP) < PLAY.quick);
    }
    this.streak++;
    this.cast = { kind: 'twinkle', t: 0 };
    this.strikes.push({ foes: hit, t: PLAY.twinkle });
    if (hit.length > 1) this.sfx.double();
    else this.sfx.correct(this.streak);
  }

  /** Wrong: the box clears, the streak resets, the digits lock briefly, and the wand fizzles. */
  private misfire(typed: string) {
    this.hud.misfire = typed;
    this.hud.misfireT = 0.5;
    this.lockout = PLAY.lockout;
    this.streak = 0;
    this.cast = { kind: 'fizzle', t: 0 };
    this.sfx.misfire();
    const tip = this.wandTip();
    for (let i = 0; i < 4; i++) this.puffs.push({ x: tip.x + (i - 1.5) * 3, y: tip.y - 1 - (i % 2) * 2, r: 1.6 + (i % 2) * 0.6, life: 0.6 + i * 0.08 });
    for (let i = 0; i < 5; i++) this.sparks.push({ x: tip.x, y: tip.y, vx: (this.rand() - 0.3) * 30, vy: -10 - this.rand() * 15, life: 0.35, color: COLORS.dim, gravity: 120 });
  }

  wandTip() {
    return { x: WIZARD.x + WAND.x, y: WIZARD.y + WAND.y };
  }

  // ---- The storm ----

  private standingTargets(): Target[] {
    const list: Target[] = [];
    // Cottages twice, so most stones fall on homes.
    this.cottages.forEach((hits, i) => {
      if (hits < PLAY.cottageHits) list.push({ kind: 'cottage', i, x: COTTAGES_X[i] }, { kind: 'cottage', i, x: COTTAGES_X[i] });
    });
    TOWERS_X.forEach((x, i) => list.push({ kind: 'tower', i, x }));
    return list;
  }

  private spawnTick(dt: number) {
    if (!this.spawning) return;
    // Milestone 2 plays wave 1's numbers without end; waves come with milestone 4.
    const pace = PACE[this.settings.pace];
    const cap = Math.min(pace.cap, 2);
    const gap = 3.0 * pace.gap;
    this.nextSpawn -= dt;
    if (this.nextSpawn > 0 || this.live().length >= cap) return;
    this.nextSpawn = this.spawnHail() ? gap * (0.7 + this.rand() * 0.6) : 0.3;
  }

  /** A hailstone with a problem. Tests pass a fact, a start point and a target. */
  spawnHail(opts: { fact?: Fact; x?: number; y?: number; target?: Target } = {}): Foe | null {
    const lives = this.live();
    const fact = opts.fact ?? this.picker.pick(lives.map((f) => f.fact.str), new Set(lives.map((f) => f.fact.key)));
    if (!fact) return null;
    const targets = this.standingTargets();
    const target = opts.target ?? targets[Math.floor(this.rand() * targets.length)];
    const sx = opts.x ?? clamp(target.x + (this.rand() - 0.5) * 260, 12, WIDTH - 12);
    const sy = opts.y ?? PLAY.spawnY;
    const ty = GROUND - 4;
    const fall = PACE[this.settings.pace].fall;
    const f: Foe = {
      kind: 'hail', fact, sx, sy, tx: target.x, ty, x: sx, y: sy, p: 0,
      dur: fall * ((ty - sy) / (GROUND - TOP)), target, dead: false, doomed: false,
      img: this.add.image(sx, sy, 'hailstone').setDepth(4),
      text: label(this, sx, sy, fact.label, 7, TEXT.plateInk, { align: 'center' }).setDepth(5.1),
    };
    this.foes.push(f);
    return f;
  }

  private moveFoes(dt: number) {
    for (const f of this.foes) {
      if (f.dead || f.doomed) continue;
      f.p += dt / f.dur;
      const p = Math.min(1, f.p);
      f.x = lerp(f.sx, f.tx, p);
      f.y = lerp(f.sy, f.ty, p);
      if (f.p >= 1) this.land(f);
    }
    this.foes = this.foes.filter((f) => !f.dead);
  }

  /** The twinkle has finished: each struck stone takes a bolt from the nearest tower that isn't stunned. */
  private runStrikes(dt: number) {
    for (const s of this.strikes) {
      s.t -= dt;
      if (s.t > 0) continue;
      const mult = multFor(this.streak);
      for (const f of s.foes) {
        if (f.dead) continue;
        const tower = this.nearestTower(f.x);
        this.bolts.push({ x0: TOWERS_X[tower], y0: TOWER_TOP, x1: f.x, y1: f.y, life: 0.2, seed: this.rand() * 1e9 });
        this.towerFlash[tower] = 0.12;
        this.lastBolt = { tower, x: f.x, y: f.y };
        this.score(POINTS[f.kind] * mult, f.x, f.y - 10);
        this.kill(f);
      }
    }
    this.strikes = this.strikes.filter((s) => s.t > 0);
  }

  private nearestTower(x: number) {
    let best = -1;
    TOWERS_X.forEach((tx, i) => {
      if (this.stun[i] <= 0 && (best < 0 || Math.abs(tx - x) < Math.abs(TOWERS_X[best] - x))) best = i;
    });
    // Every tower stunned: the centre one fires anyway, so an answer is never wasted.
    return best < 0 ? 1 : best;
  }

  private kill(f: Foe) {
    f.dead = true;
    f.img.destroy();
    f.text.destroy();
    const b = PLAY.blast;
    this.blasts.push({ x: f.x, y: f.y, r: 2, max: b.r, life: b.life });
    this.burst(f.x, f.y, COLORS.ice, 14);
    this.rings.push({ x: f.x, y: f.y, r: 3, dr: 70, life: 0.35 });
    this.sfx.blast();
    this.hud.buffer = staleClear(this.hud.buffer, this.liveAnswers());
  }

  /** Blasts grow, and catch any hailstone that drifts in: a chain, worth less, and not counted for drilling. */
  private runBlasts(dt: number) {
    for (const b of this.blasts) {
      b.life -= dt;
      b.r = Math.min(b.max, b.r + dt * PLAY.blast.grow);
      if (b.life <= 0) continue;
      for (const f of this.foes) {
        if (f.dead || f.doomed) continue;
        if (Math.hypot(f.x - b.x, f.y - b.y) < b.r + 3) {
          const pts = POINTS.chain * multFor(this.streak);
          this.score(pts, f.x, f.y - 10, `CHAIN ${pts}`);
          this.kill(f);
        }
      }
    }
    this.blasts = this.blasts.filter((b) => b.life > 0);
  }

  /** A stone got through: damage, the streak resets, and the full fact shows big over the impact. */
  private land(f: Foe) {
    f.dead = true;
    f.img.destroy();
    f.text.destroy();
    this.burst(f.x, GROUND - 2, COLORS.ice, 18);
    if (!REDUCED) this.cameras.main.shake(140, 0.006);
    const t = f.target;
    if (t.kind === 'cottage') {
      const hits = Math.min(PLAY.cottageHits, this.cottages[t.i] + 1);
      const lost = hits === PLAY.cottageHits && this.cottages[t.i] < hits;
      this.cottages[t.i] = hits;
      this.drawCottage(t.i);
      this.sfx.land(lost);
    } else {
      this.stun[t.i] = PLAY.stun;
      this.sfx.land();
    }
    this.streak = 0;
    this.picker.miss(f.fact);
    this.popup(`${f.fact.label} = ${f.fact.ans}`, clamp(f.x, 50, WIDTH - 50), GROUND - 46, { size: 13, color: TEXT.ink, life: PLAY.factLife, depth: 3 });
    this.hud.buffer = staleClear(this.hud.buffer, this.liveAnswers());
    if (this.cottages.every((h) => h >= PLAY.cottageHits)) this.gameOver();
  }

  private drawCottage(i: number) {
    const img = this.islands.cottages[i];
    const hits = this.cottages[i];
    if (hits === 0) img.setTexture('cottage').setCrop().setY(GROUND - 8);
    // One hit: the roof is gone (the sprite's top rows cropped), and it smokes.
    else if (hits === 1) img.setTexture('cottage').setCrop(0, 6, 16, 10).setY(GROUND - 8);
    else img.setTexture('rubble').setCrop().setY(GROUND - 6);
  }

  private gameOver() {
    this.state = 'over';
    this.overT = 0;
    this.hud.over = true;
    this.hud.buffer = '';
    this.music.held = true;
    this.sfx.over();
    const cx = WIDTH / 2;
    this.add.rectangle(cx, 94, 260, 84, COLORS.bar, 0.82).setStrokeStyle(1, COLORS.line).setDepth(8);
    label(this, cx, 58, 'The storm wins this time', 18, TEXT.bolt, { face: 'title', align: 'center' }).setDepth(8.1);
    label(this, cx, 84, 'Facts to practise', 7, TEXT.dim, { align: 'center' }).setDepth(8.1);
    this.picker.missedRecent.forEach((f, i) => label(this, cx, 96 + i * 12, `${f.label} = ${f.ans}`, 9, TEXT.ice, { align: 'center' }).setDepth(8.1));
  }

  private leave() {
    if (this.overT < 0) return;
    this.overT = -1e9;
    this.cameras.main.fadeOut(400);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('hud');
      this.scene.start('title');
    });
  }

  // ---- Effects ----

  private score(n: number, x: number, y: number, text = String(n)) {
    this.hud.score += n;
    this.hud.hi = Math.max(this.hud.hi, this.hud.score);
    this.popup(text, x, Math.max(TOP + 12, y), { size: 6, color: TEXT.ink, life: 0.8, rise: 6, depth: 7 });
  }

  private popup(str: string, x: number, y: number, o: { size: number; color: string; life: number; rise?: number; depth: number }) {
    const text = label(this, x, y, str, o.size, o.color, { align: 'center' }).setDepth(o.depth).setStroke(TEXT.plateInk, o.size > 8 ? 4 : 2);
    this.popups.push({ text, life: o.life, max: o.life, rise: o.rise ?? 0, y0: y });
  }

  private burst(x: number, y: number, color: number, n: number) {
    const k = REDUCED ? Math.ceil(n / 3) : n;
    for (let i = 0; i < k; i++) {
      const a = this.rand() * TAU, s = 20 + this.rand() * 60;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: 0.3 + this.rand() * 0.4, color, gravity: 90 });
    }
  }

  private tickEffects(dt: number) {
    if (this.cast) {
      this.cast.t += dt;
      if (this.cast.t > (this.cast.kind === 'twinkle' ? TWINKLE_END : FIZZLE_END)) this.cast = undefined;
    }
    for (const s of this.sparks) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += s.gravity * dt;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    this.rings = this.rings.filter((r) => ((r.life -= dt), (r.r += r.dr * dt), r.life > 0));
    for (const p of this.puffs) {
      p.life -= dt;
      p.y -= 12 * dt;
      p.r += 6 * dt;
    }
    this.puffs = this.puffs.filter((p) => p.life > 0);
    this.bolts = this.bolts.filter((b) => (b.life -= dt) > 0);
    for (const p of this.popups) {
      p.life -= dt;
      p.text.setAlpha(clamp((p.life / p.max) * 3, 0, 1)).setY(p.y0 - (1 - p.life / p.max) * p.rise);
      if (p.life <= 0) p.text.destroy();
    }
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  // ---- Drawing ----

  private drawWorld() {
    const g = this.fx.clear();
    const clock = this.playTime;

    // Landing chevrons under every stone past halfway, blinking in the last 20% (steady with reduced motion).
    g.fillStyle(COLORS.ink, 1);
    for (const f of this.foes) {
      if (f.dead || f.doomed || f.p < 0.5) continue;
      if (!REDUCED && f.p > 0.8 && Math.floor(clock * 8) % 2) continue;
      const x = Math.round(f.target.x);
      g.fillRect(x - 3, GROUND + 4, 1, 1).fillRect(x - 2, GROUND + 5, 1, 1).fillRect(x - 1, GROUND + 6, 3, 1);
      g.fillRect(x + 2, GROUND + 5, 1, 1).fillRect(x + 3, GROUND + 4, 1, 1);
    }
    // Smoke from roofless cottages; a "z" over stunned towers (shape, not colour).
    g.fillStyle(0xa0aac8, 0.5);
    this.cottages.forEach((hits, i) => {
      if (hits !== 1) return;
      const x = COTTAGES_X[i];
      for (let k = 0; k < 3; k++) g.fillRect(x - 2 + Math.round(Math.sin(clock * 2 + k) * 2), GROUND - 14 - k * 4 - Math.round((clock * 6) % 4), 3, 2);
    });
    this.islands.towers.forEach((img, i) => {
      img.setAlpha(this.stun[i] > 0 ? 0.55 : 1);
      if (this.stun[i] <= 0) return;
      const x = TOWERS_X[i] + 6, y = GROUND - 24 - Math.round((clock * 4) % 3);
      g.fillStyle(COLORS.ink, 1).fillRect(x, y, 4, 1).fillRect(x + 2, y + 1, 1, 1).fillRect(x + 1, y + 2, 1, 1).fillRect(x, y + 3, 4, 1);
    });
    for (const s of this.sparks) g.fillStyle(s.color, clamp(s.life * 2, 0, 1)).fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    for (const b of this.blasts) {
      const a = clamp(b.life / PLAY.blast.life, 0, 1);
      g.fillStyle(COLORS.bolt, a * 0.22).fillCircle(b.x, b.y, b.r);
      g.lineStyle(1.2, COLORS.bolt, a * 0.9).strokeCircle(b.x, b.y, b.r);
    }
    for (const r of this.rings) g.lineStyle(0.8, COLORS.ink, clamp(r.life * 3, 0, 1)).strokeCircle(r.x, r.y, r.r);
    for (const p of this.puffs) {
      const a = clamp(p.life * 2, 0, 0.8);
      g.fillStyle(0x6b7499, a).fillCircle(p.x, p.y, p.r + 0.6);
      g.fillStyle(0xb4bbd6, a).fillCircle(p.x - 0.4, p.y - 0.4, p.r);
    }

    // Stones: a faint trail back the way they came, then the sprite.
    for (const f of this.foes) {
      if (f.dead) continue;
      g.lineStyle(1, COLORS.ice, 0.25).lineBetween(f.x, f.y, lerp(f.x, f.sx, 0.18), lerp(f.y, f.sy, 0.18));
      f.img.setPosition(Math.round(f.x), Math.round(f.y));
    }
    this.drawPlates();
    this.drawWizard();

    const t = this.top.clear();
    for (const b of this.bolts) this.lightning(t, b);
    this.towerFlash.forEach((life, i) => {
      if (life > 0) this.star(t, TOWERS_X[i], TOWER_TOP, 2 + life * 20, COLORS.bolt);
    });
  }

  /** White plates with dark ink. The box's digits underline every plate they could still match. */
  private drawPlates() {
    const g = this.plates.clear();
    const buffer = this.hud.buffer;
    for (const f of this.foes) {
      if (f.dead) continue;
      const w = Math.ceil(f.text.width) + 7, h = 10;
      const x = Math.round(clamp(f.x - w / 2, 2, WIDTH - w - 2)), y = Math.round(Math.max(TOP + 3, f.y - 20));
      g.fillStyle(COLORS.plateInk, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
      // Urgent: a thicker outline past 60% of the fall.
      if (f.p > 0.6) g.fillRect(x - 2, y - 2, w + 4, h + 4);
      g.fillStyle(COLORS.plate, 1).fillRect(x, y, w, h);
      if (f.doomed || (buffer && f.fact.str.startsWith(buffer))) g.fillStyle(COLORS.plateInk, 1).fillRect(x + 2, y + h - 2, w - 4, 1);
      f.text.setPosition(x + w / 2, y + 0.5);
    }
  }

  private drawWizard() {
    const wiz = this.islands.wizard;
    const c = this.cast;
    const bob = Math.round(Math.sin(this.playTime * 1.6) * 0.6);
    let dx = 0, dy = bob;
    if (c?.kind === 'twinkle') dy -= 1;
    if (c?.kind === 'fizzle') dx = Math.floor(c.t / 0.05) % 2 ? 1 : -1;
    wiz.setPosition(WIZARD.x + dx, WIZARD.y + dy);
    this.islands.cloud.setY(WIZARD.y + 10 + bob);
    if (c?.kind === 'twinkle') {
      const tip = this.wandTip();
      // Grows over the twinkle, then shrinks as the towers fire.
      const k = c.t < PLAY.twinkle ? c.t / PLAY.twinkle : 1 - (c.t - PLAY.twinkle) / (TWINKLE_END - PLAY.twinkle);
      this.star(this.top, tip.x + dx, tip.y + dy, 1 + k * 4, COLORS.bolt);
    }
  }

  /** A four-pointed twinkle: long rays, a bright core. */
  private star(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, color: number) {
    const r = Math.max(1, Math.round(s));
    g.fillStyle(color, 1).fillRect(x - 0.5, y - r - 0.5, 1, 2 * r + 1).fillRect(x - r - 0.5, y - 0.5, 2 * r + 1, 1);
    if (r > 2) g.fillRect(x - 1.5, y - 1.5, 3, 3);
    g.fillStyle(0xffffff, 1).fillRect(x - 0.5, y - 0.5, 1, 1);
  }

  private lightning(g: Phaser.GameObjects.Graphics, b: Bolt) {
    const r = mulberry32(b.seed | 0);
    const pts: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(b.x0, b.y0)];
    const n = 9;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push(new Phaser.Math.Vector2(lerp(b.x0, b.x1, t) + (r() - 0.5) * 14, lerp(b.y0, b.y1, t) + (r() - 0.5) * 6));
    }
    pts.push(new Phaser.Math.Vector2(b.x1, b.y1));
    for (const [w, col, a] of [[4, COLORS.bolt, 0.35], [1.6, COLORS.bolt, 1], [0.7, 0xffffff, 1]] as const) {
      g.lineStyle(w, col, a).strokePoints(pts, false);
    }
  }
}
