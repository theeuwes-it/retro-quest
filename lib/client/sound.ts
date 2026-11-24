// Tiny synthesized sound effects (Web Audio), so there are no audio assets to
// license. Off by default; each player toggles it for themselves.
import { loadFlag, saveFlag } from './storage';

type Sfx = 'reveal' | 'coin' | 'hit' | 'victory' | 'timer';

let ctx: AudioContext | null = null;
let enabled: boolean | null = null;
const listeners = new Set<(on: boolean) => void>();

export function soundEnabled(): boolean {
  if (enabled === null) enabled = loadFlag('sound', false);
  return enabled;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  saveFlag('sound', on);
  listeners.forEach((l) => l(on));
  if (on) play('coin');
}

export function onSoundChange(l: (on: boolean) => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(a: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'square', gain = 0.06) {
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime + start);
  g.gain.setValueAtTime(gain, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  osc.connect(g).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + dur + 0.02);
}

export function play(sfx: Sfx) {
  if (!soundEnabled()) return;
  const a = audio();
  if (!a) return;
  switch (sfx) {
    case 'reveal':
      [523, 659, 784, 1047].forEach((f, i) => tone(a, f, i * 0.07, 0.12));
      break;
    case 'coin':
      tone(a, 988, 0, 0.06);
      tone(a, 1319, 0.06, 0.18);
      break;
    case 'hit':
      tone(a, 140, 0, 0.18, 'sawtooth', 0.08);
      tone(a, 90, 0.05, 0.2, 'square', 0.06);
      break;
    case 'victory':
      [523, 523, 523, 698, 880, 784, 1047].forEach((f, i) => tone(a, f, i * 0.1, 0.16, 'square', 0.05));
      break;
    case 'timer':
      [880, 0, 880, 0, 880].forEach((f, i) => f && tone(a, f, i * 0.12, 0.1, 'triangle', 0.08));
      break;
  }
}
