import { ATTRACT } from './attract';
import { PACE, type Pace } from './config';
import { DEFAULT_SETTINGS, type Box, type Op, type Settings } from './facts';

// What this browser remembers: the Leitner box for every fact met, and the settings. Both are versioned and checked
// field by field on load, so a damaged or foreign value is dropped rather than trusted. Storage can be blocked, so
// every access is in try/catch, and attract mode reads and writes neither.

const FACTS_KEY = 'storm-wizard-facts';
const SETTINGS_KEY = 'storm-wizard-settings';
const VERSION = 1;
const FACT_KEY = /^\d{1,3}[+\-x/]\d{1,3}$/;
const OPS: readonly Op[] = ['+', '-', 'x', '/'];

function read(key: string): unknown {
  if (ATTRACT) return undefined;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown) {
  if (ATTRACT) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Blocked or full: this visit just won't be remembered.
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The saved boxes: `{ v: 1, facts: { "7x8": [box, missed] } }`. Anything malformed is skipped. */
export function loadMemory(): Map<string, Box> {
  const out = new Map<string, Box>();
  const data = read(FACTS_KEY);
  if (!isObj(data) || data.v !== VERSION || !isObj(data.facts)) return out;
  for (const [key, val] of Object.entries(data.facts)) {
    if (!FACT_KEY.test(key) || !Array.isArray(val) || val.length !== 2) continue;
    const [box, missed] = val;
    if (!Number.isInteger(box) || box < 0 || box > 4 || (missed !== 0 && missed !== 1)) continue;
    out.set(key, { box, missed: missed === 1 });
  }
  return out;
}

export function saveMemory(memory: ReadonlyMap<string, Box>) {
  const facts: Record<string, [number, number]> = {};
  for (const [key, m] of memory) facts[key] = [m.box, m.missed ? 1 : 0];
  write(FACTS_KEY, { v: VERSION, facts });
}

/** Forgets every fact (the title screen's "start fresh"). */
export function clearMemory() {
  write(FACTS_KEY, { v: VERSION, facts: {} });
}

export function loadSettings(): Settings {
  const data = read(SETTINGS_KEY);
  const d = DEFAULT_SETTINGS;
  if (!isObj(data) || data.v !== VERSION) return { ...d, ops: [...d.ops] };
  const ops = Array.isArray(data.ops) ? OPS.filter((op) => (data.ops as unknown[]).includes(op)) : [];
  return {
    ops: ops.length ? ops : [...d.ops],
    addR: data.addR === 10 || data.addR === 20 || data.addR === 100 ? data.addR : d.addR,
    mulR: data.mulR === 5 || data.mulR === 10 || data.mulR === 12 ? data.mulR : d.mulR,
    pace: typeof data.pace === 'string' && data.pace in PACE ? (data.pace as Pace) : d.pace,
  };
}

export function saveSettings(s: Settings) {
  write(SETTINGS_KEY, { v: VERSION, ...s });
}
