import type { Synth } from './synth';

/** MIDI note to Hz. */
export const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
/** A degree of D Dorian above `base` (a MIDI D), wrapping into higher octaves. */
export const deg = (d: number, base = 62) => base + DORIAN[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);

/**
 * The game's sound effects, all in D Dorian so they sit with the music, and all played at once: answers must feel
 * instant, so nothing waits for the beat.
 */
export class Sfx {
  constructor(private readonly synth: Synth) {}

  /** A harp-like pluck: a triangle with a soft octave above. */
  pluck(m: number, vol: number, dur = 0.4, when?: number) {
    this.synth.voice('triangle', hz(m), hz(m), dur, vol, when, { cutoff: [4000, 900] });
    this.synth.voice('sine', hz(m + 12), hz(m + 12), dur * 0.5, vol * 0.35, when);
  }

  /** Each digit is a scale degree, so typing 56 plays a little two-note figure. */
  digit(d: number) {
    this.pluck(deg(d === 0 ? 7 : d - 1, 74), 0.06, 0.18);
  }

  undo() {
    this.synth.voice('sine', 600, 400, 0.06, 0.04);
  }

  /** A correct answer: a rising pair that climbs with the streak. */
  correct(streak: number) {
    const t = this.synth.now;
    const d = 4 + Math.min(streak, 10);
    this.pluck(deg(d), 0.12, 0.4, t);
    this.pluck(deg(d + 2), 0.1, 0.5, t + 0.06);
    // The wand's twinkle: a high glint.
    this.synth.voice('sine', hz(deg(d + 9)), hz(deg(d + 9)), 0.12, 0.03, t);
  }

  /** One answer struck two or more stones: a quick run. */
  double() {
    const t = this.synth.now;
    for (let i = 0; i < 4; i++) this.pluck(deg(4 + i * 2), 0.1, 0.5, t + i * 0.05);
  }

  /** A misfire: a detuned square fizz, falling. */
  misfire() {
    this.synth.voice('square', 320, 170, 0.2, 0.04, undefined, { cutoff: [2400, 600] });
    this.synth.voice('square', 331, 176, 0.2, 0.04, undefined, { cutoff: [2400, 600] });
    this.synth.noise(0.05, 0.12, 'bandpass', 2500);
  }

  /** A bolt bursting into a blast. */
  blast() {
    this.synth.noise(0.12, 0.25, 'lowpass', 900);
    this.synth.voice('square', 1400, 300, 0.05, 0.03);
  }

  /** A stone hitting the islands. `lost` when a cottage is flattened. */
  land(lost = false) {
    this.synth.noise(lost ? 0.28 : 0.2, lost ? 0.8 : 0.4, 'lowpass', lost ? 250 : 300);
    this.synth.voice('sine', lost ? 90 : 110, lost ? 30 : 40, lost ? 0.7 : 0.35, lost ? 0.3 : 0.25);
    if (lost) this.synth.voice('triangle', hz(50), hz(49), 0.8, 0.1);
  }

  /** The storm wins: a falling phrase. */
  over() {
    const t = this.synth.now;
    [57, 55, 53, 50].forEach((m, i) => this.pluck(m, 0.12, 0.9, t + i * 0.22));
  }
}
