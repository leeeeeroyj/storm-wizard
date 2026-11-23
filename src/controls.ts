import Phaser from 'phaser';
import { ARC_DIGITS } from './config';
import { touchPad } from './touch';

export type Device = 'kbm' | 'pad' | 'touch';

/** What happened since the last read. Every field is an edge: it's set once per press. */
export interface Input {
  /** Digits typed, in order (a controller's A enters the arc's digit). */
  digits: string[];
  /** Backspaces pressed (B on a controller). */
  undo: number;
  /** Space, or Y on a controller: the Thunderclap in play, and "change this" on the title screen. */
  clap: boolean;
  /** Enter, or A or Start on a controller: start, retry, resume. */
  confirm: boolean;
  /** Escape, or B on a controller: leave a panel. */
  back: boolean;
  /** P or Escape on the keyboard, Start on a controller. */
  pause: boolean;
  mute: boolean;
  /** Menu steps from the arrow keys, the D-pad or a flick of the stick: -1, 0 or 1. */
  navX: number;
  navY: number;
  device: Device;
}

const DEADZONE = 0.55;
// Standard gamepad mapping (Xbox layout).
const BTN = { A: 0, B: 1, Y: 3, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;
const KEYS: Record<string, string> = {
  Backspace: 'undo', Space: 'clap', Enter: 'confirm', NumpadEnter: 'confirm', Escape: 'escape', KeyP: 'pause', KeyM: 'mute',
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
};

/**
 * Keyboard: the digit keys (top row or numpad), Backspace, Space (Thunderclap), Enter, Escape, P, M and the arrows.
 * Controller: the digit arc. Point the left stick at a digit (or step with the D-pad), A enters it, B deletes, Y
 * claps, Start pauses, Back mutes. Touch: the number keys beside or below the game (`touch.ts`). Key presses are kept until the next read, so a tap shorter than a frame isn't
 * lost. Construct one per scene.
 */
export class Controls {
  device: Device = window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'kbm';
  /** The digit the arc points at, 0..9 (an index into ARC_DIGITS: 1 to 9, then 0). Starts on 5. */
  arc = 4;
  private queue: string[] = [];
  private prevButtons = new Set<number>();
  private prevStick = { x: 0, y: 0 };
  private repeat = 0;

  constructor(private readonly scene: Phaser.Scene) {
    scene.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = /^[0-9]$/.test(e.key) ? e.key : KEYS[e.code];
      if (!k) return;
      e.preventDefault();
      this.queue.push(k);
    });
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => (this.device = p.wasTouch ? 'touch' : 'kbm'));
  }

  private pad(): Phaser.Input.Gamepad.Gamepad | undefined {
    const pad = this.scene.input.gamepad?.pad1;
    return pad && pad.connected ? pad : undefined;
  }

  read(dt: number): Input {
    const out: Input = { digits: [], undo: 0, clap: false, confirm: false, back: false, pause: false, mute: false, navX: 0, navY: 0, device: this.device };
    for (const k of this.queue) {
      if (k === 'undo') out.undo++;
      else if (k === 'clap') out.clap = true;
      else if (k === 'confirm') out.confirm = true;
      // Escape backs out of a panel, and pauses the game when there's no panel to leave.
      else if (k === 'escape') out.back = out.pause = true;
      else if (k === 'pause') out.pause = true;
      else if (k === 'mute') out.mute = true;
      else if (k === 'left' || k === 'right') out.navX = k === 'left' ? -1 : 1;
      else if (k === 'up' || k === 'down') out.navY = k === 'up' ? -1 : 1;
      else out.digits.push(k);
    }
    if (this.queue.length) this.device = 'kbm';
    this.queue = [];
    // The touch number keys.
    const touched = touchPad.take();
    for (const k of touched) {
      if (k === 'undo') out.undo++;
      else if (k === 'clap') out.clap = true;
      else out.digits.push(k);
    }
    if (touched.length) this.device = 'touch';

    const pad = this.pad();
    const down = new Set(pad ? pad.buttons.filter((b) => b.pressed).map((b) => b.index) : []);
    const edge = (i: number) => down.has(i) && !this.prevButtons.has(i);
    if (pad) {
      const x = pad.leftStick.x, y = pad.leftStick.y;
      if (down.size || Math.hypot(x, y) > DEADZONE) this.device = 'pad';
      if (Math.hypot(x, y) > DEADZONE) {
        // 0 is right, π is left; the arc opens upwards, so a stick pushed down still picks the nearer end.
        const ang = Math.atan2(-Math.min(y, 0.25), x);
        this.arc = Phaser.Math.Clamp(Math.round(((Math.PI - Phaser.Math.Clamp(ang, 0, Math.PI)) / Math.PI) * 9), 0, 9);
      }
      // A flick of the stick is one menu step.
      const sx = Math.abs(x) > DEADZONE ? Math.sign(x) : 0, sy = Math.abs(y) > DEADZONE ? Math.sign(y) : 0;
      if (sx && sx !== this.prevStick.x) out.navX = sx;
      if (sy && sy !== this.prevStick.y) out.navY = sy;
      this.prevStick = { x: sx, y: sy };
      // The D-pad steps along the arc, repeating while held, and steps through menus.
      this.repeat -= dt;
      for (const [btn, step] of [[BTN.LEFT, -1], [BTN.RIGHT, 1]] as const) {
        if (edge(btn)) out.navX = step;
        if (edge(btn) || (down.has(btn) && this.repeat <= 0)) {
          this.arc = Phaser.Math.Clamp(this.arc + step, 0, 9);
          this.repeat = edge(btn) ? 0.35 : 0.12;
        }
      }
      if (edge(BTN.UP)) out.navY = -1;
      if (edge(BTN.DOWN)) out.navY = 1;
      if (edge(BTN.A)) {
        out.digits.push(ARC_DIGITS[this.arc]);
        out.confirm = true;
      }
      if (edge(BTN.B)) {
        out.undo++;
        out.back = true;
      }
      if (edge(BTN.Y)) out.clap = true;
      if (edge(BTN.START)) out.pause = out.confirm = true;
      if (edge(BTN.BACK)) out.mute = true;
    }
    this.prevButtons = down;
    out.device = this.device;
    return out;
  }
}
