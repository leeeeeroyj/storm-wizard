import { HEIGHT, WIDTH } from './config';

// The touch number keys, drawn as page elements so they can sit beside or below the game instead of over the sky.
// On a touch screen the game is fitted into what's left once the keys have their room, so nothing moves when the
// keys appear:
// - wide screens (phones held sideways): 1–5 and ⌫ down the left, 6–0 and ⚡ down the right;
// - squarer screens (tablets): one row along the bottom, 1–9, 0, ⌫ and ⚡.
// Whichever leaves the game bigger wins. A press is queued with the same names the keyboard uses ('0'–'9', 'undo',
// 'clap'), and `Controls` reads them.

export type Key = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0' | 'undo' | 'clap';
export type Mode = 'side' | 'bottom';
export interface Rect { x: number; y: number; w: number; h: number }
export interface Layout { mode: Mode; game: Rect; keys: Record<Key, Rect> }

const LEFT: Key[] = ['1', '2', '3', '4', '5', 'undo'];
const RIGHT: Key[] = ['6', '7', '8', '9', '0', 'clap'];
const ROW: Key[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'undo', 'clap'];
const LABEL: Partial<Record<Key, string>> = { undo: '⌫', clap: '⚡' };
const ARIA: Partial<Record<Key, string>> = { undo: 'Delete', clap: 'Thunderclap' };
/** Key sizes in CSS px: never under a thumb's width, never so big they crowd the game. */
const SIZE = { min: 56, max: 96 };
const GAP = 4;
const ASPECT = WIDTH / HEIGHT;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Where the game and every key go in a `w` × `h` CSS px window. Pure, for the tests. */
export function layoutFor(w: number, h: number): Layout {
  // Side columns: the bars beside the game, widened to a thumb if they're narrower.
  const col = clamp((w - h * ASPECT) / 2, SIZE.min, SIZE.max);
  const sideW = Math.min(w - 2 * col, h * ASPECT);
  // A bottom row: the room under the game, widened to a thumb, no taller than the keys are wide.
  const row = clamp(h - w / ASPECT, SIZE.min, Math.min(SIZE.max, w / ROW.length));
  const bottomH = Math.min(h - row, w / ASPECT);
  const side = sideW / ASPECT > bottomH;
  const keys = {} as Record<Key, Rect>;
  if (side) {
    const gw = sideW, gh = gw / ASPECT;
    const game = { x: (w - gw) / 2, y: (h - gh) / 2, w: gw, h: gh };
    const cw = Math.min(game.x, SIZE.max), kh = h / LEFT.length;
    LEFT.forEach((k, i) => (keys[k] = { x: game.x - cw + GAP, y: i * kh + GAP / 2, w: cw - GAP * 2, h: kh - GAP }));
    RIGHT.forEach((k, i) => (keys[k] = { x: game.x + gw + GAP, y: i * kh + GAP / 2, w: cw - GAP * 2, h: kh - GAP }));
    return { mode: 'side', game, keys };
  }
  const gh = bottomH, gw = gh * ASPECT;
  const game = { x: (w - gw) / 2, y: (h - row - gh) / 2, w: gw, h: gh };
  const kw = w / ROW.length;
  ROW.forEach((k, i) => (keys[k] = { x: i * kw + GAP / 2, y: h - row + GAP, w: kw - GAP, h: row - GAP * 2 }));
  return { mode: 'bottom', game, keys };
}

/** What the game wants the keys to show this frame. */
export interface PadState {
  /** In play: the keys are drawn. */
  show: boolean;
  /** The Thunderclap is ready (×4 or more). */
  clap: boolean;
  /** A misfire's lockout: the digits are dimmed. */
  locked: boolean;
}

class TouchPad {
  /** On: the layout keeps room for the keys. A touch screen starts on; any other turns on at its first touch. */
  on = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  private queue: string[] = [];
  private els: Map<Key, HTMLButtonElement> | undefined;
  private state: PadState = { show: false, clap: false, locked: false };
  private refresh: (() => void) | undefined;
  /** The last layout, for the tests. */
  current: Layout | undefined;

  constructor() {
    window.addEventListener('resize', () => this.place());
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && !this.on) {
        this.on = true;
        this.place();
      }
    });
  }

  /** Called once the game exists: `refresh` re-fits it after its box changes. */
  attach(refresh: () => void) {
    this.refresh = refresh;
    this.place();
  }

  /** Every key pressed since the last call. */
  take() {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  update(s: PadState) {
    const was = this.state;
    this.state = s;
    if (s.show !== was.show || s.clap !== was.clap || s.locked !== was.locked) this.paint();
  }

  /** Fits the game into the room the keys leave, and puts the keys in place. */
  private place() {
    const game = document.getElementById('game');
    if (!game) return;
    if (!this.on) {
      this.current = undefined;
      Object.assign(game.style, { position: '', left: '', top: '', width: '', height: '' });
      this.refresh?.();
      return this.paint();
    }
    const l = (this.current = layoutFor(window.innerWidth, window.innerHeight));
    Object.assign(game.style, { position: 'fixed', left: `${l.game.x}px`, top: `${l.game.y}px`, width: `${l.game.w}px`, height: `${l.game.h}px` });
    this.refresh?.();
    const els = (this.els ??= this.build());
    for (const [k, el] of els) {
      const r = l.keys[k];
      Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`, fontSize: `${Math.round(Math.min(r.w, r.h) * 0.46)}px` });
    }
    this.paint();
  }

  /** Shown or hidden, the Thunderclap ready or not, the digits locked or not. Shape and contrast, never hue alone. */
  private paint() {
    if (!this.els) return;
    const s = this.state, show = this.on && s.show;
    for (const [k, el] of this.els) {
      el.style.display = show ? 'flex' : 'none';
      if (k === 'clap') {
        el.style.opacity = s.clap ? '1' : '0.35';
        el.style.borderStyle = s.clap ? 'solid' : 'dashed';
        el.style.borderWidth = s.clap ? '4px' : '2px';
        el.setAttribute('aria-disabled', String(!s.clap));
      } else if (k !== 'undo') el.style.opacity = s.locked ? '0.4' : '1';
    }
  }

  private build() {
    const els = new Map<Key, HTMLButtonElement>();
    for (const k of ROW) {
      const el = document.createElement('button');
      el.type = 'button';
      el.tabIndex = -1;
      el.textContent = LABEL[k] ?? k;
      el.dataset.key = k;
      el.setAttribute('aria-label', ARIA[k] ?? k);
      Object.assign(el.style, {
        position: 'fixed', display: 'none', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', margin: '0', padding: '0',
        zIndex: '5', borderRadius: '10px', border: '2px solid rgba(237, 241, 255, 0.7)', background: 'rgba(40, 51, 97, 0.6)',
        color: '#edf1ff', font: '800 24px "Atkinson Hyperlegible Mono", monospace', touchAction: 'none', userSelect: 'none',
        webkitUserSelect: 'none', webkitTapHighlightColor: 'transparent', cursor: 'pointer',
      });
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.queue.push(k);
        // Pressed: the key turns over, light with dark ink, for a moment.
        el.style.background = '#edf1ff';
        el.style.color = '#0d1330';
        setTimeout(() => {
          el.style.background = 'rgba(40, 51, 97, 0.6)';
          el.style.color = '#edf1ff';
        }, 110);
      });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      document.body.append(el);
      els.set(k, el);
    }
    return els;
  }
}

export const touchPad = new TouchPad();
