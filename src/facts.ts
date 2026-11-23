import type { Pace } from './config';

// The facts the storm asks, and the picker that chooses the next one. Pure: no Phaser, so tests import it directly.

export type Op = '+' | '-' | 'x' | '/';
export const SIGN: Record<Op, string> = { '+': '+', '-': '−', x: '×', '/': '÷' };

export interface Fact {
  op: Op;
  a: number;
  b: number;
  ans: number;
  /** Unique per fact, e.g. `7x8`. */
  key: string;
  /** The answer as typed. */
  str: string;
  /** As shown on the plate, e.g. `7 × 8`. */
  label: string;
}

export interface Settings {
  ops: Op[];
  /** + and −: answers (and starting numbers) within 10, 20 or 100. */
  addR: 10 | 20 | 100;
  /** × and ÷: tables up to 5, 10 or 12. */
  mulR: 5 | 10 | 12;
  pace: Pace;
}

export const DEFAULT_SETTINGS: Settings = { ops: ['+', '-', 'x'], addR: 20, mulR: 10, pace: 'breeze' };

const fact = (op: Op, a: number, b: number, ans: number): Fact => ({ op, a, b, ans, key: `${a}${op}${b}`, str: String(ans), label: `${a} ${SIGN[op]} ${b}` });

/** Every fact for one operation and range. Subtraction never goes below 0, and division is always exact. */
export function factsFor(op: Op, addR: number, mulR: number): Fact[] {
  const out: Fact[] = [];
  if (op === '+' || op === '-') {
    // No zero operands (14 + 0 teaches nothing). Within 100, skip what the smaller ranges cover and the trivial +1.
    const big = addR > 20;
    for (let a = big ? 10 : 1; a <= addR; a++) {
      for (let b = big ? 2 : 1; b <= addR; b++) {
        if (op === '+' && a + b <= addR) out.push(fact(op, a, b, a + b));
        if (op === '-' && b <= a) out.push(fact(op, a, b, a - b));
      }
    }
  } else {
    for (let a = 1; a <= mulR; a++) {
      for (let b = 1; b <= mulR; b++) out.push(op === 'x' ? fact(op, a, b, a * b) : fact(op, a * b, a, b));
    }
  }
  return out;
}

/** The facts in play; `stretch` is one range up (the Storm Crow's problems). */
export function poolFor(s: Settings, stretch = false): Fact[] {
  const addR = stretch ? (s.addR === 10 ? 20 : 100) : s.addR;
  const mulR = stretch ? (s.mulR === 5 ? 10 : 12) : s.mulR;
  return s.ops.flatMap((op) => factsFor(op, addR, mulR));
}

/** True when `str` can share the sky with `lives`: equal is fine, but neither may be a strict prefix of the other. */
export const prefixSafe = (str: string, lives: readonly string[]) => lives.every((a) => a === str || (!a.startsWith(str) && !str.startsWith(a)));

/** A fact's Leitner box (0–4), and whether its last outing was a miss. */
export interface Box {
  box: number;
  missed: boolean;
}

/** Picking weight by box: new facts and recent misses come up most. */
export const WEIGHT = { new: 3, missed: 6, boxes: [6, 4, 2, 1, 0.4] } as const;

/**
 * Chooses each new problem: due misses first (2–4 spawns after they landed), otherwise a weighted pick, always
 * prefix-safe against the answers already in the sky and never a fact that's already falling.
 */
export class Picker {
  spawns = 0;
  private requeue: { fact: Fact; at: number }[] = [];
  /** The last three facts missed, newest first: the game-over panel's "facts to practise". */
  readonly missedRecent: Fact[] = [];

  constructor(
    private pool: Fact[],
    readonly memory: Map<string, Box>,
    private readonly rand: () => number,
  ) {}

  setPool(pool: Fact[]) {
    this.pool = pool;
  }

  weight(f: Fact) {
    const m = this.memory.get(f.key);
    if (!m) return WEIGHT.new;
    return m.missed ? WEIGHT.missed : WEIGHT.boxes[m.box];
  }

  /** The next fact, or null if nothing fits the sky right now (try again shortly). */
  pick(lives: readonly string[], liveKeys: ReadonlySet<string>, pool = this.pool): Fact | null {
    const fits = (f: Fact) => prefixSafe(f.str, lives) && !liveKeys.has(f.key);
    if (pool === this.pool) {
      const due = this.requeue.findIndex((r) => r.at <= this.spawns && fits(r.fact));
      if (due >= 0) return this.take(this.requeue.splice(due, 1)[0].fact);
    }
    for (let tries = 0; tries < 40; tries++) {
      // Sample four and keep the heaviest (jittered): cheap, and close enough to a true weighted draw.
      let best: Fact | null = null;
      let bestW = -1;
      for (let k = 0; k < 4; k++) {
        const f = pool[Math.floor(this.rand() * pool.length)];
        const w = this.weight(f) * (0.5 + this.rand());
        if (w > bestW) [best, bestW] = [f, w];
      }
      if (best && fits(best)) return this.take(best);
    }
    return null;
  }

  private take(f: Fact) {
    this.spawns++;
    return f;
  }

  /** Answered: up a box if quick, otherwise at least box 1. */
  credit(f: Fact, quick: boolean) {
    const m = this.memory.get(f.key) ?? { box: 0, missed: false };
    m.box = quick ? Math.min(4, m.box + 1) : Math.max(1, m.box);
    m.missed = false;
    this.memory.set(f.key, m);
  }

  /** Landed (or a split cloud burst): back to box 0, and it returns 2–4 spawns from now. */
  miss(f: Fact) {
    this.memory.set(f.key, { box: 0, missed: true });
    this.requeue = this.requeue.filter((r) => r.fact.key !== f.key);
    this.requeue.push({ fact: f, at: this.spawns + 2 + Math.floor(this.rand() * 3) });
    const i = this.missedRecent.findIndex((m) => m.key === f.key);
    if (i >= 0) this.missedRecent.splice(i, 1);
    this.missedRecent.unshift(f);
    this.missedRecent.length = Math.min(this.missedRecent.length, 3);
  }
}
