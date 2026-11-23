// The music, as notes per step. Pure: tests import it directly, and `music.ts` voices it on the audio clock.
//
// D Dorian, eighth-note steps, a four-bar loop of Dm–G–C–Am (the G's B natural is the Dorian colour):
// - calm: harp arpeggios, a soft pad and a triangle bass, always;
// - lead: an eight-bar flute line, from wave 2 (and always in the title theme);
// - danger: kick, snare, hats and a low rumble, switched on and off at bar lines while a stone is low;
// - a mood per wave band: waves 1–3 in D, 4–6 up a fourth (G Dorian), 7 and on in A Dorian with a busier arpeggio.

export type Inst = 'pad' | 'arp' | 'bass' | 'flute' | 'kick' | 'snare' | 'hat' | 'rumble';

export interface Note {
  inst: Inst;
  /** MIDI note (drums ignore it). */
  midi: number;
  /** Length in steps. */
  steps: number;
}

export interface TuneState {
  /** The flute lead plays. */
  lead: boolean;
  /** The drums and rumble play (read at bar lines only, so they come and go in time). */
  danger: boolean;
  /** 0: waves 1–3, 1: waves 4–6, 2: waves 7 and on. */
  band: number;
}

export const BPM = { game: 110, title: 92 };
export const STEPS_PER_BAR = 8;

/** [bass, three chord tones] for Dm, G, C, Am. */
const CHORDS = [[38, 62, 65, 69], [43, 55, 59, 62], [36, 60, 64, 67], [45, 57, 60, 64]];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
/** Band 2's arpeggio leaps an octave on the offbeats. */
const ARP_BUSY = [0, 3, 1, 3, 2, 3, 1, 3];
/** Semitones up for each band: D, then G (a fourth), then A (a fifth). */
const TRANSPOSE = [0, 5, 7];
/** The flute line: [midi or null for a rest, length in eighths]; each bar is eight. */
const MELODY: [number | null, number][][] = [
  [[69, 2], [74, 2], [72, 1], [69, 1], [65, 2]],
  [[67, 3], [71, 1], [74, 2], [71, 2]],
  [[72, 2], [76, 2], [74, 1], [72, 1], [67, 2]],
  [[69, 6], [null, 2]],
  [[74, 2], [77, 2], [76, 1], [74, 1], [69, 2]],
  [[71, 2], [74, 1], [71, 1], [67, 4]],
  [[76, 2], [72, 2], [74, 2], [76, 2]],
  [[74, 4], [null, 4]],
];

/** Everything that starts on `step`. `state.danger` should be the value latched at the bar line. */
export function notesAt(step: number, state: TuneState): Note[] {
  const out: Note[] = [];
  const inBar = step % STEPS_PER_BAR;
  const bar = Math.floor(step / STEPS_PER_BAR);
  const band = Math.max(0, Math.min(2, state.band));
  const t = TRANSPOSE[band];
  const [bass, ...tones] = CHORDS[bar % CHORDS.length].map((m) => m + t);
  if (inBar === 0) for (const m of tones) out.push({ inst: 'pad', midi: m, steps: STEPS_PER_BAR });
  const arp = [...tones, tones[0] + 12];
  out.push({ inst: 'arp', midi: arp[(band === 2 ? ARP_BUSY : ARP)[inBar]] + 12, steps: 1 });
  if (inBar === 0 || inBar === 4) out.push({ inst: 'bass', midi: bass, steps: 3 });
  if (state.lead) {
    let at = 0;
    for (const [m, len] of MELODY[bar % MELODY.length]) {
      if (at === inBar && m !== null) out.push({ inst: 'flute', midi: m + t, steps: len });
      at += len;
    }
  }
  if (state.danger) {
    if (inBar === 0 || inBar === 4) out.push({ inst: 'kick', midi: 0, steps: 1 });
    if (inBar === 2 || inBar === 6) out.push({ inst: 'snare', midi: 0, steps: 1 });
    out.push({ inst: 'hat', midi: 0, steps: 1 });
    if (inBar === 0) out.push({ inst: 'rumble', midi: 0, steps: STEPS_PER_BAR });
  }
  return out;
}

/** The band for a wave. */
export const bandFor = (wave: number) => (wave <= 3 ? 0 : wave <= 6 ? 1 : 2);
