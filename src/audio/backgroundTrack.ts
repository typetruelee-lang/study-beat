/**
 * Screen-off playback as an ordinary audio file.
 *
 * Mobile browsers keep a plain <audio> element playing with the screen off, the way music sites
 * do. The previous approach — routing the live mix through a MediaStream into an <audio> element —
 * is handled as real-time *communication* audio on Android: Bluetooth earphones can drop from
 * stereo music (A2DP) to the mono call profile (HFP), which sums the two ears of a binaural beat
 * into a 10 Hz on/off pulse ("뚝뚝 끊김") and lets call noise suppression erase the steady tone
 * ("비트만 사라짐"). A file never takes that path, so the beat stays stereo.
 *
 * The engine renders the current mix offline (same graph, same sounds) and this module turns the
 * render into a seamless loop and a WAV file.
 */

/** Loop length. A whole number of seconds keeps every integer-Hz tone phase-aligned at the seam. */
export const LOOP_SECONDS = 30;
/** Rendered before the loop starts so every fade-in has finished. */
export const PREROLL_SECONDS = 3;
/** Crossfade of the ambient bed at the seam (the tone needs none: it repeats exactly). */
export const XFADE_SECONDS = 1.5;
/** 32 kHz: plenty for a 400–510 Hz beat and the ambient beds; 30 s = 300 FLAC blocks of 3200. */
export const RENDER_RATE = 32000;

export interface Stereo {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
}

/**
 * Build the loop from two renders of PREROLL + LOOP + XFADE seconds:
 *   tone — the beat alone: periodic, copied as is (LOOP_SECONDS × Hz is a whole number of cycles)
 *   bed  — ambient + noise: not periodic, so its tail is crossfaded (equal power) into its head.
 * The last sample of the loop is followed by the first one exactly as in the original render.
 */
export function buildLoop(tone: Stereo | null, bed: Stereo | null): Stereo {
  const src = tone ?? bed;
  if (!src) throw new Error('nothing to loop');
  const sr = src.sampleRate;
  const n = Math.round(LOOP_SECONDS * sr);
  const pre = Math.round(PREROLL_SECONDS * sr);
  const xf = Math.round(XFADE_SECONDS * sr);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  if (tone) {
    left.set(tone.left.subarray(pre, pre + n));
    right.set(tone.right.subarray(pre, pre + n));
  }
  if (bed) {
    for (const [out, ch] of [[left, bed.left], [right, bed.right]] as const) {
      for (let i = 0; i < n; i++) {
        let v = ch[pre + i];
        if (i < xf) {
          // Head fades in while the continuation of the tail fades out.
          const t = (i + 0.5) / xf;
          v = v * Math.sin((t * Math.PI) / 2) + ch[pre + n + i] * Math.cos((t * Math.PI) / 2);
        }
        out[i] += v;
      }
    }
  }
  return { left, right, sampleRate: sr };
}

/** 16-bit PCM stereo WAV. */
export function encodeWav({ left, right, sampleRate }: Stereo): ArrayBuffer {
  const frames = left.length;
  const data = frames * 4;
  const buf = new ArrayBuffer(44 + data);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + data, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 2, true); // stereo
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, data, true);
  const pcm = new Int16Array(buf, 44, frames * 2);
  for (let i = 0; i < frames; i++) {
    pcm[2 * i] = toInt16(left[i]);
    pcm[2 * i + 1] = toInt16(right[i]);
  }
  return buf;
}

function toInt16(x: number): number {
  const c = Math.max(-1, Math.min(1, x));
  return Math.round(c < 0 ? c * 0x8000 : c * 0x7fff);
}

/** Half a second of silence: lets the element start inside the first tap, before any render. */
export function silentWav(): ArrayBuffer {
  const n = Math.round(RENDER_RATE / 2);
  return encodeWav({ left: new Float32Array(n), right: new Float32Array(n), sampleRate: RENDER_RATE });
}
