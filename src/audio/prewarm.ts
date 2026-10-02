/**
 * Prepare procedural sound data ahead of time, one sound per idle slot, so starting playback
 * never blocks the main thread with generation (that caused stutter right after start).
 * Uses a throwaway OfflineAudioContext: no audio device, no user gesture needed.
 */
import { getSound } from '../sounds/catalog';
import { startSynth } from './ambient/synths';

const warmed = new Set<string>();
const queue: string[] = [];
let scheduled = false;
let holdUntil = 0;

/** Keep the main thread free while playback is starting (queue resumes afterwards). */
export function holdPrewarm(ms: number) {
  holdUntil = Date.now() + ms;
}

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };

export function prewarmSounds(ids: string[]) {
  for (const id of ids) if (!warmed.has(id) && !queue.includes(id)) queue.push(id);
  schedule();
}

export function isPrewarmed(id: string): boolean {
  return warmed.has(id);
}

function schedule() {
  if (scheduled || queue.length === 0 || typeof window === 'undefined') return;
  scheduled = true;
  const run = () => {
    scheduled = false;
    if (Date.now() < holdUntil) {
      setTimeout(schedule, holdUntil - Date.now());
      return;
    }
    const id = queue.shift();
    if (id) warm(id);
    schedule();
  };
  const w = window as IdleWindow;
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 1500 });
  else setTimeout(run, 60);
}

/** Generate a sound's buffers now (also used when a sound is needed before its idle turn). */
export function warm(id: string) {
  if (warmed.has(id)) return;
  const meta = getSound(id);
  if (!meta?.synth || typeof OfflineAudioContext === 'undefined') return;
  warmed.add(id);
  try {
    const ctx = new OfflineAudioContext(2, 128, 48000);
    for (const s of startSynth(ctx, meta.synth, ctx.destination)) {
      try {
        s.stop();
      } catch {
        /* never started */
      }
    }
  } catch {
    warmed.delete(id);
  }
}
