import { PACE, type Pace } from './config';

// The storm's waves. Pure: no Phaser, so tests import it directly.

export type Kind = 'hail' | 'cloud' | 'ball' | 'crow';

export interface WaveDef {
  wave: number;
  /** Stones in the wave (the crow is extra). */
  count: number;
  /** The most falling at once. */
  cap: number;
  /** Seconds for a stone to fall from the cloud deck to the ground. */
  fall: number;
  /** Seconds between spawns, before a ±30% jitter. */
  gap: number;
  /** The crow appears once this many stones have spawned (-1: no crow this wave). */
  crowAt: number;
}

export function waveDef(wave: number, pace: Pace): WaveDef {
  const p = PACE[pace];
  const count = 6 + 2 * wave;
  return {
    wave,
    count,
    cap: Math.min(p.cap, 2 + Math.floor(wave / 2)),
    fall: p.fall / (1 + 0.06 * (wave - 1)),
    gap: Math.max(1.2, 3.2 - 0.2 * wave) * p.gap,
    crowAt: wave >= 2 ? Math.floor(count / 2) : -1,
  };
}

/** The `n`th stone of a wave: split clouds from wave 2, ball lightning from wave 3. */
export function kindFor(wave: number, n: number): Exclude<Kind, 'crow'> {
  if (wave >= 3 && n % 5 === 4) return 'ball';
  if (wave >= 2 && n % 4 === 3) return 'cloud';
  return 'hail';
}

/** The wave-clear bonus: 100 for each standing cottage, times the streak multiplier. */
export const waveBonus = (standing: number, mult: number) => standing * 100 * mult;

/** Every 10,000 points rebuilds a cottage. True if going from `before` to `after` crosses a mark. */
export const REBUILD_EVERY = 10000;
export const crossesRebuild = (before: number, after: number) => Math.floor(after / REBUILD_EVERY) > Math.floor(before / REBUILD_EVERY);
