import { hz } from './sfx';
import type { Synth } from './synth';
import { BPM, notesAt, STEPS_PER_BAR, type Inst, type TuneState } from './tune';

// A lookahead sequencer on the audio clock: a 25 ms timer schedules every note 120 ms ahead, so timing never depends
// on the frame rate. `tune.ts` says what plays; this voices it.

const LOOKAHEAD = 0.12;
const VOLUME = 0.55;

export class Music {
  private step = 0;
  private next = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  /** Holds the music (pause, game over). */
  held = false;
  /** What the game wants now. `danger` takes effect at the next bar line. */
  readonly state: TuneState = { lead: false, danger: false, band: 0 };
  private latchedDanger = false;
  private readonly stepSecs: number;

  constructor(private readonly synth: Synth, mode: 'game' | 'title' = 'game') {
    this.stepSecs = 60 / BPM[mode] / 2;
    // The title theme is the flute line over the calm layer, slower.
    if (mode === 'title') this.state.lead = true;
  }

  start() {
    this.stop();
    this.step = 0;
    this.next = 0;
    this.timer = setInterval(() => this.tick(), 25);
  }

  stop() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Notes scheduled so far, for tests. */
  get steps() {
    return this.step;
  }

  private tick() {
    const s = this.synth;
    // Locked, suspended or held: keep the clock just ahead, so it resumes cleanly.
    if (!s.running || this.held) {
      this.next = 0;
      return;
    }
    if (this.next < s.now) this.next = s.now + 0.05;
    while (this.next < s.now + LOOKAHEAD) {
      if (this.step % STEPS_PER_BAR === 0) this.latchedDanger = this.state.danger;
      for (const n of notesAt(this.step, { ...this.state, danger: this.latchedDanger })) this.voice(n.inst, n.midi, n.steps * this.stepSecs, this.next);
      this.step++;
      this.next += this.stepSecs;
    }
  }

  private voice(inst: Inst, m: number, dur: number, t: number) {
    const s = this.synth, v = VOLUME, f = hz(m);
    switch (inst) {
      case 'pad':
        for (const d of [0.997, 1.003]) s.voice('sawtooth', f * d, f * d, dur, 0.012 * v, t, { attack: 0.4, cutoff: [900, 500] });
        break;
      case 'arp':
        s.voice('triangle', f, f, 0.7, 0.05 * v, t, { cutoff: [3500, 800] });
        s.voice('sine', f * 2, f * 2, 0.35, 0.017 * v, t);
        break;
      case 'bass':
        s.voice('triangle', f, f, dur, 0.1 * v, t);
        break;
      case 'flute':
        s.voice('sine', f, f, dur * 0.95, 0.05 * v, t, { attack: 0.06, vibrato: 12 });
        break;
      case 'kick':
        s.voice('sine', 130, 45, 0.22, 0.3 * v, t);
        break;
      case 'snare':
        s.noise(0.08 * v, 0.12, 'bandpass', 1800, t);
        break;
      case 'hat':
        s.hat(0.025 * v, t, 0.03);
        break;
      case 'rumble':
        s.noise(0.05 * v, dur, 'lowpass', 120, t);
        break;
    }
  }
}
