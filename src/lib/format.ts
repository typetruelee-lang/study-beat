/** 1500 → "25:00", 3725 → "1:02:05" (clock style, for timers). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 9300 → "2시간 35분", 2700 → "45분", 30 → "0분" (human style, for records). */
export function formatDuration(totalSeconds: number): string {
  const totalMin = Math.floor(Math.max(0, totalSeconds) / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/** Short form for tight spaces: 9300 → "2h 35m". */
export function formatDurationShort(totalSeconds: number): string {
  const totalMin = Math.floor(Math.max(0, totalSeconds) / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
