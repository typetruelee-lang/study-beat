import { useNavigate } from 'react-router-dom';
import { setBeatKind, setBinauralOn, setBusVolume, updateSettings } from '../../app/actions';
import { bandLabel } from '../../app/beats';
import { useAppState } from '../../app/store';
import { formatClock, formatDuration } from '../../lib/format';
import { ClayButton } from '../common/ClayButton';
import { ChipGroup } from '../common/Chip';
import { SoundPicks } from '../SoundLibrary/SoundPicks';
import { Slider } from '../common/Slider';
import { RecipeRow } from '../Recipes/RecipeRow';
import './focus.css';

const QUICK_TIMES = [25, 50, 90, 120];

/** Break length that goes with a focus length (25→5, 50→10, 90→15). */
const breakFor = (min: number) => (min >= 90 ? 900 : min >= 50 ? 600 : 300);

/** 집중 시간 칩. Choices are saved in settings and used next time. */
export function FocusTimeOptions() {
  const navigate = useNavigate();
  const timer = useAppState((s) => s.settings.focusTimer);
  const routine = useAppState((s) => s.routines.find((r) => r.id === s.settings.focusTimer.routineId));
  const minutes = Math.round(timer.seconds / 60);
  const quick = timer.kind === 'countdown' && !routine && QUICK_TIMES.includes(minutes) && timer.seconds % 60 === 0 ? minutes : -1;

  return (
    <section className="stack-s" aria-label="집중 시간">
      <div className="row-between">
        <h2 className="h2">집중 시간</h2>
        <ClayButton variant="ghost" onClick={() => navigate('/timer')}>타이머 설정 ›</ClayButton>
      </div>
      <ChipGroup
        label="집중 시간"
        value={quick}
        onChange={(m) =>
          updateSettings((s) => ({ focusTimer: { ...s.focusTimer, kind: 'countdown', routineId: null, seconds: m * 60, breakSeconds: breakFor(m) } }))
        }
        options={QUICK_TIMES.map((m) => ({ value: m, label: m >= 60 && m % 60 === 0 ? formatDuration(m * 60) : `${m}분` }))}
      />
      {quick === -1 && (
        <p className="small muted">
          현재:{' '}
          {routine
            ? `루틴 “${routine.name}”`
            : timer.kind === 'countup'
              ? '카운트업 (시간 제한 없음)'
              : timer.kind === 'goal'
                ? `목표 ${minutes}분`
                : formatClock(timer.seconds)}
        </p>
      )}
    </section>
  );
}

/** 배경음 + 집중 사운드 on/off + 소리 섞기. Changes apply live while playing and are saved. */
export function FocusSoundOptions() {
  const navigate = useNavigate();
  const binauralOn = useAppState((s) => s.player.binauralOn);
  const beat = useAppState((s) => s.player.beat);
  const intensity = useAppState((s) => s.settings.busVolumes.binaural);
  const kind = useAppState((s) => s.settings.beatKind);

  return (
    <section className="stack-s" aria-label="배경음과 집중 사운드">
      <h2 className="h2">추천 사운드</h2>
      <RecipeRow mode="focus" label="추천 집중 사운드" />
      <h2 className="h2">배경음</h2>
      <SoundPicks mode="focus" />
      <div className="row-between" style={{ marginTop: 4 }}>
        <h2 className="h2">집중 사운드</h2>
        <ClayButton variant="ghost" onClick={() => navigate('/binaural')}>프리셋 바꾸기 ›</ClayButton>
      </div>
      <div className="chips" role="group" aria-label="집중 사운드">
        <button type="button" className="chip" aria-pressed={binauralOn} onClick={() => setBinauralOn(!binauralOn)}>
          🎧 {binauralOn ? `켜짐 · ${beat}Hz · ${bandLabel(beat)}` : '꺼짐'}
        </button>
      </div>
      {binauralOn && (
        <>
          <Slider label="강도" value={intensity} onChange={(v) => setBusVolume('binaural', v)} />
          <div className="chips" role="radiogroup" aria-label="듣는 방식">
            <button type="button" role="radio" className="chip" aria-checked={kind === 'binaural'} onClick={() => setBeatKind('binaural')}>
              🎧 이어폰용 (바이노럴)
            </button>
            <button type="button" role="radio" className="chip" aria-checked={kind === 'isochronic'} onClick={() => setBeatKind('isochronic')}>
              🔈 스피커용 (아이소크로닉)
            </button>
          </div>
        </>
      )}
      <ClayButton block onClick={() => navigate('/mixer')}>🎚 소리 섞기 (볼륨 조절)</ClayButton>
    </section>
  );
}

/** Everything the focus screens let you change before starting. */
export function FocusOptions() {
  return (
    <>
      <FocusTimeOptions />
      <FocusSoundOptions />
    </>
  );
}
