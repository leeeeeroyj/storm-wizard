import { hz } from './sfx';
import type { Synth } from './synth';

// A lookahead sequencer on the audio clock: a 25 ms timer schedules every note 120 ms ahead, so timing never depends
// on the frame rate. Milestone 2's calm layer: harp arpeggios over Dm–G–C–Am, a soft pad and a triangle bass.

const BPM = 110;
/** One step is an eighth note. */
const STEP = 60 / BPM / 2;
const LOOKAHEAD = 0.12;
/** Dm, G, C, Am: [bass, three chord tones]. The G's B natural is the Dorian colour. */
const CHORDS = [[38, 62, 65, 69], [43, 55, 59, 62], [36, 60, 64, 67], [45, 57, 60, 64]];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
const VOLUME = 0.55;

export class Music {
  private step = 0;
  private next = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  /** Holds the music (pause, game over). */
  held = false;

  constructor(private readonly synth: Synth) {}

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

  private tick() {
    const s = this.synth;
    // Locked, suspended or held: keep the clock just ahead, so it resumes cleanly.
    if (!s.running || this.held) {
      this.next = 0;
      return;
    }
    if (this.next < s.now) this.next = s.now + 0.05;
    while (this.next < s.now + LOOKAHEAD) {
      this.schedule(this.step++, this.next);
      this.next += STEP;
    }
  }

  private schedule(step: number, t: number) {
    const s = this.synth;
    const inBar = step % 8;
    const [bass, ...tones] = CHORDS[Math.floor(step / 8) % CHORDS.length];
    const v = VOLUME;
    if (inBar === 0) {
      for (const m of tones) {
        for (const detune of [0.997, 1.003]) s.voice('sawtooth', hz(m) * detune, hz(m) * detune, STEP * 8, 0.012 * v, t, { attack: 0.4, cutoff: [900, 500] });
      }
    }
    const arp = [...tones, tones[0] + 12];
    const m = arp[ARP[inBar]] + 12;
    s.voice('triangle', hz(m), hz(m), 0.7, 0.05 * v, t, { cutoff: [3500, 800] });
    s.voice('sine', hz(m + 12), hz(m + 12), 0.35, 0.017 * v, t);
    if (inBar === 0 || inBar === 4) s.voice('triangle', hz(bass), hz(bass), STEP * 3, 0.1 * v, t);
  }
}
