type SoundName = 'send' | 'done' | 'error' | 'stop' | 'hold' | 'unlock';

const STORAGE_KEY = 'forge3.sound';

let context: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

const read_enabled = (): boolean => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'off') return false;
    if (stored === 'on') return true;
  } catch {
  }
  return true;
};

enabled = read_enabled();

export const soundEnabled = (): boolean => enabled;

export const setSoundEnabled = (on: boolean): void => {
  enabled = Boolean(on);
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
  }
};

const ensure = (): AudioContext | null => {
  if (context) return context;
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = 0.32;
    master.connect(context.destination);
  } catch {
    context = null;
    master = null;
  }
  return context;
};

const prime = (): void => {
  const ctx = ensure();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
};

interface ToneOptions {
  at?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  glide?: number;
}

const tone = (freq: number, options: ToneOptions = {}): void => {
  const ctx = context;
  if (!ctx || !master) return;
  const start = ctx.currentTime + (options.at || 0);
  const dur = options.dur ?? 0.16;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const peak = options.gain ?? 0.5;
  osc.type = options.type || 'sine';
  osc.frequency.setValueAtTime(freq, start);
  if (options.glide) osc.frequency.exponentialRampToValueAtTime(options.glide, start + dur);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, dur * 0.2));
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(env);
  env.connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
};

const play = (name: SoundName): void => {
  if (!enabled) return;
  const ctx = ensure();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  if (name === 'send') {
    tone(740, { dur: 0.07, type: 'triangle', gain: 0.35 });
    tone(1180, { at: 0.06, dur: 0.1, type: 'triangle', gain: 0.28 });
    return;
  }
  if (name === 'done') {
    tone(660, { dur: 0.22, type: 'sine', gain: 0.4 });
    tone(880, { at: 0.08, dur: 0.24, type: 'sine', gain: 0.34 });
    tone(1320, { at: 0.16, dur: 0.4, type: 'sine', gain: 0.26 });
    return;
  }
  if (name === 'error') {
    tone(240, { dur: 0.16, type: 'square', gain: 0.16, glide: 170 });
    tone(160, { at: 0.1, dur: 0.3, type: 'sawtooth', gain: 0.14, glide: 90 });
    return;
  }
  if (name === 'stop') {
    tone(520, { dur: 0.1, type: 'triangle', gain: 0.24, glide: 300 });
    tone(300, { at: 0.08, dur: 0.14, type: 'triangle', gain: 0.18, glide: 180 });
    return;
  }
  if (name === 'hold') {
    tone(392, { dur: 0.1, type: 'sine', gain: 0.3 });
    tone(330, { at: 0.11, dur: 0.18, type: 'sine', gain: 0.26 });
    return;
  }
  tone(140, { dur: 0.26, type: 'sine', gain: 0.4 });
  tone(523, { at: 0.02, dur: 0.5, type: 'triangle', gain: 0.3 });
  tone(784, { at: 0.04, dur: 0.6, type: 'sine', gain: 0.2 });
  tone(1046, { at: 0.06, dur: 0.7, type: 'sine', gain: 0.14 });
};

export const playSound = (name: SoundName): void => {
  try {
    play(name);
  } catch {
  }
};

window.addEventListener('pointerdown', prime, { once: true });
window.addEventListener('keydown', prime, { once: true });
