import { updateSettings } from '../../app/actions';
import { useAppState } from '../../app/store';
import { SleepScene } from '../scenes/SleepScene';
import { AmbientMode } from './AmbientMode';

export function Sleep() {
  const minutes = useAppState((s) => s.settings.sleepMinutes);
  return (
    <AmbientMode
      mode="sleep"
      title="수면"
      scene={(active) => <SleepScene id="sleep-hero" active={active} />}
      timerValue={minutes}
      onTimerChange={(v) => updateSettings({ sleepMinutes: v })}
      timerOptions={[
        ...[15, 30, 60, 90, 120].map((m) => ({ value: m, label: `${m}분` })),
        { value: null, label: '무제한' },
      ]}
      footnote="타이머가 끝나면 20초 동안 소리가 천천히 줄어들어요. 화면을 꺼도 되지만, 기기에 따라 소리가 멈출 수 있어요."
    />
  );
}
