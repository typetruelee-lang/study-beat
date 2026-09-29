import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { selectMode, updateSettings } from '../../app/actions';
import { bandLabel, beatLabel } from '../../app/beats';
import { useMixSummary } from '../../app/hooks';
import { useAppState } from '../../app/store';
import { formatClock } from '../../lib/format';
import { ClayButton } from '../common/ClayButton';
import { ChipGroup } from '../common/Chip';
import { ScreenHeader } from '../common/ScreenHeader';
import { StudyScene } from '../scenes/StudyScene';
import { SoundPicks } from '../SoundLibrary/SoundPicks';
import { Waveform } from '../AudioPlayer/Waveform';
import './focus.css';

const QUICK_TIMES = [25, 50, 90];

export function FocusSetup() {
  const navigate = useNavigate();
  const timer = useAppState((s) => s.settings.focusTimer);
  const routines = useAppState((s) => s.routines);
  const binauralOn = useAppState((s) => s.player.binauralOn);
  const beat = useAppState((s) => s.player.beat);
  const playing = useAppState((s) => s.player.playing);
  const session = useAppState((s) => s.session);
  const summary = useMixSummary();
  useEffect(() => selectMode('focus'), []);

  const routine = routines.find((r) => r.id === timer.routineId);
  const minutes = Math.round(timer.seconds / 60);
  const quick = timer.kind === 'countdown' && !routine && QUICK_TIMES.includes(minutes) && timer.seconds % 60 === 0 ? minutes : -1;
  const big = timer.kind === 'countup' ? '00:00' : formatClock(routine ? routine.phases[0].seconds : timer.seconds);

  return (
    <div className="screen stack">
      <ScreenHeader title="집중 / 공부" />
      <div className="mode-hero"><StudyScene id="focus-hero" /></div>

      <div className="stack-s" style={{ marginTop: 4 }}>
        <p className="big-time">{big}</p>
        <p className="sound-line">{summary}</p>
        {binauralOn && (
          <p className="hz-line"><b>{beat} Hz</b> · {bandLabel(beat)} · {beatLabel(beat)}</p>
        )}
        <Waveform playing={playing} />
      </div>

      <section className="stack-s" aria-label="집중 시간">
        <div className="row-between">
          <h2 className="h2">집중 시간</h2>
          <ClayButton variant="ghost" onClick={() => navigate('/timer')}>타이머 설정 ›</ClayButton>
        </div>
        <ChipGroup
          label="집중 시간"
          value={quick}
          onChange={(m) => updateSettings((s) => ({ focusTimer: { ...s.focusTimer, kind: 'countdown', routineId: null, seconds: m * 60, breakSeconds: m >= 90 ? 900 : m >= 50 ? 600 : 300 } }))}
          options={[
            ...QUICK_TIMES.map((m) => ({ value: m, label: `${m}분` })),
          ]}
        />
        {quick === -1 && (
          <p className="small muted">
            현재: {routine ? `루틴 “${routine.name}”` : timer.kind === 'countup' ? '카운트업 (시간 제한 없음)' : timer.kind === 'goal' ? `목표 ${minutes}분` : `${formatClock(timer.seconds)}`}
          </p>
        )}
      </section>

      <section className="stack-s" aria-label="배경음">
        <h2 className="h2">배경음</h2>
        <SoundPicks mode="focus" />
        <div className="link-row">
          <ClayButton onClick={() => navigate('/binaural')}>🎧 집중 사운드</ClayButton>
          <ClayButton onClick={() => navigate('/mixer')}>🎚 소리 섞기</ClayButton>
        </div>
      </section>

      <div className="sticky-cta">
        {session?.mode === 'focus' ? (
          <ClayButton variant="primary" size="lg" block onClick={() => navigate('/focus/session')}>집중 화면으로 돌아가기</ClayButton>
        ) : (
          <ClayButton variant="primary" size="lg" block onClick={() => navigate('/focus/ready')}>▶ 집중 시작</ClayButton>
        )}
      </div>
    </div>
  );
}
