import Phaser from 'phaser';
import { staleClear, typeDigit } from '../answer';
import {
  COLORS, COTTAGES_X, GIFTS, GROUND, multFor, PLAY, POINTS, RENDER_SCALE, ROSTER, TEXT, THUNDERCLAP, TOP, TOWERS_X,
  WAND, WIDTH, WIZARD, type Gift,
} from '../config';
import { Controls, type Device, type Input } from '../controls';
import { DEFAULT_SETTINGS, Picker, poolFor, type Box, type Fact, type Settings } from '../facts';
import { loadHi, saveHi } from '../hi';
import { placeIslands, type Islands } from '../islands';
import { loadMemory, loadSettings, saveMemory } from '../memory';
import { bandFor } from '../tune';
import { crossesRebuild, kindFor, waveBonus, waveDef, type Kind, type WaveDef } from '../waves';
import { Music } from '../music';
import { Sfx } from '../sfx';
import { Backdrop, mulberry32 } from '../sky';
import { isMuted, restoreMute, Synth, toggleMute } from '../synth';
import { label } from '../text';
import { touchPad } from '../touch';
import { fitCamera } from '../view';

/** What the HUD draws, shared through the registry under `hud`. */
export interface HudState {
  score: number;
  hi: number;
  mult: number;
  /** Correct answers in a row: the pips towards the next multiplier step. */
  streak: number;
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
  paused: boolean;
}

export interface Target {
  kind: 'cottage' | 'tower';
  i: number;
  x: number;
}

export interface Foe {
  kind: Kind;
  fact: Fact;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  x: number;
  y: number;
  /** Progress along the fall, 0..1 (the crow doesn't fall: it stays 0). */
  p: number;
  /** Seconds for the whole fall. */
  dur: number;
  /** Where it will land (none for the crow, or a cloud, which bursts in mid-sky). */
  target: Target | undefined;
  /** The crow's speed across the sky, px/s. */
  vx: number;
  /** A per-stone phase for wobbles and zigzags. */
  wob: number;
  img: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Image | undefined;
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
interface Popup { text: Phaser.GameObjects.Text; icon?: Phaser.GameObjects.Image; life: number; max: number; rise: number; y0: number }
/** The wizard's gesture: a twinkle at the wand tip when right, a shake and a puff of smoke when wrong. */
export interface Cast { kind: 'twinkle' | 'fizzle'; t: number; big: boolean }
/** Stones waiting for the twinkle to finish, and the multiplier they'll score at. */
interface Strike { foes: Foe[]; t: number; mult: number }

const TAU = Math.PI * 2;
const lerp = Phaser.Math.Linear;
const clamp = Phaser.Math.Clamp;
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
/** Where a tower's bolt leaves from: its top. */
const TOWER_TOP = GROUND - 17;
const TWINKLE_END = PLAY.twinkle + 0.2;
const FIZZLE_END = 0.5;
const SPRITE: Record<Kind, string> = { hail: 'hailstone', cloud: 'splitcloud', ball: 'balllightning', crow: 'crow' };
const GIFT_KINDS: Gift[] = ['gust', 'mend', 'ward'];

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
  /** One range up: the Storm Crow's problems. */
  stretchPool: Fact[] = [];
  controls!: Controls;
  foes: Foe[] = [];
  /** Answers waiting for the wand's twinkle to finish. */
  strikes: Strike[] = [];
  bolts: Bolt[] = [];
  /** The last bolt fired, for tests: which tower, at which stone. */
  lastBolt: { tower: number; x: number; y: number } | undefined;
  blasts: Blast[] = [];
  cast: Cast | undefined;
  streak = 0;
  /** Hits taken per cottage: 1 loses the roof, 2 leaves rubble. */
  cottages: number[] = [];
  /** A ward over each cottage takes the next hit for it. */
  wards: boolean[] = [];
  /** Seconds each tower is still stunned. */
  stun: number[] = [];
  /** Seconds of Gust left. */
  gust = 0;
  lockout = 0;
  /** The last gift given, for tests and the HUD. Tests set `forceGift` to choose it. */
  lastGift: Gift | undefined;
  forceGift: Gift | undefined;
  /** The spawner runs (tests switch it off to set up a sky by hand). */
  spawning = true;
  wave!: WaveDef;
  /** Stones spawned so far this wave (the crow isn't counted). */
  spawned = 0;
  private crowDone = false;
  state: 'play' | 'clear' | 'over' = 'play';
  paused = false;
  /** Seconds since the wave cleared or the game ended. */
  stateT = 0;
  /** This game set a new high score. */
  newHi = false;
  private overPrompt: Phaser.GameObjects.Text | undefined;
  /** Touch's TITLE button on the game-over panel. */
  private overExtras: Phaser.GameObjects.GameObject[] = [];
  private leaving = false;
  private nextSpawn = 0;
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  private puffs: Puff[] = [];
  private popups: Popup[] = [];
  private towerFlash: number[] = [];
  /** A twinkle over a cottage: when a wave clears with it standing, or it's rebuilt. */
  private cottageGlow: number[] = [];
  private flash!: Phaser.GameObjects.Rectangle;
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
    this.lastGift = undefined;
    this.forceGift = undefined;
    this.streak = 0;
    this.lockout = 0;
    this.gust = 0;
    this.spawning = !this.attract;
    this.state = 'play';
    this.paused = false;
    this.newHi = false;
    this.overPrompt = undefined;
    this.overExtras = [];
    this.leaving = false;
    this.stateT = 0;
    this.cottages = COTTAGES_X.map(() => 0);
    this.wards = COTTAGES_X.map(() => false);
    this.stun = TOWERS_X.map(() => 0);
    this.towerFlash = TOWERS_X.map(() => 0);
    this.cottageGlow = COTTAGES_X.map(() => 0);
    // Attract mode plays a fixed mix and remembers nothing.
    this.settings = this.attract ? { ...DEFAULT_SETTINGS, ops: ['+', '-', 'x', '/'], pace: 'gale' } : (this.registry.get('settings') as Settings | undefined) ?? loadSettings();
    this.picker = new Picker(poolFor(this.settings), this.attract ? new Map<string, Box>() : loadMemory(), this.rand);
    this.stretchPool = poolFor(this.settings, true);

    fitCamera(this, RENDER_SCALE);
    this.backdrop = new Backdrop(this);
    this.islands = placeIslands(this);
    bakeHalo(this, 'crow', 'crow-halo');
    this.fx = this.add.graphics().setDepth(2);
    this.plates = this.add.graphics().setDepth(5);
    this.top = this.add.graphics().setDepth(6);
    this.flash = this.add.rectangle(0, 0, WIDTH, 240, 0xfffbe0).setOrigin(0).setDepth(9).setAlpha(0);

    restoreMute(this);
    this.synth = new Synth(this);
    this.sfx = new Sfx(this.synth);
    this.music = new Music(this.synth);
    if (!this.attract) {
      this.controls = new Controls(this);
      this.music.start();
    }
    // The HUD's II and speaker, a tap on the game-over panel, and the tab being hidden.
    const ev = this.game.events;
    const onPause = () => this.togglePause(), onMute = () => this.toggleMute(), onConfirm = () => this.confirm(), onQuit = () => this.quit();
    const onHidden = () => !this.paused && this.state !== 'over' && this.togglePause();
    ev.on('storm:pause', onPause);
    ev.on('storm:mute', onMute);
    ev.on('storm:confirm', onConfirm);
    ev.on('storm:quit', onQuit);
    ev.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.music.stop();
      ev.off('storm:pause', onPause);
      ev.off('storm:mute', onMute);
      ev.off('storm:confirm', onConfirm);
      ev.off('storm:quit', onQuit);
      touchPad.update({ show: false, clap: false, locked: false });
      ev.off(Phaser.Core.Events.HIDDEN, onHidden);
    });

    this.hud = {
      score: 0, hi: loadHi(), mult: 1, streak: 0, wave: 1, buffer: '', misfire: '', misfireT: 0,
      attract: this.attract, muted: isMuted(), device: this.controls?.device ?? 'kbm', arc: 4, over: false, paused: false,
    };
    this.registry.set('hud', this.hud);
    this.scene.launch('hud');
    this.startWave(1);
    this.cameras.main.fadeIn(this.attract ? 0 : 250);
  }

  /** A new wave: its numbers from `waves.ts`, and a banner. */
  startWave(n: number) {
    this.wave = waveDef(n, this.settings.pace);
    this.hud.wave = n;
    this.spawned = 0;
    this.crowDone = false;
    this.state = 'play';
    this.nextSpawn = 1.2;
    this.banner(`WAVE ${n}`, 14, 1.8);
    this.backdrop.storm = bandFor(n);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    if (this.controls) this.handleInput(this.controls.read(dt));
    if (!this.attract) touchPad.update({ show: !this.paused && this.state !== 'over', clap: this.hud.mult >= THUNDERCLAP.mult, locked: this.lockout > 0 });
    // Paused: everything holds still, the music too.
    if (this.paused) return;
    this.playTime += dt;
    this.backdrop.update(dt);

    this.lockout = Math.max(0, this.lockout - dt);
    this.gust = Math.max(0, this.gust - dt);
    this.hud.misfireT = Math.max(0, this.hud.misfireT - dt);
    for (let i = 0; i < this.stun.length; i++) {
      this.stun[i] = Math.max(0, this.stun[i] - dt);
      this.towerFlash[i] = Math.max(0, this.towerFlash[i] - dt);
    }
    for (let i = 0; i < this.cottageGlow.length; i++) this.cottageGlow[i] = Math.max(0, this.cottageGlow[i] - dt);
    this.stateT += dt;
    if (this.state === 'play') this.spawnTick(dt);
    else if (this.state === 'clear' && this.stateT > 2.6) this.startWave(this.wave.wave + 1);
    else if (this.state === 'over') {
      this.overPrompt?.setVisible(this.stateT > 1);
      for (const o of this.overExtras) (o as Phaser.GameObjects.Text).setVisible(this.stateT > 1);
      // Attract mode starts a new demo by itself (milestone 7 hands this to the cabinet).
      if (this.attract && this.stateT > 4) this.scene.restart({ attract: Math.floor(this.rand() * 2 ** 31) });
    }

    this.moveFoes(dt);
    this.runStrikes(dt);
    this.runBlasts(dt);
    if (this.state === 'play') this.checkClear();
    this.tickEffects(dt);
    this.drawWorld();
    this.hud.mult = multFor(this.streak);
    this.hud.streak = this.streak;
    this.tuneMusic();
  }

  /** The music follows the storm: the flute from wave 2, drums while a stone is low, a new key every three waves. */
  private tuneMusic() {
    const lowest = this.foes.reduce((m, f) => (f.dead || f.doomed || !f.target ? m : Math.max(m, f.p)), 0);
    const st = this.music.state;
    st.danger = this.state === 'play' && lowest > 0.55;
    st.lead = this.wave.wave >= 2;
    st.band = bandFor(this.wave.wave);
  }

  // ---- Input ----

  private handleInput(input: Input) {
    this.hud.device = input.device;
    this.hud.arc = this.controls.arc;
    if (input.mute) this.toggleMute();
    if (this.state === 'over') {
      if (input.back) this.quit();
      else if (input.confirm || input.clap) this.confirm();
      return;
    }
    // Paused: Escape (or B) leaves for the title; P, Start, Enter or A resume.
    if (this.paused) {
      if (input.back) this.quit();
      else if (input.pause || input.confirm) this.togglePause();
      return;
    }
    if (input.pause) return this.togglePause();
    if (this.state !== 'play' && this.state !== 'clear') return;
    for (let i = 0; i < input.undo; i++) {
      if (!this.hud.buffer) continue;
      this.hud.buffer = this.hud.buffer.slice(0, -1);
      this.sfx.undo();
    }
    for (const d of input.digits) this.type(d);
    if (input.clap) this.thunderclap();
  }

  toggleMute() {
    this.hud.muted = toggleMute(this);
  }

  /** P, Start, Escape or the II icon. Pausing saves what's been learned so far. */
  togglePause() {
    if (this.attract || this.state === 'over') return;
    this.paused = !this.paused;
    this.hud.paused = this.paused;
    this.music.held = this.paused;
    this.sfx.pause(this.paused);
    if (this.paused) saveMemory(this.picker.memory);
  }

  /** Retry after the storm wins (Enter, Space, A, Start, or a tap on the panel). */
  confirm() {
    if (this.state !== 'over' || this.stateT < 1) return;
    this.scene.restart();
  }

  /** Back to the title, keeping what's been learned and the high score. */
  quit() {
    if (this.attract) return;
    saveMemory(this.picker.memory);
    saveHi(this.hud.score);
    this.leave();
  }

  /** One digit into the answer box: it may strike, wait for more, or misfire. */
  type(d: string) {
    if ((this.state !== 'play' && this.state !== 'clear') || this.lockout > 0 || this.paused) return;
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
      // The crow's stretch problem always counts as quick: it's high, and it's hard.
      this.picker.credit(f.fact, f.kind === 'crow' || (f.y - TOP) / (GROUND - TOP) < PLAY.quick);
    }
    this.streak++;
    this.cast = { kind: 'twinkle', t: 0, big: false };
    this.strikes.push({ foes: hit, t: PLAY.twinkle, mult: multFor(this.streak) });
    if (hit.length > 1) this.sfx.double();
    else this.sfx.correct(this.streak);
  }

  /** Wrong: the box clears, the streak resets, the digits lock briefly, and the wand fizzles. */
  private misfire(typed: string) {
    this.hud.misfire = typed;
    this.hud.misfireT = 0.5;
    this.lockout = PLAY.lockout;
    this.streak = 0;
    this.cast = { kind: 'fizzle', t: 0, big: false };
    this.sfx.misfire();
    const tip = this.wandTip();
    for (let i = 0; i < 4; i++) this.puffs.push({ x: tip.x + (i - 1.5) * 3, y: tip.y - 1 - (i % 2) * 2, r: 1.6 + (i % 2) * 0.6, life: 0.6 + i * 0.08 });
    for (let i = 0; i < 5; i++) this.sparks.push({ x: tip.x, y: tip.y, vx: (this.rand() - 0.3) * 30, vy: -10 - this.rand() * 15, life: 0.35, color: COLORS.dim, gravity: 120 });
  }

  /**
   * The Thunderclap, at ×4 or more: every stone but the crow is struck at the current multiplier, and the streak is
   * spent. None of those facts count for drilling.
   */
  thunderclap() {
    if (this.state !== 'play' || multFor(this.streak) < THUNDERCLAP.mult) return false;
    const hit = this.live().filter((f) => f.kind !== 'crow');
    if (!hit.length) return false;
    for (const f of hit) f.doomed = true;
    this.strikes.push({ foes: hit, t: PLAY.twinkle, mult: multFor(this.streak) });
    this.streak = 0;
    this.hud.buffer = staleClear(this.hud.buffer, this.liveAnswers());
    this.cast = { kind: 'twinkle', t: 0, big: true };
    this.sfx.clap();
    if (!REDUCED) {
      this.flash.setAlpha(0.35);
      this.cameras.main.shake(300, 0.01);
    }
    this.banner('THUNDERCLAP!', 14, 1.2);
    return true;
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

  /** The wave's spawner: stones up to its count, never more than its cap at once, and the crow halfway through. */
  private spawnTick(dt: number) {
    if (!this.spawning) return;
    const w = this.wave;
    if (!this.crowDone && w.crowAt >= 0 && this.spawned >= w.crowAt) this.crowDone = !!this.spawn('crow');
    this.nextSpawn -= dt;
    if (this.spawned >= w.count || this.nextSpawn > 0) return;
    // The crow doesn't count towards the cap: it never attacks.
    if (this.live().filter((f) => f.kind !== 'crow').length >= w.cap) return;
    if (this.spawn(kindFor(w.wave, this.spawned))) {
      this.spawned++;
      this.nextSpawn = w.gap * (0.7 + this.rand() * 0.6);
    } else this.nextSpawn = 0.3;
  }

  /** Every stone spawned and gone: the wave is clear. Standing cottages score a bonus, and the next wave follows. */
  private checkClear() {
    if (!this.spawning || this.spawned < this.wave.count || this.strikes.length) return;
    if (this.foes.some((f) => !f.dead && f.kind !== 'crow')) return;
    const standing = this.cottages.filter((h) => h < PLAY.cottageHits).length;
    const bonus = waveBonus(standing, multFor(this.streak));
    this.state = 'clear';
    this.stateT = 0;
    this.addScore(bonus);
    this.sfx.clear();
    this.cottages.forEach((h, i) => h < PLAY.cottageHits && (this.cottageGlow[i] = 0.5 + i * 0.08));
    this.banner(`WAVE ${this.wave.wave} CLEAR  +${bonus}`, 12, 2.4);
    saveMemory(this.picker.memory);
  }

  spawnHail(opts: SpawnOpts = {}) {
    return this.spawn('hail', opts);
  }

  /** A threat with a problem. Tests pass a fact, a start point and a target. */
  spawn(kind: Kind, opts: SpawnOpts = {}): Foe | null {
    const lives = this.live();
    const fact = opts.fact ?? this.picker.pick(lives.map((f) => f.fact.str), new Set(lives.map((f) => f.fact.key)), kind === 'crow' ? this.stretchPool : undefined);
    if (!fact) return null;
    const base = { kind, fact, p: 0, vx: 0, wob: this.rand() * TAU, dead: false, doomed: false, halo: undefined as Phaser.GameObjects.Image | undefined };
    let f: Foe;
    if (kind === 'crow') {
      const dir = opts.dir ?? (this.rand() < 0.5 ? 1 : -1);
      const [y0, y1] = ROSTER.crow.y;
      const x = opts.x ?? (dir > 0 ? -12 : WIDTH + 12), y = opts.y ?? y0 + this.rand() * (y1 - y0);
      f = { ...base, sx: x, sy: y, tx: x, ty: y, x, y, dur: 1, target: undefined, vx: dir * ROSTER.crow.speed, img: this.add.image(x, y, 'crow').setFlipX(dir < 0).setDepth(4), text: this.plateText(fact, true) };
      f.halo = this.add.image(x, y, 'crow-halo').setFlipX(dir < 0).setDepth(3.9);
      this.sfx.caw();
    } else {
      const targets = this.standingTargets();
      const target = opts.target ?? targets[Math.floor(this.rand() * targets.length)];
      const sx = opts.x ?? clamp(target.x + (this.rand() - 0.5) * 260, 12, WIDTH - 12);
      const sy = opts.y ?? PLAY.spawnY;
      const cloud = kind === 'cloud';
      const ty = cloud ? ROSTER.cloud.burstY : GROUND - 4;
      const tx = cloud ? lerp(sx, target.x, 0.45) : target.x;
      const mul = (cloud ? ROSTER.cloud.fallMul : kind === 'ball' ? ROSTER.ball.fallMul : 1) * (opts.fallMul ?? 1);
      // A fall's time scales with its height, so every stone of a kind falls at the same speed.
      const dur = this.wave.fall * mul * ((ty - sy) / (GROUND - TOP));
      f = { ...base, sx, sy, tx, ty, x: sx, y: sy, dur: Math.max(0.3, dur), target: cloud ? undefined : target, img: this.add.image(sx, sy, SPRITE[kind]).setDepth(4), text: this.plateText(fact, false) };
      if (kind === 'ball') this.sfx.crackle();
    }
    this.foes.push(f);
    return f;
  }

  private plateText(fact: Fact, crow: boolean) {
    return label(this, 0, 0, fact.label, 7, TEXT.plateInk, { align: 'center' }).setDepth(5.1).setData('crow', crow);
  }

  private moveFoes(dt: number) {
    const slow = this.gust > 0 ? GIFTS.gust.slow : 1;
    for (const f of this.foes) {
      if (f.dead || f.doomed) continue;
      if (f.kind === 'crow') {
        f.x += f.vx * dt * slow;
        f.y = f.sy + Math.sin(this.playTime * 3 + f.wob) * 1.5;
        // Gone off the far side: no harm, and no mark against the fact.
        if (f.x < -20 || f.x > WIDTH + 20) this.remove(f);
        continue;
      }
      f.p += (dt * slow) / f.dur;
      const p = Math.min(1, f.p);
      f.x = lerp(f.sx, f.tx, p);
      f.y = lerp(f.sy, f.ty, p);
      if (f.kind === 'ball') f.x += Math.sin(p * TAU * ROSTER.ball.swings + f.wob) * ROSTER.ball.zigzag * (1 - p);
      if (f.kind === 'cloud') f.x += Math.sin(this.playTime * 0.8 + f.wob) * 3;
      if (f.p >= 1) {
        if (f.kind === 'cloud') this.burstCloud(f);
        else this.land(f);
      }
    }
    this.foes = this.foes.filter((f) => !f.dead);
  }

  /** Takes a threat off the sky without a blast. */
  private remove(f: Foe) {
    f.dead = true;
    f.img.destroy();
    f.halo?.destroy();
    f.text.destroy();
    this.hud.buffer = staleClear(this.hud.buffer, this.liveAnswers());
  }

  /** A split cloud reached mid-sky unanswered: it bursts into three stones with new problems, and its fact is missed. */
  private burstCloud(f: Foe) {
    this.remove(f);
    this.burst(f.x, f.y, COLORS.dim, 10);
    this.sfx.split();
    this.picker.miss(f.fact);
    this.popup(`${f.fact.label} = ${f.fact.ans}`, clamp(f.x, 50, WIDTH - 50), f.y - 44, { size: 13, color: TEXT.ink, life: PLAY.factLife, depth: 3 });
    const targets = this.standingTargets();
    const c = ROSTER.cloud;
    for (let i = 0; i < c.shards; i++) {
      // Spread out and staggered, so the three plates can be read apart.
      const x = clamp(f.x + (i - 1) * c.shardSpread, 12, WIDTH - 12);
      this.spawn('hail', { x, y: f.y + 4 + i * 6, target: targets[Math.floor(this.rand() * targets.length)], fallMul: c.shardFallMul });
    }
    this.hud.buffer = staleClear(this.hud.buffer, this.liveAnswers());
  }

  /** The twinkle has finished: each struck stone takes a bolt from the nearest tower that isn't stunned. */
  private runStrikes(dt: number) {
    for (const s of this.strikes) {
      s.t -= dt;
      if (s.t > 0) continue;
      for (const f of s.foes) {
        if (f.dead) continue;
        const tower = this.nearestTower(f.x);
        this.bolts.push({ x0: TOWERS_X[tower], y0: TOWER_TOP, x1: f.x, y1: f.y, life: 0.2, seed: this.rand() * 1e9 });
        this.towerFlash[tower] = 0.12;
        this.lastBolt = { tower, x: f.x, y: f.y };
        this.score(POINTS[f.kind] * s.mult, f.x, f.y - 10);
        this.kill(f);
        if (f.kind === 'crow') this.gift(f);
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
    this.remove(f);
    const b = PLAY.blast;
    this.blasts.push({ x: f.x, y: f.y, r: 2, max: f.kind === 'cloud' ? ROSTER.cloud.blast : b.r, life: b.life });
    this.burst(f.x, f.y, f.kind === 'ball' ? COLORS.bolt : COLORS.ice, 14);
    this.rings.push({ x: f.x, y: f.y, r: 3, dr: 70, life: 0.35 });
    this.sfx.blast();
  }

  /** The crow's gift: Gust, Mend or Ward, at random. */
  private gift(f: Foe) {
    const g = this.forceGift ?? GIFT_KINDS[Math.floor(this.rand() * GIFT_KINDS.length)];
    this.lastGift = g;
    let note = g.toUpperCase();
    if (g === 'gust') this.gust = GIFTS.gust.time;
    if (g === 'mend') {
      const worst = this.cottages.reduce((b, hits, i) => (hits > this.cottages[b] ? i : b), 0);
      if (this.cottages[worst] > 0) {
        this.cottages[worst]--;
        this.drawCottage(worst);
      } else {
        this.score(GIFTS.mendScore, f.x, f.y + 22);
        note = `MEND +${GIFTS.mendScore}`;
      }
    }
    if (g === 'ward') {
      // The standing cottage with the closest stone heading for it (or the first standing one).
      const threat = (i: number) => this.live().reduce((m, s) => (s.target?.kind === 'cottage' && s.target.i === i ? Math.max(m, s.p) : m), -1);
      const open = this.cottages.map((_, i) => i).filter((i) => this.cottages[i] < PLAY.cottageHits && !this.wards[i]);
      if (open.length) this.wards[open.sort((a, b) => threat(b) - threat(a))[0]] = true;
    }
    this.popup(note, f.x + 6, Math.max(TOP + 24, f.y + 12), { size: 7, color: TEXT.ink, life: 1.4, rise: 4, depth: 7, icon: g });
    this.sfx.gift();
  }

  /** Blasts grow, and catch any hailstone or split cloud that drifts in: a chain, worth less, not counted for drilling. */
  private runBlasts(dt: number) {
    for (const b of this.blasts) {
      b.life -= dt;
      b.r = Math.min(b.max, b.r + dt * PLAY.blast.grow);
      if (b.life <= 0) continue;
      for (const f of this.foes) {
        if (f.dead || f.doomed || f.kind === 'ball' || f.kind === 'crow') continue;
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
    this.remove(f);
    this.burst(f.x, GROUND - 2, COLORS.ice, 18);
    if (!REDUCED) this.cameras.main.shake(140, 0.006);
    const t = f.target!;
    if (t.kind === 'cottage' && this.wards[t.i]) {
      // The ward takes the hit and pops.
      this.wards[t.i] = false;
      this.rings.push({ x: t.x, y: GROUND - 8, r: 14, dr: 30, life: 0.4 });
      this.sfx.ward();
    } else if (t.kind === 'cottage') {
      const hits = Math.min(PLAY.cottageHits, this.cottages[t.i] + 1);
      const lost = hits === PLAY.cottageHits && this.cottages[t.i] < hits;
      this.cottages[t.i] = hits;
      this.drawCottage(t.i);
      this.sfx.land(lost);
      // A cottage flattened: a bigger burst and a shockwave.
      if (lost) {
        this.burst(t.x, GROUND - 6, COLORS.dim, 16);
        this.rings.push({ x: t.x, y: GROUND - 6, r: 4, dr: 60, life: 0.45 });
      }
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

  drawCottage(i: number) {
    const img = this.islands.cottages[i];
    const hits = this.cottages[i];
    if (hits === 0) img.setTexture('cottage').setCrop().setY(GROUND - 8);
    // One hit: the roof is gone (the sprite's top rows cropped), and it smokes.
    else if (hits === 1) img.setTexture('cottage').setCrop(0, 6, 16, 10).setY(GROUND - 8);
    else img.setTexture('rubble').setCrop().setY(GROUND - 6);
  }

  /** The storm wins: the score, a new high score if it is one, the facts to practise, and one press to retry. */
  private gameOver() {
    this.state = 'over';
    this.stateT = 0;
    this.hud.over = true;
    this.hud.buffer = '';
    this.music.held = true;
    this.sfx.over();
    this.newHi = saveHi(this.hud.score);
    if (this.newHi) this.time.delayedCall(1300, () => this.sfx.newHi());
    saveMemory(this.picker.memory);
    const cx = WIDTH / 2, d = 8.1;
    const panel = this.add.rectangle(cx, 100, 268, 120, COLORS.bar, 0.86).setStrokeStyle(1, COLORS.line).setDepth(8);
    if (!this.attract) panel.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.confirm());
    label(this, cx, 44, 'The storm wins this time', 18, TEXT.bolt, { face: 'title', align: 'center' }).setDepth(d);
    label(this, cx, 68, `SCORE ${this.hud.score.toLocaleString('en-US')}   WAVE ${this.wave.wave}`, 8, TEXT.ink, { align: 'center' }).setDepth(d);
    if (this.newHi) label(this, cx, 79, 'NEW HIGH SCORE', 7, TEXT.bolt, { align: 'center' }).setDepth(d);
    const facts = this.picker.missedRecent;
    label(this, cx, 92, facts.length ? 'Facts to practise' : 'No facts missed. Well done!', 7, TEXT.dim, { align: 'center' }).setDepth(d);
    facts.forEach((f, i) => label(this, cx, 103 + i * 11, `${f.label} = ${f.ans}`, 9, TEXT.ice, { align: 'center' }).setDepth(d));
    const dev = this.hud.device;
    const prompt = dev === 'pad' ? 'A TO TRY AGAIN   B FOR THE TITLE' : dev === 'touch' ? 'TAP TO TRY AGAIN' : 'ENTER TO TRY AGAIN   ESC FOR THE TITLE';
    this.overPrompt = label(this, cx, 146, this.attract ? '' : prompt, 7, TEXT.ink, { align: 'center' }).setDepth(d).setVisible(false);
    // Touch has no Escape: a TITLE button on the panel's corner (a tap anywhere else tries again).
    if (dev === 'touch' && !this.attract) {
      const btn = this.add.rectangle(cx + 108, 150.5, 44, 15, COLORS.bar, 1).setStrokeStyle(1, COLORS.ink).setDepth(d).setVisible(false);
      const txt = label(this, cx + 108, 146, 'TITLE', 7, TEXT.ink, { align: 'center' }).setDepth(d + 0.01).setVisible(false);
      btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.state === 'over' && this.stateT >= 1 && this.quit());
      this.overExtras = [btn, txt];
    }
  }

  private leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(400);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('hud');
      this.scene.start('title');
    });
  }

  // ---- Effects ----

  private score(n: number, x: number, y: number, text = String(n)) {
    this.addScore(n);
    this.popup(text, x, Math.max(TOP + 12, y), { size: 6, color: TEXT.ink, life: 0.8, rise: 6, depth: 7 });
  }

  /** Adds points. Every 10,000 rebuilds the most damaged cottage. */
  addScore(n: number) {
    const before = this.hud.score;
    this.hud.score += n;
    this.hud.hi = Math.max(this.hud.hi, this.hud.score);
    if (!crossesRebuild(before, this.hud.score)) return;
    const worst = this.cottages.reduce((b, hits, i) => (hits > this.cottages[b] ? i : b), 0);
    if (this.cottages[worst] === 0) return;
    this.cottages[worst] = 0;
    this.drawCottage(worst);
    this.cottageGlow[worst] = 0.8;
    this.sfx.rebuilt();
    this.popup('REBUILT', COTTAGES_X[worst], GROUND - 30, { size: 7, color: TEXT.ink, life: 1.4, rise: 4, depth: 7 });
  }

  /** A big line across the sky (a wave starting or clearing, the Thunderclap). A new one replaces the last. */
  private banner(str: string, size: number, life: number) {
    const last = this.popups.find((p) => p.text.getData('banner'));
    if (last) last.life = 0;
    this.popup(str, WIDTH / 2, 86, { size, color: TEXT.bolt, life, depth: 3 });
    this.popups[this.popups.length - 1].text.setData('banner', true);
  }

  private popup(str: string, x: number, y: number, o: { size: number; color: string; life: number; rise?: number; depth: number; icon?: Gift }) {
    const text = label(this, x, y, str, o.size, o.color, { align: 'center' }).setDepth(o.depth).setStroke(TEXT.plateInk, o.size > 8 ? 4 : 2);
    const icon = o.icon ? this.add.image(x - text.width / 2 - 10, y + text.height / 2, o.icon).setDepth(o.depth) : undefined;
    this.popups.push({ text, icon, life: o.life, max: o.life, rise: o.rise ?? 0, y0: y });
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
      const end = this.cast.kind === 'twinkle' ? TWINKLE_END * (this.cast.big ? 2 : 1) : FIZZLE_END;
      if (this.cast.t > end) this.cast = undefined;
    }
    this.flash.setAlpha(Math.max(0, this.flash.alpha - dt));
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
      const a = clamp((p.life / p.max) * 3, 0, 1), y = p.y0 - (1 - p.life / p.max) * p.rise;
      p.text.setAlpha(a).setY(y);
      p.icon?.setAlpha(a).setY(y + p.text.height / 2);
      if (p.life <= 0) {
        p.text.destroy();
        p.icon?.destroy();
      }
    }
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  // ---- Drawing ----

  private drawWorld() {
    const g = this.fx.clear();
    const clock = this.playTime;

    // Gust: pale wind streaks sweep across the sky.
    if (this.gust > 0) {
      g.fillStyle(0xdcebff, 0.35);
      for (let i = 0; i < 8; i++) g.fillRect(Math.round(((clock * 120 + i * 97) % (WIDTH + 60)) - 30), 30 + i * 18, 24, 1);
    }
    // Landing chevrons under every stone past halfway, blinking in the last 20% (steady with reduced motion).
    g.fillStyle(COLORS.ink, 1);
    for (const f of this.foes) {
      if (f.dead || f.doomed || !f.target || f.p < 0.5) continue;
      if (!REDUCED && f.p > 0.8 && Math.floor(clock * 8) % 2) continue;
      const x = Math.round(f.target.x);
      g.fillRect(x - 3, GROUND + 4, 1, 1).fillRect(x - 2, GROUND + 5, 1, 1).fillRect(x - 1, GROUND + 6, 3, 1);
      g.fillRect(x + 2, GROUND + 5, 1, 1).fillRect(x + 3, GROUND + 4, 1, 1);
    }
    // Smoke from roofless cottages; a "z" over stunned towers (shape, not colour); a dome over warded cottages.
    g.fillStyle(0xa0aac8, 0.5);
    this.cottages.forEach((hits, i) => {
      if (hits !== 1) return;
      const x = COTTAGES_X[i];
      for (let k = 0; k < 3; k++) g.fillRect(x - 2 + Math.round(Math.sin(clock * 2 + k) * 2), GROUND - 14 - k * 4 - Math.round((clock * 6) % 4), 3, 2);
    });
    this.wards.forEach((on, i) => {
      if (!on) return;
      const x = COTTAGES_X[i];
      g.lineStyle(1, COLORS.ice, 0.9).beginPath().arc(x, GROUND, 13, Math.PI, 0).strokePath();
      // An inner dotted arc: the dome reads by shape, not by its colour.
      for (let a = Math.PI; a <= TAU; a += Math.PI / 10) g.fillStyle(COLORS.ice, 0.9).fillRect(Math.round(x + Math.cos(a) * 10), Math.round(GROUND + Math.sin(a) * 10), 1, 1);
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

    // Threats: hail leaves a faint trail back the way it came.
    for (const f of this.foes) {
      if (f.dead) continue;
      if (f.kind === 'hail') g.lineStyle(1, COLORS.ice, 0.25).lineBetween(f.x, f.y, lerp(f.x, f.sx, 0.18), lerp(f.y, f.sy, 0.18));
      f.img.setPosition(Math.round(f.x), Math.round(f.y));
      f.halo?.setPosition(Math.round(f.x), Math.round(f.y));
    }
    this.drawPlates();
    this.drawWizard();

    const t = this.top.clear();
    for (const b of this.bolts) this.lightning(t, b);
    this.towerFlash.forEach((life, i) => {
      if (life > 0) this.star(t, TOWERS_X[i], TOWER_TOP, 2 + life * 20, COLORS.bolt);
    });
    this.cottageGlow.forEach((life, i) => {
      if (life > 0) this.star(t, COTTAGES_X[i], GROUND - 20, 1 + Math.sin(Math.min(1, life / 0.5) * Math.PI) * 3, COLORS.ink);
    });
  }

  /**
   * White plates with dark ink; each kind has its own border, never just a colour. The crow: a double border and a
   * white diamond stud on each side (outside the plate, where no badge can be mistaken for a plus sign). Ball lightning: a zigzag edge. A split cloud: an underline outside the plate. The box's digits underline
   * every plate they could still match. Plates never overlap: one that would cover another steps up above it (or
   * below its stone, at the top of the sky).
   */
  private drawPlates() {
    const g = this.plates.clear();
    const buffer = this.hud.buffer;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const h = 10, gap = 3;
    const hits = (x: number, y: number, w: number) => placed.some((r) => x < r.x + r.w + gap && r.x < x + w + gap && y < r.y + r.h + gap && r.y < y + h + gap);
    // Lowest stones first: they're the most urgent, so their plates stay put.
    for (const f of [...this.foes].sort((a, b) => b.y - a.y)) {
      if (f.dead) continue;
      const crow = f.kind === 'crow';
      const w = Math.ceil(f.text.width) + (crow ? 9 : 7);
      const x = Math.round(clamp(f.x - w / 2, crow ? 7 : 2, WIDTH - w - (crow ? 7 : 2)));
      let y = Math.round(Math.max(TOP + 3, f.y - 20));
      for (let k = 0; k < 4 && hits(x, y, w); k++) y -= h + gap;
      if (y < TOP + 3) {
        y = Math.round(f.y + 10);
        for (let k = 0; k < 4 && hits(x, y, w); k++) y += h + gap;
      }
      placed.push({ x, y, w, h });
      g.fillStyle(COLORS.plateInk, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
      // Urgent: a thicker outline past 60% of the fall.
      if (f.p > 0.6) g.fillRect(x - 2, y - 2, w + 4, h + 4);
      g.fillStyle(COLORS.plate, 1).fillRect(x, y, w, h);
      g.fillStyle(COLORS.plateInk, 1);
      if (crow) {
        g.lineStyle(1, COLORS.plateInk, 1).strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
        for (const cx of [x - 4, x + w + 3]) {
          diamond(g, cx, y + 5, 4, COLORS.plateInk);
          diamond(g, cx, y + 5, 3, COLORS.plate);
        }
      }
      // Marks outside the plate are white, or they'd vanish against the night sky.
      g.fillStyle(COLORS.plate, 1);
      if (f.kind === 'ball') for (let i = 0; i < w; i += 4) g.fillRect(x + i, y - 3, 2, 1).fillRect(x + i + 2, y + h + 2, 2, 1);
      if (f.kind === 'cloud') g.fillRect(x + 1, y + h + 2, w - 2, 1);
      g.fillStyle(COLORS.plateInk, 1);
      if (f.doomed || (buffer && f.fact.str.startsWith(buffer))) g.fillRect(x + 2, y + h - 2, w - 4, 1);
      f.text.setPosition(x + w / 2, y + 0.5);
    }
  }

  private drawWizard() {
    const wiz = this.islands.wizard;
    const c = this.cast;
    const bob = REDUCED ? 0 : Math.round(Math.sin(this.playTime * 1.6) * 0.6);
    let dx = 0, dy = bob;
    if (c?.kind === 'twinkle') dy -= c.big ? 2 : 1;
    if (c?.kind === 'fizzle') dx = Math.floor(c.t / 0.05) % 2 ? 1 : -1;
    wiz.setPosition(WIZARD.x + dx, WIZARD.y + dy);
    this.islands.cloud.setY(WIZARD.y + 10 + bob);
    if (c?.kind === 'twinkle') {
      const tip = this.wandTip();
      // Grows over the twinkle, then shrinks as the towers fire. The Thunderclap's is twice the size and length.
      const end = TWINKLE_END * (c.big ? 2 : 1), peak = PLAY.twinkle;
      const k = c.t < peak ? c.t / peak : 1 - (c.t - peak) / (end - peak);
      this.star(this.top, tip.x + dx, tip.y + dy, 1 + k * (c.big ? 8 : 4), COLORS.bolt);
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

export interface SpawnOpts {
  fact?: Fact;
  x?: number;
  y?: number;
  target?: Target;
  fallMul?: number;
  /** The crow's direction: 1 flies right, -1 left. */
  dir?: number;
}

/** A pixel diamond of radius `r` centred on (cx, cy). */
function diamond(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, color: number) {
  g.fillStyle(color, 1);
  for (let dy = -r + 1; dy < r; dy++) {
    const half = r - 1 - Math.abs(dy);
    g.fillRect(cx - half - 0.5, cy + dy - 0.5, 2 * half + 1, 1);
  }
}

/**
 * A 1 px pale outline around a sprite's silhouette, so a dark sprite (the black crow) reads against the night sky.
 * The texture is 18×18: the sprite's 16×16 plus a pixel all round.
 */
function bakeHalo(scene: Phaser.Scene, key: string, out: string) {
  if (scene.textures.exists(out)) return;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const cg = c.getContext('2d')!;
  cg.drawImage(src, 0, 0);
  const d = cg.getImageData(0, 0, 16, 16).data;
  const tex = scene.textures.createCanvas(out, 18, 18);
  if (!tex) return;
  const g = tex.getContext();
  g.fillStyle = '#dfe6ff';
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (d[(y * 16 + x) * 4 + 3] < 40) continue;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillRect(x + 1 + dx, y + 1 + dy, 1, 1);
    }
  }
  tex.refresh();
}
