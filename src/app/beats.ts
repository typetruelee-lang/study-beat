/** Sound presets. Labels describe the *use*, never a physiological effect. */
export const BEAT_PRESETS = [
  { hz: 4, label: '수면용 사운드', hint: '잠들기 전, 깊은 휴식' },
  { hz: 6, label: '휴식용 사운드', hint: '느긋하게 쉬고 싶을 때' },
  { hz: 8, label: '집중 준비', hint: '공부를 시작하기 전' },
  { hz: 10, label: '집중용 사운드', hint: '공부할 때 기본 추천' },
  { hz: 12, label: '집중 강화', hint: '조금 더 또렷하게' },
  { hz: 14, label: '작업용 사운드', hint: '업무·코딩할 때' },
] as const;

export function beatLabel(hz: number): string {
  return BEAT_PRESETS.find((p) => p.hz === hz)?.label ?? `${hz}Hz 사운드`;
}
