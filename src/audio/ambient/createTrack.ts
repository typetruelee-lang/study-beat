import type { SoundMeta } from '../../sounds/types';
import type { TrackFactory } from '../AudioEngine';
import { startSynth } from './synths';

const fileCache = new WeakMap<BaseAudioContext, Map<string, Promise<AudioBuffer>>>();

function loadFile(ctx: BaseAudioContext, path: string): Promise<AudioBuffer> {
  let m = fileCache.get(ctx);
  if (!m) fileCache.set(ctx, (m = new Map()));
  let p = m.get(path);
  if (!p) {
    p = fetch(new URL(path, document.baseURI))
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${path}`);
        return r.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data));
    p.catch(() => m!.delete(path)); // allow a retry later
    m.set(path, p);
  }
  return p;
}

/**
 * Plays a sound from its metadata: a recorded file when `source: "file"` (looped), otherwise
 * the procedural recipe. A file that fails to load falls back to its `synth` recipe.
 */
export const createTrack: TrackFactory = (ctx, meta: SoundMeta, output) => {
  let sources: AudioScheduledSourceNode[] = [];
  let stopped = false;
  const synth = () => {
    if (!stopped && meta.synth) sources = startSynth(ctx, meta.synth, output);
  };

  if (meta.source === 'file' && meta.file) {
    loadFile(ctx, meta.file)
      .then((buffer) => {
        if (stopped) return;
        const src = new AudioBufferSourceNode(ctx, { buffer, loop: meta.loop });
        src.connect(output);
        src.start();
        sources = [src];
      })
      .catch(synth);
  } else {
    synth();
  }

  return {
    stop(fadeSeconds: number) {
      stopped = true;
      const t = ctx.currentTime + fadeSeconds + 0.05;
      for (const s of sources) {
        try {
          s.stop(t);
        } catch {
          /* already stopped */
        }
      }
    },
  };
};
