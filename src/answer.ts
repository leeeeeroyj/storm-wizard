// The answer box's rules. Pure: tests import it directly.

export type Typed =
  /** The box equals a live answer: strike every stone with it. */
  | { kind: 'match'; answer: string }
  /** Still on the way to a live answer. */
  | { kind: 'partial' }
  /** Can't lead to any live answer: the box clears and the streak resets. */
  | { kind: 'misfire'; typed: string };

/** True when `buffer` is the start of (or equal to) some live answer. */
export const leads = (buffer: string, lives: readonly string[]) => lives.some((a) => a.startsWith(buffer));

/** Adds a digit to the box and says what happens. The new box is empty after a match or a misfire. */
export function typeDigit(buffer: string, digit: string, lives: readonly string[]): { buffer: string; typed: Typed } {
  const next = buffer + digit;
  if (lives.includes(next)) return { buffer: '', typed: { kind: 'match', answer: next } };
  if (leads(next, lives)) return { buffer: next, typed: { kind: 'partial' } };
  return { buffer: '', typed: { kind: 'misfire', typed: next } };
}

/** When a stone leaves the sky, a typed prefix that no longer leads anywhere clears silently (no penalty). */
export const staleClear = (buffer: string, lives: readonly string[]) => (buffer && !leads(buffer, lives) ? '' : buffer);
