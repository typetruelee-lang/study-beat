/**
 * Gapless screen-off playback.
 *
 * `<audio loop>` restarts a file with a short silence at every loop point (≈110 ms measured in
 * Chromium) — heard as the sound "cutting out and starting again" every 30 s. Instead the loop is
 * streamed through Media Source Extensions: the same 30 s of audio is appended again and again
 * with increasing timestamps, so playback never reaches an end and never seeks.
 *
 * The audio is packed as FLAC (uncompressed VERBATIM frames: no encoder, no codec delay or padding,
 * so consecutive copies join sample-exactly) inside fragmented MP4, which Chromium's MSE accepts
 * (`audio/mp4; codecs="flac"`). Where that is not supported the caller falls back to a WAV loop.
 */
import type { Stereo } from './backgroundTrack';

export const STREAM_MIME = 'audio/mp4; codecs="flac"';
/** Samples per FLAC frame (0.1 s at 32 kHz). */
const BLOCK = 3200;
/** Keep this much audio buffered ahead of the playhead (s) — survives throttled timers. */
const AHEAD_SECONDS = 50;
/** Drop played audio older than this (s) to stay well inside the SourceBuffer quota. */
const BEHIND_SECONDS = 8;

export function streamSupported(): boolean {
  return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(STREAM_MIME);
}

// ─── FLAC ────────────────────────────────────────────────────────────────────

const CRC8 = new Uint8Array(256);
const CRC16 = new Uint16Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  CRC8[i] = c;
  let d = i << 8;
  for (let k = 0; k < 8; k++) d = d & 0x8000 ? ((d << 1) ^ 0x8005) & 0xffff : (d << 1) & 0xffff;
  CRC16[i] = d;
}

const RATE_CODES: Record<number, number> = { 8000: 4, 16000: 5, 22050: 6, 24000: 7, 32000: 8, 44100: 9, 48000: 10, 96000: 11 };

/** FLAC "UTF-8" coded frame number. */
function utf8Number(n: number): number[] {
  if (n < 0x80) return [n];
  const out: number[] = [];
  let len = 2;
  while (n >= 2 ** (5 * len + 1)) len++;
  for (let i = len - 1; i > 0; i--) {
    out.unshift(0x80 | (n & 0x3f));
    n = Math.floor(n / 64);
  }
  out.unshift(((0xff00 >> len) & 0xff) | n);
  return out;
}

/** One FLAC frame: header + two VERBATIM 16-bit subframes + CRC-16. */
export function flacFrame(left: Int16Array, right: Int16Array, start: number, count: number, frameNo: number, rate: number): Uint8Array {
  const head = [0xff, 0xf8, (0x7 << 4) | RATE_CODES[rate], (0x1 << 4) | (0x4 << 1), ...utf8Number(frameNo), ((count - 1) >> 8) & 0xff, (count - 1) & 0xff];
  let c8 = 0;
  for (const b of head) c8 = CRC8[c8 ^ b];
  head.push(c8);
  const size = head.length + 2 * (1 + count * 2) + 2;
  const out = new Uint8Array(size);
  out.set(head);
  let o = head.length;
  for (const ch of [left, right]) {
    out[o++] = 0x02; // VERBATIM, no wasted bits
    for (let i = 0; i < count; i++) {
      const s = ch[start + i];
      out[o++] = (s >> 8) & 0xff;
      out[o++] = s & 0xff;
    }
  }
  let c16 = 0;
  for (let i = 0; i < o; i++) c16 = ((c16 << 8) & 0xffff) ^ CRC16[(c16 >> 8) ^ out[i]];
  out[o++] = c16 >> 8;
  out[o++] = c16 & 0xff;
  return out;
}

/** STREAMINFO metadata block body (34 bytes). */
function streamInfo(rate: number, maxFrame: number): Uint8Array {
  const b = new Uint8Array(34);
  const v = new DataView(b.buffer);
  v.setUint16(0, BLOCK);
  v.setUint16(2, BLOCK);
  b.set([0, 0, 0], 4); // min frame size unknown
  b.set([(maxFrame >> 16) & 0xff, (maxFrame >> 8) & 0xff, maxFrame & 0xff], 7);
  // sample rate (20) · channels-1 (3) · bits-1 (5) · total samples (36, 0 = unknown)
  b[10] = (rate >> 12) & 0xff;
  b[11] = (rate >> 4) & 0xff;
  b[12] = ((rate & 0x0f) << 4) | (1 << 1) | (15 >> 4);
  b[13] = (15 & 0x0f) << 4;
  return b;
}

// ─── fragmented MP4 ──────────────────────────────────────────────────────────

function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const len = 8 + parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  new DataView(out.buffer).setUint32(0, len);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  let o = 8;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
const u8 = (...a: number[]) => new Uint8Array(a);
const u16 = (n: number) => u8((n >> 8) & 0xff, n & 0xff);
const u32 = (n: number) => u8((n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
const u64 = (n: number) => {
  const hi = Math.floor(n / 2 ** 32);
  return new Uint8Array([...u32(hi), ...u32(n >>> 0)]);
};
const zeros = (n: number) => new Uint8Array(n);
const full = (version: number, flags: number) => u32((version << 24) | flags);
const str = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const MATRIX = new Uint8Array([...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x40000000)]);

export function fmp4Init(rate: number): Uint8Array {
  const maxFrame = 16 + 2 * (1 + BLOCK * 2) + 2;
  const dfLa = box('dfLa', full(0, 0), u8(0x80, 0, 0, 34), streamInfo(rate, maxFrame)); // last block · STREAMINFO · 34 bytes
  const fLaC = box('fLaC', zeros(6), u16(1), zeros(8), u16(2), u16(16), zeros(4), u32(rate * 65536), dfLa);
  const stbl = box(
    'stbl',
    box('stsd', full(0, 0), u32(1), fLaC),
    box('stts', full(0, 0), u32(0)),
    box('stsc', full(0, 0), u32(0)),
    box('stsz', full(0, 0), u32(0), u32(0)),
    box('stco', full(0, 0), u32(0)),
  );
  const minf = box('minf', box('smhd', full(0, 0), zeros(4)), box('dinf', box('dref', full(0, 0), u32(1), box('url ', full(0, 1)))), stbl);
  const mdia = box(
    'mdia',
    box('mdhd', full(0, 0), u32(0), u32(0), u32(rate), u32(0), u16(0x55c4), u16(0)),
    box('hdlr', full(0, 0), u32(0), str('soun'), zeros(12), str('sound'), u8(0)),
    minf,
  );
  const trak = box('trak', box('tkhd', full(0, 3), u32(0), u32(0), u32(1), u32(0), u32(0), zeros(8), u16(0), u16(0), u16(0x0100), u16(0), MATRIX, u32(0), u32(0)), mdia);
  const mvex = box('mvex', box('trex', full(0, 0), u32(1), u32(1), u32(0), u32(0), u32(0)));
  const moov = box('moov', box('mvhd', full(0, 0), u32(0), u32(0), u32(1000), u32(0), u32(0x10000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(2)), trak, mvex);
  return new Uint8Array([...box('ftyp', str('iso6'), u32(0), str('iso6'), str('mp41')), ...moov]);
}

/** One movie fragment holding `frames` (each one FLAC frame = one sample of BLOCK samples). */
export function fmp4Fragment(frames: Uint8Array[], seq: number, baseTime: number): Uint8Array {
  const trunLen = 8 + 4 + 4 + 4 + frames.length * 8;
  const tfhd = box('tfhd', full(0, 0x020000), u32(1));
  const tfdt = box('tfdt', full(1, 0), u64(baseTime));
  const trafLen = 8 + tfhd.length + tfdt.length + trunLen;
  const moofLen = 8 + 16 + trafLen;
  const entries = new Uint8Array(frames.length * 8);
  const ev = new DataView(entries.buffer);
  frames.forEach((f, i) => {
    ev.setUint32(i * 8, BLOCK);
    ev.setUint32(i * 8 + 4, f.length);
  });
  const trun = box('trun', full(0, 0x000301), u32(frames.length), u32(moofLen + 8), entries);
  const moof = box('moof', box('mfhd', full(0, 0), u32(seq)), box('traf', tfhd, tfdt, trun));
  return new Uint8Array([...moof, ...box('mdat', ...frames)]);
}

// ─── streaming player ────────────────────────────────────────────────────────

function toInt16(ch: Float32Array): Int16Array {
  const out = new Int16Array(ch.length);
  for (let i = 0; i < ch.length; i++) {
    const c = Math.max(-1, Math.min(1, ch[i]));
    out[i] = Math.round(c < 0 ? c * 0x8000 : c * 0x7fff);
  }
  return out;
}

/**
 * Plays a loop endlessly through MSE on `el`. The loop length must be a whole number of FLAC
 * blocks (30 s at 32 kHz = 300 blocks).
 */
export class LoopStream {
  private ms = new MediaSource();
  private sb: SourceBuffer | null = null;
  private left: Int16Array;
  private right: Int16Array;
  private frames: number;
  private nextFrame = 0; // running frame index (also the timeline position)
  private seq = 1;
  private disposed = false;
  readonly url: string;

  constructor(
    private el: HTMLAudioElement,
    loop: Stereo,
    private onLog: (msg: string) => void = () => {},
  ) {
    this.left = toInt16(loop.left);
    this.right = toInt16(loop.right);
    this.frames = Math.floor(this.left.length / BLOCK);
    this.url = URL.createObjectURL(this.ms);
    this.ms.addEventListener('sourceopen', () => this.open(loop.sampleRate), { once: true });
    el.addEventListener('timeupdate', this.pump);
  }

  private rate = 32000;

  private open(rate: number) {
    if (this.disposed) return;
    this.rate = rate;
    const sb = this.ms.addSourceBuffer(STREAM_MIME);
    sb.mode = 'segments';
    this.sb = sb;
    sb.addEventListener('updateend', this.pump);
    sb.addEventListener('error', () => this.onLog('배경 스트림 오류'));
    sb.appendBuffer(fmp4Init(rate) as Uint8Array<ArrayBuffer>);
  }

  /** Buffered seconds ahead of the playhead. */
  get ahead(): number {
    const b = this.sb?.buffered;
    if (!b || b.length === 0) return 0;
    return b.end(b.length - 1) - this.el.currentTime;
  }

  private pump = () => {
    const sb = this.sb;
    if (!sb || sb.updating || this.disposed || this.ms.readyState !== 'open') return;
    const t = this.el.currentTime;
    const b = sb.buffered;
    if (b.length && t - b.start(0) > BEHIND_SECONDS + 5) {
      sb.remove(0, t - BEHIND_SECONDS);
      return; // continue on updateend
    }
    if (this.ahead < AHEAD_SECONDS) this.appendSeconds(10);
  };

  private appendSeconds(seconds: number) {
    const n = Math.round((seconds * this.rate) / BLOCK);
    const frames: Uint8Array[] = [];
    const base = this.nextFrame * BLOCK;
    for (let i = 0; i < n; i++) {
      const idx = (this.nextFrame + i) % this.frames;
      frames.push(flacFrame(this.left, this.right, idx * BLOCK, BLOCK, this.nextFrame + i, this.rate));
    }
    this.nextFrame += n;
    try {
      this.sb!.appendBuffer(fmp4Fragment(frames, this.seq++, base) as Uint8Array<ArrayBuffer>);
    } catch (e) {
      this.onLog(`배경 스트림을 이어 붙이지 못함: ${String(e)}`);
    }
  }

  dispose() {
    this.disposed = true;
    this.el.removeEventListener('timeupdate', this.pump);
    URL.revokeObjectURL(this.url);
  }
}

/** The same frames as a plain .flac file (used by checks to verify the encoding by decoding it). */
export function flacFile(loop: Stereo): Uint8Array {
  const left = toInt16(loop.left);
  const right = toInt16(loop.right);
  const n = Math.floor(left.length / BLOCK);
  const maxFrame = 16 + 2 * (1 + BLOCK * 2) + 2;
  const parts: Uint8Array[] = [str('fLaC'), u8(0x80, 0, 0, 34), streamInfo(loop.sampleRate, maxFrame)];
  for (let i = 0; i < n; i++) parts.push(flacFrame(left, right, i * BLOCK, BLOCK, i, loop.sampleRate));
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
