import Phaser from 'phaser';

/** D Dorian: scale degree to semitones. */
export const DORIAN = [0, 2, 3, 5, 7, 9, 10];
export const mod = (a: number, n: number) => ((a % n) + n) % n;
/** A scale degree above `base` Hz, wrapping into higher (or lower) octaves. */
export const noteHz = (deg: number, base = 220, scale: readonly number[] = DORIAN) =>
  base * 2 ** ((scale[mod(deg, scale.length)] + 12 * Math.floor(deg / scale.length)) / 12);

const MUTE_STORAGE = 'storm-wizard-muted';
let noise: AudioBuffer | undefined;
/** One limiter per audio context, shared by every scene's synth, so a busy moment can't clip. */
const buses = new WeakMap<BaseAudioContext, AudioNode>();

/** How a voice is shaped: a linear attack, then an exponential fall to silence over the rest of `dur`. */
export interface VoiceOptions {
  /** Seconds to rise to full volume (default: instant). */
  attack?: number;
  /** A low-pass filter sweeping from the first cutoff to the second over the note (Hz), for plucks and swells. */
  cutoff?: [number, number];
  /** The filter's resonance. */
  q?: number;
  /** Vibrato depth in cents (a slow wobble for bowed notes). */
  vibrato?: number;
}

/**
 * Oscillator voices on Phaser's own audio context, through a shared limiter into its mute node, so M and the
 * speaker icon silence everything. Times are absolute, on the audio clock (`now`); leaving one out means now.
 * Without Web Audio (or before the first click or key press unlocks it) nothing plays.
 */
export class Synth {
  readonly ctx: AudioContext | undefined;
  private readonly out: AudioNode | undefined;

  constructor(scene: Phaser.Scene) {
    const sound = scene.sound;
    if (sound instanceof Phaser.Sound.WebAudioSoundManager) {
      this.ctx = sound.context;
      let bus = buses.get(this.ctx);
      if (!bus) {
        const limit = this.ctx.createDynamicsCompressor();
        limit.threshold.value = -10;
        limit.knee.value = 6;
        limit.ratio.value = 8;
        limit.attack.value = 0.003;
        limit.release.value = 0.15;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.9;
        limit.connect(gain).connect(sound.destination);
        buses.set(this.ctx, (bus = limit));
      }
      this.out = bus;
    }
  }

  /** The audio clock is running (unlocked and not suspended), muted or not. The music follows it. */
  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Running and not muted: sounds will be heard. */
  get live() {
    return this.running && !muted;
  }

  /** The audio clock, s. */
  get now() {
    return this.ctx?.currentTime ?? 0;
  }

  private at(t: number | undefined) {
    return Math.max(this.ctx!.currentTime, t ?? 0);
  }

  /** One enveloped oscillator note at audio time `when`, bending from f0 to f1 Hz. */
  voice(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, when?: number, opts: VoiceOptions = {}) {
    if (!this.live) return;
    const ctx = this.ctx!;
    const t = this.at(when);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const attack = Math.min(opts.attack ?? 0, dur * 0.9);
    if (attack > 0) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
    } else g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let head: AudioNode = o;
    if (opts.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = opts.q ?? 1;
      f.frequency.setValueAtTime(opts.cutoff[0], t);
      f.frequency.exponentialRampToValueAtTime(opts.cutoff[1], t + dur);
      head = head.connect(f);
    }
    if (opts.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.value = opts.vibrato;
      lfo.connect(depth).connect(o.detune);
      lfo.start(t);
      lfo.stop(t + dur + 0.02);
    }
    head.connect(g).connect(this.out!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** A burst of filtered noise: hats, snares, thunder and fizzles. */
  noise(vol: number, dur: number, filter: BiquadFilterType, freq: number, when?: number, q = 1, sweepTo?: number) {
    if (!this.live) return;
    const ctx = this.ctx!;
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = this.at(when);
    const s = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    s.buffer = noise;
    s.loop = dur > 0.9;
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out!);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  /** A closed hi-hat. */
  hat(vol: number, when?: number, dur = 0.05) {
    this.noise(vol, dur, 'highpass', 7000, when);
  }

  /** A held tone you bend and stop yourself. */
  drone(type: OscillatorType, freq: number, vol: number) {
    if (!this.live) return undefined;
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g).connect(this.out!);
    o.start();
    return o;
  }
}

/** Sound starts on unless it was switched off last visit. */
/**
 * Whether sound is off. Kept here rather than read back from `sound.mute`: Phaser applies that through a gain that
 * only updates on the audio thread, so reading it straight after setting it gives the old value.
 */
let muted = false;
export const isMuted = () => muted;

export function restoreMute(scene: Phaser.Scene) {
  try {
    muted = localStorage.getItem(MUTE_STORAGE) === '1';
  } catch {
    // Storage blocked: sound stays on.
  }
  scene.sound.mute = muted;
}

export function toggleMute(scene: Phaser.Scene) {
  muted = !muted;
  scene.sound.mute = muted;
  try {
    localStorage.setItem(MUTE_STORAGE, muted ? '1' : '0');
  } catch {
    // Storage blocked: the setting lasts for this visit only.
  }
  return muted;
}
