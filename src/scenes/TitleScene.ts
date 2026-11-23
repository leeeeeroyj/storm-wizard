import Phaser from 'phaser';
import { ATTRACT, attractSeed } from '../attract';
import { COLORS, HEIGHT, PACE, RENDER_SCALE, SPRITES, TEXT, WIDTH, type Pace } from '../config';
import { Controls } from '../controls';
import { SIGN, type Op, type Settings } from '../facts';
import { loadHi } from '../hi';
import { placeIslands } from '../islands';
import { masteryFor, type Cell } from '../mastery';
import { loadMemory, loadSettings, saveSettings } from '../memory';
import { Backdrop } from '../sky';
import { Music } from '../music';
import { touchPad } from '../touch';
import { Sfx } from '../sfx';
import { restoreMute, Synth } from '../synth';
import { label } from '../text';
import { fitCamera } from '../view';

const OPS: Op[] = ['+', '-', 'x', '/'];
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const ADD_RANGES = [10, 20, 100] as const;
const MUL_RANGES = [5, 10, 12] as const;
const PACES = Object.keys(PACE) as Pace[];
const PACE_NOTE: Record<Pace, string> = {
  breeze: 'Gentle: a stone takes 18 s to fall',
  gale: 'Brisk: 12 s, more stones at once',
  tempest: 'Fierce: 8 s, a crowded sky',
};

/** One menu row: its items, which are on, and what activating one does. */
interface Row {
  label: string;
  y: number;
  items: { text: string; x: number; w: number }[];
  on: (i: number) => boolean;
  /** Select rows change as you step across them; the operations row only moves its cursor until you press. */
  select: boolean;
  act: (i: number) => void;
}

// Layout, in design pixels.
const LEFT = { x: 12, y: 58, w: 196, h: 134 };
const RIGHT = { x: 214, y: 58, w: 190, h: 134 };
const OPT_X = 88;
const GRID = { x: RIGHT.x + 18, y: RIGHT.y + 24, size: 88 };

/**
 * The title: the name, the settings (which operations, their ranges and the pace), START, and the mastery grid of
 * what this browser has learned. Arrows or the D-pad move, Space or A changes, Enter or Start begins; everything is
 * a click or tap target too. Settings are saved as they change.
 */
export class TitleScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private controls!: Controls;
  settings!: Settings;
  private rows: Row[] = [];
  /** The focused row and the cursor in it. */
  focus = 4;
  cursor = 0;
  /** Which operation's grid is showing. */
  gridOp: Op = 'x';
  private ui!: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private gridTexts: Phaser.GameObjects.Text[] = [];
  private note!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private padStatus!: Phaser.GameObjects.Text;
  private warn!: Phaser.GameObjects.Text;
  private warnT = 0;
  private leaving = false;
  private clock = 0;
  private sfx!: Sfx;
  private music!: Music;

  constructor() {
    super('title');
  }

  preload() {
    for (const key of SPRITES) this.load.image(key, `sprites/${key}.png`);
  }

  create() {
    // Attract mode goes straight to the game once the sprites are loaded.
    if (ATTRACT) return void this.scene.start('sky', { attract: attractSeed() });
    this.leaving = false;
    this.clock = 0;
    this.warnT = 0;
    restoreMute(this);
    this.settings = loadSettings();
    this.gridOp = this.settings.ops.includes(this.gridOp) ? this.gridOp : this.settings.ops[0];
    this.focus = 4;
    this.cursor = 0;
    fitCamera(this, RENDER_SCALE);
    this.backdrop = new Backdrop(this);
    placeIslands(this);
    this.add.graphics().setDepth(4).fillStyle(COLORS.night, 0.55).fillRect(0, 0, WIDTH, HEIGHT);
    this.cameras.main.fadeIn(250);
    this.controls = new Controls(this);
    const synth = new Synth(this);
    this.sfx = new Sfx(synth);
    // The title theme: the flute line over the calm layer, slower. It starts once a key or click unlocks audio.
    this.music = new Music(synth, 'title');
    this.music.start();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.music.stop());

    const cx = WIDTH / 2;
    label(this, cx, 2, 'Storm Wizard', 38, TEXT.bolt, { face: 'title', align: 'center' }).setDepth(5);
    label(this, cx, 45, 'TYPE THE ANSWER. STRIKE THE HAIL.', 7, TEXT.ink, { align: 'center' }).setDepth(5);
    const hi = loadHi();
    if (hi) label(this, WIDTH - 6, 4, `HI ${hi.toLocaleString('en-US')}`, 7, TEXT.bolt, { align: 'right' }).setDepth(5);

    this.ui = this.add.graphics().setDepth(5);
    this.buildRows();
    for (const r of this.rows) {
      this.texts.push(label(this, LEFT.x + 10, r.y + 2, r.label, 6, TEXT.dim).setDepth(6));
      const start = r === this.rows[4];
      for (const it of r.items) this.texts.push(label(this, it.x + it.w / 2, r.y + (start ? 3 : 1.5), it.text, start ? 9 : 7, TEXT.ink, { align: 'center' }).setDepth(6).setData('item', it));
    }
    this.note = label(this, LEFT.x + 10, 141, '', 6, TEXT.dim).setDepth(6);
    this.warn = label(this, LEFT.x + LEFT.w / 2, 180, 'KEEP AT LEAST ONE OPERATION', 6, TEXT.bolt, { align: 'center' }).setDepth(6).setVisible(false);
    this.hint = label(this, LEFT.x + LEFT.w / 2, 180, '', 6, TEXT.dim, { align: 'center' }).setDepth(6);
    this.padStatus = label(this, cx, 195, '', 6, TEXT.dim, { align: 'center' }).setDepth(6);
    label(this, RIGHT.x + 8, RIGHT.y + 6, 'WHAT YOU KNOW', 7, TEXT.ink).setDepth(6);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.click(p.worldX, p.worldY));
    this.refresh();
  }

  private buildRows() {
    const s = this.settings;
    const items = (texts: string[], w: number, gap = 4) => texts.map((text, i) => ({ text, x: OPT_X + i * (w + gap), w }));
    this.rows = [
      { label: 'OPERATIONS', y: 66, items: items(OPS.map((o) => SIGN[o]), 18), select: false, on: (i) => s.ops.includes(OPS[i]), act: (i) => this.toggleOp(OPS[i]) },
      { label: '+ − WITHIN', y: 86, items: items(ADD_RANGES.map(String), 26), select: true, on: (i) => s.addR === ADD_RANGES[i], act: (i) => (s.addR = ADD_RANGES[i]) },
      { label: '× ÷ TABLES TO', y: 106, items: items(MUL_RANGES.map(String), 26), select: true, on: (i) => s.mulR === MUL_RANGES[i], act: (i) => (s.mulR = MUL_RANGES[i]) },
      { label: 'PACE', y: 126, items: items(PACES.map((p) => p.toUpperCase()), 37, 2), select: true, on: (i) => s.pace === PACES[i], act: (i) => (s.pace = PACES[i]) },
      { label: 'START', y: 156, items: [{ text: 'START', x: LEFT.x + LEFT.w / 2 - 36, w: 72 }], select: false, on: () => true, act: () => this.begin() },
      {
        label: 'SHOW', y: RIGHT.y + 6, items: OPS.map((o, i) => ({ text: SIGN[o], x: RIGHT.x + 112 + i * 18, w: 14 })), select: true,
        on: (i) => this.gridOp === OPS[i], act: (i) => s.ops.includes(OPS[i]) && (this.gridOp = OPS[i]),
      },
    ];
    // The START row's own label is the button; the grid tabs have none of their own.
    this.rows[4].label = '';
    this.rows[5].label = '';
  }

  private toggleOp(op: Op) {
    const s = this.settings;
    if (s.ops.includes(op)) {
      if (s.ops.length === 1) {
        this.warnT = 1.6;
        return;
      }
      s.ops = s.ops.filter((o) => o !== op);
    } else s.ops = OPS.filter((o) => o === op || s.ops.includes(o));
    if (!s.ops.includes(this.gridOp)) this.gridOp = s.ops[0];
  }

  /** Activates item `i` of row `r`, then saves and redraws. */
  private activate(r: number, i: number) {
    this.focus = r;
    this.cursor = i;
    this.rows[r].act(i);
    this.sfx.choose();
    if (this.leaving) return;
    saveSettings(this.settings);
    this.refresh();
  }

  private click(x: number, y: number) {
    this.rows.forEach((r, ri) =>
      r.items.forEach((it, i) => {
        if (x >= it.x - 1 && x < it.x + it.w + 1 && y >= r.y - 1 && y < r.y + (ri === 4 ? 16 : 12) + 1) this.activate(ri, i);
      }),
    );
  }

  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    this.clock += dt;
    this.backdrop.update(dt);
    this.warnT = Math.max(0, this.warnT - dt);
    const input = this.controls.read(dt);
    touchPad.update({ show: false, clap: false, locked: false });
    // Enter (or Start on a controller) begins from anywhere; Space or A changes the focused setting (or starts, on START).
    const padA = input.confirm && input.device === 'pad' && !input.pause;
    if (input.confirm && !padA) this.begin();
    else if (padA || input.clap) this.activate(this.focus, this.cursor);
    if (input.navY || (input.navX && !this.rows[this.focus].select)) this.sfx.step();
    if (input.navY) {
      this.focus = (this.focus + input.navY + this.rows.length) % this.rows.length;
      const r = this.rows[this.focus];
      // Land on the chosen item of a select row, or the first item otherwise.
      this.cursor = r.select ? Math.max(0, r.items.findIndex((_, i) => r.on(i))) : Math.min(this.cursor, r.items.length - 1);
      this.refresh();
    }
    if (input.navX) {
      const r = this.rows[this.focus];
      this.cursor = Phaser.Math.Clamp(this.cursor + input.navX, 0, r.items.length - 1);
      if (r.select) this.activate(this.focus, this.cursor);
      else this.refresh();
    }
    this.warn.setVisible(this.warnT > 0);
    this.hint.setVisible(this.warnT <= 0).setText(
      input.device === 'pad' ? 'D-PAD MOVES   A CHANGES   START BEGINS' : input.device === 'touch' ? 'TAP A SETTING TO CHANGE IT' : 'ARROWS MOVE   SPACE CHANGES   ENTER STARTS',
    );
    const pad = this.input.gamepad?.total ? this.input.gamepad.getPad(0) : null;
    this.padStatus.setText(pad ? 'CONTROLLER CONNECTED' : 'USING A CONTROLLER? PRESS ANY BUTTON ON IT').setColor(pad ? TEXT.ice : TEXT.dim);
    // The START button breathes.
    const start = this.texts.find((t) => t.text === 'START');
    if (!REDUCED) start?.setAlpha(this.clock % 1 < 0.6 ? 1 : 0.6);
  }

  /** Redraws the panels, the options (chosen ones filled, the focused one outlined and marked), and the grid. */
  private refresh() {
    const g = this.ui.clear();
    for (const p of [LEFT, RIGHT]) g.fillStyle(COLORS.panel, 0.82).fillRect(p.x, p.y, p.w, p.h).lineStyle(1, COLORS.line, 1).strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
    this.rows.forEach((r, ri) => {
      const h = ri === 4 ? 16 : 12;
      r.items.forEach((it, i) => {
        const on = r.on(i), focused = ri === this.focus && i === this.cursor;
        // Chosen: a filled white box with dark ink. Not chosen: an outline. Focused: a thick bright frame and a caret.
        if (on) g.fillStyle(COLORS.plate, 1).fillRect(it.x, r.y, it.w, h);
        else g.lineStyle(1, COLORS.dim, 1).strokeRect(it.x + 0.5, r.y + 0.5, it.w - 1, h - 1);
        if (focused) {
          g.lineStyle(2, COLORS.bolt, 1).strokeRect(it.x - 2, r.y - 2, it.w + 4, h + 4);
          g.fillStyle(COLORS.bolt, 1).fillTriangle(it.x - 7, r.y + h / 2 - 3, it.x - 7, r.y + h / 2 + 3, it.x - 4, r.y + h / 2);
        }
      });
    });
    for (const t of this.texts) {
      const it = t.getData('item') as Row['items'][number] | undefined;
      if (!it) continue;
      const ri = this.rows.findIndex((r) => r.items.includes(it));
      const on = this.rows[ri].on(this.rows[ri].items.indexOf(it));
      t.setColor(on ? TEXT.plateInk : TEXT.ink);
      // Tabs for operations that are switched off are faint.
      t.setAlpha(ri === 5 && !this.settings.ops.includes(OPS[this.rows[5].items.indexOf(it)]) ? 0.35 : 1);
    }
    // Range rows for operations that are all off are faint (they still keep their choice).
    const s = this.settings;
    this.texts.forEach((t) => {
      const it = t.getData('item') as Row['items'][number] | undefined;
      const ri = it ? this.rows.findIndex((r) => r.items.includes(it)) : -1;
      if (ri === 1) t.setAlpha(s.ops.includes('+') || s.ops.includes('-') ? 1 : 0.4);
      if (ri === 2) t.setAlpha(s.ops.includes('x') || s.ops.includes('/') ? 1 : 0.4);
    });
    this.note.setText(PACE_NOTE[s.pace]);
    this.drawGrid(g);
  }

  private drawGrid(g: Phaser.GameObjects.Graphics) {
    for (const t of this.gridTexts) t.destroy();
    this.gridTexts = [];
    const m = masteryFor(this.gridOp, this.settings, loadMemoryOnce());
    const text = (x: number, y: number, str: string, size = 5, color = TEXT.dim, align: 'left' | 'center' | 'right' = 'center') =>
      this.gridTexts.push(label(this, x, y, str, size, color, { align }).setDepth(6));
    if (m.kind === 'counts') {
      // Within 100: a bar per state.
      const bars: [string, number][] = [['NEW', m.fresh], ['MISSED', m.missed], ...m.boxes.map((n, i): [string, number] => [`BOX ${i}`, n])];
      const max = Math.max(1, ...bars.map((b) => b[1]));
      bars.forEach(([name, n], i) => {
        const y = GRID.y + 4 + i * 13;
        text(GRID.x + 26, y, name, 6, TEXT.dim, 'right');
        g.fillStyle(COLORS.ink, 1).fillRect(GRID.x + 30, y + 1, Math.max(1, Math.round((n / max) * 110)), 6);
        text(GRID.x + 144, y, String(n), 6, TEXT.ink, 'left');
      });
      return;
    }
    const n = Math.max(m.rows.length, m.cols.length);
    const step = Math.floor(GRID.size / n), size = step - 1;
    const x0 = GRID.x + 8, y0 = GRID.y + 6;
    m.cells.forEach((row, r) =>
      row.forEach((c, k) => {
        if (c) drawCell(g, x0 + k * step, y0 + r * step, size, c);
      }),
    );
    // Headings: every number up to 12, then 1 and every fifth.
    const every = n > 12 ? 5 : 1;
    m.cols.forEach((v, k) => (v % every === 0 || v === 1) && text(x0 + k * step + size / 2, y0 - 7, String(v)));
    m.rows.forEach((v, r) => (v % every === 0 || v === 1) && text(x0 - 2, y0 + r * step + size / 2 - 3, String(v), 5, TEXT.dim, 'right'));
    // The key: shape, not colour.
    const ky = RIGHT.y + RIGHT.h - 9;
    const key: [string, Cell][] = [['NEW', { key: '', seen: false }], ['LEARNING', { key: '', seen: true, box: 2, missed: false }], ['KNOWN', { key: '', seen: true, box: 4, missed: false }], ['MISSED', { key: '', seen: true, box: 0, missed: true }]];
    key.forEach(([name, c], i) => {
      const x = RIGHT.x + 8 + i * 46;
      drawCell(g, x, ky, 6, c);
      text(x + 9, ky, name, 5, TEXT.dim, 'left');
    });
  }

  private begin() {
    if (this.leaving) return;
    this.leaving = true;
    saveSettings(this.settings);
    this.registry.set('settings', this.settings);
    landscapeLock();
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('sky'));
  }
}

let memoryCache: ReturnType<typeof loadMemory> | undefined;
let memoryAt = 0;
/** The saved boxes, read at most once a second while the title redraws. */
function loadMemoryOnce() {
  if (!memoryCache || performance.now() - memoryAt > 1000) {
    memoryCache = loadMemory();
    memoryAt = performance.now();
  }
  return memoryCache;
}

/**
 * One fact's cell. Never met: a small dot. Met: an outlined square filled from the bottom by its box (empty in box 0,
 * full in box 4). Missed last time: a slash. Shape and fill height carry the meaning, never colour.
 */
function drawCell(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, c: Cell) {
  if (!c.seen) {
    g.fillStyle(COLORS.line, 1).fillRect(x + s / 2 - 1, y + s / 2 - 1, 2, 2);
    return;
  }
  g.lineStyle(1, 0x5b6798, 1).strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  if (c.missed) {
    g.lineStyle(1, COLORS.ink, 1).lineBetween(x + 1.5, y + s - 1.5, x + s - 1.5, y + 1.5);
    return;
  }
  const h = Math.round(((s - 2) * c.box) / 4);
  if (h > 0) g.fillStyle(COLORS.ink, 1).fillRect(x + 1, y + s - 1 - h, s - 2, h);
}

/**
 * On a phone, starting a run goes full screen and holds the screen sideways where the browser allows it (Android;
 * an iPhone ignores both, and the page asks you to turn it if it's upright).
 */
function landscapeLock() {
  if (!window.matchMedia?.('(pointer: coarse)').matches || document.fullscreenElement) return;
  const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  document.documentElement
    .requestFullscreen?.({ navigationUI: 'hide' })
    .then(() => orientation.lock?.('landscape'))
    .catch(() => {
      // Not allowed here: the rotate notice covers it.
    });
}
