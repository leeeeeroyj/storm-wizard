import Phaser from 'phaser';
import { ARC_DIGITS } from './config';

export type Device = 'kbm' | 'pad' | 'touch';

/** What happened since the last read. */
export interface Input {
  /** Digits typed, in order. */
  digits: string[];
  /** Backspaces pressed. */
  undo: number;
  mute: boolean;
  device: Device;
}

const DEADZONE = 0.55;
// Standard gamepad mapping (Xbox layout).
const BTN = { A: 0, B: 1, Y: 3, BACK: 8, START: 9, LEFT: 14, RIGHT: 15 } as const;

/**
 * Keyboard: the digit keys (top row or numpad), Backspace and M. Controller: the digit arc. Point the left stick at
 * a digit (or step with the D-pad), A enters it, B deletes, Back mutes. Key presses are kept until the next read, so
 * a tap shorter than a frame isn't lost. Construct one per scene.
 */
export class Controls {
  device: Device = window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'kbm';
  /** The digit the arc points at, 0..9 (an index into ARC_DIGITS: 1 to 9, then 0). Starts on 5. */
  arc = 4;
  private queue: string[] = [];
  private prevButtons = new Set<number>();
  private repeat = 0;

  constructor(private readonly scene: Phaser.Scene) {
    scene.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key) || e.key === 'Backspace' || e.code === 'KeyM') {
        e.preventDefault();
        this.queue.push(e.key === 'Backspace' ? 'undo' : e.code === 'KeyM' ? 'mute' : e.key);
      }
    });
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => (this.device = p.wasTouch ? 'touch' : 'kbm'));
  }

  private pad(): Phaser.Input.Gamepad.Gamepad | undefined {
    const pad = this.scene.input.gamepad?.pad1;
    return pad && pad.connected ? pad : undefined;
  }

  read(dt: number): Input {
    const out: Input = { digits: [], undo: 0, mute: false, device: this.device };
    for (const k of this.queue) {
      if (k === 'undo') out.undo++;
      else if (k === 'mute') out.mute = true;
      else out.digits.push(k);
    }
    if (this.queue.length) this.device = 'kbm';
    this.queue = [];

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
      // The D-pad steps along the arc, repeating while held.
      this.repeat -= dt;
      for (const [btn, step] of [[BTN.LEFT, -1], [BTN.RIGHT, 1]] as const) {
        if (edge(btn) || (down.has(btn) && this.repeat <= 0)) {
          this.arc = Phaser.Math.Clamp(this.arc + step, 0, 9);
          this.repeat = edge(btn) ? 0.35 : 0.12;
        }
      }
      if (edge(BTN.A)) out.digits.push(ARC_DIGITS[this.arc]);
      if (edge(BTN.B)) out.undo++;
      if (edge(BTN.BACK)) out.mute = true;
    }
    this.prevButtons = down;
    out.device = this.device;
    return out;
  }
}
