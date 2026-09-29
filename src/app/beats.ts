/**
 * Beat-frequency presets, grouped by the standard EEG frequency bands used in research
 * (IFCN 2020 recommendations: δ 0.1–<4 · θ 4–<8 · α 8–13 · β 14–30 · γ >30–80 Hz).
 * The band only describes the *frequency of the sound*; labels describe use, never an effect.
 */
export type Band = 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma';

export const BANDS: Record<Band, { name: string; symbol: string; range: string }> = {
  delta: { name: '델타', symbol: 'δ', range: '4Hz 미만' },
  theta: { name: '세타', symbol: 'θ', range: '4–8Hz' },
  alpha: { name: '알파', symbol: 'α', range: '8–13Hz' },
  beta: { name: '베타', symbol: 'β', range: '14–30Hz' },
  gamma: { name: '감마', symbol: 'γ', range: '30Hz 초과' },
};

export function bandOf(hz: number): Band {
  if (hz < 4) return 'delta';
  if (hz < 8) return 'theta';
  if (hz <= 13) return 'alpha';
  if (hz <= 30) return 'beta';
  return 'gamma';
}

export function bandLabel(hz: number): string {
  const b = BANDS[bandOf(hz)];
  return `${b.symbol} ${b.name} 대역`;
}

export interface BeatPreset {
  hz: number;
  label: string;
  hint: string;
  /** Extra caution shown with the preset. */
  note?: string;
}

export const BEAT_PRESETS: readonly BeatPreset[] = [
  { hz: 2, label: '깊은 수면용', hint: '잠든 뒤까지 틀어둘 때' },
  { hz: 4, label: '잠들기 전', hint: '누워서 긴장을 풀 때' },
  { hz: 6, label: '휴식·명상용', hint: '눈을 감고 쉬고 싶을 때' },
  { hz: 8, label: '집중 준비', hint: '공부를 시작하기 전' },
  { hz: 10, label: '집중용', hint: '공부할 때 기본 추천' },
  { hz: 12, label: '집중 강화', hint: '조금 더 또렷하게' },
  { hz: 14, label: '작업용', hint: '업무·코딩할 때' },
  { hz: 18, label: '업무 몰입', hint: '활발하게 일할 때' },
  {
    hz: 40,
    label: '감마 (실험적)',
    hint: '짧게 들어보는 용도',
    note: '두 귀의 차이가 30Hz를 넘으면 맥놀이보다 떨림처럼 들릴 수 있어요.',
  },
];

export function beatLabel(hz: number): string {
  return BEAT_PRESETS.find((p) => p.hz === hz)?.label ?? `${hz}Hz 사운드`;
}

/** Carrier (left-ear) choices. Binaural beats are heard best with carriers around 400–500 Hz. */
export const CARRIER_OPTIONS = [400, 440, 500] as const;
