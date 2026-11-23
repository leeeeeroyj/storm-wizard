import type { Box, Op, Settings } from './facts';
import { factsFor } from './facts';

// The mastery grid: what this browser has learned, one cell per fact. Pure: tests import it directly.

/** A cell's state: never met, its box (0–4), or missed last time. */
export type Cell = { key: string; seen: false } | { key: string; seen: true; box: number; missed: boolean };

export interface Grid {
  kind: 'grid';
  /** Row and column headings, top to bottom and left to right. */
  rows: number[];
  cols: number[];
  /** cells[r][c], or null where no fact exists (8 + 15 within 20). */
  cells: (Cell | null)[][];
}

/** Within 100 there are too many facts for a grid: counts of facts never met and in each box instead. */
export interface Counts {
  kind: 'counts';
  fresh: number;
  boxes: number[];
  missed: number;
}

const cell = (key: string, memory: ReadonlyMap<string, Box>): Cell => {
  const m = memory.get(key);
  return m ? { key, seen: true, box: m.box, missed: m.missed } : { key, seen: false };
};

/**
 * × by row × column, and ÷ by the same factor pair (row × column ÷ row). + and − within 10 or 20 as a grid of first
 * by second number; within 100 as counts.
 */
export function masteryFor(op: Op, s: Settings, memory: ReadonlyMap<string, Box>): Grid | Counts {
  if ((op === '+' || op === '-') && s.addR > 20) {
    const out: Counts = { kind: 'counts', fresh: 0, boxes: [0, 0, 0, 0, 0], missed: 0 };
    for (const f of factsFor(op, s.addR, s.mulR)) {
      const m = memory.get(f.key);
      if (!m) out.fresh++;
      else if (m.missed) out.missed++;
      else out.boxes[m.box]++;
    }
    return out;
  }
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  if (op === 'x' || op === '/') {
    const n = range(1, s.mulR);
    return { kind: 'grid', rows: n, cols: n, cells: n.map((a) => n.map((b) => cell(op === 'x' ? `${a}x${b}` : `${a * b}/${a}`, memory))) };
  }
  if (op === '+') {
    const n = range(1, s.addR - 1);
    return { kind: 'grid', rows: n, cols: n, cells: n.map((a) => n.map((b) => (a + b <= s.addR ? cell(`${a}+${b}`, memory) : null))) };
  }
  const rows = range(1, s.addR);
  return { kind: 'grid', rows, cols: rows, cells: rows.map((a) => rows.map((b) => (b <= a ? cell(`${a}-${b}`, memory) : null))) };
}
