import { updateSettings } from '../../app/actions';
import { useAppState } from '../../app/store';
import { RelaxScene } from '../scenes/RelaxScene';
import { AmbientMode } from '../Sleep/AmbientMode';

export function Relax() {
  const minutes = useAppState((s) => s.settings.relaxMinutes);
  return (
    <AmbientMode
      mode="relax"
      title="휴식 / 명상"
      scene={(active) => <RelaxScene id="relax-hero" active={active} />}
      timerValue={minutes}
      onTimerChange={(v) => updateSettings({ relaxMinutes: v ?? 10 })}
      timerOptions={[5, 10, 15, 20, 30].map((m) => ({ value: m, label: `${m}분` }))}
      footnote="눈을 감고 호흡에 귀 기울여 보세요."
    />
  );
}
