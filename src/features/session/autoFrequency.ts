/**
 * Optional "자동 주파수 변화": the focus sound preset glides through stages as a session
 * progresses. Changes are applied with a long ramp by the audio engine, so there is no jump.
 *
 *   0–15%  8 Hz (시작) · 15–60% base (집중 진입) · 60–90% base+2 (집중 유지) · 90–100% base (마무리)
 */
export const AUTO_STAGES = [
  { until: 0.15, label: '시작', offset: -2 },
  { until: 0.6, label: '집중 진입', offset: 0 },
  { until: 0.9, label: '집중 유지', offset: +2 },
  { until: Infinity, label: '마무리', offset: 0 },
] as const;

export function autoStage(progress: number) {
  return AUTO_STAGES.find((s) => progress < s.until) ?? AUTO_STAGES[AUTO_STAGES.length - 1];
}

export function beatForProgress(progress: number, baseBeat: number): number {
  return Math.max(1, baseBeat + autoStage(progress).offset);
}
